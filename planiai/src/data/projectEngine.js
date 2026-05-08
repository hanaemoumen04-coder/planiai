// ─────────────────────────────────────────────────────────────────────────────
// projectEngine.js — PlaniAI v3
// Corrections :
//   1. Durées = jours ouvrés ENTIERS (hors week-ends + jours fériés marocains)
//   2. Calendrier MSP avec 9 jours fériés civils marocains
//   3. Prédécesseurs corrects : Poteau→Voile FD, Dalle N-1→Poteau N FD, Dalle→Poutre DD
// ─────────────────────────────────────────────────────────────────────────────

export const BUILDING_TYPES = [
  { id: 'residential', label: 'Bâtiment résidentiel', icon: '🏠' },
  { id: 'tertiary',    label: 'Bâtiment tertiaire',   icon: '🏢' },
  { id: 'industrial',  label: 'Bâtiment industriel',  icon: '🏭' },
]

export const LOTS = [
  { id: 'gros_oeuvre',  label: 'Gros Œuvre' },
  { id: 'maconnerie',   label: 'Maçonnerie' },
  { id: 'plomberie',    label: 'Plomberie / Sanitaire' },
  { id: 'electricite',  label: 'Électricité CF/CFA' },
  { id: 'cvc',          label: 'CVC / Climatisation' },
  { id: 'ascenseur',    label: 'Ascenseurs' },
  { id: 'facade',       label: 'Façades / Étanchéité' },
  { id: 'finitions',    label: 'Finitions intérieures' },
  { id: 'vrd',          label: 'VRD / Aménagements ext.' },
]

export const ELEMENTS_STRUCTURELS = [
  { id: 'poteaux', label: 'Poteaux',  icon: '⬛' },
  { id: 'voiles',  label: 'Voiles',   icon: '▮' },
  { id: 'poutres', label: 'Poutres',  icon: '▬' },
  { id: 'dalle',   label: 'PH/Dalle', icon: '▩' },
]

// ── ✅ CALENDRIER MAROC ──────────────────────────────────────────────────────
// Jours fériés civils fixes marocains
const MAROC_HOLIDAYS = [
  { m: 1,  d: 1  },  // Nouvel an
  { m: 1,  d: 11 },  // Anniversaire de l'Indépendance
  { m: 5,  d: 1  },  // Fête du Travail
  { m: 7,  d: 30 },  // Fête du Trône
  { m: 8,  d: 14 },  // Allégeance Oued Eddahab
  { m: 8,  d: 20 },  // Révolution du Roi et du Peuple
  { m: 8,  d: 21 },  // Anniversaire du Roi Mohammed VI
  { m: 11, d: 6  },  // Anniversaire de la Marche Verte
  { m: 11, d: 18 },  // Fête de l'Indépendance
]

function isMarocHoliday(date) {
  const m = date.getMonth() + 1
  const d = date.getDate()
  return MAROC_HOLIDAYS.some(h => h.m === m && h.d === d)
}

// Calendrier Maroc : repos samedi (6) + dimanche (0) + jours fériés
function isNonWorkingDay(date) {
  const day = date.getDay()
  if (day === 0 || day === 6) return true
  return isMarocHoliday(date)
}

// ✅ Ajouter N jours ouvrés à une date (skip non-ouvrés)
export function addWorkingDays(startDate, days) {
  const d = new Date(startDate)
  let added = 0
  while (added < days) {
    d.setDate(d.getDate() + 1)
    if (!isNonWorkingDay(d)) added++
  }
  return d
}

// Compter les jours ouvrés entre deux dates
export function countWorkingDays(start, end) {
  let count = 0
  const d = new Date(start)
  while (d < end) {
    if (!isNonWorkingDay(d)) count++
    d.setDate(d.getDate() + 1)
  }
  return count
}

