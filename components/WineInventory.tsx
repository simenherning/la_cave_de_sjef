'use client'
import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Search, Upload, X } from 'lucide-react'
import type { Wine } from '@/lib/types'
import WineColorDot from './WineColorDot'

const CURRENT_YEAR = new Date().getFullYear()

function drinkingStatus(wine: Wine): { label: string; color: string; key: string } {
  if (!wine.begin_consume || !wine.end_consume) return { label: '—', color: 'var(--text-muted)', key: '' }
  if (CURRENT_YEAR > wine.end_consume) return { label: 'Passert', color: '#9b3a3a', key: 'past-window' }
  if (CURRENT_YEAR < wine.begin_consume) {
    if (wine.begin_consume - CURRENT_YEAR <= 3) return { label: 'Drikk snart', color: '#c4803a', key: 'drink-soon' }
    return { label: 'Vent', color: '#6b9eb5', key: 'hold' }
  }
  const remaining = wine.end_consume - CURRENT_YEAR
  if (remaining <= 2) return { label: 'Drikk snart', color: '#c4803a', key: 'drink-soon' }
  return { label: 'Drikk nå', color: '#5a9b5a', key: 'drink-now' }
}

const STATUS_LABELS: Record<string, string> = {
  'drink-now': 'Klar å drikke',
  'drink-soon': 'Drikk snart',
  'hold': 'Legg bort',
  'past-window': 'Passert vindu',
}

interface Props {
  wines: Wine[]
  initialStatus?: string
  initialColor?: string
  initialCountry?: string
  initialRegion?: string
  initialVarietal?: string
  initialDecade?: string
}

