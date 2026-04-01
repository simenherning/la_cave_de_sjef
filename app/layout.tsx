import type { Metadata } from 'next'
import './globals.css'
import Nav from '@/components/Nav'

export const metadata: Metadata = {
  title: 'La Cave de Sjef',
  description: 'Wine cellar management',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="no">
      <body>
        <Nav />
        <main style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 20px' }}>
          {children}
        </main>
      </body>
    </html>
  )
}
