'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Search, X } from 'lucide-react'
import WineColorDot from './WineColorDot'
import {
  type RecoWine, type DrinkChoice, type PriceChoice,
  matchesDrinkChoice, matchesPriceChoice, textFilter,
  sortDrinkOnly, sortForFood, readinessLabel, bottleValue, withinReadinessHorizon,
} from '@/lib/reco'

type Mode = 'mat' | 'drikke'

const DRINK_LABELS: Record<DrinkChoice, string> = { red: 'Rødt', white: 'Hvitt', bubbles: 'Bobler' }

// Store valgknapper i La Carta-stil
function ChoiceButton({ label, sub, onClick }: { label: string; sub?: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: '1 1 160px', maxWidth: 300, padding: '28px 20px', cursor: 'pointer',
        background: 'transparent', border: '1px solid #cf7b4a', borderRadius: 2,
        color: 'var(--text)', fontFamily: 'inherit', transition: 'background 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <span style={{ display: 'block', fontFamily: 'var(--font-display)', fontSize: 30, lineHeight: 1.1 }}>{label}</span>
      {sub && <span style={{ display: 'block', fontStyle: 'italic', fontSize: 14, color: 'var(--text-muted)', marginTop: 6 }}>{sub}</span>}
    </button>
  )
}

// Valg-chip med mulighet for å gå tilbake til det steget
function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--accent)', color: 'var(--accent-fg)', fontSize: 13, fontWeight: 600, padding: '4px 12px', borderRadius: 99 }}>
      {label}
      <button onClick={onRemove} aria-label={`Endre valg: ${label}`} style={{ background: 'none', border: 'none', color: 'var(--accent-fg)', cursor: 'pointer', display: 'flex', padding: 0 }}>
        <X size={12} />
      </button>
    </span>
  )
}

