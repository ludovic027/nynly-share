// WorkerProfile.jsx  -  Profil complet d'un prestataire + bouton reservation
// (design v3 violet — AJOUT: en-tête profil avec photo, nom, note, ville)

import { useState, useEffect, lazy, Suspense } from 'react'
import { supabase } from '../lib/supabase'
const CallScreenLazy = lazy(() => import('./CallScreen'))
import { useT } from '../lib/i18n'
import { ServiceLocationBlock }   from './ServiceLocationBadge'
import { WorkerAvailabilityView } from './WorkerAvailability'
import { T, Icon, SERVICE_META, serviceLabel, SKILL_GROUPS, skillLabel } from '../lib/theme'
import { calcCredit } from './TaxCreditDisplay'
import { currencySym } from '../lib/market'

const sectionTitle = {
  fontSize:11, fontWeight:700, color:T.faint,
  textTransform:'uppercase', letterSpacing:'.08em', marginBottom:10,
}

const LANG_LABELS = {
  en:'English', es:'Español', fr:'Français', ht:'Kreyòl ayisyen',
  pt:'Português', de:'Deutsch', it:'Italiano', ar:'العربية',
  zh:'中文', ru:'Русский',
}

const AGE_LABELS = {
  infant:    { fr:'Nourrisson (0-1)', en:'Infant (0-1)',   es:'Bebé (0-1)' },
  toddler:   { fr:'1-3 ans',          en:'Toddler (1-3)',  es:'1-3 años' },
  preschool: { fr:'3-6 ans',          en:'3-6 yrs',        es:'3-6 años' },
  child:     { fr:'6-12 ans',         en:'6-12 yrs',       es:'6-12 años' },
  teen:      { fr:'Ados',             en:'Teens',          es:'Adolescentes' },
}

const PET_LABELS = {
  dog_small: { fr:'Petits chiens', en:'Small dogs', es:'Perros pequeños' },
  dog_large: { fr:'Grands chiens', en:'Large dogs', es:'Perros grandes' },
  cat:       { fr:'Chats',         en:'Cats',       es:'Gatos' },
  bird:      { fr:'Oiseaux',       en:'Birds',      es:'Aves' },
  exotic:    { fr:'NAC',           en:'Exotic pets', es:'Exóticos' },
}

const HANDY_LABELS = {
  assembly:         { fr:'Montage meubles',     en:'Furniture assembly', es:'Montaje de muebles' },
  mounting:         { fr:'Fixation TV/étagères', en:'TV & shelf mounting', es:'Montaje TV/estantes' },
  painting:         { fr:'Peinture',            en:'Painting',           es:'Pintura' },
  plumbing_minor:   { fr:'Petite plomberie',    en:'Minor plumbing',     es:'Plomería menor' },
  electrical_minor: { fr:'Petite électricité',  en:'Minor electrical',   es:'Electricidad menor' },
  carpentry:        { fr:'Menuiserie',          en:'Carpentry',          es:'Carpintería' },
  doors_windows:    { fr:'Portes & fenêtres',   en:'Doors & windows',    es:'Puertas y ventanas' },
  appliances:       { fr:'Électroménager',      en:'Appliances',         es:'Electrodomésticos' },
}

