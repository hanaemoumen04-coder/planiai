import React from 'react'
import { BUILDING_TYPES } from '../data/projectEngine.js'

function KPI({ label, value, sub, color = '#3b82f6' }) {
  return (
    <div style={{
      background:'#131720', border:'1px solid #1e2535', borderRadius:12,
      padding:'20px 24px', flex:1, minWidth:160,
    }}>
      <div style={{ color:'#4a5568', fontSize:11, textTransform:'uppercase', letterSpacing:'.07em', marginBottom:8 }}>{label}</div>
      <div style={{ color, fontSize:28, fontWeight:700, letterSpacing:'-0.03em' }}>{value}</div>
      {sub && <div style={{ color:'#3d4f6a', fontSize:12, marginTop:4 }}>{sub}</div>}
    </div>
  )
}

export default function Dashboard({ projects, activeProject, onSelect, onNew }) {
  const totalProjects = projects.length
  const totalNiveaux = projects.reduce((s, p) => s + (p.niveaux || 0), 0)
  const totalSurface = projects.reduce((s, p) => s + (p.surface || 0), 0)

  return (
    <div style={{ padding:32, color:'#c8d4e8' }}>
      {/* Header */}
      <div style={{ marginBottom:32 }}>
        <div style={{ color:'#4a5568', fontSize:12, letterSpacing:'.05em', textTransform:'uppercase', marginBottom:6 }}>
          Vue d'ensemble
        </div>
        <h1 style={{ color:'#e8edf5', fontSize:28, fontWeight:700, letterSpacing:'-0.03em', margin:0 }}>
          Tableau de bord
        </h1>
        <p style={{ color:'#4a5568', marginTop:6, fontSize:14 }}>
          Planification intelligente de vos projets bâtiment
        </p>
      </div>

      {/* KPIs */}
      <div style={{ display:'flex', gap:16, marginBottom:32, flexWrap:'wrap' }}>
        <KPI label="Projets" value={totalProjects} sub="créés" color="#60a5fa" />
        <KPI label="Niveaux total" value={totalNiveaux} sub="tous projets" color="#34d399" />
        <KPI label="Surface totale" value={`${totalSurface.toLocaleString()} m²`} sub="planifiée" color="#f59e0b" />
        <KPI label="WBS générés" value={totalProjects} sub="automatiquement" color="#a78bfa" />
      </div>

      {/* No projects state */}
      {totalProjects === 0 ? (
        <div style={{
          background:'#131720', border:'2px dashed #1e2535', borderRadius:16,
          padding:60, textAlign:'center',
        }}>
          <div style={{ fontSize:48, marginBottom:16 }}>⬡</div>
          <h2 style={{ color:'#e8edf5', fontWeight:600, marginBottom:8 }}>Aucun projet créé</h2>
          <p style={{ color:'#4a5568', marginBottom:24 }}>
            Commencez par créer votre premier projet bâtiment
          </p>
          <button onClick={onNew} style={{
            background:'linear-gradient(135deg,#3b82f6,#6366f1)',
            color:'#fff', border:'none', borderRadius:8,
            padding:'12px 28px', fontWeight:600, fontSize:14, cursor:'pointer',
          }}>
            + Créer un projet
          </button>
        </div>
      ) : (
        <div>
          <div style={{ color:'#4a5568', fontSize:12, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:16 }}>
            Mes projets
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:16 }}>
            {projects.map(p => {
              const typeInfo = BUILDING_TYPES.find(t => t.id === p.type)
              return (
                <div key={p.id} onClick={() => onSelect(p.id)}
                  style={{
                    background:'#131720', border:`1px solid ${activeProject?.id === p.id ? '#3b82f6' : '#1e2535'}`,
                    borderRadius:12, padding:20, cursor:'pointer',
                    transition:'all .2s',
                  }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                    <span style={{ fontSize:24 }}>{typeInfo?.icon || '🏗️'}</span>
                    <div>
                      <div style={{ color:'#e8edf5', fontWeight:600, fontSize:15 }}>{p.nom}</div>
                      <div style={{ color:'#4a5568', fontSize:12 }}>{typeInfo?.label}</div>
                    </div>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                    {[
                      ['Niveaux', p.niveaux],
                      ['Blocs', p.blocs],
                      ['Surface', `${(p.surface||0).toLocaleString()} m²`],
                      ['Durée', `${p.duree} j`],
                    ].map(([k, v]) => (
                      <div key={k} style={{ background:'#0d0f14', borderRadius:6, padding:'8px 10px' }}>
                        <div style={{ color:'#3d4f6a', fontSize:10, textTransform:'uppercase' }}>{k}</div>
                        <div style={{ color:'#c8d4e8', fontWeight:600, fontSize:14 }}>{v}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop:12, color:'#4a5568', fontSize:11 }}>
                    Début : {p.dateDebut}
                  </div>
                </div>
              )
            })}
            <div onClick={onNew} style={{
              background:'transparent', border:'2px dashed #1e2535', borderRadius:12,
              padding:20, cursor:'pointer', display:'flex', alignItems:'center',
              justifyContent:'center', gap:10, color:'#3d4f6a', fontSize:14,
              minHeight:150, transition:'all .2s',
            }}>
              <span style={{ fontSize:24 }}>+</span>
              <span>Nouveau projet</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
