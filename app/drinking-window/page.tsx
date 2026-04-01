import { supabase } from '@/lib/supabase'
import type { Wine } from '@/lib/types'
import DrinkingWindowView from '@/components/DrinkingWindowView'

export const dynamic = 'force-dynamic'

export default async function DrinkingWindowPage() {
  const { data: wines } = await supabase
    .from('wines')
    .select('*')
    .gt('quantity', 0)
    .not('begin_consume', 'is', null)
    .not('end_consume', 'is', null)
    .order('begin_consume', { ascending: true })

  return <DrinkingWindowView wines={(wines ?? []) as Wine[]} />
}
