// Anbefalingsmaskinen: modenhetsrangering, fritekstfilter og mat–vin-matching.
// All matching er regelbasert og kjører i nettleseren — ingen eksterne kall.

export type DrinkChoice = 'red' | 'white' | 'bubbles'
export type PriceChoice = 'dyr' | 'billig'

// Kompakt vinobjekt beregnet på klienten (aggregert server-side fra wines + external_notes)
export interface RecoWine {
  id: number
  name: string
  producer: string | null
  vintage: number | null
  size: string | null
  color: string | null
  category: string | null
  varietal: string | null
  country: string | null
  region: string | null
  appellation: string | null
  quantity: number
  purchase_price: number | null
  estimated_value: number | null
  begin_consume: number | null
  end_consume: number | null
  score: number | null          // beste tilgjengelige: personlig ?? community ?? snitt av innhentede
  food_pairings: string[]       // food_pairing-tekster fra innhentede notater
}

export const CURRENT_YEAR = new Date().getFullYear()

/* ---------- Steg 1–2: hovedfiltre ---------- */

export function matchesDrinkChoice(w: RecoWine, choice: DrinkChoice): boolean {
  const sparkling = (w.category ?? '').toLowerCase().includes('sparkling')
  if (choice === 'bubbles') return sparkling
  if (sparkling) return false
  const color = (w.color ?? '').toLowerCase()
  if (choice === 'red') return color === 'red'
  // Hvitt: hvit + de få oransje/rosé-vinene hører naturlig hjemme her
  return color === 'white' || color === 'orange' || color === 'rosé'
}

// Flaskens verdi (CT-estimatet) styrer dyr/billig-skillet — innkjøpsprisen
// kan være 0 for gaver og speiler uansett ikke hva flasken er verdt i dag.
export function bottleValue(w: RecoWine): number {
  if (w.estimated_value && w.estimated_value > 0) return w.estimated_value
  return w.purchase_price ?? 0
}

export function matchesPriceChoice(w: RecoWine, choice: PriceChoice): boolean {
  const v = bottleValue(w)
  return choice === 'dyr' ? v >= 1000 : v < 1000
}

/* ---------- Drikkeklarhet ---------- */

// Lavere tall = mer drikkeklar. Innenfor vinduet rangeres de som nærmer seg
// slutten først (mest presserende å drikke).
export function readinessRank(w: RecoWine): number {
  const from = w.begin_consume
  const to = w.end_consume
  if (!from || !to) return 25 // ukjent vindu havner bak «klar», foran «vent lenge»
  if (CURRENT_YEAR >= from && CURRENT_YEAR <= to) {
    return Math.min(to - CURRENT_YEAR, 19) // 0–19: i vinduet, kort tid igjen først
  }
  if (CURRENT_YEAR < from) {
    return 25 + Math.min(from - CURRENT_YEAR, 30) // 26–55: åpner om N år
  }
  return 60 + Math.min(CURRENT_YEAR - to, 30) // 60+: passert vindu
}

export function readinessLabel(w: RecoWine): { label: string; color: string } {
  const from = w.begin_consume
  const to = w.end_consume
  if (!from || !to) return { label: 'Ukjent vindu', color: 'var(--text-muted)' }
  if (CURRENT_YEAR > to) return { label: 'Passert vindu', color: 'var(--status-past)' }
  if (CURRENT_YEAR < from) return { label: `Åpner ${from}`, color: 'var(--status-hold)' }
  if (to - CURRENT_YEAR <= 2) return { label: 'Drikk snart', color: 'var(--status-soon)' }
  return { label: 'Drikkeklar', color: 'var(--status-now)' }
}

/* ---------- Fritekstfilter («pinot», «beaujolais», «tyskland» …) ---------- */

const NO_ALIASES: Record<string, string[]> = {
  tyskland: ['germany'], frankrike: ['france'], italia: ['italy'], spania: ['spain'],
  portugal: ['portugal'], østerrike: ['austria'], hellas: ['greece'], usa: ['usa', 'united states'],
  'sør-afrika': ['south africa'], sørafrika: ['south africa'], australia: ['australia'],
  burgund: ['burgundy', 'bourgogne'], champagne: ['champagne'], rhône: ['rhône', 'rhone'],
  alsace: ['alsace'], jura: ['jura'], loire: ['loire'], mosel: ['mosel'], pfalz: ['pfalz'],
  piemonte: ['piedmont', 'piemonte'], toscana: ['tuscany'],
}