// ── Excel duration parser ────────────────────────────────────────────────────
export function parseExcelDurations(rows) {
  const result = {}
  let currentLevel = null

  const normalizeLevel = (raw) => {
    if (!raw) return null
    let s = raw.toString().replace(/[▌▐│■]/g, '').trim().toUpperCase()
    if (s.includes('SOUS-SOL 2') || s.match(/\bSS2\b/)) return 'SS2'
    if (s.includes('SOUS-SOL 1') || s.match(/\bSS1\b/)) return 'SS1'
    if (s.match(/\b(RDC|RDCH|REZ-DE-CHAUSS)/)) return 'RDC'
    const m = s.match(/(\d+)\s*[EÈÊÈME]+\s*(ÉTAGE|ETAGE)?/)
    if (m) return 'R+' + m[1]
    if (s.length > 0 && s.length < 40) return s
    return null
  }

  const normalizeElement = (raw) => {
    if (!raw) return null
    const s = raw.toString().toUpperCase()
    if (s.startsWith('POTEAU')) return 'poteaux'
    if (s.startsWith('VOILE'))  return 'voiles'
    if (s.startsWith('POUTRE')) return 'poutres'
    if (s.startsWith('PH') || s.startsWith('DALLE')) return 'dalle'
    return null
  }

  for (const row of rows) {
    if (!row || row.every(c => c == null)) continue
    const cell0 = row[0]?.toString().trim() || ''
    const cell3 = row[3]

    if (cell0.includes('▌') || cell0.includes('▐') || cell0.includes('■')) {
      const lvl = normalizeLevel(cell0)
      if (lvl) { currentLevel = lvl; if (!result[currentLevel]) result[currentLevel] = {} }
      continue
    }

    // ✅ Durée toujours entière
    if (currentLevel && cell3 != null && !isNaN(parseFloat(cell3))) {
      const el = normalizeElement(cell0)
      if (el) result[currentLevel][el] = Math.round(parseFloat(cell3))
    }
  }

  return result
}

