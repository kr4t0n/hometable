// Scale a free-text quantity ("2", "1.5", "1/2", "1 1/2") by a factor.
// Non-numeric quantities ("a pinch") are returned unchanged.
export function scaleQuantity(q: string | null, factor: number): string | null {
  if (!q || factor === 1) return q
  const t = q.trim()

  const mixed = t.match(/^(\d+)\s+(\d+)\/(\d+)(.*)$/)
  if (mixed) {
    const val = (Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3])) * factor
    return format(val) + mixed[4]
  }
  const frac = t.match(/^(\d+)\/(\d+)(.*)$/)
  if (frac) {
    const val = (Number(frac[1]) / Number(frac[2])) * factor
    return format(val) + frac[3]
  }
  const dec = t.match(/^(\d+(?:\.\d+)?)(.*)$/)
  if (dec) {
    return format(Number(dec[1]) * factor) + dec[2]
  }
  return q
}

function format(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100)
}
