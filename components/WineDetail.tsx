'use client'
import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Plus, Trash2, Star } from 'lucide-react'
import type { Wine, TastingNote, ExternalNote } from '@/lib/types'
import WineColorDot from './WineColorDot'

const CURRENT_YEAR = new Date().getFullYear()

function Row({ label, value }: { label: string; value?: string | number | null }) {
  if (!value && value !== 0) return null
  return (
    <div style={{ display: 'flex', gap: 16, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
      <div className="info-label" style={{ color: 'var(--text-muted)', fontSize: 13, flexShrink: 0 }}>{label}</div>
      <div style={{ fontSize: 14 }}>{value}</div>
    </div>
  )
}

function ScoreBadge({ score, label }: { score?: number | null; label: string }) {
  if (!score) return null
  return (
    <div style={{ textAlign: 'center', padding: '12px 16px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 600, color: score >= 92 ? 'var(--accent)' : 'var(--text)' }}>{Math.round(score)}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
    </div>
  )
}

export default function WineDetail({ wine, notes: initialNotes, externalNotes }: { wine: Wine; notes: TastingNote[]; externalNotes: ExternalNote[] }) {
  const [notes, setNotes] = useState(initialNotes)
  const [showForm, setShowForm] = useState(false)
  const [noteDate, setNoteDate] = useState(new Date().toISOString().split('T')[0])
  const [noteScore, setNoteScore] = useState('')
  const [noteText, setNoteText] = useState('')
  const [noteFood, setNoteFood] = useState('')
  const [saving, setSaving] = useState(false)

  async function addNote() {
    setSaving(true)
    const res = await fetch(`/api/wines/${wine.id}/tasting-notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date_tasted: noteDate,
        score: noteScore ? parseInt(noteScore) : null,
        notes: noteText || null,
        food_pairing: noteFood || null,
      }),
    })
    if (res.ok) {
      const { data } = await res.json()
      setNotes(prev => [data, ...prev])
      setNoteText(''); setNoteScore(''); setNoteFood(''); setShowForm(false)
    }
    setSaving(false)
  }

  async function deleteNote(id: number) {
    await fetch(`/api/wines/${wine.id}/tasting-notes?noteId=${id}`, { method: 'DELETE' })
    setNotes(prev => prev.filter(n => n.id !== id))
  }

  const inWindow = wine.begin_consume && wine.end_consume
    ? CURRENT_YEAR >= wine.begin_consume && CURRENT_YEAR <= wine.end_consume
    : null

  return (
    <div>
      <Link href="/kjeller" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', textDecoration: 'none', fontSize: 14, marginBottom: 24 }}>
        <ArrowLeft size={14} /> Tilbake til kjelleren
      </Link>

      <div className="detail-grid">
        {/* Main info */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <WineColorDot color={wine.color} />
            <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>
              {wine.type} · {wine.appellation ?? wine.region ?? wine.country}
            </span>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4, lineHeight: 1.3 }}>{wine.name}</h1>
          {wine.producer && <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>{wine.producer}</p>}

          {/* Wine window status */}
          {wine.begin_consume && wine.end_consume && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              borderRadius: 8,
              background: inWindow ? 'var(--status-now-bg)' : CURRENT_YEAR < wine.begin_consume ? 'var(--status-hold-bg)' : 'var(--status-past-bg)',
              border: '1px solid var(--border)',
              marginBottom: 24,
              fontSize: 14,
            }}>
              <span style={{ color: inWindow ? 'var(--status-now)' : CURRENT_YEAR < wine.begin_consume ? 'var(--status-hold)' : 'var(--status-past)' }}>
                {inWindow ? 'Innenfor drikkevindu' : CURRENT_YEAR < wine.begin_consume ? `Åpne fra ${wine.begin_consume}` : 'Passert optimalt vindu'}
              </span>
              <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                {wine.begin_consume}–{wine.end_consume}
              </span>
            </div>
          )}

          {/* Details */}
          <div className="card" style={{ padding: 20, marginBottom: 24 }}>
            <Row label="Produsent" value={wine.producer} />
            <Row label="Vin" value={wine.name} />
            <Row label="Årgang" value={wine.vintage} />
            <Row label="Land" value={wine.country} />
            <Row label="Region" value={wine.region} />
            <Row label="Underregion" value={wine.sub_region} />
            <Row label="Appellation" value={wine.appellation} />
            <Row label="Vingård" value={wine.vineyard !== 'Unknown' ? wine.vineyard : null} />
            <Row label="Betegnelse" value={wine.designation !== 'Unknown' ? wine.designation : null} />
            <Row label="Druesort" value={wine.varietal} />
            <Row label="Størrelse" value={wine.size} />
            <Row label="Antall flasker" value={wine.quantity} />
            <Row label="Innkjøpspris" value={wine.purchase_price ? `NOK ${wine.purchase_price.toFixed(0)}` : null} />
            <Row label="Estimert verdi/fl." value={wine.estimated_value ? `NOK ${wine.estimated_value.toFixed(0)}` : null} />
          </div>

          {/* Personal notes */}
          {wine.personal_notes && (
            <div className="card" style={{ padding: 20, marginBottom: 24 }}>
              <h3 style={{ fontSize: 14, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Mine notater (CellarTracker)</h3>
              <p style={{ fontSize: 14, lineHeight: 1.7 }}>{wine.personal_notes}</p>
            </div>
          )}

          {/* Tasting notes */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 600 }}>Smaksnotater</h2>
              <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
                <Plus size={14} /> Legg til notat
              </button>
            </div>

            {showForm && (
              <div className="card" style={{ padding: 20, marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Dato</label>
                    <input type="date" value={noteDate} onChange={e => setNoteDate(e.target.value)} />
                  </div>
                  <div style={{ flex: '0 0 120px' }}>
                    <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Score (50–100)</label>
                    <input type="number" min={50} max={100} placeholder="93" value={noteScore} onChange={e => setNoteScore(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Notat</label>
                  <textarea rows={4} placeholder="Beskriv aromer, smak, ettersmak..." value={noteText} onChange={e => setNoteText(e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Matanbefaling</label>
                  <input placeholder="f.eks. Entrecôte, sopp, trøffel" value={noteFood} onChange={e => setNoteFood(e.target.value)} />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary" onClick={addNote} disabled={saving}>{saving ? 'Lagrer...' : 'Lagre'}</button>
                  <button className="btn btn-ghost" onClick={() => setShowForm(false)}>Avbryt</button>
                </div>
              </div>
            )}

            {notes.length === 0 ? (
              <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
                Ingen smaksnotater ennå
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {notes.map(note => (
                  <div key={note.id} className="card" style={{ padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{note.date_tasted}</span>
                        {note.score && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--accent)', fontWeight: 600 }}>
                            <Star size={12} fill="currentColor" /> {note.score}
                          </span>
                        )}
                      </div>
                      <button onClick={() => deleteNote(note.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                    {note.notes && <p style={{ fontSize: 14, lineHeight: 1.7, marginBottom: note.food_pairing ? 8 : 0 }}>{note.notes}</p>}
                    {note.food_pairing && (
                      <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Mat: {note.food_pairing}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Innhentede notater fra eksterne kilder (CT, kritikere, Vivino …) */}
          <div style={{ marginTop: 32 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }}>Innhentede notater</h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: 16 }}>
              Smaksnotater og omtaler samlet fra CellarTracker og andre kilder — grunnlag for
              drikkevindu, forventet smak og mat-match.
            </p>
            {externalNotes.length === 0 ? (
              <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                Ingen innhentede notater ennå
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {externalNotes.map(n => (
                  <div key={n.id} className="card" style={{ padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 6, flexWrap: 'wrap' }}>
                      <div style={{ fontWeight: 600, fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#a5623a' }}>
                        {n.source}{n.author ? ` · ${n.author}` : ''}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                        {n.note_date && <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{n.note_date}</span>}
                        {n.score && <span style={{ color: 'var(--accent)', fontWeight: 600, fontSize: 14 }}>{n.score}</span>}
                      </div>
                    </div>
                    {n.note && <p style={{ fontSize: 14, lineHeight: 1.7, marginBottom: 8 }}>{n.note}</p>}
                    {(n.drink_from || n.drink_to || n.food_pairing) && (
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {(n.drink_from || n.drink_to) && (
                          <span>Foreslått drikkevindu: {n.drink_from ?? '…'}–{n.drink_to ?? '…'}</span>
                        )}
                        {n.food_pairing && <span>Mat: {n.food_pairing}</span>}
                      </div>
                    )}
                    {n.source_url && (
                      <a href={n.source_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--sea)', textDecoration: 'none' }}>
                        Kilde ↗
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar: scores */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 14, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16 }}>Poengsummer</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <ScoreBadge score={wine.personal_score} label="Min score" />
              <ScoreBadge score={wine.community_score} label="Community" />
              <ScoreBadge score={wine.wa_score} label="Wine Advocate" />
              <ScoreBadge score={wine.ws_score} label="Wine Spectator" />
              <ScoreBadge score={wine.we_score} label="Wine Enthusiast" />
              <ScoreBadge score={wine.iwc_score} label="IWC" />
              <ScoreBadge score={wine.lf_score} label="Le Figaro" />
              <ScoreBadge score={wine.jg_score} label="J. Gilman" />
            </div>
            {!wine.personal_score && !wine.community_score && !wine.wa_score && !wine.ws_score && !wine.we_score && (
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Ingen poengsummer</p>
            )}
          </div>

          {wine.community_notes && (
            <div className="card" style={{ padding: 20 }}>
              <h3 style={{ fontSize: 14, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Community-notat</h3>
              <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text-muted)' }}>{wine.community_notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