export function textFilter(wines: RecoWine[], query: string): RecoWine[] {
  const q = query.trim().toLowerCase()
  if (!q) return wines
  const terms = q.split(/\s+/).flatMap(t => [t, ...(NO_ALIASES[t] ?? [])])
  return wines.filter(w => {
    const hay = [w.name, w.producer, w.varietal, w.country, w.region, w.appellation]
      .filter(Boolean).join(' ').toLowerCase()
    // Alle ordene i søket må treffe (via alias-gruppene sine)
    const groups: string[][] = q.split(/\s+/).map(t => [t, ...(NO_ALIASES[t] ?? [])])
    return groups.every(g => g.some(term => hay.includes(term)))
  })
}

/* ---------- Mat–vin-matching ---------- */

// Vinstiler vi gjenkjenner fra drue/region/navn
type Style =
  | 'crisp-white' | 'rich-white' | 'aromatic-white' | 'off-dry-riesling' | 'oxidative-white'
  | 'light-red' | 'medium-red' | 'structured-red' | 'sparkling' | 'sweet-fortified'

export function wineStyles(w: RecoWine): Style[] {
  const hay = [w.name, w.varietal, w.region, w.appellation, w.producer]
    .filter(Boolean).join(' ').toLowerCase()
  const has = (...terms: string[]) => terms.some(t => hay.includes(t))
  const styles: Style[] = []

  if ((w.category ?? '').toLowerCase().includes('sparkling')) styles.push('sparkling')
  if ((w.category ?? '').toLowerCase().match(/sweet|fortified/) || has('sauternes', 'tawny', 'port', 'vin de paille', 'massandra')) {
    styles.push('sweet-fortified')
  }

  const color = (w.color ?? '').toLowerCase()
  if (color === 'white' || color === 'orange') {
    if (has('kabinett', 'spätlese', 'feinherb', 'auslese')) styles.push('off-dry-riesling')
    if (has('riesling', 'chablis', 'sancerre', 'sauvignon', 'assyrtiko', 'muscadet', 'aligoté', 'albariño', 'grüner')) styles.push('crisp-white')
    if (has('chardonnay', 'meursault', 'puligny', 'chassagne', 'montrachet', 'pouilly', 'mâcon', 'saint-aubin', 'corton-charlemagne', 'chenin', 'savennières', 'anjou', 'gravières', 'coche')) styles.push('rich-white')
    if (has('gewurz', 'gewürz', 'pinot gris', 'viognier', 'muscat', 'brand')) styles.push('aromatic-white')
    if (has('jura', 'arbois', 'savagnin', 'château-chalon', 'tondonia', 'blanco reserva')) styles.push('oxidative-white')
    if (styles.length === 0) styles.push('crisp-white')
  }

  if (color === 'red') {
    if (has('gamay', 'beaujolais', 'fleurie', 'morgon', 'brouilly', 'moulin-à-vent', 'poulsard', 'trousseau', 'frappato')) styles.push('light-red')
    if (has('pinot noir', 'bourgogne', 'gevrey', 'chambolle', 'vosne', 'nuits', 'volnay', 'pommard', 'beaune', 'morey', 'marsannay', 'santenay', 'monthélie', 'sancerre rouge', 'spätburgunder')) styles.push('medium-red')
    if (has('nebbiolo', 'barolo', 'barbaresco', 'cabernet', 'merlot', 'bordeaux', 'pauillac', 'pomerol', 'saint-julien', 'margaux', 'syrah', 'côte-rôtie', 'hermitage', 'rioja', 'tempranillo', 'bosconia', 'brunello', 'sangiovese', 'aglianico', 'mourvèdre', 'châteauneuf')) styles.push('structured-red')
    if (styles.length === 0) styles.push('medium-red')
  }

  return styles.length ? styles : ['medium-red']
}

