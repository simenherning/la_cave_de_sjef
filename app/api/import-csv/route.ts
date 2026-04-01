import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { parseCSV } from '@/lib/csv-parser'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

    const text = await file.text()
    const wines = parseCSV(text)
    if (wines.length === 0) return NextResponse.json({ error: 'No wines parsed' }, { status: 400 })

    const supabase = createServerClient()

    // Deduplicate by iwine_id (keep last occurrence)
    const seenIds = new Map<string, typeof wines[number]>()
    for (const w of wines) {
      if (w.iwine_id) seenIds.set(w.iwine_id, w)
    }
    const withId = Array.from(seenIds.values())
    const withoutId = wines.filter(w => !w.iwine_id)

    let inserted = 0
    let updated = 0

    if (withId.length > 0) {
      const { data, error } = await supabase
        .from('wines')
        .upsert(withId as Record<string, unknown>[], { onConflict: 'iwine_id', ignoreDuplicates: false })
        .select('id')
      if (error) throw error
      updated = data?.length ?? 0
    }

    if (withoutId.length > 0) {
      const { data, error } = await supabase.from('wines').insert(withoutId as Record<string, unknown>[]).select('id')
      if (error) throw error
      inserted = data?.length ?? 0
    }

    return NextResponse.json({ success: true, parsed: wines.length, upserted: updated, inserted })
  } catch (err) {
    console.error(err)
    const message = err instanceof Error ? err.message : JSON.stringify(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
