// MissionTracker.jsx
// BUG FIXES:
// 1. sym déclaré dans le scope principal
// 2. t passé en prop à ConfirmModal
// 3. 'En cours' / 'Historique' traduits
// 4. ConfirmModal reçoit t en prop
// 5. Annuler cette mission traduit

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useT, toLocale } from '../lib/i18n'
import CalendarView from './CalendarView'
import { calcCredit } from './TaxCreditDisplay'
import { useRealtimeContracts } from '../hooks/useRealtimeContracts'
import BackgroundCheckGate from './BackgroundCheckGate'

const G  = '#6C63FF'
const SUCCESS_GREEN = '#16A34A'
const RD = '#ef4444'
const AM = '#f59e0b'

const STATUS_META_FR = {
  pending:        { label:'En attente',           color:AM,        bg:'#fffbeb', border:'#fde68a', icon:'⏳' },
  pending_worker: { label:'Attente confirmation', color:'#f97316', bg:'#fff7ed', border:'#fed7aa', icon:'🕐' },
  confirmed:      { label:'Confirmee',            color:'#3b82f6', bg:'#eff6ff', border:'#bfdbfe', icon:'✅' },
  in_progress:    { label:'En cours',             color:'#7c3aed', bg:'#f5f3ff', border:'#ddd6fe', icon:'🟣' },
  completed:      { label:'Terminee',             color:SUCCESS_GREEN, bg:'#f0fdf4', border:'#bbf7d0', icon:'🎉' },
  cancelled:      { label:'Annulee',              color:'#6b7280', bg:'#f9fafb', border:'#e5e7eb', icon:'❌' },
  declined:       { label:'Refusee',              color:RD,        bg:'#fef2f2', border:'#fecaca', icon:'🚫' },
  disputed:       { label:'En litige',            color:RD,        bg:'#fef2f2', border:'#fecaca', icon:'⚖️' },
}
const STATUS_META_EN = {
  pending:        { label:'Pending',              color:AM,        bg:'#fffbeb', border:'#fde68a', icon:'⏳' },
  pending_worker: { label:'Awaiting confirmation', color:'#f97316', bg:'#fff7ed', border:'#fed7aa', icon:'🕐' },
  confirmed:      { label:'Confirmed',            color:'#3b82f6', bg:'#eff6ff', border:'#bfdbfe', icon:'✅' },
  in_progress:    { label:'In progress',          color:'#7c3aed', bg:'#f5f3ff', border:'#ddd6fe', icon:'🟣' },
  completed:      { label:'Completed',            color:SUCCESS_GREEN, bg:'#f0fdf4', border:'#bbf7d0', icon:'🎉' },
  cancelled:      { label:'Cancelled',            color:'#6b7280', bg:'#f9fafb', border:'#e5e7eb', icon:'❌' },
  declined:       { label:'Declined',             color:RD,        bg:'#fef2f2', border:'#fecaca', icon:'🚫' },
  disputed:       { label:'Disputed',             color:RD,        bg:'#fef2f2', border:'#fecaca', icon:'⚖️' },
}
const STATUS_META_ES = {
  pending:        { label:'Pendiente',            color:AM,        bg:'#fffbeb', border:'#fde68a', icon:'⏳' },
  pending_worker: { label:'Esperando confirmación', color:'#f97316', bg:'#fff7ed', border:'#fed7aa', icon:'🕐' },
  confirmed:      { label:'Confirmada',           color:'#3b82f6', bg:'#eff6ff', border:'#bfdbfe', icon:'✅' },
  in_progress:    { label:'En progreso',          color:'#7c3aed', bg:'#f5f3ff', border:'#ddd6fe', icon:'🟣' },
  completed:      { label:'Completada',           color:SUCCESS_GREEN, bg:'#f0fdf4', border:'#bbf7d0', icon:'🎉' },
  cancelled:      { label:'Cancelada',            color:'#6b7280', bg:'#f9fafb', border:'#e5e7eb', icon:'❌' },
  declined:       { label:'Rechazada',            color:RD,        bg:'#fef2f2', border:'#fecaca', icon:'🚫' },
  disputed:       { label:'En disputa',           color:RD,        bg:'#fef2f2', border:'#fecaca', icon:'⚖️' },
}

const SERVICE_ICONS = {
  childcare:'👶', nanny:'🏠', petsitter:'🐾', seniorcare:'🧓',
  cleaning:'🧹', handyman:'🔧', lawn:'🌿', errands:'🛒',
}

function formatDate(dateStr, lang = 'fr') {
  if (!dateStr) return ''
  const locale = lang === 'fr' ? 'fr-FR' : lang === 'es' ? 'es-US' : 'en-US'
  // Parse date-only strings at noon to avoid TZ shift ("2024-06-16" → midnight UTC = 02h FR)
  const d = dateStr.length === 10 ? new Date(dateStr + 'T12:00:00') : new Date(dateStr)
  return d.toLocaleDateString(locale, { weekday:'short', day:'numeric', month:'short' })
}

function formatPrice(amount, currency = 'USD') {
  const sym = currency === 'EUR' ? '€' : '$'
  return `${sym}${parseFloat(amount || 0).toFixed(2)}`
}

// Total mission incluant la prolongation acceptée (0 si pas de prolongation)
function totalWithOvertime(c) {
  return parseFloat(c?.total_amount || 0) + parseFloat(c?.overtime_amount || 0)
}

// Expiry = min(payment + 24h, mission_start - 1h)
function calcExpiry(contract) {
  const paymentMs = new Date(contract.created_at).getTime()
  const expiry24h = paymentMs + 24 * 3_600_000
  if (contract.mission_date && contract.start_time) {
    const missionStart = new Date(`${contract.mission_date}T${contract.start_time}:00`).getTime()
    return Math.min(expiry24h, missionStart - 3_600_000)
  }
  return expiry24h
}

function useMissions(userId, role) {
  const [missions, setMissions] = useState([])
  const [loading,  setLoading]  = useState(true)

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    const field = role === 'worker' ? 'worker_id' : 'client_id'
    let query = supabase
      .from('contracts')
      .select(`
        *,
        worker:profiles!contracts_worker_id_fkey(id,first_name,last_name,avatar_url,hourly_rate),
        client:profiles!contracts_client_id_fkey(id,first_name,last_name,avatar_url,client_rating,client_review_count)
      `)
      .eq(field, userId)
      .neq('status', 'intent')
    // Workers must never see contracts where payment was abandoned (no payment_intent_id).
    // Structural fix (create contract only on webhook) is tracked as TODO Commit 2e.
    if (role === 'worker') query = query.not('payment_intent_id', 'is', null)
    const { data } = await query
      .order('created_at', { ascending: false })
      .limit(50)
    setMissions(data || [])
    setLoading(false)
  }, [userId, role])

  useEffect(() => { load() }, [load])
  return { missions, loading, reload: load }
}

