/**
 * CCTP Analyzer — utilise Groq API (gratuit) au lieu d'Anthropic
 * Modèle : llama-3.3-70b-versatile — excellent en français technique
 * Proxy Vite : /groq → api.groq.com  (évite CORS)
 */

const GROQ_MODEL = 'llama-3.3-70b-versatile'
const API_KEY = import.meta.env.VITE_GROQ_API_KEY || ''

export const REQUIRED_FIELDS = [
  { key: 'project_name',            label: 'Nom du projet',             critical: true  },
  { key: 'building_type',           label: 'Type de bâtiment',          critical: true  },
  { key: 'number_of_levels',        label: 'Nombre de niveaux (R+X)',   critical: true  },
  { key: 'number_of_blocks',        label: 'Nombre de blocs/immeubles', critical: false },
  { key: 'floor_area_m2',           label: 'Surface plancher (m²)',     critical: false },
  { key: 'estimated_duration_days', label: 'Durée estimée (jours)',     critical: false },
]

const SYSTEM_PROMPT = `Tu es un ingénieur senior en génie civil spécialisé dans l'analyse de CCTP français.
Tu lis des documents techniques de construction, parfois mal formatés ou extraits par OCR.

RÈGLES D'EXTRACTION STRICTES :

① NOM DU PROJET : intitulé du marché, nom de l'opération, nom de la résidence/programme. Si absent → null

② TYPE DE BÂTIMENT :
   - "résidentiel" : logements, appartements, résidence, immeuble d'habitation
   - "tertiaire" : bureaux, hôtel, commerce, école, hôpital
   - "industriel" : usine, entrepôt, atelier, hangar
   - Si absent → null

③ NOMBRE DE NIVEAUX :
   - R+X = X niveaux (R+5 = 5, R+7 = 7)
   - "rez-de-chaussée + X étages" = X
   - Ne pas compter les sous-sols dans ce chiffre
   - Si absent → null

④ NOMBRE DE BLOCS :
   - bloc / bâtiment / immeuble / tour / tranche
   - "Bâtiment A, B et C" = 3
   - Si un seul bâtiment → 1
   - Si absent → null

⑤ SURFACE PLANCHER :
   - SHON, SDP, SDO, surface utile, surface habitable en m²
   - Ex : "SDP = 4 500 m²" → 4500
   - Si absent → null

⑥ DURÉE ESTIMÉE :
   - délai d'exécution, durée des travaux
   - 1 mois = 22 jours, 1 semaine = 5 jours
   - Si absent → null

⑦ LOTS TECHNIQUES — détecter la présence de chaque lot :
   - gros_oeuvre : béton armé, coffrage, ferraillage, structure, fondations
   - maconnerie : maçonnerie, parpaing, brique, cloisons, enduit
   - plomberie_sanitaire : plomberie, sanitaire, eau, évacuation, VMC
   - electricite_cfa_cfo : électricité, courant fort, courant faible, CFA, CFO
   - cvc_climatisation : CVC, climatisation, chauffage, ventilation
   - ascenseurs : ascenseur, élévateur, monte-charge
   - facades_etancheite : façade, étanchéité, bardage, isolation
   - finitions_interieures : peinture, carrelage, revêtement, faux-plafond
   - vrd_amenagements_ext : VRD, voirie, réseaux extérieurs, espaces verts

Retourne UNIQUEMENT ce JSON valide, sans texte avant ou après, sans balises markdown :
{
  "project_name": null,
  "building_type": null,
  "number_of_levels": null,
  "number_of_basements": 0,
  "number_of_blocks": null,
  "floor_area_m2": null,
  "estimated_duration_days": null,
  "lots": {
    "gros_oeuvre": false,
    "maconnerie": false,
    "plomberie_sanitaire": false,
    "electricite_cfa_cfo": false,
    "cvc_climatisation": false,
    "ascenseurs": false,
    "facades_etancheite": false,
    "finitions_interieures": false,
    "vrd_amenagements_ext": false
  },
  "confidence": "low",
  "missing_fields": [],
  "extraction_notes": ""
}`

// ── Détection données manquantes ─────────────────────────────────────────────
export function detectMissingFields(data) {
  const missing = []
  const warnings = []

  REQUIRED_FIELDS.forEach(({ key, label, critical }) => {
    const value = data[key]
    if (value === null || value === undefined || value === '') {
      missing.push({ key, label, critical,
        message: critical
          ? `⛔ CRITIQUE — "${label}" introuvable dans le CCTP`
          : `⚠️ "${label}" non détecté — à saisir manuellement`,
      })
    }
  })

  if (data.number_of_levels && data.floor_area_m2) {
    const spn = data.floor_area_m2 / (data.number_of_levels + 1)
    if (spn < 50)   warnings.push(`⚠️ Surface/niveau très faible (${Math.round(spn)} m²) — vérifiez`)
    if (spn > 5000) warnings.push(`⚠️ Surface/niveau très élevée (${Math.round(spn)} m²) — vérifiez`)
  }

  return { missing, warnings }
}