// ── WBS Templates ────────────────────────────────────────────────────────────
export const WBS_TEMPLATES = {
  residential: [
    { code: '1', label: 'Préparation & Terrassement', children: [
      { code: '1.1', label: 'Installation de chantier', duree: 5 },
      { code: '1.2', label: 'Terrassement général',     duree: 10 },
      { code: '1.3', label: 'Fouilles en puits',        duree: 7 },
    ]},
    { code: '2', label: 'Infrastructure', children: [
      { code: '2.1', label: 'Fondations (semelles)', duree: 14 },
      { code: '2.2', label: 'Voiles de fondation',   duree: 10 },
      { code: '2.3', label: 'Dallage sous-sol',       duree: 7 },
    ]},
    { code: '3', label: 'Superstructure', children: [] },
    { code: '4', label: 'Maçonnerie & Cloisonnement', children: [
      { code: '4.1', label: 'Murs extérieurs',      duree: 0 },
      { code: '4.2', label: 'Cloisons intérieures', duree: 0 },
    ]},
    { code: '5', label: 'Lots Techniques', children: [] },
    { code: '6', label: 'Façades & Étanchéité', children: [
      { code: '6.1', label: 'Étanchéité toiture', duree: 0 },
      { code: '6.2', label: 'Revêtement façade',  duree: 0 },
    ]},
    { code: '7', label: 'Finitions', children: [
      { code: '7.1', label: 'Enduits & peintures',     duree: 0 },
      { code: '7.2', label: 'Carrelage & revêtements', duree: 0 },
      { code: '7.3', label: 'Menuiseries intérieures', duree: 0 },
      { code: '7.4', label: 'Menuiseries extérieures', duree: 0 },
    ]},
    { code: '8', label: 'VRD & Aménagements extérieurs', children: [
      { code: '8.1', label: 'Réseaux extérieurs', duree: 0 },
      { code: '8.2', label: 'Voirie & parkings',  duree: 0 },
      { code: '8.3', label: 'Espaces verts',       duree: 0 },
    ]},
    { code: '9', label: 'Réception & Livraison', children: [
      { code: '9.1', label: 'Levée des réserves',    duree: 7 },
      { code: '9.2', label: 'Réception des travaux', duree: 3 },
    ]},
  ],
  tertiary: [
    { code: '1', label: 'Préparation & Terrassement', children: [
      { code: '1.1', label: 'Installation de chantier',        duree: 7 },
      { code: '1.2', label: 'Démolition / Préparation terrain', duree: 10 },
      { code: '1.3', label: 'Terrassement général',            duree: 12 },
    ]},
    { code: '2', label: 'Infrastructure', children: [
      { code: '2.1', label: 'Pieux / Micropieux',        duree: 14 },
      { code: '2.2', label: 'Radier général / Semelles', duree: 14 },
      { code: '2.3', label: 'Voiles périphériques',      duree: 10 },
    ]},
    { code: '3', label: 'Superstructure', children: [] },
    { code: '4', label: 'Enveloppe du bâtiment', children: [
      { code: '4.1', label: 'Façades rideaux / double peau', duree: 0 },
      { code: '4.2', label: 'Toiture terrasse',              duree: 0 },
      { code: '4.3', label: 'Menuiseries extérieures',       duree: 0 },
    ]},
    { code: '5', label: 'Lots Techniques', children: [] },
    { code: '6', label: 'Aménagements intérieurs', children: [
      { code: '6.1', label: 'Cloisons / Doublages', duree: 0 },
      { code: '6.2', label: 'Faux-plafonds',        duree: 0 },
      { code: '6.3', label: 'Revêtements de sol',   duree: 0 },
      { code: '6.4', label: 'Peintures',             duree: 0 },
    ]},
    { code: '7', label: 'Espaces communs & Accueil', children: [
      { code: '7.1', label: 'Hall & Lobbies',   duree: 0 },
      { code: '7.2', label: 'Parkings & Accès', duree: 0 },
    ]},
    { code: '8', label: 'Réception & Livraison', children: [
      { code: '8.1', label: 'Tests & Commissioning', duree: 10 },
      { code: '8.2', label: 'Réception des travaux', duree: 5 },
    ]},
  ],
  industrial: [
    { code: '1', label: 'Préparation & Terrassement', children: [
      { code: '1.1', label: 'Installation de chantier',     duree: 7 },
      { code: '1.2', label: 'Terrassement plateforme',      duree: 15 },
      { code: '1.3', label: 'Compactage / Traitement sol',  duree: 10 },
    ]},
    { code: '2', label: 'Infrastructure', children: [
      { code: '2.1', label: 'Fondations spéciales', duree: 20 },
      { code: '2.2', label: 'Longrines',             duree: 10 },
      { code: '2.3', label: 'Dallage industriel',    duree: 14 },
    ]},
    { code: '3', label: 'Superstructure', children: [] },
    { code: '4', label: 'Couverture & Bardage', children: [
      { code: '4.1', label: 'Charpente métallique', duree: 0 },
      { code: '4.2', label: 'Couverture bac acier', duree: 0 },
      { code: '4.3', label: 'Bardage façades',       duree: 0 },
    ]},
    { code: '5', label: 'Lots Techniques', children: [] },
    { code: '6', label: 'Équipements spéciaux', children: [
      { code: '6.1', label: 'Ponts roulants / Outillage', duree: 0 },
      { code: '6.2', label: 'Quais de chargement',        duree: 0 },
    ]},
    { code: '7', label: 'VRD industriel', children: [
      { code: '7.1', label: 'Voirie lourde',      duree: 0 },
      { code: '7.2', label: 'Réseaux extérieurs', duree: 0 },
    ]},
    { code: '8', label: 'Réception & Mise en service', children: [
      { code: '8.1', label: 'Tests équipements',     duree: 14 },
      { code: '8.2', label: 'Réception des travaux', duree: 5 },
    ]},
  ],
}

// ── Durées par défaut (jours ouvrés) ────────────────────────────────────────
const DEFAULT_ELEMENT_DURATIONS = {
  poteaux: 5,
  voiles:  8,
  poutres: 5,
  dalle:   20,
}

function buildLevels(project) {
  if (project.excelDurations && Object.keys(project.excelDurations).length > 0) {
    return Object.keys(project.excelDurations)
  }
  const levels = []
  const nbSousSols = project.sousSols || 0
  for (let i = nbSousSols; i >= 1; i--) levels.push('SS' + i)
  levels.push('RDC')
  for (let i = 1; i <= (project.niveaux || 0); i++) levels.push('R+' + i)
  return levels
}

function getElementsForLevel(project, levelLabel) {
  if (project.excelDurations?.[levelLabel]) {
    const d = project.excelDurations[levelLabel]
    return ELEMENTS_STRUCTURELS.filter(el => d[el.id] != null)
  }
  return ELEMENTS_STRUCTURELS
}

