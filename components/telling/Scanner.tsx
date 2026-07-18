'use client'
import { useCallback, useEffect, useRef, useState } from 'react'

// Strekkodeskanner: native BarcodeDetector der det finnes, ellers ZXing-js
// lastet fra CDN med versjonslås. Leser EAN-13, EAN-8, UPC-A, UPC-E.
//
// Re-arm-valg (PRD §5.5): etter registrering må koden være ute av bildet i
// minst 1 sekund FØR den kan registreres igjen, og uansett minst 3 sekunder
// siden forrige registrering. Valgt fremfor en «Skann neste»-knapp fordi det
// gir best flyt med én hånd på flasken og én på telefonen — man senker bare
// flasken og løfter neste.

const ZXING_CDN = 'https://unpkg.com/@zxing/browser@0.1.5/umd/zxing-browser.min.js'
const ABSENCE_MS = 1000
const DEBOUNCE_MS = 3000

interface BarcodeDetectorLike {
  detect(source: HTMLVideoElement): Promise<Array<{ rawValue: string }>>
}
declare global {
  interface Window {
    BarcodeDetector?: {
      new (opts?: { formats: string[] }): BarcodeDetectorLike
      getSupportedFormats(): Promise<string[]>
    }
    ZXingBrowser?: {
      BrowserMultiFormatReader: new () => {
        decodeFromVideoElement(
          video: HTMLVideoElement,
          cb: (result: { getText(): string } | undefined, err: unknown) => void,
        ): Promise<{ stop(): void }>
      }
    }
  }
}

function loadZxing(): Promise<NonNullable<Window['ZXingBrowser']>> {
  return new Promise((resolve, reject) => {
    if (window.ZXingBrowser) return resolve(window.ZXingBrowser)
    const script = document.createElement('script')
    script.src = ZXING_CDN
    script.onload = () => {
      if (window.ZXingBrowser) resolve(window.ZXingBrowser)
      else reject(new Error('ZXing lastet, men fant ikke ZXingBrowser-globalen.'))
    }
    script.onerror = () => reject(new Error('Kunne ikke laste ZXing fra CDN. Sjekk nettverket.'))
    document.head.appendChild(script)
  })
}

interface Props {
  /** true mens valgark/søk er åpent — kamera kjører, men deteksjoner ignoreres. */
  paused: boolean
  onDetect: (ean: string) => void
}

