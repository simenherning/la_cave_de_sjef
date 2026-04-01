'use client'
import type { Wine } from '@/lib/types'
import WineColorDot from './WineColorDot'

const CURRENT_YEAR = new Date().getFullYear()

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="card" style={{ padding: '20px 24px' }}>
      <div style={{ color: 'var(--text-muted)', fontSize: 12, fontFamily: 'sans-serif', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700 }}>{value}</div>
      {sub && <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4, fontFamily: 'sans-serif' }}>{sub}</div>}
    </div>
  )
}

function BarChart({ data, title }: { data: [string, number][]; title: string }) {
  const max = Math.max(...data.map(d => d[1]), 1)
  return (
    <div className="card" style={{ padding: 24 }}>
      <h3 style={{ marginBottom: 20, fontSize: 15, fontWeight: 600 }}>{title}</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {data.slice(0, 12).map(([label, count]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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
                <span style={{ fontSize: 11, color: '#0f0e0c', fontFamily: 'sans-serif', fontWeight: 600, whiteSpace: 'nowrap' }}>{count}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function StatsView({ wines }: { wines: Wine[] }) {
  const total = wines.reduce((s, w) => s + w.quantity, 0)
  const totalValue = wines.reduce((s, w) => s + (w.estimated_value ?? 0), 0)
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
        <StatCard label="Klare å drikke" value={drinkNow} sub="innenfor drikkevindu" />
        <StatCard label="Drikk snart" value={drinkSoon} sub="klar innen 3 år" />
        <StatCard label="Legg bort" value={hold} sub="ikke klar ennå" />
        <StatCard label="Passert vindu" value={pastWindow} sub="bør drikkes" />
      </div>

      {/* Color breakdown */}
      <div className="card" style={{ padding: 24, marginBottom: 24 }}>
        <h3 style={{ marginBottom: 16, fontSize: 15, fontWeight: 600 }}>Farge</h3>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          {byColor.map(([color, count]) => (
            <div key={color} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <WineColorDot color={color} />
              <span style={{ fontSize: 14 }}>{color}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: 13, fontFamily: 'sans-serif' }}>{count} fl.</span>
              <span style={{ color: 'var(--text-muted)', fontSize: 12, fontFamily: 'sans-serif' }}>({Math.round(count / total * 100)}%)</span>
            </div>
          ))}
        </div>
      </div>

      {/* Charts grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
        <BarChart data={byCountry} title="Land" />
        <BarChart data={byRegion.filter(([k]) => k !== 'Ukjent')} title="Region" />
        <BarChart data={byVarietal.filter(([k]) => k !== 'Ukjent')} title="Druesort" />
        <BarChart data={vintageData} title="Årgangsdekade" />
      </div>
    </div>
  )
}