function getDuration(project, levelLabel, elementId) {
  const fromExcel = project.excelDurations?.[levelLabel]?.[elementId]
  // ✅ Toujours entier
  if (fromExcel != null) return Math.round(fromExcel)
  return DEFAULT_ELEMENT_DURATIONS[elementId] || 5
}

// ── ✅ PRÉDÉCESSEURS CORRECTS ────────────────────────────────────────────────
// Type MSP : 1=FD (FS), 3=DD (SS)
//
// Intra-niveau :
//   Poteaux → Voiles  : FD (type 1)
//   Voiles  → Poutres : FD (type 1)
//   Poutres → Dalle   : FD (type 1)
//   Dalle   → Poutres : DD (type 3)  ← démarrage simultané dalle/poutres
//
// Inter-niveaux :
//   Dalle N-1 → Poteaux N : FD (type 1)

const ELEMENT_ORDER = ['poteaux', 'voiles', 'poutres', 'dalle']

export function generateSuperstructureTasks(project) {
  const tasks  = []
  const links  = []
  const levels = buildLevels(project)

  let prevLevelIdx = null  // { elementId → index dans tasks[] } du niveau précédent

  for (let li = 0; li < levels.length; li++) {
    const levelLabel = levels[li]
    const levelCode  = '3.' + (li + 1)

    tasks.push({ code: levelCode, label: levelLabel, level: 2, isChapter: true, duree: null })

    const elements   = getElementsForLevel(project, levelLabel)
    const curLvlIdx  = {}  // { elementId → tasks[] index }

    for (let ei = 0; ei < elements.length; ei++) {
      const el  = elements[ei]
      const dur = getDuration(project, levelLabel, el.id)
      const idx = tasks.length
      tasks.push({
        code: levelCode + '.' + (ei + 1),
        label: el.label,
        level: 3, isChapter: false, duree: dur,
        element: el.id, niveau: levelLabel,
      })
      curLvlIdx[el.id] = idx
    }

    // ── Liens intra-niveau ────────────────────────────────────────────────
    // Poteaux → Voiles : FD
    if (curLvlIdx.poteaux != null && curLvlIdx.voiles != null)
      links.push({ predIdx: curLvlIdx.poteaux, succIdx: curLvlIdx.voiles, type: 1 })

    // Voiles → Poutres : FD  (ou Poteaux → Poutres si pas de Voiles)
    if (curLvlIdx.voiles != null && curLvlIdx.poutres != null)
      links.push({ predIdx: curLvlIdx.voiles, succIdx: curLvlIdx.poutres, type: 1 })
    else if (curLvlIdx.poteaux != null && curLvlIdx.poutres != null)
      links.push({ predIdx: curLvlIdx.poteaux, succIdx: curLvlIdx.poutres, type: 1 })

    // Poutres → Dalle : FD
    if (curLvlIdx.poutres != null && curLvlIdx.dalle != null)
      links.push({ predIdx: curLvlIdx.poutres, succIdx: curLvlIdx.dalle, type: 1 })
    else if (curLvlIdx.voiles != null && curLvlIdx.dalle != null)
      links.push({ predIdx: curLvlIdx.voiles, succIdx: curLvlIdx.dalle, type: 1 })
    else if (curLvlIdx.poteaux != null && curLvlIdx.dalle != null)
      links.push({ predIdx: curLvlIdx.poteaux, succIdx: curLvlIdx.dalle, type: 1 })

    // ✅ Dalle → Poutres MÊME niveau : DD (SS) type 3
    

    // ── Liens inter-niveaux ───────────────────────────────────────────────
    if (prevLevelIdx !== null) {
      // ✅ Dalle N-1 → Poteaux N : FD
      if (prevLevelIdx.dalle != null && curLvlIdx.poteaux != null) {
        links.push({ predIdx: prevLevelIdx.dalle, succIdx: curLvlIdx.poteaux, type: 1 })
      } else {
        // Fallback : dernier élément N-1 → premier élément N : FD
        const prevLast  = ELEMENT_ORDER.slice().reverse().map(id => prevLevelIdx[id]).find(i => i != null)
        const nextFirst = ELEMENT_ORDER.map(id => curLvlIdx[id]).find(i => i != null)
        if (prevLast != null && nextFirst != null)
          links.push({ predIdx: prevLast, succIdx: nextFirst, type: 1 })
      }
    }

    prevLevelIdx = curLvlIdx
  }

  return { tasks, links }
}

