'use client'
import { useState } from 'react'
import Link from 'next/link'
import type { Wine } from '@/lib/types'
import WineColorDot from './WineColorDot'

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 20 }, (_, i) => CURRENT_YEAR - 2 + i)

function windowStatus(wine: Wine, year: number): 'before' | 'peak' | 'after' | 'none' {
  if (!wine.begin_consume || !wine.end_consume) return 'none'
  if (year < wine.begin_consume) return 'before'
  if (year > wine.end_consume) return 'after'
  return 'peak'
}

const statusColors: Record<string, string> = {
  before: '#2a3a4a',
  peak: 'var(--accent)',
  after: '#3a2a2a',
  none: 'transparent',
}

type Tab = 'timeline' | 'list'

export default function DrinkingWindowView({ wines }: { wines: Wine[] }) {
  const [tab, setTab] = useState<Tab>('timeline')
  const [filter, setFilter] = useState<'alle' | 'nå' | 'snart' | 'vent' | 'passert'>('alle')

  const categorized = wines.map(w => {
    const s = windowStatus(w, CURRENT_YEAR)
    let category: string
    if (!w.begin_consume || !w.end_consume) category = 'ukjent'
    else if (CURRENT_YEAR > w.end_consume) category = 'passert'
    else if (CURRENT_YEAR >= w.begin_consume) category = 'nå'
    else if (w.begin_consume - CURRENT_YEAR <= 3) category = 'snart'
    else category = 'vent'
    return { wine: w, category }
  })

  const filtered = filter === 'alle' ? categorized : categorized.filter(c => c.category === filter)

  const counts = {
    nå: categorized.filter(c => c.category === 'nå').reduce((s, c) => s + c.wine.quantity, 0),
    snart: categorized.filter(c => c.category === 'snart').reduce((s, c) => s + c.wine.quantity, 0),
    vent: categorized.filter(c => c.category === 'vent').reduce((s, c) => s + c.wine.quantity, 0),
    passert: categorized.filter(c => c.category === 'passert').reduce((s, c) => s + c.wine.quantity, 0),
  }

  return (
    <div>
      <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 8 }}>Drikkevindu</h1>
      <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 24, fontFamily: 'sans-serif' }}>
        Planlegg når du skal drikke hva
      </p>

      {/* Summary pills */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
        {[
          { key: 'alle', label: 'Alle', color: 'var(--text-muted)' },
          { key: 'nå', label: `Drikk nå (${counts.nå} fl.)`, color: '#5a9b5a' },
          { key: 'snart', label: `Snart (${counts.snart} fl.)`, color: '#c4803a' },
          { key: 'vent', label: `Vent (${counts.vent} fl.)`, color: '#6b9eb5' },
          { key: 'passert', label: `Passert (${counts.passert} fl.)`, color: '#9b3a3a' },
        ].map(({ key, label, color }) => (
          <button
            key={key}
            onClick={() => setFilter(key as typeof filter)}
            style={{
              padding: '6px 14px',
              borderRadius: 20,
              border: `1px solid ${filter === key ? color : 'var(--border)'}`,
              background: filter === key ? color + '22' : 'transparent',
              color: filter === key ? color : 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: 13,
              fontFamily: 'sans-serif',
              transition: 'all 0.15s',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab toggle */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 20, background: 'var(--bg-card)', borderRadius: 8, padding: 4, width: 'fit-content', border: '1px solid var(--border)' }}>
        {(['timeline', 'list'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '6px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, fontFamily: 'sans-serif',
              background: tab === t ? 'var(--accent)' : 'transparent',
              color: tab === t ? '#0f0e0c' : 'var(--text-muted)',
              fontWeight: tab === t ? 600 : 400,
            }}
          >
            {t === 'timeline' ? 'Tidslinje' : 'Liste'}
          </button>
        ))}
      </div>

      {tab === 'timeline' ? (
        <TimelineView wines={filtered.map(c => c.wine)} />
      ) : (
        <ListView items={filtered} />
      )}
    </div>
  )
}

