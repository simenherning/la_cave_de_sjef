// Anbefalingsmaskinen: modenhetsrangering, fritekstfilter og mat–vin-matching.
// Mat-logikken implementerer docs/MATVIN.md: vinen matches mot sausen/komponentene,
// jernlovene diskvalifiserer (chili+tannin, fet fisk+tannin, egg+tannin, søt mat +
// tørr vin), og vinens aldersfase justerer valget. Alt kjører i nettleseren.

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

// Forslagene viser bare viner som er drikkeklare nå eller innen 2 år —
// en vin med vindu fra 2028 vises i 2026, men ikke i 2025.
export function withinReadinessHorizon(w: RecoWine): boolean {
  if (!w.begin_consume) return true // ukjent vindu: ikke utelukk
  return w.begin_consume <= CURRENT_YEAR + 2
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
  return wines.filter(w => {
    const hay = [w.name, w.producer, w.varietal, w.country, w.region, w.appellation]
      .filter(Boolean).join(' ').toLowerCase()
    // Alle ordene i søket må treffe (via alias-gruppene sine)
    const groups: string[][] = q.split(/\s+/).map(t => [t, ...(NO_ALIASES[t] ?? [])])
    return groups.every(g => g.some(term => hay.includes(term)))
  })
}

/* ---------- Vinprofil: stil, struktur og aldersfase (MATVIN kap. 2 og 4) ---------- */

type Style =
  | 'crisp-white' | 'rich-white' | 'aromatic-white' | 'off-dry-riesling' | 'oxidative-white'
  | 'light-red' | 'medium-red' | 'structured-red' | 'sparkling' | 'sweet-fortified'

export interface WineProfile {
  styles: Style[]
  tannin: number      // 0–3
  acid: number        // 0–3
  body: number        // 0–3
  offDry: boolean     // restsødme (Kabinett/feinherb o.l.)
  sweet: boolean      // dessert-/sterkvin
  bubbles: boolean
  oxidative: boolean
  oaked: boolean
  phase: 'ung' | 'moden'  // grovt estimat på aromafase (primær/sekundær vs tertiær)
}

function detectStyles(hay: string, w: RecoWine): Style[] {
  const has = (...terms: string[]) => terms.some(t => hay.includes(t))
  const styles: Style[] = []

  if ((w.category ?? '').toLowerCase().includes('sparkling')) styles.push('sparkling')
  if ((w.category ?? '').toLowerCase().match(/sweet|fortified/) || has('sauternes', 'tawny', 'port', 'vin de paille', 'massandra', 'madeira')) {
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
    if (has('gamay', 'beaujolais', 'fleurie', 'morgon', 'brouilly', 'moulin-à-vent', 'chiroubles', 'poulsard', 'trousseau', 'frappato')) styles.push('light-red')
    if (has('pinot noir', 'bourgogne', 'gevrey', 'chambolle', 'vosne', 'nuits', 'volnay', 'pommard', 'beaune', 'morey', 'marsannay', 'santenay', 'monthélie', 'ladoix', 'mercurey', 'sancerre rouge', 'spätburgunder', 'dolcetto', 'cabernet franc', 'saumur', 'chinon')) styles.push('medium-red')
    if (has('nebbiolo', 'barolo', 'barbaresco', 'cabernet sauvignon', 'merlot', 'bordeaux', 'pauillac', 'pomerol', 'saint-julien', 'margaux', 'pétrus', 'pichon', 'syrah', 'côte-rôtie', 'hermitage', 'cornas', 'rioja', 'tempranillo', 'bosconia', 'tondonia', 'brunello', 'sangiovese', 'aglianico', 'mourvèdre', 'châteauneuf', 'pinotage')) styles.push('structured-red')
    if (styles.length === 0) styles.push('medium-red')
  }

  return styles.length ? styles : ['medium-red']
}