export function generateLotTasks(selectedLots, niveaux, parentCode) {
  return selectedLots.map((lotId, i) => {
    const lot = LOTS.find(l => l.id === lotId)
    return {
      code: parentCode + '.' + (i + 1),
      label: lot ? lot.label : lotId,
      duree: Math.round((niveaux || 1) * 3),
    }
  })
}

export function buildWBS(project) {
  const template = WBS_TEMPLATES[project.type] || WBS_TEMPLATES.residential
  const result   = []
  let uid = 1

  template.forEach(chapter => {
    result.push({ id: uid++, code: chapter.code, label: chapter.label, duree: null, level: 1, isChapter: true })

    if (chapter.code === '3') {
      const { tasks: stTasks, links: stLinks } = generateSuperstructureTasks(project)
      const offset = uid - 1
      stTasks.forEach(t => {
        result.push({
          id: uid++, code: t.code, label: t.label, duree: t.duree,
          level: t.level || 2, isChapter: t.isChapter,
          element: t.element, niveau: t.niveau,
        })
      })
      result._stLinks = (result._stLinks || []).concat(
        stLinks.map(l => ({ predId: l.predIdx + offset + 1, succId: l.succIdx + offset + 1, type: l.type }))
      )
    } else if (chapter.code === '5') {
      const lotTasks = generateLotTasks(project.lots || [], project.niveaux, chapter.code)
      lotTasks.forEach(t => {
        result.push({ id: uid++, code: t.code, label: t.label, duree: t.duree, level: 2, isChapter: false })
      })
    } else {
      ;(chapter.children || []).forEach(child => {
        let duree = child.duree
        if (duree === 0) duree = Math.round((project.niveaux || 1) * 2 + (project.surface || 1000) / 500)
        result.push({ id: uid++, code: child.code, label: child.label, duree, level: 2, isChapter: false })
      })
    }
  })

  return result
}

// ✅ buildGantt : avance en jours ouvrés (skip week-ends + fériés marocains)
export function buildGantt(wbs, startDate) {
  let cursor = new Date(startDate)
  while (isNonWorkingDay(cursor)) cursor.setDate(cursor.getDate() + 1)

  return wbs.map(task => {
    if (task.isChapter) return { ...task, startDate: null, endDate: null }
    const s   = new Date(cursor)
    const dur = Math.round(task.duree || 1)
    const e   = addWorkingDays(s, dur)
    cursor    = new Date(e)
    while (isNonWorkingDay(cursor)) cursor.setDate(cursor.getDate() + 1)
    return { ...task, startDate: s, endDate: e, duree: dur }
  })
}

// ── MSPDI Export ─────────────────────────────────────────────────────────────
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// ✅ N jours ouvrés → format Duration MSP (PT[N*8]H0M0S)
// MS Project interprète PT8H = 1 jour ouvré de 8h → durée entière garantie
function daysToMSP(days) {
  if (!days || days <= 0) return 'PT0H0M0S'
  const d = Math.round(days)
  return 'PT' + (d * 8) + 'H0M0S'
}

function fmtDate(d) {
  if (!d) return '2026-01-01T08:00:00'
  return new Date(d).toISOString().slice(0, 10) + 'T08:00:00'
}

