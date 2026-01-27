'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

interface LanguageFilterProps {
  languages: { name: string; count: number }[]
  selected?: string
}

export default function LanguageFilter({ languages, selected }: LanguageFilterProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [showMore, setShowMore] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const topLanguages = languages.slice(0, 6)
  const moreLanguages = languages.slice(6)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowMore(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleClick = (lang: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (selected === lang) {
      params.delete('language')
    } else {
      params.set('language', lang)
    }
    params.delete('page')
    router.push(`/?${params.toString()}`)
    setShowMore(false)
  }

  const formatCount = (count: number) => {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}k`
    }
    return count.toString()
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {topLanguages.map((lang) => (
        <button
          key={lang.name}
          onClick={() => handleClick(lang.name)}
          className={`rounded-full border px-3 py-1.5 text-sm transition ${
            selected === lang.name
              ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
              : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-600'
          }`}
        >
          {lang.name}
          <span className="ml-1.5 text-xs opacity-60">{formatCount(lang.count)}</span>
        </button>
      ))}

      {moreLanguages.length > 0 && (
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowMore(!showMore)}
            className={`rounded-full border px-3 py-1.5 text-sm transition ${
              moreLanguages.some(l => l.name === selected)
                ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
                : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-600'
            }`}
          >
            {moreLanguages.some(l => l.name === selected)
              ? selected
              : `+${moreLanguages.length} more`}
            <span className="ml-1">▾</span>
          </button>

          {showMore && (
            <div className="absolute left-0 top-full z-50 mt-2 max-h-64 w-48 overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
              {moreLanguages.map((lang) => (
                <button
                  key={lang.name}
                  onClick={() => handleClick(lang.name)}
                  className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition hover:bg-zinc-50 dark:hover:bg-zinc-700 ${
                    selected === lang.name
                      ? 'bg-zinc-100 font-medium dark:bg-zinc-700'
                      : ''
                  }`}
                >
                  <span>{lang.name}</span>
                  <span className="text-xs text-zinc-500">{formatCount(lang.count)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {selected && (
        <button
          onClick={() => handleClick(selected)}
          className="rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-sm text-red-600 transition hover:bg-red-100 dark:border-red-900 dark:bg-red-950 dark:text-red-400"
        >
          Clear
        </button>
      )}
    </div>
  )
}
