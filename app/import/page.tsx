'use client'
import { useState, useRef } from 'react'
import Link from 'next/link'
import { ArrowLeft, Upload, CheckCircle, AlertCircle } from 'lucide-react'

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [result, setResult] = useState<Record<string, unknown> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleImport() {
    if (!file) return
    setStatus('loading')
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch('/api/import-csv', { method: 'POST', body: formData })
    const data = await res.json()
    if (res.ok) {
      setStatus('success')
      setResult(data)
    } else {
      setStatus('error')
      setResult(data)
    }
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', textDecoration: 'none', fontSize: 14, marginBottom: 24, fontFamily: 'sans-serif' }}>
        <ArrowLeft size={14} /> Tilbake
      </Link>

      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Importer CSV</h1>
      <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 32, fontFamily: 'sans-serif' }}>
        Last opp en CellarTracker-eksport (.csv). Viner med samme iWine-ID oppdateres, nye legges til.
      </p>

      <div className="card" style={{ padding: 32 }}>
        <div
          onClick={() => inputRef.current?.click()}
          style={{
            border: '2px dashed var(--border)',
            borderRadius: 8,
            padding: 40,
            textAlign: 'center',
            cursor: 'pointer',
            marginBottom: 20,
            transition: 'border-color 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
        >
          <Upload size={32} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
          <p style={{ color: 'var(--text)', marginBottom: 4 }}>
            {file ? file.name : 'Klikk for å velge CSV-fil'}
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, fontFamily: 'sans-serif' }}>
            CellarTracker-eksport format
          </p>
          <input
            ref={inputRef}
            type="file"
            accept=".csv"
            style={{ display: 'none' }}
            onChange={e => {
              setFile(e.target.files?.[0] ?? null)
              setStatus('idle')
              setResult(null)
            }}
          />
        </div>

        <button
          className="btn btn-primary"
          onClick={handleImport}
          disabled={!file || status === 'loading'}
          style={{ width: '100%', justifyContent: 'center' }}
        >
          {status === 'loading' ? 'Importerer...' : 'Importer'}
        </button>

        {status === 'success' && result && (
          <div style={{ marginTop: 16, padding: 16, background: '#5a9b5a22', borderRadius: 8, border: '1px solid #5a9b5a44', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <CheckCircle size={18} style={{ color: '#5a9b5a', flexShrink: 0, marginTop: 1 }} />
            <div>
              <p style={{ fontWeight: 600, marginBottom: 4 }}>Import vellykket!</p>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'sans-serif' }}>
                {result.parsed as number} viner behandlet · {result.upserted as number} oppdatert · {result.inserted as number} lagt til
              </p>
              <Link href="/" style={{ fontSize: 13, color: 'var(--accent)', textDecoration: 'none', display: 'inline-block', marginTop: 8 }}>
                Se kjelleren →
              </Link>
            </div>
          </div>
        )}

        {status === 'error' && result && (
          <div style={{ marginTop: 16, padding: 16, background: '#9b3a3a22', borderRadius: 8, border: '1px solid #9b3a3a44', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <AlertCircle size={18} style={{ color: '#9b3a3a', flexShrink: 0, marginTop: 1 }} />
            <div>
              <p style={{ fontWeight: 600, marginBottom: 4 }}>Import feilet</p>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'sans-serif' }}>{result.error as string}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