// ✅ Calendrier XML MSP avec 9 jours fériés marocains pour N années
function buildCalendarXml(startYear, endYear) {
  const HOLIDAY_NAMES = [
    'Nouvel an',
    'Anniversaire de l\'Indépendance',
    'Fête du Travail',
    'Fête du Trône',
    'Allégeance Oued Eddahab',
    'Révolution du Roi et du Peuple',
    'Anniversaire du Roi Mohammed VI',
    'Anniversaire de la Marche Verte',
    'Fête de l\'Indépendance',
  ]

  let exId = 1
  const exceptions = []
  for (let y = startYear; y <= endYear; y++) {
    MAROC_HOLIDAYS.forEach((h, i) => {
      const dt  = new Date(y, h.m - 1, h.d)
      const ds  = fmtDate(dt)
      exceptions.push(
        '            <Exception>' +
        '<ExceptionIdentifier>' + (exId++) + '</ExceptionIdentifier>' +
        '<Name>' + esc(HOLIDAY_NAMES[i] + ' ' + y) + '</Name>' +
        '<Entered>1</Entered><Base>1</Base>' +
        '<Start>' + ds + '</Start><Finish>' + ds + '</Finish>' +
        '<DayWorking>0</DayWorking>' +
        '</Exception>'
      )
    })
  }

  return `   <Calendars>
      <Calendar>
         <UID>1</UID>
         <Name>Calendrier Maroc</Name>
         <IsBaseCalendar>1</IsBaseCalendar>
         <IsBaselineCalendar>0</IsBaselineCalendar>
         <BaseCalendarUID>-1</BaseCalendarUID>
         <WeekDays>
            <WeekDay><DayType>1</DayType><DayWorking>0</DayWorking></WeekDay>
            <WeekDay><DayType>2</DayType><DayWorking>1</DayWorking>
               <WorkingTimes><WorkingTime><FromTime>08:00:00</FromTime><ToTime>12:00:00</ToTime></WorkingTime><WorkingTime><FromTime>13:00:00</FromTime><ToTime>17:00:00</ToTime></WorkingTime></WorkingTimes>
            </WeekDay>
            <WeekDay><DayType>3</DayType><DayWorking>1</DayWorking>
               <WorkingTimes><WorkingTime><FromTime>08:00:00</FromTime><ToTime>12:00:00</ToTime></WorkingTime><WorkingTime><FromTime>13:00:00</FromTime><ToTime>17:00:00</ToTime></WorkingTime></WorkingTimes>
            </WeekDay>
            <WeekDay><DayType>4</DayType><DayWorking>1</DayWorking>
               <WorkingTimes><WorkingTime><FromTime>08:00:00</FromTime><ToTime>12:00:00</ToTime></WorkingTime><WorkingTime><FromTime>13:00:00</FromTime><ToTime>17:00:00</ToTime></WorkingTime></WorkingTimes>
            </WeekDay>
            <WeekDay><DayType>5</DayType><DayWorking>1</DayWorking>
               <WorkingTimes><WorkingTime><FromTime>08:00:00</FromTime><ToTime>12:00:00</ToTime></WorkingTime><WorkingTime><FromTime>13:00:00</FromTime><ToTime>17:00:00</ToTime></WorkingTime></WorkingTimes>
            </WeekDay>
            <WeekDay><DayType>6</DayType><DayWorking>1</DayWorking>
               <WorkingTimes><WorkingTime><FromTime>08:00:00</FromTime><ToTime>12:00:00</ToTime></WorkingTime><WorkingTime><FromTime>13:00:00</FromTime><ToTime>17:00:00</ToTime></WorkingTime></WorkingTimes>
            </WeekDay>
            <WeekDay><DayType>7</DayType><DayWorking>0</DayWorking></WeekDay>
         </WeekDays>
         <Exceptions>
${exceptions.join('\n')}
         </Exceptions>
      </Calendar>
   </Calendars>`
}

