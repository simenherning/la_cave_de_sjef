'use client'
import { useState, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Search, Upload, X } from 'lucide-react'
import type { Wine } from '@/lib/types'
import WineColorDot from './WineColorDot'

const CURRENT_YEAR = new Date().getFullYear()

function drinkingStatus(wine: Wine): { label: string; color: string; key: string } {
  if (!wine.begin_consume || !wine.end_consume) return { label: '—', color: 'var(--text-muted)', key: '' }
  if (CURRENT_YEAR > wine.end_consume) return { label: 'Passert', color: 'var(--status-past)', key: 'past-window' }
  if (CURRENT_YEAR < wine.begin_consume) {
    if (wine.begin_consume - CURRENT_YEAR <= 3) return { label: 'Drikk snart', color: 'var(--status-soon)', key: 'drink-soon' }
    return { label: 'Vent', color: 'var(--status-hold)', key: 'hold' }
  }
  const remaining = wine.end_consume - CURRENT_YEAR
  if (remaining <= 2) return { label: 'Drikk snart', color: 'var(--status-soon)', key: 'drink-soon' }
  return { label: 'Drikk nå', color: 'var(--status-now)', key: 'drink-now' }
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

  const sidePad = 'clamp(16px, 5vw, 64px)'

  return (
    // «La Carta» — sentrert ark med masthead, understreket verktøylinje og menyliste
    <div className="card" style={{ maxWidth: 1180, margin: '0 auto', borderRadius: 0, boxShadow: '0 30px 60px -30px rgba(90,55,30,0.35)', overflow: 'hidden' }}>
      {/* Hero: vinmarkene i Fleurie — stripene bak fungerer som lastebakgrunn */}
      <div className="carta-hero">
        <Image
          src="/hero-kjeller.jpg"
          alt="Vinmarker i Fleurie med kapellet La Madone på toppen"
          fill
          priority
          sizes="(max-width: 1180px) 100vw, 1180px"
          style={{ objectFit: 'cover', objectPosition: 'center 22%' }}
        />
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 90, background: 'linear-gradient(to top, rgba(58,35,22,0.55), transparent)', pointerEvents: 'none' }} />
      </div>

      {/* Masthead */}
      <div style={{ padding: `44px ${sidePad} 32px`, textAlign: 'center', borderBottom: '3px double #d8a24a' }}>
        <div style={{ fontSize: 13, letterSpacing: '0.42em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 14 }}>
          La Cave de Sjef · Anno MMXX
        </div>
        <h1 style={{ fontSize: 'clamp(40px, 8vw, 64px)', lineHeight: 1, margin: '0 0 12px' }}>Vinkjeller</h1>
        <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 21, color: '#7a6249' }}>
          {totalBottles} flasker&nbsp;·&nbsp;NOK {fmt(totalValue)} i estimert verdi
        </div>
      </div>

      {/* Verktøylinje */}
      <div style={{ padding: `22px ${sidePad}`, display: 'flex', alignItems: 'center', gap: 20, borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 220px', position: 'relative' }}>
          <Search size={15} style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', color: '#b39a76' }} />
          <input
            className="carta-input"
            placeholder="Søk på vin, produsent, region …"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 24 }}
          />
        </div>
        <select className="carta-input" value={colorFilter} onChange={e => setColorFilter(e.target.value)} style={{ width: 'auto', flex: '0 0 auto', color: '#7a6249' }}>
          <option value="alle">Alle farger</option>
          <option value="red">Rød</option>
          <option value="white">Hvit</option>
          <option value="rosé">Rosé</option>
        </select>
        <select className="carta-input" value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ width: 'auto', flex: '0 0 auto', color: '#7a6249' }}>
          <option value="producer">Sorter: Produsent</option>
          <option value="vintage">Sorter: Årgang</option>
          <option value="value">Sorter: Verdi</option>
          <option value="score">Sorter: Score</option>
          <option value="window">Sorter: Drikkevindu</option>
        </select>
        <Link
          href="/import"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, border: '1px solid #cf7b4a', borderRadius: 2,
            color: 'var(--accent)', textDecoration: 'none', fontSize: 13, letterSpacing: '0.14em',
            textTransform: 'uppercase', padding: '9px 16px',
          }}
        >
          <Upload size={13} /> Importer CSV
        </Link>
      </div>

      {/* Aktivt filter */}
      {activeFilterLabel && (
        <div style={{ padding: `14px ${sidePad} 0`, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, fontStyle: 'italic', color: 'var(--text-muted)' }}>Filtrert:</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--accent)', color: 'var(--accent-fg)', fontSize: 13, fontWeight: 600, padding: '4px 12px', borderRadius: 99 }}>
            {activeFilterLabel}
            <Link href="/" style={{ color: 'var(--accent-fg)', display: 'flex', alignItems: 'center' }}>
              <X size={12} />
            </Link>
          </span>
        </div>
      )}

      {/* Menyliste */}
      <div style={{ padding: `12px ${sidePad} 40px` }}>
        {filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>
            {wines.length === 0
              ? 'Ingen viner i kjelleren ennå. Importer CSV-filen din for å komme i gang.'
              : 'Ingen viner matcher søket.'}
          </div>
        ) : (
          filtered.map(wine => {
            const status = drinkingStatus(wine)
            const score = wine.personal_score ?? wine.community_score
            return (
              <Link
                key={wine.id}
                href={`/wines/${wine.id}`}
                className="carta-row"
                style={{
                  display: 'flex', alignItems: 'center', gap: 18, padding: '18px 0',
                  borderBottom: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text)',
                }}
              >
                <WineColorDot color={wine.color} />
                <div style={{ flex: '1 1 0%', minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#a5623a', marginBottom: 2 }}>
                    {wine.producer ?? '—'}
                  </div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 25, lineHeight: 1.15 }}>
                    {wine.name}
                    {wine.size && wine.size !== '750ml' && (
                      <span style={{ fontSize: 15, color: 'var(--text-muted)', marginLeft: 8 }}>{wine.size}</span>
                    )}
                  </div>
                  <div style={{ fontStyle: 'italic', fontSize: 16, color: 'var(--text-muted)', marginTop: 2 }}>
                    {[wine.appellation ?? wine.region, wine.master_varietal ?? wine.varietal].filter(Boolean).join(' · ')}
                    {wine.begin_consume && wine.end_consume ? ` · drikkevindu ${wine.begin_consume}–${wine.end_consume}` : ''}
                  </div>
                </div>
                <div className="carta-right">
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 26 }}>{wine.vintage ?? 'NV'}</div>
                  <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>
                    {wine.quantity} fl.{score ? <> · <span style={{ fontWeight: 600, color: score >= 92 ? 'var(--accent)' : 'var(--text)' }}>{Math.round(score)}</span></> : ''}
                  </div>
                  <div style={{ fontStyle: 'italic', fontSize: 15, color: status.color }}>{status.label}</div>
                </div>
              </Link>
            )
          })
        )}
        <div style={{ fontStyle: 'italic', fontSize: 15, color: 'var(--text-muted)', marginTop: 18 }}>
          {filtered.length} {filtered.length === 1 ? 'vin' : 'viner'} i utvalget
        </div>
      </div>
    </div>
  )
}