export default function MissionTracker({ userId, role, missionId, navigate, lang = 'fr', marketCountry = 'US', profile = null }) {
  const { missions, loading, reload } = useMissions(userId, role)
  const [selected,     setSelected]     = useState(null)
  const [confirming,   setConfirming]   = useState(false)
  const [showOvertime, setShowOvertime] = useState(false)
  const [otHours,      setOtHours]      = useState(0.5)
  const [otLoading,    setOtLoading]    = useState(false)
  const [otRequest,    setOtRequest]    = useState(null)
  const [notif,        setNotif]        = useState(null)
  const [confirm,      setConfirm]      = useState(null)
  const [showBgCheck,  setShowBgCheck]  = useState(false)
  const [viewMode,     setViewMode]     = useState('list')
  const [tipPct,       setTipPct]       = useState(null)    // 10 | 15 | 20 | 'custom'
  const [tipCustom,    setTipCustom]    = useState('')
  const [tipLoading,   setTipLoading]   = useState(false)
  const [tipDismissed, setTipDismissed] = useState(() =>
    new Set(JSON.parse(localStorage.getItem('nynly_tip_dismissed') || '[]'))
  )
  // État de l'avis pour la mission terminée ouverte en détail : null (pas de demande),
  // 'pending' (avis à donner) ou 'done' (avis déjà envoyé). Pilote le bouton "Donner mon avis".
  const [reviewState, setReviewState] = useState(null)
  // Commit 2k: bloque le double envoi de demande de prolongation
  const [extensionRequested, setExtensionRequested] = useState(false)

  const { t, isFR, isES } = useT(lang)
  const STATUS_META = isFR ? STATUS_META_FR : (lang === 'es' ? STATUS_META_ES : STATUS_META_EN)
  const isWorker    = role === 'worker'
  // BUG FIX 1: sym déclaré ici
  const sym         = isFR ? '€' : '$'

  // Realtime : recharge la liste dès qu'un contract change (Section 26)
  useRealtimeContracts(userId, role, () => reload())

  useEffect(() => {
    if (missionId && missions.length > 0) {
      const m = missions.find(m => m.id === missionId)
      if (m) setSelected(m)
    }
  }, [missionId, missions])

  // Resync de la mission sélectionnée quand la liste se recharge (Realtime overtime, status, etc.)
  useEffect(() => {
    if (!selected) return
    const fresh = missions.find(m => m.id === selected.id)
    if (!fresh) return
    if (fresh.updated_at !== selected.updated_at
        || fresh.status !== selected.status
        || fresh.overtime_payment_id !== selected.overtime_payment_id
        || fresh.checked_in_at !== selected.checked_in_at
        || fresh.checked_out_at !== selected.checked_out_at
        || fresh.tip_status !== selected.tip_status) {
      setSelected(fresh)
      // Si la prolongation vient d'être acceptée côté worker, on reset l'état "demande envoyée"
      if (fresh.overtime_payment_id && !selected.overtime_payment_id) {
        setExtensionRequested(false)
      }
    }
  }, [missions]) // eslint-disable-line react-hooks/exhaustive-deps

  // Charge l'état de l'avis quand on ouvre le détail d'une mission terminée.
  // Filtre par worker_id/client_id + reviewer_role (miroir RatingPopup + RLS 5V).
  useEffect(() => {
    let cancelled = false
    async function loadReviewState() {
      if (!selected || selected.status !== 'completed' || !userId) {
        setReviewState(null); return
      }
      const reviewerRole = isWorker ? 'worker' : 'client'
      const { data } = await supabase
        .from('review_requests')
        .select('completed')
        .eq('contract_id', selected.id)
        .eq(isWorker ? 'worker_id' : 'client_id', userId)
        .eq('reviewer_role', reviewerRole)
        .maybeSingle()
      if (cancelled) return
      setReviewState(!data ? null : (data.completed ? 'done' : 'pending'))
    }
    loadReviewState()
    // Bascule en "Avis envoyé ✓" dès que le popup confirme l'envoi pour cette mission.
    const onReviewDone = (e) => {
      if (e.detail?.contractId === selected?.id) setReviewState('done')
    }
    window.addEventListener('nynly:review-done', onReviewDone)
    return () => { cancelled = true; window.removeEventListener('nynly:review-done', onReviewDone) }
  }, [selected?.id, selected?.status, userId, isWorker])

  function dismissTip(contractId) {
    const next = new Set([...tipDismissed, contractId])
    setTipDismissed(next)
    localStorage.setItem('nynly_tip_dismissed', JSON.stringify([...next]))
  }

  async function handleTip(mission) {
    if (tipLoading) return
    const total = parseFloat(mission.total_amount || 0)
    let amountCents = 0
    if (tipPct === 'custom') {
      amountCents = Math.round(parseFloat(tipCustom || 0) * 100)
    } else if (tipPct) {
      amountCents = Math.round(total * tipPct / 100 * 100)
    }
    if (!amountCents || amountCents < 100) {
      toast(isFR ? '⚠️ Montant minimum : 1 $' : '⚠️ Minimum tip: $1', 'red')
      return
    }
    setTipLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('stripe-webhook', {
        body: { action: 'add_tip', contract_id: mission.id, tip_amount_cents: amountCents }
      })
      if (error) throw new Error(error.message)
      if (data && !data.ok) throw new Error(data.error || 'Payment failed')
      toast(isFR ? '✅ Pourboire envoyé !' : isES ? '✅ ¡Propina enviada!' : '✅ Tip sent!')
      dismissTip(mission.id)
      await reload()
    } catch (e) {
      const msg = e?.message || 'Error'
      const needsAuth = msg.toLowerCase().includes('authentication')
      toast('⚠️ ' + (needsAuth
        ? (isFR ? 'Paiement refusé — mettez à jour votre carte dans les réglages'
                : isES ? 'Pago rechazado — actualiza tu tarjeta en ajustes'
                : 'Payment declined — please update your card in settings')
        : msg), 'red')
    }
    setTipLoading(false)
  }

  function toast(msg, type = 'green') {
    setNotif({ msg, type })
    setTimeout(() => setNotif(null), 4500)
  }

  async function handleRequestOvertime(mission) {
    if (otLoading) return
    setOtLoading(true)
    // Efface le message de refus précédent (si l'utilisateur réessaye)
    try { sessionStorage.removeItem(`nynly_overtime_declined_${mission.id}`) } catch (_) {}
    try {
      const { error } = await supabase.functions.invoke('stripe-webhook', {
        body: { action:'request_overtime', contract_id:mission.id,
          client_id:mission.client_id, worker_id:mission.worker_id,
          extra_hours:otHours, hourly_rate:mission.hourly_rate || 20,
          currency:mission.currency || 'USD' }
      })
      if (error) throw error
      setShowOvertime(false)
      setExtensionRequested(true)
      toast(t('ot_pending'))
    } catch (e) { toast('⚠️ ' + (e?.message || 'Error'), 'red') }
    setOtLoading(false)
  }

  async function handleAcceptOvertime(otReq) {
    if (otLoading) return
    setOtLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('stripe-webhook', {
        body: { action:'accept_overtime', overtime_request_id:otReq.id, worker_id:otReq.worker_id }
      })
      if (error) {
        let msg = error.message
        try { if (error.context && typeof error.context.json === 'function') { const b = await error.context.json(); msg = b.error || b.message || msg } } catch (_) {}
        throw new Error(msg)
      }
      if (data && !data.ok) throw new Error(data.error || 'Failed')
      toast(t('ot_accepted'))
      setOtRequest(null)
      await reload()
    } catch (e) { toast('⚠️ ' + (e?.message || 'Error'), 'red') }
    setOtLoading(false)
  }

  async function handleDeclineOvertime(otReq) {
    if (otLoading) return
    setOtLoading(true)
    try {
      const { error } = await supabase.functions.invoke('stripe-webhook', {
        body: { action:'decline_overtime', overtime_request_id:otReq.id, worker_id:otReq.worker_id }
      })
      if (error) throw error
      toast(isFR ? '✅ Prolongation refusée' : isES ? '✅ Extensión rechazada' : '✅ Extension declined')
      setOtRequest(null)
    } catch (e) { toast('⚠️ ' + (e?.message || 'Error'), 'red') }
    setOtLoading(false)
  }

  useEffect(() => {
    if (!isWorker || !userId) return
    async function checkOvertimeRequests() {
      const { data } = await supabase.from('overtime_requests').select('*')
        .eq('worker_id', userId).eq('status', 'pending')
        .order('requested_at', { ascending: false }).limit(1)
      setOtRequest(data?.[0] || null)
    }
    checkOvertimeRequests()
    // Realtime worker : recharge dès qu'une demande de prolongation arrive ou change
    const ch = supabase.channel(`overtime-mt-worker:${userId}`)
      .on('postgres_changes', { event:'*', schema:'public', table:'overtime_requests',
        filter: `worker_id=eq.${userId}` }, () => { checkOvertimeRequests(); reload() })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [userId, isWorker, reload])

  // Realtime famille : détecte les refus de prolongation et notifie
  useEffect(() => {
    if (isWorker || !userId) return
    const ch = supabase.channel(`overtime-mt-family:${userId}`)
      .on('postgres_changes', { event:'UPDATE', schema:'public', table:'overtime_requests',
        filter: `client_id=eq.${userId}` }, (payload) => {
        const row = payload.new
        if (row?.status === 'declined' && payload.old?.status === 'pending') {
          // Mémorise le refus pour affichage persistant (effacé à la prochaine demande)
          try {
            sessionStorage.setItem(`nynly_overtime_declined_${row.contract_id}`,
              JSON.stringify({ extra_hours: row.extra_hours, declined_at: row.responded_at }))
          } catch (_) {}
          setExtensionRequested(false)
          toast(isFR ? '❌ Le prestataire n\'est pas disponible pour cette prolongation'
               : isES ? '❌ El proveedor no está disponible para esta extensión'
               : '❌ Provider unavailable for this extension', 'red')
          reload()
        }
        if (row?.status === 'accepted' && payload.old?.status === 'pending') {
          // Si une nouvelle demande a été acceptée plus tard, on efface le refus mémorisé
          try { sessionStorage.removeItem(`nynly_overtime_declined_${row.contract_id}`) } catch (_) {}
          reload()
        }
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [userId, isWorker, isFR, isES, reload])

  // ── Expiration + rappel mi-fenêtre pour les contrats en attente ──
  useEffect(() => {
    if (!userId) return
    const field = role === 'worker' ? 'worker_id' : 'client_id'
    supabase
      .from('contracts')
      .select('id, created_at, mission_date, start_time, worker_reminder_sent')
      .eq(field, userId)
      .in('status', ['pending', 'pending_worker'])
      .then(({ data }) => {
        if (!data?.length) return
        const now = Date.now()
        data.forEach(c => {
          const expiryMs   = calcExpiry(c)
          const paymentMs  = new Date(c.created_at).getTime()
          const midpointMs = paymentMs + (expiryMs - paymentMs) / 2

          if (now > expiryMs) {
            supabase.functions.invoke('confirm-booking', {
              body: { contract_id: c.id, action: 'expire' }
            }).then(() => reload()).catch(() => {})
          } else if (role === 'worker' && now > midpointMs && !c.worker_reminder_sent) {
            supabase.functions.invoke('confirm-booking', {
              body: { contract_id: c.id, action: 'remind' }
            }).catch(() => {})
          }
        })
      })
  }, [userId, role]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAcceptBooking(mission) {
    if (confirming) return
    // Gate : background check requis avant la première acceptation
    if (!profile?.background_check_paid_at) {
      setShowBgCheck(true)
      return
    }
    setConfirming(true)
    try {
      const { data, error } = await supabase.functions.invoke('confirm-booking', {
        body: { contract_id: mission.id, action: 'accept' }
      })
      if (error) throw new Error(error.message)
      if (data && !data.ok) throw new Error(data.error || 'Failed')
      toast(isFR ? '✅ Mission acceptée !' : isES ? '✅ ¡Misión aceptada!' : '✅ Booking accepted!')
      await reload()
      setSelected(null)
    } catch (e) { toast('⚠️ ' + (e?.message || 'Error'), 'red') }
    setConfirming(false)
  }

  function handleDeclineBooking(mission) {
    setConfirm({
      mission,
      title: isFR ? 'Refuser cette mission ?' : isES ? '¿Rechazar esta misión?' : 'Decline this booking?',
      msg: isFR
        ? 'Le client sera remboursé automatiquement (aucun débit effectué). Cette action est irréversible.'
        : isES
        ? 'El cliente será reembolsado automáticamente. Esta acción es irreversible.'
        : 'The client will be automatically refunded (no charge). This cannot be undone.',
      actionLabel: isFR ? 'Oui, refuser' : isES ? 'Sí, rechazar' : 'Yes, decline',
      action: async () => {
        setConfirming(true)
        try {
          const { data, error } = await supabase.functions.invoke('confirm-booking', {
            body: { contract_id: mission.id, action: 'decline' }
          })
          if (error) throw new Error(error.message)
          if (data && !data.ok) throw new Error(data.error || 'Failed')
          toast(isFR ? 'Mission refusée' : 'Booking declined')
          await reload()
          setSelected(null)
        } catch (e) { toast('⚠️ ' + (e?.message || 'Error'), 'red') }
        setConfirming(false)
      }
    })
  }

  async function handleCheckIn(mission) {
    if (confirming) return
    setConfirming(true)
    const { data, error } = await supabase.functions.invoke('stripe-webhook', {
      body: { action:'check_in', contract_id:mission.id, worker_id:mission.worker_id }
    })
    if (error) {
      console.log('[handleCheckIn error]', error, JSON.stringify(error))
      let msg = error.message
      try { if (error.context && typeof error.context.json === 'function') { const b = await error.context.json(); msg = b.error || b.message || msg } } catch (_) {}
      toast('⚠️ ' + msg, 'red')
    } else if (data && !data.ok) {
      toast('⚠️ ' + (data.error || 'Erreur'), 'red')
    } else {
      toast(t('checkin_done'))
      await reload(); setSelected(null)
    }
    setConfirming(false)
  }

  async function handleCheckOut(mission) {
    if (confirming) return
    setConfirming(true)
    const { data, error } = await supabase.functions.invoke('complete-mission', {
      body: { contract_id: mission.id, completed_by: 'worker' }
    })
    if (error) {
      let msg = error.message
      try { if (error.context && typeof error.context.json === 'function') { const b = await error.context.json(); msg = b.error || b.message || msg } } catch (_) {}
      toast('⚠️ ' + msg, 'red')
    } else if (data && !data.ok) {
      toast('⚠️ ' + (data.error || 'Erreur'), 'red')
    } else {
      toast(t('checkout_done'))
      await reload(); setSelected(null)
    }
    setConfirming(false)
  }

  async function confirmMissionComplete(mission) {
    setConfirming(true)
    try {
      const { data, error } = await supabase.functions.invoke('complete-mission', {
        body: { contract_id: mission.id, completed_by: 'family' }
      })
      if (error) throw error
      if (data && !data.ok) throw new Error(data.error || 'complete-mission failed')
      supabase.functions.invoke('client-retention-agent', {
        body: { type:'post_mission', contract_id:mission.id }
      }).catch(() => {})
      toast(t('mission_done'))
      await reload(); setSelected(null)
    } catch (e) { toast('⚠️ ' + e.message, 'red') }
    setConfirming(false)
  }

  async function cancelMission(mission) {
    setConfirm({
      mission,
      title: t('miss_cancel_title'),
      msg: t('miss_cancel_msg'),
      sub: t('miss_cancel_sub'),
      actionLabel: t('miss_cancel_action'),
      action: async () => {
        setConfirming(true)
        try {
          const { data, error } = await supabase.functions.invoke('stripe-webhook', {
            body: { action: 'cancel_booking', contract_id: mission.id }
          })
          if (error) throw new Error(error.message)
          if (data && !data.ok) throw new Error(data.error || 'Cancellation failed')
          toast(t('miss_cancelled'))
          await reload()
          setSelected(null)
        } catch (e) {
          toast('⚠️ ' + (e?.message || 'Error'), 'red')
        }
        setConfirming(false)
      }
    })
  }

  if (loading) return (
    <div style={{ padding:'16px', fontFamily:"'Poppins',system-ui,sans-serif" }}>
      <style>{`
        @keyframes mt-shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
        .mt-sk{background:linear-gradient(90deg,#f3f4f6 25%,#e5e7eb 50%,#f3f4f6 75%);
          background-size:200% 100%;animation:mt-shimmer 1.4s infinite;border-radius:8px}
      `}</style>
      <div style={{ display:'flex', gap:8, marginBottom:16 }}>
        {[1,2].map(i => <div key={i} className="mt-sk" style={{ height:36, flex:1 }} />)}
      </div>
      {[1,2,3].map(i => (
        <div key={i} style={{ background:'white', border:'1.5px solid #e5e7eb',
          borderRadius:16, padding:16, marginBottom:10 }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}>
            <div className="mt-sk" style={{ height:12, width:'30%' }} />
            <div className="mt-sk" style={{ height:22, width:'22%', borderRadius:99 }} />
          </div>
          <div className="mt-sk" style={{ height:10, width:'60%', marginBottom:8 }} />
          <div className="mt-sk" style={{ height:10, width:'45%' }} />
        </div>
      ))}
    </div>
  )

  if (selected) {
    const meta  = STATUS_META[selected.status] || STATUS_META.pending
    const other = isWorker ? selected.client : selected.worker
    const otherName = other ? `${other.first_name || ''} ${other.last_name || ''}`.trim() : '-'

    // Section 5 — temporal blocking for worker action buttons
    let scheduledStart = null
    let scheduledEnd   = null
    if (selected.mission_date && selected.start_time) {
      scheduledStart = new Date(`${selected.mission_date}T${selected.start_time}:00`).getTime()
      if (selected.duration_minutes) {
        scheduledEnd = scheduledStart + selected.duration_minutes * 60_000
      }
    }
    const canCheckIn  = !scheduledStart || (scheduledStart - Date.now()) <= 15 * 60_000
    const canCheckOut = !scheduledEnd   || (scheduledEnd   - Date.now()) <= 10 * 60_000

    // Log verrou check-out pour diagnostic (Section C3 / Partie 4)
    if (isWorker && selected.status === 'in_progress') {
      console.log('[checkout button gating]', {
        mission_id:       selected.id,
        mission_date:     selected.mission_date,
        start_time:       selected.start_time,
        duration_minutes: selected.duration_minutes,
        scheduledStart:   scheduledStart ? new Date(scheduledStart).toISOString() : null,
        scheduledEnd:     scheduledEnd   ? new Date(scheduledEnd).toISOString()   : null,
        now:              new Date().toISOString(),
        canCheckOut,
        fallback:         !scheduledEnd,
      })
    }
    const fmtTime = (ms) => new Date(ms).toLocaleTimeString(
      isFR ? 'fr-FR' : isES ? 'es-US' : 'en-US', { hour: '2-digit', minute: '2-digit' }
    )
    const taxCredit = !isWorker
      ? calcCredit(parseFloat(selected.total_amount || 0), selected.service_type, marketCountry)
      : null

    return (
      <div style={{ padding:'16px', fontFamily:"'Poppins',system-ui,sans-serif" }}>
        {notif && <ToastMsg notif={notif} />}
        {confirm && (
          <ConfirmModal
            title={confirm.title} msg={confirm.msg} sub={confirm.sub} actionLabel={confirm.actionLabel}
            onConfirm={() => { confirm.action(); setConfirm(null) }}
            onCancel={() => setConfirm(null)}
            isFR={isFR} t={t}
          />
        )}

        <button onClick={() => setSelected(null)}
          style={{ background:'none', border:'none', cursor:'pointer',
            color:'#9ca3af', fontSize:13, marginBottom:16, fontFamily:'inherit' }}>
          ← {isWorker ? t('miss_back_worker') : t('miss_back_client')}
        </button>

        <div style={{ background:meta.bg, border:`1.5px solid ${meta.border}`,
          borderRadius:16, padding:'16px', marginBottom:14 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
            <span style={{ fontSize:32 }}>{SERVICE_ICONS[selected.service_type] || '📋'}</span>
            <div>
              <div style={{ fontWeight:800, fontSize:16, color:'#111827' }}>
                {selected.service_type}
              </div>
              <span style={{ background:meta.color, color:'white',
                borderRadius:99, padding:'2px 10px', fontSize:11, fontWeight:700 }}>
                {meta.icon} {meta.label}
              </span>
            </div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            {[
              { l: isWorker ? (isFR?'Famille':isES?'Familia':'Family') : (isFR?'Prestataire':isES?'Proveedor':'Provider'),
                v: otherName },
              { l: isFR?'Montant total':isES?'Monto total':'Total',
                v: formatPrice(totalWithOvertime(selected), selected.currency) },
              { l: isFR?'Date':isES?'Fecha':'Date',
                v: (() => {
                  const d   = formatDate(selected.mission_date || selected.created_at, lang)
                  const ti  = selected.start_time ? ' · ' + selected.start_time.slice(0, 5) : ''
                  const dur = selected.duration_minutes ? ' · ' + Math.floor(selected.duration_minutes / 60) + 'h' : ''
                  return d + ti + dur
                })() },
              { l: isWorker
                  ? (isFR?'Vos revenus (88%)':isES?'Ingresos (88%)':'Earnings (88%)')
                  : taxCredit
                    ? (isFR?'Apres credit impot':isES?'Tras CI':'After tax credit')
                    : (isFR?'Montant net':isES?'Monto neto':'Net amount'),
                v: isWorker
                  ? formatPrice(totalWithOvertime(selected) * 0.88, selected.currency)
                  : taxCredit
                    ? formatPrice(taxCredit.realCost, selected.currency) + ` (${taxCredit.label})`
                    : formatPrice(totalWithOvertime(selected), selected.currency) },
            ].map(item => (
              <div key={item.l} style={{ background:'rgba(255,255,255,.7)', borderRadius:10, padding:'10px 12px' }}>
                <div style={{ fontSize:10, color:'#9ca3af', marginBottom:3, fontWeight:600, textTransform:'uppercase' }}>{item.l}</div>
                <div style={{ fontWeight:700, fontSize:13, color:'#111827' }}>{item.v}</div>
              </div>
            ))}
          </div>

          {/* Ligne prolongation acceptée — visible famille + worker */}
          {parseFloat(selected.overtime_hours || 0) > 0 && (
            <div style={{ marginTop:10, background:'rgba(255,255,255,.7)', borderRadius:10,
              padding:'8px 12px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span style={{ fontSize:12, fontWeight:700, color:'#92400e' }}>
                ⏰ {isFR ? `Prolongation de ${parseFloat(selected.overtime_hours).toFixed(1).replace(/\.0$/,'')}h`
                   : isES ? `Extensión de ${parseFloat(selected.overtime_hours).toFixed(1).replace(/\.0$/,'')}h`
                   : `Extended by ${parseFloat(selected.overtime_hours).toFixed(1).replace(/\.0$/,'')}h`}
              </span>
              <span style={{ fontSize:12, fontWeight:700, color:'#111827' }}>
                + {formatPrice(selected.overtime_amount, selected.currency)}
              </span>
            </div>
          )}
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>

          {/* ── Accepter / Refuser (worker, pending ou pending_worker) ── */}
          {isWorker && ['pending', 'pending_worker'].includes(selected.status) && (
            <div style={{ background:'#fff7ed', border:'1.5px solid #fed7aa',
              borderRadius:14, padding:16, marginBottom:4 }}>
              <div style={{ fontWeight:800, fontSize:14, color:'#c2410c', marginBottom:4 }}>
                🕐 {isFR ? 'Nouvelle demande de mission' : isES ? 'Nueva solicitud' : 'New booking request'}
              </div>
              <div style={{ fontSize:12, color:'#9a3412', marginBottom:14, lineHeight:1.5 }}>
                {isFR ? 'Vous avez 24h pour répondre. En cas de refus, le client est remboursé automatiquement.'
                 : isES ? 'Tiene 24h para responder. Si rechaza, el cliente es reembolsado automáticamente.'
                 : 'You have 24h to respond. If you decline, the client is automatically refunded.'}
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={() => handleDeclineBooking(selected)} disabled={confirming}
                  style={{ flex:1, padding:'12px 0', borderRadius:12, border:'none',
                    background: confirming ? '#e5e7eb' : '#fee2e2',
                    color: confirming ? '#9ca3af' : '#dc2626',
                    fontWeight:800, fontSize:14, cursor: confirming ? 'wait' : 'pointer',
                    fontFamily:'inherit' }}>
                  {isFR ? '✕ Refuser' : isES ? '✕ Rechazar' : '✕ Decline'}
                </button>
                <button onClick={() => handleAcceptBooking(selected)} disabled={confirming}
                  style={{ flex:2, padding:'12px 0', borderRadius:12, border:'none',
                    background: confirming ? '#e5e7eb' : G,
                    color: confirming ? '#9ca3af' : 'white',
                    fontWeight:800, fontSize:14, cursor: confirming ? 'wait' : 'pointer',
                    fontFamily:'inherit' }}>
                  {confirming ? '⏳...' : (isFR ? '✓ Accepter la mission' : isES ? '✓ Aceptar' : '✓ Accept booking')}
                </button>
              </div>
            </div>
          )}

          {/* ── En attente de confirmation (client, pending ou pending_worker) ── */}
          {!isWorker && ['pending', 'pending_worker'].includes(selected.status) && (
            <div style={{ background:'#fff7ed', border:'1.5px solid #fed7aa',
              borderRadius:14, padding:'14px 16px' }}>
              <div style={{ fontWeight:700, fontSize:13, color:'#c2410c', marginBottom:4 }}>
                🕐 {isFR ? `En attente de ${selected.worker?.first_name || 'votre prestataire'}`
                   : isES ? `Esperando a ${selected.worker?.first_name || 'su proveedor'}`
                   : `Waiting for ${selected.worker?.first_name || 'your provider'}`}
              </div>
              <div style={{ fontSize:12, color:'#9a3412', lineHeight:1.5 }}>
                {isFR ? 'Le prestataire a 24h pour confirmer votre demande. Votre paiement est sécurisé et ne sera débité qu\'en cas d\'acceptation.'
                 : isES ? 'El proveedor tiene 24h para confirmar. Su pago está seguro y solo se cobrará si acepta.'
                 : 'Your provider has 24h to confirm. Your payment is secured and only charged if they accept.'}
              </div>
            </div>
          )}

          {isWorker && selected.status === 'confirmed' && (
            <button onClick={canCheckIn ? () => handleCheckIn(selected) : undefined}
              disabled={confirming || !canCheckIn}
              style={{ padding:14, borderRadius:14, border:'none',
                background: confirming || !canCheckIn ? '#e5e7eb' : '#3b82f6',
                color: confirming || !canCheckIn ? '#9ca3af' : 'white',
                fontWeight:800, fontSize:15,
                cursor: confirming || !canCheckIn ? 'default' : 'pointer',
                fontFamily:'inherit' }}>
              {confirming ? '⏳...'
                : !canCheckIn && scheduledStart
                ? (isFR ? `🔒 Disponible à ${fmtTime(scheduledStart - 15 * 60_000)}`
                         : isES ? `🔒 Disponible a las ${fmtTime(scheduledStart - 15 * 60_000)}`
                         : `🔒 Available at ${fmtTime(scheduledStart - 15 * 60_000)}`)
                : t('checkin_btn')}
            </button>
          )}

          {isWorker && selected.status === 'confirmed' && (
            <div style={{ fontSize:12, color:'#6b7280', textAlign:'center', lineHeight:1.5, marginTop:-4 }}>
              {isFR ? 'Indiquez votre présence à votre arrivée sur place'
               : isES ? 'Indique su presencia al llegar'
               : 'Check in when you arrive on site'}
            </div>
          )}

          {isWorker && otRequest && selected?.id === otRequest.contract_id && (
            <div style={{ background:'#fffbeb', border:'1.5px solid #fde68a',
              borderRadius:14, padding:16, marginBottom:8 }}>
              <div style={{ fontWeight:800, fontSize:14, color:'#92400e', marginBottom:6 }}>
                ⏰ {t('ot_worker_title')}
              </div>
              <div style={{ fontSize:13, color:'#92400e', marginBottom:14 }}>
                <strong>{otRequest.extra_hours}h</strong> · {sym}{parseFloat(otRequest.extra_amount).toFixed(2)}
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={() => handleDeclineOvertime(otRequest)} disabled={otLoading}
                  style={{ flex:1, padding:10, borderRadius:10,
                    background:otLoading?'#e5e7eb':'#fee2e2', border:'none',
                    color:'#dc2626', fontWeight:700, fontSize:13,
                    cursor:otLoading?'wait':'pointer', fontFamily:'inherit' }}>
                  {t('ot_worker_decline')}
                </button>
                <button onClick={() => handleAcceptOvertime(otRequest)} disabled={otLoading}
                  style={{ flex:2, padding:10, borderRadius:10,
                    background:otLoading?'#e5e7eb':G, border:'none',
                    color:'white', fontWeight:700, fontSize:13,
                    cursor:otLoading?'wait':'pointer', fontFamily:'inherit' }}>
                  {otLoading ? '⏳...' : t('ot_worker_accept')}
                </button>
              </div>
            </div>
          )}

          {isWorker && selected.status === 'in_progress' && (
            <button onClick={canCheckOut ? () => handleCheckOut(selected) : undefined}
              disabled={confirming || !canCheckOut}
              style={{ padding:14, borderRadius:14, border:'none',
                background: confirming || !canCheckOut ? '#e5e7eb' : G,
                color: confirming || !canCheckOut ? '#9ca3af' : 'white',
                fontWeight:800, fontSize:15,
                cursor: confirming || !canCheckOut ? 'default' : 'pointer',
                fontFamily:'inherit' }}>
              {confirming ? '⏳...'
                : !canCheckOut && scheduledEnd
                ? (isFR ? `🔒 Disponible à ${fmtTime(scheduledEnd - 10 * 60_000)}`
                         : isES ? `🔒 Disponible a las ${fmtTime(scheduledEnd - 10 * 60_000)}`
                         : `🔒 Available at ${fmtTime(scheduledEnd - 10 * 60_000)}`)
                : t('checkout_btn')}
            </button>
          )}

          {/* Bouton "Prolonger" + message informatif si une prolongation a déjà été acceptée */}
          {!isWorker && selected.status === 'in_progress' && selected.overtime_payment_id && (
            <div style={{ background:'#f5f3ff', border:'1px solid #ddd6fe',
              borderRadius:12, padding:'10px 14px', fontSize:12, color:'#6d28d9',
              textAlign:'center', fontWeight:600 }}>
              {isFR ? 'Cette mission a déjà été prolongée une fois.'
               : isES ? 'Esta misión ya fue extendida una vez.'
               : 'This job has already been extended once.'}
            </div>
          )}

          {!isWorker && selected.status === 'in_progress' && !showOvertime && !selected.overtime_payment_id && (() => {
            // Verrouillage temporel : bouton "Prolonger" caché si on est >2h après l'heure de fin prévue.
            // Au-delà, l'utilisateur doit fermer la mission (check-out) ou faire une nouvelle réservation.
            const missionEndMs = selected.mission_end_utc
              ? new Date(selected.mission_end_utc).getTime()
              : (selected.mission_start_utc
                  ? new Date(selected.mission_start_utc).getTime() + (selected.duration_minutes || 60) * 60_000
                  : (selected.mission_date && selected.start_time
                      ? new Date(`${selected.mission_date}T${selected.start_time}Z`).getTime() + (selected.duration_minutes || 60) * 60_000
                      : null))
            const extensionWindowMs = missionEndMs ? missionEndMs + 2 * 60 * 60 * 1000 : null
            const isWithinExtensionWindow = extensionWindowMs ? Date.now() < extensionWindowMs : true

            if (!isWithinExtensionWindow) {
              return (
                <div style={{ background:'#f3f4f6', border:'1.5px solid #e5e7eb',
                  borderRadius:14, padding:'12px 14px',
                  display:'flex', alignItems:'flex-start', gap:10 }}>
                  <span style={{ fontSize:18, lineHeight:1 }}>⏰</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:700, fontSize:13, color:'#374151', marginBottom:2 }}>
                      {isFR ? 'Prolongation indisponible'
                       : isES ? 'Extensión no disponible'
                       : 'Extension unavailable'}
                    </div>
                    <div style={{ fontSize:11, color:'#6b7280', lineHeight:1.5 }}>
                      {isFR ? "Cette mission est trop ancienne pour être prolongée. Si vous avez besoin d'un nouveau créneau, faites une nouvelle réservation."
                       : isES ? 'Esta misión es demasiado antigua para ser extendida. Si necesita más tiempo, haga una nueva reserva.'
                       : "This job is too old to be extended. If you need more time, please make a new booking."}
                    </div>
                  </div>
                </div>
              )
            }

            const declinedRaw = (() => {
              try { return sessionStorage.getItem(`nynly_overtime_declined_${selected.id}`) } catch (_) { return null }
            })()
            const declined = declinedRaw ? (() => { try { return JSON.parse(declinedRaw) } catch (_) { return null } })() : null
            return (
              <>
                {declined && !extensionRequested && (
                  <div style={{ background:'#fef2f2', border:'1.5px solid #fecaca',
                    borderRadius:14, padding:'12px 14px', marginBottom:8,
                    display:'flex', alignItems:'flex-start', gap:10 }}>
                    <span style={{ fontSize:18, lineHeight:1 }}>❌</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:700, fontSize:13, color:'#991b1b', marginBottom:2 }}>
                        {isFR ? 'Prolongation refusée'
                         : isES ? 'Extensión rechazada'
                         : 'Extension declined'}
                      </div>
                      <div style={{ fontSize:11, color:'#7f1d1d', lineHeight:1.5 }}>
                        {isFR ? `Le prestataire n'est pas disponible pour prolonger de ${parseFloat(declined.extra_hours).toFixed(1).replace(/\.0$/,'')}h. Vous pouvez essayer avec une durée plus courte.`
                         : isES ? `El proveedor no está disponible para extender ${parseFloat(declined.extra_hours).toFixed(1).replace(/\.0$/,'')}h. Puede intentar con menos tiempo.`
                         : `Provider unavailable to extend by ${parseFloat(declined.extra_hours).toFixed(1).replace(/\.0$/,'')}h. You can try with shorter duration.`}
                      </div>
                    </div>
                  </div>
                )}
                {extensionRequested ? (
                  <div style={{ background:'#fffbeb', border:'1.5px solid #fde68a',
                    borderRadius:14, padding:'14px 16px', textAlign:'center' }}>
                    <span style={{ fontWeight:700, fontSize:13, color:'#92400e' }}>
                      ⏳ {isFR ? 'Demande de prolongation envoyée — en attente de réponse du prestataire'
                         : isES ? 'Solicitud de extensión enviada — esperando respuesta del proveedor'
                         : 'Extension request sent — awaiting provider response'}
                    </span>
                  </div>
                ) : (
                  <button onClick={() => setShowOvertime(true)}
                    style={{ padding:'10px 14px', borderRadius:12, border:'1.5px solid #e5e7eb',
                      background:'white', color:'#374151', fontWeight:700, fontSize:13,
                      cursor:'pointer', fontFamily:'inherit', width:'100%',
                      display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                    ⏰ {t('extend_btn')}
                  </button>
                )}
              </>
            )
          })()}

          {!isWorker && showOvertime && (
            <div style={{ background:'#fffbeb', border:'1.5px solid #fde68a',
              borderRadius:14, padding:16, marginBottom:8 }}>
              <div style={{ fontWeight:800, fontSize:14, color:'#92400e', marginBottom:6 }}>
                {t('ot_title')}
              </div>
              <div style={{ fontSize:11, color:'#92400e', marginBottom:14 }}>{t('ot_sub')}</div>
              <div style={{ fontWeight:700, fontSize:12, color:'#374151', marginBottom:8 }}>
                {t('ot_hours_label')}
              </div>
              <div style={{ display:'flex', gap:6, marginBottom:12, flexWrap:'wrap' }}>
                {[0.5, 1, 1.5, 2].map(h => (
                  <button key={h} onClick={() => setOtHours(h)}
                    style={{ padding:'8px 14px', borderRadius:10,
                      background: otHours === h ? AM : 'white',
                      border: `1.5px solid ${otHours === h ? AM : '#e5e7eb'}`,
                      color: otHours === h ? 'white' : '#374151',
                      fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>
                    {h}h
                  </button>
                ))}
              </div>
              <div style={{ fontSize:12, color:'#6b7280', marginBottom:14 }}>
                {t('ot_cost_preview')} : <strong>{sym}{((selected.hourly_rate || 20) * otHours).toFixed(2)}</strong>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={() => setShowOvertime(false)}
                  style={{ flex:1, padding:10, borderRadius:10, background:'white',
                    border:'1.5px solid #e5e7eb', color:'#6b7280', fontWeight:700,
                    fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>
                  {t('ot_cancel')}
                </button>
                <button onClick={() => handleRequestOvertime(selected)} disabled={otLoading}
                  style={{ flex:2, padding:10, borderRadius:10,
                    background: otLoading ? '#e5e7eb' : AM, border:'none', color:'white',
                    fontWeight:700, fontSize:12, cursor: otLoading ? 'wait' : 'pointer',
                    fontFamily:'inherit' }}>
                  {otLoading ? '⏳...' : t('ot_request_btn')}
                </button>
              </div>
            </div>
          )}

          {!isWorker && selected.status === 'in_progress' && (
            <div>
              {selected.checked_in_at && (
                <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe',
                  borderRadius:12, padding:'8px 14px', marginBottom:10,
                  display:'flex', alignItems:'center', gap:8, fontSize:12 }}>
                  <span style={{ fontSize:16 }}>🟢</span>
                  <span style={{ color:'#1d4ed8', fontWeight:600 }}>
                    {isFR?'Arrivé(e) à':isES?'Llego a las':'Arrived at'}{' '}
                    {new Date(selected.checked_in_at).toLocaleTimeString(
                      isFR?'fr-FR':isES?'es-US':'en-US', { hour:'2-digit', minute:'2-digit' }
                    )}
                  </span>
                </div>
              )}
              <button onClick={() => confirmMissionComplete(selected)} disabled={confirming}
                style={{ width:'100%', padding:14, borderRadius:14, border:'none',
                  background: confirming ? '#e5e7eb' : SUCCESS_GREEN, color:'white',
                  fontWeight:800, fontSize:15, cursor: confirming ? 'wait' : 'pointer',
                  fontFamily:'inherit' }}>
                {confirming ? '⏳...' : t('family_confirm_btn')}
              </button>
            </div>
          )}

          {['pending','pending_worker','confirmed'].includes(selected.status) && (
            <button onClick={() => cancelMission(selected)} disabled={confirming}
              style={{ padding:12, borderRadius:14, background:'white',
                border:`1.5px solid ${RD}`, color:RD,
                fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>
              {/* BUG FIX 8: traduit */}
              ✕ {isFR ? 'Annuler cette mission' : isES ? 'Cancelar trabajo' : 'Cancel this job'}
            </button>
          )}

          {['completed','in_progress','confirmed'].includes(selected.status) && (
            <button onClick={() => navigate?.('/dispute', { contractId: selected.id })}
              style={{ padding:12, borderRadius:14, background:'white',
                border:'1.5px solid #e5e7eb', color:'#374151',
                fontWeight:600, fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>
              ⚖️ {isFR?'Signaler un probleme':isES?'Reportar un problema':'Report an issue'}
            </button>
          )}

          {/* Tip — visible uniquement côté client, mission terminée, tip non encore traité */}
          {!isWorker && selected.status === 'completed'
            && !selected.tip_status
            && !tipDismissed.has(selected.id) && (
            <div style={{ background:'linear-gradient(135deg,#fdf4ff,#faf5ff)',
              border:'1.5px solid #e9d5ff', borderRadius:16, padding:'16px' }}>
              <div style={{ fontWeight:800, fontSize:14, color:'#6d28d9', marginBottom:4 }}>
                🎁 {isFR ? `Laisser un pourboire à ${selected.worker?.first_name || 'votre prestataire'} ?`
                    : isES ? `¿Dejar propina a ${selected.worker?.first_name || 'tu proveedor'}?`
                    : `Leave a tip for ${selected.worker?.first_name || 'your provider'}?`}
              </div>
              <div style={{ fontSize:11, color:'#7c3aed', marginBottom:12 }}>
                {isFR ? '100% va au prestataire — aucune commission Nynly.'
                 : isES ? '100% va al proveedor — sin comisión Nynly.'
                 : '100% goes to your provider — no Nynly fee.'}
              </div>

              {/* Sélection du pourcentage */}
              <div style={{ display:'flex', gap:6, marginBottom: tipPct === 'custom' ? 10 : 12, flexWrap:'wrap' }}>
                {[10, 15, 20, 'custom'].map(pct => {
                  const label = pct === 'custom'
                    ? (isFR ? 'Autre' : isES ? 'Otro' : 'Other')
                    : `${pct}% · $${(parseFloat(selected.total_amount || 0) * pct / 100).toFixed(0)}`
                  return (
                    <button key={pct} onClick={() => setTipPct(pct)}
                      style={{ padding:'7px 12px', borderRadius:10,
                        background: tipPct === pct ? '#7c3aed' : 'white',
                        border: `1.5px solid ${tipPct === pct ? '#7c3aed' : '#e9d5ff'}`,
                        color: tipPct === pct ? 'white' : '#6d28d9',
                        fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>
                      {label}
                    </button>
                  )
                })}
              </div>

              {tipPct === 'custom' && (
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
                  <span style={{ fontWeight:700, color:'#6d28d9' }}>$</span>
                  <input type="number" min="1" max="500" step="1"
                    value={tipCustom}
                    onChange={e => setTipCustom(e.target.value)}
                    placeholder="0.00"
                    style={{ flex:1, padding:'9px 12px', borderRadius:10,
                      border:'1.5px solid #e9d5ff', fontFamily:'inherit',
                      fontSize:14, outline:'none', fontWeight:700 }} />
                </div>
              )}

              <div style={{ display:'flex', gap:8 }}>
                <button onClick={() => dismissTip(selected.id)}
                  style={{ flex:1, padding:'10px', borderRadius:12, background:'white',
                    border:'1.5px solid #e9d5ff', color:'#9ca3af',
                    fontWeight:600, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>
                  {isFR ? 'Non merci' : isES ? 'No gracias' : 'No thanks'}
                </button>
                <button
                  onClick={() => handleTip(selected)}
                  disabled={tipLoading || !tipPct || (tipPct === 'custom' && !parseFloat(tipCustom))}
                  style={{ flex:2, padding:'10px', borderRadius:12,
                    background: (tipLoading || !tipPct) ? '#e5e7eb' : '#7c3aed',
                    border:'none', color: (tipLoading || !tipPct) ? '#9ca3af' : 'white',
                    fontWeight:800, fontSize:13,
                    cursor:(tipLoading || !tipPct) ? 'default' : 'pointer',
                    fontFamily:'inherit' }}>
                  {tipLoading ? '⏳...' : tipPct && tipPct !== 'custom'
                    ? `$${(parseFloat(selected.total_amount || 0) * tipPct / 100).toFixed(2)} →`
                    : (isFR ? 'Envoyer le tip' : isES ? 'Enviar propina' : 'Send tip')}
                </button>
              </div>
            </div>
          )}

          {/* Tip déjà payé */}
          {!isWorker && selected.tip_status === 'paid' && selected.tip_amount > 0 && (
            <div style={{ background:'#f0fdf4', border:'1.5px solid #bbf7d0',
              borderRadius:12, padding:'10px 14px',
              display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ fontSize:20 }}>🎁</span>
              <span style={{ fontWeight:700, fontSize:13, color:'#15803d' }}>
                {isFR ? `Pourboire de $${parseFloat(selected.tip_amount).toFixed(2)} envoyé`
                 : isES ? `Propina de $${parseFloat(selected.tip_amount).toFixed(2)} enviada`
                 : `$${parseFloat(selected.tip_amount).toFixed(2)} tip sent`}
              </span>
            </div>
          )}

          {/* Pourboire reçu — visible côté worker (Commit 2j Fix 3) */}
          {isWorker && selected.status === 'completed' && parseFloat(selected.tip_amount || 0) > 0 && (
            <div style={{ background:'#f5f3ff', border:'1.5px solid #ddd6fe',
              borderRadius:12, padding:'10px 14px',
              display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ fontSize:20 }}>🎉</span>
              <span style={{ fontWeight:700, fontSize:13, color:'#6d28d9' }}>
                {isFR ? `Pourboire reçu : ${formatPrice(selected.tip_amount, selected.currency)}`
                 : isES ? `Propina recibida: ${formatPrice(selected.tip_amount, selected.currency)}`
                 : `Tip received: ${formatPrice(selected.tip_amount, selected.currency)}`}
                {selected.client?.first_name ? ` · ${selected.client.first_name}` : ''}
              </span>
            </div>
          )}

          {/* TODO: réactiver quand génération invoice automatique sera en place (Commit 2d) */}
          {false && selected.status === 'completed' && (
            <button onClick={() => navigate?.('/invoices')}
              style={{ padding:12, borderRadius:14, background:'#f0fdf4',
                border:'1.5px solid #bbf7d0', color:'#15803d',
                fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>
              🧾 {isFR ? 'Voir le recu' : isES ? 'Ver recibo' : 'View receipt'}
            </button>
          )}

          {/* Avis "à postériori" — mission terminée, famille ET worker (Commit 2h Bug 1) */}
          {selected.status === 'completed' && reviewState === 'pending' && (
            <button onClick={() => window.dispatchEvent(new CustomEvent('nynly:open-rating',
                { detail: { contractId: selected.id } }))}
              style={{ padding:12, borderRadius:14, background:G,
                border:'none', color:'white',
                fontWeight:800, fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>
              ⭐ {isFR ? 'Donner mon avis' : isES ? 'Dejar mi opinión' : 'Leave a review'}
            </button>
          )}
          {selected.status === 'completed' && reviewState === 'done' && (
            <div style={{ padding:12, borderRadius:14, background:'#f9fafb',
              border:'1.5px solid #e5e7eb', color:'#9ca3af',
              fontWeight:600, fontSize:13, textAlign:'center' }}>
              {isFR ? 'Avis envoyé ✓' : isES ? 'Opinión enviada ✓' : 'Review sent ✓'}
            </div>
          )}
        </div>

        {showBgCheck && (
          <BackgroundCheckGate
            profile={profile}
            lang={isFR ? 'fr' : isES ? 'es' : 'en'}
            onClose={() => setShowBgCheck(false)}
          />
        )}
      </div>
    )
  }

  const active = missions.filter(m => ['pending','pending_worker','confirmed','in_progress'].includes(m.status))
  const past   = missions.filter(m => ['completed','cancelled','declined','disputed'].includes(m.status))

  return (
    <div style={{ padding:'16px', fontFamily:"'Poppins',system-ui,sans-serif" }}>
      {notif && <ToastMsg notif={notif} />}
      {confirm && (
        <ConfirmModal
          title={confirm.title} msg={confirm.msg} actionLabel={confirm.actionLabel}
          onConfirm={() => { confirm.action(); setConfirm(null) }}
          onCancel={() => setConfirm(null)}
          isFR={isFR} t={t}
        />
      )}

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:!isWorker?8:20 }}>
        <h2 style={{ fontWeight:800, fontSize:20, color:'#111827', margin:0 }}>
          {isWorker ? t('miss_title_worker') : t('miss_title_client')}
        </h2>
        <div style={{ display:'flex', gap:4, background:'#f3f4f6', borderRadius:10, padding:3 }}>
          {[
            { mode:'list',     icon:'☰', label:t('cal_list') },
            { mode:'calendar', icon:'📅', label:t('cal_view') },
          ].map(v => (
            <button key={v.mode} onClick={() => setViewMode(v.mode)}
              style={{ padding:'6px 12px', borderRadius:8, border:'none',
                background:viewMode===v.mode?'white':'transparent',
                color:viewMode===v.mode?'#111827':'#9ca3af',
                fontWeight:viewMode===v.mode?700:500, fontSize:12,
                cursor:'pointer', fontFamily:'inherit',
                boxShadow:viewMode===v.mode?'0 1px 4px rgba(0,0,0,.08)':'none' }}>
              {v.icon} {v.label}
            </button>
          ))}
        </div>
      </div>

      {!isWorker && (
        <button onClick={() => navigate?.('/recurrences')}
          style={{ display:'flex', alignItems:'center', gap:8, background:'#F2F1FF',
            border:'1.5px solid #D6D2FF', borderRadius:12, padding:'9px 14px',
            marginBottom:14, cursor:'pointer', fontFamily:'inherit', width:'100%', textAlign:'left' }}>
          <span style={{ fontSize:18 }}>🔄</span>
          <span style={{ fontWeight:600, fontSize:13, color:'#5546E8', flex:1 }}>
            {isFR?'Gerer mes recurrences':isES?'Gestionar recurrencias':'Manage recurring bookings'}
          </span>
          <span style={{ color:'#6C63FF', fontSize:16 }}>›</span>
        </button>
      )}

      {viewMode === 'calendar' && (
        <CalendarView missions={[...active, ...past]} navigate={navigate} lang={lang} role={role} />
      )}

      {/* BUG FIX 3: traduits */}
      {viewMode === 'list' && active.length > 0 && (
        <>
          <div style={{ fontSize:11, fontWeight:700, color:'#9ca3af',
            textTransform:'uppercase', letterSpacing:'.07em', marginBottom:10 }}>
            {isFR ? 'En cours' : isES ? 'En curso' : 'Active'} ({active.length})
          </div>
          {active.map(m => <MissionCard key={m.id} mission={m} isWorker={isWorker}
            onSelect={setSelected} lang={lang}
            pendingOvertime={isWorker && !!otRequest && otRequest.contract_id === m.id} />)}
          <div style={{ height:8 }} />
        </>
      )}

      {viewMode === 'list' && past.length > 0 && (
        <>
          <div style={{ fontSize:11, fontWeight:700, color:'#9ca3af',
            textTransform:'uppercase', letterSpacing:'.07em', marginBottom:10 }}>
            {isFR ? 'Historique' : isES ? 'Historial' : 'History'}
          </div>
          {past.slice(0, 10).map(m => <MissionCard key={m.id} mission={m}
            isWorker={isWorker} onSelect={setSelected} lang={lang} />)}
        </>
      )}

      {missions.length === 0 && (
        <div style={{ textAlign:'center', padding:'48px 16px', background:'#f9fafb',
          borderRadius:14, border:'1.5px dashed #e5e7eb' }}>
          <div style={{ fontSize:40, marginBottom:10 }}>{isWorker ? '📋' : '📅'}</div>
          <div style={{ fontWeight:700, fontSize:14, color:'#374151', marginBottom:4 }}>
            {isWorker ? t('miss_empty_worker') : t('miss_empty_client')}
          </div>
          <div style={{ fontSize:12, color:'#9ca3af' }}>
            {isWorker
              ? (isFR ? 'Activez votre profil pour recevoir des demandes' : 'Activate your profile to receive requests')
              : (isFR ? 'Recherchez un prestataire pour reserver' : 'Search for a provider to book')}
          </div>
        </div>
      )}

      {showBgCheck && (
        <BackgroundCheckGate
          profile={profile}
          lang={isFR ? 'fr' : isES ? 'es' : 'en'}
          onClose={() => setShowBgCheck(false)}
        />
      )}
    </div>
  )
}

function MissionCard({ mission, isWorker, onSelect, lang = 'fr', pendingOvertime = false }) {
  const STATUS_META = lang === 'fr' ? STATUS_META_FR : (lang === 'es' ? STATUS_META_ES : STATUS_META_EN)
  const meta  = STATUS_META[mission.status] || STATUS_META.pending
  const other = isWorker ? mission.client : mission.worker
  const name  = other ? `${other.first_name || ''} ${other.last_name || ''}`.trim() : '-'
  const isFR = lang === 'fr'
  const isES = lang === 'es'
  return (
    <div onClick={() => onSelect(mission)}
      style={{ background:'white', borderRadius:16,
        border: pendingOvertime ? '1.5px solid #fde68a' : '1.5px solid #e5e7eb',
        marginBottom:8, padding:'14px 16px', cursor:'pointer',
        boxShadow: pendingOvertime ? '0 2px 10px rgba(245,158,11,.18)' : '0 1px 6px rgba(0,0,0,.04)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        <div style={{ width:44, height:44, borderRadius:10, background:meta.bg,
          border:`1.5px solid ${meta.border}`, display:'flex', alignItems:'center',
          justifyContent:'center', fontSize:22, flexShrink:0 }}>
          {SERVICE_ICONS[mission.service_type] || '📋'}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:3 }}>
            <span style={{ fontWeight:700, fontSize:13, color:'#111827' }}>{mission.service_type}</span>
            <span style={{ background:meta.bg, color:meta.color,
              borderRadius:99, padding:'1px 7px', fontSize:10, fontWeight:700 }}>
              {meta.icon} {meta.label}
            </span>
          </div>
          <div style={{ fontSize:11, color:'#9ca3af' }}>
            {name} · {formatDate(mission.mission_date || mission.created_at, lang)}
          </div>
        </div>
        <div style={{ fontWeight:800, fontSize:15, color:'#6C63FF', flexShrink:0 }}>
          {formatPrice(isWorker ? totalWithOvertime(mission) * 0.88 : totalWithOvertime(mission), mission.currency)}
        </div>
      </div>
      {pendingOvertime && (
        <div style={{ marginTop:10, padding:'8px 10px', borderRadius:10,
          background:'#fffbeb', border:'1px solid #fde68a',
          display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:14 }}>⏰</span>
          <span style={{ fontSize:12, fontWeight:700, color:'#92400e' }}>
            {isFR ? 'Demande de prolongation à confirmer'
             : isES ? 'Solicitud de extensión por confirmar'
             : 'Extension request to confirm'}
          </span>
        </div>
      )}
    </div>
  )
}

function ToastMsg({ notif }) {
  return (
    <div style={{ position:'fixed', bottom:90, left:'50%', transform:'translateX(-50%)',
      background: notif.type === 'green' ? G : RD, color:'white',
      padding:'12px 20px', borderRadius:99, fontWeight:700, fontSize:13,
      zIndex:9999, whiteSpace:'nowrap', boxShadow:'0 6px 20px rgba(0,0,0,.25)',
      fontFamily:"'Poppins',sans-serif" }}>
      {notif.msg}
    </div>
  )
}

// BUG FIX 4+6: t reçu en prop, miss_keep traduit
function ConfirmModal({ title, msg, sub, actionLabel, onConfirm, onCancel, isFR, t }) {
  return (
    <>
      <div onClick={onCancel} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)',
        zIndex:9000, backdropFilter:'blur(4px)' }} />
      <div style={{ position:'fixed', bottom:0, left:0, right:0, zIndex:9001,
        fontFamily:"'Poppins',system-ui,sans-serif" }}>
        <div style={{ background:'white', borderRadius:'20px 20px 0 0',
          padding:'28px 24px', paddingBottom:'calc(28px + env(safe-area-inset-bottom))',
          maxWidth:480, margin:'0 auto', boxShadow:'0 -8px 32px rgba(0,0,0,.15)',
          animation:'slide-up .3s cubic-bezier(.16,1,.3,1)' }}>
          <style>{`@keyframes slide-up{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
          <div style={{ fontWeight:800, fontSize:18, color:'#111827', marginBottom:10 }}>{title}</div>
          <div style={{ fontSize:13, color:'#6b7280', lineHeight:1.6, marginBottom: sub ? 8 : 24 }}>{msg}</div>
          {sub && <div style={{ fontSize:11, color:'#9ca3af', lineHeight:1.5, marginBottom:24 }}>{sub}</div>}
          <button onClick={onConfirm}
            style={{ width:'100%', padding:14, borderRadius:14, border:'none',
              background:RD, color:'white', fontWeight:800, fontSize:15,
              cursor:'pointer', fontFamily:'inherit', marginBottom:10 }}>
            {actionLabel}
          </button>
          <button onClick={onCancel}
            style={{ width:'100%', padding:12, borderRadius:14, background:'white',
              border:'1.5px solid #e5e7eb', color:'#374151',
              fontWeight:600, fontSize:14, cursor:'pointer', fontFamily:'inherit' }}>
            {t ? t('miss_keep') : (isFR ? 'Garder la mission' : 'Keep the job')}
          </button>
        </div>
      </div>
    </>
  )
}
