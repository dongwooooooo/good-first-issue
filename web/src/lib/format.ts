export function formatCount(n: number, decimals = 1): string {
  if (n >= 1000) return `${(n / 1000).toFixed(decimals)}k`
  return n.toString()
}
