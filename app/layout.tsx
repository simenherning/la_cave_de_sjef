import type { Metadata, Viewport } from 'next'
import { Cormorant_Garamond, EB_Garamond } from 'next/font/google'
import './globals.css'
import Nav from '@/components/Nav'

// «Solbleket riviera»-designet: Cormorant til display/overskrifter/vinnavn,
// EB Garamond til brødtekst og labels. Eksponeres som CSS-variabler.
const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-display',
})
const ebGaramond = EB_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-body',
})

export const metadata: Metadata = {
  title: 'La Cave de Sjef',
  description: 'Wine cellar management',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'La Cave' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Låser zoom: hindrer autozoom ved inputfokus og dobbelttrykk-zoom under
  // skanning. (iOS tillater fortsatt knip-zoom av tilgjengelighetshensyn.)
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#f4ead6',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="no" className={`${cormorant.variable} ${ebGaramond.variable}`}>
      <body>
        <Nav />
        <main className="main-wrap">
          {children}
        </main>
      </body>
    </html>
  )
}
