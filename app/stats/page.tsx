import { supabase } from '@/lib/supabase'
import type { Wine } from '@/lib/types'
import StatsView from '@/components/StatsView'

export const dynamic = 'force-dynamic'

export default async function StatsPage() {
  const { data: wines } = await supabase
    .from('wines')
    .select('*')
    .gt('quantity', 0)

  return <StatsView wines={(wines ?? []) as Wine[]} />
}
