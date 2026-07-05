// theme.jsx — Design system Nynly v3
// Tokens + icônes SVG partagés. Pour changer la couleur de marque
// de TOUTE l'app : modifier uniquement T.primary / T.primaryDark / T.primaryTint.

export const T = {
  // Marque
  primary:     '#6C63FF',
  primaryDark: '#5546E8',
  primaryTint: '#F2F1FF',
  ink:         '#14122B',
  inkSoft:     '#262345',

  // Texte
  text:  '#111827',
  sub:   '#6B7280',
  faint: '#9CA3AF',

  // Surfaces
  card:   '#FFFFFF',
  soft:   '#F8FAFC',
  border: '#E7EAF0',

  // Sémantique
  amber:      '#D97706',
  amberTint:  '#FFFBEB',
  amberLine:  '#FDE68A',
  red:        '#DC2626',
  redTint:    '#FEF2F2',
  violet:     '#7C3AED',
  violetTint: '#F5F3FF',
  blue:       '#2563EB',
  blueTint:   '#EFF6FF',

  // Géométrie (grille 8pt)
  rS: 10, rM: 14, rL: 18, rXL: 24,
  shadow:     '0 2px 10px rgba(15,23,42,.05)',
  shadowLift: '0 12px 32px rgba(15,23,42,.10)',
}

// ── Icônes SVG (style trait, cohérent partout) ────────────────
const ICONS = {
  baby: <><path d="M9 12h.01M15 12h.01M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5"/><path d="M19 6.3a9 9 0 0 1 1.8 3.9 2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6A9 9 0 0 1 12 3c1 0 2 .2 3 .5"/></>,
  home: <><path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></>,
  paw: <><circle cx="7" cy="8" r="1.6"/><circle cx="12" cy="5.5" r="1.6"/><circle cx="17" cy="8" r="1.6"/><path d="M12 11c-3 0-5.5 2.6-5.5 5 0 1.7 1.3 3 3 3 .9 0 1.6-.4 2.5-.4s1.6.4 2.5.4c1.7 0 3-1.3 3-3 0-2.4-2.5-5-5.5-5z"/></>,
  heart: <path d="M12 21s-7-4.6-9.3-8.5C.9 9.4 2.5 5.5 6 5.5c2 0 3.4 1.1 4.2 2.3.4.6 1.2.6 1.6 0C12.6 6.6 14 5.5 16 5.5c3.5 0 5.1 3.9 3.3 7-2.3 3.9-7.3 8.5-7.3 8.5z"/>,
  sparkles: <><path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="m19 17 .8 2.2L22 20l-2.2.8L19 23l-.8-2.2L16 20l2.2-.8z"/></>,
  wrench: <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-2.4 2.6-2.6z"/>,
  leaf: <path d="M12 22v-7M12 15c-4 0-7-3-7-7V5c4 0 7 3 7 7m0 3c4 0 7-3 7-7V5c-4 0-7 3-7 7"/>,
  cart: <><path d="M3 7h13l3 4h2v6h-2M3 7v10h2M3 7l2-3h8l2 3"/><circle cx="9" cy="19" r="2"/><circle cx="18" cy="19" r="2"/></>,
  search: <><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></>,
  calendar: <><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></>,
  chat: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>,
  wallet: <><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/></>,
  user: <><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>,
  star: <path d="M12 17.3 6.2 20.6l1.1-6.5L2.6 9.5l6.5-.9L12 2.7l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5z"/>,
  video: <><path d="m22 8-6 4 6 4V8z"/><rect x="2" y="6" width="14" height="12" rx="2"/></>,
  camera: <><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></>,
  gift: <><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v9H5v-9M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5"/></>,
  share: <><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="m16 6-4-4-4 4M12 2v13"/></>,
  chevron: <path d="m9 18 6-6-6-6"/>,
  shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>,
  check: <path d="M20 6 9 17l-5-5"/>,
  alert: <><path d="m21.7 18-8-14a2 2 0 0 0-3.5 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3z"/><path d="M12 9v4M12 17h.01"/></>,
  phone: <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.08 4.18 2 2 0 0 1 4.06 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>,
  x: <path d="M18 6 6 18M6 6l12 12"/>,
  clipboard: <><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></>,
  link: <><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></>,
  mail: <><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></>,
  chart: <><path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/></>,
  scissors: <><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.12 15.88M14.8 14.8 20 20M8.12 8.12 12 12"/></>,
  book: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></>,
  dumbbell: <><path d="m6.5 6.5 11 11"/><path d="m21 21-1-1M3 3l1 1M18 22l4-4M2 6l4-4M3 10l7-7M14 21l7-7"/></>,
  key: <><circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3"/></>,
  globe: <><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18z"/></>,
  award: <><circle cx="12" cy="8" r="6"/><path d="m8.2 13.2-1.7 7.3 5.5-3 5.5 3-1.7-7.3"/></>,
  car: <><path d="M5 11 6.5 6.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11"/><path d="M3 17v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></>,
}