export default function WorkerProfile({ workerId, navigate, lang = 'fr', currentUserId, currentUserRole }) {
  const [showCall,      setShowCall]      = useState(false)
  const [wkReferences,  setWkReferences]  = useState([])
  const [buyingCredit,  setBuyingCredit]  = useState(false)
  const [creditBought,  setCreditBought]  = useState(false)
  const [worker,        setWorker]        = useState(null)
  const [reviews,       setReviews]       = useState([])
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState(null)
  const [isFav,         setIsFav]         = useState(false)
  const [favLoading,    setFavLoading]    = useState(false)
  const [clientProfile, setClientProfile] = useState(null)
  const [showUpgrade,   setShowUpgrade]   = useState(false)

  const { t, isFR } = useT(lang)
  const isES = lang === 'es'

  // Marché du worker : detected_country uniquement (fallback US, marché FR dormant)
  // Fini les fallbacks téléphone/langue viewer — source de vérité unique (3 juil 2026)
  const country = worker?.detected_country || 'US'
  const rate      = worker?.hourly_rate || 0
  const sym       = currencySym(worker)
  const services  = worker?.services_offered || []
  const svcForTax = services[0] || 'childcare'
  const [selectedService, setSelectedService] = useState(null)
  const activeService = selectedService || services[0] || 'childcare'

  useEffect(() => {
    if (!workerId) { setLoading(false); return }
    Promise.all([
      supabase
        .from('profiles')
        .select('*')
        .eq('id', workerId)
        .eq('role', 'worker')
        // FIX: suppression de .eq('is_active', true) - bloquait la previsualisation
        .single(),
      supabase
        .from('reviews')
        .select('*')
        .eq('reviewed_id', workerId)
        .order('created_at', { ascending: false })
        .limit(5),
    ]).then(([{ data: w, error: e }, { data: r }]) => {
      if (e || !w) setError(t('wp_not_found'))
      else { setWorker(w); setReviews(r || []) }
      setLoading(false)
    }).catch(() => setLoading(false))

    supabase.from('references')
      .select('referee_name,referee_role,response_text,response_rating,responded_at')
      .eq('worker_id', workerId)
      .eq('status', 'responded')
      .order('responded_at', { ascending: false })
      .then(({ data }) => setWkReferences(data || []))
      .catch(() => {})

    if (currentUserId && currentUserRole === 'client') {
      supabase.from('favorites')
        .select('id')
        .eq('client_id', currentUserId)
        .eq('worker_id', workerId)
        .maybeSingle()
        .then(({ data }) => setIsFav(!!data))
        .catch(() => {})

      supabase.from('profiles')
        .select('subscription_status,subscription_plan,call_credits_remaining,stripe_customer_id')
        .eq('id', currentUserId)
        .single()
        .then(({ data }) => { if (data) setClientProfile(data) })
        .catch(() => {})
    }
  }, [workerId, currentUserId, currentUserRole])

  async function toggleFavorite() {
    if (!currentUserId || favLoading) return
    setFavLoading(true)
    try {
      if (isFav) {
        await supabase.from('favorites')
          .delete().eq('client_id', currentUserId).eq('worker_id', worker.id)
        setIsFav(false)
      } else {
        await supabase.from('favorites')
          .insert({ client_id: currentUserId, worker_id: worker.id })
        setIsFav(true)
      }
    } catch (e) { console.warn('[toggleFavorite]', e?.message) }
    setFavLoading(false)
  }

  async function handleBuyCredit() {
    if (buyingCredit) return
    setBuyingCredit(true)
    try {
      const { data, error } = await supabase.functions.invoke('stripe-webhook', {
        body: { action: 'buy_call_credit', client_id: currentUserId }
      })
      if (error || !data?.ok) throw new Error(data?.error || error?.message || 'Payment failed')
      setCreditBought(true)
      supabase.from('profiles')
        .select('subscription_status,subscription_plan,call_credits_remaining,stripe_customer_id')
        .eq('id', currentUserId).single()
        .then(({ data: p }) => { if (p) setClientProfile(p) }).catch(() => {})
    } catch (e) {
      if (e.message !== 'SUBSCRIPTION_REQUIRED' && e.message !== 'PREMIUM_REQUIRED') {
        window.dispatchEvent(new CustomEvent('nynly:toast', { detail: e.message }))
      }
    }
    setBuyingCredit(false)
  }

  if (error) return (
    <div style={{ padding:'40px 20px', textAlign:'center',
      fontFamily:"'Poppins',system-ui,sans-serif", minHeight:'60vh',
      display:'flex', flexDirection:'column', alignItems:'center',
      justifyContent:'center', gap:12 }}>
      <div style={{ width:72, height:72, borderRadius:24, background:T.soft,
        display:'flex', alignItems:'center', justifyContent:'center', marginBottom:4 }}>
        <Icon name="user" size={32} color={T.faint} />
      </div>
      <div style={{ fontWeight:700, fontSize:16, color:T.text }}>{t('wp_not_found')}</div>
      <div style={{ fontSize:13, color:T.faint, lineHeight:1.6, maxWidth:280 }}>
        {t('wp_not_found_sub')}
      </div>
      <button onClick={() => navigate?.(-1)}
        style={{ marginTop:8, background:T.ink, border:'none',
          color:'white', borderRadius:T.rM, padding:'12px 24px',
          fontWeight:700, fontSize:14, cursor:'pointer', fontFamily:"'Poppins',sans-serif" }}>
        {t('back')}
      </button>
    </div>
  )

  if (loading) return (
    <div style={{ padding:'16px', fontFamily:"'Poppins',system-ui,sans-serif" }}>
      <style>{`
        @keyframes wp-shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
        .wp-sk{background:linear-gradient(90deg,#f3f4f6 25%,#e5e7eb 50%,#f3f4f6 75%);
          background-size:200% 100%;animation:wp-shimmer 1.4s infinite;border-radius:8px}
      `}</style>
      <div style={{ background:'white',borderRadius:20,overflow:'hidden',marginBottom:12 }}>
        <div className="wp-sk" style={{ height:180 }} />
        <div style={{ padding:'16px 16px 20px' }}>
          <div className="wp-sk" style={{ height:18,width:'50%',marginBottom:10 }} />
          <div className="wp-sk" style={{ height:13,width:'35%',marginBottom:16 }} />
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ fontFamily:"'Poppins',system-ui,sans-serif", paddingBottom:160 }}>

      {/* ── EN-TETE PROFIL (nouveau) ─────────────────────────── */}
      <div style={{ background:'white', marginBottom:8 }}>
        <div style={{ height:110,
          background:`linear-gradient(120deg,${T.primaryTint},#EDEBFF 55%,#F6F0FF)`,
          position:'relative' }}>
          {worker?.video_url && (
            <div style={{ position:'absolute', top:12, right:14,
              background:'rgba(20,18,43,.78)', backdropFilter:'blur(6px)',
              borderRadius:99, padding:'4px 10px', fontSize:10,
              fontWeight:700, color:'white', display:'flex', alignItems:'center', gap:5 }}>
              <Icon name="video" size={11} color="white" />
              {isFR?'Vidéo':isES?'Video':'Video'}
            </div>
          )}
          <div style={{ position:'absolute', bottom:-34, left:16,
            width:84, height:84, borderRadius:22,
            background:T.primaryTint, border:'4px solid white',
            boxShadow:'0 6px 18px rgba(15,23,42,.12)',
            display:'flex', alignItems:'center', justifyContent:'center',
            overflow:'hidden' }}>
            {worker?.avatar_url
              ? <img src={worker.avatar_url} alt=""
                  style={{ width:'100%', height:'100%', objectFit:'cover' }} />
              : <Icon name="user" size={36} color={T.primary} />}
          </div>
        </div>
        <div style={{ padding:'42px 16px 18px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
            <h1 style={{ margin:0, fontSize:21, fontWeight:800, color:T.text,
              letterSpacing:'-0.3px' }}>
              {worker?.first_name} {worker?.last_name?.[0]}.
            </h1>
            {worker?.is_online && (
              <span style={{ display:'inline-flex', alignItems:'center', gap:5,
                background:'#ECFDF5', color:'#047857', border:'1px solid #A7F3D0',
                borderRadius:99, padding:'3px 10px', fontSize:10.5, fontWeight:700 }}>
                <span style={{ width:7, height:7, borderRadius:'50%', background:'#22C55E' }} />
                {isFR ? 'Disponible' : isES ? 'Disponible' : 'Available'}
              </span>
            )}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:12,
            marginTop:8, fontSize:12.5, color:T.sub, flexWrap:'wrap' }}>
            {worker?.rating && (
              <span style={{ display:'inline-flex', alignItems:'center', gap:4,
                fontWeight:700, color:T.text }}>
                <Icon name="star" size={13} color="#F59E0B" strokeWidth={2.4} />
                {parseFloat(worker.rating).toFixed(1)}
                {(worker?.review_count || 0) > 0 && (
                  <span style={{ fontWeight:400, color:T.sub }}>
                    ({worker.review_count} {isFR?'avis':isES?'reseñas':'reviews'})
                  </span>
                )}
              </span>
            )}
            {worker?.city && <span>{worker.city}</span>}
          </div>
        </div>
      </div>

      {/* Services traduits */}
      {services.length > 0 && (
        <div style={{ padding:'16px 16px 0' }}>
          <div style={sectionTitle}>{isFR ? 'Services' : isES ? 'Servicios' : 'Services'}</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:16 }}>
            {services.map(id => (
              <span key={id} style={{ background:T.primaryTint, border:'1px solid #D6D2FF',
                borderRadius:99, padding:'5px 12px', fontSize:12, fontWeight:600,
                color:T.primaryDark, display:'flex', alignItems:'center', gap:6 }}>
                <Icon name={SERVICE_META[id]?.icon || 'clipboard'} size={13}
                  color={SERVICE_META[id]?.color || T.primaryDark} />
                {serviceLabel(id, lang)}
                {worker?.service_rates?.[id] && (
                  <span style={{ color:T.faint, fontWeight:400 }}>
                    {' · '}{sym}{worker.service_rates[id]}/h
                  </span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Détails : langues, expérience, certifications, bon à savoir */}
      {(() => {
        const langs = worker?.languages || []
        const certs = Array.isArray(worker?.certifications) ? worker.certifications : []
        const ages  = worker?.childcare_age_ranges || []
        const pets  = worker?.pet_types || []
        const handy = worker?.handyman_skills || []
        const exp   = worker?.years_experience
        const goodToKnow = [
          worker?.has_vehicle && { icon:'car',
            label: isFR ? 'Véhiculé(e)' : isES ? 'Con vehículo' : 'Has a vehicle' },
          worker?.non_smoker && { icon:'check',
            label: isFR ? 'Non-fumeur' : isES ? 'No fumador' : 'Non-smoker' },
          worker?.comfortable_with_pets && { icon:'paw',
            label: isFR ? "A l'aise avec les animaux" : isES ? 'Cómodo con mascotas' : 'Comfortable with pets' },
        ].filter(Boolean)
        const moreSkills = ['childcare','seniorcare','cleaning','lawn','errands','hairdresser','tutoring','fitness','housesitting']
          .some(g => (worker?.[SKILL_GROUPS[g].column] || []).length > 0)
        const hasDetails = langs.length > 0 || certs.length > 0 || ages.length > 0 ||
          pets.length > 0 || handy.length > 0 || exp || goodToKnow.length > 0 ||
          moreSkills || worker?.cleaning_own_supplies || worker?.lawn_own_equipment
        if (!hasDetails) return null
        const ageLabel   = a => AGE_LABELS[a]?.[isFR ? 'fr' : isES ? 'es' : 'en'] || a
        const petLabel   = p => PET_LABELS[p]?.[isFR ? 'fr' : isES ? 'es' : 'en'] || p
        const handyLabel = h => HANDY_LABELS[h]?.[isFR ? 'fr' : isES ? 'es' : 'en'] || h
        return (
          <div style={{ padding:'0 16px', marginBottom:18 }}>
            <div style={sectionTitle}>
              {isFR ? 'En détail' : isES ? 'En detalle' : 'Details'}
            </div>
            <div style={{ background:'white', border:`1.5px solid ${T.border}`,
              borderRadius:T.rM, padding:'14px 16px', boxShadow:T.shadow,
              display:'flex', flexDirection:'column', gap:14 }}>

              {langs.length > 0 && (
                <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                  <Icon name="globe" size={16} color={T.primary} style={{ marginTop:3 }} />
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:T.faint, marginBottom:5 }}>
                      {isFR ? 'Langues parlées' : isES ? 'Idiomas' : 'Languages spoken'}
                    </div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                      {langs.map(l => (
                        <span key={l} style={{ background:T.primaryTint, color:T.primaryDark,
                          border:'1px solid #D6D2FF', borderRadius:99,
                          padding:'3px 10px', fontSize:11.5, fontWeight:600 }}>
                          {LANG_LABELS[l] || l}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {exp != null && exp > 0 && (
                <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                  <Icon name="star" size={16} color={T.primary} />
                  <div style={{ fontSize:13, color:'#374151' }}>
                    <b style={{ color:T.text }}>{exp}</b>{' '}
                    {isFR ? `an${exp > 1 ? 's' : ''} d'expérience`
                     : isES ? `año${exp > 1 ? 's' : ''} de experiencia`
                     : `year${exp > 1 ? 's' : ''} of experience`}
                  </div>
                </div>
              )}

              {certs.length > 0 && (
                <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                  <Icon name="award" size={16} color={T.primary} style={{ marginTop:3 }} />
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:T.faint, marginBottom:5 }}>
                      {isFR ? 'Diplômes & certifications' : isES ? 'Títulos y certificaciones' : 'Diplomas & certifications'}
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                      {certs.map((c, i) => (
                        <div key={i} style={{ display:'flex', alignItems:'center', gap:7,
                          fontSize:12.5, color:'#374151' }}>
                          <span>{c?.name || c}</span>
                          {c?.verified ? (
                            <span style={{ display:'inline-flex', alignItems:'center', gap:3,
                              background:'#ECFDF5', color:'#047857', border:'1px solid #A7F3D0',
                              borderRadius:99, padding:'1px 8px', fontSize:9.5, fontWeight:700 }}>
                              <Icon name="check" size={9} color="#047857" strokeWidth={3} />
                              {isFR ? 'Vérifié' : isES ? 'Verificado' : 'Verified'}
                            </span>
                          ) : (
                            <span style={{ color:T.faint, fontSize:10 }}>
                              {isFR ? '(déclaré)' : isES ? '(declarado)' : '(self-reported)'}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {ages.length > 0 && (
                <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                  <Icon name="baby" size={16} color={T.primary} style={{ marginTop:3 }} />
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:T.faint, marginBottom:5 }}>
                      {isFR ? "Tranches d'âge acceptées" : isES ? 'Edades aceptadas' : 'Age ranges'}
                    </div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                      {ages.map(a => (
                        <span key={a} style={{ background:T.soft, color:'#374151',
                          border:`1px solid ${T.border}`, borderRadius:99,
                          padding:'3px 10px', fontSize:11.5, fontWeight:600 }}>
                          {ageLabel(a)}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {pets.length > 0 && (
                <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                  <Icon name="paw" size={16} color={T.primary} style={{ marginTop:3 }} />
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:T.faint, marginBottom:5 }}>
                      {isFR ? "Animaux gardés" : isES ? 'Mascotas' : 'Pets cared for'}
                    </div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                      {pets.map(p => (
                        <span key={p} style={{ background:T.soft, color:'#374151',
                          border:`1px solid ${T.border}`, borderRadius:99,
                          padding:'3px 10px', fontSize:11.5, fontWeight:600 }}>
                          {petLabel(p)}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {handy.length > 0 && (
                <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                  <Icon name="wrench" size={16} color={T.primary} style={{ marginTop:3 }} />
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:T.faint, marginBottom:5 }}>
                      {isFR ? 'Travaux proposés' : isES ? 'Trabajos ofrecidos' : 'Handyman skills'}
                    </div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                      {handy.map(h => (
                        <span key={h} style={{ background:T.soft, color:'#374151',
                          border:`1px solid ${T.border}`, borderRadius:99,
                          padding:'3px 10px', fontSize:11.5, fontWeight:600 }}>
                          {handyLabel(h)}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Compétences des autres services (theme.jsx SKILL_GROUPS) */}
              {['childcare','seniorcare','cleaning','lawn','errands','hairdresser','tutoring','fitness','housesitting'].map(g => {
                const grp  = SKILL_GROUPS[g]
                const vals = worker?.[grp.column] || []
                if (vals.length === 0) return null
                return (
                  <div key={g} style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                    <Icon name={grp.icon} size={16} color={T.primary} style={{ marginTop:3 }} />
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:11, fontWeight:700, color:T.faint, marginBottom:5 }}>
                        {grp.label[isFR ? 'fr' : isES ? 'es' : 'en']}
                      </div>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                        {vals.map(v => (
                          <span key={v} style={{ background:T.soft, color:'#374151',
                            border:`1px solid ${T.border}`, borderRadius:99,
                            padding:'3px 10px', fontSize:11.5, fontWeight:600 }}>
                            {skillLabel(g, v, isFR ? 'fr' : isES ? 'es' : 'en')}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              })}

              {(worker?.cleaning_own_supplies || worker?.lawn_own_equipment) && (
                <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                  {worker?.cleaning_own_supplies && (
                    <span style={{ display:'inline-flex', alignItems:'center', gap:5,
                      background:T.primaryTint, color:T.primaryDark,
                      border:'1px solid #D6D2FF', borderRadius:99,
                      padding:'4px 11px', fontSize:11.5, fontWeight:600 }}>
                      <Icon name="sparkles" size={12} color={T.primaryDark} />
                      {isFR ? 'Apporte son matériel de ménage' : isES ? 'Trae su material de limpieza' : 'Brings own cleaning supplies'}
                    </span>
                  )}
                  {worker?.lawn_own_equipment && (
                    <span style={{ display:'inline-flex', alignItems:'center', gap:5,
                      background:T.primaryTint, color:T.primaryDark,
                      border:'1px solid #D6D2FF', borderRadius:99,
                      padding:'4px 11px', fontSize:11.5, fontWeight:600 }}>
                      <Icon name="leaf" size={12} color={T.primaryDark} />
                      {isFR ? 'Possède son matériel de jardin' : isES ? 'Tiene su equipo de jardín' : 'Owns yard equipment'}
                    </span>
                  )}
                </div>
              )}

              {goodToKnow.length > 0 && (
                <div style={{ display:'flex', flexWrap:'wrap', gap:6,
                  borderTop:`1px solid ${T.soft}`, paddingTop:12 }}>
                  {goodToKnow.map((g, i) => (
                    <span key={i} style={{ display:'inline-flex', alignItems:'center', gap:5,
                      background:T.primaryTint, color:T.primaryDark,
                      border:'1px solid #D6D2FF', borderRadius:99,
                      padding:'4px 11px', fontSize:11.5, fontWeight:600 }}>
                      <Icon name={g.icon} size={12} color={T.primaryDark} />
                      {g.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {/* Mode d intervention */}
      <div style={{ padding:'0 16px', marginBottom:18 }}>
        <div style={sectionTitle}>
          {isFR ? "Mode d intervention" : isES ? 'Modo de servicio' : 'Service mode'}
        </div>
        <ServiceLocationBlock
          serviceLocation={worker?.service_location || 'at_client'}
          countryCode={country}
          licenseVerified={worker?.license_verified || false}
          licenseNumber={worker?.license_number}
          licenseExpires={worker?.license_expires_at}
          lang={lang}
          compact={false}
          showTaxInfo={true}
        />
      </div>

      {/* Video */}
      {worker?.video_url && (
        <div style={{ padding:'0 16px 16px' }}>
          <div style={{ marginBottom:8 }}>
            <span style={{ background:T.violetTint, color:T.violet,
              border:'1px solid #DDD6FE', borderRadius:99,
              padding:'4px 10px', fontSize:11, fontWeight:700,
              display:'inline-flex', alignItems:'center', gap:5 }}>
              <Icon name="video" size={12} color={T.violet} />
              {isFR ? 'Video de presentation' : isES ? 'Video de presentacion' : 'Intro video'}
            </span>
          </div>
          <div style={{ borderRadius:T.rL, overflow:'hidden', background:'#000',
            aspectRatio:'9/16', maxHeight:320 }}>
            <video src={worker.video_url} controls playsInline preload="metadata"
              style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}
              onError={e => { e.target.parentElement.style.display = 'none' }} />
          </div>
        </div>
      )}

      {/* Badge assurance */}
      {(worker?.insurance_verified || worker?.thimble_opted_in || worker?.own_insurance) && (
        <div style={{ padding:'0 16px', marginBottom:14 }}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:6,
            background: worker.thimble_opted_in ? T.primaryTint : T.blueTint,
            border: worker.thimble_opted_in ? '1.5px solid #D6D2FF' : '1.5px solid #BFDBFE',
            borderRadius:99, padding:'7px 14px',
            fontSize:12, fontWeight:700,
            color: worker.thimble_opted_in ? T.primaryDark : '#1D4ED8' }}>
            <Icon name="shield" size={14}
              color={worker.thimble_opted_in ? T.primaryDark : '#1D4ED8'} />
            {worker.thimble_opted_in
              ? (isFR ? 'Assure via Thimble' : 'Insured via Thimble')
              : worker.own_insurance
              ? (isFR ? 'Assure (contrat perso)' : 'Insured (own policy)')
              : (isFR ? 'Assure Nynly' : 'Nynly Insured')}
          </div>
        </div>
      )}

      {/* References */}
      {wkReferences.length > 0 && (
        <div style={{ padding:'0 16px', marginBottom:18 }}>
          <div style={{ marginBottom:10 }}>
            <span style={{ background:T.violetTint, color:T.violet,
              border:'1px solid #DDD6FE', borderRadius:99,
              padding:'4px 10px', fontSize:11, fontWeight:700 }}>
              {wkReferences.length} {isFR ? 'reference' : 'reference'}{wkReferences.length > 1 ? 's' : ''}
              {' '}{isFR ? 'verifiee' : 'verified'}{wkReferences.length > 1 ? 's' : ''}
            </span>
          </div>
          {clientProfile?.subscription_plan !== 'premium' ? (
            <button onClick={() => navigate?.('/profile#premium')}
              style={{ width:'100%', padding:'14px 16px', borderRadius:T.rM,
                background:'rgba(108,99,255,.05)', border:'1.5px dashed rgba(108,99,255,.3)',
                color:T.primaryDark, cursor:'pointer', fontFamily:'inherit',
                fontWeight:700, fontSize:13, display:'flex', alignItems:'center', gap:10, textAlign:'left' }}>
              <Icon name="shield" size={18} color={T.primaryDark} />
              <div style={{ flex:1 }}>
                <div>{isFR ? 'Voir les references verifiees' : 'View verified references'}</div>
                <div style={{ fontSize:10, color:'rgba(108,99,255,.6)', fontWeight:400, marginTop:2 }}>
                  {isFR ? 'Disponible avec Premium' : 'Available with Premium'}
                </div>
              </div>
              <span style={{ background:'rgba(108,99,255,.12)', color:T.primaryDark,
                borderRadius:99, padding:'2px 8px', fontSize:10, fontWeight:700 }}>Premium</span>
            </button>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {wkReferences.map((ref, idx) => (
                <div key={idx} style={{ background:T.soft, borderRadius:T.rM,
                  padding:'12px 14px', border:`1px solid ${T.border}` }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:700, fontSize:13, color:T.text }}>{ref.referee_name}</div>
                      <div style={{ fontSize:11, color:T.faint }}>
                        {ref.referee_role === 'family'
                          ? (isFR ? 'Famille gardee' : 'Family cared for')
                          : ref.referee_role === 'employer'
                          ? (isFR ? 'Ancien employeur' : 'Former employer')
                          : (isFR ? 'Collegue' : 'Colleague')}
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:2 }}>
                      {[1,2,3,4,5].map(s => (
                        <Icon key={s} name="star" size={12}
                          color={s <= (ref.response_rating || 0) ? '#F59E0B' : '#E5E7EB'}
                          strokeWidth={2.4} />
                      ))}
                    </div>
                  </div>
                  <div style={{ fontSize:13, color:'#374151', lineHeight:1.6, fontStyle:'italic' }}>
                    "{ref.response_text}"
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Bio */}
      {worker?.bio && (
        <div style={{ padding:'0 16px', marginBottom:18 }}>
          <div style={sectionTitle}>{isFR ? 'A propos' : isES ? 'Acerca de' : 'About'}</div>
          <div style={{ background:T.soft, borderRadius:T.rM, padding:'14px 16px',
            fontSize:13, color:'#374151', lineHeight:1.8 }}>
            {worker.bio}
          </div>
        </div>
      )}

      {/* Disponibilites */}
      <div style={{ padding:'0 16px', marginBottom:18 }}>
        <WorkerAvailabilityView workerId={worker?.id} lang={lang} />
      </div>

      {/* Avantage fiscal inline */}
      {(() => {
        const svcRate = worker?.service_rates?.[activeService] || rate
        const credit  = calcCredit(svcRate * 2, activeService, country)
        if (!svcRate || !credit) return null
        return (
          <div style={{ padding:'0 16px', marginBottom:18 }}>
            <div style={sectionTitle}>
              {isFR ? 'Avantage fiscal sur 2 heures' : isES ? 'Ventaja fiscal (2h)' : 'Tax benefit (2h)'}
            </div>
            <div style={{ background: credit.bg, border:`1.5px solid ${credit.border}`,
              borderRadius:T.rM, padding:'14px 16px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                <span style={{ fontSize:13, color:'#374151', fontWeight:600 }}>
                  {isFR ? '2h de prestation' : '2h of service'}
                </span>
                <span style={{ fontWeight:800, fontSize:15, color:T.text }}>
                  {sym}{(svcRate * 2).toFixed(0)}
                </span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                <span style={{ fontSize:12, color:T.sub }}>
                  {credit.label}
                </span>
                <span style={{ fontWeight:700, fontSize:14, color: credit.color }}>
                  - {sym}{credit.creditAmount.toFixed(0)}
                </span>
              </div>
              <div style={{ borderTop:'1px solid rgba(0,0,0,.06)', paddingTop:8,
                display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:13, fontWeight:700, color:T.text }}>
                  {isFR ? 'Cout reel' : 'Real cost'}
                </span>
                <span style={{ fontWeight:800, fontSize:18, color: credit.color }}>
                  {sym}{credit.realCost.toFixed(0)}
                </span>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Avis */}
      {reviews.length > 0 && (
        <div style={{ padding:'0 16px', marginBottom:18 }}>
          <div style={sectionTitle}>
            {isFR ? `Avis clients (${reviews.length})` : `Reviews (${reviews.length})`}
          </div>
          {reviews.map(r => (
            <div key={r.id} style={{ background:'white', border:`1.5px solid ${T.border}`,
              borderRadius:T.rM, padding:'14px 16px', marginBottom:8, boxShadow:T.shadow }}>
              <div style={{ display:'flex', alignItems:'center', gap:3, marginBottom:8 }}>
                {[1,2,3,4,5].map(n => (
                  <Icon key={n} name="star" size={14}
                    color={n <= (r.rating || 5) ? '#F59E0B' : '#E5E7EB'}
                    strokeWidth={2.4} />
                ))}
                <span style={{ fontSize:11, color:T.faint, marginLeft:6 }}>
                  {new Date(r.created_at).toLocaleDateString(isFR ? 'fr-FR' : 'en-US',
                    { month:'short', year:'numeric' })}
                </span>
              </div>
              <p style={{ fontSize:13, color:'#374151', margin:0, lineHeight:1.7 }}>
                {r.comment || ''}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* CTA fixe en bas */}
      <div style={{ position:'fixed', bottom:72, left:0, right:0, zIndex:50,
        background:'rgba(255,255,255,.96)', backdropFilter:'blur(10px)',
        borderTop:`1px solid ${T.border}`,
        padding:'12px 16px', boxShadow:'0 -4px 20px rgba(15,23,42,.07)' }}>
        <div style={{ maxWidth:480, margin:'0 auto' }}>

          {/* Sélecteur de service */}
          {services.length > 1 && (
            <div style={{ marginBottom:10 }}>
              <div style={{ fontSize:10, fontWeight:700, color:T.faint,
                textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>
                {isFR ? 'Service souhaite' : isES ? 'Servicio deseado' : 'Service'}
              </div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {services.map(id => {
                  const sel = activeService === id
                  return (
                    <button key={id} onClick={() => setSelectedService(id)}
                      style={{ padding:'6px 11px', borderRadius:99, border:'none',
                        background: sel ? T.primary : '#F3F4F6',
                        color: sel ? 'white' : '#374151',
                        fontWeight: sel ? 700 : 500, fontSize:11,
                        display:'inline-flex', alignItems:'center', gap:5,
                        cursor:'pointer', fontFamily:'inherit' }}>
                      <Icon name={SERVICE_META[id]?.icon || 'clipboard'} size={12}
                        color={sel ? 'white' : T.sub} />
                      {serviceLabel(id, lang)}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Prix + bouton Réserver */}
          <div style={{ display:'flex', gap:12, alignItems:'center', marginBottom:10 }}>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:800, fontSize:21, color:T.text, letterSpacing:'-0.3px' }}>
                {sym}{worker?.service_rates?.[activeService] || rate}
                <span style={{ fontSize:12, color:T.faint, fontWeight:400 }}>{' /h'}</span>
              </div>
              {(() => {
                const r  = worker?.service_rates?.[activeService] || rate
                const cr = calcCredit(r, activeService, country)
                if (!cr) return null
                return (
                  <div style={{ fontSize:10, color:T.primaryDark, fontWeight:600, marginTop:1 }}>
                    {`${cr.label}: ${sym}${cr.realCost.toFixed(0)}/h`}
                  </div>
                )
              })()}
            </div>
            <button
              disabled={!worker?.is_online}
              onClick={() => navigate?.('/book', { worker, service: activeService })}
              style={{ flex:2, padding:'14px 20px', borderRadius:T.rM, border:'none',
                background: worker?.is_online ? T.primary : '#E5E7EB',
                color: worker?.is_online ? 'white' : T.faint,
                fontWeight:800, fontSize:15,
                display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                cursor: worker?.is_online ? 'pointer' : 'not-allowed',
                fontFamily:'inherit',
                boxShadow: worker?.is_online ? '0 6px 18px rgba(108,99,255,.4)' : 'none' }}>
              {worker?.is_online && <Icon name="calendar" size={16} color="white" />}
              {worker?.is_online
                ? (isFR ? 'Reserver' : isES ? 'Reservar' : 'Book')
                : (isFR ? 'Non disponible' : isES ? 'No disponible' : 'Unavailable')}
            </button>
          </div>

          {/* Message + Favori */}
          {currentUserRole !== 'worker' && currentUserId && currentUserId !== worker?.id && (
            <>
              <div style={{ display:'flex', gap:8 }}>
                <button
                  onClick={() => navigate?.('/messages', { workerId: worker.id })}
                  style={{ flex:1, padding:'10px', borderRadius:T.rS,
                    border:`1.5px solid ${T.border}`, background:'white',
                    color:'#374151', fontWeight:700, fontSize:13,
                    display:'flex', alignItems:'center', justifyContent:'center', gap:7,
                    cursor:'pointer', fontFamily:'inherit' }}>
                  <Icon name="chat" size={15} color="#374151" />
                  {isFR ? 'Message' : isES ? 'Mensaje' : 'Message'}
                </button>
                <button
                  onClick={toggleFavorite}
                  disabled={favLoading}
                  aria-label="Favorite"
                  style={{ padding:'10px 16px', borderRadius:T.rS,
                    border:`1.5px solid ${isFav ? '#FECACA' : T.border}`,
                    background: isFav ? T.redTint : 'white',
                    display:'flex', alignItems:'center',
                    cursor: favLoading ? 'wait' : 'pointer' }}>
                  <Icon name="heart" size={18}
                    color={isFav ? '#EF4444' : T.faint}
                    strokeWidth={isFav ? 2.6 : 1.9} />
                </button>
              </div>
              {clientProfile?.subscription_plan === 'premium' &&
               ['active', 'trialing', 'free_trial'].includes(clientProfile?.subscription_status) && (
                <button
                  onClick={() => setShowCall(true)}
                  style={{ width:'100%', marginTop:8, padding:'10px', borderRadius:T.rS,
                    border:`1.5px solid #D6D2FF`, background:T.primaryTint,
                    color:T.primaryDark, fontWeight:700, fontSize:13,
                    display:'flex', alignItems:'center', justifyContent:'center', gap:7,
                    cursor:'pointer', fontFamily:'inherit' }}>
                  📹 {isFR ? 'Appel video' : isES ? 'Videollamada' : 'Video call'}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modal upgrade */}
      {showUpgrade && (
        <div style={{ position:'fixed', inset:0, zIndex:9999,
          background:'rgba(20,18,43,.55)', backdropFilter:'blur(4px)',
          display:'flex', alignItems:'flex-end', justifyContent:'center',
          padding:'0 0 20px' }} onClick={() => setShowUpgrade(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background:'white', borderRadius:'20px 20px 16px 16px',
            padding:'24px 20px 28px', maxWidth:400, width:'100%',
            boxShadow:'0 -4px 40px rgba(0,0,0,.15)' }}>
            <div style={{ textAlign:'center', marginBottom:20 }}>
              <div style={{ width:56, height:56, borderRadius:18, background:T.primaryTint,
                display:'flex', alignItems:'center', justifyContent:'center',
                margin:'0 auto 10px' }}>
                <Icon name="phone" size={26} color={T.primary} />
              </div>
              <div style={{ fontSize:18, fontWeight:800, color:T.text, marginBottom:6 }}>
                {isFR ? 'Appeler avant de reserver' : 'Call before booking'}
              </div>
            </div>
            <button onClick={async () => { setShowUpgrade(false); await handleBuyCredit() }}
              style={{ width:'100%', padding:'14px 16px', borderRadius:T.rM, border:'none',
                background:T.primary, color:'white', fontWeight:700, fontSize:15,
                cursor:'pointer', fontFamily:'inherit', marginBottom:10,
                display:'flex', alignItems:'center', justifyContent:'space-between',
                boxShadow:'0 4px 14px rgba(108,99,255,.35)' }}>
              <span style={{ display:'inline-flex', alignItems:'center', gap:8 }}>
                <Icon name="phone" size={16} color="white" />
                {isFR ? 'Un appel maintenant' : 'One call now'}
              </span>
              <span style={{ background:'rgba(255,255,255,.2)', borderRadius:99,
                padding:'3px 10px', fontSize:13, fontWeight:800 }}>$2</span>
            </button>
            <button onClick={() => setShowUpgrade(false)}
              style={{ width:'100%', marginTop:8, padding:'10px', background:'transparent',
                border:'none', fontSize:13, color:T.faint, cursor:'pointer', fontFamily:'inherit' }}>
              {isFR ? 'Annuler' : 'Cancel'}
            </button>
          </div>
        </div>
      )}

      {showCall && (
        <Suspense fallback={null}>
          <CallScreenLazy
            clientId={currentUserId}
            workerId={worker?.id}
            workerName={worker ? `${worker.first_name || ''} ${worker.last_name?.[0] || ''}.`.trim() : ''}
            workerAvatar={worker?.avatar_url}
            lang={lang}
            onClose={() => setShowCall(false)}
          />
        </Suspense>
      )}
    </div>
  )
}
