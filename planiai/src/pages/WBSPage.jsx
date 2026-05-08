import React, { useMemo, useState } from 'react'
import { buildWBS, exportProjectXML } from '../data/projectEngine.js'

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

export default function WBSPage({ project, onUpdate }) {
  const [search, setSearch]     = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editVal, setEditVal]   = useState('')

  const wbs = useMemo(() => {
    if (!project) return []
    return buildWBS(project)
  }, [project])

  const filtered = useMemo(() => {
    if (!search) return wbs
    const q = search.toLowerCase()
    return wbs.filter(t => t.label.toLowerCase().includes(q) || t.code.includes(q))
  }, [wbs, search])

  function startEdit(task) {
    setEditingId(task.id)
    setEditVal(task.duree ?? '')
  }

  function commitEdit(task) {
    setEditingId(null)
  }

  function handleExportXML() {
    const xml = exportProjectXML(project, wbs)
    const slug = project.nom.replace(/\s+/g, '_').toLowerCase()
    downloadXML(xml, slug + '_WBS.xml')
  }

  const chapters = wbs.filter(t => t.isChapter).length
  const tasks    = wbs.filter(t => !t.isChapter).length
  const totalDays = wbs.filter(t => !t.isChapter).reduce((s, t) => s + (t.duree || 0), 0)

  // Count structural tasks
  const superstructureTasks = wbs.filter(t => !t.isChapter && t.niveau)
  const nbLevels = [...new Set(superstructureTasks.map(t => t.niveau))].length

  if (!project) return (
    <div style={{ padding: 60, textAlign: 'center', color: '#4a5568' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>⬡</div>
      <div>Sélectionnez ou créez un projet pour voir son WBS.</div>
    </div>
  )

  return (
    <div style={{ padding: 32, color: '#c8d4e8' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ color: '#4a5568', fontSize: 12, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>Structure de découpage</div>
          <h1 style={{ color: '#e8edf5', fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em', margin: 0 }}>
            WBS — {project.nom}
          </h1>
          <div style={{ color: '#4a5568', fontSize: 13, marginTop: 4 }}>
            {chapters} chapitres · {tasks} tâches · {totalDays} jours total
            {project.excelDurations && <span style={{ color: '#34d399', marginLeft: 12 }}>📊 Durées Excel ({nbLevels} niveaux)</span>}
          </div>
        </div>
        <button onClick={handleExportXML} style={{
          background: '#1d3461', border: '1px solid #2a4a7f',
          color: '#60a5fa', borderRadius: 8, padding: '10px 20px',
          fontWeight: 600, fontSize: 13, cursor: 'pointer',
        }}>
          ⬇ Export XML
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
        {[
          { label: 'Chapitres WBS',    value: chapters,             color: '#a78bfa' },
          { label: 'Tâches générées',  value: tasks,                color: '#60a5fa' },
          { label: 'Durée totale',     value: totalDays + ' j',     color: '#34d399' },
          { label: 'Niveaux struct.',  value: nbLevels,             color: '#f59e0b' },
          { label: 'Source durées',    value: project.excelDurations ? 'Excel' : 'Défaut', color: project.excelDurations ? '#34d399' : '#4a5568' },
        ].map(k => (
          <div key={k.label} style={{
            background: '#131720', border: '1px solid #1e2535', borderRadius: 10,
            padding: '14px 20px', minWidth: 130,
          }}>
            <div style={{ color: '#4a5568', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>{k.label}</div>
            <div style={{ color: k.color, fontSize: 22, fontWeight: 700 }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div style={{ marginBottom: 16 }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher une tâche..."
          style={{
            width: 320, background: '#131720', border: '1px solid #1e2535',
            borderRadius: 8, color: '#c8d4e8', padding: '10px 14px', fontSize: 13, outline: 'none',
          }}
        />
      </div>

      {/* WBS Table */}
      <div style={{ background: '#131720', border: '1px solid #1e2535', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '100px 1fr 60px 90px 120px',
          padding: '10px 20px', background: '#0d1018', borderBottom: '1px solid #1e2535',
          color: '#4a5568', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em',
        }}>
          <div>Code</div>
          <div>Intitulé</div>
          <div style={{ textAlign: 'right' }}>Durée</div>
          <div style={{ textAlign: 'center' }}>Niveau</div>
          <div style={{ textAlign: 'center' }}>Type</div>
        </div>

        <div style={{ maxHeight: 'calc(100vh - 400px)', overflowY: 'auto' }}>
          {filtered.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: '#3d4f6a' }}>Aucune tâche trouvée.</div>
          )}
          {filtered.map((task, i) => {
            const elColor = task.element ? (ELEMENT_COLORS[task.element] || '#c8d4e8') : null
            const indent = task.level === 3 ? 52 : task.level === 2 ? 36 : 20
            return (
              <div key={task.id} style={{
                display: 'grid', gridTemplateColumns: '100px 1fr 60px 90px 120px',
                padding: task.isChapter
                  ? '12px 20px 12px ' + indent + 'px'
                  : '9px 20px 9px ' + indent + 'px',
                borderBottom: i < filtered.length - 1 ? '1px solid #1e253566' : 'none',
                background: task.isChapter
                  ? 'linear-gradient(90deg,#1a2030,#131720)'
                  : i % 2 === 0 ? 'transparent' : '#0d101833',
                alignItems: 'center',
                transition: 'background .15s',
              }}>
                <div style={{
                  color: task.isChapter ? '#60a5fa' : '#4a5568',
                  fontWeight: task.isChapter ? 700 : 400,
                  fontSize: task.isChapter ? 13 : 12,
                  fontFamily: 'monospace',
                }}>
                  {task.code}
                </div>
                <div style={{
                  color: task.isChapter ? '#e8edf5' : (elColor || '#b0bfd4'),
                  fontWeight: task.isChapter ? 600 : 400,
                  fontSize: task.isChapter ? 14 : 13,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  {task.isChapter && <span style={{ color: '#3b82f6' }}>▸</span>}
                  {task.niveau && !task.isChapter && (
                    <span style={{ color: '#3d4f6a', fontSize: 10, flexShrink: 0 }}>{task.niveau}</span>
                  )}
                  {task.label}
                </div>
                <div style={{ textAlign: 'right' }}>
                  {!task.isChapter && (
                    editingId === task.id ? (
                      <input
                        autoFocus value={editVal}
                        onChange={e => setEditVal(e.target.value)}
                        onBlur={() => commitEdit(task)}
                        onKeyDown={e => e.key === 'Enter' && commitEdit(task)}
                        style={{
                          width: 50, background: '#0d1018', border: '1px solid #3b82f6',
                          borderRadius: 4, color: '#c8d4e8', padding: '2px 6px',
                          fontSize: 12, textAlign: 'right', outline: 'none',
                        }}
                      />
                    ) : (
                      <span
                        onClick={() => startEdit(task)}
                        title="Cliquer pour modifier"
                        style={{
                          color: task.duree > 0 ? '#c8d4e8' : '#3d4f6a',
                          cursor: 'pointer', fontSize: 13,
                          padding: '2px 8px', borderRadius: 4,
                          background: task.duree > 0 ? '#1a2030' : 'transparent',
                        }}>
                        {task.duree != null ? task.duree + ' j' : '—'}
                      </span>
                    )
                  )}
                </div>
                <div style={{ textAlign: 'center' }}>
                  <span style={{
                    color: task.isChapter ? '#3b82f6' : '#4a5568',
                    fontSize: 11,
                    background: task.isChapter ? '#1d3461' : 'transparent',
                    padding: '2px 8px', borderRadius: 12,
                  }}>
                    {task.isChapter ? 'Chapitre' : 'Tâche'}
                  </span>
                </div>
                <div style={{ textAlign: 'center' }}>
                  {task.element && (
                    <span style={{
                      color: elColor, fontSize: 11,
                      background: '#0d1018', border: '1px solid ' + elColor + '44',
                      padding: '2px 8px', borderRadius: 12,
                      textTransform: 'capitalize',
                    }}>
                      {task.element}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ marginTop: 12, color: '#3d4f6a', fontSize: 11 }}>
        ✏️ Cliquez sur une durée pour la modifier. Structure : Étage → Type d'élément (Poteaux · Voiles · Poutres · PH/Dalle)
      </div>
    </div>
  )
}
