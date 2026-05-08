// ─────────────────────────────────────────────────────────────────────────────
// mlEngine.js — PlaniAI ML Module
// Simule le modèle XGBoost entraîné sur 488 tâches TCE (DATA_STRUCTURE.xlsx)
// Appelle l'API Claude pour prédire les retards avec raisonnement contextuel BTP
// ─────────────────────────────────────────────────────────────────────────────

// Statistiques TCE extraites de DATA_STRUCTURE.xlsx (488 tâches réelles)
export const TCE_STATS = {
  pluie:            0.22,   // 22% des tâches affectées
  vent_fort:        0.13,
  panne_grue:       0.10,
  panne_betonniere: 0.08,
  retard_beton:     0.18,
  retard_acier:     0.15,
  retard_coffrages: 0.16,
  manque_ouvriers:  0.20,
  erreur_plans:     0.09,
  retard_tache_avant: 0.31,
  moy_ouvriers:     12.4,
  moy_surface:      85.3,
  moy_volume_beton: 18.7,
}

// Niveaux de risque
export function getRiskLevel(retardJours) {
  if (retardJours >= 3) return { niveau: 'Élevé',  couleur: '#ef4444', bg: '#450a0a', badge: '🔴' }
  if (retardJours >= 1.5) return { niveau: 'Moyen', couleur: '#f59e0b', bg: '#451a03', badge: '🟡' }
  return { niveau: 'Faible', couleur: '#22c55e', bg: '#052e16', badge: '🟢' }
}

// Construire le prompt système pour Claude (expert BTP / XGBoost simulé)
function buildSystemPrompt() {
  return `Tu es un modèle XGBoost entraîné sur 488 tâches de chantiers BTP marocains (projet TCE Gardenia Zenata).
Tes paramètres optimaux : n_estimators=300, max_depth=6, learning_rate=0.1, subsample=0.9.

RÈGLES STRICTES :
1. Tu réponds UNIQUEMENT en JSON valide, sans texte, sans markdown, sans backticks.
2. Format exact : {"predictions": [{"id": "...", "retard_jours": 2.3, "facteurs": ["pluie", "manque_ouvriers"]}]}
3. retard_jours est un nombre décimal entre 0 et 15.
4. facteurs contient 1 à 3 string parmi : pluie, vent_fort, panne_grue, panne_betonniere, retard_beton, retard_acier, retard_coffrages, manque_ouvriers, erreur_plans, retard_tache_avant, complexite_technique, surface_importante.
5. Applique les statistiques TCE : tâches de structure (poteaux/voiles/dalles) ont des retards plus élevés que finitions.
6. Les tâches longues (>20j) ont plus de risque d'accumulation de retards.
7. Les tâches en début de projet ont plus de retard (installation, coordination).`
}

// Préparer le prompt utilisateur avec les tâches
function buildUserPrompt(tasks, conditions) {
  const cond = {
    saison: conditions?.saison || 'normal',
    equipement: conditions?.equipement || 'bon',
    equipe: conditions?.equipe || 'normale',
  }

  const tasksDesc = tasks.map(t => ({
    id: t.id,
    nom: t.label,
    duree_jours: t.duree || 5,
    type: t.element || 'autre',
    code: t.code || '0',
    niveau: t.niveau || null,
  }))

  return `Conditions du chantier :
- Saison : ${cond.saison} (${cond.saison === 'hivernale' ? 'risque pluie élevé' : cond.saison === 'estivale' ? 'chaleur, risque vent' : 'conditions normales'})
- État équipement : ${cond.equipement}
- Taille équipe : ${cond.equipe}

Statistiques TCE de référence (moyenne historique) :
- Pluie: ${(TCE_STATS.pluie * 100).toFixed(0)}% | Manque ouvriers: ${(TCE_STATS.manque_ouvriers * 100).toFixed(0)}% | Retard tâche précédente: ${(TCE_STATS.retard_tache_avant * 100).toFixed(0)}%

Prédit le retard pour ces ${tasks.length} tâches BTP :
${JSON.stringify(tasksDesc, null, 2)}`
}