// Matkategorier med norske nøkkelord
const FOOD_CATEGORIES: { key: string; words: string[]; scores: Partial<Record<Style, number>> }[] = [
  {
    key: 'skalldyr',
    words: ['østers', 'kamskjell', 'reker', 'krabbe', 'hummer', 'skalldyr', 'blåskjell', 'skjell', 'sjøkreps', 'ceviche'],
    scores: { 'crisp-white': 3, sparkling: 3, 'rich-white': 2, 'aromatic-white': 1 },
  },
  {
    key: 'fisk',
    words: ['fisk', 'torsk', 'skrei', 'sei', 'kveite', 'ørret', 'laks', 'røkelaks', 'sushi', 'sashimi', 'fiskesuppe', 'bacalao', 'lutefisk', 'sild', 'makrell', 'breiflabb', 'piggvar', 'sjøtunge'],
    scores: { 'crisp-white': 3, 'rich-white': 2, sparkling: 2, 'off-dry-riesling': 2, 'light-red': 1 },
  },
  {
    key: 'kylling',
    words: ['kylling', 'høne', 'kalkun', 'fugl'],
    scores: { 'rich-white': 3, 'medium-red': 2, 'light-red': 2, 'crisp-white': 2, sparkling: 1 },
  },
  {
    key: 'svin',
    words: ['svin', 'gris', 'koteletter', 'pølse', 'spekemat', 'skinke', 'charcuteri', 'porchetta'],
    scores: { 'light-red': 3, 'medium-red': 2, 'rich-white': 2, 'off-dry-riesling': 2 },
  },
  {
    key: 'julemat',
    words: ['ribbe', 'pinnekjøtt', 'julemat', 'medisterkaker', 'julaften', 'smalahove'],
    scores: { 'off-dry-riesling': 3, 'aromatic-white': 2, 'light-red': 2, sparkling: 2, 'crisp-white': 1 },
  },
  {
    key: 'lam',
    words: ['lam', 'lammelår', 'fårikål', 'får', 'lammeskank', 'lammecarre'],
    scores: { 'structured-red': 3, 'medium-red': 2, 'off-dry-riesling': 1 },
  },
  {
    key: 'storfe',
    words: ['biff', 'okse', 'entrecôte', 'entrecote', 'indrefilet', 'ytrefilet', 'oksehale', 'burger', 'ribeye', 'flankstek', 'kalv', 'ossobuco', 'brasato', 'gryte', 'boeuf'],
    scores: { 'structured-red': 3, 'medium-red': 2 },
  },
  {
    key: 'vilt',
    words: ['vilt', 'hjort', 'elg', 'rein', 'reinsdyr', 'rådyr', 'and', 'duemiddag', 'due', 'rype', 'gås', 'hare', 'villsvin'],
    scores: { 'medium-red': 3, 'structured-red': 2, 'light-red': 1 },
  },
  {
    key: 'pasta-tomat',
    words: ['pizza', 'pasta', 'tomat', 'lasagne', 'bolognese', 'spaghetti', 'ragu', 'plin', 'gnocchi'],
    scores: { 'structured-red': 2, 'medium-red': 2, 'light-red': 2 },
  },
  {
    key: 'sopp-trøffel',
    words: ['sopp', 'trøffel', 'risotto', 'kantarell', 'steinsopp'],
    scores: { 'medium-red': 3, 'rich-white': 2, 'oxidative-white': 2, 'structured-red': 2 },
  },
  {
    key: 'asiatisk',
    words: ['thai', 'asiatisk', 'indisk', 'curry', 'karri', 'krydret', 'sterk', 'chili', 'wok', 'vietnamesisk', 'koreansk', 'ramen', 'dumplings', 'dim sum'],
    scores: { 'off-dry-riesling': 3, 'aromatic-white': 3, 'crisp-white': 2, sparkling: 2, 'light-red': 1 },
  },
  {
    key: 'ost',
    words: ['ost', 'comté', 'brie', 'chevre', 'parmesan', 'manchego', 'gruyère', 'cheddar', 'ostebord'],
    scores: { 'oxidative-white': 3, 'rich-white': 2, sparkling: 2, 'structured-red': 2, 'sweet-fortified': 2 },
  },
  {
    key: 'blåmuggost',
    words: ['blåmuggost', 'roquefort', 'gorgonzola', 'stilton', 'blue'],
    scores: { 'sweet-fortified': 3, 'off-dry-riesling': 2, 'oxidative-white': 1 },
  },
  {
    key: 'dessert',
    words: ['dessert', 'sjokolade', 'kake', 'is', 'crème brûlée', 'fruktsalat', 'pai'],
    scores: { 'sweet-fortified': 3, sparkling: 1, 'off-dry-riesling': 1 },
  },
  {
    key: 'taco-grill',
    words: ['taco', 'grill', 'grillmat', 'bbq', 'spareribs', 'pulled'],
    scores: { 'light-red': 3, 'medium-red': 2, 'structured-red': 2, 'off-dry-riesling': 1 },
  },
  {
    key: 'vegetar',
    words: ['salat', 'grønnsaker', 'vegetar', 'vegan', 'asparges', 'squash', 'aubergine', 'blomkål'],
    scores: { 'crisp-white': 3, 'rich-white': 2, 'light-red': 2, sparkling: 2 },
  },
  {
    key: 'aperitiff',
    words: ['aperitiff', 'fordrink', 'velkomstdrink', 'snacks', 'tapas'],
    scores: { sparkling: 3, 'crisp-white': 2, 'light-red': 1 },
  },
]

