import React, { useState, useEffect } from 'react'
import { ELEMENTS_STRUCTURELS, DEFAULT_CADENCES } from '../data/projectEngine.js'

function CadenceInput({ value, onChange, unit }) {
  return (
    <div style={{ position:'relative' }}>
      <input
        type="number" min={0} step={0.25} value={value}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        style={{
          width:'100%', background:'#0d1018', border:'1px solid #1e2535',
          borderRadius:8, color:'#c8d4e8', padding:'10px 40px 10px 12px',
          fontSize:14, outline:'none', textAlign:'right',
        }}
      />
      <span style={{
        position:'absolute', right:10, top:'50%', transform:'translateY(-50%)',
        color:'#3d4f6a', fontSize:11, pointerEvents:'none',
      }}>{unit}</span>
    </div>
  )
}

const PHASES = [
  { id: 'coffrage',     label: 'Coffrage',     color: '#f59e0b' },
  { id: 'ferraillage',  label: 'Ferraillage',  color: '#ef4444' },
  { id: 'betonnage',    label: 'Bétonnage',    color: '#3b82f6' },
]

export default function CadencesPage({ project, onUpdate }) {
  const [cadences, setCadences] = useState(DEFAULT_CADENCES)

  useEffect(() => {
    if (project?.cadences) setCadences(project.cadences)
    else setCadences(DEFAULT_CADENCES)
  }, [project?.id])

  function setVal(elId, phaseId, val) {
    setCadences(prev => ({
      ...prev,
      [elId]: { ...prev[elId], [phaseId]: val }
    }))
  }

  function handleSave() {
    if (!project) { alert('Aucun projet actif.'); return }
    onUpdate({ ...project, cadences })
    alert('Cadences enregistrées !')
  }

  function handleReset() {
    setCadences(DEFAULT_CADENCES)
  }

  function cycleDuration(elId) {
    const c = cadences[elId] || DEFAULT_CADENCES[elId]
    return (c.coffrage + c.ferraillage + c.betonnage).toFixed(1)
  }

  function totalFloorDuration() {
    return ELEMENTS_STRUCTURELS.reduce((sum, el) => {
      const c = cadences[el.id] || DEFAULT_CADENCES[el.id]
      return sum + c.coffrage + c.ferraillage + c.betonnage
    }, 0).toFixed(1)
  }

  if (!project) return (
    <div style={{ padding:60, textAlign:'center', color:'#4a5568' }}>
      <div style={{ fontSize:40, marginBottom:12 }}>⏱</div>
      <div>Sélectionnez ou créez un projet pour configurer les cadences.</div>
    </div>
  )

  return (
    <div style={{ padding:32, color:'#c8d4e8', maxWidth:900, margin:'0 auto' }}>
      <div style={{ marginBottom:28 }}>
        <div style={{ color:'#4a5568', fontSize:12, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:6 }}>Paramétrage</div>
        <h1 style={{ color:'#e8edf5', fontSize:26, fontWeight:700, letterSpacing:'-0.03em', margin:0 }}>
          Cadences d'exécution
        </h1>
        <p style={{ color:'#4a5568', marginTop:6, fontSize:14 }}>
          Projet : <strong style={{ color:'#7a8fa8' }}>{project.nom}</strong>
          {' '}· Ces valeurs génèrent automatiquement les durées du planning Gantt
        </p>
      </div>

      {/* Info banner */}
      <div style={{ background:'#1a2030', border:'1px solid #2a3347', borderRadius:10, padding:'12px 16px', marginBottom:24, display:'flex', gap:10, alignItems:'flex-start' }}>
        <span style={{ fontSize:16 }}>ℹ️</span>
        <div style={{ fontSize:13, color:'#7a8fa8', lineHeight:1.6 }}>
          Saisissez la durée de chaque phase en <strong style={{ color:'#c8d4e8' }}>jours ouvrés</strong> pour un élément standard à l'unité.
          Le planning sera calculé automatiquement pour {(project.niveaux || 0) + 1} niveaux × {project.blocs || 1} bloc(s).
        </div>
      </div>

      {/* Table header */}
      <div style={{ background:'#131720', border:'1px solid #1e2535', borderRadius:12, overflow:'hidden', marginBottom:20 }}>
        <div style={{
          display:'grid', gridTemplateColumns:'160px repeat(3,1fr) 100px',
          gap:0, background:'#0d1018', padding:'12px 20px',
          borderBottom:'1px solid #1e2535',
        }}>
          <div style={{ color:'#4a5568', fontSize:11, textTransform:'uppercase', letterSpacing:'.07em' }}>Élément</div>
          {PHASES.map(p => (
            <div key={p.id} style={{ color: p.color, fontSize:11, textTransform:'uppercase', letterSpacing:'.07em', textAlign:'center' }}>
              {p.label}
            </div>
          ))}
          <div style={{ color:'#4a5568', fontSize:11, textTransform:'uppercase', letterSpacing:'.07em', textAlign:'center' }}>Cycle</div>
        </div>

        {ELEMENTS_STRUCTURELS.map((el, idx) => (
          <div key={el.id} style={{
            display:'grid', gridTemplateColumns:'160px repeat(3,1fr) 100px',
            gap:0, padding:'16px 20px', alignItems:'center',
            borderBottom: idx < ELEMENTS_STRUCTURELS.length - 1 ? '1px solid #1e2535' : 'none',
            background: idx % 2 === 0 ? 'transparent' : '#0d101866',
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ fontSize:18 }}>{el.icon}</span>
              <span style={{ color:'#e8edf5', fontWeight:600, fontSize:14 }}>{el.label}</span>
            </div>

            {PHASES.map(phase => (
              <div key={phase.id} style={{ padding:'0 8px' }}>
                <CadenceInput
                  value={cadences[el.id]?.[phase.id] ?? DEFAULT_CADENCES[el.id][phase.id]}
                  onChange={val => setVal(el.id, phase.id, val)}
                  unit="j"
                />
              </div>
            ))}

            <div style={{ textAlign:'center' }}>
              <span style={{
                background:'#1d3461', color:'#60a5fa', borderRadius:6,
                padding:'4px 12px', fontSize:13, fontWeight:700,
              }}>
                {cycleDuration(el.id)} j
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginBottom:24 }}>
        <div style={{ background:'#131720', border:'1px solid #1e2535', borderRadius:10, padding:'16px 20px' }}>
          <div style={{ color:'#4a5568', fontSize:11, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:6 }}>Cycle complet / étage</div>
          <div style={{ color:'#60a5fa', fontSize:24, fontWeight:700 }}>{totalFloorDuration()} j</div>
          <div style={{ color:'#3d4f6a', fontSize:12, marginTop:2 }}>tous éléments cumulés</div>
        </div>
        <div style={{ background:'#131720', border:'1px solid #1e2535', borderRadius:10, padding:'16px 20px' }}>
          <div style={{ color:'#4a5568', fontSize:11, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:6 }}>Niveaux × Blocs</div>
          <div style={{ color:'#34d399', fontSize:24, fontWeight:700 }}>{((project.niveaux||0)+1) * (project.blocs||1)}</div>
          <div style={{ color:'#3d4f6a', fontSize:12, marginTop:2 }}>cycles à planifier</div>
        </div>
        <div style={{ background:'#131720', border:'1px solid #1e2535', borderRadius:10, padding:'16px 20px' }}>
          <div style={{ color:'#4a5568', fontSize:11, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:6 }}>Durée superstructure</div>
          <div style={{ color:'#f59e0b', fontSize:24, fontWeight:700 }}>
            {Math.ceil(parseFloat(totalFloorDuration()) * ((project.niveaux||0)+1) * (project.blocs||1))} j
          </div>
          <div style={{ color:'#3d4f6a', fontSize:12, marginTop:2 }}>estimée (séquentiel)</div>
        </div>
      </div>

      {/* Phase breakdown chart */}
      <div style={{ background:'#131720', border:'1px solid #1e2535', borderRadius:12, padding:20, marginBottom:24 }}>
        <div style={{ color:'#7a8fa8', fontSize:12, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:16 }}>
          Répartition du temps par phase
        </div>
        {PHASES.map(phase => {
          const total = ELEMENTS_STRUCTURELS.reduce((s, el) => s + (cadences[el.id]?.[phase.id] || 0), 0)
          const grand = parseFloat(totalFloorDuration()) || 1
          const pct = Math.round((total / grand) * 100)
          return (
            <div key={phase.id} style={{ marginBottom:10 }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                <span style={{ color: phase.color, fontSize:12 }}>{phase.label}</span>
                <span style={{ color:'#7a8fa8', fontSize:12 }}>{total.toFixed(1)} j ({pct}%)</span>
              </div>
              <div style={{ height:6, background:'#0d1018', borderRadius:3, overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${pct}%`, background: phase.color, borderRadius:3, transition:'width .5s' }} />
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ display:'flex', gap:12, justifyContent:'flex-end' }}>
        <button onClick={handleReset} style={{
          background:'transparent', border:'1px solid #1e2535', color:'#7a8fa8',
          borderRadius:8, padding:'12px 24px', fontWeight:600, fontSize:14, cursor:'pointer',
        }}>
          Réinitialiser
        </button>
        <button onClick={handleSave} style={{
          background:'linear-gradient(135deg,#3b82f6,#6366f1)',
          color:'#fff', border:'none', borderRadius:8,
          padding:'12px 32px', fontWeight:700, fontSize:14, cursor:'pointer',
          boxShadow:'0 4px 20px rgba(59,130,246,.4)',
        }}>
          Enregistrer les cadences →
        </button>
      </div>
    </div>
  )
}