// Aldersfase: posisjon i drikkevinduet + faktisk alder. Sent i vinduet eller
// 15 år+ → regn med tertiærpreg (sopp, lær, tørket frukt).
function agePhase(w: RecoWine): 'ung' | 'moden' {
  const age = w.vintage ? CURRENT_YEAR - w.vintage : 0
  if (age >= 15) return 'moden'
  if (w.begin_consume && w.end_consume && w.end_consume > w.begin_consume) {
    const pos = (CURRENT_YEAR - w.begin_consume) / (w.end_consume - w.begin_consume)
    if (pos >= 0.65 && age >= 8) return 'moden'
  }
  return 'ung'
}

export function wineProfile(w: RecoWine): WineProfile {
  const hay = [w.name, w.varietal, w.region, w.appellation, w.producer]
    .filter(Boolean).join(' ').toLowerCase()
  const styles = detectStyles(hay, w)
  const hasStyle = (s: Style) => styles.includes(s)

  // Strukturverdier fra dominerende stil, deretter druespesifikke justeringer
  let tannin = 0, acid = 2, body = 2
  if (hasStyle('structured-red')) { tannin = 3; acid = 2; body = 3 }
  else if (hasStyle('medium-red')) { tannin = 2; acid = 2; body = 2 }
  else if (hasStyle('light-red')) { tannin = 1; acid = 3; body = 1 }
  if (hasStyle('crisp-white') || hasStyle('off-dry-riesling')) { acid = 3; body = 1 }
  if (hasStyle('rich-white')) { acid = 2; body = 2 }
  if (hasStyle('sparkling')) { acid = 3; body = 1 }

  const has = (...terms: string[]) => terms.some(t => hay.includes(t))
  if (has('nebbiolo', 'barolo', 'barbaresco')) { acid = 3 }        // høy syre OG høy tannin
  if (has('dolcetto')) { tannin = 2; acid = 1 }                    // uvanlig lav syre
  if (has('pinot noir', 'spätburgunder') && !has('barolo')) { tannin = 1 } // silketannin
  if ((w.color ?? '').toLowerCase() === 'orange') { tannin = Math.max(tannin, 1) } // skallkontakt

  return {
    styles,
    tannin,
    acid,
    body,
    offDry: hasStyle('off-dry-riesling') || has('demi-sec', 'halbtrocken'),
    sweet: hasStyle('sweet-fortified'),
    bubbles: hasStyle('sparkling'),
    oxidative: hasStyle('oxidative-white'),
    oaked: hasStyle('rich-white'),
    phase: agePhase(w),
  }
}

/* ---------- Rettens profil: kategorier og faresignaler (MATVIN kap. 1 og 3) ---------- */

interface DishFlags {
  chili?: boolean        // capsaicin: veto mot tannin/alkohol
  fattyFish?: boolean    // jern/lipid → metallsmak med tannin
  rawSeafood?: boolean   // rå sjømat: null tannin
  egg?: boolean          // eggretter: trenger bobler/syre
  sweetDish?: boolean    // dessert: vinen må være søtere
  sourDish?: boolean     // maten må ikke være surere enn vinen
  tomato?: boolean       // syre + umami: dreper modne viner
  umami?: boolean        // forsterker ung tannin
  mushroom?: boolean     // speiler tertiæraromaer
  braised?: boolean      // mør tekstur: elsker polymerisert tannin
  grilledMeat?: boolean  // fett + skorpe: temmer ung tannin
  artichoke?: boolean    // cynarin: krever knusktørr ueiket hvit
  delicate?: boolean     // skjør rett: store viner overdøver
}

interface FoodCat {
  key: string
  label: string
  words: string[]
  scores: Partial<Record<Style, number>>
  flags?: DishFlags
}