export function Icon({ name, size = 20, color = 'currentColor', strokeWidth = 1.9, style }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none"
      stroke={color} strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, display: 'block', ...style }}>
      {ICONS[name] || ICONS.clipboard}
    </svg>
  )
}

// ── Métadonnées des services ──────────────────────────────────
// ⚡ ACTIVATION COIFFURE : passer hidden:true → hidden:false sur la ligne
// 'hairdresser' ci-dessous, commit, et Vercel redéploie. C'est tout.
// (La migration SQL 5J doit avoir été exécutée — normalement déjà fait.)
export const SERVICE_META = {
  childcare:  { icon:'baby',     color:'#DB2777', tint:'#FDF2F8', fr:'Babysitter',     en:'Babysitter',  es:'Canguro' },
  nanny:      { icon:'home',     color:'#9333EA', tint:'#FAF5FF', fr:'Nounou',         en:'Nanny',       es:'Niñera fija' },
  petsitter:  { icon:'paw',      color:'#EA580C', tint:'#FFF7ED', fr:'Garde animaux',  en:'Pet Care',    es:'Mascotas' },
  seniorcare: { icon:'heart',    color:'#8B5CF6', tint:'#F5F3FF', fr:'Aide seniors',   en:'Senior Care', es:'Mayores' },
  cleaning:   { icon:'sparkles', color:'#0891B2', tint:'#ECFEFF', fr:'Ménage',         en:'Cleaning',    es:'Limpieza' },
  handyman:   { icon:'wrench',   color:'#D97706', tint:'#FFFBEB', fr:'Bricolage',      en:'Handyman',    es:'Manitas' },
  lawn:       { icon:'leaf',     color:'#16A34A', tint:'#F0FDF4', fr:'Jardinage',      en:'Lawn Care',   es:'Jardín' },
  errands:    { icon:'cart',     color:'#2563EB', tint:'#EFF6FF', fr:'Courses',        en:'Errands',     es:'Recados' },
  hairdresser:{ icon:'scissors', color:'#0EA5E9', tint:'#F0F9FF', fr:'Coiffure à domicile', en:'Hair at home', es:'Peluquería a domicilio', hidden:true },
  tutoring:   { icon:'book',     color:'#0D9488', tint:'#F0FDFA', fr:'Soutien scolaire', en:'Tutoring', es:'Clases particulares', hidden:true },
  fitness:    { icon:'dumbbell', color:'#E11D48', tint:'#FFF1F2', fr:'Coach sportif',    en:'Fitness coach', es:'Entrenador personal', hidden:true },
  housesitting:{ icon:'key',     color:'#A16207', tint:'#FEF9C3', fr:'Garde de maison',  en:'House sitting', es:'Cuidado de casa', hidden:true },
}

// Liste des services visibles (exclut les services dormants)
export const VISIBLE_SERVICE_IDS = Object.keys(SERVICE_META)
  .filter(id => !SERVICE_META[id].hidden)

