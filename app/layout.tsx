import type { Metadata, Viewport } from 'next'
import './globals.css'
import Nav from '@/components/Nav'

export const metadata: Metadata = {
  title: 'La Cave de Sjef',
  description: 'Wine cellar management',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'La Cave' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Låser zoom: hindrer autozoom ved inputfokus og dobbelttrykk-zoom under
  // skanning. (iOS tillater fortsatt knip-zoom av tilgjengelighetshensyn.)
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#0f0e0c',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="no">
      <body>
        <Nav />
        <main className="main-wrap">
          {children}
        </main>
      </body>
    </html>
  )
}
