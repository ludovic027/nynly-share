// ProfileScreen.jsx  -  Gestion du profil utilisateur (design v3 violet)
// AJOUTS : langues, certifications, expérience, tranches d'âge,
// types d'animaux, sous-compétences bricolage, non-fumeur, à l'aise animaux
// AJOUT : bouton "📘 Comment ça marche ?" (PlatformGuide modal)
import React, { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useT } from '../lib/i18n'
import { WorkerAvailabilityEditor } from './WorkerAvailability'
import WorkerCalendarBlocker from './WorkerCalendarBlocker'
import { ServiceLocationSelector } from './ServiceLocationBadge'
import CityAutocomplete from './CityAutocomplete'
import BackgroundCheckGate from './BackgroundCheckGate'
import PlatformGuide from './PlatformGuide'
import { T, Icon, SERVICE_META, serviceLabel, SKILL_GROUPS, VISIBLE_SERVICE_IDS } from '../lib/theme'

const SERVICE_IDS = VISIBLE_SERVICE_IDS
const WorkerProfileLazy = React.lazy(() => import('./WorkerProfile'))

// ── Export RGPD : transforme le JSON de export_user_data en HTML lisible ──
function gdprEsc(v) {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
function gdprPretty(key) {
  return key.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase())
}
function gdprVal(v) {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'Oui / Yes' : 'Non / No'
  if (Array.isArray(v)) return v.length
    ? gdprEsc(v.map(x => (x && typeof x === 'object') ? JSON.stringify(x) : x).join(', ')) : '—'
  if (typeof v === 'object') return '<pre>' + gdprEsc(JSON.stringify(v, null, 2)) + '</pre>'
  return gdprEsc(v)
}
function gdprKeyValTable(obj) {
  const rows = Object.keys(obj).map(k =>
    `<tr><th>${gdprEsc(gdprPretty(k))}</th><td>${gdprVal(obj[k])}</td></tr>`).join('')
  return `<table class="kv">${rows}</table>`
}
function gdprArrayTable(arr) {
  if (!arr || !arr.length) return '<p class="empty">—</p>'
  const cols = [...new Set(arr.flatMap(r => Object.keys(r || {})))]
  const head = cols.map(c => `<th>${gdprEsc(gdprPretty(c))}</th>`).join('')
  const body = arr.map(r => `<tr>${cols.map(c => `<td>${gdprVal(r?.[c])}</td>`).join('')}</tr>`).join('')
  return `<table class="rows"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`
}
function buildGdprHtml(data, isFR) {
  const L = isFR
    ? { title:'Mes données personnelles', sub:'Export RGPD — Nynly', exported:'Exporté le',
        tip:'Astuce : ouvrez ce fichier puis Ctrl+P pour l\'imprimer ou l\'enregistrer en PDF.' }
    : { title:'My personal data', sub:'GDPR export — Nynly', exported:'Exported on',
        tip:'Tip: open this file then Ctrl+P to print or save it as PDF.' }
  const SECTIONS = isFR
    ? { profile:'Mes informations personnelles', contracts:'Mes missions',
        reviews_given:'Avis que j\'ai donnés', reviews_received:'Avis reçus',
        review_requests:'Demandes d\'avis', messages:'Mes messages', addresses:'Mes adresses',
        disputes:'Mes litiges', support_tickets:'Support', referrals:'Parrainages',
        worker_blocked_dates:'Mes indisponibilités', urgent_requests:'Demandes urgentes',
        documents_metadata:'Mes documents' }
    : { profile:'My personal information', contracts:'My missions',
        reviews_given:'Reviews I gave', reviews_received:'Reviews received',
        review_requests:'Review requests', messages:'My messages', addresses:'My addresses',
        disputes:'My disputes', support_tickets:'Support', referrals:'Referrals',
        worker_blocked_dates:'My unavailabilities', urgent_requests:'Urgent requests',
        documents_metadata:'My documents' }
  const exportedAt = data?.exported_at
    ? new Date(data.exported_at).toLocaleString(isFR ? 'fr-FR' : 'en-US') : ''
  const sections = Object.keys(SECTIONS).map(key => {
    const v = data?.[key]
    if (v == null || (Array.isArray(v) && v.length === 0)) return ''
    const inner = Array.isArray(v) ? gdprArrayTable(v) : gdprKeyValTable(v)
    return `<section><h2>${gdprEsc(SECTIONS[key])}</h2>${inner}</section>`
  }).join('')
  return `<!doctype html><html lang="${isFR ? 'fr' : 'en'}"><head><meta charset="utf-8">
<title>${gdprEsc(L.title)}</title><style>
body{font-family:system-ui,'Segoe UI',sans-serif;color:#111827;max-width:900px;margin:24px auto;padding:0 16px}
h1{font-size:22px;margin:0 0 2px}.sub{color:#6b7280;font-size:13px;margin:0}
.meta{color:#9ca3af;font-size:12px;margin:6px 0}
.tip{background:#f2f1ff;border:1px solid #ddd6fe;color:#5546e8;font-size:12px;padding:8px 12px;border-radius:8px;margin:12px 0}
section{margin:22px 0}h2{font-size:15px;color:#5546e8;border-bottom:2px solid #ede9fe;padding-bottom:4px}
table{width:100%;border-collapse:collapse;font-size:12px;margin-top:8px}
th,td{border:1px solid #e5e7eb;padding:6px 8px;text-align:left;vertical-align:top}
table.kv th{width:230px;background:#f9fafb}table.rows thead th{background:#f9fafb}
pre{margin:0;white-space:pre-wrap;font-size:11px}.empty{color:#9ca3af;font-size:12px}
@media print{.tip{display:none}}
</style></head><body>
<h1>${gdprEsc(L.title)}</h1><p class="sub">${gdprEsc(L.sub)}</p>
<p class="meta">${gdprEsc(L.exported)} ${gdprEsc(exportedAt)}</p>
<div class="tip">${gdprEsc(L.tip)}</div>
${sections}
</body></html>`
}

// ── Options des nouveaux champs ───────────────────────────────
const LANG_OPTIONS = [
  { id:'en', label:'English' },
  { id:'es', label:'Español' },
  { id:'fr', label:'Français' },
  { id:'ht', label:'Kreyòl ayisyen' },
  { id:'pt', label:'Português' },
  { id:'de', label:'Deutsch' },
  { id:'it', label:'Italiano' },
  { id:'ar', label:'العربية' },
  { id:'zh', label:'中文' },
  { id:'ru', label:'Русский' },
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
const CERT_SUGGESTIONS = {
  US: ['CPR / First Aid', 'CDA (Child Development Associate)', 'CNA'],
  FR: ['PSC1 (premiers secours)', 'CAP AEPE (petite enfance)', 'BAFA'],
}

// Sélecteur de chips multi-choix réutilisable
function ChipPicker({ options, value, onToggle, getLabel }) {
  return (
    <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:14 }}>
      {options.map(opt => {
        const sel = value.includes(opt.id)
        return (
          <button key={opt.id} type="button" onClick={() => onToggle(opt.id)}
            style={{ padding:'7px 13px', borderRadius:99,
              border:`1.5px solid ${sel ? T.primary : T.border}`,
              background: sel ? T.primaryTint : 'white',
              color: sel ? T.primaryDark : '#374151',
              fontWeight: sel ? 700 : 500, fontSize:12,
              cursor:'pointer', fontFamily:'inherit', transition:'all .12s' }}>
            {getLabel(opt)}
          </button>
        )
      })}
    </div>
  )
}