function TimelineView({ wines }: { wines: Wine[] }) {
  return (
    <div className="card" style={{ overflowX: 'auto' }}>
      <table style={{ minWidth: 900 }}>
        <thead>
          <tr>
            <th style={{ width: 280 }}>Vin</th>
            {YEARS.map(y => (
              <th key={y} style={{ textAlign: 'center', width: 40, padding: '8px 2px', fontFamily: 'sans-serif', fontSize: 11 }}>
                <span style={{ color: y === CURRENT_YEAR ? 'var(--accent)' : 'var(--text-muted)', fontWeight: y === CURRENT_YEAR ? 700 : 400 }}>
                  {y}
                </span>
              </th>
            ))}
            <th style={{ textAlign: 'center', width: 40 }}>Ant</th>
          </tr>
        </thead>
        <tbody>
          {wines.map(wine => (
            <tr key={wine.id}>
              <td>
                <Link href={`/wines/${wine.id}`} style={{ textDecoration: 'none', color: 'var(--text)', display: 'flex', alignItems: 'center' }}>
                  <WineColorDot color={wine.color} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{wine.producer}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{wine.name.replace(wine.producer ?? '', '').trim()} {wine.vintage ? `'${String(wine.vintage).slice(-2)}` : ''}</div>
                  </div>
                </Link>
              </td>
              {YEARS.map(y => {
                const s = windowStatus(wine, y)
                return (
                  <td key={y} style={{ padding: '8px 2px', textAlign: 'center' }}>
                    {s !== 'none' && (
                      <div style={{
                        width: 28, height: 18, borderRadius: 3, margin: '0 auto',
                        background: statusColors[s],
                        border: y === CURRENT_YEAR ? '1px solid var(--accent)44' : 'none',
                      }} />
                    )}
                  </td>
                )
              })}
              <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'sans-serif', fontSize: 13 }}>{wine.quantity}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {wines.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Ingen viner i dette filteret</div>
      )}
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 20, fontSize: 12, color: 'var(--text-muted)', fontFamily: 'sans-serif' }}>
        <span><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 2, background: statusColors.before, marginRight: 4, verticalAlign: 'middle' }} />Ikke klar</span>
        <span><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 2, background: statusColors.peak, marginRight: 4, verticalAlign: 'middle' }} />Drikkevindu</span>
        <span><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 2, background: statusColors.after, marginRight: 4, verticalAlign: 'middle' }} />Passert</span>
      </div>
    </div>
  )
}

function ListView({ items }: { items: { wine: Wine; category: string }[] }) {
  const catLabel: Record<string, { label: string; color: string }> = {
    nå: { label: 'Drikk nå', color: '#5a9b5a' },
    snart: { label: 'Klar snart', color: '#c4803a' },
    vent: { label: 'Legg bort', color: '#6b9eb5' },
    passert: { label: 'Passert vindu', color: '#9b3a3a' },
    ukjent: { label: 'Ukjent', color: 'var(--text-muted)' },
  }

  return (
    <div className="card">
      <table>
        <thead>
          <tr>
            <th>Vin</th>
            <th>Produsent</th>
            <th>Åg</th>
            <th>Drikkevindu</th>
            <th style={{ textAlign: 'center' }}>Ant</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {items.map(({ wine, category }) => {
            const cat = catLabel[category] ?? catLabel.ukjent
            return (
              <tr key={wine.id}>
                <td>
                  <Link href={`/wines/${wine.id}`} style={{ textDecoration: 'none', color: 'var(--text)', display: 'flex', alignItems: 'center' }}>
                    <WineColorDot color={wine.color} />
                    <span style={{ fontSize: 13 }}>{wine.name}</span>
                  </Link>
                </td>
                <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{wine.producer}</td>
                <td style={{ color: 'var(--text-muted)' }}>{wine.vintage ?? '—'}</td>
                <td style={{ fontFamily: 'sans-serif', fontSize: 13, color: 'var(--text-muted)' }}>
                  {wine.begin_consume && wine.end_consume ? `${wine.begin_consume}–${wine.end_consume}` : '—'}
                </td>
                <td style={{ textAlign: 'center' }}>{wine.quantity}</td>
                <td><span style={{ fontSize: 12, color: cat.color, fontFamily: 'sans-serif' }}>{cat.label}</span></td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {items.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Ingen viner i dette filteret</div>
      )}
    </div>
  )
}
