export function colorDotStyle(color: string | null): string {
  if (!color) return 'var(--text-muted)'
  const c = color.toLowerCase()
  if (c === 'red') return 'var(--red-wine)'
  if (c === 'white') return 'var(--white-wine)'
  if (c === 'rosé' || c === 'rose') return 'var(--rose)'
  return 'var(--sparkling)' // sparkling / other
}

export default function WineColorDot({ color }: { color: string | null }) {
  return (
    <span
      className="color-dot"
      style={{ background: colorDotStyle(color), display: 'inline-block', width: 9, height: 9, borderRadius: '50%', marginRight: 6, flexShrink: 0 }}
    />
  )
}
