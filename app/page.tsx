import { supabase } from '@/lib/supabase'
import Recommender from '@/components/Recommender'
import type { Wine } from '@/lib/types'
import type { RecoWine } from '@/lib/reco'

export const dynamic = 'force-dynamic'

// Parser innhentede scorer som «93/100» eller «17/20» til 100-skala
function parseScore(s: string | null): number | null {
  if (!s) return null
  const m = s.match(/^(\d+(?:[.,]\d+)?)\s*\/\s*(\d+)/)
  if (!m) return null
  const val = parseFloat(m[1].replace(',', '.'))
  const scale = parseInt(m[2], 10)
  if (scale === 100) return val
  if (scale === 20) return 76 + val // grov WFW-konvertering: 17/20 ≈ 93
  return null
}

export default async function HomePage() {
  const [{ data: wines, error }, { data: notes }] = await Promise.all([
    supabase.from('wines').select('*').gt('quantity', 0),
    supabase
      .from('external_notes')
      .select('wine_id,score,food_pairing')
      .limit(3000),
  ])

  if (error) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <p style={{ color: 'var(--text-muted)' }}>
          Kunne ikke laste kjelleren. Sjekk at Supabase er konfigurert.
        </p>
        <pre style={{ color: '#9b3a3a', fontSize: 12, marginTop: 12 }}>{error.message}</pre>
      </div>
    )
  }

  // Aggreger innhentede notater per vin: snittscore + matforslag
  const scoreSum = new Map<number, { sum: number; n: number }>()
  const pairings = new Map<number, string[]>()
  for (const note of notes ?? []) {
    const s = parseScore(note.score)
    if (s != null) {
      const acc = scoreSum.get(note.wine_id) ?? { sum: 0, n: 0 }
      acc.sum += s; acc.n += 1
      scoreSum.set(note.wine_id, acc)
    }
    if (note.food_pairing) {
      const list = pairings.get(note.wine_id) ?? []
      if (!list.includes(note.food_pairing)) list.push(note.food_pairing)
      pairings.set(note.wine_id, list)
    }
  }

  const recoWines: RecoWine[] = ((wines ?? []) as Wine[]).map(w => {
    const ext = scoreSum.get(w.id)
    return {
      id: w.id,
      name: w.name,
      producer: w.producer,
      vintage: w.vintage,
      size: w.size,
      color: w.color,
      category: w.category,
      varietal: w.master_varietal ?? w.varietal,
      country: w.country,
      region: w.region,
      appellation: w.appellation,
      quantity: w.quantity,
      purchase_price: w.purchase_price,
      estimated_value: w.estimated_value,
      begin_consume: w.begin_consume,
      end_consume: w.end_consume,
      score: w.personal_score ?? w.community_score ?? (ext ? ext.sum / ext.n : null),
      food_pairings: pairings.get(w.id) ?? [],
    }
  })

  return <Recommender wines={recoWines} />
}