// ── Extraction PDF via pdf.js ─────────────────────────────────────────────────
export async function extractTextFromPDF(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target.result
        if (!window.pdfjsLib) {
          await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js')
          window.pdfjsLib.GlobalWorkerOptions.workerSrc =
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
        }
        const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise
        let fullText = ''
        for (let i = 1; i <= Math.min(pdf.numPages, 40); i++) {
          const page = await pdf.getPage(i)
          const content = await page.getTextContent()
          fullText += `\n--- Page ${i} ---\n` + content.items.map(x => x.str).join(' ')
        }
        resolve(fullText.trim())
      } catch (err) {
        reject(new Error(`Erreur lecture PDF : ${err.message}`))
      }
    }
    reader.onerror = () => reject(new Error('Impossible de lire le fichier'))
    reader.readAsArrayBuffer(file)
  })
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return }
    const s = document.createElement('script')
    s.src = src; s.onload = resolve
    s.onerror = () => reject(new Error(`Impossible de charger ${src}`))
    document.head.appendChild(s)
  })
}

// ── Appel Groq via proxy Vite ─────────────────────────────────────────────────
export async function analyzeCCTPText(text) {
  if (!API_KEY) {
    throw new Error(
      'Clé Groq manquante. Ajoutez VITE_GROQ_API_KEY=gsk_... dans votre fichier .env\n' +
      'Créez une clé gratuite sur console.groq.com'
    )
  }

  const truncated = text.slice(0, 14000)

  const response = await fetch('/groq/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      max_tokens: 1200,
      temperature: 0.1,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: `Analyse ce CCTP et extrait toutes les données.\nSi une donnée est absente, mets null et ajoute son nom dans missing_fields.\n\n${truncated}` },
      ],
    }),
  })

  if (!response.ok) {
    let errMsg = `Erreur Groq API ${response.status}`
    try {
      const err = await response.json()
      errMsg = err?.error?.message || errMsg
    } catch {}
    throw new Error(errMsg)
  }

  const data = await response.json()
  const raw = data.choices?.[0]?.message?.content || ''
  const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

  try {
    return JSON.parse(clean)
  } catch {
    const match = clean.match(/\{[\s\S]*\}/)
    if (match) { try { return JSON.parse(match[0]) } catch {} }
    throw new Error("Réponse IA invalide — réessayez")
  }
}

// ── Mapping JSON → champs PlaniAI ─────────────────────────────────────────────
export function mapCCTPToProject(data) {
  const LOTS_MAP = {
    gros_oeuvre:           'gros_oeuvre',
    maconnerie:            'maconnerie',
    plomberie_sanitaire:   'plomberie',
    electricite_cfa_cfo:   'electricite',
    cvc_climatisation:     'cvc',
    ascenseurs:            'ascenseur',
    facades_etancheite:    'facade',
    finitions_interieures: 'finitions',
    vrd_amenagements_ext:  'vrd',
  }
  const TYPE_MAP = {
    'résidentiel': 'residential',
    'tertiaire':   'tertiary',
    'industriel':  'industrial',
  }

  const selectedLots = Object.entries(data.lots || {})
    .filter(([, v]) => v === true)
    .map(([k]) => LOTS_MAP[k])
    .filter(Boolean)

  const { missing, warnings } = detectMissingFields(data)

  return {
    nom:     data.project_name || '',
    type:    TYPE_MAP[data.building_type] || null,
    niveaux: data.number_of_levels        ?? null,
    blocs:   data.number_of_blocks        ?? null,
    surface: data.floor_area_m2           ?? null,
    duree:   data.estimated_duration_days ?? null,
    lots:    selectedLots,
    _confidence:    data.confidence     || 'low',
    _notes:         data.extraction_notes || '',
    _missing:       missing,
    _warnings:      warnings,
    _missingFromAI: data.missing_fields || [],
    _basements:     data.number_of_basements ?? 0,
  }
}

// ── Pipeline complet ──────────────────────────────────────────────────────────
export async function analyzeCCTP(file) {
  const text = await extractTextFromPDF(file)
  if (!text || text.length < 100) {
    throw new Error('PDF insuffisant — fichier scanné sans OCR ? Utilisez un PDF textuel.')
  }
  const data = await analyzeCCTPText(text)
  return mapCCTPToProject(data)
}
