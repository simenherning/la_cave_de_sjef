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
