// AuthScreen.jsx  - Authentification (connexion / inscription)
import { useState } from 'react'
import { supabase }         from '../lib/supabase'
import { detectLang, useT } from '../lib/i18n'

const G = '#6C63FF'

export default function AuthScreen({ onAuth, lang: langProp }) {
  const [mode,         setMode]         = useState('login')
  const [lang]                          = useState(() => langProp || detectLang())
  const { t }                           = useT(lang)
  const [role,         setRole]         = useState(null)
  const [email,        setEmail]        = useState('')
  const [pwd,          setPwd]          = useState('')
  const [first,        setFirst]        = useState('')
  const [last,         setLast]         = useState('')
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState(null)
  const [registered,   setRegistered]   = useState(false)  // ecran confirmation dedie
  const [showResend,   setShowResend]   = useState(false)
  const [resendDone,   setResendDone]   = useState(false)
  const [termsOk,      setTermsOk]      = useState(false)
  const [referralCode, setReferralCode] = useState(() => {
    try {
      const stored = sessionStorage.getItem('nynly_ref_code')
      if (stored) { sessionStorage.removeItem('nynly_ref_code'); return stored.toUpperCase().trim() }
    } catch(_e) {}
    return ''
  })

  const isSignUp = mode === 'register'
  const isFR     = lang === 'fr'
  const isES     = lang === 'es'

  async function handleResend() {
    if (!email || resendDone) return
    try {
      await supabase.auth.resend({ type: 'signup', email })
      setResendDone(true)
      setTimeout(() => setResendDone(false), 60000)
    } catch(_e) {}
  }

  async function handleSubmit() {
    setLoading(true)
    setError(null)
    try {
      if (mode === 'login') {
        const { error: e } = await supabase.auth.signInWithPassword({ email, password: pwd })
        if (e) setError(e.message)
        else onAuth?.()

      } else if (mode === 'register') {
        if (!role)           { setError(t('auth_choose_profile')); setLoading(false); return }
        if (!first || !last) { setError(t('auth_name_required'));  setLoading(false); return }
        if (pwd.length < 8)  { setError(t('auth_pwd_length'));     setLoading(false); return }
        if (!termsOk)        { setError(isFR ? 'Veuillez accepter les CGU.' : isES ? 'Por favor acepta los Términos.' : 'Please accept the terms.'); setLoading(false); return }

        const { data, error: e } = await supabase.auth.signUp({
          email, password: pwd,
          options: { data: { first_name: first, last_name: last, role } }
        })
        if (e) { setError(e.message); setLoading(false); return }

        if (data.user) {
          // Afficher l'ecran de confirmation IMMEDIATEMENT
          setRegistered(true)
          setShowResend(true)

          // Operations en arriere-plan (non-bloquantes)
          supabase.from('profiles').upsert({
            id: data.user.id, email,
            first_name: first, last_name: last, role,
            onboarding_complete: role !== 'worker',
            created_at: new Date().toISOString(),
          }).then(() => {
            supabase.rpc('initialize_free_trial', {
              p_user_id: data.user.id, p_email: email, p_role: role,
            }).catch(() => {})
          }).catch(() => {})

          if (referralCode.trim() && /^[A-Z0-9]{6,8}$/.test(referralCode.trim())) {
            supabase.rpc('link_referral', {
              p_referral_code: referralCode.trim(),
              p_referred_role: role,
            }).catch(() => {})
          }

          try {
            if (window.va)  window.va('event', { name: 'signup', role })
            if (window.fbq) window.fbq('track', 'CompleteRegistration', { content_name: role })
          } catch(_e) {}
        }

      } else if (mode === 'reset') {
        const { error: e } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`
        })
        if (e) setError(e.message)
        else setError(null)
      }

    } catch(_err) {
      setError(
        isFR ? 'Erreur de connexion. Verifiez votre reseau et reessayez.' :
        isES ? 'Error de conexion. Verifique su red e intente de nuevo.' :
               'Connection error. Check your network and try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  // ── Ecran de confirmation post-inscription ─────────────────────
  if (registered) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center',
      justifyContent:'center', background:'#f9fafb', padding:16,
      fontFamily:"'Poppins',system-ui,sans-serif" }}>
      <div style={{ width:'100%', maxWidth:400 }}>

        <div style={{ background:'white', borderRadius:20, padding:32,
          boxShadow:'0 4px 24px rgba(0,0,0,.06)', textAlign:'center' }}>

          {/* Icone */}
          <div style={{ width:80, height:80, background:'#F2F1FF', borderRadius:'50%',
            display:'flex', alignItems:'center', justifyContent:'center',
            margin:'0 auto 20px', fontSize:40 }}>
            📧
          </div>

          <h2 style={{ fontWeight:900, fontSize:22, color:'#111827', marginBottom:12 }}>
            {isFR ? 'Verifiez vos emails !'
             : isES ? 'Revisa tu correo!'
             : 'Check your email!'}
          </h2>

          {/* Message principal */}
          <div style={{ background:'#F2F1FF', border:'1.5px solid #D6D2FF',
            borderRadius:14, padding:'16px 20px', marginBottom:20, textAlign:'left' }}>
            <div style={{ fontSize:13, color:'#5546E8', lineHeight:1.8 }}>
              {isFR ? (
                <>
                  <div>📬 Un email a ete envoye a <strong>{email}</strong></div>
                  <div style={{ marginTop:8 }}>1. Ouvrez cet email</div>
                  <div>2. Cliquez sur le lien de confirmation</div>
                  <div>3. Revenez ici pour vous connecter</div>
                </>
              ) : isES ? (
                <>
                  <div>📬 Email enviado a <strong>{email}</strong></div>
                  <div style={{ marginTop:8 }}>1. Abre el email</div>
                  <div>2. Haz clic en el enlace de confirmacion</div>
                  <div>3. Vuelve aqui para iniciar sesion</div>
                </>
              ) : (
                <>
                  <div>📬 Email sent to <strong>{email}</strong></div>
                  <div style={{ marginTop:8 }}>1. Open the email</div>
                  <div>2. Click the confirmation link</div>
                  <div>3. Come back here to log in</div>
                </>
              )}
            </div>
          </div>

          {/* Alerte spam */}
          <div style={{ background:'#fffbeb', border:'1.5px solid #fde68a',
            borderRadius:12, padding:'12px 16px', marginBottom:24,
            fontSize:12, color:'#92400e', textAlign:'left' }}>
            ⚠️ {isFR ? 'Si vous ne le recevez pas dans 2 minutes, verifiez vos spams / courriers indesirables.'
                : isES ? 'Si no lo recibes en 2 minutos, revisa tu carpeta de spam.'
                : 'If you do not receive it within 2 minutes, check your spam folder.'}
          </div>

          {/* Bouton renvoyer */}
          {!resendDone ? (
            <button onClick={handleResend}
              style={{ width:'100%', padding:12, borderRadius:12,
                background:'white', border:'1.5px solid #e5e7eb',
                color:'#374151', fontWeight:600, fontSize:13,
                cursor:'pointer', fontFamily:'inherit', marginBottom:12 }}>
              {isFR ? 'Renvoyer l email' : isES ? 'Reenviar email' : 'Resend email'}
            </button>
          ) : (
            <div style={{ fontSize:12, color:G, fontWeight:600, marginBottom:12, textAlign:'center' }}>
              ✅ {isFR ? 'Email renvoye !' : isES ? 'Email reenviado!' : 'Email resent!'}
            </div>
          )}

          {/* Retour connexion */}
          <button onClick={() => { setRegistered(false); setMode('login') }}
            style={{ width:'100%', padding:14, borderRadius:14, border:'none',
              background:G, color:'white', fontWeight:800, fontSize:14,
              cursor:'pointer', fontFamily:'inherit' }}>
            {isFR ? 'Aller a la connexion' : isES ? 'Ir al inicio de sesion' : 'Go to login'}
          </button>
        </div>
      </div>
    </div>
  )

  // ── Formulaire principal ───────────────────────────────────────
  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center',
      justifyContent:'center', background:'#f9fafb', padding:16,
      fontFamily:"'Poppins',system-ui,sans-serif" }}>
      <div style={{ width:'100%', maxWidth:400 }}>

        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ width:64, height:64, background:G, borderRadius:16,
            display:'flex', alignItems:'center', justifyContent:'center',
            margin:'0 auto 12px', fontSize:28, fontWeight:900, color:'white' }}>N</div>
          <div style={{ fontWeight:900, fontSize:26, color:'#111827' }}>Nynly</div>
          <div style={{ fontSize:13, color:'#9ca3af', marginTop:4 }}>
            {mode === 'login'    && t('auth_welcome_back')}
            {mode === 'register' && t('auth_create')}
            {mode === 'reset'    && t('auth_reset_title')}
          </div>
        </div>

        <div style={{ background:'white', borderRadius:20, padding:28,
          boxShadow:'0 4px 24px rgba(0,0,0,.06)' }}>

          {isSignUp && (
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#6b7280',
                textTransform:'uppercase', letterSpacing:'.07em', marginBottom:10 }}>
                {t('auth_i_am')}
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {[
                  { id:'client', icon:'👪', label:t('auth_family'), sub:t('auth_family_sub') },
                  { id:'worker', icon:'💼', label:t('auth_worker'), sub:t('auth_worker_sub') },
                ].map(r => (
                  <button key={r.id} onClick={() => setRole(r.id)}
                    style={{ padding:'14px 10px', borderRadius:14, textAlign:'center',
                      border:`2px solid ${role===r.id ? G : '#e5e7eb'}`,
                      background: role===r.id ? '#f0fdf4' : 'white',
                      cursor:'pointer', fontFamily:'inherit', transition:'all .15s' }}>
                    <div style={{ fontSize:26, marginBottom:6 }}>{r.icon}</div>
                    <div style={{ fontSize:13, fontWeight:700, color:'#111827' }}>{r.label}</div>
                    <div style={{ fontSize:10, color:'#9ca3af', marginTop:3 }}>{r.sub}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {isSignUp && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:12 }}>
              <input value={first} onChange={e => setFirst(e.target.value)}
                placeholder={t('auth_firstname')} style={inputStyle} />
              <input value={last} onChange={e => setLast(e.target.value)}
                placeholder={t('auth_lastname')} style={inputStyle} />
            </div>
          )}

          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder={t('auth_email')}
            style={{ ...inputStyle, width:'100%', marginBottom:12, boxSizing:'border-box' }} />

          {mode !== 'reset' && (
            <input type="password" value={pwd} onChange={e => setPwd(e.target.value)}
              placeholder={isSignUp ? t('auth_pwd_min') : t('auth_password')}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              style={{ ...inputStyle, width:'100%', marginBottom:16, boxSizing:'border-box' }} />
          )}

          {mode === 'reset' && <div style={{ marginBottom:16 }} />}

          {error && (
            <div style={{ background:'#fef2f2', border:'1.5px solid #fecaca', borderRadius:10,
              padding:'10px 14px', color:'#dc2626', fontSize:12, marginBottom:14 }}>
              {error}
            </div>
          )}

          {mode === 'reset' && !error && (
            <div style={{ background:'#F2F1FF', border:'1.5px solid #D6D2FF', borderRadius:10,
              padding:'10px 14px', color:'#5546E8', fontSize:12, marginBottom:14 }}>
              {isFR ? 'Entrez votre email pour recevoir un lien de reinitialisation.'
               : isES ? 'Ingresa tu email para recibir un enlace de restablecimiento.'
               : 'Enter your email to receive a password reset link.'}
            </div>
          )}

          {isSignUp && (
            <label style={{ display:'flex', alignItems:'flex-start', gap:10,
              marginBottom:14, cursor:'pointer', userSelect:'none' }}>
              <input type="checkbox" checked={termsOk} onChange={e => setTermsOk(e.target.checked)}
                style={{ marginTop:3, accentColor:G, flexShrink:0, width:15, height:15 }} />
              <span style={{ fontSize:11, color:'#6B7280', lineHeight:1.6 }}>
                {isFR
                  ? <span>En creant un compte, vous acceptez nos <a href="/terms.html"
                      target="_blank" rel="noopener" style={{ color:G }}>CGU</a> et notre{' '}
                      <a href="/privacy.html" target="_blank" rel="noopener"
                      style={{ color:G }}>politique de confidentialite</a>.</span>
                  : isES
                  ? <span>Al crear una cuenta, aceptas nuestros <a href="/terms.html"
                      target="_blank" rel="noopener" style={{ color:G }}>Terminos</a> y la{' '}
                      <a href="/privacy.html" target="_blank" rel="noopener"
                      style={{ color:G }}>Privacidad</a>.</span>
                  : <span>By creating an account, you agree to Nynly <a href="/terms.html"
                      target="_blank" rel="noopener" style={{ color:G }}>Terms</a> and{' '}
                      <a href="/privacy.html" target="_blank" rel="noopener"
                      style={{ color:G }}>Privacy Policy</a>.</span>}
              </span>
            </label>
          )}

          {isSignUp && (
            <div style={{ marginBottom:12 }}>
              {referralCode.length >= 6 && (
                <div style={{ background:'#F2F1FF', border:'1.5px solid #D6D2FF',
                  borderRadius:12, padding:'10px 14px', marginBottom:10,
                  display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:20 }}>🎁</span>
                  <div style={{ flex:1, fontSize:12, color:'#5546E8', fontWeight:600 }}>
                    {isFR ? '2 mois gratuits !' : isES ? '2 meses gratis!' : '2 free months!'}
                  </div>
                </div>
              )}
              <label style={{ fontSize:12, fontWeight:700, color:'#374151',
                display:'block', marginBottom:6 }}>
                {t('ref_input_label')}
              </label>
              <input value={referralCode}
                onChange={e => setReferralCode(e.target.value.toUpperCase().trim())}
                placeholder={t('ref_input_ph')}
                maxLength={8}
                style={{ width:'100%', padding:'12px 14px',
                  border:'1.5px solid #e5e7eb', borderRadius:12,
                  fontSize:14, fontFamily:'inherit', outline:'none',
                  textTransform:'uppercase', letterSpacing:'0.08em',
                  boxSizing:'border-box' }} />
            </div>
          )}

          <button onClick={handleSubmit}
            disabled={loading || !email}
            style={{ width:'100%', padding:14, borderRadius:14, border:'none',
              background: loading || !email ? '#e5e7eb' : G,
              color: loading || !email ? '#9ca3af' : 'white',
              fontWeight:800, fontSize:15,
              cursor: loading || !email ? 'not-allowed' : 'pointer',
              fontFamily:'inherit',
              boxShadow: loading || !email ? 'none' : `0 4px 14px ${G}40` }}>
            {loading ? '...' :
              mode === 'login'    ? t('auth_login_btn') :
              mode === 'register' ? t('auth_register_btn') :
                                    t('auth_send_link')}
          </button>

          <div style={{ textAlign:'center', marginTop:16, fontSize:12 }}>
            {mode === 'login' && (
              <span>
                <button onClick={() => { setMode('register'); setError(null) }}
                  style={linkStyle}>{t('auth_create_acct')}</button>
                {' · '}
                <button onClick={() => { setMode('reset'); setError(null) }}
                  style={linkStyle}>{t('auth_forgot')}</button>
              </span>
            )}
            {mode !== 'login' && (
              <button onClick={() => { setMode('login'); setError(null) }}
                style={linkStyle}>{t('auth_back_login')}</button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const inputStyle = {
  padding:'12px 14px', background:'#f9fafb',
  border:'1.5px solid #e5e7eb', borderRadius:12,
  fontSize:14, fontFamily:"'Poppins',sans-serif", outline:'none',
}

const linkStyle = {
  background:'none', border:'none', cursor:'pointer',
  color:'#6C63FF', fontWeight:600, fontSize:12,
  fontFamily:"'Poppins',sans-serif",
}
