'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Scanner from './Scanner'
import {
  buildEanMap, buildEanMapCsv, buildResultCsv, eanLookupKeys, parseInventory,
} from '@/lib/telling/csv'
import { fetchInventory, fetchLearnedEans, mergeLearnedEans, saveLearnedEan } from '@/lib/telling/inventory'
import { clearSession, loadSession, saveSession } from '@/lib/telling/storage'
import type { ScanMethod, Session, WineRow } from '@/lib/telling/types'
import { wineStatus, type WineStatus } from '@/lib/telling/types'

type View = 'setup' | 'scan' | 'status'
type Sheet =
  | { kind: 'choice'; ean: string; keys: string[] }
  | { kind: 'search'; ean: string | null }

const STATUS_COLORS: Record<WineStatus, string> = {
  OK: 'var(--status-now)',
  MANGLER: 'var(--status-soon)',
  IKKE_SKANNET: 'var(--status-soon)',
  OVERTALL: 'var(--status-past)',
  IKKE_I_CT: 'var(--status-past)',
}

function remaining(w: WineRow): number {
  return w.expectedQty - w.countedQty
}

function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function TellingApp() {
  const [session, setSession] = useState<Session | null>(null)
  const [stored, setStored] = useState<Session | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [view, setView] = useState<View>('setup')
  const [sheet, setSheet] = useState<Sheet | null>(null)
  const [confirmKey, setConfirmKey] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; kind: 'ok' | 'warn' } | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [importWarnings, setImportWarnings] = useState<string[]>([])
  const [dbLoading, setDbLoading] = useState(false)

  useEffect(() => {
    setStored(loadSession())
  }, [])

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showToast = useCallback((msg: string, kind: 'ok' | 'warn' = 'ok') => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ msg, kind })
    toastTimer.current = setTimeout(() => setToast(null), 2500)
  }, [])

  // Alt state lagres etter hver eneste endring (PRD: aldri mist mer enn siste skanning).
  const update = useCallback((fn: (s: Session) => void) => {
    setSession(prev => {
      if (!prev) return prev
      const next = structuredClone(prev)
      fn(next)
      saveSession(next)
      return next
    })
  }, [])

  const wineByKey = useMemo(
    () => new Map((session?.wines ?? []).map(w => [w.key, w])),
    [session?.wines],
  )

  const countWine = useCallback((key: string, ean: string | null, method: ScanMethod) => {
    const w = wineByKey.get(key)
    if (!w) return
    const isNewMapping = !!ean && !session?.eanMap[ean]?.includes(key)
    update(s => {
      const wine = s.wines.find(x => x.key === key)!
      wine.countedQty++
      if (ean && !s.eanMap[ean]?.includes(key)) (s.eanMap[ean] ??= []).push(key)
      s.scans.push({ ts: new Date().toISOString(), ean, resolvedKey: key, method })
    })
    // Nylært kobling lagres også i databasen, så neste års telling (og andre
    // enheter) gjenkjenner EAN-en uten koblingsfil. Best effort — se saveLearnedEan.
    if (isNewMapping && ean) saveLearnedEan(ean, w)
    navigator.vibrate?.(60)
    const counted = w.countedQty + 1
    const label = [w.wine, w.vintage].filter(Boolean).join(' ')
    if (w.notInCt) {
      showToast(`✓ ${label} — ${counted} talt (ikke i CT)`)
    } else if (counted > w.expectedQty) {
      showToast(`⚠ ${label} — ${counted} av ${w.expectedQty} (overtall)`, 'warn')
    } else {
      showToast(`✓ ${label} — ${counted} av ${w.expectedQty}`)
    }
    setSheet(null)
    setConfirmKey(null)
  }, [update, wineByKey, showToast, session?.eanMap])

  // Skanneløkke (PRD §5): auto → valgark → søk, avhengig av kandidater.
  const handleEan = useCallback((ean: string) => {
    if (!session) return
    const keys = new Set<string>()
    for (const k of eanLookupKeys(ean)) {
      for (const key of session.eanMap[k] ?? []) {
        if (wineByKey.has(key)) keys.add(key)
      }
    }
    const candidates = Array.from(keys)
    const single = candidates.length === 1 ? wineByKey.get(candidates[0])! : null
    if (candidates.length === 0) {
      setSheet({ kind: 'search', ean })
    } else if (single && (single.notInCt || remaining(single) > 0)) {
      // Funne flasker (notInCt) har ingen forventet mengde — telles alltid rett opp.
      countWine(candidates[0], ean, 'auto')
    } else {
      // Flere kandidater, eller én kandidat som allerede er full (mulig overtall).
      navigator.vibrate?.(30)
      setSheet({ kind: 'choice', ean, keys: candidates })
    }
  }, [session, wineByKey, countWine])

  // Bluetooth-skannere opptrer som tastatur: fang raske siffersekvenser + Enter
  // globalt (ikke når et inputfelt har fokus).
  useEffect(() => {
    let buffer = ''
    let lastKeyTs = 0
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      const now = Date.now()
      if (now - lastKeyTs > 100) buffer = ''
      lastKeyTs = now
      if (/^\d$/.test(e.key)) {
        buffer += e.key
      } else if (e.key === 'Enter' && [8, 12, 13].includes(buffer.length)) {
        handleEan(buffer)
        buffer = ''
      } else {
        buffer = ''
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleEan])

  function undoScan(scanIndex: number) {
    if (!session || scanIndex < 0 || scanIndex >= session.scans.length) return
    const scan = session.scans[scanIndex]
    const w = wineByKey.get(scan.resolvedKey)
    update(s => {
      const wine = s.wines.find(x => x.key === scan.resolvedKey)
      if (wine && wine.countedQty > 0) wine.countedQty--
      s.scans.splice(scanIndex, 1)
    })
    showToast(`Angret: ${w ? [w.wine, w.vintage].filter(Boolean).join(' ') : 'skanning'}`, 'warn')
  }

  async function handleInventoryFile(file: File) {
    setImportError(null)
    setImportWarnings([])
    try {
      const text = await file.text()
      const { wines, eanMap, warnings } = parseInventory(text)
      const s: Session = {
        startedAt: new Date().toISOString(),
        inventoryFileName: file.name,
        wines, eanMap, scans: [],
      }
      saveSession(s)
      setSession(s)
      setStored(null)
      setImportWarnings(warnings)
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Ukjent feil ved parsing av CSV.')
    }
  }

  async function handleFetchFromDb() {
    setImportError(null)
    setImportWarnings([])
    setDbLoading(true)
    try {
      const wines = await fetchInventory()
      if (wines.length === 0) {
        throw new Error('Fant ingen viner med antall > 0 i databasen. Importer kjelleren på /import først.')
      }
      mergeLearnedEans(wines, await fetchLearnedEans())
      const s: Session = {
        startedAt: new Date().toISOString(),
        inventoryFileName: 'kjellerdatabasen',
        wines, eanMap: buildEanMap(wines), scans: [],
      }
      saveSession(s)
      setSession(s)
      setStored(null)
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Ukjent feil ved henting fra databasen.')
    } finally {
      setDbLoading(false)
    }
  }

  // Flaske funnet i kjelleren som ikke finnes i CT: noteres i fritekst og
  // telles som IKKE_I_CT. Listes på statussiden for manuell innlegging i CT.
  function addFoundBottle(text: string, ean: string | null) {
    if (!session || !text.trim()) return
    const key = `local-${Date.now()}`
    const oneLine = text.trim().replace(/\s*\n\s*/g, ' / ')
    update(s => {
      s.wines.push({
        key, iWine: '', vintage: '', wine: oneLine, producer: '', size: '',
        expectedQty: 0, countedQty: 1, knownEans: ean ? [ean] : [], notInCt: true,
      })
      // Med EAN gjenkjennes samme flasketype resten av tellingen (teller opp
      // samme notat), men lagres ikke i databasen — den mangler jo iWine.
      if (ean) (s.eanMap[ean] ??= []).push(key)
      s.scans.push({ ts: new Date().toISOString(), ean, resolvedKey: key, method: ean ? 'manual' : 'noean' })
    })
    showToast('✓ Notert — se «Funne flasker» under Status & eksport')
    setSheet(null)
  }

  function startNew() {
    if (!stored) { setShowImport(true); return }
    const ok = window.confirm(
      'Starte ny telling? Fremdriften fra forrige økt slettes. Eksporter resultatet først hvis du trenger det.'
    )
    if (!ok) return
    clearSession()
    setStored(null)
    setShowImport(true)
  }

  // ---- Avledede tall ----
  const progress = useMemo(() => {
    if (!session) return { counted: 0, expected: 0, winesDone: 0, winesTotal: 0 }
    let counted = 0, expected = 0, winesDone = 0, winesTotal = 0
    for (const w of session.wines) {
      counted += w.countedQty
      expected += w.expectedQty
      if (!w.notInCt) {
        winesTotal++
        if (w.expectedQty > 0 && w.countedQty >= w.expectedQty) winesDone++
      }
    }
    return { counted, expected, winesDone, winesTotal }
  }, [session])

  const lastScans = useMemo(() => {
    if (!session) return []
    return session.scans
      .map((scan, index) => ({ scan, index }))
      .slice(-5)
      .reverse()
  }, [session])

  // ================= RENDER =================

  if (view === 'setup') {
    return (
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <h1 style={{ fontSize: 24, margin: '8px 0 4px' }}>Vintelling</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 20 }}>
          Varetelling av kjelleren mot CellarTracker-eksport. Alt lagres lokalt på telefonen.
        </p>

        {stored && !session && (
          <div className="card" style={{ padding: 16, marginBottom: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Fortsette forrige telling?</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
              Startet {new Date(stored.startedAt).toLocaleString('no')} · {stored.inventoryFileName}<br />
              {stored.scans.length} skanninger registrert
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={() => { setSession(stored); setView('scan') }}>
                Fortsett forrige telling
              </button>
              <button className="btn btn-ghost" onClick={() => downloadCsv(`telling-resultat-${today()}.csv`, buildResultCsv(stored))}>
                Eksporter resultat
              </button>
              <button className="btn btn-ghost" onClick={startNew}>Start ny</button>
            </div>
          </div>
        )}

        {(!stored || showImport || session) && (
          <div className="card" style={{ padding: 16, marginBottom: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Hent inventaret</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>
              Enklest: hent kjelleren rett fra databasen — CSV-en du importerer på{' '}
              <b>/import</b> (f.eks. på Mac-en) er da automatisk tilgjengelig her.
            </div>
            <button
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', marginBottom: 14 }}
              disabled={dbLoading}
              onClick={handleFetchFromDb}
            >
              {dbLoading ? 'Henter …' : 'Hent fra kjellerdatabasen'}
            </button>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>
              … eller last inn en CellarTracker-eksport (CSV) direkte: My Cellar → Export → CSV.
              Ta med <b>iWine</b>-kolonnen hvis du kan (gir enklest avstemming etterpå),
              men appen fungerer også uten.
            </div>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleInventoryFile(f) }}
            />
            {importError && (
              <div style={{ marginTop: 10, color: 'var(--status-past)', fontSize: 13 }}>{importError}</div>
            )}
            {importWarnings.length > 0 && (
              <div style={{ marginTop: 10, color: 'var(--accent)', fontSize: 12 }}>
                {importWarnings.slice(0, 5).map((w, i) => <div key={i}>{w}</div>)}
                {importWarnings.length > 5 && <div>… og {importWarnings.length - 5} til.</div>}
              </div>
            )}
          </div>
        )}

        {session && (
          <>
            <div className="card" style={{ padding: 16, marginBottom: 16 }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Importert: {session.inventoryFileName}</div>
              <div style={{ display: 'flex', gap: 20, fontSize: 14 }}>
                <div><b>{session.wines.length}</b> viner</div>
                <div><b>{progress.expected}</b> flasker</div>
                <div><b>{session.wines.filter(w => w.knownEans.length > 0).length}</b> med kjent EAN</div>
              </div>
            </div>

            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '14px 16px', fontSize: 16 }} onClick={() => setView('scan')}>
              Start skanning →
            </button>
          </>
        )}
      </div>
    )
  }

  if (!session) return null

  if (view === 'status') {
    const sorted = [...session.wines].sort((a, b) => {
      const sa = wineStatus(a), sb = wineStatus(b)
      const da = sa === 'OK' ? 0 : Math.abs(a.countedQty - a.expectedQty) || 1
      const db = sb === 'OK' ? 0 : Math.abs(b.countedQty - b.expectedQty) || 1
      if ((da === 0) !== (db === 0)) return da === 0 ? 1 : -1
      if (da !== db) return db - da
      return (a.producer + a.wine).localeCompare(b.producer + b.wine)
    })
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
          <h1 style={{ fontSize: 22, margin: 0 }}>Status · {progress.counted} av {progress.expected} flasker</h1>
          <button className="btn btn-ghost" onClick={() => setView('scan')}>← Tilbake til skanning</button>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          <button className="btn btn-primary" onClick={() => downloadCsv(`telling-resultat-${today()}.csv`, buildResultCsv(session))}>
            Eksporter resultat (CSV)
          </button>
          <button className="btn btn-ghost" onClick={() => downloadCsv(`ean-koblinger-${today()}.csv`, buildEanMapCsv(session))}>
            Eksporter EAN-koblinger (CSV)
          </button>
        </div>
        {session.wines.some(w => w.notInCt) && (
          <div className="card" style={{ padding: 16, marginBottom: 16, borderColor: 'var(--accent)' }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>📝 Funne flasker som ikke er i CT</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>
              Disse må legges inn manuelt i CellarTracker. De er også med i resultat-CSV-en (status IKKE_I_CT).
            </div>
            {session.wines.filter(w => w.notInCt).map(w => (
              <div key={w.key} style={{ padding: '10px 0', borderTop: '1px solid var(--border)', fontSize: 14 }}>
                {w.wine}
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  {w.countedQty} {w.countedQty === 1 ? 'flaske' : 'flasker'}
                  {w.knownEans[0] ? ` · EAN ${w.knownEans[0]}` : ' · uten strekkode'}
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="card" style={{ overflowX: 'auto' }}>
          <table className="status-table">
            <thead>
              <tr>
                <th>Vin</th>
                <th className="hide-mobile">Årgang</th>
                <th className="hide-mobile">Str.</th>
                <th style={{ textAlign: 'right' }}>Forv.</th>
                <th style={{ textAlign: 'right' }}>Talt</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(w => {
                const st = wineStatus(w)
                return (
                  <tr key={w.key}>
                    <td style={{ maxWidth: 260 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.wine}</div>
                      {w.producer && <div className="hide-mobile" style={{ fontSize: 12, color: 'var(--text-muted)' }}>{w.producer}</div>}
                      <div className="show-mobile" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {[w.vintage, w.size].filter(Boolean).join(' · ')}
                      </div>
                    </td>
                    <td className="hide-mobile">{w.vintage}</td>
                    <td className="hide-mobile" style={{ whiteSpace: 'nowrap' }}>{w.size}</td>
                    <td style={{ textAlign: 'right' }}>{w.expectedQty}</td>
                    <td style={{ textAlign: 'right' }}>{w.countedQty}</td>
                    <td style={{ color: STATUS_COLORS[st], whiteSpace: 'nowrap', fontSize: 12 }}>
                      {st}{st !== 'OK' && st !== 'IKKE_I_CT' ? ` (${w.countedQty - w.expectedQty > 0 ? '+' : ''}${w.countedQty - w.expectedQty})` : ''}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // ---- Skanneskjerm ----
  const pct = progress.expected > 0 ? Math.min(100, (progress.counted / progress.expected) * 100) : 0
  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      <Scanner paused={sheet !== null} onDetect={handleEan} />

      <div style={{ margin: '12px 0 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div style={{ fontSize: 15 }}>
          <b>{progress.counted} / {progress.expected} flasker</b>
          <span style={{ color: 'var(--text-muted)' }}> · {progress.winesDone} viner ferdig</span>
        </div>
        <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 13 }} onClick={() => setView('status')}>
          Status & eksport
        </button>
      </div>
      <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, marginBottom: 12 }}>
        <div style={{ height: 4, width: `${pct}%`, background: 'var(--accent)', borderRadius: 2, transition: 'width 0.3s' }} />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <button className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setSheet({ kind: 'search', ean: null })}>
          Uten strekkode
        </button>
        <button
          className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }}
          disabled={session.scans.length === 0}
          onClick={() => undoScan(session.scans.length - 1)}
        >
          Angre siste
        </button>
      </div>

      {lastScans.length > 0 && (
        <div className="card">
          {lastScans.map(({ scan, index }) => {
            const w = wineByKey.get(scan.resolvedKey)
            if (!w) return null
            return (
              <div key={scan.ts + scan.resolvedKey} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 14 }}>
                    {[w.wine, w.vintage].filter(Boolean).join(' ')}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {w.notInCt ? `${w.countedQty} talt · ikke i CT` : `${w.countedQty} av ${w.expectedQty}`}{w.size ? ` · ${w.size}` : ''}
                  </div>
                </div>
                <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => undoScan(index)}>
                  Angre
                </button>
              </div>
            )
          })}
        </div>
      )}

      {toast && (
        <div style={{
          position: 'fixed', top: 14, left: '50%', transform: 'translateX(-50%)',
          maxWidth: 'calc(100vw - 32px)', zIndex: 100, padding: '10px 18px', borderRadius: 8,
          background: toast.kind === 'ok' ? 'var(--status-now-bg)' : 'var(--status-soon-bg)', color: toast.kind === 'ok' ? 'var(--status-now)' : 'var(--status-soon)', border: '1px solid var(--border)',
          fontSize: 14, boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        }}>
          {toast.msg}
        </div>
      )}

      {sheet?.kind === 'choice' && (
        <BottomSheet onClose={() => { setSheet(null); setConfirmKey(null) }} title="Hvilken vin er dette?">
          {sheet.keys.map(key => {
            const w = wineByKey.get(key)
            if (!w) return null
            const rem = remaining(w)
            const needsConfirm = rem <= 0 && !w.notInCt
            const armed = confirmKey === key
            return (
              <button
                key={key}
                onClick={() => {
                  if (needsConfirm && !armed) { setConfirmKey(key); return }
                  countWine(key, sheet.ean, 'choice')
                }}
                style={{
                  display: 'block', width: '100%', textAlign: 'left', padding: '14px 16px',
                  background: armed ? 'var(--status-soon-bg)' : 'transparent', border: 'none',
                  borderBottom: '1px solid var(--border)', color: 'var(--text)', cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                <div style={{ fontSize: 15 }}>{[w.wine, w.vintage].filter(Boolean).join(' ')}</div>
                <div style={{ fontSize: 13, color: needsConfirm ? 'var(--status-past)' : 'var(--text-muted)', marginTop: 2 }}>
                  {w.size && `${w.size} · `}
                  {armed
                    ? 'Alle forventede er talt — trykk igjen for å bekrefte overtall'
                    : w.notInCt ? `notert funnet flaske · ${w.countedQty} talt`
                    : needsConfirm ? `${w.countedQty} av ${w.expectedQty} talt (full!)` : `${rem} igjen`}
                </div>
              </button>
            )
          })}
          <button
            onClick={() => setSheet({ kind: 'search', ean: sheet.ean })}
            style={{ display: 'block', width: '100%', textAlign: 'center', padding: 14, background: 'transparent', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14 }}
          >
            Ingen av disse — søk i hele inventaret
          </button>
        </BottomSheet>
      )}

      {sheet?.kind === 'search' && (
        <SearchSheet
          wines={session.wines}
          ean={sheet.ean}
          confirmKey={confirmKey}
          onArm={setConfirmKey}
          onPick={(key) => countWine(key, sheet.ean, sheet.ean ? 'manual' : 'noean')}
          onAddUnknown={(text) => addFoundBottle(text, sheet.ean)}
          onClose={() => { setSheet(null); setConfirmKey(null) }}
        />
      )}
    </div>
  )
}

function BottomSheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50 }} onClick={onClose}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }} />
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '75vh', overflowY: 'auto',
          background: 'var(--bg-card)', borderTop: '1px solid var(--border)',
          borderRadius: '16px 16px 0 0', paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontWeight: 600 }}>{title}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function SearchSheet({ wines, ean, confirmKey, onArm, onPick, onAddUnknown, onClose }: {
  wines: WineRow[]
  ean: string | null
  confirmKey: string | null
  onArm: (key: string | null) => void
  onPick: (key: string) => void
  onAddUnknown: (name: string) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [noteMode, setNoteMode] = useState(false)
  const [noteText, setNoteText] = useState('')

  const results = useMemo(() => {
    // Aksent-ufølsomt søk: «petrus» skal treffe «Pétrus», «Metras» → «Métras».
    const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    const tokens = fold(query).split(/\s+/).filter(Boolean)
    const matches = wines.filter(w => {
      if (w.notInCt) return false
      const hay = fold(`${w.producer} ${w.wine} ${w.vintage} ${w.size}`)
      return tokens.every(t => hay.includes(t))
    })
    // Mest sannsynlige først: rest > 0 og uten kjent EAN, deretter rest > 0, så resten.
    const rank = (w: WineRow) =>
      remaining(w) > 0 && w.knownEans.length === 0 ? 0 : remaining(w) > 0 ? 1 : 2
    return matches
      .sort((a, b) => rank(a) - rank(b) || (a.producer + a.wine).localeCompare(b.producer + b.wine))
      .slice(0, 50)
  }, [wines, query])

  // Fullskjerm i stedet for bunn-ark: iOS-tastaturet dyttet bunn-arket ut av
  // syne når søkefeltet fikk fokus. Med feltet forankret ØVERST er felt og
  // forslag alltid synlige over tastaturet — ingen scrolling nødvendig.
  return (
    <div className="full-sheet">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {ean ? `Ukjent EAN ${ean} — hvilken vin?` : 'Flaske uten strekkode'}
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 26, cursor: 'pointer', lineHeight: 1, padding: '0 0 0 12px' }}>×</button>
      </div>
      <div style={{ padding: '10px 16px', flexShrink: 0, borderBottom: '1px solid var(--border)' }}>
        <input
          autoFocus
          placeholder="Søk på produsent eller vinnavn …"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        {ean && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
            Valget lagres, så denne EAN-en gjenkjennes automatisk neste gang.
          </div>
        )}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' as const }}>
      {results.map(w => {
        const rem = remaining(w)
        const needsConfirm = rem <= 0
        const armed = confirmKey === w.key
        return (
          <button
            key={w.key}
            onClick={() => {
              if (needsConfirm && !armed) { onArm(w.key); return }
              onPick(w.key)
            }}
            style={{
              display: 'block', width: '100%', textAlign: 'left', padding: '12px 16px',
              background: armed ? 'var(--status-soon-bg)' : 'transparent', border: 'none',
              borderBottom: '1px solid var(--border)', color: 'var(--text)', cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            <div style={{ fontSize: 14 }}>{[w.wine, w.vintage].filter(Boolean).join(' ')}</div>
            <div style={{ fontSize: 12, color: needsConfirm ? 'var(--status-past)' : 'var(--text-muted)', marginTop: 2 }}>
              {[w.producer, w.size].filter(Boolean).join(' · ')}
              {' · '}
              {armed ? 'Trykk igjen for å bekrefte overtall' : needsConfirm ? 'full!' : `${rem} igjen`}
            </div>
          </button>
        )
      })}
      {results.length === 0 && query && (
        <div style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 14 }}>Ingen treff.</div>
      )}
      <div style={{ padding: '12px 16px' }}>
        {noteMode ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Beskriv flasken kjapt — produsent, vin, årgang, det du ser på etiketten.
              Notatet dukker opp under «Status & eksport» så du kan legge den inn i CT etterpå.
            </div>
            <textarea
              autoFocus
              rows={3}
              placeholder="F.eks. Ganevat Cuvée de l'Enfant Terrible 2019, magnum …"
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
            />
            <button
              className="btn btn-primary"
              style={{ justifyContent: 'center' }}
              disabled={!noteText.trim()}
              onClick={() => onAddUnknown(noteText)}
            >
              Lagre notat og tell flasken
            </button>
          </div>
        ) : (
          <button
            className="btn btn-ghost"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={() => { setNoteText(query); setNoteMode(true) }}
          >
            📝 Finnes ikke i CT — noter funnet flaske
          </button>
        )}
      </div>
      </div>
    </div>
  )
}
