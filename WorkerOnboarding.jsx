// WorkerOnboarding.jsx  -  Nynly (design v3 violet)
// Onboarding worker trilingue FR/EN/ES  -  8 étapes
// Videos uploadees via Cloudinary (preset unsigned nynly_videos)
// Étape 7 : PlatformGuide (guide du prestataire, lecture obligatoire)
// Étape 8 : Stripe Connect

import { useState, useRef } from 'react'
import { supabase }                from '../lib/supabase'
import { detectLang }              from '../lib/i18n'
import { ServiceLocationSelector } from './ServiceLocationBadge'
import CityAutocomplete from './CityAutocomplete'
import PlatformGuide from './PlatformGuide'
import { T as TK, Icon, SERVICE_META, SKILL_GROUPS } from '../lib/theme'

const G = TK.primary // marque (un seul point de changement : theme.jsx)

const SERVICES = [
  { id:'childcare',  fr:'Babysitter (ponctuel)',    en:'Babysitter (occasional)', check:true  },
  { id:'nanny',      fr:'Nounou (garde reguliere)', en:'Nanny (regular care)',     check:true  },
  { id:'petsitter',  fr:'Garde animaux',           en:'Pet Care',                check:true  },
  { id:'seniorcare', fr:'Aide seniors',            en:'Senior Care',             check:true  },
  { id:'cleaning',   fr:'Menage',                  en:'Cleaning',                check:false },
  { id:'handyman',   fr:'Bricolage',               en:'Handyman',                check:false },
  { id:'lawn',       fr:'Jardinage',               en:'Lawn Care',               check:false },
  { id:'errands',    fr:'Courses',                 en:'Errands',                 check:false },
  { id:'hairdresser',fr:'Coiffure à domicile',     en:'Hair at home',            check:false },
  { id:'tutoring',   fr:'Soutien scolaire',        en:'Tutoring',                check:true  },
  { id:'fitness',    fr:'Coach sportif',           en:'Fitness coach',           check:false },
  { id:'housesitting',fr:'Garde de maison',        en:'House sitting',           check:true  },
]
// Services réellement proposés à l'inscription (exclut les dormants)
const SERVICES_SHOWN = SERVICES.filter(s => !SERVICE_META[s.id]?.hidden)

// ── Options des champs détaillés ──────────────────────────────
const LANG_OPTIONS = [
  { id:'en', label:'English' }, { id:'es', label:'Español' },
  { id:'fr', label:'Français' }, { id:'ht', label:'Kreyòl ayisyen' },
  { id:'pt', label:'Português' }, { id:'de', label:'Deutsch' },
  { id:'it', label:'Italiano' }, { id:'ar', label:'العربية' },
  { id:'zh', label:'中文' }, { id:'ru', label:'Русский' },
]
const AGE_OPTIONS = [
  { id:'infant',    fr:'Nourrisson (0-1)', en:'Infant (0-1)',  es:'Bebé (0-1)' },
  { id:'toddler',   fr:'1-3 ans',          en:'Toddler (1-3)', es:'1-3 años' },
  { id:'preschool', fr:'3-6 ans',          en:'3-6 yrs',       es:'3-6 años' },
  { id:'child',     fr:'6-12 ans',         en:'6-12 yrs',      es:'6-12 años' },
  { id:'teen',      fr:'Ados',             en:'Teens',         es:'Adolescentes' },
]
const PET_OPTIONS = [
  { id:'dog_small', fr:'Petits chiens', en:'Small dogs',  es:'Perros pequeños' },
  { id:'dog_large', fr:'Grands chiens', en:'Large dogs',  es:'Perros grandes' },
  { id:'cat',       fr:'Chats',         en:'Cats',        es:'Gatos' },
  { id:'bird',      fr:'Oiseaux',       en:'Birds',       es:'Aves' },
  { id:'exotic',    fr:'NAC',           en:'Exotic pets', es:'Exóticos' },
]
const HANDY_OPTIONS = [
  { id:'assembly',         fr:'Montage meubles',      en:'Furniture assembly', es:'Montaje de muebles' },
  { id:'mounting',         fr:'Fixation TV/étagères', en:'TV & shelf mounting', es:'Montaje TV/estantes' },
  { id:'painting',         fr:'Peinture',             en:'Painting',           es:'Pintura' },
  { id:'plumbing_minor',   fr:'Petite plomberie',     en:'Minor plumbing',     es:'Plomería menor' },
  { id:'electrical_minor', fr:'Petite électricité',   en:'Minor electrical',   es:'Electricidad menor' },
  { id:'carpentry',        fr:'Menuiserie',           en:'Carpentry',          es:'Carpintería' },
  { id:'doors_windows',    fr:'Portes & fenêtres',    en:'Doors & windows',    es:'Puertas y ventanas' },
  { id:'appliances',       fr:'Électroménager',       en:'Appliances',         es:'Electrodomésticos' },
]

function ChipRow({ options, value, onToggle, getLabel }) {
  return (
    <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:16 }}>
      {options.map(opt => {
        const sel = value.includes(opt.id)
        return (
          <button key={opt.id} type="button" onClick={() => onToggle(opt.id)}
            style={{ padding:'7px 13px', borderRadius:99,
              border:`1.5px solid ${sel ? G : '#e5e7eb'}`,
              background: sel ? TK.primaryTint : 'white',
              color: sel ? TK.primaryDark : '#374151',
              fontWeight: sel ? 700 : 500, fontSize:12,
              cursor:'pointer', fontFamily:'inherit', transition:'all .12s' }}>
            {getLabel(opt)}
          </button>
        )
      })}
    </div>
  )
}