export default function Recommender({ wines }: { wines: RecoWine[] }) {
  const [drink, setDrink] = useState<DrinkChoice | null>(null)
  const [price, setPrice] = useState<PriceChoice | null>(null)
  const [mode, setMode] = useState<Mode | null>(null)
  const [foodQuery, setFoodQuery] = useState('')
  const [foodSubmitted, setFoodSubmitted] = useState('')
  const [refine, setRefine] = useState('')

  const sidePad = 'clamp(16px, 5vw, 64px)'

  // Grunnutvalg etter steg 1 og 2
  const pool = useMemo(() => {
    let list = wines.filter(w => w.quantity > 0 && withinReadinessHorizon(w))
    if (drink) list = list.filter(w => matchesDrinkChoice(w, drink))
    if (price) list = list.filter(w => matchesPriceChoice(w, price))
    return list
  }, [wines, drink, price])

  const drinkResults = useMemo(
    () => (mode === 'drikke' ? sortDrinkOnly(textFilter(pool, refine)) : []),
    [pool, mode, refine],
  )
  const foodResults = useMemo(
    () => (mode === 'mat' && foodSubmitted ? sortForFood(pool, foodSubmitted) : []),
    [pool, mode, foodSubmitted],
  )

  // Fjernes en chip, nullstilles det steget og alt etter det
  const resetFrom = (step: 'drink' | 'price' | 'mode') => {
    if (step === 'drink') setDrink(null)
    if (step === 'drink' || step === 'price') setPrice(null)
    setMode(null); setFoodQuery(''); setFoodSubmitted(''); setRefine('')
  }

  const step: 1 | 2 | 3 | 4 = !drink ? 1 : !price ? 2 : !mode ? 3 : 4

  const QUESTIONS: Record<number, string> = {
    1: 'Hva vil du drikke?',
    2: 'Hvor mye vil du unne deg?',
    3: 'Skal vinen følge mat?',
  }

  return (
    <div className="card" style={{ maxWidth: 1180, margin: '0 auto', borderRadius: 0, boxShadow: '0 30px 60px -30px rgba(90,55,30,0.35)', overflow: 'hidden' }}>
      {/* Hero: vinmarkene i Fleurie */}
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
          La Cave de Sjef · Sommelieren
        </div>
        <h1 style={{ fontSize: 'clamp(34px, 7vw, 58px)', lineHeight: 1.05, margin: 0 }}>
          {step < 4 ? QUESTIONS[step] : mode === 'mat' && !foodSubmitted ? 'Hva skal du lage?' : 'Kveldens forslag'}
        </h1>
      </div>

      {/* Valgte steg som chips */}
      {(drink || price || mode) && (
        <div style={{ padding: `16px ${sidePad} 0`, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, fontStyle: 'italic', color: 'var(--text-muted)' }}>Dine valg:</span>
          {drink && <Chip label={DRINK_LABELS[drink]} onRemove={() => resetFrom('drink')} />}
          {price && <Chip label={price === 'dyr' ? 'Dyr' : 'Billig'} onRemove={() => resetFrom('price')} />}
          {mode && <Chip label={mode === 'mat' ? `Til mat${foodSubmitted ? `: ${foodSubmitted}` : ''}` : 'Kun drikke'} onRemove={() => resetFrom('mode')} />}
        </div>
      )}

      {/* Steg 1: rød / hvit / bobler */}
      {step === 1 && (
        <div style={{ padding: `40px ${sidePad} 56px`, display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          <ChoiceButton label="Rødt" onClick={() => setDrink('red')} />
          <ChoiceButton label="Hvitt" onClick={() => setDrink('white')} />
          <ChoiceButton label="Bobler" onClick={() => setDrink('bubbles')} />
        </div>
      )}

      {/* Steg 2: dyr / billig */}
      {step === 2 && (
        <div style={{ padding: `40px ${sidePad} 56px`, display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          <ChoiceButton label="Dyr" sub="verdi over 1000 kr" onClick={() => setPrice('dyr')} />
          <ChoiceButton label="Billig" sub="verdi under 1000 kr" onClick={() => setPrice('billig')} />
        </div>
      )}

      {/* Steg 3: til mat / kun drikke */}
      {step === 3 && (
        <div style={{ padding: `40px ${sidePad} 56px`, display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          <ChoiceButton label="Til mat" sub="fortell hva du lager" onClick={() => setMode('mat')} />
          <ChoiceButton label="Kun drikke" sub="vis meg det som er klart" onClick={() => setMode('drikke')} />
        </div>
      )}

      {/* Steg 4a: mat-input */}
      {step === 4 && mode === 'mat' && (
        <form
          onSubmit={e => { e.preventDefault(); setFoodSubmitted(foodQuery) }}
          style={{ padding: `28px ${sidePad} ${foodSubmitted ? 0 : 56}px`, display: 'flex', gap: 14, alignItems: 'flex-end', maxWidth: 640, margin: '0 auto' }}
        >
          <input
            className="carta-input"
            autoFocus={!foodSubmitted}
            placeholder="F.eks. «grillet lam», «fiskesuppe», «taco» …"
            value={foodQuery}
            onChange={e => setFoodQuery(e.target.value)}
            style={{ fontSize: 18 }}
          />
          <button className="btn btn-primary" type="submit" style={{ borderRadius: 2, flexShrink: 0 }}>
            Foreslå
          </button>
        </form>
      )}

      {/* Steg 4b: fritekst-innsnevring for «kun drikke» */}
      {step === 4 && mode === 'drikke' && (
        <div style={{ padding: `22px ${sidePad} 0`, maxWidth: 640, margin: '0 auto', position: 'relative' }}>
          <Search size={15} style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-30%)', color: '#b39a76' }} />
          <input
            className="carta-input"
            placeholder="Snevre inn: «pinot», «beaujolais», «tyskland» …"
            value={refine}
            onChange={e => setRefine(e.target.value)}
            style={{ paddingLeft: 24 }}
          />
        </div>
      )}

      {/* Resultatliste */}
      {step === 4 && (mode === 'drikke' || foodSubmitted) && (
        <div style={{ padding: `12px ${sidePad} 40px` }}>
          {(mode === 'drikke' ? drinkResults.length === 0 : foodResults.length === 0) ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              Ingen viner matcher valgene dine. Prøv å endre et valg over.
            </div>
          ) : mode === 'drikke' ? (
            drinkResults.map((wine, i) => <ResultRow key={wine.id} wine={wine} rank={i + 1} />)
          ) : (
            foodResults.map(({ wine, match }, i) => (
              <ResultRow key={wine.id} wine={wine} rank={i + 1} matchReason={match.reason} matchPoints={match.points} />
            ))
          )}
          <div style={{ fontStyle: 'italic', fontSize: 15, color: 'var(--text-muted)', marginTop: 18 }}>
            {mode === 'drikke' ? drinkResults.length : foodResults.length} forslag · kun viner som er
            drikkeklare nå eller innen 2 år · sortert etter{' '}
            {mode === 'drikke' ? 'drikkeklarhet og poeng' : 'drikkeklarhet, matmatch og poeng'} ·{' '}
            <Link href="/kjeller" style={{ color: 'var(--accent)' }}>se hele kjelleren</Link>
          </div>
        </div>
      )}
    </div>
  )
}

function ResultRow({ wine, rank, matchReason, matchPoints }: { wine: RecoWine; rank: number; matchReason?: string | null; matchPoints?: number }) {
  const status = readinessLabel(wine)
  const value = bottleValue(wine)
  return (
    <Link
      href={`/wines/${wine.id}`}
      className="carta-row"
      style={{
        display: 'flex', alignItems: 'center', gap: 18, padding: '18px 0',
        borderBottom: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text)',
      }}
    >
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: rank <= 3 ? 'var(--accent)' : 'var(--text-muted)', width: 28, flexShrink: 0, textAlign: 'right' }}>
        {rank}.
      </div>
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
          {[wine.appellation ?? wine.region, wine.varietal].filter(Boolean).join(' · ')}
          {wine.begin_consume && wine.end_consume ? ` · vindu ${wine.begin_consume}–${wine.end_consume}` : ''}
        </div>
        {matchReason && (matchPoints ?? 0) > 0 && (
          <div style={{ fontSize: 14, color: 'var(--sea)', marginTop: 4 }}>
            ✦ {matchReason}
          </div>
        )}
      </div>
      <div className="carta-right">
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 26 }}>{wine.vintage ?? 'NV'}</div>
        <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>
          {wine.quantity} fl.
          {wine.score ? <> · <span style={{ fontWeight: 600, color: wine.score >= 92 ? 'var(--accent)' : 'var(--text)' }}>{Math.round(wine.score)}</span></> : ''}
          {value > 0 ? <> · {Math.round(value)} kr</> : ''}
        </div>
        <div style={{ fontStyle: 'italic', fontSize: 15, color: status.color }}>{status.label}</div>
      </div>
    </Link>
  )
}
