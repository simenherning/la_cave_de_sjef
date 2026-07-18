// localStorage-persistens for tellingsøkten. Lagres etter hver eneste
// endring — en lukket/krasjet fane skal aldri koste mer enn siste skanning.

import type { Session } from './types.ts'

const KEY = 'vintelling-session-v1'

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as Session
    if (!s || !Array.isArray(s.wines) || !Array.isArray(s.scans)) return null
    return s
  } catch {
    return null
  }
}

export function saveSession(session: Session): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(session))
  } catch (e) {
    // localStorage full/blokkert — ikke krasj skanneflyten, men si fra i konsollen.
    console.error('Kunne ikke lagre tellingsøkt:', e)
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // ignorer
  }
}
