// ClientWelcome.jsx  -  Onboarding post-inscription famille
// Affiché une seule fois après la première connexion d'un client
// 3 slides : comment ça marche, paiement sécurisé, prestataires vérifiés

import { useState } from 'react'
import { t } from '../lib/i18n'

const G  = '#6C63FF'
const DG = '#5546E8'
const KEY = 'nynly_client_welcome_v1'

const SLIDES_FR = [
  {
    icon:  '🔍',
    title: 'Trouvez le bon prestataire',
    body:  'Recherchez parmi des prestataires vérifiés près de chez vous. Filtrez par service, date de disponibilité et tarif. Consultez les avis d\'autres familles avant de réserver.',
    highlight: null,
  },
  {
    icon:  '💳',
    title: 'Réservez et payez en sécurité',
    body:  'Votre paiement est bloqué en escrow jusqu\'à la fin de la mission. Si le prestataire ne se présente pas, vous êtes remboursé automatiquement en moins de 5 minutes.',
    highlight: '🔒 Paiement 100% sécurisé par Stripe',
  },
  {
    icon:  '🛡️',
    title: 'Prestataires vérifiés',
    body:  'Chaque prestataire Nynly passe par une vérification d\'antécédents. Votre mission est couverte par un contrat digital automatique. Pas d\'espèces — tout est tracé et sécurisé.',
    highlight: '🔍 Vérification d\'antécédents sur chaque prestataire',
  },
]

const SLIDES_EN = [
  {
    icon:  '🔍',
    title: 'Find the right provider',
    body:  'Search verified providers near you. Filter by service, availability, and rate. Read reviews from other families before booking.',
    highlight: null,
  },
  {
    icon:  '💳',
    title: 'Book and pay securely',
    body:  'Your payment is held in escrow until the job is done. If the provider doesn\'t show up, you\'re automatically refunded in under 5 minutes.',
    highlight: '🔒 100% secure payment via Stripe',
  },
  {
    icon:  '🛡️',
    title: 'Verified & background-checked',
    body:  'Every Nynly provider goes through a background check. Your job is covered by an automatic digital contract. No cash — everything is tracked and secure.',
    highlight: '🔍 Background check on every provider',
  },
]

const SLIDES_ES = [
  {
    icon:  '🔍',
    title: 'Encuentra al proveedor ideal',
    body:  'Busca proveedores verificados cerca de ti. Filtra por servicio, disponibilidad y precio. Lee reseñas de otras familias antes de reservar.',
    highlight: null,
  },
  {
    icon:  '💳',
    title: 'Reserva y paga con seguridad',
    body:  'Tu pago queda en custodia hasta que el trabajo termine. Si el proveedor no aparece, recibes un reembolso automático en menos de 5 minutos.',
    highlight: '🔒 Pago 100% seguro con Stripe',
  },
  {
    icon:  '🛡️',
    title: 'Proveedores verificados',
    body:  'Cada proveedor Nynly pasa por una verificación de antecedentes. Tu trabajo está cubierto por un contrato digital automático. Sin efectivo — todo queda registrado.',
    highlight: '🔍 Verificación de antecedentes en cada proveedor',
  },
]

export default function ClientWelcome({ lang = 'fr', navigate }) {
  const [slide, setSlide] = useState(0)
  const isFR   = lang === 'fr'
  const slides = lang === 'fr' ? SLIDES_FR : lang === 'es' ? SLIDES_ES : SLIDES_EN
  const current = slides[slide]
  const isLast  = slide === slides.length - 1

  function finish() {
    localStorage.setItem(KEY, '1')
    navigate?.('/')
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#f9fafb', padding: '0 20px',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', fontFamily: "'Poppins',system-ui,sans-serif",
    }}>

      {/* Dots de progression */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 40 }}>
        {slides.map((_, i) => (
          <div key={i} style={{
            width: i === slide ? 24 : 8, height: 8,
            borderRadius: 99,
            background: i === slide ? G : '#d1fae5',
            transition: 'all .3s ease',
          }} />
        ))}
      </div>

      {/* Slide */}
      <div style={{
        background: 'white', borderRadius: 24,
        padding: '40px 28px', width: '100%', maxWidth: 400,
        boxShadow: '0 8px 32px rgba(0,0,0,.08)',
        textAlign: 'center',
        animation: 'slide-fade .35s ease',
      }}>
        <style>{`@keyframes slide-fade{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}`}</style>

        {/* Icône */}
        <div style={{
          width: 80, height: 80,
          background: `linear-gradient(135deg,${G},${DG})`,
          borderRadius: 20, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          fontSize: 38, margin: '0 auto 24px',
          boxShadow: `0 8px 24px ${G}40`,
        }}>
          {current.icon}
        </div>

        <h2 style={{ fontWeight: 900, fontSize: 22, color: '#111827',
          margin: '0 0 14px', lineHeight: 1.25 }}>
          {current.title}
        </h2>

        <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.7,
          margin: '0 0 20px' }}>
          {current.body}
        </p>

        {current.highlight && (
          <div style={{
            background: '#F2F1FF', border: '1.5px solid #D6D2FF',
            borderRadius: 12, padding: '10px 14px',
            fontSize: 13, fontWeight: 700, color: '#5546E8',
            marginBottom: 8,
          }}>
            {current.highlight}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div style={{ width: '100%', maxWidth: 400, marginTop: 20, display: 'flex',
        flexDirection: 'column', gap: 10 }}>

        <button
          onClick={() => isLast ? finish() : setSlide(s => s + 1)}
          style={{
            width: '100%', padding: 16, borderRadius: 16, border: 'none',
            background: `linear-gradient(135deg,${G},${DG})`,
            color: 'white', fontWeight: 800, fontSize: 15,
            cursor: 'pointer', fontFamily: 'inherit',
            boxShadow: `0 6px 20px ${G}40`,
          }}>
          {isLast
            ? (lang === 'fr' ? '🔍 Trouver mon premier prestataire →' : lang === 'es' ? '🔍 Buscar mi primer proveedor →' : '🔍 Find my first provider →')
            : (lang === 'fr' ? 'Suivant →' : lang === 'es' ? 'Siguiente →' : 'Next →')}
        </button>

        <button onClick={finish}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 12, color: '#9ca3af', fontFamily: 'inherit',
          }}>
          {isFR ? "Passer l'introduction" : lang === 'es' ? 'Saltar introducción' : 'Skip introduction'}
        </button>
      </div>
    </div>
  )
}

export function shouldShowClientWelcome() {
  return !localStorage.getItem(KEY)
}