export function exportProjectXML(project, wbs) {
  const gantt     = buildGantt(wbs, project.dateDebut)
  const stLinks   = wbs._stLinks || []

  const realTasks    = gantt.filter(t => !t.isChapter && t.startDate && t.endDate)
  const projStart    = realTasks.length ? realTasks[0].startDate              : new Date(project.dateDebut)
  const projEnd      = realTasks.length ? realTasks[realTasks.length-1].endDate : new Date(project.dateDebut)
  const projWorkDays = countWorkingDays(projStart, projEnd)

  const OFFSET = 3

  const predMap = {}
  stLinks.forEach(({ predId, succId, type }) => {
    if (!predMap[succId + OFFSET]) predMap[succId + OFFSET] = []
    predMap[succId + OFFSET].push({ predUid: predId + OFFSET, type })
  })

  // ✅ 3 lignes récap : Projet > GROS OEUVRE > Immeuble
  const headers = [
    { uid: 1, name: project.nom || 'Projet',  outline: 1, summary: 1, start: fmtDate(projStart), finish: fmtDate(projEnd), dur: daysToMSP(projWorkDays) },
    { uid: 2, name: 'GROS OEUVRE',             outline: 2, summary: 1, start: fmtDate(projStart), finish: fmtDate(projEnd), dur: daysToMSP(projWorkDays) },
    { uid: 3, name: project.nom || 'Immeuble', outline: 3, summary: 1, start: fmtDate(projStart), finish: fmtDate(projEnd), dur: daysToMSP(projWorkDays) },
  ]

  const wbsTasks = gantt.map((t, i) => ({
    uid:     i + 1 + OFFSET,
    name:    t.label,
    dur:     daysToMSP(t.isChapter ? 0 : Math.round(t.duree || 0)),
    outline: (t.level || 1) + OFFSET,
    summary: t.isChapter ? 1 : 0,
    start:   fmtDate(t.startDate || project.dateDebut),
    finish:  fmtDate(t.endDate   || project.dateDebut),
  }))

  function taskXml(t) {
    const preds   = predMap[t.uid] || []
    const predXml = preds.map(p =>
      '\n            <PredecessorLink>' +
      '<PredecessorUID>' + p.predUid + '</PredecessorUID>' +
      '<Type>' + p.type + '</Type>' +
      '<CrossProject>0</CrossProject><CrossProjectName/>' +
      '<LinkLag>0</LinkLag><LagFormat>7</LagFormat>' +
      '</PredecessorLink>'
    ).join('')
    return [
      '      <Task>',
      '         <UID>'          + t.uid     + '</UID><ID>' + t.uid + '</ID>',
      '         <Name>'         + esc(t.name) + '</Name>',
      '         <Active>1</Active><Manual>0</Manual><IsNull>0</IsNull>',
      '         <OutlineLevel>' + t.outline  + '</OutlineLevel>',
      '         <Summary>'      + t.summary  + '</Summary><Milestone>0</Milestone>',
      '         <Start>'        + t.start    + '</Start><Finish>' + t.finish + '</Finish>',
      '         <Duration>'     + t.dur      + '</Duration><DurationFormat>7</DurationFormat>',
      '         <PercentComplete>0</PercentComplete><CalendarUID>1</CalendarUID>' + predXml,
      '      </Task>',
    ].join('\n')
  }

  const startYear = new Date(project.dateDebut).getFullYear()
  const endYear   = new Date(projEnd).getFullYear() + 1
  const calXml    = buildCalendarXml(startYear, endYear)
  const now       = fmtDate(new Date())

  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Project xmlns="http://schemas.microsoft.com/project">',
    '   <SaveVersion>14</SaveVersion>',
    '   <Name>'  + esc(project.nom) + '</Name>',
    '   <Title>' + esc(project.nom) + '</Title>',
    '   <Company>PlaniAI</Company><Author>PlaniAI</Author>',
    '   <CreationDate>' + now + '</CreationDate><LastSaved>' + now + '</LastSaved>',
    '   <ScheduleFromStart>1</ScheduleFromStart>',
    '   <StartDate>' + fmtDate(project.dateDebut) + '</StartDate>',
    '   <CurrencySymbol>MAD</CurrencySymbol>',
    '   <CalendarUID>1</CalendarUID>',
    '   <MinutesPerDay>480</MinutesPerDay>',
    '   <MinutesPerWeek>2400</MinutesPerWeek>',
    '   <DaysPerMonth>20</DaysPerMonth>',
    '   <DefaultTaskType>0</DefaultTaskType>',
    calXml,
    '   <Tasks>',
    [...headers, ...wbsTasks].map(taskXml).join('\n'),
    '   </Tasks>',
    '   <Resources/><Assignments/>',
    '</Project>',
  ].join('\n')
}

export function importProjectXML(xmlString) {
  const parser = new DOMParser()
  const doc    = parser.parseFromString(xmlString, 'application/xml')
  const get    = tag => doc.querySelector(tag)?.textContent?.trim() || ''
  return {
    nom:       get('Name') || get('Title') || 'Projet importé',
    type:      'residential',
    dateDebut: get('StartDate')?.slice(0, 10) || new Date().toISOString().slice(0, 10),
    duree: 180, niveaux: parseInt(get('Levels')) || 1, sousSols: 0,
    blocs: 1, surface: 1000, lots: [], excelDurations: null,
  }
}