export default function ProfileScreen({ profile, setProfile, navigate, lang = 'fr' }) {
  const videoUploadRef = useRef(null)
  const videoCameraRef = useRef(null)

  const [editing,       setEditing]       = useState(false)
  const [previewing,    setPreviewing]     = useState(false)
  const [bio,           setBio]           = useState(profile?.bio || '')
  const [phone,         setPhone]         = useState(profile?.phone || '')
  const [rate,          setRate]          = useState(profile?.hourly_rate?.toString() || '20')
  const [editServices,  setEditServices]  = useState(profile?.services_offered || [])
  const [editRates,     setEditRates]     = useState(profile?.service_rates || {})
  const [loc,           setLoc]           = useState(profile?.service_location || 'at_client')
  const [online,        setOnline]        = useState(profile?.is_online || false)
  const [saving,        setSaving]        = useState(false)
  const [references,    setReferences]    = useState([])
  const [showAddRef,    setShowAddRef]    = useState(false)
  const [refName,       setRefName]       = useState('')
  const [refEmail,      setRefEmail]      = useState('')
  const [refRole,       setRefRole]       = useState('family')
  const [sendingRef,    setSendingRef]    = useState(false)
  const [insUploading,  setInsUploading]  = useState(false)
  const [showShareMenu, setShowShareMenu] = useState(false)
  const [linkCopied,    setLinkCopied]    = useState(false)
  const [thimbleActive, setThimbleActive] = useState(false)
  const [savingThimbleOpt, setSavingThimbleOpt] = useState(false)
  const [notif,         setNotif]         = useState(null)
  const [showBgGate,    setShowBgGate]    = useState(false)
  const [showGuide,     setShowGuide]     = useState(false)
  const [city,          setCity]          = useState(profile?.city || '')
  const [cityMeta,      setCityMeta]      = useState(null)
  const [radius,        setRadius]        = useState(profile?.service_radius_km?.toString() || '10')
  const [hasVehicle,    setHasVehicle]    = useState(profile?.has_vehicle || false)
  const [videoPreview,  setVideoPreview]  = useState(null)
  const [videoPendingFile, setVideoPendingFile] = useState(null)

  // ── Nouveaux champs détaillés ──
  const [languages,   setLanguages]   = useState(profile?.languages || [])
  const [certs,       setCerts]       = useState(Array.isArray(profile?.certifications) ? profile.certifications : [])
  const [certInput,   setCertInput]   = useState('')
  const [yearsExp,    setYearsExp]    = useState(profile?.years_experience?.toString() || '')
  const [nonSmoker,   setNonSmoker]   = useState(profile?.non_smoker || false)
  const [okPets,      setOkPets]      = useState(profile?.comfortable_with_pets || false)
  const [ageRanges,   setAgeRanges]   = useState(profile?.childcare_age_ranges || [])
  const [petTypes,    setPetTypes]    = useState(profile?.pet_types || [])
  const [handySkills, setHandySkills] = useState(profile?.handyman_skills || [])
  const [svcSkills, setSvcSkills] = useState({
    childcare:   profile?.childcare_skills   || [],
    seniorcare:  profile?.seniorcare_skills  || [],
    cleaning:    profile?.cleaning_skills    || [],
    lawn:        profile?.lawn_skills        || [],
    errands:     profile?.errands_skills     || [],
    hairdresser: profile?.hairdresser_skills || [],
    tutoring:    profile?.tutoring_skills    || [],
    fitness:     profile?.fitness_skills     || [],
    housesitting:profile?.housesitting_skills || [],
  })
  const [cleanOwnSupplies, setCleanOwnSupplies] = useState(profile?.cleaning_own_supplies || false)
  const [lawnOwnEquipment, setLawnOwnEquipment] = useState(profile?.lawn_own_equipment || false)

  function toggleSvcSkill(group, id) {
    setSvcSkills(prev => ({
      ...prev,
      [group]: prev[group].includes(id)
        ? prev[group].filter(x => x !== id)
        : [...prev[group], id],
    }))
  }

  const { t, isFR } = useT(lang)
  const isES = lang === 'es'
  const isWorker = profile?.role === 'worker'
  const sym      = isFR ? '€' : '$'
  const userId   = profile?.id
  const optLabel = opt => isFR ? opt.fr : isES ? opt.es : opt.en

  function toast(msg) {
    setNotif(msg)
    setTimeout(() => setNotif(null), 3000)
  }

  function toggleIn(setter) {
    return id => setter(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function addCert(name) {
    const n = (name || '').trim()
    if (!n) return
    if (certs.some(c => (c?.name || c) === n)) return
    setCerts(prev => [...prev, { name:n, verified:false }])
    setCertInput('')
  }

  // Compression photo avant upload (800px max, ~100-200KB au lieu de 5-15MB)
  async function compressImage(file, maxSize = 800) {
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let w = img.width, h = img.height
        if (w > h && w > maxSize) { h = h * maxSize / w; w = maxSize }
        else if (h > maxSize) { w = w * maxSize / h; h = maxSize }
        canvas.width = w; canvas.height = h
        canvas.getContext('2d').drawImage(img, 0, 0, w, h)
        canvas.toBlob(blob => resolve(blob), 'image/jpeg', 0.85)
      }
      img.onerror = () => resolve(null)
      img.src = URL.createObjectURL(file)
    })
  }

  async function handleAvatarUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const MAX = 8 * 1024 * 1024
    if (file.size > MAX) { toast(isFR ? 'Max 8 MB.' : 'Max 8 MB.'); return }
    const type = file.type?.toLowerCase() || ''
    const ext = (file.name?.split('.').pop() || '').toLowerCase()
    const validType = type.startsWith('image/')
    const validExt = ['jpg','jpeg','png','webp','gif','heic','heif','avif'].includes(ext)
    if (!validType && !validExt) { toast(isFR ? 'JPG, PNG ou WEBP.' : 'JPG, PNG or WEBP.'); return }
    if (type.startsWith('video/')) { toast(isFR ? 'Photo uniquement.' : 'Photo only.'); return }
    setSaving(true)
    try {
      const compressed = await compressImage(file)
      const uploadFile = compressed || file
      const path = `workers/${profile.id}-${Date.now()}.jpg`
      const { error } = await supabase.storage.from('avatars').upload(path, uploadFile, { upsert:true })
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
      await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', profile.id)
      setProfile({ ...profile, avatar_url: publicUrl })
      toast(isFR ? '✅ Photo mise à jour !' : '✅ Photo updated!')
    } catch (err) { toast('⚠️ ' + (err?.message || 'Erreur')) }
    setSaving(false)
    if (e.target) e.target.value = ''
  }

  useEffect(() => {
    supabase.from('platform_settings')
      .select('thimble_enabled').eq('id', 'singleton').single()
      .then(({ data }) => setThimbleActive(data?.thimble_enabled || false))
  }, [])

  useEffect(() => {
    if (!isWorker || !profile?.id) return
    supabase.from('references').select('*')
      .eq('worker_id', profile.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setReferences(data || []))
  }, [isWorker, profile?.id])

  async function toggleOnline() {
    const next = !online
    setOnline(next)
    try {
      const { error } = await supabase.from('profiles')
        .update({ is_online: next }).eq('id', profile.id)
      if (error) throw error
      setProfile({ ...profile, is_online: next })
    } catch (err) {
      setOnline(!next)
      toast(isFR ? '❌ Statut non mis à jour.' : '❌ Status not updated.')
    }
  }

  async function saveProfile() {
    setSaving(true)
    try {
      const updates = { bio, phone, updated_at: new Date().toISOString() }
      if (isWorker) {
        updates.hourly_rate           = parseFloat(rate) || 20
        updates.service_location      = loc
        updates.city                  = city
        if (cityMeta) {
          updates.detected_country   = cityMeta.country || null
          updates.detected_city_slug = cityMeta.city.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '')
          updates.latitude           = cityMeta.lat     || null
          updates.longitude          = cityMeta.lng     || null
        }
        updates.service_radius_km     = parseFloat(radius) || 10
        updates.has_vehicle           = hasVehicle
        updates.services_offered      = editServices
        updates.service_rates         = editRates
        updates.languages             = languages
        updates.certifications        = certs
        updates.years_experience      = yearsExp === '' ? null : (parseInt(yearsExp) || 0)
        updates.non_smoker            = nonSmoker
        updates.comfortable_with_pets = okPets
        updates.childcare_age_ranges  = ageRanges
        updates.pet_types             = petTypes
        updates.handyman_skills       = handySkills
        updates.childcare_skills      = svcSkills.childcare
        updates.seniorcare_skills     = svcSkills.seniorcare
        updates.cleaning_skills       = svcSkills.cleaning
        updates.lawn_skills           = svcSkills.lawn
        updates.errands_skills        = svcSkills.errands
        updates.hairdresser_skills    = svcSkills.hairdresser
        updates.tutoring_skills       = svcSkills.tutoring
        updates.fitness_skills        = svcSkills.fitness
        updates.housesitting_skills   = svcSkills.housesitting
        updates.cleaning_own_supplies = cleanOwnSupplies
        updates.lawn_own_equipment    = lawnOwnEquipment
      } else {
        updates.city = city
      }
      const { data, error } = await supabase.from('profiles')
        .update(updates).eq('id', profile.id).select().single()
      if (!error && data) {
        setProfile(data)
        setCityMeta(null)
        setEditing(false)
        toast(t('profile_saved'))
      } else if (error) {
        toast(isFR ? `❌ Erreur: ${error.message}` : `❌ Error: ${error.message}`)
      }
    } catch (err) {
      console.warn('[saveProfile]', err?.message)
      toast(isFR ? `❌ ${err?.message || 'Erreur inconnue'}` : `❌ ${err?.message || 'Unknown error'}`)
    } finally {
      setSaving(false)
    }
  }

  async function handleBackgroundCheckUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const MAX = 15 * 1024 * 1024
    const OK  = ['application/pdf','image/jpeg','image/jpg','image/png','image/webp']
    if (file.size > MAX) { toast(isFR ? '⚠️ Max 15 MB.' : '⚠️ Max 15 MB.'); return }
    if (!OK.includes(file.type.toLowerCase())) {
      toast(isFR ? '⚠️ PDF ou image uniquement.' : '⚠️ PDF or image only.')
      return
    }
    setSaving(true)
    try {
      const ext  = file.name.split('.').pop()
      // RLS policy documents_worker_upload : le 1er segment du path doit être auth.uid()
      const path = `${profile.id}/background-check/${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('documents').upload(path, file, { upsert: true })
      if (error) throw error
      // Bucket privé : on stocke le PATH (URL signée générée à la lecture via getSignedDocUrl)
      await supabase.from('profiles').update({
        background_check_url:          path,
        background_check_submitted_at: new Date().toISOString(),
        background_check_status:       'pending',
      }).eq('id', profile.id)
      setProfile({ ...profile,
        background_check_url: path,
        background_check_status: 'pending' })
      // Lancer la vérification IA (paramètre doc_path aligné avec edge function)
      supabase.functions.invoke('background-check', {
        body: { action: 'upload_existing_checkr', worker_id: profile.id, doc_path: path, worker_name: `${profile.first_name} ${profile.last_name}` }
      }).then(res => {
        console.log('[background-check] response:', res)
        if (res?.data?.status) {
          setProfile(prev => ({ ...prev, background_check_status: res.data.status }))
        }
      }).catch(err => {
        console.error('[background-check] error:', err)
      })
      toast(isFR ? '✅ Document envoyé ! Validation sous 24h.' : '✅ Sent! Validated within 24h.')
    } catch (err) { toast('⚠️ ' + (err?.message || 'Erreur')) }
    setSaving(false)
    if (e.target) e.target.value = ''
  }

  async function handleInsuranceUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const MAX = 10 * 1024 * 1024
    const OK_TYPES = ['application/pdf','image/jpeg','image/jpg','image/png','image/webp']
    if (file.size > MAX) { toast(isFR ? '⚠️ Max 10 MB.' : '⚠️ Max 10 MB.'); return }
    if (!OK_TYPES.includes(file.type.toLowerCase())) {
      toast(isFR ? '⚠️ PDF ou image uniquement.' : '⚠️ PDF or image only.')
      return
    }
    setInsUploading(true)
    try {
      const ext  = file.name.split('.').pop()
      // RLS policy documents_worker_upload : le 1er segment du path doit être auth.uid()
      const path = `${profile.id}/insurance/${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('documents').upload(path, file)
      if (error) throw error
      // Bucket privé : on stocke le PATH (URL signée générée à la lecture via getSignedDocUrl)
      await supabase.from('profiles').update({
        insurance_doc_url:      path,
        insurance_submitted_at: new Date().toISOString(),
        insurance_verified:     false,
      }).eq('id', profile.id)
      setProfile({ ...profile, insurance_doc_url: path, insurance_verified: false })
      toast(isFR ? '✅ Attestation envoyée ! Validation sous 24h.' : '✅ Sent! Validation within 24h.')
    } catch (err) { toast('⚠️ ' + (err?.message || 'Erreur')) }
    setInsUploading(false)
    if (e.target) e.target.value = ''
  }

  async function toggleThimbleOpt(field, value) {
    setSavingThimbleOpt(true)
    try {
      await supabase.from('profiles').update({ [field]: value }).eq('id', profile.id)
      setProfile({ ...profile, [field]: value })
      toast(value ? '✅ ' + (isFR ? 'Mis à jour' : 'Updated') : (isFR ? 'Désactivé' : 'Disabled'))
    } catch (err) { toast('⚠️ ' + (err?.message || 'Erreur')) }
    setSavingThimbleOpt(false)
  }

  async function handleSendRef() {
    if (!refName.trim() || !refEmail.trim()) {
      toast(isFR ? '⚠️ Nom et email requis.' : '⚠️ Name and email required.')
      return
    }
    if (!/^[^@]+@[^@]+\.[^@]+$/.test(refEmail.trim())) {
      toast(isFR ? '⚠️ Email invalide.' : '⚠️ Invalid email.')
      return
    }
    setSendingRef(true)
    try {
      const { error } = await supabase.functions.invoke('send-reference-request', {
        body: { worker_id: profile.id, referee_name: refName.trim(),
          referee_email: refEmail.trim().toLowerCase(), referee_role: refRole, lang }
      })
      if (error) throw error
      toast(t('ref_sent_ok'))
      setShowAddRef(false)
      setRefName(''); setRefEmail(''); setRefRole('family')
      const { data } = await supabase.from('references').select('*')
        .eq('worker_id', profile.id).order('created_at', { ascending: false })
      setReferences(data || [])
    } catch (err) { toast('⚠️ ' + (err?.message || 'Erreur')) }
    setSendingRef(false)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  if (previewing && isWorker) return (
    <div style={{ minHeight:'100vh', fontFamily:"'Poppins',system-ui,sans-serif" }}>
      <div style={{ position:'sticky', top:0, zIndex:99, background:T.ink,
        color:'white', padding:'12px 16px', display:'flex',
        alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <div style={{ fontWeight:700, fontSize:13 }}>
            {isFR ? 'Aperçu de mon profil public' : 'My public profile preview'}
          </div>
          <div style={{ fontSize:11, color:'rgba(255,255,255,.6)', marginTop:1 }}>
            {isFR ? "Ce que les familles voient" : 'What families see'}
          </div>
        </div>
        <button onClick={() => setPreviewing(false)}
          style={{ background:T.primary, border:'none', color:'white', borderRadius:T.rS,
            padding:'8px 16px', fontWeight:700, fontSize:13, cursor:'pointer',
            fontFamily:'inherit' }}>
          ✕ {isFR ? 'Fermer' : 'Close'}
        </button>
      </div>
      <React.Suspense fallback={<div style={{ padding:40, textAlign:'center', color:T.faint }}>⏳</div>}>
        <WorkerProfileLazy workerId={profile.id} navigate={null}
          lang={lang} currentUserId={null} currentUserRole="client" />
      </React.Suspense>
    </div>
  )

  // Bouton "Comment ça marche ?" (worker et famille)
  const guideButton = (
    <button onClick={() => setShowGuide(true)}
      style={{ width:'100%', display:'flex', alignItems:'center', gap:10,
        background:T.primaryTint, border:`1.5px solid #D6D2FF`, borderRadius:T.rM,
        padding:'14px 16px', marginBottom:8, cursor:'pointer',
        fontFamily:'inherit', textAlign:'left' }}>
      <span style={{ fontSize:22 }}>📘</span>
      <div style={{ flex:1 }}>
        <div style={{ fontWeight:700, fontSize:13, color:T.primaryDark }}>
          {isFR ? 'Comment ça marche ?' : isES ? '¿Cómo funciona?' : 'How it works'}
        </div>
        <div style={{ fontSize:11, color:T.primaryDark, opacity:.75, marginTop:2 }}>
          {isWorker
            ? (isFR ? 'Guide du prestataire — 6 étapes' : isES ? 'Guía del proveedor — 6 pasos' : 'Provider guide — 6 steps')
            : (isFR ? 'Guide de la famille — 6 étapes' : isES ? 'Guía de la familia — 6 pasos' : 'Family guide — 6 steps')}
        </div>
      </div>
      <Icon name="chevron" size={16} color={T.primaryDark} />
    </button>
  )

  return (
    <div style={{ padding:'20px 16px', fontFamily:"'Poppins',system-ui,sans-serif" }}>

      {notif && (
        <div style={{ position:'fixed', bottom:80, left:'50%', transform:'translateX(-50%)',
          background:T.ink, color:'white', padding:'10px 20px', borderRadius:99,
          fontWeight:700, fontSize:13, zIndex:9999, whiteSpace:'nowrap',
          boxShadow:'0 8px 24px rgba(20,18,43,.35)' }}>
          {notif}
        </div>
      )}

      {/* Header profil + upload photo avec 2 boutons séparés */}
      <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:24 }}>
        <div style={{ position:'relative', flexShrink:0 }}>
          {profile?.avatar_url
            ? <img src={profile.avatar_url} alt="avatar"
                style={{ width:72, height:72, borderRadius:18, objectFit:'cover' }} />
            : <div style={{ width:72, height:72, borderRadius:18, background:T.primaryTint,
                display:'flex', alignItems:'center', justifyContent:'center' }}>
                <Icon name="user" size={32} color={T.primary} />
              </div>
          }
          <div style={{ position:'absolute', bottom:-4, right:-4, display:'flex', gap:2 }}>
            <label htmlFor="avatar-photo"
              style={{ background:T.primary, borderRadius:'50%', width:26, height:26,
                display:'flex', alignItems:'center', justifyContent:'center',
                cursor:'pointer', border:'2px solid white' }}>
              <Icon name="camera" size={13} color="white" />
            </label>
            <label htmlFor="avatar-video"
              style={{ background:T.ink, borderRadius:'50%', width:26, height:26,
                display:'flex', alignItems:'center', justifyContent:'center',
                cursor:'pointer', border:'2px solid white' }}>
              <Icon name="video" size={12} color="white" />
            </label>
          </div>
          <input id="avatar-photo" type="file" accept="image/*"
            onChange={handleAvatarUpload} style={{ display:'none' }} />
          <input id="avatar-video" type="file" accept="video/mp4,video/quicktime,video/webm"
            onChange={async e => {
              const file = e.target.files?.[0]
              if (!file) return
              if (!file.type.toLowerCase().startsWith('video/')) {
                toast(isFR ? '⚠️ Format non supporté. MP4 ou MOV.' : '⚠️ Use MP4 or MOV.')
                return
              }
              setSaving(true)
              try {
                const cloudName    = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
                const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'nynly_videos'
                if (!cloudName) throw new Error('VITE_CLOUDINARY_CLOUD_NAME manquant')
                const formData = new FormData()
                formData.append('file', file)
                formData.append('upload_preset', uploadPreset)
                formData.append('folder', 'nynly/videos')
                formData.append('resource_type', 'video')
                const res = await fetch(
                  `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
                  { method: 'POST', body: formData }
                )
                if (!res.ok) throw new Error('Cloudinary upload failed')
                const data = await res.json()
                const publicUrl = data.secure_url
                await supabase.from('profiles').update({ video_url: publicUrl }).eq('id', profile.id)
                setProfile({ ...profile, video_url: publicUrl })
                toast(isFR ? '✅ Vidéo mise à jour !' : '✅ Video updated!')
              } catch (err) { toast('⚠️ ' + (err?.message || 'Erreur')) }
              setSaving(false)
              if (e.target) e.target.value = ''
            }}
            style={{ display:'none' }} />
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:800, fontSize:18, color:T.text, letterSpacing:'-0.2px' }}>
            {profile?.first_name} {profile?.last_name}
          </div>
          <div style={{ fontSize:12, color:T.faint, marginTop:2 }}>{profile?.email}</div>
          <div style={{ fontSize:11, marginTop:4,
            color: isWorker ? T.primaryDark : T.blue, fontWeight:700 }}>
            {isWorker
              ? (isFR ? 'Prestataire' : isES ? 'Proveedor' : 'Provider')
              : (isFR ? 'Famille' : isES ? 'Familia' : 'Family')}
          </div>
          <div style={{ fontSize:10, color:T.faint, marginTop:3 }}>
            📷 {isFR ? 'Photo' : 'Camera'} · 🖼️ {isFR ? 'Galerie' : 'Gallery'}
          </div>
        </div>
      </div>

      {/* Prévisualisation profil worker */}
      {isWorker && (
        <button onClick={() => setPreviewing(true)}
          style={{ width:'100%', display:'flex', alignItems:'center', gap:10,
            background:'white', border:`1.5px solid ${T.border}`, borderRadius:T.rM,
            padding:'14px 16px', marginBottom:8, cursor:'pointer',
            fontFamily:'inherit', textAlign:'left' }}>
          <span style={{ fontSize:22 }}>👁</span>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:700, fontSize:13, color:T.text }}>
              {isFR ? 'Voir mon profil public' : 'Preview my profile'}
            </div>
            <div style={{ fontSize:11, color:T.faint, marginTop:2 }}>
              {isFR ? "Ce que voient les familles" : 'What families see'}
            </div>
          </div>
          <Icon name="chevron" size={16} color="#D1D5DB" />
        </button>
      )}

      {/* Bouton Guide côté WORKER : juste après "Voir mon profil public" */}
      {isWorker && guideButton}

      {/* Vidéo — worker ET famille */}
      <div style={{ background:'white', border:`1.5px solid ${T.border}`,
        borderRadius:T.rM, padding:'14px 16px', marginBottom:8 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10,
          marginBottom: (profile?.video_url || videoPreview) ? 12 : 0 }}>
          <Icon name="video" size={20} color={T.primary} />
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:700, fontSize:13, color:T.text }}>
              {isWorker
                ? (isFR ? 'Vidéo de présentation' : 'Intro video')
                : (isFR ? 'Présentez votre famille' : 'Introduce your family')}
            </div>
            <div style={{ fontSize:11, color:T.faint, marginTop:2 }}>
              {profile?.video_url
                ? (isWorker
                    ? (isFR ? '✅ Vidéo enregistrée · 3x plus de visites' : '✅ Video saved · 3x more views')
                    : (isFR ? '✅ Vidéo ajoutée · Les prestataires pourront la consulter' : '✅ Video added · Providers can view it'))
                : (isWorker
                    ? (isFR ? '⚠️ Pas de vidéo - profil 3x moins consulté' : '⚠️ No video - 3x fewer views')
                    : (isFR ? '💡 Optionnel — aidez les prestataires à mieux vous connaître' : '💡 Optional — help providers get to know you'))}
            </div>
          </div>
        </div>

        {profile?.video_url && !videoPreview && (
          <div style={{ borderRadius:12, overflow:'hidden', marginBottom:10,
            background:'#000', maxHeight:200, maxWidth:140 }}>
            <video src={profile.video_url} controls playsInline preload="metadata"
              style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}
              onError={e => { e.target.parentElement.style.display = 'none' }} />
          </div>
        )}

        {videoPreview && (
          <div style={{ marginBottom:12 }}>
            <div style={{ borderRadius:12, overflow:'hidden', background:'#000',
              maxHeight:240, maxWidth:180, marginBottom:10 }}>
              <video src={videoPreview} controls playsInline autoPlay muted
                style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} />
            </div>
            <div style={{ fontSize:11, color:T.sub, marginBottom:10, textAlign:'center' }}>
              {isFR ? 'Prévisualisation — vérifiez avant de valider' : 'Preview — check before confirming'}
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => {
                  setVideoPreview(null)
                  setVideoPendingFile(null)
                  if (videoUploadRef.current) videoUploadRef.current.value = ''
                  if (videoCameraRef.current) videoCameraRef.current.value = ''
                }}
                style={{ flex:1, padding:'10px', borderRadius:T.rS,
                  background:'white', border:'1.5px solid #FECACA',
                  color:T.red, fontWeight:700, fontSize:12,
                  cursor:'pointer', fontFamily:'inherit' }}>
                ❌ {isFR ? 'Annuler' : 'Cancel'}
              </button>
              <button onClick={async () => {
                  if (!videoPendingFile) return
                  setSaving(true)
                  try {
                    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
                    const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'nynly_videos'
                    if (!cloudName) throw new Error('VITE_CLOUDINARY_CLOUD_NAME manquant')
                    const formData = new FormData()
                    formData.append('file', videoPendingFile)
                    formData.append('upload_preset', uploadPreset)
                    formData.append('folder', 'nynly/videos')
                    formData.append('resource_type', 'video')
                    const res = await fetch(
                      `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
                      { method: 'POST', body: formData }
                    )
                    if (!res.ok) throw new Error('Cloudinary upload failed')
                    const data = await res.json()
                    const publicUrl = data.secure_url
                    await supabase.from('profiles').update({ video_url: publicUrl }).eq('id', profile.id)
                    setProfile({ ...profile, video_url: publicUrl })
                    toast(isFR ? '✅ Vidéo mise à jour !' : '✅ Video updated!')
                  } catch (err) { toast('⚠️ ' + (err?.message || 'Erreur')) }
                  setSaving(false)
                  setVideoPreview(null)
                  setVideoPendingFile(null)
                  if (videoUploadRef.current) videoUploadRef.current.value = ''
                  if (videoCameraRef.current) videoCameraRef.current.value = ''
                }}
                disabled={saving}
                style={{ flex:2, padding:'10px', borderRadius:T.rS,
                  background: saving ? '#E5E7EB' : T.primary, border:'none',
                  color:'white', fontWeight:700, fontSize:12,
                  cursor: saving ? 'wait' : 'pointer', fontFamily:'inherit' }}>
                {saving ? '⏳ Envoi...' : (isFR ? '✅ Valider et envoyer' : '✅ Confirm & upload')}
              </button>
            </div>
          </div>
        )}

        <input ref={videoCameraRef} type="file" accept="video/*" capture="environment"
          onChange={e => {
            const file = e.target.files?.[0]
            if (!file) return
            if (!file.type?.toLowerCase().startsWith('video/')) {
              const ext = (file.name?.split('.').pop() || '').toLowerCase()
              if (!['mp4','mov','webm','avi','mkv'].includes(ext)) {
                toast(isFR ? '⚠️ Format vidéo non supporté.' : '⚠️ Unsupported video format.')
                return
              }
            }
            setVideoPendingFile(file)
            setVideoPreview(URL.createObjectURL(file))
          }}
          style={{ display:'none' }} />
        <input ref={videoUploadRef} type="file" accept="video/mp4,video/quicktime,video/webm,video/*"
          onChange={e => {
            const file = e.target.files?.[0]
            if (!file) return
            if (!file.type?.toLowerCase().startsWith('video/')) {
              const ext = (file.name?.split('.').pop() || '').toLowerCase()
              if (!['mp4','mov','webm','avi','mkv'].includes(ext)) {
                toast(isFR ? '⚠️ Format vidéo non supporté.' : '⚠️ Unsupported video format.')
                return
              }
            }
            setVideoPendingFile(file)
            setVideoPreview(URL.createObjectURL(file))
          }}
          style={{ display:'none' }} />

        {!videoPreview && (
          <div style={{ display:'flex', gap:8, marginTop: (profile?.video_url) ? 0 : 12 }}>
            <button onClick={() => videoCameraRef.current?.click()} disabled={saving}
              style={{ flex:1, padding:'10px', borderRadius:T.rS,
                background:T.primary, border:'none',
                color:'white', fontWeight:700, fontSize:12,
                cursor:'pointer', fontFamily:'inherit',
                display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
              🎬 {isFR ? 'Filmer' : 'Record'}
            </button>
            <button onClick={() => videoUploadRef.current?.click()} disabled={saving}
              style={{ flex:1, padding:'10px', borderRadius:T.rS,
                background:'white', border:'1.5px solid #D6D2FF',
                color:T.primaryDark, fontWeight:700, fontSize:12,
                cursor:'pointer', fontFamily:'inherit',
                display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
              📂 {isFR ? 'Galerie' : 'Gallery'}
            </button>
          </div>
        )}
      </div>

      {/* Bouton Guide côté FAMILLE : juste après la Vidéo */}
      {!isWorker && guideButton}

      {/* Parrainage */}
      {profile?.referral_code && (
        <div style={{ background:'white', border:`1.5px solid ${T.border}`,
          borderRadius:T.rM, padding:'16px', marginBottom:8 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
            <Icon name="gift" size={20} color={T.primary} />
            <div>
              <div style={{ fontWeight:800, fontSize:14, color:T.text }}>{t('ref_title')}</div>
              <div style={{ fontSize:11, color:T.faint }}>{t('ref_sub')}</div>
            </div>
          </div>
          <div style={{ background:T.soft, borderRadius:12, padding:'12px 14px',
            marginBottom:12, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div>
              <div style={{ fontSize:10, fontWeight:700, color:T.faint,
                textTransform:'uppercase', letterSpacing:'.07em' }}>
                {t('ref_code_label')}
              </div>
              <div style={{ fontWeight:800, fontSize:20, letterSpacing:'0.12em',
                color:T.text, marginTop:2 }}>
                {profile.referral_code}
              </div>
            </div>
            <button onClick={() => setShowShareMenu(!showShareMenu)}
              style={{ background:T.primary, border:'none', color:'white',
                borderRadius:T.rS, padding:'10px 16px', fontWeight:700,
                fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>
              {t('ref_share_btn')}
            </button>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:12 }}>
            <div style={{ background:T.primaryTint, border:'1.5px solid #D6D2FF',
              borderRadius:12, padding:'10px 12px' }}>
              <div style={{ marginBottom:4 }}><Icon name="user" size={16} color={T.primaryDark} /></div>
              <div style={{ fontSize:11, fontWeight:700, color:T.primaryDark, marginBottom:4 }}>
                {isFR ? 'Inviter une famille' : isES ? 'Invitar familia' : 'Invite a family'}
              </div>
              <div style={{ fontSize:10, color:'#374151', lineHeight:1.5 }}>
                {profile?.role === 'worker'
                  ? (isFR ? 'Elle gagne 2 mois gratuits · Vous gagnez 1 mois sans commission'
                     : isES ? 'Obtiene 2 meses gratis · Tu ganas 1 mes sin comision'
                     : 'They get 2 free months · You get 1 month commission-free')
                  : (isFR ? 'Elle gagne 2 mois gratuits · Vous gagnez 1 mois gratuit'
                     : isES ? 'Obtiene 2 meses gratis · Tu ganas 1 mes gratis'
                     : 'They get 2 free months · You get 1 free month')}
              </div>
            </div>
            <div style={{ background:T.blueTint, border:'1.5px solid #BFDBFE',
              borderRadius:12, padding:'10px 12px' }}>
              <div style={{ marginBottom:4 }}><Icon name="wallet" size={16} color="#1D4ED8" /></div>
              <div style={{ fontSize:11, fontWeight:700, color:'#1D4ED8', marginBottom:4 }}>
                {isFR ? 'Inviter un prestataire' : isES ? 'Invitar proveedor' : 'Invite a provider'}
              </div>
              <div style={{ fontSize:10, color:'#374151', lineHeight:1.5 }}>
                {profile?.role === 'worker'
                  ? (isFR ? 'Il gagne 2 mois sans commission · Vous gagnez 1 mois sans commission'
                     : isES ? 'Obtiene 2 meses sin comision · Tu ganas 1 mes sin comision'
                     : 'They get 2 months commission-free · You get 1 month commission-free')
                  : (isFR ? 'Il gagne 2 mois sans commission · Vous gagnez 1 mois gratuit'
                     : isES ? 'Obtiene 2 meses sin comision · Tu ganas 1 mes gratis'
                     : 'They get 2 months commission-free · You get 1 free month')}
              </div>
            </div>
          </div>

          {showShareMenu && (() => {
            const refLink    = `https://nynly.app?ref=${profile.referral_code}`
            const msg        = isFR
              ? `Rejoins Nynly avec mon code ${profile.referral_code} - 2 mois gratuits ! ${refLink}`
              : lang === 'es'
              ? `Unete a Nynly con mi codigo ${profile.referral_code} - 2 meses gratis! ${refLink}`
              : `Join Nynly with code ${profile.referral_code} - 2 free months! ${refLink}`
            const msgEncoded = encodeURIComponent(msg)
            const emailSubject = encodeURIComponent(isFR ? 'Je t invite sur Nynly !' : 'Join me on Nynly!')
            return (
              <div style={{ marginTop:12, display:'flex', flexDirection:'column', gap:8 }}>
                <a href={`https://wa.me/?text=${msgEncoded}`} target="_blank" rel="noreferrer"
                  style={{ display:'flex', alignItems:'center', gap:10,
                    background:'#DCFCE7', border:'1.5px solid #86EFAC',
                    borderRadius:12, padding:'10px 14px', textDecoration:'none' }}>
                  <span style={{ fontSize:20 }}>💬</span>
                  <span style={{ fontSize:13, fontWeight:700, color:'#15803D' }}>WhatsApp</span>
                </a>
                <a href={`sms:?body=${msgEncoded}`}
                  style={{ display:'flex', alignItems:'center', gap:10,
                    background:T.primaryTint, border:'1.5px solid #D6D2FF',
                    borderRadius:12, padding:'10px 14px', textDecoration:'none' }}>
                  <span style={{ fontSize:20 }}>✉️</span>
                  <span style={{ fontSize:13, fontWeight:700, color:T.primaryDark }}>SMS</span>
                </a>
                <a href={`mailto:?subject=${emailSubject}&body=${msgEncoded}`}
                  style={{ display:'flex', alignItems:'center', gap:10,
                    background:T.blueTint, border:'1.5px solid #BFDBFE',
                    borderRadius:12, padding:'10px 14px', textDecoration:'none' }}>
                  <span style={{ fontSize:20 }}>📧</span>
                  <span style={{ fontSize:13, fontWeight:700, color:'#1D4ED8' }}>Email</span>
                </a>
                <a href={`https://www.facebook.com/dialog/send?link=${encodeURIComponent(refLink)}&app_id=966242223397198&redirect_uri=${encodeURIComponent(refLink)}`}
                  target="_blank" rel="noreferrer"
                  style={{ display:'flex', alignItems:'center', gap:10,
                    background:T.blueTint, border:'1.5px solid #BFDBFE',
                    borderRadius:12, padding:'10px 14px', textDecoration:'none' }}>
                  <span style={{ fontSize:20 }}>📘</span>
                  <span style={{ fontSize:13, fontWeight:700, color:'#1D4ED8' }}>Messenger</span>
                </a>
                <button onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(refLink)
                      setLinkCopied(true)
                      setTimeout(() => setLinkCopied(false), 2500)
                    } catch(_e) {
                      const el = document.createElement('input')
                      el.value = refLink; document.body.appendChild(el)
                      el.select(); document.execCommand('copy')
                      document.body.removeChild(el)
                      setLinkCopied(true)
                      setTimeout(() => setLinkCopied(false), 2500)
                    }
                  }}
                  style={{ display:'flex', alignItems:'center', gap:10,
                    background: linkCopied ? T.primaryTint : T.soft,
                    border: linkCopied ? '1.5px solid #D6D2FF' : `1.5px solid ${T.border}`,
                    borderRadius:12, padding:'10px 14px', cursor:'pointer', fontFamily:'inherit' }}>
                  <span style={{ fontSize:20 }}>{linkCopied ? '✅' : '🔗'}</span>
                  <div style={{ flex:1, textAlign:'left' }}>
                    <div style={{ fontSize:13, fontWeight:700,
                      color: linkCopied ? T.primaryDark : '#374151' }}>
                      {linkCopied
                        ? (isFR ? 'Lien copié !' : 'Link copied!')
                        : (isFR ? 'Copier le lien' : 'Copy link')}
                    </div>
                    <div style={{ fontSize:10, color:T.faint, marginTop:1 }}>
                      nynly.app?ref={profile.referral_code}
                    </div>
                  </div>
                </button>
                {typeof navigator !== 'undefined' && navigator.share && (
                  <button onClick={async () => {
                      try { await navigator.share({ title:'Nynly', text:msg, url:refLink }) }
                      catch(_e) {}
                    }}
                    style={{ display:'flex', alignItems:'center', gap:10,
                      background:T.ink, border:'none',
                      borderRadius:12, padding:'10px 14px', cursor:'pointer', fontFamily:'inherit' }}>
                    <span style={{ fontSize:20 }}>📤</span>
                    <span style={{ fontSize:13, fontWeight:700, color:'white' }}>
                      {isFR ? 'Partager via...' : 'Share via...'}
                    </span>
                  </button>
                )}
              </div>
            )
          })()}
        </div>
      )}

      {/* Statut de vérification Checkr (worker seulement)
          5 états : rejected / verified / inProgress / non payé + Stripe KO / non payé + Stripe OK */}
      {isWorker && (() => {
        const paid          = !!profile?.background_check_paid_at
        const stripeReady   = !!profile?.stripe_account_id
        const verified      = paid && profile?.checkr_status === 'clear'
        const inProgress    = paid && !verified
        const rejected      = profile?.checkr_status === 'consider' || profile?.checkr_status === 'rejected'

        return (
          <div style={{ background:'white', border:`1.5px solid ${T.border}`,
            borderRadius:T.rM, padding:'16px', marginBottom:8 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
              <Icon name="search" size={20} color={T.primary} />
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:800, fontSize:14, color:T.text }}>
                  {isFR ? "Vérification d'antécédents"
                   : isES ? 'Verificación de antecedentes'
                   : 'Background check'}
                </div>
                <div style={{ fontSize:11, color:T.faint, marginTop:2 }}>
                  {verified
                    ? (isFR ? '✅ Vérifiée' : isES ? '✅ Verificada' : '✅ Verified')
                    : inProgress
                    ? (isFR ? '⏳ En cours…' : isES ? '⏳ En curso…' : '⏳ In progress…')
                    : (isFR ? 'Non vérifié' : isES ? 'No verificado' : 'Not verified')}
                </div>
              </div>
              {verified && (
                <span style={{ background:T.primaryTint, color:T.primaryDark,
                  border:'1px solid #D6D2FF', borderRadius:99,
                  padding:'4px 10px', fontSize:11, fontWeight:700, flexShrink:0 }}>
                  ✓ {isFR ? 'Vérifié' : isES ? 'Verificado' : 'Verified'}
                </span>
              )}
            </div>

            {rejected && (
              <div style={{ background:'#fef2f2', border:'1.5px solid #fecaca',
                borderRadius:10, padding:'10px 12px', fontSize:12, color:'#B91C1C', lineHeight:1.6 }}>
                ⚠️ {isFR ? "Votre vérification n'a pas pu être validée. Consultez l'email envoyé par notre équipe pour la procédure à suivre."
                   : isES ? 'Su verificación no pudo ser validada. Consulte el correo enviado por nuestro equipo.'
                   : 'Your verification could not be validated. Check the email from our team for next steps.'}
              </div>
            )}

            {!rejected && verified && (
              <div style={{ fontSize:12, color:'#6b7280', lineHeight:1.6 }}>
                {isFR ? 'Votre profil est vérifié. Vous pouvez accepter des missions.'
                 : isES ? 'Tu perfil está verificado. Puedes aceptar trabajos.'
                 : 'Your profile is verified. You can accept jobs.'}
              </div>
            )}

            {!rejected && inProgress && (
              <div style={{ background:'rgba(245,158,11,.08)', border:'1px solid rgba(245,158,11,.3)',
                borderRadius:10, padding:'10px 12px', fontSize:12, color:'#78350f', lineHeight:1.6 }}>
                ⏳ {isFR ? 'Votre vérification est en cours (24-72h). Vous recevrez un email dès validation.'
                    : isES ? 'Su verificación está en curso (24-72h). Recibirá un correo al validarse.'
                    : 'Your verification is in progress (24-72h). You will receive an email once validated.'}
              </div>
            )}

            {!paid && !rejected && (<>
              <div style={{ fontSize:12, color:'#6b7280', lineHeight:1.7, marginBottom:12 }}>
                {isFR
                  ? "Pour accepter des missions, une vérification Checkr est requise ($69, entièrement récupéré sur vos premières commissions). Elle prend 24 à 72h."
                  : isES
                  ? 'Para aceptar trabajos, se requiere una verificación Checkr ($69, recuperado en sus primeras comisiones). Toma 24-72h.'
                  : 'To accept jobs, a Checkr verification is required ($69, fully recovered through your first commissions). Takes 24-72h.'}
              </div>

              <div style={{ background:'rgba(245,158,11,.08)', border:'1px solid rgba(245,158,11,.3)',
                borderRadius:10, padding:'10px 12px', marginBottom:14 }}>
                <div style={{ fontSize:11.5, color:'#78350f', lineHeight:1.6 }}>
                  ⏱️ <strong>{isFR ? 'À faire au moins 72h avant votre première mission.'
                       : isES ? 'Hacerlo al menos 72h antes de su primera misión.'
                       : 'Do this at least 72h before your first job.'}</strong>{' '}
                  {isFR ? "Sans quoi vous ne pourrez pas accepter les demandes à court terme."
                   : isES ? 'De lo contrario no podrá aceptar solicitudes a corto plazo.'
                   : "Otherwise you won't be able to accept short-notice requests."}
                </div>
              </div>

              <button
                onClick={() => stripeReady && setShowBgGate(true)}
                disabled={!stripeReady}
                title={!stripeReady
                  ? (isFR ? 'Configurez d\'abord votre compte bancaire (Paiements)'
                     : isES ? 'Primero configura tu cuenta bancaria'
                     : 'Set up your bank account first')
                  : ''}
                style={{ width:'100%', padding:'13px 16px', borderRadius:12,
                  background: stripeReady ? T.primary : '#E5E7EB',
                  border:'none',
                  color: stripeReady ? 'white' : '#9CA3AF',
                  fontWeight:800, fontSize:14,
                  cursor: stripeReady ? 'pointer' : 'not-allowed',
                  fontFamily:'inherit',
                  boxShadow: stripeReady ? '0 6px 18px rgba(108,99,255,.35)' : 'none' }}>
                {isFR ? '🔐 Lancer ma vérification ($69)'
                 : isES ? '🔐 Iniciar verificación ($69)'
                 : '🔐 Start my verification ($69)'}
              </button>

              {!stripeReady && (
                <div style={{ fontSize:11, color:T.faint, marginTop:8, textAlign:'center', lineHeight:1.5 }}>
                  ⚠️ {isFR ? 'Configurez d\'abord votre compte bancaire dans l\'app pour recevoir vos paiements.'
                      : isES ? 'Primero configure su cuenta bancaria para recibir sus pagos.'
                      : 'Set up your bank account first to receive your payments.'}
                </div>
              )}
            </>)}
          </div>
        )
      })()}

      {/* Thimble */}
      {isWorker && thimbleActive && (
        <div style={{ background:'white', border:`1.5px solid ${T.border}`,
          borderRadius:T.rM, padding:'16px', marginBottom:8 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
            <Icon name="shield" size={20} color={T.primary} />
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:800, fontSize:14, color:T.text }}>{t('thimble_opt_title')}</div>
              <div style={{ fontSize:11, color:T.faint, marginTop:2 }}>{t('thimble_opt_sub')}</div>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'flex-start', gap:10,
            background:T.soft, borderRadius:T.rS, padding:'10px 12px', marginBottom:8 }}>
            <input type="checkbox" id="own-ins"
              checked={profile?.own_insurance || false} disabled={savingThimbleOpt}
              onChange={e => {
                toggleThimbleOpt('own_insurance', e.target.checked)
                if (e.target.checked) toggleThimbleOpt('thimble_opted_in', false)
              }}
              style={{ marginTop:3, flexShrink:0, accentColor:T.primary, width:16, height:16 }} />
            <label htmlFor="own-ins" style={{ fontSize:13, color:'#374151',
              cursor:'pointer', lineHeight:1.5 }}>
              {t('thimble_own_ins')}
            </label>
          </div>
          {!profile?.own_insurance && (
            <div style={{ display:'flex', alignItems:'flex-start', gap:10,
              background: profile?.thimble_opted_in ? T.primaryTint : T.soft,
              border: profile?.thimble_opted_in ? '1px solid #D6D2FF' : '1px solid transparent',
              borderRadius:T.rS, padding:'10px 12px' }}>
              <input type="checkbox" id="thimble-opt"
                checked={profile?.thimble_opted_in || false} disabled={savingThimbleOpt}
                onChange={e => toggleThimbleOpt('thimble_opted_in', e.target.checked)}
                style={{ marginTop:3, flexShrink:0, accentColor:T.primary, width:16, height:16 }} />
              <div>
                <label htmlFor="thimble-opt" style={{ fontSize:13, color:'#374151',
                  cursor:'pointer', fontWeight:600, display:'block', marginBottom:4 }}>
                  {t('thimble_opt_in')}
                </label>
                {profile?.thimble_opted_in && (
                  <div style={{ fontSize:11, color:T.primaryDark }}>{t('thimble_terms')}</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}


      {/* Références */}
      {isWorker && (
        <div style={{ background:'white', border:`1.5px solid ${T.border}`,
          borderRadius:T.rM, padding:'16px', marginBottom:8 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
            <Icon name="clipboard" size={20} color={T.primary} />
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:800, fontSize:14, color:T.text }}>{t('ref_add_title')}</div>
              <div style={{ fontSize:11, color:T.faint, marginTop:2 }}>
                {references.filter(r => r.status === 'responded').length > 0
                  ? references.filter(r => r.status === 'responded').length + ' ' + t('ref_badge')
                  : t('ref_empty')?.slice(0, 40) + '...'}
              </div>
            </div>
            {references.length < 3 && (
              <button onClick={() => setShowAddRef(!showAddRef)}
                style={{ background: showAddRef ? '#F3F4F6' : T.ink,
                  border:'none', color: showAddRef ? '#374151' : 'white',
                  borderRadius:T.rS, padding:'8px 14px', fontWeight:700,
                  fontSize:12, cursor:'pointer', fontFamily:'inherit', flexShrink:0 }}>
                {showAddRef ? '✕' : '+ ' + (isFR ? 'Ajouter' : 'Add')}
              </button>
            )}
          </div>
          {references.map(ref => (
            <div key={ref.id} style={{ display:'flex', alignItems:'center', gap:8,
              background:T.soft, borderRadius:T.rS, padding:'8px 12px',
              marginBottom:6, fontSize:12 }}>
              <span>{ref.status === 'responded' ? '✅' : '⏳'}</span>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700, color:T.text }}>{ref.referee_name}</div>
                <div style={{ color:T.faint, fontSize:11 }}>
                  {ref.referee_role === 'family'
                    ? (isFR ? 'Famille gardée' : 'Family cared for')
                    : ref.referee_role === 'employer'
                    ? (isFR ? 'Employeur' : 'Employer')
                    : (isFR ? 'Collègue' : 'Colleague')}
                  {' · '}
                  {ref.status === 'responded'
                    ? (isFR ? 'Répondu ✅' : 'Responded ✅')
                    : (isFR ? 'En attente ⏳' : 'Pending ⏳')}
                </div>
              </div>
            </div>
          ))}
          {showAddRef && (
            <div style={{ marginTop:12, padding:14, background:T.soft,
              borderRadius:12, border:`1px solid ${T.border}` }}>
              <div style={{ marginBottom:10 }}>
                <label style={{ fontSize:11, fontWeight:700, color:'#374151',
                  display:'block', marginBottom:4 }}>{t('ref_name_label')} *</label>
                <input value={refName} onChange={e => setRefName(e.target.value)}
                  placeholder={isFR ? 'Jean Dupont' : 'John Smith'}
                  style={{ width:'100%', padding:'10px 12px', border:`1.5px solid ${T.border}`,
                    borderRadius:T.rS, fontSize:13, fontFamily:'inherit', outline:'none',
                    boxSizing:'border-box', background:'white' }} />
              </div>
              <div style={{ marginBottom:10 }}>
                <label style={{ fontSize:11, fontWeight:700, color:'#374151',
                  display:'block', marginBottom:4 }}>{t('ref_email_label')} *</label>
                <input value={refEmail} onChange={e => setRefEmail(e.target.value)} type="email"
                  placeholder="email@exemple.com"
                  style={{ width:'100%', padding:'10px 12px', border:`1.5px solid ${T.border}`,
                    borderRadius:T.rS, fontSize:13, fontFamily:'inherit', outline:'none',
                    boxSizing:'border-box', background:'white' }} />
              </div>
              <div style={{ marginBottom:14 }}>
                <label style={{ fontSize:11, fontWeight:700, color:'#374151',
                  display:'block', marginBottom:4 }}>{t('ref_role_label')}</label>
                <select value={refRole} onChange={e => setRefRole(e.target.value)}
                  style={{ width:'100%', padding:'10px 12px', border:`1.5px solid ${T.border}`,
                    borderRadius:T.rS, fontSize:13, fontFamily:'inherit', outline:'none',
                    boxSizing:'border-box', background:'white' }}>
                  <option value="family">{t('ref_role_family')}</option>
                  <option value="employer">{t('ref_role_employer')}</option>
                  <option value="colleague">{t('ref_role_colleague')}</option>
                </select>
              </div>
              <button onClick={handleSendRef} disabled={sendingRef}
                style={{ width:'100%', padding:'12px', borderRadius:12,
                  background: sendingRef ? '#E5E7EB' : T.ink,
                  border:'none', color:'white', fontWeight:700, fontSize:13,
                  cursor: sendingRef ? 'wait' : 'pointer', fontFamily:'inherit' }}>
                {sendingRef ? '⏳...' : t('ref_send_req')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Toggle disponibilité */}
      {isWorker && (
        <div style={{ background: online ? T.primaryTint : T.soft,
          border:`1.5px solid ${online ? '#D6D2FF' : T.border}`,
          borderRadius:T.rM, padding:14, marginBottom:16,
          display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:10, height:10, borderRadius:'50%',
              background: online ? T.primary : T.faint,
              boxShadow: online ? `0 0 0 4px rgba(108,99,255,.15)` : 'none' }} />
            <div>
              <div style={{ fontWeight:700, fontSize:13, color:T.text }}>
                {online ? 'Disponible' : 'Indisponible'}
              </div>
              <div style={{ fontSize:11, color:T.faint, marginTop:2 }}>
                {online ? 'Visible par les familles' : 'Non visible'}
              </div>
            </div>
          </div>
          <button onClick={toggleOnline}
            style={{ background: online ? T.redTint : T.primary,
              color: online ? '#EF4444' : 'white',
              border:'none', borderRadius:T.rS, padding:'10px 16px',
              fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>
            {online ? 'Pause' : 'Activer'}
          </button>
        </div>
      )}

      {/* Disponibilités + Calendrier blocage */}
      {isWorker && (
        <>
          <div style={{ background:'white', borderRadius:T.rL,
            border:`1.5px solid ${T.border}`, padding:'18px', marginBottom:10 }}>
            <WorkerAvailabilityEditor workerId={profile.id} lang={lang} />
          </div>
          <div style={{ background:'white', borderRadius:T.rL,
            border:`1.5px solid ${T.border}`, padding:'18px', marginBottom:12 }}>
            <WorkerCalendarBlocker
              workerId={profile.id}
              lang={lang}
              recurringDays={profile?.availability_days || []}
            />
          </div>
        </>
      )}

      {/* Edition profil */}
      {!editing ? (
        <>
          {[
            { l: isFR ? 'Ville' : 'City',      v: profile?.city || '-' },
            { l: isFR ? 'Téléphone' : 'Phone', v: profile?.phone || '-' },
            ...(!isWorker ? [] : [
              { l: isFR ? 'Rayon' : 'Radius',   v: `${profile?.service_radius_km || 10} km` },
              { l: isFR ? 'Véhicule' : 'Vehicle',v: profile?.has_vehicle ? (isFR?'Oui':'Yes') : (isFR?'Non':'No') },
              { l: isFR ? 'Langues' : 'Languages',
                v: (profile?.languages || []).length > 0
                  ? (profile.languages || []).map(l => LANG_OPTIONS.find(o => o.id === l)?.label || l).join(', ')
                  : '-' },
              { l: isFR ? 'Expérience' : 'Experience',
                v: profile?.years_experience
                  ? `${profile.years_experience} ${isFR ? 'ans' : 'yrs'}`
                  : '-' },
            ]),
          ].map(item => (
            <div key={item.l} style={{ display:'flex', justifyContent:'space-between',
              padding:'12px 0', borderBottom:'1px solid #F3F4F6' }}>
              <span style={{ fontSize:12, color:T.faint, fontWeight:600 }}>{item.l}</span>
              <span style={{ fontSize:13, color:'#374151', fontWeight:500,
                textAlign:'right', maxWidth:'60%' }}>{item.v}</span>
            </div>
          ))}

          {isWorker && (profile?.services_offered || []).length > 0 && (
            <div style={{ padding:'12px 0', borderBottom:'1px solid #F3F4F6' }}>
              <span style={{ fontSize:12, color:T.faint, fontWeight:600, display:'block', marginBottom:8 }}>
                {isFR ? 'Services' : isES ? 'Servicios' : 'Services'}
              </span>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {(profile.services_offered || []).map(svcId => {
                  const meta = SERVICE_META[svcId]
                  if (!meta) return null
                  const svcRate = profile?.service_rates?.[svcId]
                  return (
                    <div key={svcId} style={{ display:'flex', alignItems:'center',
                      justifyContent:'space-between', background:T.soft,
                      borderRadius:8, padding:'7px 10px' }}>
                      <span style={{ fontSize:13, color:'#374151',
                        display:'inline-flex', alignItems:'center', gap:7 }}>
                        <Icon name={meta.icon} size={14} color={meta.color} />
                        {serviceLabel(svcId, lang)}
                      </span>
                      <span style={{ fontSize:13, fontWeight:700, color:T.primaryDark }}>
                        {svcRate ? `${sym}${svcRate}/h` : (isFR ? 'Non renseigné' : 'Not set')}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          <button onClick={() => setEditing(true)}
            style={{ width:'100%', padding:12, borderRadius:T.rM, marginTop:16,
              background:'white', border:`1.5px solid ${T.primary}`, color:T.primaryDark,
              fontWeight:700, fontSize:14, cursor:'pointer', fontFamily:'inherit' }}>
            ✏️ {isFR ? 'Modifier mon profil' : 'Edit my profile'}
          </button>
        </>
      ) : (
        <>
          <div>
            <label style={labelStyle}>Bio</label>
            <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3}
              style={{ ...inputStyle, resize:'vertical', marginBottom:12 }} />
            <label style={labelStyle}>{isFR ? 'Ville' : 'City'}</label>
            <div style={{ marginBottom:12 }}>
              <CityAutocomplete
                value={city}
                onChange={setCity}
                onSelect={(c) => { setCity(c.city); setCityMeta(c) }}
                placeholder={isFR ? 'Ex: Tampa, Miami...' : 'e.g. Tampa, Miami...'}
                lang={lang}
              />
            </div>
            <label style={labelStyle}>{isFR ? 'Téléphone' : 'Phone'}</label>
            <input value={phone} onChange={e => setPhone(e.target.value)}
              style={{ ...inputStyle, marginBottom:12 }} />
            {isWorker && (
              <>
                <label style={labelStyle}>{isFR ? 'Mes services' : isES ? 'Mis servicios' : 'My services'}</label>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:16 }}>
                  {SERVICE_IDS.map(svcId => {
                    const meta = SERVICE_META[svcId]
                    const sel = editServices.includes(svcId)
                    return (
                      <button key={svcId}
                        onClick={() => setEditServices(prev =>
                          prev.includes(svcId) ? prev.filter(s => s !== svcId) : [...prev, svcId]
                        )}
                        style={{ padding:'10px', borderRadius:T.rS, textAlign:'center',
                          border:`2px solid ${sel ? T.primary : T.border}`,
                          background: sel ? T.primaryTint : 'white',
                          cursor:'pointer', fontFamily:'inherit', fontSize:12,
                          fontWeight: sel ? 700 : 500,
                          display:'flex', alignItems:'center', justifyContent:'center', gap:7,
                          color: sel ? T.primaryDark : '#374151' }}>
                        <Icon name={meta.icon} size={15}
                          color={sel ? T.primaryDark : meta.color} />
                        {serviceLabel(svcId, lang)}
                      </button>
                    )
                  })}
                </div>

                {editServices.length > 0 && (
                  <>
                    <label style={labelStyle}>{isFR ? 'Tarif par service' : isES ? 'Tarifa por servicio' : 'Rate per service'} ({sym}/h)</label>
                    <div style={{ marginBottom:12 }}>
                      {editServices.map(svcId => {
                        const meta = SERVICE_META[svcId]
                        if (!meta) return null
                        return (
                          <div key={svcId} style={{ display:'flex', alignItems:'center',
                            gap:10, marginBottom:8, background:T.soft,
                            border:`1.5px solid ${T.border}`, borderRadius:T.rS,
                            padding:'8px 12px' }}>
                            <Icon name={meta.icon} size={17} color={meta.color} />
                            <span style={{ fontSize:12, fontWeight:600, color:'#374151', flex:1 }}>
                              {serviceLabel(svcId, lang)}
                            </span>
                            <input type="number"
                              value={editRates[svcId] || ''}
                              onChange={e => setEditRates(prev => ({ ...prev, [svcId]: e.target.value }))}
                              placeholder="20"
                              min="5" max="500"
                              style={{ width:70, padding:'6px 8px',
                                border:`1.5px solid ${T.border}`, borderRadius:8,
                                fontSize:13, fontFamily:"'Poppins',sans-serif",
                                outline:'none', textAlign:'center', background:'white' }} />
                            <span style={{ fontSize:11, color:T.faint }}>{sym}/h</span>
                          </div>
                        )
                      })}
                    </div>
                  </>
                )}

                <label style={labelStyle}>
                  {isFR ? 'Langues parlées' : isES ? 'Idiomas' : 'Languages spoken'}
                </label>
                <ChipPicker options={LANG_OPTIONS} value={languages}
                  onToggle={toggleIn(setLanguages)} getLabel={o => o.label} />

                <label style={labelStyle}>
                  {isFR ? "Années d'expérience" : isES ? 'Años de experiencia' : 'Years of experience'}
                </label>
                <input type="number" min="0" max="50" value={yearsExp}
                  onChange={e => setYearsExp(e.target.value)}
                  placeholder={isFR ? 'Ex: 3' : 'e.g. 3'}
                  style={{ ...inputStyle, marginBottom:14, maxWidth:120 }} />

                <label style={labelStyle}>
                  {isFR ? 'Diplômes & certifications' : isES ? 'Títulos y certificaciones' : 'Diplomas & certifications'}
                </label>
                {certs.length > 0 && (
                  <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:8 }}>
                    {certs.map((c, i) => (
                      <span key={i} style={{ display:'inline-flex', alignItems:'center', gap:6,
                        background: c?.verified ? '#ECFDF5' : T.soft,
                        border:`1px solid ${c?.verified ? '#A7F3D0' : T.border}`,
                        borderRadius:99, padding:'5px 8px 5px 12px',
                        fontSize:12, fontWeight:600,
                        color: c?.verified ? '#047857' : '#374151' }}>
                        {c?.name || c}
                        {c?.verified
                          ? <Icon name="check" size={11} color="#047857" strokeWidth={3} />
                          : (
                            <button type="button"
                              onClick={() => setCerts(prev => prev.filter((_, j) => j !== i))}
                              style={{ background:'none', border:'none', padding:2,
                                cursor:'pointer', display:'flex' }}>
                              <Icon name="x" size={11} color={T.faint} />
                            </button>
                          )}
                      </span>
                    ))}
                  </div>
                )}
                <div style={{ display:'flex', gap:8, marginBottom:8 }}>
                  <input value={certInput} onChange={e => setCertInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCert(certInput) } }}
                    placeholder={isFR ? 'Ex: CAP Petite Enfance' : 'e.g. CPR / First Aid'}
                    style={{ ...inputStyle, marginBottom:0, flex:1 }} />
                  <button type="button" onClick={() => addCert(certInput)}
                    style={{ background:T.primary, border:'none', color:'white',
                      borderRadius:T.rS, padding:'0 16px', fontWeight:700, fontSize:13,
                      cursor:'pointer', fontFamily:'inherit', flexShrink:0 }}>
                    + {isFR ? 'Ajouter' : 'Add'}
                  </button>
                </div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:6 }}>
                  {(CERT_SUGGESTIONS[isFR ? 'FR' : 'US'] || [])
                    .filter(s => !certs.some(c => (c?.name || c) === s))
                    .map(s => (
                      <button key={s} type="button" onClick={() => addCert(s)}
                        style={{ background:'white', border:`1.5px dashed ${T.border}`,
                          borderRadius:99, padding:'4px 11px', fontSize:11,
                          color:T.sub, cursor:'pointer', fontFamily:'inherit' }}>
                        + {s}
                      </button>
                    ))}
                </div>
                <div style={{ fontSize:10.5, color:T.faint, marginBottom:14, lineHeight:1.5 }}>
                  {isFR
                    ? 'Affiché comme "déclaré" sur votre profil. Le badge "Vérifié" est ajouté après validation du justificatif par notre équipe.'
                    : 'Shown as "self-reported" on your profile. The "Verified" badge is added after our team reviews your document.'}
                </div>

                {(editServices.includes('childcare') || editServices.includes('nanny')) && (
                  <>
                    <label style={labelStyle}>
                      {isFR ? "Tranches d'âge acceptées" : isES ? 'Edades aceptadas' : 'Age ranges you accept'}
                    </label>
                    <ChipPicker options={AGE_OPTIONS} value={ageRanges}
                      onToggle={toggleIn(setAgeRanges)} getLabel={optLabel} />
                  </>
                )}

                {editServices.includes('petsitter') && (
                  <>
                    <label style={labelStyle}>
                      {isFR ? 'Animaux gardés' : isES ? 'Mascotas' : 'Pets you care for'}
                    </label>
                    <ChipPicker options={PET_OPTIONS} value={petTypes}
                      onToggle={toggleIn(setPetTypes)} getLabel={optLabel} />
                  </>
                )}

                {editServices.includes('handyman') && (
                  <>
                    <label style={labelStyle}>
                      {isFR ? 'Travaux proposés' : isES ? 'Trabajos ofrecidos' : 'Handyman skills'}
                    </label>
                    <ChipPicker options={HANDY_OPTIONS} value={handySkills}
                      onToggle={toggleIn(setHandySkills)} getLabel={optLabel} />
                    <div style={{ fontSize:10.5, color:T.faint, marginTop:-8, marginBottom:14, lineHeight:1.5 }}>
                      {isFR
                        ? 'Plomberie et électricité : petites réparations uniquement (les travaux licenciés exigent une licence d\'État en Floride).'
                        : 'Plumbing & electrical: minor repairs only (licensed trade work requires a Florida state license).'}
                    </div>
                  </>
                )}

                {[
                  { g:'childcare',   show: editServices.includes('childcare') || editServices.includes('nanny') },
                  { g:'seniorcare',  show: editServices.includes('seniorcare') },
                  { g:'cleaning',    show: editServices.includes('cleaning') },
                  { g:'lawn',        show: editServices.includes('lawn') },
                  { g:'errands',     show: editServices.includes('errands') },
                  { g:'hairdresser', show: editServices.includes('hairdresser') },
                  { g:'tutoring',    show: editServices.includes('tutoring') },
                  { g:'fitness',     show: editServices.includes('fitness') },
                  { g:'housesitting',show: editServices.includes('housesitting') },
                ].filter(x => x.show).map(({ g }) => {
                  const grp = SKILL_GROUPS[g]
                  return (
                    <div key={g}>
                      <label style={labelStyle}>
                        {grp.label[isFR ? 'fr' : isES ? 'es' : 'en']}
                      </label>
                      <ChipPicker options={grp.options} value={svcSkills[g]}
                        onToggle={id => toggleSvcSkill(g, id)} getLabel={optLabel} />
                      {g === 'seniorcare' && (
                        <div style={{ fontSize:10.5, color:T.faint, marginTop:-8, marginBottom:14, lineHeight:1.5 }}>
                          {isFR
                            ? 'Aide non médicale uniquement. Les soins personnels et l\'administration de médicaments relèvent du home health care réglementé (licence AHCA en Floride).'
                            : 'Non-medical companion care only. Personal care and medication administration are regulated home health care (AHCA license in Florida).'}
                        </div>
                      )}
                      {g === 'hairdresser' && (
                        <div style={{ fontSize:10.5, color:T.faint, marginTop:-8, marginBottom:14, lineHeight:1.5 }}>
                          {isFR
                            ? 'Coupes : licence de cosmétologie Floride requise (justificatif vérifié par notre équipe). Tresses : aucune licence requise. Pas de services chimiques à domicile.'
                            : 'Haircuts: Florida cosmetology license required (document reviewed by our team). Braiding: no license needed. No chemical services at home.'}
                        </div>
                      )}
                      {g === 'fitness' && (
                        <div style={{ fontSize:10.5, color:T.faint, marginTop:-8, marginBottom:14, lineHeight:1.5 }}>
                          {isFR
                            ? 'Ajoutez vos certifications (NASM, ACE...) dans la section Diplômes & certifications ci-dessus. Assurance RC recommandée.'
                            : 'Add your certifications (NASM, ACE...) in the Diplomas & certifications section above. Liability insurance recommended.'}
                        </div>
                      )}
                      {g === 'cleaning' && (
                        <button onClick={() => setCleanOwnSupplies(!cleanOwnSupplies)} type="button"
                          style={{ width:'100%', display:'flex', alignItems:'center',
                            justifyContent:'space-between', padding:'11px 14px',
                            background: cleanOwnSupplies ? T.primaryTint : T.soft,
                            border:`1.5px solid ${cleanOwnSupplies ? '#D6D2FF' : T.border}`,
                            borderRadius:12, cursor:'pointer', fontFamily:'inherit',
                            marginBottom:14, marginTop:-4 }}>
                          <span style={{ fontSize:12.5, fontWeight:600,
                            color: cleanOwnSupplies ? T.primaryDark : '#374151' }}>
                            {isFR ? 'J\'apporte mon propre matériel de ménage' : 'I bring my own cleaning supplies'}
                          </span>
                          <div style={{ width:20, height:20, borderRadius:'50%', flexShrink:0,
                            background: cleanOwnSupplies ? T.primary : '#E5E7EB',
                            display:'flex', alignItems:'center', justifyContent:'center' }}>
                            {cleanOwnSupplies && <Icon name="check" size={11} color="white" strokeWidth={3} />}
                          </div>
                        </button>
                      )}
                      {g === 'lawn' && (
                        <button onClick={() => setLawnOwnEquipment(!lawnOwnEquipment)} type="button"
                          style={{ width:'100%', display:'flex', alignItems:'center',
                            justifyContent:'space-between', padding:'11px 14px',
                            background: lawnOwnEquipment ? T.primaryTint : T.soft,
                            border:`1.5px solid ${lawnOwnEquipment ? '#D6D2FF' : T.border}`,
                            borderRadius:12, cursor:'pointer', fontFamily:'inherit',
                            marginBottom:14, marginTop:-4 }}>
                          <span style={{ fontSize:12.5, fontWeight:600,
                            color: lawnOwnEquipment ? T.primaryDark : '#374151' }}>
                            {isFR ? 'Je possède mon matériel (tondeuse, etc.)' : 'I own my equipment (mower, etc.)'}
                          </span>
                          <div style={{ width:20, height:20, borderRadius:'50%', flexShrink:0,
                            background: lawnOwnEquipment ? T.primary : '#E5E7EB',
                            display:'flex', alignItems:'center', justifyContent:'center' }}>
                            {lawnOwnEquipment && <Icon name="check" size={11} color="white" strokeWidth={3} />}
                          </div>
                        </button>
                      )}
                    </div>
                  )
                })}

                <label style={labelStyle}>{isFR ? "Mode d'intervention" : 'Service mode'}</label>
                <ServiceLocationSelector value={loc}
                  countryCode={isFR ? 'FR' : isES ? 'US' : (profile?.detected_country || 'US')}
                  onChange={setLoc} lang={lang} />

                <label style={labelStyle}>{isFR ? 'Rayon d\'action (km)' : 'Service radius (km)'}</label>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                  <input type="range" min="1" max="100" value={radius}
                    onChange={e => setRadius(e.target.value)}
                    style={{ flex:1, accentColor:T.primary }} />
                  <span style={{ fontSize:13, fontWeight:700, color:T.primaryDark,
                    minWidth:50, textAlign:'right' }}>{radius} km</span>
                </div>

                <label style={{ ...labelStyle, marginBottom:10 }}>
                  {isFR ? 'Bon à savoir' : isES ? 'Bueno saber' : 'Good to know'}
                </label>
                {[
                  { icon:'car',   on:hasVehicle, set:setHasVehicle,
                    yes: isFR ? "J'ai un véhicule" : 'I have a vehicle',
                    no:  isFR ? 'Pas de véhicule' : 'No vehicle' },
                  { icon:'check', on:nonSmoker, set:setNonSmoker,
                    yes: isFR ? 'Non-fumeur' : isES ? 'No fumador' : 'Non-smoker',
                    no:  isFR ? 'Fumeur / non précisé' : 'Smoker / not specified' },
                  { icon:'paw',   on:okPets, set:setOkPets,
                    yes: isFR ? "À l'aise avec les animaux" : 'Comfortable with pets',
                    no:  isFR ? 'Pas à l\'aise avec les animaux' : 'Not comfortable with pets' },
                ].map((tg, i) => (
                  <button key={i} onClick={() => tg.set(!tg.on)} type="button"
                    style={{ width:'100%', display:'flex', alignItems:'center',
                      justifyContent:'space-between', padding:'12px 14px',
                      background: tg.on ? T.primaryTint : T.soft,
                      border:`1.5px solid ${tg.on ? '#D6D2FF' : T.border}`,
                      borderRadius:12, cursor:'pointer', fontFamily:'inherit',
                      marginBottom:8 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                      <Icon name={tg.icon} size={17}
                        color={tg.on ? T.primaryDark : T.faint} />
                      <span style={{ fontSize:13, fontWeight:600,
                        color: tg.on ? T.primaryDark : '#374151' }}>
                        {tg.on ? tg.yes : tg.no}
                      </span>
                    </div>
                    <div style={{ width:20, height:20, borderRadius:'50%',
                      background: tg.on ? T.primary : '#E5E7EB',
                      display:'flex', alignItems:'center', justifyContent:'center' }}>
                      {tg.on && <Icon name="check" size={11} color="white" strokeWidth={3} />}
                    </div>
                  </button>
                ))}
              </>
            )}
          </div>
          <div style={{ display:'flex', gap:8, marginTop:16 }}>
            <button onClick={() => setEditing(false)}
              style={{ flex:1, padding:12, borderRadius:T.rM, background:'white',
                border:`1.5px solid ${T.border}`, color:'#374151',
                fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
              {isFR ? 'Annuler' : 'Cancel'}
            </button>
            <button onClick={saveProfile} disabled={saving}
              style={{ flex:2, padding:12, borderRadius:T.rM, border:'none',
                background: saving ? '#E5E7EB' : T.primary, color:'white',
                fontWeight:800, cursor: saving ? 'wait' : 'pointer', fontFamily:'inherit',
                boxShadow: saving ? 'none' : '0 6px 18px rgba(108,99,255,.35)' }}>
              {saving ? '⏳...' : (isFR ? 'Enregistrer' : 'Save')}
            </button>
          </div>
        </>
      )}

      {/* Navigation avancée */}
      <div style={{ marginTop:24 }}>
        {[
          { icon:'clipboard', label: isFR ? 'Mes documents fiscaux' : 'Tax documents', path:'/invoices' },
          { icon:'shield',    label: isFR ? 'Mes litiges' : 'My disputes',             path:'/dispute' },
          ...(isWorker ? [] : [{ icon:'star', label: isFR ? 'Gérer mon abonnement' : isES ? 'Gestionar suscripción' : 'Manage subscription', path:'/subscription' }]),
        ].map(item => (
          <button key={item.path} onClick={() => navigate?.(item.path)}
            style={{ width:'100%', display:'flex', alignItems:'center', gap:12,
              background:'white', border:`1.5px solid ${T.border}`, borderRadius:12,
              padding:'12px 14px', marginBottom:8, cursor:'pointer',
              fontFamily:'inherit', textAlign:'left' }}>
            <Icon name={item.icon} size={18} color={T.sub} />
            <span style={{ fontSize:13, color:'#374151', fontWeight:600 }}>{item.label}</span>
            <span style={{ marginLeft:'auto', display:'flex' }}>
              <Icon name="chevron" size={15} color="#D1D5DB" />
            </span>
          </button>
        ))}

        {/* Langue */}
        <div style={{ background:'white', border:`1.5px solid ${T.border}`,
          borderRadius:T.rM, padding:'14px 16px', marginTop:8, marginBottom:8 }}>
          <div style={{ fontSize:11, fontWeight:700, color:T.faint,
            textTransform:'uppercase', letterSpacing:'.07em', marginBottom:10,
            display:'flex', alignItems:'center', gap:6 }}>
            <Icon name="globe" size={13} color={T.faint} />
            {isFR ? 'Langue' : 'Language'}
          </div>
          <div style={{ display:'flex', gap:8 }}>
            {[
              { code:'fr', flag:'🇫🇷', label:'Français' },
              { code:'en', flag:'🇺🇸', label:'English'  },
              { code:'es', flag:'🇪🇸', label:'Español'  },
            ].map(l => (
              <button key={l.code}
                onClick={async () => {
                  try {
                    await supabase.from('profiles')
                      .update({ preferred_lang: l.code }).eq('id', profile.id)
                    setProfile({ ...profile, preferred_lang: l.code })
                  } catch (err) { console.warn('[lang update]', err?.message) }
                  toast(t('profile_saved'))
                  setTimeout(() => window.location.reload(), 800)
                }}
                style={{ flex:1, padding:'10px 8px', borderRadius:12, textAlign:'center',
                  border:`2px solid ${lang===l.code ? T.primary : T.border}`,
                  background: lang===l.code ? T.primaryTint : 'white',
                  cursor:'pointer', fontFamily:'inherit', transition:'all .15s' }}>
                <div style={{ fontSize:22, marginBottom:3 }}>{l.flag}</div>
                <div style={{ fontSize:12, fontWeight:lang===l.code?700:500,
                  color:lang===l.code?T.primaryDark:'#374151' }}>{l.label}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Liens légaux */}
        <div style={{ textAlign:'center', padding:'8px 0 4px', fontSize:11, color:T.faint }}>
          <a href="/privacy.html" target="_blank"
            style={{ color:T.faint, textDecoration:'none' }}>
            {isFR ? 'Confidentialité' : 'Privacy'}
          </a>
          {' · '}
          <a href="/terms.html" target="_blank"
            style={{ color:T.faint, textDecoration:'none' }}>
            {isFR ? 'CGU' : 'Terms'}
          </a>
          {' · v1.0'}
        </div>

        {/* RGPD */}
        <div style={{ borderTop:`1px solid ${T.border}`, paddingTop:20, marginTop:8 }}>
          <div style={{ fontSize:11, fontWeight:700, letterSpacing:'1.5px',
            textTransform:'uppercase', color:T.sub, marginBottom:12 }}>
            {isFR ? 'Vos données' : 'Your data'}
          </div>
          <button onClick={async () => {
              try {
                const { data, error } = await supabase.rpc('export_user_data', { p_user_id: userId })
                if (error) throw error
                const blob = new Blob([buildGdprHtml(data, isFR)], { type:'text/html;charset=utf-8' })
                const url  = URL.createObjectURL(blob)
                const a    = document.createElement('a')
                a.href = url; a.download = 'nynly-mes-donnees.html'; a.click()
                URL.revokeObjectURL(url)
              } catch (e) {
                toast('⚠️ ' + (e?.message || 'Erreur export'))
              }
            }}
            style={{ width:'100%', padding:11, borderRadius:12, marginBottom:8,
              background:'rgba(37,99,235,.06)', border:'1.5px solid rgba(37,99,235,.2)',
              color:T.blue, fontWeight:600, fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>
            📥 {isFR ? 'Télécharger mes données (RGPD)' : 'Download my data (GDPR)'}
          </button>

          <details style={{ marginBottom:12 }}>
            <summary style={{ fontSize:12, color:T.red, cursor:'pointer',
              fontWeight:600, listStyle:'none', userSelect:'none' }}>
              ⚠️ {isFR ? 'Supprimer mon compte' : 'Delete my account'}
            </summary>
            <div style={{ marginTop:10, background:'rgba(220,38,38,.05)',
              border:'1.5px solid rgba(220,38,38,.2)', borderRadius:12, padding:14 }}>
              <p style={{ fontSize:12, color:'#B91C1C', lineHeight:1.7, marginBottom:12 }}>
                {isFR
                  ? 'La suppression est irréversible. Impossible si vous avez des missions en cours.'
                  : 'Deletion is irreversible. Not possible with active missions.'}
              </p>
              <button onClick={async () => {
                  if (!window.confirm(isFR
                    ? 'Confirmer la suppression définitive de votre compte ?'
                    : 'Confirm permanent account deletion?')) return
                  try {
                    const { data, error } = await supabase.rpc('delete_user_account', { p_user_id: userId })
                    if (error || !data?.ok) {
                      if (data?.error === 'active_contracts') {
                        toast(isFR ? 'Impossible : missions en cours' : 'Cannot delete: active missions')
                      } else throw error || new Error(data?.error)
                      return
                    }
                    await supabase.auth.signOut()
                  } catch (e) { toast('⚠️ ' + (e?.message || 'Erreur')) }
                }}
                style={{ width:'100%', padding:10, borderRadius:T.rS,
                  background:'transparent', border:`1.5px solid ${T.red}`,
                  color:T.red, fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>
                🗑️ {isFR ? 'Confirmer la suppression' : 'Confirm deletion'}
              </button>
            </div>
          </details>
        </div>

        {/* Déconnexion */}
        <button onClick={handleSignOut}
          style={{ width:'100%', padding:12, borderRadius:12,
            background:T.redTint, border:'1.5px solid #FECACA', color:T.red,
            fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>
          {isFR ? 'Se déconnecter' : isES ? 'Cerrar sesión' : 'Sign out'}
        </button>
      </div>

      {/* Modal Checkr (proactif depuis profil) */}
      {showBgGate && (
        <BackgroundCheckGate profile={profile} lang={lang}
          onClose={() => setShowBgGate(false)} />
      )}

      {/* Modal Guide "Comment ça marche ?" (worker ou famille selon le rôle) */}
      {showGuide && (
        <PlatformGuide
          role={isWorker ? 'worker' : 'family'}
          lang={lang}
          mode="modal"
          onClose={() => setShowGuide(false)}
        />
      )}
    </div>
  )
}

const inputStyle = {
  width:'100%', padding:'12px 14px', background:'white',
  border:'1.5px solid #E7EAF0', borderRadius:12, fontSize:14,
  fontFamily:"'Poppins',sans-serif", outline:'none', boxSizing:'border-box',
}
const labelStyle = {
  display:'block', fontSize:11, fontWeight:700, color:'#6B7280',
  textTransform:'uppercase', letterSpacing:'.07em', marginBottom:8,
}
