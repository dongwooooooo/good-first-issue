export function sanitizeSearchQuery(input: string): string {
  return input.replace(/[,.()\\/]/g, '').trim().slice(0, 200)
}

export function sanitizeSearchParams(params: Record<string, string | undefined>) {
  return {
    q: params.q ? sanitizeSearchQuery(params.q) : undefined,
    page: Math.max(1, Math.min(parseInt(params.page || '1') || 1, 1000)),
    from: Math.max(1, Math.min(parseInt(params.from || '30') || 30, 365)),
    to: Math.max(0, Math.min(parseInt(params.to || '0') || 0, 365)),
    minStars: Math.max(0, Math.min(parseInt(params.minStars || '1000') || 1000, 1000000)),
    language: params.language?.slice(0, 50),
    org: params.org?.slice(0, 100),
    sort: ['newest', 'oldest', 'stars', 'trending', 'issues', 'repos', 'name'].includes(params.sort || '')
      ? params.sort
      : undefined,
  }
}
