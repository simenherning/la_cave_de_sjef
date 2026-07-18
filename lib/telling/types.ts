// Datamodell for vintelling (varetelling mot CellarTracker-eksport).
// Alt lagres klientside i localStorage — se storage.ts.

export type ScanMethod = 'auto' | 'choice' | 'manual' | 'noean'

export interface WineRow {
  /** Unik nøkkel i appen: iWine fra CT, eller "local-N" for viner lagt til manuelt. */
  key: string
  /** CT-s vin-ID. Tom streng for viner som ikke finnes i CT (IKKE_I_CT). */
  iWine: string
  vintage: string
  wine: string
  producer: string
  size: string
  expectedQty: number
  countedQty: number
  /** EAN-er fra Wine Barcode-kolonnen i CT-eksporten (IKKE CT-feltet "Barcode"). */
  knownEans: string[]
  /** Lagt til under telling — finnes ikke i CT-inventaret. */
  notInCt?: boolean
}

export interface ScanEntry {
  ts: string
  /** null for flasker registrert uten strekkode. */
  ean: string | null
  /** WineRow.key for vinen skanningen ble løst til. */
  resolvedKey: string
  method: ScanMethod
}

export interface Session {
  startedAt: string
  inventoryFileName: string
  wines: WineRow[]
  /** EAN → liste av WineRow.key-kandidater. Bygges opp underveis («læring»). */
  eanMap: Record<string, string[]>
  /** Append-only logg. Gjør angring og feilsøking mulig. */
  scans: ScanEntry[]
}

export interface ImportResult {
  wines: WineRow[]
  eanMap: Record<string, string[]>
  warnings: string[]
}

export type WineStatus = 'OK' | 'MANGLER' | 'OVERTALL' | 'IKKE_SKANNET' | 'IKKE_I_CT'

export function wineStatus(w: WineRow): WineStatus {
  if (w.notInCt) return 'IKKE_I_CT'
  if (w.countedQty === 0 && w.expectedQty > 0) return 'IKKE_SKANNET'
  const diff = w.countedQty - w.expectedQty
  if (diff === 0) return 'OK'
  return diff < 0 ? 'MANGLER' : 'OVERTALL'
}
