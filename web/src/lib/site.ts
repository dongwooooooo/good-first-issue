export const SITE_NAME = 'Start Open Source'

export function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (!raw) return 'https://good-first-issue.vercel.app'
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw
  return `https://${raw}`
}

export const SITE_DESCRIPTION =
  'Find beginner-friendly open source issues by language, repository, and organization.'
