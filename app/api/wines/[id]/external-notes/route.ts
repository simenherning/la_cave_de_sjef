import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

// Innhentede notater fra eksterne kilder (CT, Vivino, kritikere …).
// POST brukes av research-agenter; feltene matcher external_notes-tabellen.

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('external_notes')
    .select('*')
    .eq('wine_id', parseInt(id))
    .order('note_date', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  if (!body.source) return NextResponse.json({ error: 'source er påkrevd' }, { status: 400 })
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('external_notes')
    .insert({ ...body, wine_id: parseInt(id) })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(req: NextRequest) {
  const noteId = req.nextUrl.searchParams.get('noteId')
  if (!noteId) return NextResponse.json({ error: 'Missing noteId' }, { status: 400 })
  const supabase = createServerClient()
  const { error } = await supabase.from('external_notes').delete().eq('id', noteId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
