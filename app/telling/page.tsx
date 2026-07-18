import type { Metadata } from 'next'
import TellingApp from '@/components/telling/TellingApp'

export const metadata: Metadata = {
  title: 'Vintelling – La Cave de Sjef',
  description: 'Varetelling av vinkjelleren mot CellarTracker',
}

export default function TellingPage() {
  return <TellingApp />
}
