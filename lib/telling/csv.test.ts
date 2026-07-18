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

// CT har TO barcode-feller (verifisert mot ekte eksporter): "Barcode" er CTs
// per-flaske-ID (11 siffer), og "WineBarcode" (xlquery) er CTs vin-etikett på
// formen W<iWine>_<størrelse>. Ingen av dem er EAN — EAN ligger i "UPC".
test('Barcode og WineBarcode forveksles ALDRI med EAN — kun UPC brukes', () => {
  const text = [
    'iWine,Vintage,Wine,Size,Quantity,Barcode,WineBarcode,UPC',
    '3051601,2017,"Angerville Clos des Ducs",750ml,1,01413525841,W3051601_750ml,7070292956388',
    '3051601,2017,"Angerville Clos des Ducs",750ml,1,01413525842,W3051601_750ml,7070292956388',
  ].join('\r\n')
  const { wines, eanMap } = parseInventory(text)
  assert.equal(wines.length, 1)
  assert.deepEqual(wines[0].knownEans, ['7070292956388'])
  // Verken flaske-ID-ene eller W-koden skal finnes i EAN-oppslaget:
  assert.deepEqual(Object.keys(eanMap), ['7070292956388'])
  assert.ok(!('01413525841' in eanMap))
  assert.ok(!('1413525841' in eanMap))
  assert.ok(!('3051601750' in eanMap)) // sifrene fra W3051601_750ml
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

// Verifisert i denne kjelleren: CT gjenbruker samme iWine for 750ml og 1,5L.
test('parseInventory: samme iWine i to størrelser forblir to rader', () => {
  const text = [
    'iWine,Vintage,Wine,Size,Quantity',
    '5502380,2024,"Yvon Métras Beaujolais",750ml,3',
    '5502380,2024,"Yvon Métras Beaujolais",1.5L,2',
  ].join('\n')
  const { wines } = parseInventory(text)
  assert.equal(wines.length, 2)
  assert.deepEqual(wines.map(w => [w.key, w.size, w.expectedQty]), [
    ['5502380|750ml', '750ml', 3],
    ['5502380|1.5L', '1.5L', 2],
  ])
  assert.equal(wines.reduce((s, w) => s + w.expectedQty, 0), 5)
})

test('parseInventory: manglende påkrevd kolonne gir forklarende feil', () => {
  const text = 'iWine,Vintage,Wine\n111,2017,"Vin A"\n'
  assert.throws(() => parseInventory(text), /Size/)
})

test('parseInventory: uten iWine-kolonne brukes vintage|wine|size som nøkkel', () => {
  const text = [
    'Vintage,Wine,Size,Quantity',
    '2017,"Vin A",750ml,1',
    '2017,"Vin A",750ml,2',
    '2018,"Vin A",750ml,1',
    '2017,"Vin A",1.5L,1',
  ].join('\n')
  const { wines, warnings } = parseInventory(text)
  assert.ok(warnings.some(w => w.includes('iWine-kolonnen mangler')))
  assert.equal(wines.length, 3) // 2017/750ml, 2018/750ml, 2017/1.5L
  const w2017 = wines.find(w => w.vintage === '2017' && w.size === '750ml')!
  assert.equal(w2017.expectedQty, 3)
  assert.equal(w2017.iWine, '')
  assert.equal(w2017.key, '2017|vin a|750ml')
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

test('mapDbWines: wines-tabellen mappes til tellingens datamodell', async () => {
  const { mapDbWines } = await import('./inventory.ts')
  const rows = mapDbWines([
    { id: 1, iwine_id: '3051601', vintage: 2017, name: 'Clos des Ducs', producer: 'Angerville', size: '750ml', quantity: 3, upc: '7070292956388' },
    { id: 2, iwine_id: null, vintage: null, name: 'Massandra', producer: null, size: null, quantity: 1, upc: null },
    { id: 3, iwine_id: '999', vintage: 2020, name: 'Tom', producer: null, size: '750ml', quantity: 0, upc: null },
    { id: 4, iwine_id: '888', vintage: 2021, name: 'Rar UPC', producer: null, size: '750ml', quantity: 1, upc: 'W888_750ml' },
  ])
  assert.equal(rows.length, 3) // quantity 0 filtreres bort
  assert.deepEqual(rows[0], {
    key: '3051601|750ml', iWine: '3051601', vintage: '2017', wine: 'Clos des Ducs',
    producer: 'Angerville', size: '750ml', expectedQty: 3, countedQty: 0, knownEans: ['7070292956388'],
  })
  assert.equal(rows[1].key, 'db-2')
  assert.equal(rows[1].iWine, '')
  assert.deepEqual(rows[2].knownEans, []) // ugyldig UPC-verdi filtreres
})

test('mergeLearnedEans: lærte koblinger flettes inn på (iWine, størrelse)', async () => {
  const { mapDbWines, mergeLearnedEans } = await import('./inventory.ts')
  const rows = mapDbWines([
    { id: 1, iwine_id: '111', vintage: 2017, name: 'Vin A', producer: 'P', size: '750ml', quantity: 3, upc: '7070292956388' },
    { id: 2, iwine_id: '111', vintage: 2017, name: 'Vin A', producer: 'P', size: '1.5L', quantity: 1, upc: null },
    { id: 3, iwine_id: '222', vintage: 2018, name: 'Vin B', producer: 'P', size: '750ml', quantity: 2, upc: null },
  ])
  mergeLearnedEans(rows, [
    { ean: '7031234567890', iwine_id: '111', size: '1.5L' },   // treffer kun magnum
    { ean: '7039999999999', iwine_id: '222', size: '' },       // tom size → alle størrelser
    { ean: '7070292956388', iwine_id: '111', size: '750ml' },  // duplikat av CT-UPC → ikke dobbelt
    { ean: 'ugyldig', iwine_id: '222', size: '750ml' },        // ugyldig EAN ignoreres
  ])
  assert.deepEqual(rows[0].knownEans, ['7070292956388'])
  assert.deepEqual(rows[1].knownEans, ['7031234567890'])
  assert.deepEqual(rows[2].knownEans, ['7039999999999'])
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