// ── Geocoding via Nominatim (OpenStreetMap, gratuit, sans clé) ──
async function geocodeCity(city, countryCode) {
  if (!city || city.trim().length < 2) return null
  try {
    const params = new URLSearchParams({
      q: city.trim(),
      format: 'json',
      limit: '1',
      addressdetails: '0',
    })
    if (countryCode === 'FR') params.append('countrycodes', 'fr')
    else if (countryCode === 'US') params.append('countrycodes', 'us')

    const ctrl = new AbortController()
    const timeout = setTimeout(() => ctrl.abort(), 6000)

    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?${params.toString()}`,
      { signal: ctrl.signal, headers: { 'Accept': 'application/json' } }
    )
    clearTimeout(timeout)
    if (!res.ok) return null
    const data = await res.json()
    if (Array.isArray(data) && data[0]?.lat && data[0]?.lon) {
      return {
        latitude:  parseFloat(data[0].lat),
        longitude: parseFloat(data[0].lon),
      }
    }
    return null
  } catch (_e) {
    return null
  }
}

const T = {
  fr: {
    step:'Etape', of:'sur', pct:'% complete',
    s1_title:'👋 Parlez-nous de vous', s1_sub:'Ces informations seront visibles par les familles.',
    city_lbl:'Ville / Quartier', city_ph:'Ex: Tampa, South Tampa, Westchase...',
    phone_lbl:'Telephone', phone_ph:'+1 (555) 000-0000 ou +33 6 00 00 00 00',
    langs_lbl:'Langues parlées', langs_hint:'Un vrai plus pour les familles bilingues de Tampa',
    bio_lbl:'Bio (presentez-vous en 2-3 phrases)',
    bio_ph:'Ex: Je suis etudiant(e) en education avec 3 ans experience...', bio_min:'min',
    s2_title:'🛠 Vos services', s2_sub:'Selectionnez tout ce que vous proposez.',
    check_req:'🔍 Verif. requise', rate_lbl:'Tarif horaire', rate_unit:'/heure',
    rate_hint:'Tarif moyen : $18-25/h (Tampa)', loc_lbl:"Mode d intervention",
    ages_lbl:"Tranches d'âge acceptées", pets_lbl:'Animaux gardés',
    handy_lbl:'Travaux proposés',
    handy_hint:'Plomberie et électricité : petites réparations uniquement (licence d\'État requise au-delà en Floride).',
    s3_title:'📸 Photo de profil', s3_sub:'Les profils avec photo recoivent 3x plus de demandes.',
    photo_tip:'💡 Photo nette, souriante, bien eclairee. Pas de filtre ni lunettes de soleil.',
    photo_btn:'Choisir une photo', photo_chg:'✅ Changer la photo', photo_skip:'Passer (non recommande)',
    video_title:'🎬 Video de presentation',
    video_required_note:'📹 Obligatoire  -  les parents veulent voir qui garde leurs enfants',
    video_optional_note:'📹 Optionnel  -  les profils avec video sont 5x plus consultes',
    video_sub:'Filmez-vous en 30 a 60 secondes. Dites bonjour, parlez de votre experience.',
    video_btn:'📹 Filmer ou choisir une video', video_chg:'🔄 Changer la video',
    video_skip:"Ignorer pour l instant →", video_next:'Continuer →',
    video_uploading:'⏳ Envoi en cours...', video_tip:'💡 Conseil : 30 secondes, sourire, parler naturellement.',
    s4_title:"🔐 Verification d identite", s4_sub:'Requis pour tous les prestataires. Donnees securisees.',
    s_overtime_title:'⏰ Important : les dépassements horaires',
    s_overtime_sub:'À lire absolument avant votre première mission.',
    s_overtime_rule:'Si la mission dure plus longtemps que prévu, demandez TOUJOURS une prolongation dans l\'app AVANT de continuer à travailler.',
    s_overtime_consequence:'Sans prolongation acceptée par la famille, votre temps supplémentaire ne sera pas payé. C\'est dans votre intérêt de respecter ce flux : protéger votre revenu.',
    s_overtime_how:'Comment faire : depuis l\'écran de la mission en cours, demandez à la famille de vous envoyer une demande de prolongation. Vous recevrez la demande directement sur l\'écran de la mission et pourrez l\'accepter ou la refuser.',
    s_overtime_ack:'J\'ai compris, continuer →',
    id_title:"Piece d identite (recto-verso)", id_sub:'CNI, passeport ou permis. JPG, PNG ou PDF.',
    id_btn:"📤 Charger ma piece d identite", id_done:'✅ Document charge  -  cliquer pour remplacer',
    id_secure:'🔒 Chiffre et securise. Jamais partage avec les familles.',
    id_skip:"Passer pour l instant",
    s5_title:'💳 Configurez vos paiements', s5_sub:'Pour recevoir vos paiements automatiquement.',
    stripe_speed:'Paiement rapide', stripe_speed_s:'Sur votre compte en 2 jours',
    stripe_sec:'Securise par Stripe', stripe_sec_s:'Le standard mondial des paiements',
    stripe_pct:'Vous gardez 88%', stripe_pct_s:'Nynly preleve 12% de commission seulement',
    stripe_btn:'🔗 Connecter mon compte bancaire', stripe_later:'Passer  -  configurer plus tard',
    stripe_open:'Ouvrir Stripe →', stripe_done:"✅ J ai termine  -  Finaliser mon profil",
    stripe_final_title:'Finalisez dans Stripe', stripe_final_sub:'Configurez vos coordonnees bancaires via Stripe Express.',
    next:'Continuer →', back:'← Retour', upload:'⏳ Upload...',
    saving:'⏳ Enregistrement...', connecting:'⏳ Connexion...',
  },
  en: {
    step:'Step', of:'of', pct:'% complete',
    s1_title:'👋 Tell us about yourself', s1_sub:'This information will be visible to families.',
    city_lbl:'City / Neighborhood', city_ph:'e.g. Tampa, South Tampa, Westchase...',
    phone_lbl:'Phone number', phone_ph:'+1 (555) 000-0000',
    langs_lbl:'Languages spoken', langs_hint:'A real plus for bilingual Tampa families',
    bio_lbl:'Bio (introduce yourself in 2-3 sentences)',
    bio_ph:"e.g. I'm a college student with 3 years of childcare experience...", bio_min:'min',
    s2_title:'🛠 Your services', s2_sub:'Select everything you offer.',
    check_req:'🔍 Background check', rate_lbl:'Hourly rate', rate_unit:'/hour',
    rate_hint:'Average in your area: $18-25/h (Tampa)', loc_lbl:'Service location',
    ages_lbl:'Age ranges you accept', pets_lbl:'Pets you care for',
    handy_lbl:'Handyman skills',
    handy_hint:'Plumbing & electrical: minor repairs only (Florida state license required beyond that).',
    s3_title:'📸 Profile photo', s3_sub:'Profiles with a photo get 3x more requests.',
    photo_tip:'💡 Clear, smiling, well-lit photo. No filters or sunglasses.',
    photo_btn:'Choose a photo', photo_chg:'✅ Change photo', photo_skip:'Skip (not recommended)',
    video_title:'🎬 Intro video',
    video_required_note:'📹 Required  -  parents want to see who takes care of their children',
    video_optional_note:'📹 Optional  -  profiles with video get 5x more views',
    video_sub:'Film yourself for 30-60 seconds. Say hello, share your experience.',
    video_btn:'📹 Record or choose a video', video_chg:'🔄 Change video',
    video_skip:'Skip for now →', video_next:'Continue →',
    video_uploading:'⏳ Uploading...', video_tip:'💡 Tip: good lighting, smile, speak naturally.',
    s4_title:'🔐 Identity verification', s4_sub:'Required for all providers. Your data is encrypted.',
    s_overtime_title:'⏰ Important: handling overtime',
    s_overtime_sub:'Must-read before your first job.',
    s_overtime_rule:'If a job runs longer than scheduled, ALWAYS request an extension in the app BEFORE you keep working.',
    s_overtime_consequence:'Without an accepted extension from the family, your extra time won\'t be paid. It\'s in your best interest to follow this flow: it protects your income.',
    s_overtime_how:'How: ask the family to send you an extension request from their booking screen. You\'ll receive the request directly on your active job screen and can accept or decline it.',
    s_overtime_ack:'Got it, continue →',
    id_title:'Government ID (front & back)', id_sub:"Passport, driver's license, or state ID. JPG, PNG, or PDF.",
    id_btn:'📤 Upload my ID', id_done:'✅ Document uploaded  -  click to replace',
    id_secure:'🔒 Encrypted and secured. Never shared with families.',
    id_skip:'Skip for now',
    s5_title:'💳 Set up payments', s5_sub:'To receive payments automatically after each job.',
    stripe_speed:'Fast payouts', stripe_speed_s:'In your bank account within 2 days',
    stripe_sec:'Secured by Stripe', stripe_sec_s:'The global standard for online payments',
    stripe_pct:'Keep 88%', stripe_pct_s:'Nynly takes only 12% commission',
    stripe_btn:'🔗 Connect my bank account', stripe_later:'Skip  -  set up later',
    stripe_open:'Open Stripe →', stripe_done:'✅ Done  -  Finish my profile',
    stripe_final_title:'Complete in Stripe', stripe_final_sub:'Set up your bank details via Stripe Express.',
    next:'Continue →', back:'← Back', upload:'⏳ Uploading...',
    saving:'⏳ Saving...', connecting:'⏳ Connecting...',
  },
  es: {
    step:'Paso', of:'de', pct:'% completado',
    s1_title:'👋 Cuentanos sobre ti', s1_sub:'Esta informacion sera visible para las familias.',
    city_lbl:'Ciudad / Barrio', city_ph:'Ej: Tampa, Westchase...',
    phone_lbl:'Telefono', phone_ph:'+1 (555) 000-0000',
    langs_lbl:'Idiomas que hablas', langs_hint:'Una gran ventaja para las familias bilingües de Tampa',
    bio_lbl:'Bio (presentate en 2-3 frases)',
    bio_ph:'Ej: Soy estudiante con 3 anos de experiencia cuidando ninos...', bio_min:'min',
    s2_title:'🛠 Tus servicios', s2_sub:'Selecciona todo lo que ofreces.',
    check_req:'🔍 Verificacion requerida', rate_lbl:'Tarifa por hora', rate_unit:'/hora',
    rate_hint:'Promedio en tu zona: $18-25/h (Tampa)', loc_lbl:'Lugar de servicio',
    ages_lbl:'Edades aceptadas', pets_lbl:'Mascotas que cuidas',
    handy_lbl:'Trabajos ofrecidos',
    handy_hint:'Plomería y electricidad: solo reparaciones menores (más allá se requiere licencia estatal en Florida).',
    s3_title:'📸 Foto de perfil', s3_sub:'Los perfiles con foto reciben 3x mas solicitudes.',
    photo_tip:'💡 Foto clara, sonriente, bien iluminada. Sin filtros ni gafas de sol.',
    photo_btn:'Elegir una foto', photo_chg:'✅ Cambiar foto', photo_skip:'Omitir (no recomendado)',
    video_title:'🎬 Video de presentacion',
    video_required_note:'📹 Obligatorio  -  los padres quieren ver quien cuida a sus hijos',
    video_optional_note:'📹 Opcional  -  los perfiles con video reciben 5x mas visitas',
    video_sub:'Filmate durante 30-60 segundos. Saluda, habla de tu experiencia.',
    video_btn:'📹 Grabar o elegir un video', video_chg:'🔄 Cambiar video',
    video_skip:'Omitir por ahora →', video_next:'Continuar →',
    video_uploading:'⏳ Subiendo...', video_tip:'💡 Consejo: buena iluminacion, sonrie, habla con naturalidad.',
    s4_title:'🔐 Verificacion de identidad', s4_sub:'Requerido para todos los proveedores Nynly.',
    s_overtime_title:'⏰ Importante: extensiones de horario',
    s_overtime_sub:'Léelo antes de tu primer trabajo.',
    s_overtime_rule:'Si un trabajo dura más de lo previsto, SIEMPRE solicita una extensión en la app ANTES de continuar trabajando.',
    s_overtime_consequence:'Sin una extensión aceptada por la familia, tu tiempo adicional no será pagado. Es por tu propio interés respetar este flujo: protege tus ingresos.',
    s_overtime_how:'Cómo: pide a la familia que te envíe una solicitud de extensión desde su pantalla de reserva. Recibirás la solicitud directamente en la pantalla del trabajo activo y podrás aceptarla o rechazarla.',
    s_overtime_ack:'Entendido, continuar →',
    id_title:'Identificacion oficial (anverso y reverso)', id_sub:'Pasaporte, licencia o ID estatal. JPG, PNG o PDF.',
    id_btn:'📤 Subir mi identificacion', id_done:'✅ Documento cargado  -  clic para reemplazar',
    id_secure:'🔒 Cifrado y seguro. Nunca compartido con las familias.',
    id_skip:'Omitir por ahora',
    s5_title:'💳 Configura tus pagos', s5_sub:'Para recibir pagos automaticamente.',
    stripe_speed:'Pagos rapidos', stripe_speed_s:'En tu cuenta en 2 dias',
    stripe_sec:'Protegido por Stripe', stripe_sec_s:'El estandar mundial de pagos',
    stripe_pct:'Quedate con el 88%', stripe_pct_s:'Solo 12% de comision',
    stripe_btn:'🔗 Conectar mi cuenta bancaria', stripe_later:'Omitir  -  configurar despues',
    stripe_open:'Abrir Stripe →', stripe_done:'✅ Listo  -  Finalizar mi perfil',
    stripe_final_title:'Finaliza en Stripe', stripe_final_sub:'Configura tus datos bancarios via Stripe Express.',
    next:'Continuar →', back:'← Volver', upload:'⏳ Subiendo...',
    saving:'⏳ Guardando...', connecting:'⏳ Conectando...',
  },
}

function ProgressBar({ step, total, tx }) {
  return (
    <div style={{ padding:'16px 20px 8px', background:'white', borderBottom:'1px solid #f3f4f6' }}>
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'#9ca3af', marginBottom:8 }}>
        <span style={{ fontWeight:700, color:'#111827' }}>{tx.step} {step}/{total}</span>
        <span>{Math.round((step/total)*100)}{tx.pct}</span>
      </div>
      <div style={{ background:'#e5e7eb', borderRadius:99, height:6, overflow:'hidden' }}>
        <div style={{ background:G, height:'100%', borderRadius:99,
          width:`${(step/total)*100}%`, transition:'width .4s ease' }} />
      </div>
    </div>
  )
}

export default function WorkerOnboarding({ userId, onComplete, lang: langProp }) {
  const [lang] = useState(() => langProp || detectLang())
  const tx = T[lang] || T.en

  const SAVE_KEY = `nynly_onboarding_${userId}`
  const saved = (() => { try { return JSON.parse(localStorage.getItem(SAVE_KEY) || '{}') } catch(_e) { return {} } })()

  // Init du step avec compatibilité rétro : un worker qui avait sauvegardé
  // step=7 dans l'ancienne numérotation (où 7=Stripe) restera à 7 dans la
  // nouvelle numérotation (où 7=Guide, 8=Stripe). Ce n'est pas grave : il
  // relira le guide avant Stripe, ce qui est le comportement attendu.
  const [step,           setStep]           = useState(saved.step || 1)
  const [saving,         setSaving]         = useState(false)
  const [error,          setError]          = useState(null)
  const [bio,            setBio]            = useState(saved.bio || '')
  const [phone,          setPhone]          = useState(saved.phone || '')
  const [city,           setCity]           = useState(saved.city || '')
  const [cityMeta,       setCityMeta]       = useState(null)
  const [services,       setServices]       = useState(saved.services || [])
  const [serviceRates,   setServiceRates]   = useState(saved.serviceRates || {})
  const [location,       setLocation]       = useState(saved.location || 'at_client')
  const [photoUrl,       setPhotoUrl]       = useState(saved.photoUrl || null)
  const [videoUrl,       setVideoUrl]       = useState(saved.videoUrl || '')
  const [idDocUrl,       setIdDocUrl]       = useState(saved.idDocUrl || null)
  const [idDocUrlBack,   setIdDocUrlBack]   = useState(saved.idDocUrlBack || null)
  const [checkrMode,     setCheckrMode]     = useState(null)
  const [checkrDocUrl,   setCheckrDocUrl]   = useState(null)
  const [uploadingCheckr,setUploadingCheckr]= useState(false)
  const [stripeUrl,      setStripeUrl]      = useState(null)
  const [videoProgress,  setVideoProgress]  = useState(0)

  // ── Champs détaillés ──
  const [languages,   setLanguages]   = useState(saved.languages || [])
  const [ageRanges,   setAgeRanges]   = useState(saved.ageRanges || [])
  const [petTypes,    setPetTypes]    = useState(saved.petTypes || [])
  const [handySkills, setHandySkills] = useState(saved.handySkills || [])
  const [svcSkills,   setSvcSkills]   = useState(saved.svcSkills || {
    childcare:[], seniorcare:[], cleaning:[], lawn:[], errands:[], hairdresser:[],
    tutoring:[], fitness:[], housesitting:[],
  })
  function toggleSvcSkill(group, id) {
    setSvcSkills(prev => ({
      ...prev,
      [group]: (prev[group] || []).includes(id)
        ? prev[group].filter(x => x !== id)
        : [...(prev[group] || []), id],
    }))
  }

  const photoRef     = useRef()
  const videoInputRef= useRef(null)
  const idDocRef     = useRef()
  const idDocBackRef = useRef()

  const optLabel = opt => lang === 'fr' ? opt.fr : lang === 'es' ? opt.es : opt.en
  const toggleIn = setter => id =>
    setter(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  function saveProgress(updates = {}) {
    const data = { step, bio, phone, city, services, serviceRates, location, photoUrl, videoUrl, idDocUrl, idDocUrlBack, languages, ageRanges, petTypes, handySkills, svcSkills, ...updates }
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)) } catch(_e) {}
  }

  function toggleService(id) {
    setServices(p => p.includes(id) ? p.filter(s => s !== id) : [...p, id])
  }

  async function uploadFile(file, bucket, folder) {
    const ext  = file.name.split('.').pop().toLowerCase()
    // Bucket 'documents' : RLS exige que le 1er segment du path = auth.uid()
    const path = bucket === 'documents'
      ? `${userId}/${folder}/${Date.now()}.${ext}`
      : `${folder}/${userId}-${Date.now()}.${ext}`
    const { error: e } = await supabase.storage.from(bucket).upload(path, file)
    if (e) throw e
    if (bucket === 'documents') return path
    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
  }

  async function uploadVideoCloudinary(file) {
    const cloudName   = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
    const uploadPreset= import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'nynly_videos'

    if (!cloudName) throw new Error('VITE_CLOUDINARY_CLOUD_NAME manquant dans Vercel')

    const formData = new FormData()
    formData.append('file', file)
    formData.append('upload_preset', uploadPreset)
    formData.append('folder', 'nynly/videos')
    formData.append('resource_type', 'video')

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`)

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          setVideoProgress(Math.round((e.loaded / e.total) * 100))
        }
      }

      xhr.onload = () => {
        if (xhr.status === 200) {
          const data = JSON.parse(xhr.responseText)
          resolve(data.secure_url)
        } else {
          reject(new Error(`Cloudinary error: ${xhr.status}`))
        }
      }

      xhr.onerror = () => reject(new Error('Network error during upload'))
      xhr.send(formData)
    })
  }

  async function handleVideoUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.toLowerCase().startsWith('video/')) {
      setError(lang==='fr' ? 'Format non supporte. Utilisez MP4 ou MOV.'
               : lang==='es' ? 'Formato no compatible. Use MP4 o MOV.'
               : 'Unsupported format. Use MP4 or MOV.')
      return
    }

    setSaving(true)
    setError(null)
    setVideoProgress(0)

    try {
      const url = await uploadVideoCloudinary(file)
      setVideoUrl(url)
      setVideoProgress(100)
      await supabase.from('profiles').update({ video_url: url }).eq('id', userId)
    } catch (err) {
      setError(lang==='fr' ? `Erreur upload: ${err.message}`
               : lang==='es' ? `Error al subir: ${err.message}`
               : `Upload error: ${err.message}`)
      setVideoProgress(0)
    }

    setSaving(false)
    if (videoInputRef.current) videoInputRef.current.value = ''
  }

  async function handlePhotoUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const MAX = 8 * 1024 * 1024
    const OK  = ['image/jpeg','image/jpg','image/png','image/webp','image/heic','image/heif']
    if (file.size > MAX) { setError(lang==='fr' ? `Photo trop lourde. Maximum 8 MB.` : 'Photo too large. Max 8 MB.'); return }
    if (!OK.includes(file.type.toLowerCase())) { setError(lang==='fr' ? 'Format non supporte. JPG, PNG ou WEBP.' : 'Use JPG, PNG or WEBP.'); return }
    setSaving(true); setError(null)
    try {
      const url = await uploadFile(file, 'avatars', 'workers')
      setPhotoUrl(url)
      await supabase.from('profiles').update({ avatar_url: url }).eq('id', userId)
    } catch (err) { setError(err.message) }
    setSaving(false)
  }

  async function handleExistingCheckrUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingCheckr(true)
    try {
      const ext  = file.name.split('.').pop()
      const path = `${userId}/checkr/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('documents').upload(path, file)
      if (upErr) throw upErr
      setCheckrDocUrl(path)
      await supabase.functions.invoke('background-check', {
        body: { action: 'upload_existing_checkr', worker_id: userId, doc_path: path }
      })
    } catch (err) { console.warn('[Checkr]', err?.message) }
    setUploadingCheckr(false)
    if (e.target) e.target.value = ''
  }

  async function handleIdDocUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const MAX = 15 * 1024 * 1024
    const OK  = ['image/jpeg','image/jpg','image/png','image/webp','image/heic','image/heif','application/pdf']
    if (file.size > MAX) { setError(lang==='fr' ? 'Document trop lourd. Maximum 15 MB.' : 'Document too large. Max 15 MB.'); if (e.target) e.target.value = ''; return }
    if (!OK.includes(file.type.toLowerCase())) { setError(lang==='fr' ? 'Format non supporte. JPG, PNG ou PDF.' : 'Use JPG, PNG or PDF.'); if (e.target) e.target.value = ''; return }
    setSaving(true); setError(null)
    try { setIdDocUrl(await uploadFile(file, 'documents', 'identity')) }
    catch (err) { setError(err.message) }
    setSaving(false)
    if (e.target) e.target.value = ''
  }

  async function handleIdDocBackUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const MAX = 15 * 1024 * 1024
    const OK  = ['image/jpeg','image/jpg','image/png','image/webp','image/heic','image/heif','application/pdf']
    if (file.size > MAX) { setError(lang==='fr' ? 'Document trop lourd. Maximum 15 MB.' : 'Document too large. Max 15 MB.'); if (e.target) e.target.value = ''; return }
    if (!OK.includes(file.type.toLowerCase())) { setError(lang==='fr' ? 'Format non supporte. JPG, PNG ou PDF.' : 'Use JPG, PNG or PDF.'); if (e.target) e.target.value = ''; return }
    setSaving(true); setError(null)
    try { setIdDocUrlBack(await uploadFile(file, 'documents', 'identity-back')) }
    catch (err) { setError(err.message) }
    setSaving(false)
    if (e.target) e.target.value = ''
  }

  async function initiateStripeConnect() {
    setSaving(true)
    try {
      const { data } = await supabase.functions.invoke('stripe-connect-onboard', { body: { worker_id: userId } })
      setStripeUrl(data?.url || 'https://connect.stripe.com/setup/test')
    } catch(_e) { setStripeUrl('https://connect.stripe.com/setup/test') }
    setSaving(false)
  }

  async function handleFinish() {
    setSaving(true); setError(null)
    try {
      const needsCheck = services.some(s => SERVICES.find(sv => sv.id === s)?.check)
      const countryCode = cityMeta?.country || (lang === 'fr' ? 'FR' : 'US')
      const coords = cityMeta
        ? { latitude: cityMeta.lat, longitude: cityMeta.lng }
        : await geocodeCity(city, countryCode)

      const updatePayload = {
        bio, phone, city,
        services_offered:        services,
        service_rates:           serviceRates,
        hourly_rate:             Math.round(Object.values(serviceRates).reduce((s,v)=>s+parseFloat(v||0),0)/Math.max(Object.values(serviceRates).length,1)) || 20,
        service_location:        location,
        onboarding_complete:     true,
        is_active:               true,
        detected_country:        countryCode,
        detected_city_slug:      city.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, ''),
        background_check_status: needsCheck ? 'pending' : 'not_required',
        updated_at:              new Date().toISOString(),
        languages:               languages,
        childcare_age_ranges:    ageRanges,
        pet_types:               petTypes,
        handyman_skills:         handySkills,
        childcare_skills:        svcSkills.childcare   || [],
        seniorcare_skills:       svcSkills.seniorcare  || [],
        cleaning_skills:         svcSkills.cleaning    || [],
        lawn_skills:             svcSkills.lawn        || [],
        errands_skills:          svcSkills.errands     || [],
        hairdresser_skills:      svcSkills.hairdresser || [],
        tutoring_skills:         svcSkills.tutoring    || [],
        fitness_skills:          svcSkills.fitness     || [],
        housesitting_skills:     svcSkills.housesitting || [],
      }
      if (coords) {
        updatePayload.latitude  = coords.latitude
        updatePayload.longitude = coords.longitude
      }

      const { error: profileError } = await supabase.from('profiles')
        .update(updatePayload).eq('id', userId)

      if (profileError) throw profileError

      if (idDocUrl) {
        supabase.from('license_verifications').insert({
          worker_id: userId, country_code: countryCode,
          license_type: 'identity_document',
          document_url: idDocUrl,
          document_url_back: idDocUrlBack || null,
          status: 'pending',
        }).then(() => {}).catch(() => {})

        if (needsCheck) {
          supabase.functions.invoke('background-check', {
            body: { action: 'initiate_checkr', worker_id: userId }
          }).catch(() => {})
        }
      }

      supabase.functions.invoke('worker-nurture-agent', {
        body: { trigger: 'new_worker_signup', worker_id: userId }
      }).catch(() => {})

      const { data: updated } = await supabase
        .from('profiles').select('*').eq('id', userId).single()

      try { localStorage.removeItem(SAVE_KEY) } catch(_e) {}
      onComplete?.(updated || { id: userId, onboarding_complete: true })

    } catch (err) { setError(err.message) }
    setSaving(false)
  }

  function next(nextStep) { saveProgress({ step: nextStep }); setError(null); setStep(nextStep) }

  const wrap = (children) => (
    <div style={{ minHeight:'100vh', background:'#f9fafb', fontFamily:"'Poppins',system-ui,sans-serif" }}>
      <ProgressBar step={step} total={8} tx={tx} />
      <div style={{ padding:'24px 20px' }}>
        {children}
        {error && <ErrBox msg={error} />}
      </div>
    </div>
  )

  // ── ETAPE 1 ────────────────────────────────────────────────────
  if (step === 1) return wrap(<>
    <h2 style={h2}>{tx.s1_title}</h2>
    <p style={sub}>{tx.s1_sub}</p>
    <label style={lbl}>{tx.city_lbl}</label>
    <div style={{ marginBottom:14 }}>
      <CityAutocomplete
        value={city}
        onChange={setCity}
        onSelect={(c) => { setCity(c.city); setCityMeta(c) }}
        placeholder={tx.city_ph}
        lang={lang}
      />
    </div>
    <label style={lbl}>{tx.phone_lbl}</label>
    <input value={phone} onChange={e=>setPhone(e.target.value)} placeholder={tx.phone_ph} style={{ ...inp, marginBottom:14 }} />

    <label style={lbl}>{tx.langs_lbl}</label>
    <div style={{ fontSize:11, color:'#9ca3af', marginBottom:8 }}>{tx.langs_hint}</div>
    <ChipRow options={LANG_OPTIONS} value={languages}
      onToggle={toggleIn(setLanguages)} getLabel={o => o.label} />

    <label style={lbl}>{tx.bio_lbl}</label>
    <textarea value={bio} onChange={e=>setBio(e.target.value)} rows={4}
      placeholder={tx.bio_ph} style={{ ...inp, resize:'vertical', marginBottom:4 }} />
    <div style={{ fontSize:10, color:bio.length>=50?G:'#9ca3af', marginBottom:24 }}>{bio.length}/50 {tx.bio_min}</div>
    <Btn label={tx.next} disabled={!city||bio.length<50} onClick={()=>next(2)} />
  </>)

  // ── ETAPE 2 ────────────────────────────────────────────────────
  if (step === 2) return wrap(<>
    <h2 style={h2}>{tx.s2_title}</h2>
    <p style={sub}>{tx.s2_sub}</p>
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:20 }}>
      {SERVICES_SHOWN.map(svc => {
        const sel = services.includes(svc.id)
        const meta = SERVICE_META[svc.id]
        return (
          <button key={svc.id} onClick={()=>toggleService(svc.id)}
            style={{ padding:'14px 10px', borderRadius:14, textAlign:'center',
              border:`2px solid ${sel?G:'#e5e7eb'}`, background:sel?TK.primaryTint:'white',
              cursor:'pointer', fontFamily:'inherit', transition:'all .15s' }}>
            <div style={{ display:'flex', justifyContent:'center', marginBottom:8 }}>
              <Icon name={meta?.icon || 'clipboard'} size={24}
                color={sel ? TK.primaryDark : (meta?.color || '#6b7280')} />
            </div>
            <div style={{ fontSize:12, fontWeight:700, color:'#111827' }}>{lang==='fr'?svc.fr:svc.en}</div>
            {svc.check && <div style={{ fontSize:9, color:'#9ca3af', marginTop:3 }}>{tx.check_req}</div>}
          </button>
        )
      })}
    </div>
    {services.length > 0 && (
      <div style={{ marginBottom:20 }}>
        <label style={lbl}>{tx.rate_lbl}</label>
        <div style={{ fontSize:11, color:'#9ca3af', marginBottom:12 }}>{tx.rate_hint}</div>
        {services.map(svcId => {
          const svc = SERVICES.find(s => s.id === svcId)
          if (!svc) return null
          const meta = SERVICE_META[svcId]
          return (
            <div key={svcId} style={{ display:'flex', alignItems:'center', gap:10,
              background:'white', border:'1.5px solid #e5e7eb', borderRadius:12,
              padding:'10px 14px', marginBottom:8 }}>
              <Icon name={meta?.icon || 'clipboard'} size={18} color={meta?.color || '#6b7280'} />
              <span style={{ fontSize:13, fontWeight:600, color:'#374151', flex:1 }}>
                {lang==='fr' ? svc.fr : svc.en}
              </span>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <input type="number"
                  value={serviceRates[svcId] || ''}
                  onChange={e => setServiceRates(prev => ({ ...prev, [svcId]: e.target.value }))}
                  placeholder={lang==='fr'?'Tarif':lang==='es'?'Tarifa':'Rate'}
                  min="5" max="500"
                  style={{ width:70, padding:'8px 10px', border:'1.5px solid #e5e7eb',
                    borderRadius:10, fontSize:13, fontFamily:"'Poppins',sans-serif",
                    outline:'none', textAlign:'center' }} />
                <span style={{ fontSize:12, color:'#6b7280', whiteSpace:'nowrap' }}>
                  {lang==='fr'?'€':'$'}{tx.rate_unit}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    )}

    {(services.includes('childcare') || services.includes('nanny')) && (
      <div style={{ marginBottom:4 }}>
        <label style={lbl}>{tx.ages_lbl}</label>
        <ChipRow options={AGE_OPTIONS} value={ageRanges}
          onToggle={toggleIn(setAgeRanges)} getLabel={optLabel} />
      </div>
    )}

    {services.includes('petsitter') && (
      <div style={{ marginBottom:4 }}>
        <label style={lbl}>{tx.pets_lbl}</label>
        <ChipRow options={PET_OPTIONS} value={petTypes}
          onToggle={toggleIn(setPetTypes)} getLabel={optLabel} />
      </div>
    )}

    {services.includes('handyman') && (
      <div style={{ marginBottom:4 }}>
        <label style={lbl}>{tx.handy_lbl}</label>
        <ChipRow options={HANDY_OPTIONS} value={handySkills}
          onToggle={toggleIn(setHandySkills)} getLabel={optLabel} />
        <div style={{ fontSize:10.5, color:'#9ca3af', marginTop:-8, marginBottom:12, lineHeight:1.5 }}>
          {tx.handy_hint}
        </div>
      </div>
    )}

    {[
      { g:'childcare',   show: services.includes('childcare') || services.includes('nanny') },
      { g:'seniorcare',  show: services.includes('seniorcare') },
      { g:'cleaning',    show: services.includes('cleaning') },
      { g:'lawn',        show: services.includes('lawn') },
      { g:'errands',     show: services.includes('errands') },
      { g:'hairdresser', show: services.includes('hairdresser') },
      { g:'tutoring',    show: services.includes('tutoring') },
      { g:'fitness',     show: services.includes('fitness') },
      { g:'housesitting',show: services.includes('housesitting') },
    ].filter(x => x.show).map(({ g }) => {
      const grp = SKILL_GROUPS[g]
      return (
        <div key={g} style={{ marginBottom:4 }}>
          <label style={lbl}>{grp.label[lang === 'fr' ? 'fr' : lang === 'es' ? 'es' : 'en']}</label>
          <ChipRow options={grp.options} value={svcSkills[g] || []}
            onToggle={id => toggleSvcSkill(g, id)} getLabel={optLabel} />
          {g === 'seniorcare' && (
            <div style={{ fontSize:10.5, color:'#9ca3af', marginTop:-8, marginBottom:12, lineHeight:1.5 }}>
              {lang==='fr'
                ? 'Aide non médicale uniquement (companion care). Soins personnels et administration de médicaments exclus.'
                : lang==='es'
                ? 'Solo ayuda no médica. Cuidados personales y administración de medicamentos excluidos.'
                : 'Non-medical companion care only. Personal care and medication administration excluded.'}
            </div>
          )}
          {g === 'hairdresser' && (
            <div style={{ fontSize:10.5, color:'#9ca3af', marginTop:-8, marginBottom:12, lineHeight:1.5 }}>
              {lang==='fr'
                ? 'Coupes : licence de cosmétologie Floride requise. Tresses : aucune licence. Pas de services chimiques à domicile.'
                : lang==='es'
                ? 'Cortes: licencia de cosmetología de Florida requerida. Trenzas: sin licencia. Sin servicios químicos a domicilio.'
                : 'Haircuts: Florida cosmetology license required. Braiding: no license needed. No chemical services at home.'}
            </div>
          )}
        </div>
      )
    })}

    <label style={lbl}>{tx.loc_lbl}</label>
    <ServiceLocationSelector value={location} countryCode={lang==='fr'?'FR':'US'} onChange={setLocation} lang={lang} />
    <div style={{ display:'flex', gap:8, marginTop:20 }}>
      <BackBtn label={tx.back} onClick={()=>setStep(1)} />
      <Btn label={tx.next} disabled={services.length===0||services.some(s=>!serviceRates[s])} onClick={()=>next(3)} />
    </div>
  </>)

  // ── ETAPE 3 - Photo ────────────────────────────────────────────
  if (step === 3) return wrap(<>
    <h2 style={h2}>{tx.s3_title}</h2>
    <p style={sub}>{tx.s3_sub}</p>
    <div style={{ textAlign:'center', marginBottom:24 }}>
      {photoUrl
        ? <img src={photoUrl} alt="profile" style={{ width:120, height:120, borderRadius:'50%', objectFit:'cover', border:`3px solid ${G}` }} />
        : <div style={{ width:120, height:120, borderRadius:'50%', background:'#e5e7eb', margin:'0 auto',
            display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Icon name="user" size={48} color="#9ca3af" />
          </div>
      }
      <input ref={photoRef} type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display:'none' }} />
      <button onClick={()=>photoRef.current?.click()}
        style={{ display:'block', margin:'12px auto 0',
          background:photoUrl?TK.primaryTint:G, border:photoUrl?`1.5px solid ${G}`:'none',
          color:photoUrl?TK.primaryDark:'white', borderRadius:12, padding:'10px 20px',
          fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>
        {saving ? tx.upload : photoUrl ? tx.photo_chg : tx.photo_btn}
      </button>
    </div>
    <div style={{ background:'#fffbeb', border:'1.5px solid #fde68a', borderRadius:12,
      padding:'12px 14px', fontSize:12, color:'#92400e', marginBottom:24 }}>
      {tx.photo_tip}
    </div>
    <div style={{ display:'flex', gap:8 }}>
      <BackBtn label={tx.back} onClick={()=>setStep(2)} />
      <Btn label={photoUrl ? tx.next : tx.photo_skip} disabled={false} onClick={()=>next(4)} />
    </div>
  </>)

  // ── ETAPE 4 - Video ────────────────────────────────────────────
  const needsVideo = false

  if (step === 4) return wrap(<>
    <h2 style={h2}>{tx.video_title}</h2>
    <p style={sub}>{needsVideo ? tx.video_required_note : tx.video_optional_note}</p>
    <p style={{ ...sub, marginTop:-8, fontSize:11, color:'#6b7280', lineHeight:1.6 }}>{tx.video_sub}</p>

    <div style={{ textAlign:'center', marginBottom:20 }}>
      {videoUrl ? (
        <div style={{ position:'relative', borderRadius:16, overflow:'hidden',
          background:'#000', maxWidth:280, margin:'0 auto', aspectRatio:'9/16', maxHeight:200 }}>
          <video src={videoUrl} controls playsInline style={{ width:'100%', height:'100%', objectFit:'cover' }} />
          <div style={{ position:'absolute', top:8, right:8 }}>
            <span style={{ background:G, color:'white', borderRadius:99, padding:'3px 10px', fontSize:10, fontWeight:700 }}>
              ✅ {lang==='fr'?'Video ajoutee':lang==='es'?'Video agregado':'Video added'}
            </span>
          </div>
        </div>
      ) : (
        <div style={{ width:120, height:180, borderRadius:16, background:TK.ink,
          margin:'0 auto', display:'flex', flexDirection:'column',
          alignItems:'center', justifyContent:'center', gap:8, border:'2px dashed #4B4865' }}>
          <Icon name="video" size={32} color="rgba(255,255,255,.7)" />
          <div style={{ fontSize:10, color:'#9ca3af', textAlign:'center', padding:'0 8px' }}>
            {lang==='fr'?'30-60 sec':'30-60 sec'}
          </div>
        </div>
      )}

      {saving && videoProgress > 0 && videoProgress < 100 && (
        <div style={{ margin:'12px auto 0', maxWidth:280 }}>
          <div style={{ background:'#e5e7eb', borderRadius:99, height:6, overflow:'hidden' }}>
            <div style={{ background:G, height:'100%', borderRadius:99,
              width:`${videoProgress}%`, transition:'width .3s ease' }} />
          </div>
          <div style={{ fontSize:10, color:'#9ca3af', marginTop:4 }}>{videoProgress}%</div>
        </div>
      )}

      <input ref={videoInputRef} type="file"
        accept="video/mp4,video/quicktime,video/mov,video/webm,video/*"
        onChange={handleVideoUpload} style={{ display:'none' }} />
      <button onClick={()=>videoInputRef.current?.click()} disabled={saving}
        style={{ display:'block', margin:'12px auto 0',
          background:videoUrl?TK.primaryTint:TK.ink,
          border:videoUrl?`1.5px solid ${G}`:'none',
          color:videoUrl?TK.primaryDark:'white',
          borderRadius:12, padding:'12px 24px',
          fontWeight:700, fontSize:14, cursor:saving?'wait':'pointer', fontFamily:'inherit' }}>
        {saving ? tx.video_uploading : videoUrl ? tx.video_chg : tx.video_btn}
      </button>
    </div>

    <div style={{ background:'#fffbeb', border:'1.5px solid #fde68a', borderRadius:12,
      padding:'12px 14px', fontSize:12, color:'#92400e', marginBottom:20 }}>
      {tx.video_tip}
    </div>

    <div style={{ display:'flex', gap:8 }}>
      <BackBtn label={tx.back} onClick={()=>setStep(3)} />
      <Btn label={videoUrl ? tx.video_next : (needsVideo ? tx.video_btn : tx.video_skip)}
        disabled={needsVideo && !videoUrl} onClick={()=>next(5)} />
    </div>
  </>)

  // ── ETAPE 5 - Identite ─────────────────────────────────────────
  if (step === 5) {
    const isFranceMarket = cityMeta?.country === 'FR' || (!cityMeta && lang === 'fr')

    return wrap(<>
    <h2 style={h2}>{tx.s4_title}</h2>
    <p style={sub}>{tx.s4_sub}</p>

    {services.some(s => SERVICES.find(sv=>sv.id===s)?.check) && (
      <div style={{ marginBottom:20 }}>
        <div style={{ fontWeight:700, fontSize:13, color:'#374151', marginBottom:12 }}>
          🔍 {lang==='fr'?'Vérification d\'antécédents requise':lang==='es'?'Verificación de antecedentes requerida':'Background check required'}
        </div>

        {/* MARCHÉ US : Checkr disponible depuis le Profil (feature proactive) */}
        {!isFranceMarket && (
          <div style={{ background:'rgba(59,130,246,.06)', border:'1.5px solid rgba(59,130,246,.2)',
            borderRadius:12, padding:14, lineHeight:1.7 }}>
            <div style={{ fontSize:13, color:'#1e40af', fontWeight:700, marginBottom:8 }}>
              🔐 {lang==='fr'?'Vérification d\'antécédents Checkr'
                   :lang==='es'?'Verificación de antecedentes Checkr'
                   :'Checkr background check'}
            </div>
            <div style={{ fontSize:12, color:'#374151', marginBottom:12 }}>
              {lang==='fr'
                ?'Pour accepter des missions, une vérification Checkr validée est requise ($69, entièrement récupéré sur vos premières commissions). Elle prend 24 à 72h.'
                :lang==='es'
                ?'Para aceptar misiones, se requiere una verificación Checkr ($69, recuperado en sus primeras comisiones). Toma 24-72h.'
                :'To accept jobs, a validated Checkr verification is required ($69, fully recovered through your first commissions). Takes 24-72h.'}
            </div>

            <div style={{ background:'rgba(245,158,11,.1)', border:'1.5px solid rgba(245,158,11,.4)',
              borderRadius:10, padding:'12px 14px' }}>
              <div style={{ fontSize:12.5, color:'#92400e', fontWeight:800, marginBottom:6 }}>
                ⏱️ {lang==='fr'?'À faire depuis votre profil, au moins 72h avant votre première mission'
                     :lang==='es'?'Hacerlo desde su perfil, al menos 72h antes de su primera misión'
                     :'To do from your profile, at least 72h before your first job'}
              </div>
              <div style={{ fontSize:11.5, color:'#78350f', lineHeight:1.7 }}>
                {lang==='fr'
                  ?'Une fois inscrit, allez dans votre profil et cliquez sur « Lancer ma vérification ». Sans cela, vous ne pourrez pas accepter les demandes à court terme (moins de 72h) — et une famille pressée choisira quelqu\'un d\'autre.'
                  :lang==='es'
                  ?'Después de registrarse, vaya a su perfil y haga clic en «Iniciar verificación». Sin esto, no podrá aceptar solicitudes a corto plazo (menos de 72h).'
                  :'Once signed up, go to your profile and click "Start my verification". Without this, you won\'t be able to accept short-notice requests (less than 72h).'}
              </div>
            </div>
          </div>
        )}

        {/* MARCHÉ FR (dormant) : flow B3 upload manuel conservé pour si on réactive */}
        {isFranceMarket && (
          <>
            {!checkrMode && (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                <div style={{ background:'rgba(108,99,255,.08)', border:'1.5px solid rgba(108,99,255,.3)',
                  borderRadius:12, padding:'12px 16px' }}>
                  <div style={{ fontWeight:700, fontSize:13, color:TK.primaryDark, marginBottom:4 }}>
                    {lang==='fr'?'✅ J\'ai déjà un extrait de casier B3'
                     :lang==='es'?'✅ Ya tengo un certificado de antecedentes'
                     :'✅ I already have a B3 criminal record extract'}
                  </div>
                  <div style={{ fontSize:11, color:'#6b7280', marginBottom:10 }}>
                    {lang==='fr'?'PDF ou image. Max 10 MB. Validation admin sous 24h.'
                     :lang==='es'?'PDF o imagen. Máx 10 MB. Validación admin en 24h.'
                     :'PDF or image. Max 10 MB. Admin validates within 24h.'}
                  </div>
                  {!checkrDocUrl ? (<>
                    <input type="file" accept="application/pdf,image/*" id="checkr-existing-btn"
                      style={{ display:'none' }} onChange={handleExistingCheckrUpload} />
                    <label htmlFor="checkr-existing-btn"
                      style={{ display:'block', textAlign:'center', padding:'10px 16px',
                        background:G, borderRadius:10, cursor:'pointer',
                        fontSize:13, fontWeight:700, color:'white', fontFamily:'inherit' }}>
                      {uploadingCheckr ? '⏳...'
                        : lang==='fr'?'📎 Charger mon casier B3'
                        : lang==='es'?'📎 Subir certificado':'📎 Upload my B3 extract'}
                    </label>
                  </>) : (
                    <div style={{ fontSize:12, color:TK.primaryDark, fontWeight:600 }}>
                      ✅ {lang==='fr'?'Envoyé — validation sous 24h'
                         :lang==='es'?'Enviado — validación en 24h'
                         :'Sent — validation within 24h'}
                    </div>
                  )}
                </div>
                <button onClick={()=>setCheckrMode('new')}
                  style={{ background:'#f9fafb', border:'1.5px solid #e5e7eb',
                    borderRadius:12, padding:'12px 16px', cursor:'pointer', fontFamily:'inherit', textAlign:'left' }}>
                  <div style={{ fontWeight:700, fontSize:13, color:'#111827', marginBottom:2 }}>
                    {lang==='fr'?'🆕 Obtenir mon casier B3 (gratuit)'
                     :lang==='es'?'🆕 Obtener mi certificado B3'
                     :'🆕 Get my B3 extract (free)'}
                  </div>
                  <div style={{ fontSize:11, color:'#9ca3af' }}>
                    {lang==='fr'?'Gratuit sur justice.fr. Délai : 24-72h.'
                     :lang==='es'?'Gratis en justice.fr. Resultado 24-72h.'
                     :'Free on justice.fr. Result 24-72h.'}
                  </div>
                </button>
              </div>
            )}

            {checkrMode === 'new' && (
              <div style={{ background:'rgba(59,130,246,.08)', border:'1.5px solid rgba(59,130,246,.2)', borderRadius:12, padding:14 }}>
                <div style={{ fontSize:12, color:'#2563eb', lineHeight:1.7 }}>
                  {lang==='fr'
                    ?'✅ Demandez votre extrait de casier B3 sur justice.fr (gratuit). Uploadez-le ensuite depuis votre profil.'
                    :lang==='es'
                    ?'✅ Solicite su certificado B3 en justice.fr (gratis). Súbalo después desde su perfil.'
                    :'✅ Request your B3 extract on justice.fr (free). Upload it later from your profile.'}
                </div>
                <button onClick={()=>setCheckrMode(null)}
                  style={{ background:'none', border:'none', color:'#6B7280', fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>
                  {lang==='fr'?'← Changer':lang==='es'?'← Cambiar':'← Change'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    )}

    <div style={{ background:'white', border:'1.5px solid #e5e7eb', borderRadius:14, padding:16, marginBottom:16 }}>
      <div style={{ fontWeight:700, fontSize:13, color:'#111827', marginBottom:6 }}>{tx.id_title}</div>
      <div style={{ fontSize:11, color:'#9ca3af', marginBottom:12 }}>{tx.id_sub}</div>

      <div style={{ marginBottom:10 }}>
        <div style={{ fontSize:11, fontWeight:700, color:'#6b7280',
          textTransform:'uppercase', letterSpacing:'.07em', marginBottom:6 }}>
          {lang==='fr'?'Recto':lang==='es'?'Anverso':'Front'}
        </div>
        <input ref={idDocRef} type="file" accept="image/*,.pdf" onChange={handleIdDocUpload} style={{ display:'none' }} />
        <button type="button" onClick={()=>idDocRef.current?.click()}
          style={{ width:'100%', background:idDocUrl?TK.primaryTint:'#f9fafb',
            border:`1.5px solid ${idDocUrl?G:'#e5e7eb'}`,
            color:idDocUrl?TK.primaryDark:'#374151', borderRadius:10, padding:'10px 16px',
            fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'inherit', textAlign:'left' }}>
          {saving ? tx.upload : idDocUrl
            ? (lang==='fr'?'✅ Recto charge  -  cliquer pour remplacer':lang==='es'?'✅ Anverso cargado':'✅ Front uploaded  -  click to replace')
            : (lang==='fr'?'📤 Charger le recto':lang==='es'?'📤 Subir anverso':'📤 Upload front')}
        </button>
      </div>

      <div>
        <div style={{ fontSize:11, fontWeight:700, color:'#6b7280',
          textTransform:'uppercase', letterSpacing:'.07em', marginBottom:6 }}>
          {lang==='fr'?'Verso':lang==='es'?'Reverso':'Back'}
        </div>
        <input ref={idDocBackRef} type="file" accept="image/*,.pdf" onChange={handleIdDocBackUpload} style={{ display:'none' }} />
        <button type="button" onClick={()=>idDocBackRef.current?.click()}
          style={{ width:'100%', background:idDocUrlBack?TK.primaryTint:'#f9fafb',
            border:`1.5px solid ${idDocUrlBack?G:'#e5e7eb'}`,
            color:idDocUrlBack?TK.primaryDark:'#374151', borderRadius:10, padding:'10px 16px',
            fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'inherit', textAlign:'left' }}>
          {saving ? tx.upload : idDocUrlBack
            ? (lang==='fr'?'✅ Verso charge  -  cliquer pour remplacer':lang==='es'?'✅ Reverso cargado':'✅ Back uploaded  -  click to replace')
            : (lang==='fr'?'📤 Charger le verso':lang==='es'?'📤 Subir reverso':'📤 Upload back')}
        </button>
      </div>
    </div>

    <div style={{ background:TK.ink, borderRadius:12, padding:'12px 14px',
      fontSize:11, color:'#B6B1FF', marginBottom:16, lineHeight:1.6 }}>
      {tx.id_secure}
    </div>

    <div style={{ background:'#fffbeb', border:'1.5px solid #fde68a', borderRadius:10,
      padding:'10px 14px', fontSize:11, color:'#92400e', marginBottom:16, lineHeight:1.6 }}>
      💡 {lang==='fr'?'Vous pouvez completer ceci plus tard depuis votre profil.'
          :lang==='es'?'Puedes completar esto mas tarde desde tu perfil.'
          :'You can complete this later from your profile.'}
    </div>

    <div style={{ display:'flex', gap:8 }}>
      <BackBtn label={tx.back} onClick={()=>setStep(4)} />
      <Btn label={idDocUrl ? tx.next : tx.id_skip} disabled={false} onClick={()=>next(6)} />
    </div>
  </>)
  }

  // ── ETAPE 6 - Pédagogique : gestion des dépassements ──────────
  if (step === 6) return wrap(<>
    <h2 style={h2}>{tx.s_overtime_title}</h2>
    <p style={sub}>{tx.s_overtime_sub}</p>

    <div style={{ background:'#fffbeb', border:'1.5px solid #fde68a',
      borderRadius:14, padding:'16px 18px', marginBottom:14 }}>
      <div style={{ fontSize:13, color:'#92400e', fontWeight:700, lineHeight:1.6, marginBottom:10 }}>
        ⚠️ {tx.s_overtime_rule}
      </div>
      <div style={{ fontSize:12, color:'#78350f', lineHeight:1.7 }}>
        {tx.s_overtime_consequence}
      </div>
    </div>

    <div style={{ background:'white', border:'1.5px solid #e5e7eb',
      borderRadius:14, padding:'14px 16px', marginBottom:24 }}>
      <div style={{ fontSize:11, fontWeight:700, color:'#6b7280',
        textTransform:'uppercase', letterSpacing:'.07em', marginBottom:8 }}>
        {lang==='fr' ? 'En pratique' : lang==='es' ? 'En la práctica' : 'In practice'}
      </div>
      <div style={{ fontSize:12, color:'#374151', lineHeight:1.7 }}>
        💡 {tx.s_overtime_how}
      </div>
    </div>

    <div style={{ display:'flex', gap:8 }}>
      <BackBtn label={tx.back} onClick={()=>setStep(5)} />
      <Btn label={tx.s_overtime_ack} disabled={false} onClick={()=>next(7)} />
    </div>
  </>)

  // ── ETAPE 7 - Guide du prestataire (PlatformGuide inline) ─────
  if (step === 7) return wrap(<>
    <PlatformGuide role="worker" lang={lang} mode="inline" />
    <div style={{ display:'flex', gap:8, marginTop:16 }}>
      <BackBtn label={tx.back} onClick={()=>setStep(6)} />
      <Btn
        label={lang==='fr' ? "J'ai compris, continuer →" : lang==='es' ? 'Entendido, continuar →' : 'Got it, continue →'}
        disabled={false}
        onClick={()=>next(8)} />
    </div>
  </>)

  // ── ETAPE 8 - Stripe ───────────────────────────────────────────
  if (step === 8) return wrap(<>
    <div style={{ marginBottom:16 }}>
      <BackBtn label={tx.back} onClick={()=>setStep(7)} />
    </div>
    <h2 style={h2}>{tx.s5_title}</h2>
    <p style={sub}>{tx.s5_sub}</p>

    {!stripeUrl ? (<>
      <div style={{ background:'white', border:'1.5px solid #e5e7eb', borderRadius:16, padding:20, marginBottom:20 }}>
        {[
          { icon:'⚡', title:tx.stripe_speed, sub:tx.stripe_speed_s },
          { icon:'🔒', title:tx.stripe_sec,   sub:tx.stripe_sec_s   },
          { icon:'💰', title:tx.stripe_pct,   sub:tx.stripe_pct_s   },
        ].map(item => (
          <div key={item.title} style={{ display:'flex', gap:12, padding:'10px 0', borderBottom:'1px solid #f3f4f6' }}>
            <span style={{ fontSize:24, flexShrink:0 }}>{item.icon}</span>
            <div>
              <div style={{ fontWeight:700, fontSize:13, color:'#111827' }}>{item.title}</div>
              <div style={{ fontSize:11, color:'#9ca3af', marginTop:2 }}>{item.sub}</div>
            </div>
          </div>
        ))}
      </div>
      <button onClick={initiateStripeConnect} disabled={saving}
        style={{ width:'100%', padding:16, borderRadius:14, border:'none',
          background:saving?'#e5e7eb':'#635bff', color:saving?'#9ca3af':'white',
          fontWeight:800, fontSize:15, cursor:saving?'wait':'pointer', fontFamily:'inherit', marginBottom:12 }}>
        {saving ? tx.connecting : tx.stripe_btn}
      </button>
      <button onClick={handleFinish}
        style={{ width:'100%', padding:12, borderRadius:14, background:'white',
          border:'1.5px solid #d1d5db', color:'#6b7280',
          fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit',
          textDecoration:'underline' }}>
        {tx.stripe_later}
      </button>
    </>) : (
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:48, marginBottom:16 }}>🔗</div>
        <div style={{ fontWeight:700, fontSize:16, color:'#111827', marginBottom:8 }}>{tx.stripe_final_title}</div>
        <div style={{ fontSize:13, color:'#6b7280', marginBottom:20, lineHeight:1.6 }}>{tx.stripe_final_sub}</div>
        <a href={stripeUrl} target="_blank" rel="noopener noreferrer"
          style={{ display:'block', background:'#635bff', color:'white',
            borderRadius:14, padding:'14px 20px', fontWeight:800,
            fontSize:15, textDecoration:'none', marginBottom:12 }}>
          {tx.stripe_open}
        </a>
        <button onClick={handleFinish} disabled={saving}
          style={{ width:'100%', padding:12, borderRadius:14, border:'none',
            background:G, color:'white', fontWeight:700, fontSize:14,
            cursor:'pointer', fontFamily:'inherit' }}>
          {saving ? tx.saving : tx.stripe_done}
        </button>
      </div>
    )}
  </>)

  return null
}

function Btn({ label, disabled, onClick }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ flex:2, padding:14, borderRadius:14, border:'none',
        background:disabled?'#e5e7eb':G, color:disabled?'#9ca3af':'white',
        fontWeight:800, fontSize:14, cursor:disabled?'not-allowed':'pointer',
        fontFamily:"'Poppins',sans-serif",
        boxShadow:disabled?'none':'0 6px 18px rgba(108,99,255,.35)' }}>
      {label}
    </button>
  )
}
function BackBtn({ label, onClick }) {
  return (
    <button onClick={onClick}
      style={{ flex:1, padding:14, borderRadius:14, background:'white',
        border:'1.5px solid #e5e7eb', color:'#374151', fontWeight:600,
        fontSize:14, cursor:'pointer', fontFamily:"'Poppins',sans-serif" }}>
      {label}
    </button>
  )
}
function ErrBox({ msg }) {
  return (
    <div style={{ background:'#fef2f2', border:'1.5px solid #fecaca', borderRadius:10,
      padding:'10px 14px', color:'#dc2626', fontSize:12, marginBottom:12 }}>
      ⚠️ {msg}
    </div>
  )
}

const inp = { width:'100%', padding:'12px 14px', background:'white', border:'1.5px solid #e5e7eb', borderRadius:12, fontSize:14, fontFamily:"'Poppins',sans-serif", outline:'none', boxSizing:'border-box' }
const h2  = { fontWeight:800, fontSize:20, color:'#111827', margin:'0 0 6px' }
const sub = { fontSize:13, color:'#6b7280', margin:'0 0 24px', lineHeight:1.6 }