export default function WineInventory({
  wines,
  initialStatus,
  initialColor,
  initialCountry,
  initialRegion,
  initialVarietal,
  initialDecade,
}: Props) {
  const [search, setSearch] = useState('')
  const [colorFilter, setColorFilter] = useState<string>(initialColor ?? 'alle')
  const [sortBy, setSortBy] = useState<string>('producer')
  const [dimFilter] = useState<{ country?: string; region?: string; varietal?: string; status?: string; decade?: string }>({
    country: initialCountry,
    region: initialRegion,
    varietal: initialVarietal,
    status: initialStatus,
    decade: initialDecade,
  })

  // Active filter label for the chip
  const activeFilterLabel = initialStatus
    ? STATUS_LABELS[initialStatus]
    : initialColor ? initialColor
    : initialCountry ? initialCountry
    : initialRegion ? initialRegion
    : initialVarietal ? initialVarietal
    : initialDecade ? initialDecade
    : null

  const filtered = useMemo(() => {
    let list = wines.filter(w => w.quantity > 0)

    if (search) {
      const q = search.toLowerCase()
      list = list.filter(w =>
        w.name.toLowerCase().includes(q) ||
        (w.producer ?? '').toLowerCase().includes(q) ||
        (w.region ?? '').toLowerCase().includes(q) ||
        (w.varietal ?? '').toLowerCase().includes(q) ||
        (w.country ?? '').toLowerCase().includes(q)
      )
    }

    if (colorFilter !== 'alle') {
      list = list.filter(w => (w.color ?? '').toLowerCase() === colorFilter.toLowerCase())
    }

    if (dimFilter.status) {
      list = list.filter(w => drinkingStatus(w).key === dimFilter.status)
    }
    if (dimFilter.country) {
      list = list.filter(w => (w.country ?? '') === dimFilter.country)
    }
    if (dimFilter.region) {
      list = list.filter(w => (w.region ?? '') === dimFilter.region)
    }
    if (dimFilter.varietal) {
      list = list.filter(w => (w.master_varietal ?? w.varietal ?? '') === dimFilter.varietal)
    }
    if (dimFilter.decade) {
      list = list.filter(w => w.vintage && `${Math.floor(w.vintage / 10) * 10}s` === dimFilter.decade)
    }

    list.sort((a, b) => {
      if (sortBy === 'producer') return (a.producer ?? a.name).localeCompare(b.producer ?? b.name)
      if (sortBy === 'vintage') return (b.vintage ?? 0) - (a.vintage ?? 0)
      if (sortBy === 'value') return (b.estimated_value ?? 0) - (a.estimated_value ?? 0)
      if (sortBy === 'score') return (b.community_score ?? 0) - (a.community_score ?? 0)
      if (sortBy === 'window') return (a.begin_consume ?? 9999) - (b.begin_consume ?? 9999)
      return 0
    })

    return list
  }, [wines, search, colorFilter, sortBy])

  const totalBottles = wines.filter(w => w.quantity > 0).reduce((s, w) => s + w.quantity, 0)
  // estimated_value er per flaske (CTs Value/Valuation-kolonner) — gang med antall.
  const totalValue = wines.filter(w => w.quantity > 0).reduce((s, w) => s + (w.estimated_value ?? 0) * w.quantity, 0)

  const fmt = (n: number) => new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 }).format(n)

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Vinkjeller</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            {totalBottles} flasker · NOK {fmt(totalValue)} estimert verdi
          </p>
        </div>
        <Link href="/import" className="btn btn-primary">
          <Upload size={15} /> Importer CSV
        </Link>
      </div>

      {/* Active filter chip */}
      {activeFilterLabel && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'sans-serif' }}>Filtrert:</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--accent)', color: '#0f0e0c', fontSize: 13, fontFamily: 'sans-serif', fontWeight: 600, padding: '4px 10px', borderRadius: 99 }}>
            {activeFilterLabel}
            <Link href="/" style={{ color: '#0f0e0c', display: 'flex', alignItems: 'center' }}>
              <X size={12} />
            </Link>
          </span>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 240px' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            placeholder="Søk på vin, produsent, region..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 32 }}
          />
        </div>
        <select value={colorFilter} onChange={e => setColorFilter(e.target.value)} style={{ width: 'auto', flex: '0 0 auto' }}>
          <option value="alle">Alle farger</option>
          <option value="red">Rød</option>
          <option value="white">Hvit</option>
          <option value="rosé">Rosé</option>
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ width: 'auto', flex: '0 0 auto' }}>
          <option value="producer">Sorter: Produsent</option>
          <option value="vintage">Sorter: Årgang</option>
          <option value="value">Sorter: Verdi</option>
          <option value="score">Sorter: Score</option>
          <option value="window">Sorter: Drikkevindu</option>
        </select>
      </div>

      {/* Table */}
      <div className="card">
        {filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
            {wines.length === 0
              ? 'Ingen viner i kjelleren ennå. Importer CSV-filen din for å komme i gang.'
              : 'Ingen viner matcher søket.'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Vin</th>
                  <th className="hide-mobile">Produsent</th>
                  <th>Åg</th>
                  <th className="hide-mobile">Region</th>
                  <th className="hide-mobile">Drue</th>
                  <th style={{ textAlign: 'center' }}>Ant</th>
                  <th className="hide-mobile" style={{ textAlign: 'right' }}>Score</th>
                  <th className="hide-mobile">Vindu</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(wine => {
                  const status = drinkingStatus(wine)
                  const score = wine.personal_score ?? wine.community_score
                  return (
                    <tr key={wine.id} style={{ cursor: 'pointer' }}>
                      <td>
                        <Link href={`/wines/${wine.id}`} style={{ textDecoration: 'none', color: 'var(--text)' }}>
                          <div style={{ display: 'flex', alignItems: 'center' }}>
                            <WineColorDot color={wine.color} />
                            <span style={{ fontWeight: 500 }}>{wine.name}</span>
                          </div>
                          {wine.size && wine.size !== '750ml' && (
                            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 14 }}>{wine.size}</span>
                          )}
                        </Link>
                      </td>
                      <td className="hide-mobile" style={{ color: 'var(--text-muted)', fontSize: 13 }}>{wine.producer ?? '—'}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{wine.vintage ?? '—'}</td>
                      <td className="hide-mobile" style={{ color: 'var(--text-muted)', fontSize: 13 }}>{wine.appellation ?? wine.region ?? '—'}</td>
                      <td className="hide-mobile" style={{ color: 'var(--text-muted)', fontSize: 13 }}>{wine.master_varietal ?? wine.varietal ?? '—'}</td>
                      <td style={{ textAlign: 'center' }}>{wine.quantity}</td>
                      <td className="hide-mobile" style={{ textAlign: 'right' }}>
                        {score ? (
                          <span style={{ fontVariantNumeric: 'tabular-nums', color: score >= 92 ? 'var(--accent)' : 'var(--text)' }}>
                            {Math.round(score)}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="hide-mobile" style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'sans-serif' }}>
                        {wine.begin_consume && wine.end_consume
                          ? `${wine.begin_consume}–${wine.end_consume}`
                          : '—'}
                      </td>
                      <td>
                        <span style={{ fontSize: 12, color: status.color, fontFamily: 'sans-serif' }}>
                          {status.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 12, fontFamily: 'sans-serif' }}>
        {filtered.length} {filtered.length === 1 ? 'vin' : 'viner'}
      </p>
    </div>
  )
}
