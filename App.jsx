// App.jsx  -  Nynly  -  Navigation principale

import { useState, useEffect, useRef, Suspense, lazy } from 'react'
import ErrorBoundary from './components/ErrorBoundary'
import { supabase }  from './lib/supabase'
import { initFirebase, requestPushPermission } from './lib/firebase.js'
import { detectLang } from './lib/i18n.js'

function trackEvent(name, props = {}) {
  try {
    if (window.va)  window.va('event', { name, ...props })
    if (window.fbq) window.fbq('trackCustom', name, props)
  } catch(_e) {}
}

const RefPage             = lazy(() => import('./components/RefPage'))
const InvitePage          = lazy(() => import('./components/InvitePage'))
const WelcomeScreen       = lazy(() => import('./components/WelcomeScreen'))
const AuthScreen          = lazy(() => import('./components/AuthScreen'))
const WorkerOnboarding    = lazy(() => import('./components/WorkerOnboarding'))
const HomeScreen          = lazy(() => import('./components/HomeScreen'))
const SearchResults       = lazy(() => import('./components/SearchResults'))
const WorkerProfile       = lazy(() => import('./components/WorkerProfile'))
const BookingFlow         = lazy(() => import('./components/BookingFlow'))
const MissionTracker      = lazy(() => import('./components/MissionTracker'))
const ProfileScreen       = lazy(() => import('./components/ProfileScreen'))
const InvoiceHistory      = lazy(() => import('./components/InvoiceHistory'))
const DisputeCenter       = lazy(() => import('./components/DisputeCenter'))
const AccountCancellation = lazy(() => import('./components/AccountCancellation'))
const AdminDashboard      = lazy(() => import('./components/AdminDashboard'))
const BookingSuccess      = lazy(() => import('./components/BookingSuccess'))
const Messaging           = lazy(() => import('./components/Messaging'))
const RatingPopup         = lazy(() => import('./components/RatingPopup'))
const FavoritesScreen     = lazy(() => import('./components/FavoritesScreen'))
const RecurrencesScreen   = lazy(() => import('./components/RecurrencesScreen'))
const FamilyDashboard     = lazy(() => import('./components/FamilyDashboard'))
const InAppNotifications  = lazy(() => import('./components/InAppNotifications'))
const ResetPasswordScreen = lazy(() => import('./components/ResetPasswordScreen'))
const ClientWelcome       = lazy(() => import('./components/ClientWelcome'))
const SubscriptionPage    = lazy(() => import('./components/SubscriptionPage'))

