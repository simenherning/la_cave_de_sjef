'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  { href: '/', label: 'Kjeller' },
  { href: '/stats', label: 'Statistikk' },
  { href: '/drinking-window', label: 'Drikkevindu' },
  { href: '/purchase-plan', label: 'Innkjøpsplan' },
  { href: '/telling', label: 'Telling' },
]

export default function Nav() {
  const pathname = usePathname()
  return (
    <nav style={{
      borderBottom: '1px solid var(--border)',
      background: 'var(--bg-card)',
      padding: '0 20px',
    }}>
      <div className="nav-scroll" style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 0, overflowX: 'auto', whiteSpace: 'nowrap' }}>
        <Link href="/" style={{ color: 'var(--accent)', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 21, marginRight: 20, textDecoration: 'none', padding: '12px 0', flexShrink: 0 }}>
          La Cave de Sjef
        </Link>
        {links.map(l => (
          <Link
            key={l.href}
            href={l.href}
            style={{
              padding: '14px 12px',
              color: pathname === l.href ? 'var(--text)' : 'var(--text-muted)',
              textDecoration: 'none',
              fontSize: 14,
              borderBottom: pathname === l.href ? '2px solid var(--accent)' : '2px solid transparent',
              transition: 'color 0.15s',
            }}
          >
            {l.label}
          </Link>
        ))}
      </div>
    </nav>
  )
}
