// Henter tellingsinventaret fra appens egen database (wines-tabellen),
// slik at CSV-import på Mac (via /import) automatisk er tilgjengelig på mobil.

import { supabase } from '../supabase.ts'
import { normalizeEan } from './csv.ts'
import type { WineRow } from './types.ts'

export interface DbWineRow {
  id: number
  iwine_id: string | null
  vintage: number | null
  name: string
  producer: string | null
  size: string | null
  quantity: number
  upc: string | null
}

/** Ren mapping fra wines-tabellen til tellingens datamodell (testbar uten nett). */
export function mapDbWines(rows: DbWineRow[]): WineRow[] {
  return rows
    .filter(r => r.quantity > 0)
    .map(r => ({
      // Samme nøkkelskjema som parseInventory: iWine alene er ikke unik,
      // fordi CT gjenbruker den på tvers av flaskestørrelser.
      key: r.iwine_id ? `${r.iwine_id}|${r.size ?? ''}` : `db-${r.id}`,
      iWine: r.iwine_id ?? '',
      vintage: r.vintage != null ? String(r.vintage) : '',
      wine: r.name,
      producer: r.producer ?? '',
      size: r.size ?? '',
      expectedQty: r.quantity,
      countedQty: 0,
      knownEans: r.upc && normalizeEan(r.upc) ? [normalizeEan(r.upc)] : [],
    }))
}

export async function fetchInventory(): Promise<WineRow[]> {
  const { data, error } = await supabase
    .from('wines')
    .select('id, iwine_id, vintage, name, producer, size, quantity, upc')
    .gt('quantity', 0)
    .order('producer', { ascending: true })
  if (error) {
    throw new Error(
      'Kunne ikke hente kjellerinventaret fra databasen: ' + error.message +
      '. Du kan i stedet laste inn en CSV-eksport under.'
    )
  }
  return mapDbWines((data ?? []) as DbWineRow[])
}

export interface LearnedEanRow {
  ean: string
  iwine_id: string
  size: string
}

/**
 * Fletter lærte EAN-koblinger inn i vinenes knownEans (ren logikk, testbar).
 * Matcher på (iwine_id, size); tom size i koblingen matcher alle størrelser
 * av vinen (eldre koblinger uten størrelse).
 */
export function mergeLearnedEans(wines: WineRow[], learned: LearnedEanRow[]): void {
  for (const l of learned) {
    const ean = normalizeEan(l.ean)
    if (!ean) continue
    for (const w of wines) {
      if (w.iWine !== l.iwine_id) continue
      if (l.size && w.size !== l.size) continue
      if (!w.knownEans.includes(ean)) w.knownEans.push(ean)
    }
  }
}

/** Henter lærte koblinger; feil er ikke fatalt (tabellen kan mangle/nettet være nede). */
export async function fetchLearnedEans(): Promise<LearnedEanRow[]> {
  const { data, error } = await supabase.from('learned_eans').select('ean, iwine_id, size')
  if (error) {
    console.error('Kunne ikke hente lærte EAN-koblinger:', error.message)
    return []
  }
  return (data ?? []) as LearnedEanRow[]
}

/**
 * Lagrer en lært kobling. Best effort — feiler stille (f.eks. uten dekning i
 * kjelleren); koblingen ligger uansett i localStorage og EAN-koblingsfilen.
 */
export function saveLearnedEan(ean: string, wine: WineRow): void {
  if (!wine.iWine) return
  supabase
    .from('learned_eans')
    .upsert(
      { ean, iwine_id: wine.iWine, size: wine.size ?? '', wine: [wine.wine, wine.vintage].filter(Boolean).join(' ') },
      { onConflict: 'ean,iwine_id,size', ignoreDuplicates: true },
    )
    .then(({ error }) => {
      if (error) console.error('Kunne ikke lagre EAN-kobling i databasen:', error.message)
    })
}