// Appel API Claude avec retry
async function callClaudeAPI(systemPrompt, userPrompt) {
  const response = await fetch('/api/anthropic/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY || '',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  })

  if (!response.ok) throw new Error(`API error: ${response.status}`)
  const data = await response.json()
  const text = data.content?.[0]?.text || ''

  // Parser le JSON
  const clean = text.replace(/```json|```/g, '').trim()
  return JSON.parse(clean)
}

// Fallback déterministe si l'API échoue (règles basées sur les stats TCE)
function fallbackPrediction(task) {
  const duree = task.duree || 5
  let baseRetard = 0

  // Facteurs structurels
  if (task.element === 'dalle') baseRetard += 2.5
  else if (task.element === 'voiles') baseRetard += 2.0
  else if (task.element === 'poteaux') baseRetard += 1.5
  else if (task.element === 'poutres') baseRetard += 1.8
  else baseRetard += 0.8

  // Durée longue = plus de risque
  if (duree > 20) baseRetard += 1.5
  else if (duree > 10) baseRetard += 0.8

  // Variabilité pseudo-aléatoire basée sur le code de tâche
  const hash = task.code ? task.code.split('.').reduce((a, c) => a + parseInt(c) || a, 0) : 0
  const variation = (hash % 10) * 0.15

  const retard = Math.max(0, baseRetard + variation - 1.2)
  const facteurs = []
  if (task.element === 'dalle' || task.element === 'voiles') facteurs.push('complexite_technique')
  if (duree > 15) facteurs.push('retard_tache_avant')
  facteurs.push('pluie')

  return { retard_jours: parseFloat(retard.toFixed(1)), facteurs }
}

// ── Fonction principale d'analyse ML ─────────────────────────────────────────
export async function predictDelays(tasks, conditions = {}, onProgress = null) {
  const BATCH_SIZE = 15
  const results = {}

  // Découper en batches
  const batches = []
  for (let i = 0; i < tasks.length; i += BATCH_SIZE) {
    batches.push(tasks.slice(i, i + BATCH_SIZE))
  }

  for (let b = 0; b < batches.length; b++) {
    const batch = batches[b]
    if (onProgress) onProgress(Math.round((b / batches.length) * 90))

    try {
      const systemPrompt = buildSystemPrompt()
      const userPrompt = buildUserPrompt(batch, conditions)
      const response = await callClaudeAPI(systemPrompt, userPrompt)

      for (const pred of response.predictions || []) {
        results[pred.id] = {
          retard_jours: Math.max(0, parseFloat(pred.retard_jours) || 0),
          facteurs: pred.facteurs || [],
          source: 'xgboost_api',
        }
      }
    } catch (err) {
      console.warn('ML API fallback pour batch', b, err.message)
      for (const task of batch) {
        if (!results[task.id]) {
          const pred = fallbackPrediction(task)
          results[task.id] = { ...pred, source: 'fallback' }
        }
      }
    }
  }

  if (onProgress) onProgress(100)
  return results
}

// Calculer les statistiques globales des prédictions
export function computeMLStats(tasks, predictions) {
  const preds = tasks.map(t => ({
    ...t,
    retard: predictions[t.id]?.retard_jours || 0,
    facteurs: predictions[t.id]?.facteurs || [],
    risk: getRiskLevel(predictions[t.id]?.retard_jours || 0),
  }))

  const totalRetard = preds.reduce((s, t) => s + t.retard, 0)
  const eleve  = preds.filter(t => t.risk.niveau === 'Élevé').length
  const moyen  = preds.filter(t => t.risk.niveau === 'Moyen').length
  const faible = preds.filter(t => t.risk.niveau === 'Faible').length

  // Facteurs les plus fréquents
  const facteurCount = {}
  for (const t of preds) {
    for (const f of t.facteurs) {
      facteurCount[f] = (facteurCount[f] || 0) + 1
    }
  }
  const topFacteurs = Object.entries(facteurCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([f, n]) => ({ facteur: f, count: n }))

  return { preds, totalRetard, eleve, moyen, faible, topFacteurs }
}

export const FACTEUR_LABELS = {
  pluie: 'Pluie',
  vent_fort: 'Vent fort',
  panne_grue: 'Panne grue',
  panne_betonniere: 'Panne bétonnière',
  retard_beton: 'Retard béton',
  retard_acier: 'Retard acier',
  retard_coffrages: 'Retard coffrages',
  manque_ouvriers: 'Manque ouvriers',
  erreur_plans: 'Erreur plans',
  retard_tache_avant: 'Retard tâche précédente',
  complexite_technique: 'Complexité technique',
  surface_importante: 'Grande surface',
}
