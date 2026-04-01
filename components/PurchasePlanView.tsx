'use client'
import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { Wine, CellarTarget } from '@/lib/types'
import WineColorDot from './WineColorDot'

interface Props {
  wines: Wine[]
  targets: CellarTarget[]
}

function currentCount(wines: Wine[], key: string, value: string): number {
  return wines.filter(w => (w[key as keyof Wine] as string)?.toLowerCase() === value.toLowerCase())
    .reduce((s, w) => s + w.quantity, 0)
}

export default function PurchasePlanView({ wines, targets: initialTargets }: Props) {
  const [targets, setTargets] = useState(initialTargets)
  const [showAdd, setShowAdd] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newKey, setNewKey] = useState('color')
  const [newValue, setNewValue] = useState('')
  const [newTarget, setNewTarget] = useState('')
  const [saving, setSaving] = useState(false)

  const totalBottles = wines.reduce((s, w) => s + w.quantity, 0)

  // Quick suggestions based on cellar content
  const colorBreakdown = ['Red', 'White', 'Rosé'].map(color => ({
    color,
    count: wines.filter(w => w.color === color).reduce((s, w) => s + w.quantity, 0),
    pct: Math.round(wines.filter(w => w.color === color).reduce((s, w) => s + w.quantity, 0) / totalBottles * 100),
  }))

  async function addTarget() {
    if (!newLabel || !newValue || !newTarget) return
    setSaving(true)
    const res = await fetch('/api/targets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: newLabel, filter_key: newKey, filter_value: newValue, target_quantity: parseInt(newTarget) }),
    })
    if (res.ok) {
      const { data } = await res.json()
      setTargets(prev => [...prev, data])
      setNewLabel(''); setNewValue(''); setNewTarget(''); setShowAdd(false)
    }
    setSaving(false)
  }

  async function removeTarget(id: number) {
    await fetch(`/api/targets?id=${id}`, { method: 'DELETE' })
    setTargets(prev => prev.filter(t => t.id !== id))
  }

  const needsToBuy = targets.map(t => {
    const current = currentCount(wines, t.filter_key, t.filter_value)
    const gap = t.target_quantity - current
    return { ...t, current, gap }
  }).filter(t => t.gap > 0)

  const overTarget = targets.map(t => {
    const current = currentCount(wines, t.filter_key, t.filter_value)
    const surplus = current - t.target_quantity
    return { ...t, current, surplus }
  }).filter(t => t.surplus > 0)

  return (
    <div>
      <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 8 }}>Innkjøpsplan</h1>
      <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 28, fontFamily: 'sans-serif' }}>
        Sett målprofil for kjelleren og se hva du bør kjøpe
      </p>

      {/* Current cellar overview */}
      <div className="card" style={{ padding: 24, marginBottom: 24 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Nåværende kjellerprofil</h3>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
          {colorBreakdown.map(({ color, count, pct }) => (
            <div key={color} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <WineColorDot color={color} />
              <span style={{ fontSize: 14 }}>{color === 'Red' ? 'Rød' : color === 'White' ? 'Hvit' : 'Rosé'}</span>
              <span style={{ fontFamily: 'sans-serif', fontSize: 13 }}>{count} fl.</span>
              <span style={{ color: 'var(--text-muted)', fontSize: 12, fontFamily: 'sans-serif' }}>({pct}%)</span>
            </div>
          ))}
        </div>
        <div style={{ color: 'var(--text-muted)', fontSize: 13, fontFamily: 'sans-serif' }}>
          Totalt {totalBottles} flasker
        </div>
      </div>

      {/* Targets */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600 }}>Mål for kjelleren</h2>
        <button className="btn btn-primary" onClick={() => setShowAdd(!showAdd)}>
          <Plus size={14} /> Legg til mål
        </button>
      </div>

      {showAdd && (
        <div className="card" style={{ padding: 20, marginBottom: 20, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 140px' }}>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4, fontFamily: 'sans-serif' }}>Navn</label>
            <input placeholder="f.eks. Burgund" value={newLabel} onChange={e => setNewLabel(e.target.value)} />
          </div>
          <div style={{ flex: '0 0 130px' }}>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4, fontFamily: 'sans-serif' }}>Filter</label>
            <select value={newKey} onChange={e => setNewKey(e.target.value)}>
              <option value="color">Farge</option>
              <option value="country">Land</option>
              <option value="region">Region</option>
              <option value="master_varietal">Drue</option>
              <option value="appellation">Appellation</option>
            </select>
          </div>
          <div style={{ flex: '1 1 140px' }}>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4, fontFamily: 'sans-serif' }}>Verdi</label>
            <input placeholder="f.eks. Burgundy / Red" value={newValue} onChange={e => setNewValue(e.target.value)} />
          </div>
          <div style={{ flex: '0 0 100px' }}>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4, fontFamily: 'sans-serif' }}>Mål (fl.)</label>
            <input type="number" placeholder="20" value={newTarget} onChange={e => setNewTarget(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={addTarget} disabled={saving}>
            {saving ? 'Lagrer...' : 'Lagre'}
          </button>
          <button className="btn btn-ghost" onClick={() => setShowAdd(false)}>Avbryt</button>
        </div>
      )}

      {targets.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
          Ingen mål satt ennå. Legg til mål for å se innkjøpsanbefalinger.
        </div>
      ) : (
        <>
          <div className="card" style={{ marginBottom: 24 }}>
            <table>
              <thead>
                <tr>
                  <th>Kategori</th>
                  <th>Filter</th>
                  <th style={{ textAlign: 'right' }}>Har</th>
                  <th style={{ textAlign: 'right' }}>Mål</th>
                  <th style={{ textAlign: 'right' }}>Gap</th>
                  <th style={{ width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {targets.map(t => {
                  const current = currentCount(wines, t.filter_key, t.filter_value)
                  const gap = t.target_quantity - current
                  return (
                    <tr key={t.id}>
                      <td style={{ fontWeight: 500 }}>{t.label}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 13, fontFamily: 'sans-serif' }}>
                        {t.filter_key}: {t.filter_value}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'sans-serif' }}>{current}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'sans-serif' }}>{t.target_quantity}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'sans-serif', fontWeight: 600, color: gap > 0 ? '#c4803a' : gap < 0 ? '#9b3a3a' : '#5a9b5a' }}>
                        {gap > 0 ? `+${gap}` : gap < 0 ? gap : '✓'}
                      </td>
                      <td>
                        <button onClick={() => removeTarget(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {needsToBuy.length > 0 && (
            <div className="card" style={{ padding: 20, marginBottom: 20, borderColor: '#c4803a44' }}>
              <h3 style={{ fontSize: 14, color: '#c4803a', marginBottom: 12, fontFamily: 'sans-serif', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Kjøp</h3>
              {needsToBuy.map(t => (
                <div key={t.id} style={{ marginBottom: 8, fontSize: 14 }}>
                  <span style={{ fontWeight: 500 }}>{t.label}</span>
                  <span style={{ color: 'var(--text-muted)', marginLeft: 8, fontFamily: 'sans-serif' }}>
                    — kjøp {t.gap} flasker ({t.current}/{t.target_quantity})
                  </span>
                </div>
              ))}
            </div>
          )}

          {overTarget.length > 0 && (
            <div className="card" style={{ padding: 20, borderColor: '#9b3a3a44' }}>
              <h3 style={{ fontSize: 14, color: '#9b6b3a', marginBottom: 12, fontFamily: 'sans-serif', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Over mål</h3>
              {overTarget.map(t => (
                <div key={t.id} style={{ marginBottom: 8, fontSize: 14 }}>
                  <span style={{ fontWeight: 500 }}>{t.label}</span>
                  <span style={{ color: 'var(--text-muted)', marginLeft: 8, fontFamily: 'sans-serif' }}>
                    — {t.surplus} over mål ({t.current}/{t.target_quantity})
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
