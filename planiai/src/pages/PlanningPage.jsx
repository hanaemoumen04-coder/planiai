import React, { useMemo, useState, useRef, useCallback } from 'react'
import { buildWBS, buildGantt, exportProjectXML } from '../data/projectEngine.js'
import { predictDelays, computeMLStats, getRiskLevel, FACTEUR_LABELS } from '../data/mlEngine.js'

function downloadXML(content, filename) {
  const blob = new Blob([content], { type: 'application/xml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

const ELEMENT_COLORS = {
  poteaux: '#60a5fa',
  voiles:  '#34d399',
  poutres: '#f59e0b',
  dalle:   '#a78bfa',
}

const CHAPTER_PALETTE = ['#6366f1','#3b82f6','#06b6d4','#10b981','#84cc16','#f59e0b','#ef4444','#ec4899','#a78bfa']

function getTaskColor(task, mlPredictions, showML) {
  if (showML && mlPredictions[task.id]) {
    const risk = getRiskLevel(mlPredictions[task.id].retard_jours)
    return risk.couleur
  }
  if (task.element && ELEMENT_COLORS[task.element]) return ELEMENT_COLORS[task.element]
  const chap = parseInt(task.code?.split('.')[0])
  return CHAPTER_PALETTE[(chap - 1) % CHAPTER_PALETTE.length] || '#60a5fa'
}

// ── ML Panel Component ────────────────────────────────────────────────────────
function MLPanel({ tasks, mlState, mlPredictions, mlStats, onRunML, onReset }) {
  const [conditions, setConditions] = useState({ saison: 'normal', equipement: 'bon', equipe: 'normale' })

  return (
    <div style={{
      background: 'linear-gradient(135deg, #0f172a 0%, #0d1320 100%)',
      border: '1px solid #1e3a5f',
      borderRadius: 16,
      padding: 28,
      marginBottom: 24,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'linear-gradient(135deg, #1d4ed8, #7c3aed)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22,
          }}>🤖</div>
          <div>
            <div style={{ color: '#e8edf5', fontWeight: 700, fontSize: 16, letterSpacing: '-0.02em' }}>
              Prédiction ML — Random Forest / XGBoost
            </div>
            <div style={{ color: '#4a6080', fontSize: 12, marginTop: 2 }}>
              Entraîné sur 488 tâches TCE • Gardenia Zenata
            </div>
          </div>
        </div>
        <div style={{
          background: '#0f2d4a', border: '1px solid #1e4d7f',
          borderRadius: 8, padding: '4px 12px',
          color: '#60a5fa', fontSize: 11, fontWeight: 600,
        }}>
          XGBoost optimisé
        </div>
      </div>

      {mlState === 'idle' && (
        <>
          {/* Conditions */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { key: 'saison', label: 'Saison', options: [['normal','Normale'],['hivernale','Hivernale'],['estivale','Estivale']] },
              { key: 'equipement', label: 'Équipements', options: [['bon','Bons'],['moyen','Moyens'],['mauvais','Défectueux']] },
              { key: 'equipe', label: 'Équipe', options: [['normale','Normale'],['reduite','Réduite'],['renforcee','Renforcée']] },
            ].map(({ key, label, options }) => (
              <div key={key}>
                <div style={{ color: '#4a6080', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
                  {label}
                </div>
                <select
                  value={conditions[key]}
                  onChange={e => setConditions(c => ({ ...c, [key]: e.target.value }))}
                  style={{
                    width: '100%', background: '#0d1a2e', border: '1px solid #1e3a5f',
                    borderRadius: 8, color: '#c8d4e8', padding: '8px 10px',
                    fontSize: 13, cursor: 'pointer', outline: 'none',
                  }}
                >
                  {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={() => onRunML(conditions)}
              style={{
                background: 'linear-gradient(135deg, #1d4ed8, #7c3aed)',
                border: 'none', borderRadius: 10, padding: '12px 28px',
                color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer',
                transition: 'transform .15s, box-shadow .15s',
                boxShadow: '0 4px 20px rgba(99,102,241,.35)',
              }}
              onMouseEnter={e => { e.target.style.transform = 'translateY(-1px)'; e.target.style.boxShadow = '0 6px 28px rgba(99,102,241,.5)' }}
              onMouseLeave={e => { e.target.style.transform = ''; e.target.style.boxShadow = '0 4px 20px rgba(99,102,241,.35)' }}
            >
              ⚡ Lancer l'analyse ML
            </button>
            <div style={{ color: '#3d5070', fontSize: 12 }}>
              {tasks.length} tâches à analyser
            </div>
          </div>
        </>
      )}

      {mlState === 'running' && (
        <MLLoadingBar tasks={tasks} />
      )}

      {mlState === 'done' && mlStats && (
        <MLResults stats={mlStats} onReset={onReset} tasks={tasks} mlPredictions={mlPredictions} />
      )}

      {mlState === 'error' && (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ color: '#ef4444', fontSize: 14, marginBottom: 12 }}>
            ⚠ Erreur de connexion à l'API ML
          </div>
          <button onClick={() => onRunML(conditions)} style={{
            background: '#1a2a3a', border: '1px solid #ef4444', borderRadius: 8,
            color: '#ef4444', padding: '8px 20px', cursor: 'pointer', fontSize: 13,
          }}>
            Réessayer
          </button>
        </div>
      )}
    </div>
  )
}

function MLLoadingBar({ tasks }) {
  const [progress, setProgress] = React.useState(0)
  const [phase, setPhase] = React.useState('Initialisation du modèle XGBoost...')

  React.useEffect(() => {
    const phases = [
      [10, 'Encodage des features (LabelEncoder)...'],
      [25, 'Extraction des statistiques TCE...'],
      [45, 'Inférence XGBoost en cours...'],
      [70, `Prédiction sur ${tasks.length} tâches...`],
      [90, 'Calcul des niveaux de risque...'],
    ]
    let i = 0
    const interval = setInterval(() => {
      if (i < phases.length) {
        setProgress(phases[i][0])
        setPhase(phases[i][1])
        i++
      } else {
        clearInterval(interval)
      }
    }, 600)
    return () => clearInterval(interval)
  }, [tasks.length])

  return (
    <div style={{ padding: '12px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ color: '#c8d4e8', fontSize: 13 }}>{phase}</span>
        <span style={{ color: '#60a5fa', fontSize: 13, fontWeight: 700 }}>{progress}%</span>
      </div>
      <div style={{ background: '#0d1a2e', borderRadius: 6, height: 8, overflow: 'hidden' }}>
        <div style={{
          width: `${progress}%`, height: '100%',
          background: 'linear-gradient(90deg, #1d4ed8, #7c3aed)',
          borderRadius: 6, transition: 'width .5s cubic-bezier(.4,0,.2,1)',
          boxShadow: '0 0 12px rgba(99,102,241,.6)',
        }} />
      </div>
      <div style={{ color: '#3d5070', fontSize: 11, marginTop: 8, textAlign: 'center' }}>
        Modèle entraîné sur 488 tâches · XGBoost (n=300, depth=6, lr=0.1)
      </div>
    </div>
  )
}

function MLResults({ stats, onReset, tasks, mlPredictions }) {
  const [expanded, setExpanded] = useState(false)
  const { totalRetard, eleve, moyen, faible, topFacteurs, preds } = stats

  return (
    <div>
      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Retard total estimé', value: `${totalRetard.toFixed(0)} j`, color: '#60a5fa', icon: '⏱' },
          { label: 'Risque élevé',         value: eleve,  color: '#ef4444', icon: '🔴' },
          { label: 'Risque moyen',         value: moyen,  color: '#f59e0b', icon: '🟡' },
          { label: 'Risque faible',        value: faible, color: '#22c55e', icon: '🟢' },
        ].map(({ label, value, color, icon }) => (
          <div key={label} style={{
            background: '#0a1628', border: `1px solid ${color}22`,
            borderRadius: 10, padding: '12px 16px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>{icon}</div>
            <div style={{ color, fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em' }}>{value}</div>
            <div style={{ color: '#3d5070', fontSize: 11, marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Top facteurs */}
      {topFacteurs.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ color: '#4a6080', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
            Facteurs de risque dominants
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {topFacteurs.map(({ facteur, count }) => (
              <div key={facteur} style={{
                background: '#0d1a2e', border: '1px solid #1e3a5f',
                borderRadius: 20, padding: '4px 12px',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <span style={{ color: '#c8d4e8', fontSize: 12 }}>{FACTEUR_LABELS[facteur] || facteur}</span>
                <span style={{ color: '#3b82f6', fontSize: 11, fontWeight: 700 }}>{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top tâches à risque */}
      <div style={{ marginBottom: 16 }}>
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#60a5fa', fontSize: 12, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 6, padding: 0,
          }}
        >
          {expanded ? '▼' : '▶'} Voir le détail des tâches à risque élevé ({eleve})
        </button>
        {expanded && (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {preds
              .filter(t => t.risk.niveau === 'Élevé')
              .sort((a, b) => b.retard - a.retard)
              .slice(0, 10)
              .map(t => (
                <div key={t.id} style={{
                  background: '#0a1628', border: '1px solid #450a0a',
                  borderRadius: 8, padding: '10px 14px',
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} />
                  <span style={{ color: '#b0bfd4', fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.code} · {t.label}
                  </span>
                  <span style={{ color: '#ef4444', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                    +{t.retard.toFixed(1)} j
                  </span>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    {t.facteurs.slice(0, 2).map(f => (
                      <span key={f} style={{
                        background: '#1a0a0a', border: '1px solid #5a1a1a',
                        borderRadius: 4, padding: '2px 6px', color: '#ef4444', fontSize: 10,
                      }}>{FACTEUR_LABELS[f] || f}</span>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <div style={{
          background: '#052e16', border: '1px solid #166534',
          borderRadius: 8, padding: '6px 14px',
          color: '#22c55e', fontSize: 12, fontWeight: 600,
        }}>
          ✅ Analyse terminée — Gantt colorisé par risque
        </div>
        <button onClick={onReset} style={{
          background: 'none', border: '1px solid #1e3a5f', borderRadius: 8,
          color: '#4a6080', padding: '6px 14px', cursor: 'pointer', fontSize: 12,
        }}>
          Réinitialiser
        </button>
      </div>
    </div>
  )
}

// ── Main PlanningPage ─────────────────────────────────────────────────────────
export default function PlanningPage({ project }) {
  const [filter, setFilter]           = useState('all')
  const [showMLPanel, setShowMLPanel] = useState(false)
  const [showMLColors, setShowMLColors] = useState(false)
  const [mlState, setMlState]         = useState('idle') // idle | running | done | error
  const [mlPredictions, setMlPredictions] = useState({})
  const [mlStats, setMlStats]         = useState(null)
  const ganttRef = useRef()

  const wbs   = useMemo(() => project ? buildWBS(project) : [], [project])
  const gantt = useMemo(() => project ? buildGantt(wbs, project.dateDebut) : [], [wbs, project])

  const tasks = useMemo(() => {
    let t = gantt.filter(t => !t.isChapter && t.startDate)
    if (filter !== 'all') t = t.filter(tt => tt.code?.startsWith(filter))
    return t
  }, [gantt, filter])

  const chapters = gantt.filter(t => t.isChapter && t.level === 1)

  // Lancer l'analyse ML
  const handleRunML = useCallback(async (conditions) => {
    setMlState('running')
    setShowMLColors(false)
    try {
      const preds = await predictDelays(tasks, conditions)
      const { computeMLStats: _, ...rest } = await import('../data/mlEngine.js')
      const stats = (await import('../data/mlEngine.js')).computeMLStats(tasks, preds)
      setMlPredictions(preds)
      setMlStats(stats)
      setMlState('done')
      setShowMLColors(true)
    } catch (err) {
      console.error('ML error:', err)
      setMlState('error')
    }
  }, [tasks])

  const handleResetML = () => {
    setMlState('idle')
    setMlPredictions({})
    setMlStats(null)
    setShowMLColors(false)
  }

  function handleExportXML() {
    const xml = exportProjectXML(project, wbs)
    const slug = project.nom.replace(/\s+/g, '_').toLowerCase()
    downloadXML(xml, slug + '_Planning.xml')
  }

  if (!project) return (
    <div style={{ padding: 60, textAlign: 'center', color: '#4a5568' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>▦</div>
      <div>Sélectionnez ou créez un projet pour voir le planning.</div>
    </div>
  )

  if (!project.dateDebut || wbs.length === 0) return (
    <div style={{ padding: 60, textAlign: 'center', color: '#4a5568' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>▦</div>
      <div>Complétez le projet pour générer le planning.</div>
    </div>
  )

  const minDate   = tasks[0]?.startDate ? new Date(tasks[0].startDate) : new Date()
  const maxDate   = tasks.reduce((m, t) => t.endDate > m ? t.endDate : m, minDate)
  const totalDays = Math.max(1, Math.ceil((maxDate - minDate) / 86400000)) + 5
  const dayWidth  = 18
  const rowH      = 28
  const labelW    = 300

  function dayOffset(date) {
    return Math.ceil((new Date(date) - minDate) / 86400000)
  }

  const months = []
  let d = new Date(minDate); d.setDate(1)
  while (d <= maxDate) { months.push(new Date(d)); d.setMonth(d.getMonth() + 1) }

  return (
    <div style={{ padding: 32, color: '#c8d4e8' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ color: '#4a5568', fontSize: 12, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>Diagramme</div>
          <h1 style={{ color: '#e8edf5', fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em', margin: 0 }}>
            Planning Gantt — {project.nom}
          </h1>
          <div style={{ color: '#4a5568', fontSize: 13, marginTop: 4 }}>
            {tasks.length} tâches · {totalDays} jours calendaires
            {project.excelDurations && <span style={{ color: '#34d399', marginLeft: 12 }}>📊 Durées Excel</span>}
            {showMLColors && <span style={{ color: '#a78bfa', marginLeft: 12 }}>🤖 Risques ML actifs</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {/* ML Toggle */}
          <button onClick={() => setShowMLPanel(!showMLPanel)} style={{
            background: showMLPanel ? 'linear-gradient(135deg,#1d4ed8,#7c3aed)' : '#0f1e35',
            border: `1px solid ${showMLPanel ? '#3b82f6' : '#1e3a5f'}`,
            color: showMLPanel ? '#fff' : '#60a5fa',
            borderRadius: 8, padding: '10px 18px',
            fontWeight: 600, fontSize: 13, cursor: 'pointer',
            transition: 'all .2s',
          }}>
            🤖 {showMLPanel ? 'Masquer' : 'Prédiction ML'}
          </button>

          {/* Toggle couleurs ML */}
          {mlState === 'done' && (
            <button onClick={() => setShowMLColors(!showMLColors)} style={{
              background: showMLColors ? '#052e16' : 'transparent',
              border: `1px solid ${showMLColors ? '#166534' : '#1e2535'}`,
              color: showMLColors ? '#22c55e' : '#5a6a82',
              borderRadius: 8, padding: '10px 14px',
              fontWeight: 600, fontSize: 13, cursor: 'pointer',
            }}>
              {showMLColors ? '🎨 Risques ON' : '🎨 Risques OFF'}
            </button>
          )}

          <button onClick={handleExportXML} style={{
            background: '#1d3461', border: '1px solid #2a4a7f',
            color: '#60a5fa', borderRadius: 8, padding: '10px 20px',
            fontWeight: 600, fontSize: 13, cursor: 'pointer',
          }}>
            ⬇ Export XML
          </button>
        </div>
      </div>

      {/* ML Panel */}
      {showMLPanel && (
        <MLPanel
          tasks={tasks}
          mlState={mlState}
          mlPredictions={mlPredictions}
          mlStats={mlStats}
          onRunML={handleRunML}
          onReset={handleResetML}
        />
      )}

      {/* Filter by chapter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <button onClick={() => setFilter('all')} style={{
          padding: '6px 14px', borderRadius: 6,
          border: filter === 'all' ? '1px solid #3b82f6' : '1px solid #1e2535',
          background: filter === 'all' ? '#1d3461' : 'transparent',
          color: filter === 'all' ? '#60a5fa' : '#5a6a82', fontSize: 12, cursor: 'pointer',
        }}>Tout</button>
        {chapters.map(ch => (
          <button key={ch.code} onClick={() => setFilter(ch.code)} style={{
            padding: '6px 14px', borderRadius: 6,
            border: filter === ch.code ? '1px solid #3b82f6' : '1px solid #1e2535',
            background: filter === ch.code ? '#1d3461' : 'transparent',
            color: filter === ch.code ? '#60a5fa' : '#5a6a82', fontSize: 12, cursor: 'pointer',
          }}>
            {ch.code}. {ch.label.split(' ')[0]}
          </button>
        ))}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {showMLColors ? (
          <>
            <div style={{ color: '#4a5568', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em' }}>Légende ML :</div>
            {[['#ef4444','Risque élevé (≥3j)'], ['#f59e0b','Risque moyen (1.5-3j)'], ['#22c55e','Risque faible (<1.5j)']].map(([c, l]) => (
              <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 12, height: 12, borderRadius: 3, background: c }} />
                <span style={{ color: '#5a6a82', fontSize: 12 }}>{l}</span>
              </div>
            ))}
          </>
        ) : (
          <>
            {Object.entries(ELEMENT_COLORS).map(([el, color]) => (
              <div key={el} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 12, height: 12, borderRadius: 3, background: color }} />
                <span style={{ color: '#5a6a82', fontSize: 12, textTransform: 'capitalize' }}>{el}</span>
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: '#6366f1' }} />
              <span style={{ color: '#5a6a82', fontSize: 12 }}>Autres lots</span>
            </div>
          </>
        )}
      </div>

      {/* Gantt chart */}
      <div style={{ background: '#131720', border: '1px solid #1e2535', borderRadius: 12, overflow: 'hidden' }}>
        <div ref={ganttRef} style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 420px)' }}>
          <div style={{ minWidth: labelW + totalDays * dayWidth }}>
            {/* Month header */}
            <div style={{ display: 'flex', borderBottom: '1px solid #1e2535', background: '#0d1018', position: 'sticky', top: 0, zIndex: 3 }}>
              <div style={{ width: labelW, flexShrink: 0, borderRight: '1px solid #1e2535', padding: '8px 16px', color: '#4a5568', fontSize: 11 }}>
                Tâche
              </div>
              <div style={{ position: 'relative', height: 32, flex: 1, overflow: 'hidden' }}>
                {months.map((m, i) => {
                  const off = dayOffset(m)
                  return (
                    <div key={i} style={{
                      position: 'absolute', left: off * dayWidth, top: 0, height: '100%',
                      borderLeft: '1px solid #1e2535', display: 'flex', alignItems: 'center',
                      paddingLeft: 6, color: '#5a6a82', fontSize: 11, whiteSpace: 'nowrap',
                    }}>
                      {m.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })}
                    </div>
                  )
                })}
                {(() => {
                  const todayOff = dayOffset(new Date())
                  if (todayOff >= 0 && todayOff <= totalDays) return (
                    <div style={{
                      position: 'absolute', left: todayOff * dayWidth, top: 0, bottom: 0,
                      width: 2, background: '#ef4444', opacity: .6, pointerEvents: 'none',
                    }} />
                  )
                  return null
                })()}
              </div>
            </div>

            {/* Rows */}
            {tasks.map((task, i) => {
              const off = dayOffset(task.startDate)
              const pred = mlPredictions[task.id]
              const dureeAffichee = showMLColors && pred ? task.duree + pred.retard_jours : task.duree
              const w = Math.max(2, dureeAffichee * dayWidth)
              const color = getTaskColor(task, mlPredictions, showMLColors)

              return (
                <div key={task.id} style={{
                  display: 'flex', height: rowH,
                  borderBottom: '1px solid #1e253566',
                  background: i % 2 === 0 ? 'transparent' : '#0d101833',
                  alignItems: 'center',
                }}>
                  <div style={{
                    width: labelW, flexShrink: 0, borderRight: '1px solid #1e2535',
                    padding: '0 16px', overflow: 'hidden', whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    <span style={{ color: '#3d4f6a', fontSize: 10, fontFamily: 'monospace', flexShrink: 0 }}>{task.code}</span>
                    {showMLColors && pred && (
                      <span style={{ fontSize: 9, flexShrink: 0 }}>
                        {getRiskLevel(pred.retard_jours).badge}
                      </span>
                    )}
                    <span style={{ color: task.element ? (ELEMENT_COLORS[task.element] || '#b0bfd4') : '#b0bfd4', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {task.niveau ? <span style={{ color: '#4a5568', marginRight: 4, fontSize: 11 }}>{task.niveau} ·</span> : null}
                      {task.label}
                    </span>
                  </div>
                  <div style={{ position: 'relative', flex: 1, height: '100%' }}>
                    {/* Barre originale */}
                    <div style={{
                      position: 'absolute',
                      left: off * dayWidth, top: '50%', transform: 'translateY(-50%)',
                      width: task.duree * dayWidth, height: rowH - 8,
                      background: color, borderRadius: 4, opacity: showMLColors && pred ? .7 : .85,
                      display: 'flex', alignItems: 'center', paddingLeft: 6,
                      overflow: 'hidden', cursor: 'default',
                    }} title={task.label + ' — ' + task.duree + ' j'}>
                      {task.duree * dayWidth > 40 && (
                        <span style={{ color: 'rgba(255,255,255,.9)', fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {task.duree} j
                        </span>
                      )}
                    </div>
                    {/* Extension retard ML */}
                    {showMLColors && pred && pred.retard_jours > 0 && (
                      <div style={{
                        position: 'absolute',
                        left: (off + task.duree) * dayWidth, top: '50%', transform: 'translateY(-50%)',
                        width: pred.retard_jours * dayWidth, height: rowH - 8,
                        background: getRiskLevel(pred.retard_jours).couleur,
                        borderRadius: '0 4px 4px 0', opacity: .5,
                        borderLeft: `2px solid ${getRiskLevel(pred.retard_jours).couleur}`,
                      }} title={`Retard prédit : +${pred.retard_jours.toFixed(1)} j`} />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Summary */}
      <div style={{ display: 'flex', gap: 16, marginTop: 16, flexWrap: 'wrap' }}>
        <div style={{ color: '#4a5568', fontSize: 12 }}>
          🗓️ Début : <strong style={{ color: '#c8d4e8' }}>{project.dateDebut}</strong>
        </div>
        <div style={{ color: '#4a5568', fontSize: 12 }}>
          🏁 Fin estimée : <strong style={{ color: '#c8d4e8' }}>{maxDate.toLocaleDateString('fr-FR')}</strong>
        </div>
        <div style={{ color: '#4a5568', fontSize: 12 }}>
          ⏱ Durée totale : <strong style={{ color: '#34d399' }}>{totalDays} jours</strong>
        </div>
        {showMLColors && mlStats && (
          <div style={{ color: '#4a5568', fontSize: 12 }}>
            🤖 Retard ML estimé : <strong style={{ color: '#a78bfa' }}>+{mlStats.totalRetard.toFixed(0)} jours</strong>
          </div>
        )}
      </div>
    </div>
  )
}
