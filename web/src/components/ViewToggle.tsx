'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

const views = [
  { value: 'issues', label: 'Issues', icon: '📋' },
  { value: 'repos', label: 'Repos', icon: '📂' },
  { value: 'orgs', label: 'Orgs', icon: '🏢' },
]

export default function ViewToggle({ current }: { current: string }) {
  const searchParams = useSearchParams()

  const buildHref = (view: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('view', view)
    params.delete('page')
    params.delete('sort')
    return `/?${params.toString()}`
  }

  return (
    <div className="inline-flex rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800">
      {views.map((v) => (
        <Link
          key={v.value}
          href={buildHref(v.value)}
          className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition ${
            current === v.value
              ? 'bg-white text-zinc-900 shadow hover:bg-zinc-50 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600'
              : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
          }`}
        >
          <span>{v.icon}</span>
          <span>{v.label}</span>
        </Link>
      ))}
    </div>
  )
}