export interface FoodMatch {
  points: number       // 0–6: stilmatch (0–3) + direkte treff i innhentede matforslag (+3)
  reason: string | null // f.eks. «Notatene nevner: østers» eller «Frisk hvit passer skalldyr»
}

const CATEGORY_LABELS: Record<string, string> = {
  skalldyr: 'skalldyr', fisk: 'fisk', kylling: 'fjærkre', svin: 'svinekjøtt', julemat: 'julemat',
  lam: 'lam', storfe: 'rødt kjøtt', vilt: 'vilt og and', 'pasta-tomat': 'pasta og tomat',
  'sopp-trøffel': 'sopp og trøffel', asiatisk: 'krydret mat', ost: 'ost', blåmuggost: 'blåmuggost',
  dessert: 'dessert', 'taco-grill': 'grillmat', vegetar: 'grønt', aperitiff: 'aperitiff',
}

const STYLE_LABELS: Record<Style, string> = {
  'crisp-white': 'frisk og mineralsk', 'rich-white': 'fyldig hvit', 'aromatic-white': 'aromatisk hvit',
  'off-dry-riesling': 'riesling med restsødme', 'oxidative-white': 'jura-stil', 'light-red': 'lett og saftig rød',
  'medium-red': 'elegant rød', 'structured-red': 'strukturert rød', sparkling: 'bobler', 'sweet-fortified': 'søt/sterkvin',
}

export function foodMatch(w: RecoWine, foodQuery: string): FoodMatch {
  const q = foodQuery.trim().toLowerCase()
  if (!q) return { points: 0, reason: null }
  const styles = wineStyles(w)

  // 1) Stilmatch mot gjenkjente matkategorier
  let stylePoints = 0
  let bestCat: string | null = null
  let bestStyle: Style | null = null
  for (const cat of FOOD_CATEGORIES) {
    if (!cat.words.some(word => q.includes(word))) continue
    for (const s of styles) {
      const p = cat.scores[s] ?? 0
      if (p > stylePoints) { stylePoints = p; bestCat = cat.key; bestStyle = s }
    }
  }

  // 2) Direkte treff i matforslag fra innhentede notater (ord på 4+ tegn for å unngå støy)
  const qWords = q.split(/[^a-zæøåéèü-]+/).filter(t => t.length >= 4)
  let pairingHit: string | null = null
  for (const fp of w.food_pairings) {
    const fpLow = fp.toLowerCase()
    const hit = qWords.find(t => fpLow.includes(t))
    if (hit) { pairingHit = fp; break }
  }

  const points = stylePoints + (pairingHit ? 3 : 0)
  let reason: string | null = null
  if (pairingHit) reason = `Notatene nevner: ${pairingHit}`
  else if (bestCat && bestStyle) reason = `${STYLE_LABELS[bestStyle]} passer ${CATEGORY_LABELS[bestCat]}`
  return { points, reason }
}

/* ---------- Sortering ---------- */

export function sortDrinkOnly(list: RecoWine[]): RecoWine[] {
  return [...list].sort((a, b) =>
    readinessRank(a) - readinessRank(b) || (b.score ?? 0) - (a.score ?? 0)
  )
}

export function sortForFood(list: RecoWine[], foodQuery: string): { wine: RecoWine; match: FoodMatch }[] {
  return list
    .map(wine => ({ wine, match: foodMatch(wine, foodQuery) }))
    .sort((a, b) =>
      readinessRank(a.wine) - readinessRank(b.wine) ||
      b.match.points - a.match.points ||
      (b.wine.score ?? 0) - (a.wine.score ?? 0)
    )
}
