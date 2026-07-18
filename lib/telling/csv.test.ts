// Kjøres med: npm test  (node --test, krever Node ≥ 22.6 for TypeScript-støtte)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  parseCsv, parseInventory, parseEanMapFile,
  buildResultCsv, buildEanMapCsv, normalizeEan, eanLookupKeys,
} from './csv.ts'
import type { Session, WineRow } from './types.ts'

test('parseCsv: quoted felt, komma i vinnavn, BOM og CRLF', () => {
  const text = '\uFEFFiWine,Wine\r\n123,"Château d\'Yquem, Sauternes ""Premier Cru"""\r\n'
  const rows = parseCsv(text)
  assert.deepEqual(rows, [
    ['iWine', 'Wine'],
    ['123', 'Château d\'Yquem, Sauternes "Premier Cru"'],
  ])
})

test('parseCsv: quoted felt med linjeskift', () => {
  const rows = parseCsv('a,b\n"linje1\nlinje2",x\n')
  assert.deepEqual(rows, [['a', 'b'], ['linje1\nlinje2', 'x']])
})

// Den mest sannsynlige implementasjonsfeilen ifølge PRD §3: CT-feltet "Barcode"
// er CTs interne per-flaske-ID (11 siffer) — IKKE EAN. EAN ligger i "Wine Barcode".
test('Barcode-kolonnen (CTs per-flaske-ID) forveksles ALDRI med EAN', () => {
  const text = [
    'iWine,Vintage,Wine,Size,Quantity,Barcode,Wine Barcode',
    '3051601,2017,"Angerville Clos des Ducs",750ml,1,01413525841,3760052440123',
    '3051601,2017,"Angerville Clos des Ducs",750ml,1,01413525842,3760052440123',
  ].join('\r\n')
  const { wines, eanMap } = parseInventory(text)
  assert.equal(wines.length, 1)
  assert.deepEqual(wines[0].knownEans, ['3760052440123'])
  // Per-flaske-ID-ene skal ikke finnes noe sted i EAN-oppslaget:
  assert.deepEqual(Object.keys(eanMap), ['3760052440123'])
  assert.ok(!('01413525841' in eanMap))
  assert.ok(!('1413525841' in eanMap))
})

test('parseInventory: per-flaske-eksport aggregeres til per iWine', () => {
  const text = [
    'iWine,Vintage,Wine,Producer,Size,Quantity',
    '111,2017,"Volnay Clos des Ducs",Angerville,750ml,1',
    '111,2017,"Volnay Clos des Ducs",Angerville,750ml,1',
    '111,2017,"Volnay Clos des Ducs",Angerville,750ml,1',
    '222,2018,"Volnay Champans",Angerville,750ml,1',
  ].join('\n')
  const { wines } = parseInventory(text)
  assert.equal(wines.length, 2)
  assert.equal(wines.find(w => w.iWine === '111')!.expectedQty, 3)
  assert.equal(wines.find(w => w.iWine === '222')!.expectedQty, 1)
})

test('parseInventory: per-vin-eksport med Quantity brukes direkte', () => {
  const text = 'iWine,Vintage,Wine,Size,Quantity\n111,2017,"Vin A",750ml,5\n'
  const { wines } = parseInventory(text)
  assert.equal(wines[0].expectedQty, 5)
})

test('parseInventory: manglende påkrevd kolonne gir forklarende feil', () => {
  const text = 'Vintage,Wine,Size\n2017,"Vin A",750ml\n'
  assert.throws(() => parseInventory(text), /iWine/)
})

test('parseInventory: kolonnenavn matches case-insensitivt', () => {
  const text = 'IWINE,VINTAGE,WINE,SIZE,QTY\n111,2017,"Vin A",750ml,2\n'
  const { wines } = parseInventory(text)
  assert.equal(wines[0].expectedQty, 2)
})

test('normalizeEan og eanLookupKeys: EAN-8/UPC-A/EAN-13, UPC↔EAN-varianter', () => {
  assert.equal(normalizeEan(' 3760052440123 '), '3760052440123')
  assert.equal(normalizeEan('12345678'), '12345678')       // EAN-8
  assert.equal(normalizeEan('012345678905'), '012345678905') // UPC-A
  assert.equal(normalizeEan('123'), '')                     // ugyldig
  assert.deepEqual(eanLookupKeys('012345678905'), ['012345678905', '0012345678905'])
  assert.deepEqual(eanLookupKeys('0123456789012'), ['0123456789012', '123456789012'])
})

function makeSession(wines: WineRow[], eanMap: Session['eanMap'] = {}): Session {
  return { startedAt: '2026-01-01T18:00:00Z', inventoryFileName: 'test.csv', wines, eanMap, scans: [] }
}

function wine(over: Partial<WineRow>): WineRow {
  return {
    key: '1', iWine: '1', vintage: '2017', wine: 'Vin', producer: 'P', size: '750ml',
    expectedQty: 1, countedQty: 0, knownEans: [], ...over,
  }
}

test('buildResultCsv: statuser, diff, BOM og quoting', () => {
  const s = makeSession([
    wine({ key: '1', iWine: '1', expectedQty: 3, countedQty: 3, wine: 'Vin "A", cuvée' }),
    wine({ key: '2', iWine: '2', expectedQty: 3, countedQty: 2 }),
    wine({ key: '3', iWine: '3', expectedQty: 2, countedQty: 4 }),
    wine({ key: '4', iWine: '4', expectedQty: 2, countedQty: 0 }),
    wine({ key: 'local-1', iWine: '', expectedQty: 0, countedQty: 1, notInCt: true }),
  ])
  const csv = buildResultCsv(s)
  assert.ok(csv.startsWith('\uFEFF'))
  const lines = csv.slice(1).trimEnd().split('\r\n')
  assert.equal(lines[0], 'iWine,Vintage,Wine,Size,ExpectedQty,CountedQty,Diff,Status')
  assert.ok(lines[1].includes('"Vin ""A"", cuvée"'))
  assert.ok(lines[1].endsWith('3,3,0,OK'))
  assert.ok(lines[2].endsWith('3,2,-1,MANGLER'))
  assert.ok(lines[3].endsWith('2,4,2,OVERTALL'))
  assert.ok(lines[4].endsWith('2,0,-2,IKKE_SKANNET'))
  assert.ok(lines[5].startsWith(','))
  assert.ok(lines[5].endsWith('0,1,1,IKKE_I_CT'))
})

test('EAN-koblingsfil: eksport og reimport er konsistente', () => {
  const s = makeSession(
    [
      wine({ key: '111', iWine: '111', vintage: '2017' }),
      wine({ key: '222', iWine: '222', vintage: '2018' }),
      wine({ key: 'local-1', iWine: '', notInCt: true }),
    ],
    { '3760052440123': ['111', '222'], '7031234567890': ['local-1'] },
  )
  const csv = buildEanMapCsv(s)
  // Viner uten iWine (IKKE_I_CT) skal ikke med i koblingsfilen:
  assert.ok(!csv.includes('7031234567890'))
  const map = parseEanMapFile(csv)
  assert.deepEqual(map, { '3760052440123': ['111', '222'] })
})
