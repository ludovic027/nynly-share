// FamilyDashboard.jsx
// Tableau de bord famille : dépenses, missions, prestataires favoris
// Accessible depuis HomeScreen côté client

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useT }    from '../lib/i18n'

const G  = '#6C63FF'
const AM = '#f59e0b'

const SVC_ICONS = {
  childcare:'👶', nanny:'🏠', petsitter:'🐾', seniorcare:'🧓',
  cleaning:'🧹', handyman:'🔧', lawn:'🌿', errands:'🛒',
}

export default function FamilyDashboard({ userId, navigate, lang = 'fr' }) {
  const { t, isFR } = useT(lang)
  const [stats,   setStats]   = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const now        = new Date()
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
        const yearStart  = new Date(now.getFullYear(), 0, 1).toISOString()

        const [
          { data: allContracts },
          { data: monthContracts },
          { data: yearContracts },
        ] = await Promise.all([
          supabase.from('contracts')
            .select('id, status, total_amount, currency, service_type, mission_date, worker:profiles!contracts_worker_id_fkey(id,first_name,last_name,avatar_url)')
            .eq('client_id', userId)
            .neq('status', 'intent')
            .order('created_at', { ascending: false })
            .limit(100),
          supabase.from('contracts')
            .select('total_amount, status')
            .eq('client_id', userId)
            .eq('status', 'completed')
            .gte('mission_date', monthStart),
          supabase.from('contracts')
            .select('total_amount, status, service_type')
            .eq('client_id', userId)
            .eq('status', 'completed')
            .gte('mission_date', yearStart),
        ])

        const all    = allContracts || []
        const month  = monthContracts || []
        const year   = yearContracts  || []

        const sym         = (all.find(c => c.currency === 'EUR')) ? '€' : '$'
        const monthTotal  = month.reduce((s, c) => s + parseFloat(c.total_amount || 0), 0)
        const yearTotal   = year.reduce((s, c)  => s + parseFloat(c.total_amount || 0), 0)
        const ciEstimate  = yearTotal * 0.5  // France seulement
        const completed   = all.filter(c => c.status === 'completed').length
        const upcoming    = all.filter(c => ['confirmed','in_progress'].includes(c.status)).length

        // Service le plus utilisé
        const svcCount = {}
        year.forEach(c => { svcCount[c.service_type] = (svcCount[c.service_type] || 0) + 1 })
        const topSvc = Object.entries(svcCount).sort((a,b) => b[1]-a[1])[0]

        // Top workers (par nombre de missions)
        const workerCount = {}
        all.filter(c => c.status === 'completed' && c.worker).forEach(c => {
          const id = c.worker.id
          if (!workerCount[id]) workerCount[id] = { worker: c.worker, count: 0 }
          workerCount[id].count++
        })
        const topWorkers = Object.values(workerCount).sort((a,b) => b.count-a.count).slice(0,3)

        // Dernières missions
        const recent = all.slice(0, 5)

        setStats({ sym, monthTotal, yearTotal, ciEstimate, completed, upcoming, topSvc, topWorkers, recent, isFR })
      } catch (e) {
        console.warn('[FamilyDashboard]', e?.message)
      }
      setLoading(false)
    }
    load()
  }, [userId, isFR])

  if (loading) return (
    <div style={{ fontFamily:"'Poppins',system-ui,sans-serif" }}>
      <style>{`@keyframes fd-sh{0%{background-position:-200% 0}100%{background-position:200% 0}}.fd-sk{background:linear-gradient(90deg,#f3f4f6 25%,#e5e7eb 50%,#f3f4f6 75%);background-size:200% 100%;animation:fd-sh 1.4s infinite;border-radius:8px}`}</style>
      {[1,2,3].map(i=>(
        <div key={i} style={{background:'white',borderRadius:16,padding:16,marginBottom:10}}>
          <div className="fd-sk" style={{height:14,width:'50%',marginBottom:8}}/>
          <div className="fd-sk" style={{height:28,width:'30%'}}/>
        </div>
      ))}
    </div>
  )

  if (!stats) return null

  const { sym, monthTotal, yearTotal, ciEstimate, completed, upcoming, topSvc, topWorkers, recent } = stats

  return (
    <div style={{ fontFamily:"'Poppins',system-ui,sans-serif" }}>

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14 }}>
        {[
          { icon:'💳', label: lang==='fr'?'Ce mois':lang==='es'?'Este mes':'This month',   val:`${sym}${monthTotal.toFixed(0)}`, color:'#3b82f6', bg:'#eff6ff' },
          { icon:'📅', label: lang==='fr'?'Missions à venir':lang==='es'?'Próximas':'Upcoming',       val:upcoming, color:G,         bg:'#f0fdf4' },
          { icon:'✅', label: lang==='fr'?'Terminées (total)':lang==='es'?'Completadas':'Completed',  val:completed, color:'#8b5cf6', bg:'#f5f3ff' },
          { icon:'💰', label: lang==='fr'?`Dépenses ${new Date().getFullYear()}`:lang==='es'?`Gastos ${new Date().getFullYear()}`:`Spent ${new Date().getFullYear()}`, val:`${sym}${yearTotal.toFixed(0)}`, color:AM, bg:'#fffbeb' },
        ].map(kpi => (
          <div key={kpi.label} style={{ background:kpi.bg, borderRadius:14, padding:'14px 12px',
            border:`1px solid ${kpi.color}15` }}>
            <div style={{ fontSize:10, fontWeight:700, color:kpi.color, textTransform:'uppercase',
              letterSpacing:'.06em', marginBottom:6 }}>
              {kpi.icon} {kpi.label}
            </div>
            <div style={{ fontWeight:900, fontSize:22, color:'#111827' }}>{kpi.val}</div>
          </div>
        ))}
      </div>

      {/* Crédit d'impôt (France seulement) */}
      {isFR && yearTotal > 0 && (
        <div style={{ background:'#F2F1FF', border:'1.5px solid #D6D2FF', borderRadius:14,
          padding:'14px 16px', marginBottom:14 }}>
          <div style={{ fontWeight:700, fontSize:13, color:'#5546E8', marginBottom:4 }}>
            🇫🇷 Crédit d'impôt SAP estimé  -  déclaration {new Date().getFullYear() + 1}
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
            <div style={{ fontSize:12, color:'#5546E8' }}>
              50% × {sym}{yearTotal.toFixed(0)} de services éligibles
            </div>
            <div style={{ fontWeight:900, fontSize:22, color:'#5546E8' }}>
              ≈ {sym}{ciEstimate.toFixed(0)}
            </div>
          </div>
          <div style={{ fontSize:10, color:'#9ca3af', marginTop:4 }}>
            {lang==='es'?'Certificado fiscal generado en enero. Declarar en impots.gouv.fr':lang==='en'?'Tax certificate auto-generated in January. Declare at impots.gouv.fr':'Attestation fiscale fournie en janvier. À déclarer sur impots.gouv.fr'}
          </div>
        </div>
      )}

      {/* Service le plus utilisé */}
      {topSvc && (
        <div style={{ background:'white', border:'1.5px solid #e5e7eb', borderRadius:14,
          padding:'12px 14px', marginBottom:14, display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ fontSize:28 }}>{SVC_ICONS[topSvc[0]] || '📋'}</span>
          <div>
            <div style={{ fontSize:11, color:'#9ca3af', fontWeight:700, textTransform:'uppercase',
              letterSpacing:'.06em' }}>
              {lang==='fr'?'Service le plus utilisé':lang==='es'?'Servicio más usado':'Most used service'}
            </div>
            <div style={{ fontWeight:700, fontSize:14, color:'#111827', marginTop:2 }}>
              {topSvc[0]} · {topSvc[1]} {lang==='fr'?'mission':lang==='es'?'trabajo':'job'}{topSvc[1]>1?'s':''}
            </div>
          </div>
        </div>
      )}

      {/* Top prestataires */}
      {topWorkers.length > 0 && (
        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:11, fontWeight:700, color:'#9ca3af',
            textTransform:'uppercase', letterSpacing:'.07em', marginBottom:10 }}>
            ⭐ {lang==='fr'?'Vos prestataires habituels':lang==='es'?'Tus proveedores habituales':'Your regular providers'}
          </div>
          {topWorkers.map(({ worker: w, count }) => (
            <button key={w.id}
              onClick={() => navigate?.('/worker', { workerId: w.id })}
              style={{ width:'100%', display:'flex', alignItems:'center', gap:12,
                background:'white', border:'1.5px solid #e5e7eb', borderRadius:14,
                padding:'12px 14px', marginBottom:8, cursor:'pointer',
                fontFamily:'inherit', textAlign:'left' }}>
              {w.avatar_url
                ? <img src={w.avatar_url} alt={w.first_name} style={{ width:44, height:44, borderRadius:10, objectFit:'cover', flexShrink:0 }} />
                : <div style={{ width:44, height:44, borderRadius:10, background:'#F2F1FF', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 }}>👤</div>
              }
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700, fontSize:13, color:'#111827' }}>
                  {w.first_name} {w.last_name?.[0]}.
                </div>
                <div style={{ fontSize:11, color:'#9ca3af', marginTop:2 }}>
                  {count} {lang==='fr'?'mission':lang==='es'?'trabajo':'job'}{count>1?'s':''}
                </div>
              </div>
              <div style={{ display:'flex', gap:6 }}>
                <button onClick={e => { e.stopPropagation(); navigate?.('/messages', { workerId: w.id }) }}
                  style={{ background:'#F2F1FF', border:'none', color:G, borderRadius:8,
                    padding:'6px 10px', fontWeight:700, fontSize:12, cursor:'pointer',
                    fontFamily:'inherit' }}>
                  💬
                </button>
                <button onClick={e => { e.stopPropagation(); navigate?.('/book', { worker: w, service: 'childcare' }) }}
                  style={{ background:G, border:'none', color:'white', borderRadius:8,
                    padding:'6px 10px', fontWeight:700, fontSize:12, cursor:'pointer',
                    fontFamily:'inherit' }}>
                  📅
                </button>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Dernières missions */}
      {recent.length > 0 && (
        <div>
          <div style={{ fontSize:11, fontWeight:700, color:'#9ca3af',
            textTransform:'uppercase', letterSpacing:'.07em', marginBottom:10 }}>
            📋 {lang==='fr'?'Missions récentes':lang==='es'?'Trabajos recientes':'Recent jobs'}
          </div>
          {recent.map(m => {
            const statusColor = { completed:G, confirmed:'#3b82f6', cancelled:'#9ca3af', pending:AM }[m.status] || '#9ca3af'
            return (
              <button key={m.id}
                onClick={() => navigate?.('/mission-detail', { missionId: m.id })}
                style={{ width:'100%', display:'flex', justifyContent:'space-between',
                  alignItems:'center', background:'white', border:'1.5px solid #e5e7eb',
                  borderRadius:12, padding:'10px 14px', marginBottom:8,
                  cursor:'pointer', fontFamily:'inherit', borderLeft:`3px solid ${statusColor}` }}>
                <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                  <span style={{ fontSize:18 }}>{SVC_ICONS[m.service_type] || '📋'}</span>
                  <div>
                    <div style={{ fontSize:12, fontWeight:600, color:'#111827' }}>
                      {m.worker?.first_name} {m.worker?.last_name?.[0]}.
                    </div>
                    <div style={{ fontSize:10, color:'#9ca3af' }}>
                      {m.mission_date ? new Date(m.mission_date).toLocaleDateString(
                        lang==='fr'?'fr-FR':lang==='es'?'es-US':'en-US',
                        { day:'numeric', month:'short' }
                      ) : ''}
                    </div>
                  </div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontWeight:700, fontSize:13, color:'#111827' }}>
                    {m.currency==='EUR'?'€':'$'}{parseFloat(m.total_amount||0).toFixed(0)}
                  </div>
                  <div style={{ fontSize:9, fontWeight:700, color:statusColor, textTransform:'uppercase' }}>
                    {m.status}
                  </div>
                </div>
              </button>
            )
          })}
          <button onClick={() => navigate?.('/bookings')}
            style={{ width:'100%', padding:10, borderRadius:12,
              background:'none', border:'1.5px solid #e5e7eb',
              color:'#374151', fontSize:12, fontWeight:600,
              cursor:'pointer', fontFamily:'inherit' }}>
            {lang==='fr'?'Voir toutes les missions →':lang==='es'?'Ver todos los trabajos →':'View all jobs →'}
          </button>
          <button onClick={() => navigate?.('/recurrences')}
            style={{ width:'100%', marginTop:8, padding:10, borderRadius:12,
              background:'#F2F1FF', border:'1.5px solid #D6D2FF',
              color:'#5546E8', fontSize:12, fontWeight:600,
              cursor:'pointer', fontFamily:'inherit' }}>
            🔄 {lang==='fr'?'Mes réservations récurrentes →':lang==='es'?'Mis reservas recurrentes →':'My recurring bookings →'}
          </button>
        </div>
      )}
    </div>
  )
}
