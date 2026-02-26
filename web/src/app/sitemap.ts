import type { MetadataRoute } from 'next'
import { getSiteUrl } from '@/lib/site'

const LANGUAGES = [
  'TypeScript', 'JavaScript', 'Python', 'Go', 'Rust',
  'Java', 'C++', 'Ruby', 'C#', 'PHP', 'Swift', 'Kotlin',
  'Dart', 'Scala', 'Shell', 'C', 'Elixir', 'Haskell',
]

const VIEWS = ['issues', 'repos', 'orgs']

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl()
  const now = new Date()

  const entries: MetadataRoute.Sitemap = [
    // Homepage
    {
      url: siteUrl,
      lastModified: now,
      changeFrequency: 'hourly',
      priority: 1,
    },
  ]

  // View pages
  for (const view of VIEWS) {
    entries.push({
      url: `${siteUrl}?view=${view}`,
      lastModified: now,
      changeFrequency: 'hourly',
      priority: 0.9,
    })
  }

  // Language-filtered pages
  for (const lang of LANGUAGES) {
    entries.push({
      url: `${siteUrl}?language=${encodeURIComponent(lang)}`,
      lastModified: now,
      changeFrequency: 'hourly',
      priority: 0.8,
    })
  }

  // Language + view combinations (top languages only)
  const topLanguages = LANGUAGES.slice(0, 10)
  for (const lang of topLanguages) {
    for (const view of VIEWS) {
      entries.push({
        url: `${siteUrl}?view=${view}&language=${encodeURIComponent(lang)}`,
        lastModified: now,
        changeFrequency: 'daily',
        priority: 0.7,
      })
    }
  }

  return entries
}
