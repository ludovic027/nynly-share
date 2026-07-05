// InvoiceHistory.jsx
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useT } from '../lib/i18n'
import { calcCredit } from './TaxCreditDisplay'
import { serviceLabel } from '../lib/theme'

// ── Onglet revenus Stripe (worker uniquement) ────────────────────────────────
function StripeEarningsTab({ lang, userId, marketCountry = 'US' }) {
  const isFR = lang === 'fr'
  const isES = lang === 'es'
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [missions, setMissions] = useState([])
  const [showAll,  setShowAll]  = useState(false)

  useEffect(() => {
    supabase.functions.invoke('worker-balance', { body: {} })
      .then(({ data: d, error: e }) => {
        if (e) throw new Error(e.message)
        setData(d)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  // Détail des missions (lecture seule, devise = marché). worker_amount rempli à la capture
  // (legacy NULL tant que le backfill 5W n'est pas exécuté).
  useEffect(() => {
    if (!userId) return
    supabase.from('contracts')
      .select('id, service_type, total_amount, worker_amount, tip_amount, completed_at, client:profiles!contracts_client_id_fkey(first_name)')
      .eq('worker_id', userId).eq('status', 'completed')
      .order('completed_at', { ascending: false }).limit(50)
      .then(({ data: rows }) => setMissions(rows || []))
  }, [userId])

  const fmt = (n, sym = '$') => `${sym}${parseFloat(n || 0).toFixed(2)}`

  const PAYOUT_STATUS = {
    paid:       { label: isFR ? 'Versé'        : 'Paid',       color:'#16A34A', bg:'#f0fdf4' },
    in_transit: { label: isFR ? 'En route'     : 'In transit', color:'#d97706', bg:'#fffbeb' },
    pending:    { label: isFR ? 'En attente'   : 'Pending',    color:'#6b7280', bg:'#f9fafb' },
    canceled:   { label: isFR ? 'Annulé'       : 'Canceled',   color:'#ef4444', bg:'#fef2f2' },
    failed:     { label: isFR ? 'Échoué'       : 'Failed',     color:'#ef4444', bg:'#fef2f2' },
  }

  if (loading) return (
    <div style={{ textAlign:'center', padding:'48px 0', color:'#9ca3af' }}>
      <div style={{ fontSize:32, marginBottom:8 }}>💰</div>
      <div style={{ fontSize:13 }}>{isFR ? 'Chargement...' : 'Loading...'}</div>
    </div>
  )

  if (error) return (
    <div style={{ background:'#fef2f2', border:'1.5px solid #fecaca', borderRadius:12,
      padding:16, color:'#dc2626', fontSize:13 }}>⚠️ {error}</div>
  )

  if (!data?.stripe_ready) return (
    <div style={{ textAlign:'center', padding:'48px 16px', background:'#f9fafb',
      borderRadius:14, border:'1.5px dashed #e5e7eb' }}>
      <div style={{ fontSize:40, marginBottom:10 }}>💳</div>
      <div style={{ fontWeight:700, fontSize:14, color:'#374151', marginBottom:4 }}>
        {isFR ? 'Compte Stripe non configuré' : isES ? 'Cuenta Stripe no configurada' : 'Stripe account not set up'}
      </div>
      <div style={{ fontSize:12, color:'#9ca3af' }}>
        {isFR ? 'Finalisez votre inscription Stripe pour voir vos revenus.'
         : 'Complete your Stripe registration to see your earnings.'}
      </div>
    </div>
  )

  const { balance, payouts, db_stats } = data
  const month = db_stats?.this_month
  const year  = db_stats?.this_year
  const earnSym = marketCountry === 'FR' ? '€' : '$'

  return (
    <div>
      {/* Solde Stripe */}
      {balance && (
        <div style={{ background:'linear-gradient(135deg,#0f172a,#1e293b)',
          borderRadius:16, padding:'18px', marginBottom:14 }}>
          <div style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,.5)',
            textTransform:'uppercase', letterSpacing:'.08em', marginBottom:12 }}>
            💳 {isFR ? 'Solde Stripe' : 'Stripe Balance'}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <div style={{ fontWeight:900, fontSize:28, color:'#4ade80' }}>
                {fmt(balance.available)}
              </div>
              <div style={{ fontSize:11, color:'rgba(255,255,255,.5)', marginTop:3 }}>
                {isFR ? 'Disponible maintenant' : 'Available now'}
              </div>
            </div>
            <div>
              <div style={{ fontWeight:900, fontSize:28, color:'#fbbf24' }}>
                {fmt(balance.pending)}
              </div>
              <div style={{ fontSize:11, color:'rgba(255,255,255,.5)', marginTop:3 }}>
                {isFR ? 'En cours de traitement' : 'Processing'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats DB : missions */}
      {db_stats && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14 }}>
          {[
            { label: isFR ? 'Ce mois' : 'This month', count: month?.count, net: month?.net, saved: month?.creditSaved, color:'#3b82f6', bg:'#eff6ff' },
            { label: isFR ? 'Cette année' : 'This year', count: year?.count,  net: year?.net,  saved: year?.creditSaved,  color:'#6C63FF', bg:'#F2F1FF' },
          ].map(s => (
            <div key={s.label} style={{ background: s.bg, border:`1.5px solid ${s.color}20`,
              borderRadius:14, padding:'14px 12px' }}>
              <div style={{ fontSize:10, fontWeight:700, color: s.color,
                textTransform:'uppercase', letterSpacing:'.06em', marginBottom:8 }}>
                {s.label}
              </div>
              <div style={{ fontWeight:900, fontSize:20, color:'#111827', marginBottom:4 }}>
                {fmt(s.net)}
              </div>
              <div style={{ fontSize:11, color:'#6b7280' }}>
                {s.count} {isFR ? 'mission' : 'job'}{s.count !== 1 ? 's' : ''}
              </div>
              {s.saved > 0 && (
                <div style={{ fontSize:10, color:'#16A34A', marginTop:4, fontWeight:600 }}>
                  🎁 {fmt(s.saved)} {isFR ? 'de frais économisés' : 'fees saved'}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Détail des missions (worker_amount + pourboires) */}
      {missions.length > 0 && (
        <div style={{ marginBottom:14 }}>
          <div style={{ fontWeight:700, fontSize:13, color:'#374151', marginBottom:8 }}>
            {isFR ? 'Détail des missions' : isES ? 'Detalle de trabajos' : 'Mission details'}
          </div>
          {missions.slice(0, showAll ? 50 : 8).map(m => {
            const d = m.completed_at
              ? new Date(m.completed_at).toLocaleDateString(
                  isFR ? 'fr-FR' : isES ? 'es-US' : 'en-US', { day:'numeric', month:'short' })
              : ''
            const hasTip = parseFloat(m.tip_amount || 0) > 0
            return (
              <div key={m.id}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
                  fontSize:13, padding:'8px 0', borderBottom:'1px solid #f3f4f6' }}>
                  <span style={{ color:'#6b7280' }}>{d} · {serviceLabel(m.service_type, lang)}</span>
                  <span style={{ fontWeight:700, color:'#111827' }}>{fmt(m.worker_amount, earnSym)}</span>
                </div>
                {hasTip && (
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
                    fontSize:13, padding:'8px 0', borderBottom:'1px solid #f3f4f6' }}>
                    <span style={{ color:'#7c3aed' }}>
                      🎁 {isFR ? 'Pourboire' : isES ? 'Propina' : 'Tip'}
                      {m.client?.first_name ? ` · ${m.client.first_name}` : ''}
                    </span>
                    <span style={{ fontWeight:700, color:'#7c3aed' }}>{fmt(m.tip_amount, earnSym)}</span>
                  </div>
                )}
              </div>
            )
          })}
          {missions.length > 8 && !showAll && (
            <button onClick={() => setShowAll(true)}
              style={{ width:'100%', padding:'10px', marginTop:8, borderRadius:10,
                background:'#f9fafb', border:'1.5px solid #e5e7eb', color:'#6b7280',
                fontWeight:600, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>
              {isFR ? 'Voir plus' : isES ? 'Ver más' : 'Show more'}
            </button>
          )}
        </div>
      )}

      {/* Historique des virements */}
      <div style={{ marginBottom:8 }}>
        <div style={{ fontWeight:700, fontSize:13, color:'#374151', marginBottom:10 }}>
          {isFR ? 'Virements bancaires' : isES ? 'Transferencias bancarias' : 'Bank payouts'}
        </div>

        {payouts.length === 0 ? (
          <div style={{ textAlign:'center', padding:'32px 16px', background:'#f9fafb',
            borderRadius:14, border:'1.5px dashed #e5e7eb' }}>
            <div style={{ fontSize:32, marginBottom:8 }}>🏦</div>
            <div style={{ fontSize:13, color:'#6b7280' }}>
              {isFR ? 'Aucun virement encore — Stripe envoie l\'argent automatiquement.'
               : 'No payouts yet — Stripe sends money automatically.'}
            </div>
          </div>
        ) : payouts.map(p => {
          const st  = PAYOUT_STATUS[p.status] ?? PAYOUT_STATUS.pending
          const d   = new Date(p.arrival_date * 1000).toLocaleDateString(
            isFR ? 'fr-FR' : 'en-US', { day:'numeric', month:'short', year:'numeric' })
          return (
            <div key={p.id} style={{ background:'white', borderRadius:14,
              border:'1.5px solid #e5e7eb', padding:'12px 14px', marginBottom:8,
              display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:38, height:38, borderRadius:10, background: st.bg,
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:18, flexShrink:0 }}>
                {p.status === 'paid' ? '✅' : p.status === 'in_transit' ? '🚀' : p.status === 'failed' ? '❌' : '⏳'}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700, fontSize:13, color:'#111827', marginBottom:2 }}>
                  {fmt(p.amount, p.currency === 'eur' ? '€' : '$')}
                </div>
                <div style={{ fontSize:11, color:'#9ca3af' }}>
                  {isFR ? 'Arrivée le' : 'Arrives'} {d}
                </div>
              </div>
              <span style={{ background: st.bg, color: st.color, borderRadius:99,
                padding:'3px 10px', fontSize:11, fontWeight:700 }}>
                {st.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const G  = '#6C63FF'
const DG = '#5546E8'

const fmt = (amount, symbol = '$') =>
  `${symbol}${parseFloat(amount || 0).toFixed(2)}`

function useInvoices(userId, userRole, lang = 'fr', marketCountry = 'US') {
  const [invoices,  setInvoices]  = useState([])
  const [summaries, setSummaries] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(null)

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true); setError(null)
    try {
      const field = userRole === 'worker' ? 'worker_id' : 'client_id'
      const currentYear = new Date().getFullYear()
      const [{ data: inv, error: e1 }, { data: rpcSum }, { data: contractRows }] = await Promise.all([
        supabase.from('invoices').select('*').eq(field, userId)
          .order('created_at', { ascending: false }).limit(100),
        // RPC à la place de la table annual_summaries (5Q_annual_summary_rpc.sql)
        supabase.rpc('get_annual_summary', {
          p_user_id: userId,
          p_role:    userRole,
          p_year:    currentYear,
        }),
        // Crédit d'impôt famille : calcCredit est PAR service → on lit les contracts
        // (service_type) car la RPC n'agrège que les montants. Même source que total_gross.
        supabase.from('contracts')
          .select('service_type, total_amount, completed_at')
          .eq(field, userId).eq('status', 'completed'),
      ])
      if (e1) throw e1
      setInvoices(inv || [])
      // Mapper le résultat RPC en format compatible avec l'affichage summaries
      if (rpcSum && (rpcSum.missions_count > 0)) {
        // Devise + crédit d'impôt pilotés par le MARCHÉ (markets.country), jamais la langue
        // (guardrail #9). Un worker Tampa en FR ne doit pas voir € ni un crédit d'impôt.
        const isFRMarket = marketCountry === 'FR'
        const sym       = isFRMarket ? '€' : '$'
        const grossAmt  = (rpcSum.total_gross_cents || 0) / 100
        const netAmt    = (rpcSum.total_net_cents   || 0) / 100
        // Crédit d'impôt = avantage FAMILLE uniquement, calculé PAR MISSION via calcCredit
        // (US childcare/nanny 35%, FR SAP 50%, sinon 0) sur les contracts de l'année — même
        // source que total_gross. Jamais un % en dur ni piloté par la langue (guardrail #9).
        // Worker → toujours 0.
        const ciAmt = userRole === 'worker' ? 0 : (contractRows || [])
          .filter(c => c.completed_at && new Date(c.completed_at).getFullYear() === currentYear)
          .reduce((s, c) => s + (calcCredit(parseFloat(c.total_amount || 0), c.service_type, marketCountry)?.creditAmount || 0), 0)
        setSummaries([{
          id:               `rpc_${currentYear}`,
          year:             currentYear,
          total_missions:   rpcSum.missions_count,
          total_gross:      grossAmt,
          total_net:        netAmt,
          total_tax_credit: ciAmt,
          currency_symbol:  sym,
          html_content:     null,  // généré en fin d'année par invoice-generator
        }])
      } else {
        setSummaries([])
      }
    } catch (e) { setError(e.message) }
    setLoading(false)
  }, [userId, userRole, lang, marketCountry])

  useEffect(() => { load() }, [load])
  return { invoices, summaries, loading, error, reload: load }
}

function openDocument(html, title) {
  if (!html) return
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const win  = window.open(url, '_blank')
  if (win) win.document.title = title
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}

// BUG FIX: ajout prop navigate + onBack pour bouton retour
export default function InvoiceHistory({ userId, userRole = 'client', marketCountry = 'US', lang = 'fr', navigate, onBack }) {
  const { invoices, summaries, loading, error } = useInvoices(userId, userRole, lang, marketCountry)
  const [activeTab,  setActiveTab]  = useState('invoices')
  const [filterYear, setFilterYear] = useState('all')
  const [opening,    setOpening]    = useState(null)

  const isFR     = lang === 'fr'
  const isES     = lang === 'es'
  const { t }    = useT(lang)
  const isWorker = userRole === 'worker'

  const years = [...new Set(invoices.map(i =>
    new Date(i.created_at || i.invoice_date || Date.now()).getFullYear()
  ))].sort((a, b) => b - a)

  const filtered = filterYear === 'all'
    ? invoices
    : invoices.filter(i => {
        const d = new Date(i.created_at || i.invoice_date || Date.now())
        return d.getFullYear() === parseInt(filterYear)
      })

  const totals = filtered.reduce((acc, inv) => ({
    missions:  acc.missions + 1,
    gross:     acc.gross    + parseFloat(inv.amount_gross || 0),
    net:       acc.net      + parseFloat(isWorker ? inv.amount_worker : inv.amount_gross || 0),
    // Crédit famille via calcCredit (service éligible + marché). inv.tax_credit_amount=0 aux US
    // car invoice-generator ne calcule que le SAP FR → on recalcule pour afficher le crédit US 35%.
    taxCredit: acc.taxCredit + (calcCredit(parseFloat(inv.amount_gross || 0), inv.service_type, marketCountry)?.creditAmount || 0),
  }), { missions: 0, gross: 0, net: 0, taxCredit: 0 })

  function handleOpen(inv) {
    setOpening(inv.id)
    const html  = isWorker ? inv.html_worker : inv.html_client
    const title = `Nynly - ${inv.invoice_number || inv.id}`
    openDocument(html, title)
    setTimeout(() => setOpening(null), 1000)
  }

  function handleOpenSummary(sum) {
    if (!sum.html_content) return  // récapitulatif RPC — PDF généré en fin d'année
    setOpening(sum.id)
    openDocument(sum.html_content, `Nynly - Recap fiscal ${sum.year}`)
    setTimeout(() => setOpening(null), 1000)
  }

  if (loading) return (
    <div style={{ textAlign:'center', padding:'48px 0', color:'#9ca3af', fontFamily:"'Poppins',sans-serif" }}>
      <div style={{ fontSize:32, marginBottom:8 }}>📄</div>
      <div style={{ fontSize:13 }}>{isFR ? 'Chargement...' : 'Loading...'}</div>
    </div>
  )

  if (error) return (
    <div style={{ padding:16, fontFamily:"'Poppins',sans-serif" }}>
      {/* BUG FIX: bouton retour même sur erreur */}
      <button onClick={() => onBack?.() || navigate?.(-1)}
        style={{ background:'none', border:'none', cursor:'pointer',
          color:'#9ca3af', fontSize:13, fontFamily:'inherit', marginBottom:16 }}>
        {isFR ? '← Retour' : '← Back'}
      </button>
      <div style={{ background:'#fef2f2', border:'1.5px solid #fecaca', borderRadius:12,
        padding:16, color:'#dc2626', fontSize:13 }}>
        ⚠️ {error}
        <div style={{ fontSize:11, color:'#9ca3af', marginTop:8 }}>
          {isFR ? 'Les factures seront disponibles apres vos premieres missions.' : 'Invoices will be available after your first missions.'}
        </div>
      </div>
    </div>
  )

  // Devise = marché de la mission (markets.country), pas la langue (guardrail #9)
  const sym = invoices[0]?.currency_symbol || (marketCountry === 'FR' ? '€' : '$')

  return (
    <div style={{ padding:'16px', fontFamily:"'Poppins',system-ui,sans-serif" }}>

      {/* BUG FIX: bouton retour en haut */}
      <button onClick={() => onBack?.() || navigate?.(-1)}
        style={{ background:'none', border:'none', cursor:'pointer',
          color:'#9ca3af', fontSize:13, fontFamily:'inherit', marginBottom:16,
          display:'flex', alignItems:'center', gap:4 }}>
        {isFR ? '← Retour' : '← Back'}
      </button>

      <div style={{ marginBottom:20 }}>
        <h2 style={{ fontWeight:800, fontSize:20, color:'#111827', margin:'0 0 6px' }}>
          📄 {isFR ? 'Mes documents fiscaux' : isES ? 'Mis documentos' : 'My Tax Documents'}
        </h2>
        <p style={{ fontSize:13, color:'#6b7280', margin:0, lineHeight:1.5 }}>
          {isFR ? 'Recus de missions et recapitulatifs annuels. Ouvrez et imprimez pour vos impots.'
           : 'Mission receipts and annual summaries. Open and print for your taxes.'}
        </p>
      </div>

      {/* Onglets */}
      <div style={{ display:'flex', gap:6, marginBottom:20, background:'#f3f4f6', borderRadius:12, padding:4 }}>
        {[
          { id:'invoices',  icon:'🧾', label: isFR ? 'Recus' : 'Receipts',     count: invoices.length  },
          { id:'summaries', icon:'📊', label: isFR ? 'Recap annuels' : 'Annual', count: summaries.length },
          ...(isWorker ? [{ id:'stripe', icon:'💰', label: isFR ? 'Revenus' : 'Earnings', count: 0 }] : []),
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            style={{ flex:1, padding:'9px 8px', borderRadius:9, border:'none',
              background: activeTab === tab.id ? 'white' : 'transparent',
              fontWeight: activeTab === tab.id ? 700 : 500,
              color:      activeTab === tab.id ? '#111827' : '#6b7280',
              cursor:'pointer', fontFamily:'inherit', fontSize:12,
              boxShadow: activeTab === tab.id ? '0 1px 4px rgba(0,0,0,.1)' : 'none',
              display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            {tab.count > 0 && (
              <span style={{ background: activeTab === tab.id ? G : '#e5e7eb',
                color: activeTab === tab.id ? 'white' : '#6b7280',
                borderRadius:99, padding:'1px 6px', fontSize:10, fontWeight:700 }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {activeTab === 'invoices' && (
        <>
          {invoices.length > 0 && (
            <>
              <div style={{ display:'flex', gap:8, marginBottom:16, alignItems:'center', flexWrap:'wrap' }}>
                <select value={filterYear} onChange={e => setFilterYear(e.target.value)}
                  style={{ background:'white', border:'1.5px solid #e5e7eb', borderRadius:10,
                    padding:'8px 12px', fontSize:12, fontWeight:600, fontFamily:'inherit',
                    color:'#374151', cursor:'pointer' }}>
                  <option value="all">{isFR ? 'Toutes les annees' : 'All years'}</option>
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <div style={{ fontSize:12, color:'#9ca3af', marginLeft:'auto' }}>
                  {filtered.length} {isFR ? 'recu' : 'receipt'}{filtered.length > 1 ? 's' : ''}
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:16 }}>
                {[
                  { val: totals.missions.toString(), label: isFR ? 'Missions' : 'Missions', color:'#6366f1' },
                  { val: fmt(totals.gross, sym),     label: isFR ? 'Volume total' : 'Total', color: isWorker ? '#f59e0b' : '#3b82f6' },
                  isWorker
                    ? { val: fmt(totals.net, sym),      label: isFR ? 'Revenus nets' : 'Net', color: G }
                    : { val: fmt(totals.taxCredit, sym), label: isFR ? 'Credit impot' : 'Tax credit', color:'#1d4ed8' },
                ].map(stat => (
                  <div key={stat.label} style={{ background:'#f9fafb', border:'1.5px solid #e5e7eb',
                    borderRadius:12, padding:'12px', textAlign:'center' }}>
                    <div style={{ fontWeight:800, fontSize:16, color:stat.color }}>{stat.val}</div>
                    <div style={{ fontSize:10, color:'#9ca3af', marginTop:3 }}>{stat.label}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {filtered.length === 0 ? (
            <div style={{ textAlign:'center', padding:'48px 16px', background:'#f9fafb',
              borderRadius:14, border:'1.5px dashed #e5e7eb' }}>
              <div style={{ fontSize:40, marginBottom:10 }}>🧾</div>
              <div style={{ fontWeight:700, fontSize:14, color:'#374151', marginBottom:4 }}>
                {isFR ? 'Aucun recu pour le moment' : 'No receipts yet'}
              </div>
              <div style={{ fontSize:12, color:'#9ca3af' }}>
                {isFR ? 'Un recu est genere automatiquement apres chaque mission.'
                 : 'A receipt is generated automatically after each mission.'}
              </div>
            </div>
          ) : (
            filtered.map(inv => {
              const date   = new Date(inv.created_at || inv.invoice_date).toLocaleDateString(
                isFR ? 'fr-FR' : 'en-US', { year:'numeric', month:'short', day:'numeric' })
              const amount = isWorker ? inv.amount_worker : inv.amount_gross
              const isOpen = opening === inv.id
              return (
                <div key={inv.id} style={{ background:'white', borderRadius:16,
                  border:'1.5px solid #e5e7eb', marginBottom:8, overflow:'hidden' }}>
                  <div style={{ padding:'14px 16px', display:'flex', alignItems:'center', gap:12 }}>
                    <div style={{ width:42, height:42, background:'#F2F1FF',
                      border:'1.5px solid #D6D2FF', borderRadius:10,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize:18, flexShrink:0 }}>🧾</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
                        <span style={{ fontWeight:700, fontSize:13, color:'#111827' }}>
                          {inv.service_label || inv.service_type}
                        </span>
                        {inv.is_sap_eligible && (
                          <span style={{ background:'#eff6ff', color:'#1d4ed8',
                            border:'1px solid #bfdbfe', borderRadius:99,
                            padding:'1px 7px', fontSize:9, fontWeight:700 }}>🇫🇷 SAP</span>
                        )}
                      </div>
                      <div style={{ fontSize:11, color:'#9ca3af' }}>
                        {date} · {inv.invoice_number || ''}{inv.city ? ` · ${inv.city}` : ''}
                      </div>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6 }}>
                      <div style={{ fontWeight:800, fontSize:16, color:G }}>
                        {fmt(amount, inv.currency_symbol || sym)}
                      </div>
                      <button onClick={() => handleOpen(inv)} disabled={isOpen}
                        style={{ background: isOpen ? '#e5e7eb' : '#f0fdf4',
                          border:`1.5px solid ${isOpen ? '#e5e7eb' : '#bbf7d0'}`,
                          color: isOpen ? '#9ca3af' : DG, borderRadius:8,
                          padding:'5px 10px', fontSize:11, fontWeight:700,
                          cursor: isOpen ? 'wait' : 'pointer', fontFamily:'inherit' }}>
                        {isOpen ? '⏳' : '📥'} {isFR ? 'Ouvrir' : 'Open'}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </>
      )}

      {activeTab === 'summaries' && (
        <>
          {summaries.length === 0 ? (
            <div style={{ textAlign:'center', padding:'48px 16px', background:'#f9fafb',
              borderRadius:14, border:'1.5px dashed #e5e7eb' }}>
              <div style={{ fontSize:40, marginBottom:10 }}>📊</div>
              <div style={{ fontWeight:700, fontSize:14, color:'#374151', marginBottom:4 }}>
                {isFR ? 'Aucun recapitulatif encore' : 'No annual summary yet'}
              </div>
              <div style={{ fontSize:12, color:'#9ca3af', lineHeight:1.5 }}>
                {isFR ? 'Votre premier recapitulatif sera genere le 1er janvier prochain.'
                 : 'Your first annual summary will be generated on January 1st next year.'}
              </div>
            </div>
          ) : (
            summaries.map(sum => {
              const symS = sum.currency_symbol || sym
              const isOpen = opening === sum.id
              return (
                <div key={sum.id} style={{ background:'white', borderRadius:16,
                  border:'1.5px solid #e5e7eb', marginBottom:10, overflow:'hidden' }}>
                  <div style={{ background:'linear-gradient(135deg,#0f172a,#1e293b)',
                    padding:'14px 16px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <div>
                      <div style={{ fontWeight:800, fontSize:16, color:'white' }}>
                        {isFR ? 'Exercice' : 'Year'} {sum.year}
                      </div>
                      <div style={{ fontSize:11, color:'rgba(255,255,255,.6)', marginTop:2 }}>
                        {sum.total_missions} {isFR ? 'missions' : 'missions'}
                      </div>
                    </div>
                    {sum.html_content ? (
                      <button onClick={() => handleOpenSummary(sum)} disabled={isOpen}
                        style={{ background: isOpen ? 'rgba(255,255,255,.1)' : G,
                          border:'none', borderRadius:10, padding:'9px 14px',
                          color:'white', fontWeight:700, fontSize:12,
                          cursor: isOpen ? 'wait' : 'pointer', fontFamily:'inherit' }}>
                        {isOpen ? '⏳' : '📥'} {isFR ? 'Telecharger' : 'Download'}
                      </button>
                    ) : (
                      <span style={{ fontSize:10, color:'rgba(255,255,255,.5)', textAlign:'right' }}>
                        {isFR ? 'PDF dispo en jan.' : 'PDF in Jan.'}
                      </span>
                    )}
                  </div>
                  <div style={{ padding:'14px 16px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                    <div style={{ background:'#f9fafb', borderRadius:10, padding:'10px', textAlign:'center' }}>
                      <div style={{ fontWeight:800, fontSize:18, color: isWorker ? G : '#3b82f6' }}>
                        {fmt(isWorker ? sum.total_net : sum.total_gross, symS)}
                      </div>
                      <div style={{ fontSize:10, color:'#9ca3af', marginTop:2 }}>
                        {isWorker ? (isFR ? 'Revenus nets' : 'Net earnings') : (isFR ? 'Depenses' : 'Expenses')}
                      </div>
                    </div>
                    {!isWorker && parseFloat(sum.total_tax_credit || 0) > 0 && (
                      <div style={{ background:'#eff6ff', border:'1.5px solid #bfdbfe',
                        borderRadius:10, padding:'10px', textAlign:'center' }}>
                        <div style={{ fontWeight:800, fontSize:18, color:'#1d4ed8' }}>
                          {fmt(sum.total_tax_credit, symS)}
                        </div>
                        <div style={{ fontSize:10, color:'#1e40af', marginTop:2 }}>
                          {isFR ? 'Credit impot' : 'Tax credit'}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </>
      )}

      {activeTab === 'stripe' && isWorker && (
        <StripeEarningsTab lang={lang} userId={userId} marketCountry={marketCountry} />
      )}

      {activeTab !== 'stripe' && (
        <div style={{ background:'#f9fafb', border:'1.5px solid #e5e7eb', borderRadius:12,
          padding:'12px 16px', marginTop:16 }}>
          <div style={{ fontSize:12, color:'#6b7280', lineHeight:1.6 }}>
            {isFR
              ? '💡 Cliquez "Ouvrir", puis Ctrl+P pour imprimer ou sauvegarder en PDF.'
              : '💡 Click "Open", then Ctrl+P to print or save as PDF.'}
          </div>
        </div>
      )}
    </div>
  )
}