// ── Sous-compétences par service (source unique de vérité) ────
// Utilisé par ProfileScreen (édition), WorkerOnboarding (inscription),
// WorkerProfile (affichage) et SearchResults (filtres familles).
// Les tranches d'âge (childcare_age_ranges), types d'animaux (pet_types)
// et bricolage (handyman_skills) gardent leur câblage existant.
export const SKILL_GROUPS = {
  childcare: {
    column:'childcare_skills', icon:'baby',
    label:{ fr:'Compétences garde d\'enfants', en:'Childcare skills', es:'Habilidades de cuidado' },
    options:[
      { id:'homework_help',  fr:'Aide aux devoirs',          en:'Homework help',       es:'Ayuda con tareas' },
      { id:'school_driving', fr:'Conduite école/activités',  en:'School & activity driving', es:'Transporte escuela/actividades' },
      { id:'overnight',      fr:'Garde de nuit',             en:'Overnight care',      es:'Cuidado nocturno' },
    ],
  },
  seniorcare: {
    column:'seniorcare_skills', icon:'heart',
    label:{ fr:'Aide proposée', en:'Care offered', es:'Ayuda ofrecida' },
    // Companion care NON médical uniquement (AHCA Floride) :
    // rappels de médicaments OUI, administration JAMAIS.
    options:[
      { id:'companionship',     fr:'Compagnie & présence',      en:'Companionship',          es:'Compañía' },
      { id:'meals',             fr:'Préparation de repas',      en:'Meal preparation',       es:'Preparación de comidas' },
      { id:'transport',         fr:'Transport & rendez-vous',   en:'Transport & appointments', es:'Transporte y citas' },
      { id:'mobility',          fr:'Aide à la mobilité',        en:'Mobility assistance',    es:'Ayuda a la movilidad' },
      { id:'light_housekeeping',fr:'Petites tâches ménagères',  en:'Light housekeeping',     es:'Tareas ligeras del hogar' },
      { id:'med_reminders',     fr:'Rappels de médicaments',    en:'Medication reminders',   es:'Recordatorio de medicamentos' },
      { id:'dementia_exp',      fr:'Expérience démence/Alzheimer', en:'Dementia/Alzheimer\'s experience', es:'Experiencia demencia/Alzheimer' },
    ],
  },
  cleaning: {
    column:'cleaning_skills', icon:'sparkles',
    label:{ fr:'Types de ménage', en:'Cleaning types', es:'Tipos de limpieza' },
    options:[
      { id:'regular',          fr:'Ménage régulier',     en:'Regular cleaning',   es:'Limpieza regular' },
      { id:'deep',             fr:'Grand ménage',        en:'Deep cleaning',      es:'Limpieza profunda' },
      { id:'move_inout',       fr:'Ménage déménagement', en:'Move-in/move-out',   es:'Limpieza de mudanza' },
      { id:'laundry',          fr:'Linge & repassage',   en:'Laundry & ironing',  es:'Lavandería y planchado' },
      { id:'windows_interior', fr:'Vitres intérieures',  en:'Interior windows',   es:'Ventanas interiores' },
      { id:'fridge_oven',      fr:'Frigo & four',        en:'Fridge & oven',      es:'Nevera y horno' },
    ],
  },
  lawn: {
    column:'lawn_skills', icon:'leaf',
    label:{ fr:'Travaux de jardin', en:'Yard work', es:'Trabajos de jardín' },
    options:[
      { id:'mowing',         fr:'Tonte',                  en:'Mowing',            es:'Cortar césped' },
      { id:'hedge_trimming', fr:'Taille de haies',        en:'Hedge trimming',    es:'Poda de setos' },
      { id:'weeding',        fr:'Désherbage & massifs',   en:'Weeding & beds',    es:'Deshierbe' },
      { id:'planting',       fr:'Plantation',             en:'Planting',          es:'Plantación' },
      { id:'leaf_cleanup',   fr:'Feuilles & nettoyage',   en:'Leaf cleanup',      es:'Recogida de hojas' },
      { id:'watering',       fr:'Arrosage & entretien',   en:'Watering & plant care', es:'Riego y cuidado' },
    ],
  },
  errands: {
    column:'errands_skills', icon:'cart',
    label:{ fr:'Services proposés', en:'Services offered', es:'Servicios ofrecidos' },
    options:[
      { id:'groceries',     fr:'Courses alimentaires',  en:'Grocery shopping',  es:'Compras de comida' },
      { id:'pharmacy',      fr:'Pharmacie',             en:'Pharmacy runs',     es:'Farmacia' },
      { id:'packages',      fr:'Retraits & retours colis', en:'Package pickup & returns', es:'Paquetes y devoluciones' },
      { id:'home_meals',    fr:'Repas maison',          en:'Home-cooked meals', es:'Comida casera' },
      { id:'batch_cooking', fr:'Batch cooking',         en:'Batch cooking',     es:'Cocina para la semana' },
      { id:'outings',       fr:'Accompagnement sorties', en:'Outing companionship', es:'Acompañamiento' },
    ],
  },
  hairdresser: {
    column:'hairdresser_skills', icon:'scissors',
    label:{ fr:'Prestations coiffure', en:'Hair services', es:'Servicios de peluquería' },
    // Braiding déréglementé en FL (HB 1193). Coupes = licence cosmétologie FL.
    // Pas de services chimiques (permanente/coloration) à domicile.
    options:[
      { id:'braiding',     fr:'Tresses & braids',        en:'Braiding',          es:'Trenzas' },
      { id:'cut_women',    fr:'Coupe femme',             en:'Women\'s cuts',     es:'Corte mujer' },
      { id:'cut_men',      fr:'Coupe homme',             en:'Men\'s cuts',       es:'Corte hombre' },
      { id:'cut_kids',     fr:'Coupe enfant',            en:'Kids\' cuts',       es:'Corte niños' },
      { id:'afro_textured',fr:'Cheveux afro/texturés',   en:'Afro & textured hair', es:'Cabello afro/texturizado' },
      { id:'locs',         fr:'Locs',                    en:'Locs',              es:'Locs' },
    ],
  },
}

