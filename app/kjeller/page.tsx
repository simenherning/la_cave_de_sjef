import { supabase } from '@/lib/supabase'
import WineInventory from '@/components/WineInventory'
import type { Wine } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function KjellerPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>
}) {
  const { data: wines, error } = await supabase
    .from('wines')
    .select('*')
    .order('producer', { ascending: true })

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

  const params = await searchParams
  return (
    <WineInventory
      wines={(wines ?? []) as Wine[]}
      initialStatus={params.status}
      initialColor={params.color}
      initialCountry={params.country}
      initialRegion={params.region}
      initialVarietal={params.varietal}
      initialDecade={params.decade}
    />
  )
}
