// BookingFlow.jsx  -  Flux de réservation trilingue FR/EN/ES
// Date → Durée → Notes → Récap → Paiement Stripe
// Contrat status='pending'  -  nettoyé si Stripe échoue

import { useState, useEffect} from 'react'
import { supabase }       from '../lib/supabase'
import { useT, toLocale } from '../lib/i18n'
import { TaxCreditBlock }  from './TaxCreditDisplay'

const G = '#6C63FF'

const SERVICE_ICONS = {
  childcare:'👶', petsitter:'🐾', seniorcare:'🧓',
  cleaning:'🧹', handyman:'🔧', lawn:'🌿', errands:'🛒',
}

export default function BookingFlow({ worker, service, date: initialDate, userId, navigate, lang = 'fr' }) {
  const { t, isFR } = useT(lang)

  const [step,     setStep]     = useState(1)
  const [date,     setDate]     = useState(initialDate || '')
  const [time,     setTime]     = useState('18:00')
  const [duration, setDuration] = useState(2)
  const [notes,    setNotes]    = useState('')
  const [saving,      setSaving]      = useState(false)
  const [subBlocked,  setSubBlocked]  = useState(false)
  const [blockedDates, setBlockedDates] = useState([]) // 'YYYY-MM-DD' strings
  const [marketCurrency,  setMarketCurrency]  = useState(null)
  const [marketCountry,   setMarketCountry]   = useState(null)
  const [marketId,        setMarketId]        = useState(null)
  const [marketLoading,   setMarketLoading]   = useState(true)

  // Vérifier que l'abonnement est actif avant de permettre la réservation
  useEffect(() => {
    if (!userId) return
    supabase.from('profiles').select('subscription_status')
      .eq('id', userId).single()
      .then(({ data }) => {
        const status = data?.subscription_status
        if (status === 'expired') setSubBlocked(true)
      })
  }, [userId])

  // Charger la devise ET l'id du marché du worker.
  // Priorité : city_slug > country (scalable multi-ville).
  useEffect(() => {
    const slug    = worker?.detected_city_slug
    const country = worker?.detected_country
    if (!slug && !country) { setMarketLoading(false); return }
    setMarketLoading(true)
    let q = supabase.from('markets').select('id, currency, country').eq('status', 'active').limit(1)
    if (slug) q = q.eq('slug', slug)
    else      q = q.eq('country', country)
    q.maybeSingle()
      .then(({ data }) => {
        if (data?.currency) setMarketCurrency(data.currency.toLowerCase())
        if (data?.country)  setMarketCountry(data.country.toUpperCase())
        if (data?.id)       setMarketId(data.id)
      })
      .catch(() => {})
      .finally(() => setMarketLoading(false))
  }, [worker?.detected_city_slug, worker?.detected_country])

  // Charger les dates bloquées du worker
  useEffect(() => {
    if (!worker?.id) return
    const today = new Date().toISOString().split('T')[0]
    supabase
      .from('worker_blocked_dates')
      .select('date_start, date_end')
      .eq('worker_id', worker.id)
      .gte('date_end', today)
      .then(({ data }) => {
        if (!data?.length) return
        const dates = []
        data.forEach(({ date_start, date_end }) => {
          const cur = new Date(date_start + 'T12:00')
          const end = new Date(date_end   + 'T12:00')
          while (cur <= end) {
            dates.push(cur.toISOString().split('T')[0])
            cur.setDate(cur.getDate() + 1)
          }
        })
        setBlockedDates(dates)
      })
      .catch(() => {}) // table may not exist yet
  }, [worker?.id])
  const [error,     setError]     = useState(null)
  const [recurrence,setRecurrence]= useState('once')  // once | weekly | biweekly | monthly
  const [recEndDate,setRecEndDate]= useState('')
  const [recCreated,setRecCreated]= useState(null)    // { count }

  if (!worker) return null

  const rate    = Number(worker.service_rates?.[service]) || worker.hourly_rate || 20
  const total   = rate * duration
  // Devise : markets.currency (city_slug ou country) → fallback pays → null si inconnu
  const currencyFallback = worker.detected_country === 'FR' ? 'eur'
    : worker.detected_country === 'CA' ? 'cad'
    : worker.detected_country ? 'usd'
    : null
  const currency   = marketCurrency || currencyFallback
  const sym        = currency === 'eur' ? '€' : currency === 'cad' ? 'CA$' : '$'
  // Source de vérité : country du marché du worker (pas la langue de la famille)
  const taxCountry = marketCountry
    || (marketCurrency === 'eur' ? 'FR' : marketCurrency === 'cad' ? 'CA' : null)
    || (worker.detected_country?.toUpperCase() ?? 'US')
  const svcIcon = SERVICE_ICONS[service] || '📋'
  const locale  = toLocale(lang)
  const fmt     = n => `${sym}${parseFloat(n).toFixed(2)}`

  function validateStep1() {
    if (!date) { setError(t('book_select_date')); return false }
    if (new Date(`${date}T${time}:00`) <= new Date()) {
      setError(t('book_future_date')); return false
    }
    if (blockedDates.includes(date)) {
      setError(isFR
        ? 'Ce prestataire n\'est pas disponible ce jour-là. Choisissez une autre date.'
        : 'The provider is unavailable on this date. Please choose another day.')
      return false
    }
    setError(null); return true
  }

  async function handleBook() {
    setSaving(true); setError(null)
    if (!currency) {
      setError(isFR
        ? 'Marché non disponible pour ce prestataire. Contactez le support.'
        : 'Market not available for this provider. Please contact support.')
      setSaving(false)
      return
    }
    let contractId = null
    try {
      const { data: contract, error: e1 } = await supabase
        .from('contracts')
        .insert({
          client_id:        userId,
          worker_id:        worker.id,
          service_type:     service || 'childcare',
          mission_date:      date,          // 'YYYY-MM-DD' — type date en base
          start_time:        time,          // 'HH:MM' — NOT NULL sans défaut
          mission_start_utc: new Date(`${date}T${time}:00`).toISOString(), // UTC exact (timezone navigateur)
          duration_minutes: duration * 60,
          hourly_rate:      rate,
          total_amount:     total,
          currency:         currency.toUpperCase(),
          market_id:        marketId || null,
          status:           'pending',
          notes:            notes.trim() || null,
          created_at:       new Date().toISOString(),
        })
        .select('id').single()

      if (e1) throw e1
      contractId = contract.id

      const { data: checkout, error: e2 } = await supabase.functions.invoke(
        'stripe-checkout', {
          body: {
            contract_id:  contractId,
            amount_cents: Math.round(total * 100),
            currency:     currency,
            worker_id:    worker.id,
            client_id:    userId,
            description:  `Nynly  -  ${service || 'service'}  -  ${duration}h ${t('book_with')} ${worker.first_name}`,
            success_url:  `${window.location.origin}/booking-success?contract=${contractId}`,
            cancel_url:   `${window.location.origin}/`,
          }
        }
      )
      if (e2) {
        await supabase.from('contracts').delete().eq('id', contractId).eq('status', 'pending')
        let errMsg = e2.message
        try {
          const body = await e2.context?.json()
          if (body?.error) errMsg = body.error
        } catch { /* ignore */ }
        throw new Error(errMsg)
      }
      if (checkout?.url) { window.location.href = checkout.url; return }
      // Mode démo
      await supabase.from('contracts').update({ status: 'confirmed' }).eq('id', contractId)
      navigate?.('/booking-success', { contractId })
    } catch (e) {
      if (contractId) supabase.from('contracts').delete().eq('id', contractId).eq('status', 'pending').then(()=>{}).catch(()=>{})
      setError(e.message || t('error_generic'))
      setSaving(false)
    }
  }

  // Calculer le nombre de réservations récurrentes
  function calcRecurrenceCount() {
    if (recurrence === 'once' || !date) return 0
    const start = new Date(`${date}T${time}:00`)
    const end   = recEndDate ? new Date(recEndDate) : new Date(start.getTime() + 90 * 24 * 60 * 60 * 1000) // 90 jours par défaut
    const intervalDays = recurrence === 'weekly' ? 7 : recurrence === 'biweekly' ? 14 : 30
    let count = 0
    let cur   = new Date(start)
    while (cur <= end) {
      cur = new Date(cur.getTime() + intervalDays * 24 * 60 * 60 * 1000)
      if (cur <= end) count++
    }
    return count
  }

  async function handleRecurringBook() {
    setSaving(true)
    setError(null)
    try {
      const count     = calcRecurrenceCount()
      const interval  = recurrence === 'weekly' ? 7 : recurrence === 'biweekly' ? 14 : 30
      const created   = []
      let   baseDate  = new Date(`${date}T${time}:00`)

      // Créer le premier contrat normalement
      await handleBook()

      // Sauvegarder la récurrence pour référence
      await supabase.from('recurrences').insert({
        client_id:    userId,
        worker_id:    worker.id,
        service_type: service || 'childcare',
        frequency:    recurrence,
        day_of_week:  baseDate.getDay(),
        start_time:   time,
        duration_min: duration * 60,
        end_date:     recEndDate || null,
        hourly_rate:  rate,
        currency:     currency ? currency.toUpperCase() : 'USD',
      }).catch(() => {})

    } catch (e) {
      setError(e.message || t('error_generic'))
      setSaving(false)
    }
  }

  // ── Étape 1  -  Date & heure ────────────────────────────────────
  if (step === 1) return (
    <div style={{ padding:'20px 16px', fontFamily:"'Poppins',system-ui,sans-serif" }}>
      <button onClick={() => navigate?.(-1)}
        style={backStyle}>{t('back')}</button>

      <h2 style={h2}>{svcIcon} {t('book_title_date')}</h2>
      <p style={sub}>{t('book_with')} {worker.first_name} · {sym}{rate}{t('per_hour')}</p>

      <label style={lbl}>{t('book_date')}</label>
      <input type="date" value={date} onChange={e=>{ setDate(e.target.value); setError(null) }}
        min={new Date().toISOString().split('T')[0]}
        style={{ ...inp, marginBottom:4,
          borderColor: date && blockedDates.includes(date) ? '#ef4444' : '#e5e7eb' }} />
      {date && blockedDates.includes(date) && (
        <div style={{ fontSize:11, color:'#ef4444', marginBottom:10 }}>
          🚫 {isFR ? 'Prestataire indisponible ce jour' : 'Provider unavailable on this date'}
        </div>
      )}

      <label style={lbl}>{t('book_time')}</label>
      <input type="time" value={time} onChange={e=>setTime(e.target.value)}
        style={{ ...inp, marginBottom:14 }} />

      <label style={lbl}>{t('book_duration')}</label>
      <div style={{ display:'flex',gap:8,marginBottom:20,flexWrap:'wrap' }}>
        {[0.5,1,1.5,2,2.5,3,4,5,6,8].map(h => (
          <button key={h} onClick={()=>setDuration(h)}
            style={{ padding:'10px 16px',borderRadius:12,
              border:`1.5px solid ${duration===h?G:'#E5E7EB'}`,
              background:duration===h?'rgba(22,163,74,.12)':'#FFFFFF',
              fontWeight:duration===h?700:500,fontSize:13,
              cursor:'pointer',fontFamily:"'DM Sans',sans-serif",
              color:duration===h?G:'#6B7280' }}>
            {h % 1 === 0 ? `${h}h` : `${Math.floor(h)}h30`}
          </button>
        ))}
      </div>

      {date && (
        <div style={{ background:'#f0fdf4',border:'1.5px solid #bbf7d0',
          borderRadius:12,padding:'12px 14px',marginBottom:20 }}>
          <div style={{ display:'flex',justifyContent:'space-between' }}>
            <span style={{ fontSize:13,color:'#374151' }}>{duration}{t('hour_unit')} × {sym}{rate}{t('per_hour')}</span>
            <span style={{ fontWeight:800,fontSize:16,color:'#15803d' }}>{fmt(total)}</span>
          </div>
          {taxCountry === 'FR' && (
            <div style={{ fontSize:11,color:'#6b7280',marginTop:4 }}>
              📄 50% récupérables via déclaration → ≈{fmt(total*0.5)} remboursés en avril
            </div>
          )}
        </div>
      )}

      {error && <ErrBox msg={error} />}
      <Btn label={t('book_continue')} disabled={!date} onClick={()=>{ if(validateStep1()) setStep(2) }} />
    </div>
  )

  // ── Étape 2  -  Notes ───────────────────────────────────────────
  if (step === 2) return (
    <div style={{ padding:'20px 16px', fontFamily:"'Poppins',system-ui,sans-serif" }}>
      <button onClick={()=>setStep(1)} style={backStyle}>{t('back')}</button>
      <h2 style={h2}>{t('book_notes_title')}</h2>
      <p style={sub}>{t('book_notes_sub')}</p>
      <label style={lbl}>{t('book_notes_lbl')}</label>
      <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={4}
        placeholder={t('book_notes_ph')}
        style={{ ...inp,resize:'none',marginBottom:20 }} />
      {/* Section récurrence */}
      <div style={{ marginBottom:20 }}>
        <label style={lbl}>{t('rec_title')}</label>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          {[
            { val:'once',      label:t('rec_once') },
            { val:'weekly',    label:t('rec_weekly') },
            { val:'biweekly',  label:t('rec_biweekly') },
            { val:'monthly',   label:t('rec_monthly') },
          ].map(opt => (
            <button key={opt.val}
              onClick={() => setRecurrence(opt.val)}
              style={{ padding:'8px 14px', borderRadius:99, cursor:'pointer',
                border:`2px solid ${recurrence===opt.val ? G : '#e5e7eb'}`,
                background:recurrence===opt.val ? '#F2F1FF' : 'white',
                color:recurrence===opt.val ? '#5546E8' : '#374151',
                fontWeight:recurrence===opt.val ? 700 : 500,
                fontSize:12, fontFamily:'inherit', transition:'all .15s' }}>
              {opt.label}
            </button>
          ))}
        </div>
        {recurrence !== 'once' && (
          <div style={{ marginTop:10 }}>
            <label style={{ ...lbl, marginBottom:6 }}>{t('rec_end_date')}</label>
            <input type="date" value={recEndDate} onChange={e=>setRecEndDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              style={{ ...inp, marginBottom:0 }} />
            <div style={{ fontSize:11, color:'#5546E8', marginTop:6 }}>
              ✅ {t('rec_info')}
              {calcRecurrenceCount() > 0 && (
                <span style={{ fontWeight:700 }}>
                  {' '} -  {calcRecurrenceCount()} {lang==='fr'?'créneaux':lang==='es'?'citas':'slots'}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      <Btn label={t('book_summary_btn')} disabled={false} onClick={()=>setStep(3)} />
    </div>
  )

  // ── Étape 3  -  Récapitulatif + paiement ───────────────────────
  if (step === 3) return (
    <div style={{ padding:'20px 16px', fontFamily:"'Poppins',system-ui,sans-serif" }}>
      <button onClick={()=>setStep(2)} style={backStyle}>{t('back')}</button>
      <h2 style={{ ...h2, marginBottom:20 }}>{t('book_summary')}</h2>

      <div style={{ background:'white',border:'1.5px solid #e5e7eb',
        borderRadius:16,padding:16,marginBottom:14 }}>
        {[
          { l:t('book_provider'), v:`${worker.first_name} ${worker.last_name||''}`.trim() },
          { l:'Service',         v:`${svcIcon} ${service||''}` },
          { l:t('book_date'),    v:new Date(`${date}T${time}`).toLocaleDateString(locale,
              { weekday:'long',day:'numeric',month:'long' }) },
          { l:t('book_hour'),    v:`${time} (${duration}${t('hour_unit')})` },
        ].map(row => (
          <div key={row.l} style={{ display:'flex',justifyContent:'space-between',
            padding:'9px 0',borderBottom:'1px solid #f3f4f6' }}>
            <span style={{ fontSize:12,color:'#6b7280' }}>{row.l}</span>
            <span style={{ fontSize:13,fontWeight:600,color:'#111827' }}>{row.v}</span>
          </div>
        ))}
        <div style={{ display:'flex',justifyContent:'space-between',padding:'9px 0' }}>
          <span style={{ fontSize:13,fontWeight:700,color:'#111827' }}>Total</span>
          <span style={{ fontSize:17,fontWeight:900,color:'#111827' }}>{fmt(total)}</span>
        </div>
      </div>

      <TaxCreditBlock amount={total} serviceType={service||'childcare'}
        countryCode={taxCountry} lang={lang} compact={true} />

      {notes.trim() && (
        <div style={{ background:'#fffbeb',border:'1.5px solid #fde68a',
          borderRadius:12,padding:'10px 14px',marginTop:12,fontSize:12,color:'#92400e' }}>
          📝 {notes}
        </div>
      )}

      {error && <ErrBox msg={error} />}

      {!marketLoading && !currency && (
        <div style={{ background:'#fef2f2', border:'1.5px solid #fecaca', borderRadius:10,
          padding:'10px 14px', color:'#dc2626', fontSize:12, marginTop:12 }}>
          ⚠️ {isFR ? 'Marché non disponible pour ce prestataire.' : 'Market not available for this provider.'}
        </div>
      )}
      <button onClick={handleBook} disabled={saving || marketLoading || !currency}
        style={{ width:'100%',padding:16,borderRadius:14,border:'none',marginTop:16,
          background:(saving||marketLoading||!currency)?'#e5e7eb':G,
          color:(saving||marketLoading||!currency)?'#9ca3af':'white',
          fontWeight:800,fontSize:16,
          cursor:(saving||marketLoading||!currency)?'not-allowed':'pointer',
          fontFamily:'inherit',boxShadow:(saving||marketLoading||!currency)?'none':`0 4px 14px ${G}40` }}>
        {marketLoading ? (isFR ? 'Chargement...' : 'Loading...')
          : saving ? t('book_processing')
          : `💳 ${t('book_pay')} ${fmt(total)} ${t('book_and_book')}`}
      </button>

      <div style={{ textAlign:'center',marginTop:10,fontSize:11,color:'#9ca3af' }}>
        🔒 {t('book_secure')}
      </div>
      <div style={{ textAlign:'center',marginTop:6,fontSize:11,color:'#9ca3af',lineHeight:1.5 }}>
        📋 {isFR
          ? 'Annulation > 24h : remboursement intégral · 4–24h : 75% · < 4h : 50%'
          : isES
          ? 'Cancelación >24h: reembolso total · 4–24h: 75% · <4h: 50%'
          : 'Cancel >24h: full refund · 4–24h: 75% back · <4h: 50% back'}
      </div>
    </div>
  )

  return null
}

function Btn({ label, disabled, onClick }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ width:'100%',padding:14,borderRadius:14,border:'none',
        background:disabled?'#e5e7eb':'#6C63FF',
        color:disabled?'#9ca3af':'white',
        fontWeight:800,fontSize:15,cursor:disabled?'not-allowed':'pointer',
        fontFamily:"'Poppins',sans-serif" }}>
      {label}
    </button>
  )
}
function ErrBox({ msg }) {
  return (
    <div style={{ background:'#fef2f2',border:'1.5px solid #fecaca',borderRadius:10,
      padding:'10px 14px',color:'#dc2626',fontSize:12,marginBottom:14,marginTop:8 }}>
      ⚠️ {msg}
    </div>
  )
}

const inp = { width:'100%',padding:'12px 14px',background:'white',
  border:'1.5px solid #e5e7eb',borderRadius:12,fontSize:14,
  fontFamily:"'Poppins',sans-serif",outline:'none',boxSizing:'border-box' }
const h2  = { fontWeight:800,fontSize:20,color:'#111827',margin:'0 0 6px' }
const sub = { fontSize:13,color:'#6b7280',margin:'0 0 20px',lineHeight:1.6 }
const lbl = { display:'block',fontSize:11,fontWeight:700,color:'#6b7280',
  textTransform:'uppercase',letterSpacing:'.07em',marginBottom:8 }
const backStyle = { background:'none',border:'none',cursor:'pointer',
  color:'#9ca3af',fontSize:13,marginBottom:20,fontFamily:'inherit' }
