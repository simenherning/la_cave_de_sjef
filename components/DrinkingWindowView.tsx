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

// Varme rivieratoner: før-vindu = sand, i vindu = terrakotta, etter = falmet rosa
const statusColors: Record<string, string> = {
  before: '#cdbfa4',
  peak: 'var(--accent)',
  after: '#d8bfae',
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
      <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 24 }}>
        Planlegg når du skal drikke hva
      </p>

      {/* Summary pills */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
        {[
          { key: 'alle', label: 'Alle', color: 'var(--text)', bg: 'var(--bg-hover)' },
          { key: 'nå', label: `Drikk nå (${counts.nå} fl.)`, color: 'var(--status-now)', bg: 'var(--status-now-bg)' },
          { key: 'snart', label: `Snart (${counts.snart} fl.)`, color: 'var(--status-soon)', bg: 'var(--status-soon-bg)' },
          { key: 'vent', label: `Vent (${counts.vent} fl.)`, color: 'var(--status-hold)', bg: 'var(--status-hold-bg)' },
          { key: 'passert', label: `Passert (${counts.passert} fl.)`, color: 'var(--status-past)', bg: 'var(--status-past-bg)' },
        ].map(({ key, label, color, bg }) => (
          <button
            key={key}
            onClick={() => setFilter(key as typeof filter)}
            style={{
              padding: '6px 14px',
              borderRadius: 20,
              border: `1px solid ${filter === key ? color : 'var(--border)'}`,
              background: filter === key ? bg : 'transparent',
              color: filter === key ? color : 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: 13,
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
              padding: '6px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13,
              background: tab === t ? 'var(--accent)' : 'transparent',
              color: tab === t ? 'var(--accent-fg)' : 'var(--text-muted)',
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
              <th key={y} style={{ textAlign: 'center', width: 40, padding: '8px 2px', fontSize: 11 }}>
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
              <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>{wine.quantity}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {wines.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Ingen viner i dette filteret</div>
      )}
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 20, fontSize: 12, color: 'var(--text-muted)' }}>
        <span><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 2, background: statusColors.before, marginRight: 4, verticalAlign: 'middle' }} />Ikke klar</span>
        <span><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 2, background: statusColors.peak, marginRight: 4, verticalAlign: 'middle' }} />Drikkevindu</span>
        <span><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 2, background: statusColors.after, marginRight: 4, verticalAlign: 'middle' }} />Passert</span>
      </div>
    </div>
  )
}

function ListView({ items }: { items: { wine: Wine; category: string }[] }) {
  const catLabel: Record<string, { label: string; color: string }> = {
    nå: { label: 'Drikk nå', color: 'var(--status-now)' },
    snart: { label: 'Klar snart', color: 'var(--status-soon)' },
    vent: { label: 'Legg bort', color: 'var(--status-hold)' },
    passert: { label: 'Passert vindu', color: 'var(--status-past)' },
    ukjent: { label: 'Ukjent', color: 'var(--text-muted)' },
  }

  return (
    <div className="card">
      <table>
        <thead>
          <tr>
            <th>Vin</th>
            <th className="hide-mobile">Produsent</th>
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
                <td className="hide-mobile" style={{ color: 'var(--text-muted)', fontSize: 13 }}>{wine.producer}</td>
                <td style={{ color: 'var(--text-muted)' }}>{wine.vintage ?? '—'}</td>
                <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  {wine.begin_consume && wine.end_consume ? `${wine.begin_consume}–${wine.end_consume}` : '—'}
                </td>
                <td style={{ textAlign: 'center' }}>{wine.quantity}</td>
                <td><span style={{ fontSize: 12, color: cat.color }}>{cat.label}</span></td>
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
