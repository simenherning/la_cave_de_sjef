'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  { href: '/', label: 'Kjeller' },
  { href: '/stats', label: 'Statistikk' },
  { href: '/drinking-window', label: 'Drikkevindu' },
  { href: '/purchase-plan', label: 'Innkjøpsplan' },
]

export default function Nav() {
  const pathname = usePathname()
  return (
    <nav style={{
      borderBottom: '1px solid var(--border)',
      background: 'var(--bg-card)',
      padding: '0 20px',
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 0 }}>
        <Link href="/" style={{ color: 'var(--accent)', fontWeight: 700, fontSize: 18, marginRight: 32, textDecoration: 'none', padding: '16px 0' }}>
          La Cave de Sjef
        </Link>
        {links.map(l => (
          <Link
            key={l.href}
            href={l.href}
            style={{
              padding: '16px 14px',
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
