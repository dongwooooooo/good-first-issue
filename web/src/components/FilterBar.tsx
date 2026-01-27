'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'

const labels = ['good first issue', 'help wanted', 'beginner', 'easy']
const languages = ['JavaScript', 'TypeScript', 'Python', 'Go', 'Rust', 'Java', 'C++', 'Ruby', 'PHP']
const sortOptions = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'stars', label: 'Most Stars' },
]

export default function FilterBar() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const currentLabel = searchParams.get('label') || ''
  const currentLanguage = searchParams.get('language') || ''
  const currentSort = searchParams.get('sort') || 'newest'
  const currentSearch = searchParams.get('q') || ''

  const [searchInput, setSearchInput] = useState(currentSearch)

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    params.delete('page') // 필터 변경 시 첫 페이지로
    router.push(`/?${params.toString()}`)
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    updateFilter('q', searchInput)
  }

  return (
    <div className="space-y-4">
      {/* 검색 */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search issues or repos..."
          className="flex-1 rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />
        <button
          type="submit"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Search
        </button>
      </form>

      {/* 필터 */}
      <div className="flex flex-wrap gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Label
          </label>
          <select
            value={currentLabel}
            onChange={(e) => updateFilter('label', e.target.value)}
            className="mt-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          >
            <option value="">All labels</option>
            {labels.map((label) => (
              <option key={label} value={label}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Language
          </label>
          <select
            value={currentLanguage}
            onChange={(e) => updateFilter('language', e.target.value)}
            className="mt-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          >
            <option value="">All languages</option>
            {languages.map((lang) => (
              <option key={lang} value={lang}>
                {lang}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Sort by
          </label>
          <select
            value={currentSort}
            onChange={(e) => updateFilter('sort', e.target.value)}
            className="mt-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          >
            {sortOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {(currentLabel || currentLanguage || currentSearch) && (
          <div className="flex items-end">
            <button
              onClick={() => {
                setSearchInput('')
                router.push('/')
              }}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Clear all
            </button>
          </div>
        )}
      </div>
    </div>
  )
}