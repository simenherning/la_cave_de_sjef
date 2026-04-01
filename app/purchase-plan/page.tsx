import { supabase } from '@/lib/supabase'
import type { Wine, CellarTarget } from '@/lib/types'
import PurchasePlanView from '@/components/PurchasePlanView'

export const dynamic = 'force-dynamic'

export default async function PurchasePlanPage() {
  const [{ data: wines }, { data: targets }] = await Promise.all([
    supabase.from('wines').select('*').gt('quantity', 0),
    supabase.from('cellar_targets').select('*').order('label'),
  ])

  return (
    <PurchasePlanView
      wines={(wines ?? []) as Wine[]}
      targets={(targets ?? []) as CellarTarget[]}
    />
  )
}
