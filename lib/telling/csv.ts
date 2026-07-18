// CSV-parsing og -generering for vintelling.
// Ren logikk uten browser-avhengigheter, testes med `node --test` (csv.test.ts).

import type { ImportResult, Session, WineRow } from './types.ts'
import { wineStatus } from './types.ts'

/** Robust CSV-parser: BOM, CRLF, quoted felt med komma og linjeskift. */
export function parseCsv(text: string): string[][] {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0
  while (i < src.length) {
    const c = src[i]
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i += 2; continue }
        inQuotes = false; i++; continue
      }
      field += c; i++; continue
    }
    if (c === '"') { inQuotes = true; i++; continue }
    if (c === ',') { row.push(field); field = ''; i++; continue }
    if (c === '\r') { i++; continue }
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue }
    field += c; i++
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row) }
  return rows.filter(r => !(r.length === 1 && r[0].trim() === ''))
}

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[\s_-]/g, '')
}

// Kolonnesynonymer i CT-eksport (normalisert: lowercase, uten mellomrom).
// VIKTIG — to feller (begge verifisert mot ekte CT-eksporter):
//  - "Barcode" er CTs interne per-flaske-ID (11 siffer) — ikke EAN.
//  - "WineBarcode" (xlquery-eksporten) er CTs interne vin-etikett på formen
//    W<iWine>_<størrelse> — heller ikke EAN.
// EAN ligger i kolonnen "UPC". Ingen av de to over skal stå i EAN-listen.
const COLUMN_SYNONYMS: Record<string, string[]> = {
  iWine: ['iwine'],
  vintage: ['vintage'],
  wine: ['wine'],
  producer: ['producer'],
  size: ['size', 'bottlesize'],
  quantity: ['quantity', 'inventory', 'qty'],
  ean: ['upc', 'ean', 'wineupc'],
}

// iWine er sterkt ønsket (gjør resultatet joinbart mot CT), men ikke alle
// CT-eksporter har den med — da faller vi tilbake på Vintage|Wine|Size som nøkkel.
const REQUIRED_COLUMNS: Array<{ field: string; label: string }> = [
  { field: 'vintage', label: 'Vintage' },
  { field: 'wine', label: 'Wine' },
  { field: 'size', label: 'Size' },
]

/** Normaliser EAN/UPC: kun siffer. Returnerer '' hvis ugyldig lengde. */
export function normalizeEan(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  return digits.length === 8 || digits.length === 12 || digits.length === 13 ? digits : ''
}

/**
 * Nøkler å slå opp en skannet kode på: UPC-A (12 siffer) og EAN-13 med
 * ledende null er samme kode — prøv begge varianter.
 */
export function eanLookupKeys(ean: string): string[] {
  const keys = [ean]
  if (ean.length === 12) keys.push('0' + ean)
  if (ean.length === 13 && ean.startsWith('0')) keys.push(ean.slice(1))
  return keys
}

/**
 * Parser en CellarTracker-inventareksport. Aggregerer til én rad per
 * (iWine, størrelse) — CT skiller årganger som egne iWine-er, men gjenbruker
 * samme iWine på tvers av flaskestørrelser.
 * Kaster Error med norsk melding hvis påkrevde kolonner mangler.
 */
