'use client'
import Link from 'next/link'
import type { Wine } from '@/lib/types'
import WineColorDot from './WineColorDot'

const CURRENT_YEAR = new Date().getFullYear()

function StatCard({ label, value, sub, href }: { label: string; value: string | number; sub?: string; href?: string }) {
  const inner = (
    <div className="card" style={{ padding: '20px 24px', cursor: href ? 'pointer' : 'default', transition: 'opacity 0.15s' }}
      onMouseEnter={e => { if (href) e.currentTarget.style.opacity = '0.8' }}
      onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}>
      <div style={{ color: 'var(--text-muted)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 600, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4, fontStyle: 'italic' }}>{sub}</div>}
    </div>
  )
  return href ? <Link href={href} style={{ textDecoration: 'none', color: 'inherit' }}>{inner}</Link> : inner
}

function BarChart({ data, title, paramKey }: { data: [string, number][]; title: string; paramKey: string }) {
  const max = Math.max(...data.map(d => d[1]), 1)
  return (
    <div className="card" style={{ padding: 24 }}>
      <h3 style={{ marginBottom: 20, fontSize: 15, fontWeight: 600 }}>{title}</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {data.slice(0, 12).map(([label, count]) => (
          <Link key={label} href={`/?${paramKey}=${encodeURIComponent(label)}`} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: 12 }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.75'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
            <div style={{ width: 140, fontSize: 13, textAlign: 'right', color: 'var(--text-muted)', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
            <div style={{ flex: 1, background: 'var(--bg)', borderRadius: 4, overflow: 'hidden', height: 20 }}>
              <div style={{
                width: `${(count / max) * 100}%`,
                height: '100%',
                background: 'var(--accent)',
                borderRadius: 4,
                transition: 'width 0.3s',
                display: 'flex',
                alignItems: 'center',
                paddingLeft: 8,
              }}>
                <span style={{ fontSize: 11, color: 'var(--accent-fg)', fontWeight: 600, whiteSpace: 'nowrap' }}>{count}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

export default function StatsView({ wines }: { wines: Wine[] }) {
  const total = wines.reduce((s, w) => s + w.quantity, 0)
  // estimated_value er per flaske (CTs Value/Valuation-kolonner) — gang med antall.
  const totalValue = wines.reduce((s, w) => s + (w.estimated_value ?? 0) * w.quantity, 0)
  const avgScore = wines.filter(w => w.community_score).reduce((s, w, _, a) => s + (w.community_score ?? 0) / a.length, 0)

  const drinkNow = wines.filter(w => w.begin_consume && w.end_consume && CURRENT_YEAR >= w.begin_consume && CURRENT_YEAR <= w.end_consume).reduce((s, w) => s + w.quantity, 0)
  const drinkSoon = wines.filter(w => w.begin_consume && w.end_consume && CURRENT_YEAR < w.begin_consume && w.begin_consume - CURRENT_YEAR <= 3).reduce((s, w) => s + w.quantity, 0)
  const hold = wines.filter(w => w.begin_consume && CURRENT_YEAR < w.begin_consume && (w.begin_consume - CURRENT_YEAR) > 3).reduce((s, w) => s + w.quantity, 0)
  const pastWindow = wines.filter(w => w.end_consume && CURRENT_YEAR > w.end_consume).reduce((s, w) => s + w.quantity, 0)

  const fmt = (n: number) => new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 }).format(n)

  // Aggregations (by bottle count)
  function agg(key: keyof Wine): [string, number][] {
    const map: Record<string, number> = {}
    wines.forEach(w => {
      const val = (w[key] as string) || 'Ukjent'
      map[val] = (map[val] ?? 0) + w.quantity
    })
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }

  const byColor = agg('color')
  const byCountry = agg('country')
  const byRegion = agg('region')
  const byVarietal = agg('master_varietal')

  // Vintage distribution
  const vintageMap: Record<string, number> = {}
  wines.forEach(w => {
    if (w.vintage) {
      const decade = `${Math.floor(w.vintage / 10) * 10}s`
      vintageMap[decade] = (vintageMap[decade] ?? 0) + w.quantity
    }
  })
  const vintageData = Object.entries(vintageMap).sort((a, b) => a[0].localeCompare(b[0]))

  return (
    <div>
      <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 24 }}>Statistikk</h1>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 32 }}>
        <StatCard label="Totalt flasker" value={fmt(total)} />
        <StatCard label="Estimert verdi" value={`NOK ${fmt(totalValue)}`} />
        <StatCard label="Snitt community-score" value={avgScore ? avgScore.toFixed(1) : '—'} />
        <StatCard label="Klare å drikke" value={drinkNow} sub="innenfor drikkevindu" href="/?status=drink-now" />
        <StatCard label="Drikk snart" value={drinkSoon} sub="klar innen 3 år" href="/?status=drink-soon" />
        <StatCard label="Legg bort" value={hold} sub="ikke klar ennå" href="/?status=hold" />
        <StatCard label="Passert vindu" value={pastWindow} sub="bør drikkes" href="/?status=past-window" />
      </div>

      {/* Color breakdown */}
      <div className="card" style={{ padding: 24, marginBottom: 24 }}>
        <h3 style={{ marginBottom: 16, fontSize: 15, fontWeight: 600 }}>Farge</h3>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          {byColor.map(([color, count]) => (
            <Link key={color} href={`/?color=${encodeURIComponent(color)}`} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: 8 }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.75'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
              <WineColorDot color={color} />
              <span style={{ fontSize: 14 }}>{color}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{count} fl.</span>
              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>({Math.round(count / total * 100)}%)</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Charts grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
        <BarChart data={byCountry} title="Land" paramKey="country" />
        <BarChart data={byRegion.filter(([k]) => k !== 'Ukjent')} title="Region" paramKey="region" />
        <BarChart data={byVarietal.filter(([k]) => k !== 'Ukjent')} title="Druesort" paramKey="varietal" />
        <BarChart data={vintageData} title="Årgangsdekade" paramKey="decade" />
      </div>
    </div>
  )
}