SKILL_GROUPS.tutoring = {
  column:'tutoring_skills', icon:'book',
  label:{ fr:'Matières & niveaux', en:'Subjects & levels', es:'Materias y niveles' },
  // Background check requis (mineurs) — flag check:true dans l'onboarding.
  options:[
    { id:'elementary',     fr:'Primaire',             en:'Elementary',        es:'Primaria' },
    { id:'middle_school',  fr:'Collège',              en:'Middle school',     es:'Secundaria' },
    { id:'high_school',    fr:'Lycée',                en:'High school',       es:'Preparatoria' },
    { id:'math',           fr:'Maths',                en:'Math',              es:'Matemáticas' },
    { id:'english_reading',fr:'Anglais & lecture',    en:'English & reading', es:'Inglés y lectura' },
    { id:'spanish',        fr:'Espagnol',             en:'Spanish',           es:'Español' },
    { id:'french',         fr:'Français',             en:'French',            es:'Francés' },
    { id:'test_prep',      fr:'Préparation SAT/ACT',  en:'SAT/ACT prep',      es:'Preparación SAT/ACT' },
    { id:'online',         fr:'Cours en ligne',       en:'Online tutoring',   es:'Clases en línea' },
  ],
}
SKILL_GROUPS.fitness = {
  column:'fitness_skills', icon:'dumbbell',
  label:{ fr:'Spécialités coaching', en:'Coaching specialties', es:'Especialidades' },
  // Non réglementé en FL. Certifications (NASM, ACE...) déclaratives via
  // le champ certifications. Assurance RC recommandée (bloc Thimble).
  options:[
    { id:'general_fitness', fr:'Remise en forme',          en:'General fitness',     es:'Puesta en forma' },
    { id:'weight_loss',     fr:'Perte de poids',           en:'Weight loss',         es:'Pérdida de peso' },
    { id:'strength',        fr:'Renforcement musculaire',  en:'Strength training',   es:'Fortalecimiento' },
    { id:'yoga_pilates',    fr:'Yoga & pilates',           en:'Yoga & pilates',      es:'Yoga y pilates' },
    { id:'seniors_mobility',fr:'Seniors & mobilité douce', en:'Seniors & gentle mobility', es:'Mayores y movilidad' },
    { id:'pre_postnatal',   fr:'Pré & post-natal',         en:'Pre & postnatal',     es:'Pre y posnatal' },
  ],
}
SKILL_GROUPS.housesitting = {
  column:'housesitting_skills', icon:'key',
  label:{ fr:'Services de garde de maison', en:'House sitting services', es:'Servicios de cuidado de casa' },
  // Background check requis (accès au domicile en absence des occupants).
  options:[
    { id:'home_watch',     fr:'Surveillance pendant absence', en:'Home watch',            es:'Vigilancia de la casa' },
    { id:'plants',         fr:'Arrosage des plantes',         en:'Plant watering',        es:'Riego de plantas' },
    { id:'mail',           fr:'Courrier & colis',             en:'Mail & packages',       es:'Correo y paquetes' },
    { id:'overnight_stay', fr:'Présence de nuit',             en:'Overnight stays',       es:'Estancia nocturna' },
    { id:'contractor_mgmt',fr:'Gestion artisans & livraisons', en:'Contractor & delivery management', es:'Gestión de contratistas' },
    { id:'pool_check',     fr:'Vérification piscine',         en:'Pool checks',           es:'Revisión de piscina' },
  ],
}

export function skillLabel(group, id, lang = 'fr') {
  const opt = SKILL_GROUPS[group]?.options.find(o => o.id === id)
  if (!opt) return id
  return opt[lang] || opt.en
}

export function serviceLabel(id, lang = 'fr') {
  const m = SERVICE_META[id]
  if (!m) return id
  return m[lang] || m.en
}

// Petite pastille icône colorée réutilisable
export function IconChip({ name, color, tint, size = 44, iconSize = 22, radius = 12 }) {
  return (
    <div style={{ width:size, height:size, borderRadius:radius, background:tint,
      display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
      <Icon name={name} size={iconSize} color={color} />
    </div>
  )
}
