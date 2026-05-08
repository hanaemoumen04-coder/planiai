import React, { useState } from 'react'
import { BUILDING_TYPES, LOTS, importProjectXML, parseExcelDurations } from '../data/projectEngine.js'
import * as XLSX from 'xlsx'

function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{ display: 'block', color: '#7a8fa8', fontSize: 12, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
        {label}
      </label>
      {children}
      {hint && <div style={{ color: '#3d4f6a', fontSize: 11, marginTop: 4 }}>{hint}</div>}
    </div>
  )
}

const inputStyle = {
  width: '100%', background: '#0d1018', border: '1px solid #1e2535',
  borderRadius: 8, color: '#c8d4e8', padding: '10px 14px', fontSize: 14, outline: 'none',
}

const sectionStyle = {
  background: '#131720', border: '1px solid #1e2535', borderRadius: 12,
  padding: 24, marginBottom: 20,
}

const ELEMENT_LABELS = { poteaux: 'Poteaux', voiles: 'Voiles', poutres: 'Poutres', dalle: 'PH/Dalle' }
const ELEMENT_COLORS = { poteaux: '#60a5fa', voiles: '#34d399', poutres: '#f59e0b', dalle: '#a78bfa' }

export default function NouveauProjet({ onSave, existingProject }) {
  const [form, setForm] = useState(existingProject || {
    nom: '', type: 'residential', niveaux: 5, sousSols: 0,
    blocs: 1, surface: 2000, duree: 180,
    dateDebut: new Date().toISOString().slice(0, 10),
    lots: ['gros_oeuvre', 'maconnerie'],
    excelDurations: null,
  })
  const [importError, setImportError] = useState('')
  const [excelStatus, setExcelStatus]   = useState('idle') // idle | success | error
  const [excelFileName, setExcelFileName] = useState('')

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  function toggleLot(id) {
    setForm(f => ({
      ...f,
      lots: f.lots.includes(id) ? f.lots.filter(l => l !== id) : [...f.lots, id],
    }))
  }

  function handleSubmit() {
    if (!form.nom.trim()) { alert('Le nom du projet est obligatoire.'); return }
    onSave({
      ...form,
      id: existingProject?.id || 'proj_' + Date.now(),
      niveaux:  parseInt(form.niveaux)  || 0,
      sousSols: parseInt(form.sousSols) || 0,
      blocs:    parseInt(form.blocs)    || 1,
      surface:  parseInt(form.surface)  || 1000,
      duree:    parseInt(form.duree)    || 90,
    })
  }

  function handleXMLImport(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = evt => {
      try {
        const parsed = importProjectXML(evt.target.result)
        setForm(f => ({ ...f, ...parsed }))
        setImportError('')
      } catch {
        setImportError('Erreur lors de la lecture du fichier XML.')
      }
    }
    reader.readAsText(file)
  }

  // ── Excel import for durations ───────────────────────────────────────────
  function handleExcelImport(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setExcelStatus('idle')
    setExcelFileName(file.name)

    const reader = new FileReader()
    reader.onload = evt => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })
        const durations = parseExcelDurations(rows)
        const nbLevels = Object.keys(durations).length
        if (nbLevels === 0) {
          setExcelStatus('error')
          return
        }
        setForm(f => ({ ...f, excelDurations: durations }))
        setExcelStatus('success')
      } catch {
        setExcelStatus('error')
      }
    }
    reader.readAsArrayBuffer(file)
  }

  function clearExcel() {
    setForm(f => ({ ...f, excelDurations: null }))
    setExcelStatus('idle')
    setExcelFileName('')
  }

  const levels = form.excelDurations ? Object.keys(form.excelDurations) : []

  return (
    <div style={{ padding: 32, color: '#c8d4e8', maxWidth: 860, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ color: '#4a5568', fontSize: 12, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>Configuration</div>
        <h1 style={{ color: '#e8edf5', fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em', margin: 0 }}>
          {existingProject ? 'Modifier le projet' : 'Nouveau projet'}
        </h1>
      </div>

      {/* ── Identité ──────────────────────────────────────────────────────── */}
      <div style={sectionStyle}>
        <h3 style={{ color: '#e8edf5', fontWeight: 600, fontSize: 15, marginBottom: 20, borderBottom: '1px solid #1e2535', paddingBottom: 12 }}>
          ✦ Identité du projet
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div style={{ gridColumn: '1/-1' }}>
            <Field label="Nom du projet *">
              <input value={form.nom} onChange={e => set('nom', e.target.value)}
                placeholder="Ex : Résidence Les Acacias — Immeuble A"
                style={{ ...inputStyle, borderColor: !form.nom ? '#3a2020' : '#1e2535' }} />
            </Field>
          </div>
          <Field label="Type de bâtiment *">
            <div style={{ display: 'flex', gap: 8 }}>
              {BUILDING_TYPES.map(t => (
                <button key={t.id} onClick={() => set('type', t.id)} style={{
                  flex: 1, padding: '10px 8px', borderRadius: 8, cursor: 'pointer',
                  border: form.type === t.id ? '2px solid #3b82f6' : '1px solid #1e2535',
                  background: form.type === t.id ? '#1d3461' : '#0d1018',
                  color: form.type === t.id ? '#60a5fa' : '#5a6a82',
                  fontSize: 12, textAlign: 'center', transition: 'all .15s',
                }}>
                  <div style={{ fontSize: 20, marginBottom: 4 }}>{t.icon}</div>
                  <div>{t.label.replace('Bâtiment ', '')}</div>
                </button>
              ))}
            </div>
          </Field>
          <Field label="Date de début">
            <input type="date" value={form.dateDebut} onChange={e => set('dateDebut', e.target.value)} style={inputStyle} />
          </Field>
          <Field label="Durée estimée (jours)" hint="Durée totale du chantier">
            <input type="number" min={1} value={form.duree} onChange={e => set('duree', e.target.value)} style={inputStyle} />
          </Field>
        </div>
      </div>

      {/* ── Données physiques ─────────────────────────────────────────────── */}
      <div style={sectionStyle}>
        <h3 style={{ color: '#e8edf5', fontWeight: 600, fontSize: 15, marginBottom: 20, borderBottom: '1px solid #1e2535', paddingBottom: 12 }}>
          ⬡ Données physiques
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 20 }}>
          <Field label="Sous-sols" hint="Nombre de niveaux souterrains">
            <input type="number" min={0} max={10} value={form.sousSols} onChange={e => set('sousSols', e.target.value)} style={inputStyle} />
          </Field>
          <Field label="Niveaux en superstr." hint="Hors RDC">
            <input type="number" min={0} max={100} value={form.niveaux} onChange={e => set('niveaux', e.target.value)} style={inputStyle} />
          </Field>
          <Field label="Blocs / immeubles">
            <input type="number" min={1} max={20} value={form.blocs} onChange={e => set('blocs', e.target.value)} style={inputStyle} />
          </Field>
          <Field label="Surface plancher (m²)">
            <input type="number" min={0} value={form.surface} onChange={e => set('surface', e.target.value)} style={inputStyle} />
          </Field>
        </div>
      </div>

      {/* ── Import Excel durées ───────────────────────────────────────────── */}
      <div style={{ ...sectionStyle, border: '1px solid #2a3347' }}>
        <h3 style={{ color: '#e8edf5', fontWeight: 600, fontSize: 15, marginBottom: 6, borderBottom: '1px solid #1e2535', paddingBottom: 12 }}>
          📊 Durées par étage — Import Excel
        </h3>
        <div style={{ color: '#4a5568', fontSize: 12, marginBottom: 16 }}>
          Chargez votre planning Excel (format Synthèse Planning) pour importer automatiquement les durées par niveau et par type d'élément.
          Les colonnes attendues : <strong style={{ color: '#60a5fa' }}>Tâche · Crédit d'heure · Nombre d'équipes · Jours de travail calendaire</strong>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{
            background: '#1a2030', border: '1px solid #2a3347', borderRadius: 8,
            padding: '10px 16px', color: '#60a5fa', fontSize: 13, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            📂 {excelFileName || 'Choisir un fichier Excel (.xlsx)'}
            <input type="file" accept=".xlsx,.xls" onChange={handleExcelImport} style={{ display: 'none' }} />
          </label>

          {form.excelDurations && (
            <button onClick={clearExcel} style={{
              background: 'transparent', border: '1px solid #4a1a1a',
              color: '#ef4444', borderRadius: 8, padding: '10px 14px',
              fontSize: 12, cursor: 'pointer',
            }}>✕ Retirer</button>
          )}

          {/* Import XML */}
          <label style={{
            background: 'transparent', border: '1px solid #1e2535', borderRadius: 8,
            padding: '10px 14px', color: '#5a6a82', fontSize: 12, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
          }} title="Importer un projet XML PlaniAI">
            📂 XML projet
            <input type="file" accept=".xml" onChange={handleXMLImport} style={{ display: 'none' }} />
          </label>
        </div>

        {importError && <div style={{ marginTop: 8, color: '#ef4444', fontSize: 12 }}>{importError}</div>}

        {/* Excel import result */}
        {excelStatus === 'success' && form.excelDurations && (
          <div style={{ marginTop: 16 }}>
            <div style={{ color: '#34d399', fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
              ✓ {levels.length} niveaux importés depuis « {excelFileName} »
            </div>
            <div style={{
              background: '#0d1018', border: '1px solid #1e2535', borderRadius: 10,
              overflow: 'hidden', maxHeight: 300, overflowY: 'auto',
            }}>
              {/* Header */}
              <div style={{
                display: 'grid', gridTemplateColumns: '120px 1fr',
                padding: '8px 16px', background: '#131720',
                borderBottom: '1px solid #1e2535',
                color: '#4a5568', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em',
              }}>
                <div>Niveau</div>
                <div>Durées (jours)</div>
              </div>
              {levels.map((lvl, i) => {
                const d = form.excelDurations[lvl]
                return (
                  <div key={lvl} style={{
                    display: 'grid', gridTemplateColumns: '120px 1fr',
                    padding: '8px 16px', alignItems: 'center',
                    borderBottom: i < levels.length - 1 ? '1px solid #1e253555' : 'none',
                    background: i % 2 === 0 ? 'transparent' : '#0d101822',
                  }}>
                    <div style={{ color: '#60a5fa', fontWeight: 600, fontSize: 13 }}>{lvl}</div>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      {Object.entries(d).map(([el, dur]) => (
                        <span key={el} style={{
                          background: '#131720', border: '1px solid #1e2535',
                          borderRadius: 6, padding: '2px 10px', fontSize: 12,
                          color: ELEMENT_COLORS[el] || '#c8d4e8',
                        }}>
                          {ELEMENT_LABELS[el] || el} : <strong>{dur} j</strong>
                        </span>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {excelStatus === 'error' && (
          <div style={{ marginTop: 12, color: '#ef4444', fontSize: 13 }}>
            ✗ Impossible de lire le fichier. Vérifiez que le format correspond au modèle attendu (colonnes : Tâche, Crédit d'heure, Équipes, Jours).
          </div>
        )}

        {/* No Excel: show default durations info */}
        {!form.excelDurations && excelStatus === 'idle' && (
          <div style={{ marginTop: 12, background: '#0d1018', border: '1px solid #1a2535', borderRadius: 8, padding: '10px 14px' }}>
            <div style={{ color: '#4a5568', fontSize: 12, marginBottom: 6 }}>Durées par défaut (utilisées si pas d'Excel) :</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {Object.entries({ poteaux: 5, voiles: 8, poutres: 5, dalle: 20 }).map(([el, dur]) => (
                <span key={el} style={{
                  background: '#131720', border: '1px solid #1e2535', borderRadius: 6,
                  padding: '2px 10px', fontSize: 12, color: ELEMENT_COLORS[el],
                }}>
                  {ELEMENT_LABELS[el]} : {dur} j
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Lots techniques ───────────────────────────────────────────────── */}
      <div style={sectionStyle}>
        <h3 style={{ color: '#e8edf5', fontWeight: 600, fontSize: 15, marginBottom: 20, borderBottom: '1px solid #1e2535', paddingBottom: 12 }}>
          ⏱ Lots techniques concernés
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 10 }}>
          {LOTS.map(lot => {
            const active = form.lots?.includes(lot.id)
            return (
              <button key={lot.id} onClick={() => toggleLot(lot.id)} style={{
                padding: '10px 14px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                border: active ? '1px solid #3b82f6' : '1px solid #1e2535',
                background: active ? '#1d3461' : '#0d1018',
                color: active ? '#60a5fa' : '#5a6a82',
                fontSize: 13, transition: 'all .15s',
              }}>
                {active ? '✓ ' : '○ '}{lot.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Submit ────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
        <button onClick={handleSubmit} style={{
          background: 'linear-gradient(135deg,#3b82f6,#6366f1)',
          color: '#fff', border: 'none', borderRadius: 8,
          padding: '14px 36px', fontWeight: 700, fontSize: 15, cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(59,130,246,.4)',
        }}>
          {existingProject ? 'Mettre à jour →' : 'Créer le projet →'}
        </button>
      </div>
    </div>
  )
}