const FOOD_CATEGORIES: FoodCat[] = [
  {
    key: 'raatt', label: 'rå sjømat',
    words: ['østers', 'sushi', 'sashimi', 'ceviche', 'kaviar', 'carpaccio av fisk', 'tartar av fisk'],
    scores: { 'crisp-white': 3, sparkling: 3, 'rich-white': 1 },
    flags: { rawSeafood: true, delicate: true },
  },
  {
    key: 'skalldyr', label: 'skalldyr',
    words: ['kamskjell', 'reker', 'krabbe', 'hummer', 'skalldyr', 'blåskjell', 'sjøkreps', 'skjell'],
    scores: { 'crisp-white': 3, sparkling: 3, 'rich-white': 2 },
    flags: { delicate: true },
  },
  {
    key: 'hvitfisk', label: 'hvit fisk',
    words: ['torsk', 'skrei', 'sei', 'kveite', 'breiflabb', 'piggvar', 'sjøtunge', 'fiskesuppe', 'bacalao', 'lutefisk', 'hvit fisk'],
    scores: { 'crisp-white': 3, 'rich-white': 2, sparkling: 2, 'off-dry-riesling': 1 },
    flags: { delicate: true },
  },
  {
    key: 'fetfisk', label: 'fet fisk',
    words: ['laks', 'ørret', 'makrell', 'tunfisk', 'sild', 'røkelaks', 'røkt fisk', 'røkt ørret', 'ansjos'],
    scores: { 'crisp-white': 2, 'off-dry-riesling': 2, 'light-red': 2, 'medium-red': 2, sparkling: 2, 'rich-white': 1 },
    flags: { fattyFish: true },
  },
  {
    key: 'fritert', label: 'fritert mat',
    words: ['fritert', 'frityr', 'fish and chips', 'tempura', 'kroketter', 'chips', 'pommes'],
    scores: { sparkling: 3, 'crisp-white': 2 },
  },
  {
    key: 'fjaerkre', label: 'fjærkre',
    words: ['kylling', 'kalkun', 'høne', 'perlehøne', 'vaktel', 'coq au vin'],
    scores: { 'rich-white': 3, 'medium-red': 2, 'light-red': 2, sparkling: 2, 'oxidative-white': 2 },
  },
  {
    key: 'andvilt', label: 'and og vilt',
    words: ['and', 'andebryst', 'due', 'rype', 'hjort', 'elg', 'rein', 'reinsdyr', 'rådyr', 'vilt', 'hare', 'gås', 'villsvin'],
    scores: { 'medium-red': 3, 'structured-red': 2, 'light-red': 1 },
  },
  {
    key: 'svin', label: 'svin og charcuteri',
    words: ['svin', 'gris', 'koteletter', 'pølse', 'spekemat', 'skinke', 'charcuteri', 'porchetta', 'rillettes', 'salami'],
    scores: { 'light-red': 3, 'medium-red': 2, 'rich-white': 2, 'off-dry-riesling': 2, sparkling: 1 },
    flags: { umami: true },
  },
  {
    key: 'julemat', label: 'julemat',
    words: ['ribbe', 'pinnekjøtt', 'medisterkaker', 'julemat', 'julaften', 'smalahove'],
    scores: { 'off-dry-riesling': 3, sparkling: 2, 'light-red': 2, 'aromatic-white': 2, 'crisp-white': 1 },
  },
  {
    key: 'faarikaal', label: 'fårikål',
    words: ['fårikål'],
    scores: { 'crisp-white': 3, 'medium-red': 2, 'off-dry-riesling': 2 },
  },
  {
    key: 'lam', label: 'lam',
    words: ['lam', 'lammelår', 'lammeskank', 'lammecarre', 'lammestek', 'får'],
    scores: { 'structured-red': 3, 'medium-red': 2 },
    flags: { grilledMeat: true },
  },
  {
    key: 'storfe', label: 'rødt kjøtt',
    words: ['biff', 'okse', 'entrecôte', 'entrecote', 'indrefilet', 'ytrefilet', 'burger', 'ribeye', 'flankstek', 'steak', 'boeuf'],
    scores: { 'structured-red': 3, 'medium-red': 2 },
    flags: { grilledMeat: true },
  },
  {
    key: 'braisert', label: 'braisert og gryte',
    words: ['braisert', 'gryte', 'ossobuco', 'brasato', 'oksehale', 'oksekinn', 'confit', 'langtidsstekt', 'bourguignon', 'ragu'],
    scores: { 'medium-red': 3, 'structured-red': 3 },
    flags: { braised: true, umami: true },
  },
  {
    key: 'kalv', label: 'kalv',
    words: ['kalv', 'vitello'],
    scores: { 'rich-white': 3, 'medium-red': 2 },
  },
  {
    key: 'tomat', label: 'tomatbasert',
    words: ['pizza', 'tomatsaus', 'tomat', 'lasagne', 'bolognese', 'spaghetti', 'arrabiata', 'napoli'],
    scores: { 'medium-red': 2, 'light-red': 2, 'structured-red': 1 },
    flags: { tomato: true, sourDish: true, umami: true },
  },
  {
    key: 'sopp', label: 'sopp og trøffel',
    words: ['sopp', 'trøffel', 'risotto', 'kantarell', 'steinsopp', 'morkler'],
    scores: { 'medium-red': 3, 'rich-white': 2, 'oxidative-white': 3, 'structured-red': 2, sparkling: 2 },
    flags: { mushroom: true, umami: true },
  },
  {
    key: 'floete', label: 'fløtesaus',
    words: ['fløtesaus', 'fløte', 'kremet', 'carbonara', 'gratinert', 'gratin'],
    scores: { 'rich-white': 3, sparkling: 2, 'crisp-white': 2, 'oxidative-white': 2 },
  },
  {
    key: 'smoer', label: 'smørsaus',
    words: ['beurre blanc', 'smørsaus', 'brunet smør', 'meunière'],
    scores: { 'crisp-white': 3, 'rich-white': 3, sparkling: 2 },
  },
  {
    key: 'eggsaus', label: 'hollandaise/bearnaise',
    words: ['hollandaise', 'bearnaise', 'béarnaise'],
    scores: { 'rich-white': 3, sparkling: 2, 'structured-red': 1 },
  },
  {
    key: 'egg', label: 'eggretter',
    words: ['eggerøre', 'omelett', 'egg benedict', 'frokost', 'brunsj', 'quiche'],
    scores: { sparkling: 3, 'crisp-white': 2 },
    flags: { egg: true },
  },
  {
    key: 'roedvinssaus', label: 'rødvins-/sjysaus',
    words: ['rødvinssaus', 'demi-glace', 'sjysaus', 'sjy', 'kraftsaus', 'viltsaus'],
    scores: { 'structured-red': 3, 'medium-red': 2 },
    flags: { umami: true },
  },
  {
    key: 'soya', label: 'soya/umami-preget',
    words: ['soya', 'teriyaki', 'ramen', 'dumplings', 'dim sum', 'wok', 'yakitori', 'miso'],
    scores: { 'off-dry-riesling': 3, 'light-red': 2, 'medium-red': 2, sparkling: 1 },
    flags: { umami: true },
  },
  {
    key: 'chili', label: 'sterk/krydret mat',
    words: ['thai', 'chili', 'sterk', 'curry', 'karri', 'indisk', 'sichuan', 'koreansk', 'kimchi', 'vindaloo', 'krydret', 'jerk'],
    scores: { 'off-dry-riesling': 3, 'aromatic-white': 2, 'light-red': 1, 'crisp-white': 1 },
    flags: { chili: true },
  },
  {
    key: 'salat', label: 'salat/syrlig',
    words: ['salat', 'vinaigrette', 'kapers', 'sylteagurk', 'eddik', 'syltet'],
    scores: { 'crisp-white': 3, sparkling: 1 },
    flags: { sourDish: true },
  },
  {
    key: 'urter', label: 'urtesauser',
    words: ['pesto', 'salsa verde', 'chimichurri', 'urter', 'estragon', 'gremolata'],
    scores: { 'crisp-white': 3, 'light-red': 2, 'medium-red': 1 },
  },
  {
    key: 'aioli', label: 'aioli/majones',
    words: ['aioli', 'majones', 'remulade'],
    scores: { sparkling: 3, 'crisp-white': 2 },
  },
  {
    key: 'ost', label: 'ost',
    words: ['ost', 'comté', 'brie', 'parmesan', 'manchego', 'gruyère', 'cheddar', 'ostebord', 'raclette', 'fondue'],
    scores: { 'oxidative-white': 3, 'rich-white': 2, sparkling: 2, 'sweet-fortified': 2, 'structured-red': 1 },
    flags: { umami: true },
  },
  {
    key: 'chevre', label: 'geitost',
    words: ['chevre', 'chèvre', 'geitost'],
    scores: { 'crisp-white': 3 },
  },
  {
    key: 'blaamugg', label: 'blåmuggost',
    words: ['blåmuggost', 'roquefort', 'gorgonzola', 'stilton'],
    scores: { 'sweet-fortified': 3, 'off-dry-riesling': 2, 'oxidative-white': 1 },
  },
  {
    key: 'dessert', label: 'dessert',
    words: ['dessert', 'kake', 'iskrem', 'crème brûlée', 'pai', 'sjokolade', 'karamell', 'terte'],
    scores: { 'sweet-fortified': 3 },
    flags: { sweetDish: true },
  },
  {
    key: 'grill', label: 'grillmat',
    words: ['grill', 'grillet', 'bbq', 'spareribs', 'pulled', 'braai', 'grillmat'],
    scores: { 'structured-red': 2, 'light-red': 2, 'medium-red': 2, 'off-dry-riesling': 1 },
    flags: { grilledMeat: true },
  },
  {
    key: 'taco', label: 'taco',
    words: ['taco', 'fajita', 'burrito'],
    scores: { 'light-red': 3, 'off-dry-riesling': 2, 'medium-red': 1 },
  },
  {
    key: 'asparges', label: 'asparges',
    words: ['asparges'],
    scores: { 'crisp-white': 3 },
    flags: { artichoke: true },
  },
  {
    key: 'artisjokk', label: 'artisjokk',
    words: ['artisjokk'],
    scores: { 'crisp-white': 3 },
    flags: { artichoke: true },
  },
  {
    key: 'vegetar', label: 'grønt',
    words: ['grønnsaker', 'vegetar', 'vegan', 'squash', 'aubergine', 'blomkål', 'linser'],
    scores: { 'crisp-white': 3, 'rich-white': 2, 'light-red': 2, sparkling: 2 },
  },
  {
    key: 'aperitiff', label: 'aperitiff',
    words: ['aperitiff', 'fordrink', 'velkomstdrink', 'snacks', 'tapas'],
    scores: { sparkling: 3, 'crisp-white': 2, 'light-red': 1 },
  },
]

