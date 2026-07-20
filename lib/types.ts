export type WineColor = 'Red' | 'White' | 'Rosé' | 'Other'
export type WineCategory = 'Dry' | 'Sparkling' | 'Sweet' | 'Fortified' | 'Distilled'

export interface Wine {
  id: number
  iwine_id: string | null
  upc: string | null
  type: string | null
  color: string | null
  category: string | null
  size: string | null
  vintage: number | null
  name: string
  locale: string | null
  producer: string | null
  varietal: string | null
  master_varietal: string | null
  designation: string | null
  vineyard: string | null
  country: string | null
  region: string | null
  sub_region: string | null
  appellation: string | null
  quantity: number
  pending: number
  purchase_price: number | null
  estimated_value: number | null
  currency: string
  begin_consume: number | null
  end_consume: number | null
  window_source: string | null
  community_score: number | null
  community_notes: string | null
  personal_score: number | null
  personal_notes: string | null
  wa_score: number | null
  iwc_score: number | null
  ws_score: number | null
  we_score: number | null
  br_score: number | null
  gv_score: number | null
  lf_score: number | null
  jg_score: number | null
  created_at: string
  updated_at: string
  tasting_notes?: TastingNote[]
}

export interface TastingNote {
  id: number
  wine_id: number
  date_tasted: string
  score: number | null
  notes: string | null
  food_pairing: string | null
  created_at: string
}

export interface ExternalNote {
  id: number
  wine_id: number
  source: string
  source_url: string | null
  author: string | null
  note_date: string | null
  score: string | null
  note: string | null
  drink_from: number | null
  drink_to: number | null
  food_pairing: string | null
  created_at: string
}

export interface CellarTarget {
  id: number
  label: string
  filter_key: string
  filter_value: string
  target_quantity: number
  created_at: string
}

export interface CellarStats {
  total_bottles: number
  total_value: number
  by_color: Record<string, number>
  by_country: Record<string, number>
  by_region: Record<string, number>
  by_varietal: Record<string, number>
  vintage_distribution: Record<string, number>
  drink_now: number
  drink_soon: number // within 2 years
  hold: number
  past_window: number
}