export default function Scanner({ paused, onDetect }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const pausedRef = useRef(paused)
  const onDetectRef = useRef(onDetect)
  useEffect(() => {
    pausedRef.current = paused
    onDetectRef.current = onDetect
  }, [paused, onDetect])

  const [error, setError] = useState<string | null>(null)
  const [engine, setEngine] = useState<'native' | 'zxing' | null>(null)
  const [torchSupported, setTorchSupported] = useState(false)
  const [torchOn, setTorchOn] = useState(false)
  const trackRef = useRef<MediaStreamTrack | null>(null)

  // Re-arm-tilstand per EAN (se kommentar øverst).
  const lastSeenRef = useRef(new Map<string, number>())
  const lastEmittedRef = useRef(new Map<string, number>())

  const handleRaw = useCallback((raw: string) => {
    const digits = raw.replace(/\D/g, '')
    if (![8, 12, 13].includes(digits.length)) return // filtrer bort QR o.l. (ZXing leser alt)
    const now = Date.now()
    const seenBefore = lastSeenRef.current.get(digits)
    lastSeenRef.current.set(digits, now)
    if (pausedRef.current) return
    const emitted = lastEmittedRef.current.get(digits)
    if (emitted !== undefined) {
      const stillInFrame = seenBefore !== undefined && now - seenBefore < ABSENCE_MS
      if (now - emitted < DEBOUNCE_MS || stillInFrame) return
    }
    lastEmittedRef.current.set(digits, now)
    onDetectRef.current(digits)
  }, [])

  useEffect(() => {
    let cancelled = false
    let stream: MediaStream | null = null
    let intervalId: ReturnType<typeof setInterval> | null = null
    let zxingControls: { stop(): void } | null = null

    async function start() {
      const video = videoRef.current
      if (!video) return
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        })
      } catch {
        setError('Fikk ikke tilgang til kameraet. Gi tillatelse i nettleseren og last siden på nytt. (Krever HTTPS.)')
        return
      }
      if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
      video.srcObject = stream
      await video.play().catch(() => {})

      const track = stream.getVideoTracks()[0]
      trackRef.current = track
      const caps = track.getCapabilities?.() as (MediaTrackCapabilities & { torch?: boolean }) | undefined
      setTorchSupported(!!caps?.torch)

      // Foretrekk native BarcodeDetector; fall tilbake til ZXing.
      let detector: BarcodeDetectorLike | null = null
      if (window.BarcodeDetector) {
        try {
          const supported = await window.BarcodeDetector.getSupportedFormats()
          const wanted = ['ean_13', 'ean_8', 'upc_a', 'upc_e'].filter(f => supported.includes(f))
          if (wanted.length > 0) detector = new window.BarcodeDetector({ formats: wanted })
        } catch {
          detector = null
        }
      }

      if (detector) {
        setEngine('native')
        const d = detector
        intervalId = setInterval(async () => {
          if (cancelled || video.readyState < 2) return
          try {
            const codes = await d.detect(video)
            for (const c of codes) handleRaw(c.rawValue)
          } catch {
            // enkeltframe-feil er ufarlige
          }
        }, 150)
      } else {
        try {
          const zxing = await loadZxing()
          if (cancelled) return
          setEngine('zxing')
          const reader = new zxing.BrowserMultiFormatReader()
          zxingControls = await reader.decodeFromVideoElement(video, result => {
            if (result) handleRaw(result.getText())
          })
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Kunne ikke starte strekkodelesing.')
        }
      }
    }

    start()
    return () => {
      cancelled = true
      if (intervalId) clearInterval(intervalId)
      zxingControls?.stop()
      stream?.getTracks().forEach(t => t.stop())
    }
  }, [handleRaw])

  async function toggleTorch() {
    const track = trackRef.current
    if (!track) return
    try {
      await track.applyConstraints({ advanced: [{ torch: !torchOn } as MediaTrackConstraintSet] })
      setTorchOn(!torchOn)
    } catch {
      setTorchSupported(false)
    }
  }

  return (
    <div style={{ position: 'relative', height: '40vh', minHeight: 220, background: '#000', borderRadius: 8, overflow: 'hidden' }}>
      <video
        ref={videoRef}
        playsInline
        muted
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
      {error && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 20, textAlign: 'center', color: 'var(--text)', background: 'rgba(0,0,0,0.75)', fontSize: 14,
        }}>
          {error}
        </div>
      )}
      {!error && (
        <div style={{
          position: 'absolute', left: '10%', right: '10%', top: '38%', height: '24%',
          border: '2px solid rgba(196,163,90,0.8)', borderRadius: 8, pointerEvents: 'none',
        }} />
      )}
      {torchSupported && (
        <button
          onClick={toggleTorch}
          aria-label="Kameralykt"
          style={{
            position: 'absolute', bottom: 10, right: 10, width: 44, height: 44, borderRadius: 22,
            border: 'none', fontSize: 20, cursor: 'pointer',
            background: torchOn ? 'var(--accent)' : 'rgba(0,0,0,0.55)',
          }}
        >
          🔦
        </button>
      )}
      {engine && !error && (
        <div style={{
          position: 'absolute', bottom: 10, left: 10, fontSize: 11, color: 'rgba(255,255,255,0.6)',
          background: 'rgba(0,0,0,0.45)', padding: '2px 8px', borderRadius: 10, fontFamily: 'sans-serif',
        }}>
          {engine === 'native' ? 'Native skanner' : 'ZXing'}
        </div>
      )}
      {paused && !error && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} />
      )}
    </div>
  )
}
