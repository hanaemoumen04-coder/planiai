import React, { useState } from 'react'
import Dashboard from './pages/Dashboard.jsx'
import NouveauProjet from './pages/NouveauProjet.jsx'
import WBSPage from './pages/WBSPage.jsx'
import PlanningPage from './pages/PlanningPage.jsx'

const NAV = [
  { id: 'dashboard', label: 'Tableau de bord', icon: '◈' },
  { id: 'nouveau',   label: 'Nouveau projet',  icon: '✦' },
  { id: 'wbs',       label: 'WBS',             icon: '⬡' },
  { id: 'planning',  label: 'Planning Gantt',  icon: '▦' },
]

const LOGO = '⬡'

export default function App() {
  const [page, setPage]                   = useState('dashboard')
  const [projects, setProjects]           = useState([])
  const [activeProjectId, setActiveProjectId] = useState(null)
  const [sidebarOpen, setSidebarOpen]     = useState(true)

  const activeProject = projects.find(p => p.id === activeProjectId) || null

  function saveProject(project) {
    setProjects(prev => {
      const exists = prev.find(p => p.id === project.id)
      if (exists) return prev.map(p => p.id === project.id ? project : p)
      return [...prev, project]
    })
    setActiveProjectId(project.id)
    setPage('wbs')
  }

  function updateProject(updated) {
    setProjects(prev => prev.map(p => p.id === updated.id ? updated : p))
  }

  const renderPage = () => {
    switch (page) {
      case 'dashboard': return <Dashboard projects={projects} activeProject={activeProject} onSelect={id => { setActiveProjectId(id); setPage('wbs') }} onNew={() => setPage('nouveau')} />
      case 'nouveau':   return <NouveauProjet onSave={saveProject} existingProject={activeProject} />
      case 'wbs':       return <WBSPage project={activeProject} onUpdate={updateProject} />
      case 'planning':  return <PlanningPage project={activeProject} />
      default:          return <Dashboard projects={projects} activeProject={activeProject} onSelect={id => { setActiveProjectId(id); setPage('wbs') }} onNew={() => setPage('nouveau')} />
    }
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#0d0f14', fontFamily: "'IBM Plex Sans','Segoe UI',system-ui,sans-serif" }}>
      {/* Sidebar */}
      <aside style={{
        width: sidebarOpen ? 240 : 64,
        transition: 'width .25s cubic-bezier(.4,0,.2,1)',
        background: 'linear-gradient(180deg,#131720 0%,#0d1018 100%)',
        borderRight: '1px solid #1e2535',
        display: 'flex', flexDirection: 'column',
        flexShrink: 0, zIndex: 10,
      }}>
        {/* Logo */}
        <div style={{ padding: '24px 16px 20px', borderBottom: '1px solid #1e2535', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: 'linear-gradient(135deg,#3b82f6,#6366f1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, color: '#fff', fontWeight: 700,
          }}>{LOGO}</div>
          {sidebarOpen && <div>
            <div style={{ color: '#e8edf5', fontWeight: 700, fontSize: 15, letterSpacing: '-0.02em' }}>PlaniAI</div>
            <div style={{ color: '#4a5568', fontSize: 11, marginTop: 2 }}>Planification BTP</div>
          </div>}
        </div>

        {/* Project selector */}
        {sidebarOpen && projects.length > 0 && (
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #1e2535' }}>
            <div style={{ color: '#4a5568', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>Projet actif</div>
            <select
              value={activeProjectId || ''}
              onChange={e => setActiveProjectId(e.target.value)}
              style={{ width: '100%', background: '#1a2030', border: '1px solid #2a3347', borderRadius: 6, color: '#c8d4e8', padding: '6px 8px', fontSize: 12, cursor: 'pointer' }}
            >
              {projects.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
            </select>
          </div>
        )}

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV.map(item => {
            const active = page === item.id
            return (
              <button key={item.id} onClick={() => setPage(item.id)} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: sidebarOpen ? '10px 12px' : '10px 0',
                justifyContent: sidebarOpen ? 'flex-start' : 'center',
                borderRadius: 8, border: 'none', cursor: 'pointer',
                background: active ? 'linear-gradient(90deg,#1d3461,#1e3a5f)' : 'transparent',
                color: active ? '#60a5fa' : '#5a6a82',
                fontSize: 13, fontWeight: active ? 600 : 400,
                transition: 'all .15s', width: '100%',
                borderLeft: active ? '2px solid #3b82f6' : '2px solid transparent',
              }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>{item.icon}</span>
                {sidebarOpen && <span>{item.label}</span>}
              </button>
            )
          })}
        </nav>

        {/* Toggle */}
        <button onClick={() => setSidebarOpen(o => !o)} style={{
          margin: '8px', padding: '10px', border: '1px solid #1e2535', borderRadius: 8,
          background: 'transparent', color: '#4a5568', cursor: 'pointer', fontSize: 14,
          transition: 'all .15s',
        }}>{sidebarOpen ? '◀' : '▶'}</button>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, overflow: 'auto', background: '#0d0f14' }}>
        {renderPage()}
      </main>
    </div>
  )
}