function Loader() {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center',
      height:'100vh', background:'#f9fafb', flexDirection:'column', gap:12,
      fontFamily:"'Poppins',system-ui,sans-serif" }}>
      <div style={{ width:48, height:48, border:'4px solid #e5e7eb',
        borderTopColor:'#6C63FF', borderRadius:'50%',
        animation:'nynly-spin 0.8s linear infinite' }} />
      <div style={{ fontSize:13, color:'#9ca3af', fontWeight:600 }}>Nynly</div>
      <style>{`@keyframes nynly-spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

// Routes principales (navbar visible, pas de bouton retour dans le header)
const ROOT_ROUTES = new Set(['/', '/search', '/messages', '/profile', '/missions', '/bookings', '/favorites'])

// Titres du header par route
function getRouteTitle(route, routeData, lang) {
  const isFR = lang === 'fr'
  const isES = lang === 'es'
  switch (route) {
    case '/worker':      return isFR ? 'Profil prestataire' : isES ? 'Perfil' : 'Provider profile'
    case '/book':        return isFR ? 'Réservation' : isES ? 'Reserva' : 'Booking'
    case '/invoices':    return isFR ? 'Mes factures' : isES ? 'Mis facturas' : 'My invoices'
    case '/dispute':     return isFR ? 'Litiges' : isES ? 'Disputas' : 'Disputes'
    case '/recurrences': return isFR ? 'Récurrences' : isES ? 'Recurrencias' : 'Recurrences'
    case '/cancel':      return isFR ? 'Résiliation' : isES ? 'Cancelar cuenta' : 'Cancel account'
    case '/booking-success': return isFR ? 'Réservation confirmée' : 'Booking confirmed'
    case '/mission-detail':  return isFR ? 'Détail mission' : 'Mission detail'
    case '/family-dashboard': return isFR ? 'Mon bilan' : 'My stats'
    case '/subscription': return isFR ? 'Mon abonnement' : isES ? 'Mi suscripción' : 'My subscription'
    default: return 'Nynly'
  }
}

function useApp() {
  const [session,   setSession]   = useState(null)
  const [profile,   setProfile]   = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [route,     setRoute]     = useState('/')
  const [routeData, setRouteData] = useState(null)
  const [history,   setHistory]   = useState([{ route: '/', data: null }])

  const wasLoggedIn = useRef(false)

  useEffect(() => {
    initFirebase()
    const path   = window.location.pathname
    const params = new URLSearchParams(window.location.search)
    const hash   = window.location.hash

    if (hash.includes('access_token') || hash.includes('type=signup')) {
      window.history.replaceState({}, '', '/')
    }

    if (path.startsWith('/invite/')) {
      const code = path.replace('/invite/', '').trim().toUpperCase()
      if (code) { setRoute('/invite'); setRouteData({ inviteCode: code }) }
    }

    // Guard: don't consume Supabase PKCE ?code= as a referral code on reset-password
    if (path !== '/reset-password') {
      const refCode = params.get('ref') || params.get('invite') || params.get('code')
      if (refCode) {
        sessionStorage.setItem('nynly_ref_code', refCode.toUpperCase().trim())
        window.history.replaceState({}, '', window.location.pathname)
      }
    }

    if (path === '/booking-success' && params.get('contract')) {
      setRoute('/booking-success')
      setRouteData({ contractId: params.get('contract') })
      window.history.replaceState({}, '', '/booking-success')
    }

    if (params.get('bgcheck') === 'success') {
      window.history.replaceState({}, '', '/')
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('nynly:toast', {
          detail: navigator.language?.startsWith('fr')
            ? '✅ Vérification activée ! Votre crédit de $69 est disponible.'
            : '✅ Verification activated! Your $69 credit is now active.'
        }))
      }, 800)
    }

    if (path === '/reset-password' || hash.includes('type=recovery')) {
      const resetCode = params.get('code') || null
      setRoute('/reset-password')
      if (resetCode) {
        setRouteData({ code: resetCode })
        window.history.replaceState({}, '', '/reset-password')
      }
    }

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s)
      if (s) {
        wasLoggedIn.current = true
        loadProfile(s.user.id)
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      if (s) {
        loadProfile(s.user.id)
        if (event === 'SIGNED_IN' && !wasLoggedIn.current) {
          wasLoggedIn.current = true
          setRoute('/')
          window.history.replaceState({}, '', '/')
        } else if (event === 'SIGNED_IN') {
          wasLoggedIn.current = true
        }
      } else {
        wasLoggedIn.current = false
        setProfile(null)
        setLoading(false)
      }
    })
    return () => subscription.unsubscribe()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadProfile(userId) {
    try {
      const { data } = await supabase.from('profiles').select('*, market:markets(country)').eq('id', userId).single()
      setProfile(data)
    } catch(_e) {}
    setLoading(false)
    setTimeout(() => requestPushPermission(userId), 3000)
  }

  function navigate(path, data = null) {
    if (typeof path === 'number') {
      if (path === -1 && history.length > 1) {
        const h = [...history]; h.pop()
        const prev = h[h.length - 1]
        setHistory(h); setRoute(prev.route); setRouteData(prev.data)
        window.scrollTo(0,0)
      }
      return
    }
    setHistory(prev => [...prev.slice(-9), { route: path, data: data }])
    setRoute(path); setRouteData(data)
    window.scrollTo(0,0)
  }

  useEffect(() => {
    const back = () => navigate(-1)
    window.addEventListener('popstate', back)
    return () => window.removeEventListener('popstate', back)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history])

  return { session, profile, loading, route, routeData, navigate, setProfile, setRoute, setRouteData, history }
}

export default function App() {
  const { session, profile, loading, route, routeData, navigate, setProfile, setRoute, setRouteData } = useApp()
  const lang = detectLang()

  if (loading) return <Loader />

  if (route === '/reset-password') {
    return (
      <Suspense fallback={<Loader />}>
        <ResetPasswordScreen navigate={navigate} lang={lang} code={routeData?.code} />
      </Suspense>
    )
  }

  if (route === '/invite' && routeData?.inviteCode) {
    return (
      <ErrorBoundary>
        <Suspense fallback={<div style={{ minHeight:'100vh', background:'#0f172a' }} />}>
          <InvitePage referralCode={routeData.inviteCode} lang={lang}
            onSignup={() => { setRoute('/'); setRouteData(null) }} />
        </Suspense>
      </ErrorBoundary>
    )
  }

  if (route === '/ref' && routeData?.refToken) {
    return (
      <ErrorBoundary>
        <Suspense fallback={<div style={{ textAlign:'center', padding:40, color:'#9ca3af' }}>⏳</div>}>
          <RefPage token={routeData.refToken} lang={lang} />
        </Suspense>
      </ErrorBoundary>
    )
  }

  if (!session) {
    const seen = localStorage.getItem('nynly_welcome_v2')
    if (!seen && route === '/') return (
      <ErrorBoundary><Suspense fallback={<Loader />}>
        <WelcomeScreen onDone={() => { localStorage.setItem('nynly_welcome_v2','1'); navigate('/auth') }} />
      </Suspense></ErrorBoundary>
    )
    return (
      <ErrorBoundary><Suspense fallback={<Loader />}>
        <AuthScreen onAuth={() => {}} lang={lang} />
      </Suspense></ErrorBoundary>
    )
  }

  if (!profile?.onboarding_complete && profile?.role === 'worker') return (
    <Suspense fallback={<Loader />}>
      <WorkerOnboarding userId={session.user.id}
        onComplete={u => { setProfile(u); navigate('/') }} />
    </Suspense>
  )

  if (route === '/admin') return (
    <Suspense fallback={<Loader />}>
      <AdminDashboard navigate={navigate} />
    </Suspense>
  )

  return (
    <ErrorBoundary><Suspense fallback={<Loader />}>
      <AppShell session={session} profile={profile} route={route}
        routeData={routeData} navigate={navigate} setProfile={setProfile} />
    </Suspense></ErrorBoundary>
  )
}

function AppShell({ session, profile, route, routeData, navigate, setProfile }) {
  const role = profile?.role || 'client'
  const lang = detectLang(
    profile?.preferred_lang ||
    (profile?.detected_country === 'FR' ? 'fr' : null)
  )
  const isFR = lang === 'fr'
  const isES = lang === 'es'
  const uid  = session.user.id

  const [cookieAccepted, setCookieAccepted] = useState(
    () => localStorage.getItem('nynly_cookie_consent') === 'true'
  )
  function acceptCookies() {
    localStorage.setItem('nynly_cookie_consent', 'true')
    setCookieAccepted(true)
  }

  const [notif,             setNotif]             = useState(null)
  const [unread,            setUnread]            = useState(0)
  const [pendingWorker,     setPendingWorker]     = useState(0)
  const [pendingOvertime,   setPendingOvertime]   = useState(0)
  const [showRating,        setShowRating]        = useState(false)
  // Avis "à postériori" : contractId ciblé quand l'utilisateur clique "Donner mon avis"
  // depuis le détail d'une mission terminée (sinon null = popup auto sur la + ancienne demande).
  const [ratingTarget,      setRatingTarget]      = useState(null)
  const [isOnline,          setIsOnline]          = useState(() => navigator.onLine)
  const [showClientWelcome, setShowClientWelcome] = useState(() =>
    role === 'client' && !localStorage.getItem('nynly_client_welcome_v1')
  )

  useEffect(() => {
    const onToast = (e) => {
      setNotif(e.detail || '')
      setTimeout(() => setNotif(null), 3200)
    }
    window.addEventListener('nynly:toast', onToast)
    return () => window.removeEventListener('nynly:toast', onToast)
  }, [])

  useEffect(() => {
    const onOpenRating = (e) => {
      setRatingTarget(e.detail?.contractId || null)
      setShowRating(true)
    }
    window.addEventListener('nynly:open-rating', onOpenRating)
    return () => window.removeEventListener('nynly:open-rating', onOpenRating)
  }, [])

  useEffect(() => {
    const goOnline  = () => setIsOnline(true)
    const goOffline = () => setIsOnline(false)
    window.addEventListener('online',  goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online',  goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  useEffect(() => {
    async function loadUnread() {
      try {
        const { data } = await supabase.from('conversations')
          .select('unread_count_a, unread_count_b, user_a')
          .or(`user_a.eq.${uid},user_b.eq.${uid}`)
        if (!data) return
        setUnread(data.reduce((s, c) =>
          s + (c.user_a === uid ? c.unread_count_a : c.unread_count_b) || 0, 0))
      } catch (err) { console.warn('[loadUnread]', err?.message) }
    }
    loadUnread()
    const ch = supabase.channel(`unread:${uid}`)
      .on('postgres_changes', { event:'*', schema:'public', table:'conversations' }, loadUnread)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [uid])

  useEffect(() => {
    if (!uid || role !== 'worker') return
    async function loadPending() {
      try {
        const { count } = await supabase.from('contracts')
          .select('id', { count: 'exact', head: true })
          .eq('worker_id', uid).eq('status', 'pending_worker')
        setPendingWorker(count || 0)
      } catch (err) { console.warn('[loadPending]', err?.message) }
    }
    loadPending()
    const ch = supabase.channel(`pending:${uid}`)
      .on('postgres_changes', { event:'*', schema:'public', table:'contracts',
        filter: `worker_id=eq.${uid}` }, loadPending)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [uid, role])

  useEffect(() => {
    if (!uid || role !== 'worker') return
    async function loadPendingOvertime() {
      try {
        const { count } = await supabase.from('overtime_requests')
          .select('id', { count: 'exact', head: true })
          .eq('worker_id', uid).eq('status', 'pending')
        setPendingOvertime(count || 0)
      } catch (err) { console.warn('[loadPendingOvertime]', err?.message) }
    }
    loadPendingOvertime()
    const ch = supabase.channel(`pending-overtime:${uid}`)
      .on('postgres_changes', { event:'*', schema:'public', table:'overtime_requests',
        filter: `worker_id=eq.${uid}` }, loadPendingOvertime)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [uid, role])

  // Realtime famille global : écoute les refus de prolongation depuis n'importe quel écran,
  // pour stocker dans sessionStorage le bandeau "Prolongation refusée" qui s'affichera
  // quand l'utilisateur retournera sur la mission (le channel dans MissionTracker ne tourne
  // que si MissionTracker est monté ; celui-ci tourne en permanence dans App.jsx).
  useEffect(() => {
    if (!uid || role === 'worker') return
    const ch = supabase.channel(`overtime-family-global:${uid}`)
      .on('postgres_changes', { event:'UPDATE', schema:'public', table:'overtime_requests',
        filter: `client_id=eq.${uid}` }, (payload) => {
        const row = payload.new
        if (row?.status === 'declined' && payload.old?.status === 'pending') {
          try {
            sessionStorage.setItem(`nynly_overtime_declined_${row.contract_id}`,
              JSON.stringify({ extra_hours: row.extra_hours, declined_at: row.responded_at }))
          } catch (_) {}
        }
        if (row?.status === 'accepted' && payload.old?.status === 'pending') {
          try { sessionStorage.removeItem(`nynly_overtime_declined_${row.contract_id}`) } catch (_) {}
        }
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [uid, role])

  useEffect(() => {
    if (!uid) return
    async function checkRating() {
      try {
        let q = supabase.from('review_requests').select('id')
          .eq('completed', false)
          .lte('scheduled_at', new Date().toISOString()).limit(1)
        if (role === 'worker') {
          q = q.eq('worker_id', uid).eq('reviewer_role', 'worker')
        } else {
          q = q.eq('client_id', uid).eq('reviewer_role', 'client')
        }
        const { data } = await q
        if (data?.length > 0) setTimeout(() => setShowRating(true), 2000)
      } catch (err) { console.warn('[checkRating]', err?.message) }
    }
    checkRating()
    const iv = setInterval(checkRating, 10 * 60 * 1000)
    return () => clearInterval(iv)
  }, [uid, role])

  if (showClientWelcome) {
    return (
      <Suspense fallback={<Loader />}>
        <ClientWelcome lang={lang} navigate={(path) => {
          localStorage.setItem('nynly_client_welcome_v1', '1')
          setShowClientWelcome(false)
          if (path !== '/') navigate(path)
        }} />
      </Suspense>
    )
  }

  const NAV = role === 'worker'
    ? [
        { path:'/',         icon:'🏠', label: isFR ? 'Accueil'  : 'Home'     },
        { path:'/missions', icon:'📋', label: isFR ? 'Missions' : 'Jobs'     },
        { path:'/messages', icon:'💬', label: isFR ? 'Messages' : 'Messages' },
        { path:'/profile',  icon:'👤', label: isFR ? 'Profil'   : 'Profile'  },
      ]
    : [
        { path:'/',          icon:'🔍', label: isFR?'Rechercher':isES?'Buscar':'Search'       },
        { path:'/bookings',  icon:'📅', label: isFR?'Reservations':isES?'Reservas':'Bookings' },
        { path:'/favorites', icon:'❤️', label: isFR?'Favoris':isES?'Favoritos':'Favorites'   },
        { path:'/messages',  icon:'💬', label: isFR?'Messages':isES?'Mensajes':'Messages'     },
        { path:'/profile',   icon:'👤', label: isFR?'Profil':isES?'Perfil':'Profile'          },
      ]

  // Header universel avec bouton retour sur les routes secondaires
  const isSecondaryRoute = !ROOT_ROUTES.has(route)
  const routeTitle = isSecondaryRoute ? getRouteTitle(route, routeData, lang) : null

  function renderRoute() {
    switch (route) {
      case '/':
        return <HomeScreen profile={profile} setProfile={setProfile} navigate={navigate} lang={lang} />
      case '/search':
        return <SearchResults filters={routeData} navigate={navigate} lang={lang} userId={uid} />
      case '/worker':
        return <WorkerProfile workerId={routeData?.workerId} navigate={navigate} lang={lang}
          currentUserId={uid} currentUserRole={role} />
      case '/book':
        return <BookingFlow worker={routeData?.worker} service={routeData?.service}
          date={routeData?.date} userId={uid} navigate={navigate} lang={lang} />
      case '/missions':
      case '/bookings':
        return <MissionTracker userId={uid} role={role} navigate={navigate} lang={lang}
          marketCountry={profile?.market?.country ?? 'US'} profile={profile} />
      case '/favorites':
        return <FavoritesScreen userId={uid} navigate={navigate} lang={lang} />
      case '/recurrences':
        return <RecurrencesScreen userId={uid} navigate={navigate} lang={lang} />
      case '/family-dashboard':
        return <FamilyDashboard userId={uid} navigate={navigate} lang={lang} />
      case '/subscription':
        return <SubscriptionPage profile={profile} setProfile={setProfile} navigate={navigate} lang={lang} />
      case '/mission-detail':
        return <MissionTracker userId={uid} role={role} missionId={routeData?.missionId}
          navigate={navigate} lang={lang} marketCountry={profile?.market?.country ?? 'US'} profile={profile} />
      case '/messages':
        return <Messaging userId={uid} navigate={navigate} lang={lang}
          role={role} initialWorkerId={routeData?.workerId || null} />
      case '/dispute':
        return <DisputeCenter userId={uid} contractId={routeData?.contractId}
          lang={lang} navigate={navigate} onBack={() => navigate(-1)} />
      case '/invoices':
        return <InvoiceHistory userId={uid} userRole={role}
          marketCountry={profile?.market?.country ?? 'US'}
          lang={lang} navigate={navigate} onBack={() => navigate(-1)} />
      case '/profile':
        return <ProfileScreen profile={profile} setProfile={setProfile}
          navigate={navigate} lang={lang} />
      case '/cancel':
        return <AccountCancellation userId={uid} userRole={role} lang={lang} />
      case '/booking-success':
        return <BookingSuccess
          contractId={routeData?.contractId || new URLSearchParams(window.location.search).get('contract')}
          navigate={navigate} lang={lang} />
      default:
        return <HomeScreen profile={profile} navigate={navigate} lang={lang} />
    }
  }

  const hideNav = false

  return (
    <div style={{ minHeight:'100vh', background:'#f9fafb',
      paddingBottom: hideNav ? 0 : 72,
      fontFamily:"'Poppins',system-ui,sans-serif" }}>

      {/* Header universel avec bouton retour sur routes secondaires */}
      {isSecondaryRoute && (
        <div style={{
          position:'sticky', top:0, zIndex:200,
          background:'white', borderBottom:'1px solid #e5e7eb',
          boxShadow:'0 1px 8px rgba(0,0,0,.05)',
          display:'flex', alignItems:'center', gap:12,
          padding:'12px 16px', maxWidth:'100%',
        }}>
          <div style={{ maxWidth:480, margin:'0 auto', width:'100%',
            display:'flex', alignItems:'center', gap:12 }}>
            <button
              onClick={() => navigate(-1)}
              style={{ background:'#f3f4f6', border:'none', cursor:'pointer',
                color:'#374151', fontSize:18, padding:'8px 12px',
                borderRadius:10, fontWeight:700, flexShrink:0,
                fontFamily:'inherit', lineHeight:1 }}>
              ←
            </button>
            <span style={{ fontWeight:700, fontSize:16, color:'#111827',
              flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {routeTitle}
            </span>
          </div>
        </div>
      )}

      {notif && (
        <div style={{ position:'fixed', bottom:80, left:'50%', transform:'translateX(-50%)',
          background:'#0f172a', color:'white', padding:'10px 20px', borderRadius:99,
          fontWeight:700, fontSize:13, zIndex:9999, whiteSpace:'nowrap',
          boxShadow:'0 4px 16px rgba(0,0,0,.3)' }}>
          {notif}
        </div>
      )}

      {!cookieAccepted && (
        <div style={{ position:'fixed', bottom:hideNav?0:72, left:0, right:0, zIndex:9998,
          background:'#FFFFFF', borderTop:'1.5px solid #1F2D45',
          padding:'12px 16px', display:'flex', alignItems:'center',
          gap:10, flexWrap:'wrap', boxShadow:'0 -6px 24px rgba(0,0,0,.5)' }}>
          <p style={{ flex:1, fontSize:11, color:'#6B7280', lineHeight:1.5, minWidth:200 }}>
            {isFR?'Nynly utilise des cookies essentiels et Firebase (notifications). ':
             isES?'Nynly usa cookies esenciales y Firebase (notificaciones). ':
             'Nynly uses essential cookies and Firebase (notifications). '}
            <a href="/privacy.html" target="_blank" rel="noopener"
              style={{ color:'#6C63FF', textDecoration:'none', fontSize:11 }}>
              {isFR?'En savoir plus':isES?'Mas info':'Learn more'}
            </a>
          </p>
          <button onClick={acceptCookies}
            style={{ padding:'7px 16px', borderRadius:8, background:'#6C63FF',
              border:'none', color:'white', fontSize:11, fontWeight:800,
              cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>
            {isFR?'Accepter':isES?'Aceptar':'Accept'}
          </button>
        </div>
      )}

      {!isOnline && (
        <div style={{ position:'fixed', top:0, left:0, right:0, zIndex:9998,
          background:'#1e293b', color:'white', padding:'10px 16px',
          textAlign:'center', fontSize:13, fontWeight:600 }}>
          📶 {isFR?'Pas de connexion - certaines fonctions sont limitees':
               isES?'Sin conexion - algunas funciones estan limitadas':
               'No connection - some features may be limited'}
        </div>
      )}

      <div style={{ maxWidth:480, margin:'0 auto',
        minHeight: hideNav ? '100vh' : 'calc(100vh - 72px)' }}>
        {renderRoute()}
      </div>

      <Suspense fallback={null}>
        <InAppNotifications userId={uid} role={role} lang={lang} navigate={navigate} />
      </Suspense>

      {showRating && (
        <Suspense fallback={null}>
          <RatingPopup userId={uid} role={role} lang={lang} targetContractId={ratingTarget}
            onClose={() => { setShowRating(false); setRatingTarget(null) }} />
        </Suspense>
      )}

      {!hideNav && (
        <nav style={{ position:'fixed', bottom:0, left:0, right:0,
          background:'white', borderTop:'1px solid #e5e7eb',
          display:'flex', height:72, zIndex:100,
          boxShadow:'0 -2px 16px rgba(0,0,0,.06)',
          paddingBottom:'env(safe-area-inset-bottom)' }}>
          {NAV.map(item => {
            const active   = route === item.path
            const isMsg    = item.path === '/messages'
            const isMissions = item.path === '/missions'
           const missionsBadge = isMissions ? (pendingWorker + pendingOvertime) : 0
            return (
              <button key={item.path} onClick={() => {
                if (isMissions) {
                  setPendingWorker(0)
                  setPendingOvertime(0)
                }
                navigate(item.path)
              }}
                style={{ flex:1, display:'flex', flexDirection:'column',
                  alignItems:'center', justifyContent:'center', gap:3,
                  border:'none', background:'none', cursor:'pointer',
                  paddingBottom:8, position:'relative' }}>
                {isMsg && unread > 0 && (
                  <div style={{ position:'absolute', top:8,
                    right:'calc(50% - 18px)', background:'#ef4444',
                    color:'white', borderRadius:'50%', width:18, height:18,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:9, fontWeight:800, border:'2px solid white', zIndex:1 }}>
                    {unread > 9 ? '9+' : unread}
                  </div>
                )}
                {isMissions && missionsBadge > 0 && (
                  <div style={{ position:'absolute', top:8,
                    right:'calc(50% - 18px)', background:'#6C63FF',
                    color:'white', borderRadius:'50%', width:18, height:18,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:9, fontWeight:800, border:'2px solid white', zIndex:1 }}>
                    {missionsBadge > 9 ? '9+' : missionsBadge}
                  </div>
                )}
                <span style={{ fontSize:22 }}>{item.icon}</span>
                <span style={{ fontSize:10, fontWeight:active?700:500,
                  color:active?'#6C63FF':'#9ca3af',
                  fontFamily:"'Poppins',sans-serif" }}>
                  {item.label}
                </span>
                {active && (
                  <div style={{ position:'absolute', top:0, width:40, height:3,
                    background:'#6C63FF', borderRadius:99 }} />
                )}
              </button>
            )
          })}
        </nav>
      )}
    </div>
  )
}