export function parseInventory(text: string): ImportResult {
  const rows = parseCsv(text)
  if (rows.length < 2) throw new Error('Filen ser tom ut — fant ingen datarader.')

  const header = rows[0].map(normalizeHeader)
  const col: Record<string, number> = {}
  for (const [field, synonyms] of Object.entries(COLUMN_SYNONYMS)) {
    col[field] = header.findIndex(h => synonyms.includes(h))
  }

  const missing = REQUIRED_COLUMNS.filter(r => col[r.field] === -1)
  if (missing.length > 0) {
    throw new Error(
      'Mangler påkrevde kolonner i CSV-en: ' + missing.map(m => m.label).join(', ') +
      '. Eksporter på nytt fra CellarTracker med disse kolonnene valgt.'
    )
  }

  const warnings: string[] = []
  if (col.iWine === -1) {
    warnings.push(
      'iWine-kolonnen mangler i eksporten. Tellingen fungerer, men resultatet kan ikke ' +
      'joines direkte mot CT på iWine — avstemmingen må gjøres på vin + årgang + størrelse.'
    )
  }
  const byKey = new Map<string, WineRow>()

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]
    const get = (field: string) => (col[field] >= 0 ? (row[col[field]] ?? '').trim() : '')
    const iWine = get('iWine')
    // Nøkkelen må inkludere størrelse: CT gjenbruker samme iWine for 750ml og
    // 1,5L av samme vin (verifisert i denne kjelleren). Uten iWine brukes
    // (årgang, vin, størrelse) — samme granularitet.
    const key = iWine
      ? `${iWine}|${get('size')}`
      : `${get('vintage')}|${get('wine')}|${get('size')}`.toLowerCase()
    if (key === '||') { warnings.push(`Rad ${r + 1} mangler både iWine og vinnavn og ble hoppet over.`); continue }

    let qty = 1
    if (col.quantity >= 0) {
      const q = parseInt(get('quantity'), 10)
      qty = Number.isFinite(q) && q > 0 ? q : 1
    }
    const ean = normalizeEan(get('ean'))

    const existing = byKey.get(key)
    if (existing) {
      existing.expectedQty += qty
      if (ean && !existing.knownEans.includes(ean)) existing.knownEans.push(ean)
    } else {
      byKey.set(key, {
        key,
        iWine,
        vintage: get('vintage'),
        wine: get('wine'),
        producer: get('producer'),
        size: get('size'),
        expectedQty: qty,
        countedQty: 0,
        knownEans: ean ? [ean] : [],
      })
    }
  }

  const wines = Array.from(byKey.values())
  return { wines, eanMap: buildEanMap(wines), warnings }
}

/** EAN → vin-nøkler, fra vinenes kjente EAN-er (CSV-import eller database). */
export function buildEanMap(wines: WineRow[]): Record<string, string[]> {
  const eanMap: Record<string, string[]> = {}
  for (const w of wines) {
    for (const ean of w.knownEans) {
      const list = (eanMap[ean] ??= [])
      if (!list.includes(w.key)) list.push(w.key)
    }
  }
  return eanMap
}

/**
 * Parser fjorårets EAN-koblingsfil (se buildEanMapCsv).
 * Returnerer EAN → iWine[]-koblinger; ukjente iWine-er filtreres bort av kalleren.
 */
export function parseEanMapFile(text: string): Record<string, string[]> {
  const rows = parseCsv(text)
  if (rows.length < 2) return {}
  const header = rows[0].map(normalizeHeader)
  const eanIdx = header.findIndex(h => h === 'ean')
  const iWineIdx = header.findIndex(h => h === 'iwine')
  if (eanIdx === -1 || iWineIdx === -1) {
    throw new Error('EAN-koblingsfilen må ha kolonnene EAN og iWine.')
  }
  const map: Record<string, string[]> = {}
  for (let r = 1; r < rows.length; r++) {
    const ean = normalizeEan((rows[r][eanIdx] ?? '').trim())
    const iWine = (rows[r][iWineIdx] ?? '').trim()
    if (!ean || !iWine) continue
    const list = (map[ean] ??= [])
    if (!list.includes(iWine)) list.push(iWine)
  }
  return map
}

function csvField(v: string | number): string {
  const s = String(v)
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}

function toCsv(rows: Array<Array<string | number>>): string {
  // UTF-8 BOM så Excel åpner norske tegn riktig; CRLF for maksimal kompatibilitet.
  return '\uFEFF' + rows.map(r => r.map(csvField).join(',')).join('\r\n') + '\r\n'
}

/** Resultat-CSV (hovedleveranse): én rad per vin, joinbar mot CT på iWine. */
export function buildResultCsv(session: Session): string {
  const rows: Array<Array<string | number>> = [
    ['iWine', 'Vintage', 'Wine', 'Size', 'ExpectedQty', 'CountedQty', 'Diff', 'Status'],
  ]
  for (const w of session.wines) {
    rows.push([
      w.iWine, w.vintage, w.wine, w.size,
      w.expectedQty, w.countedQty, w.countedQty - w.expectedQty, wineStatus(w),
    ])
  }
  return toCsv(rows)
}

/** EAN-koblingsfil (sekundær leveranse): én rad per (EAN, iWine)-kobling. */
export function buildEanMapCsv(session: Session): string {
  const byKey = new Map(session.wines.map(w => [w.key, w]))
  const rows: Array<Array<string | number>> = [['EAN', 'iWine', 'Vintage', 'Wine', 'Size']]
  const sorted = Object.entries(session.eanMap).sort(([a], [b]) => a.localeCompare(b))
  for (const [ean, keys] of sorted) {
    for (const key of keys) {
      const w = byKey.get(key)
      if (!w || !w.iWine) continue
      rows.push([ean, w.iWine, w.vintage, w.wine, w.size])
    }
  }
  return toCsv(rows)
}
