'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function SearchBox({ defaultValue, placeholder, basePath = '/' }: { defaultValue?: string; placeholder?: string; basePath?: string }) {
  const router = useRouter()
  const [query, setQuery] = useState(defaultValue || '')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams(window.location.search)
    if (query) {
      params.set('q', query)
    } else {
      params.delete('q')
    }
    params.delete('page')
    router.push(`${basePath}?${params.toString()}`)
  }

  return (
    <form onSubmit={handleSubmit} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder || "Search issues, repos, or organizations..."}
        className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-5 py-3 pl-12 text-base shadow-sm transition-shadow focus:border-zinc-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-800 dark:focus:border-zinc-600 dark:focus:ring-zinc-700"
      />
      <svg
        className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      {query && (
        <button
          type="button"
          onClick={() => {
            setQuery('')
            const params = new URLSearchParams(window.location.search)
            params.delete('q')
            params.delete('page')
            router.push(`${basePath}?${params.toString()}`)
          }}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </form>
  )
}
