export function colorDotStyle(color: string | null): string {
  if (!color) return '#7a7268'
  const c = color.toLowerCase()
  if (c === 'red') return '#9b3a3a'
  if (c === 'white') return '#c4a35a'
  if (c === 'rosé' || c === 'rose') return '#b56b7a'
  return '#6b9eb5' // sparkling / other
}

export default function WineColorDot({ color }: { color: string | null }) {
  return (
    <span
      className="color-dot"
      style={{ background: colorDotStyle(color), display: 'inline-block', width: 8, height: 8, borderRadius: '50%', marginRight: 6, flexShrink: 0 }}
    />
  )
}
