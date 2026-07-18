import type { Wine } from './types'

function parseNum(val: string): number | null {
  if (!val || val.trim() === '' || val === '9999') return null
  // Handle Norwegian decimal format (comma as separator)
  const cleaned = val.replace(',', '.')
  const num = parseFloat(cleaned)
  return isNaN(num) ? null : num
}

function parseYear(val: string): number | null {
  if (!val || val.trim() === '' || val === '9999' || val === '1001') return null
  const year = parseInt(val, 10)
  if (isNaN(year) || year < 1800 || year > 2100) return null
  return year
}

export function parseCSVRow(headers: string[], values: string[]): Partial<Wine> | null {
  const row: Record<string, string> = {}
  headers.forEach((h, i) => {
    row[h] = (values[i] ?? '').replace(/^"|"$/g, '').trim()
  })

  if (!row['Wine']) return null

  return {
    iwine_id: row['iWine'] || null,
    // UPC (EAN) finnes bare i CTs klassiske eksport (xlquery). Utelat feltet
    // helt når kolonnen mangler, så en senere import fra den nye eksport-
    // dialogen ikke nuller ut lagrede EAN-er.
    ...('UPC' in row ? { upc: row['UPC'] || null } : {}),
    type: row['Type'] || null,
    color: row['Color'] || null,
    category: row['Category'] || null,
    size: row['Size'] || '750ml',
    vintage: parseYear(row['Vintage']),
    name: row['Wine'],
    locale: row['Locale'] || null,
    producer: row['Producer'] || null,
    varietal: row['Varietal'] || null,
    master_varietal: row['MasterVarietal'] || null,
    designation: row['Designation'] !== 'Unknown' ? row['Designation'] || null : null,
    vineyard: row['Vineyard'] !== 'Unknown' ? row['Vineyard'] || null : null,
    country: row['Country'] || null,
    region: row['Region'] !== 'Unknown' ? row['Region'] || null : null,
    sub_region: row['SubRegion'] !== 'Unknown' ? row['SubRegion'] || null : null,
    appellation: row['Appellation'] !== 'Unknown' ? row['Appellation'] || null : null,
    quantity: parseInt(row['Quantity'] || '0', 10) || 0,
    pending: parseInt(row['Pending'] || '0', 10) || 0,
    purchase_price: parseNum(row['Price']),
    // Grid-eksporten heter kolonnen "Value"; klassisk xlquery "Valuation".
    estimated_value: parseNum(row['Value'] ?? row['Valuation'] ?? ''),
    currency: row['Currency'] || 'NOK',
    begin_consume: parseYear(row['BeginConsume']),
    end_consume: parseYear(row['EndConsume']),
    window_source: row['WindowSource'] || null,
    // Grid: CScore/PScore; klassisk xlquery: CT/MY.
    community_score: parseNum(row['CScore'] ?? row['CT'] ?? ''),
    community_notes: row['CNotes'] || null,
    personal_score: parseNum(row['PScore'] ?? row['MY'] ?? ''),
    personal_notes: row['PNotes'] || null,
    wa_score: parseNum(row['WA']),
    iwc_score: parseNum(row['IWC']),
    ws_score: parseNum(row['WS']),
    we_score: parseNum(row['WE']),
    br_score: parseNum(row['BR']),
    gv_score: parseNum(row['GV']),
    lf_score: parseNum(row['LF']),
    jg_score: parseNum(row['JG']),
  }
}

export function parseCSV(csvText: string): Partial<Wine>[] {
  // CRLF-normalisering: uten denne beholder siste kolonne per linje '"\r',
  // så f.eks. headeren "UPC" blir 'UPC"' og aldri matcher.
  const lines = csvText.replace(/\r\n?/g, '\n').split('\n').filter(l => l.trim())
  if (lines.length < 2) return []

  // Parse header line
  const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim())

  const results: Partial<Wine>[] = []
  for (let i = 1; i < lines.length; i++) {
    // Simple CSV split (handles quoted fields)
    const values = splitCSVLine(lines[i])
    const wine = parseCSVRow(headers, values)
    if (wine) results.push(wine)
  }
  return results
}

function splitCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }
  result.push(current)
  return result
}