const STYLE_LABELS: Record<Style, string> = {
  'crisp-white': 'frisk og mineralsk', 'rich-white': 'fyldig hvit', 'aromatic-white': 'aromatisk hvit',
  'off-dry-riesling': 'riesling med restsødme', 'oxidative-white': 'jura-stil', 'light-red': 'lett og saftig rød',
  'medium-red': 'elegant rød', 'structured-red': 'strukturert rød', sparkling: 'bobler', 'sweet-fortified': 'søt/sterkvin',
}

export interface FoodMatch {
  points: number
  reason: string | null   // hvorfor den passer
  veto: string | null     // jernlov brutt → vises ikke i listen
}

export function foodMatch(w: RecoWine, foodQuery: string): FoodMatch {
  const q = foodQuery.trim().toLowerCase()
  if (!q) return { points: 0, reason: null, veto: null }
  const p = wineProfile(w)

  // 1) Finn matchende kategorier og samle faresignaler
  const flags: DishFlags = {}
  let stylePoints = 0
  let bestCat: FoodCat | null = null
  let bestStyle: Style | null = null
  for (const cat of FOOD_CATEGORIES) {
    if (!cat.words.some(word => q.includes(word))) continue
    Object.assign(flags, cat.flags)
    for (const s of p.styles) {
      const pts = cat.scores[s] ?? 0
      if (pts > stylePoints) { stylePoints = pts; bestCat = cat; bestStyle = s }
    }
  }

  // 2) Jernlovene (MATVIN kap. 1) — brudd diskvalifiserer
  if (flags.chili && p.tannin >= 2) return { points: -1, reason: null, veto: 'chili + tannin kræsjer' }
  if (flags.chili && p.phase === 'moden') return { points: -1, reason: null, veto: 'sterk mat dreper en moden vin' }
  if (flags.fattyFish && p.tannin >= 2) return { points: -1, reason: null, veto: 'fet fisk + tannin gir metallsmak' }
  if (flags.rawSeafood && p.tannin >= 1) return { points: -1, reason: null, veto: 'rå sjømat tåler ikke tannin' }
  if (flags.egg && p.tannin >= 2) return { points: -1, reason: null, veto: 'egg + tannin kræsjer' }
  if (flags.sweetDish && !p.sweet && !p.offDry) return { points: -1, reason: null, veto: 'desserten er søtere enn vinen' }
  if (flags.tomato && p.phase === 'moden' && p.tannin >= 1) return { points: -1, reason: null, veto: 'tomatens syre og umami dreper en moden vin' }
  if (flags.artichoke && (p.tannin >= 1 || p.oaked || p.offDry)) return { points: -1, reason: null, veto: 'cynarin i artisjokk/asparges krever knusktørr, ueiket hvit' }
  if (flags.sourDish && p.acid <= 1) return { points: -1, reason: null, veto: 'maten er surere enn vinen' }

  // 3) Direkte treff i matforslag fra innhentede notater (ord på 4+ tegn)
  const qWords = q.split(/[^a-zæøåéèü-]+/).filter(t => t.length >= 4)
  let pairingHit: string | null = null
  for (const fp of w.food_pairings) {
    const fpLow = fp.toLowerCase()
    const hit = qWords.find(t => fpLow.includes(t))
    if (hit) { pairingHit = fp; break }
  }

  // 4) Aldersfase- og strukturjusteringer (MATVIN kap. 3–4)
  let bonus = 0
  let phaseNote: string | null = null
  if (stylePoints > 0) {
    if (p.phase === 'moden' && (flags.mushroom || flags.braised)) {
      bonus += 2; phaseNote = 'moden vin elsker sopp og braisert'
    }
    if (p.phase === 'ung' && flags.grilledMeat && p.tannin >= 2) {
      bonus += 1; phaseNote = 'ung tannin temmes av fett og stekeskorpe'
    }
    if (p.phase === 'moden' && flags.grilledMeat && p.tannin >= 2) {
      bonus -= 1; phaseNote = 'grillskorpe kan overdøve en moden vin'
    }
    if (flags.umami && !flags.braised && p.tannin >= 2 && p.phase === 'ung') {
      bonus -= 1 // umami forsterker ung tannin (salt i retten demper, men vi vet ikke)
    }
    if ((flags.mushroom || flags.umami) && (p.oxidative || (p.bubbles && p.phase === 'moden'))) {
      bonus += 1; phaseNote = phaseNote ?? 'vinens egen umami (autolyse/oksidativt) speiler retten'
    }
    if (flags.delicate && p.body >= 3) bonus -= 1 // stor vin overdøver skjør rett
  }

  const points = Math.max(stylePoints + bonus, 0) + (pairingHit ? 3 : 0)

  let reason: string | null = null
  if (pairingHit) reason = `Notatene nevner: ${pairingHit}`
  else if (bestCat && bestStyle) {
    reason = `${STYLE_LABELS[bestStyle]} passer ${bestCat.label}`
    if (phaseNote) reason += ` — ${phaseNote}`
  }
  return { points, reason, veto: null }
}

/* ---------- Sortering ---------- */

export function sortDrinkOnly(list: RecoWine[]): RecoWine[] {
  return [...list].sort((a, b) =>
    readinessRank(a) - readinessRank(b) || (b.score ?? 0) - (a.score ?? 0)
  )
}

export interface FoodResults {
  results: { wine: RecoWine; match: FoodMatch }[]
  excluded: { wine: RecoWine; veto: string }[]
}

export function sortForFood(list: RecoWine[], foodQuery: string): FoodResults {
  const scored = list.map(wine => ({ wine, match: foodMatch(wine, foodQuery) }))
  const excluded = scored
    .filter(s => s.match.veto)
    .map(s => ({ wine: s.wine, veto: s.match.veto! }))
  const results = scored
    .filter(s => !s.match.veto)
    .sort((a, b) =>
      readinessRank(a.wine) - readinessRank(b.wine) ||
      b.match.points - a.match.points ||
      (b.wine.score ?? 0) - (a.wine.score ?? 0)
    )
  return { results, excluded }
}
