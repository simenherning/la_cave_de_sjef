import { supabase } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import type { Wine, TastingNote } from '@/lib/types'
import WineDetail from '@/components/WineDetail'

export const dynamic = 'force-dynamic'

export default async function WinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [{ data: wine }, { data: notes }] = await Promise.all([
    supabase.from('wines').select('*').eq('id', id).single(),
    supabase.from('tasting_notes').select('*').eq('wine_id', id).order('date_tasted', { ascending: false }),
  ])

  if (!wine) notFound()

  return <WineDetail wine={wine as Wine} notes={(notes ?? []) as TastingNote[]} />
}
