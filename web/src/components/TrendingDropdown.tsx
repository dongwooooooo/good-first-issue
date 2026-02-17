'use client'

import { useState, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useClickOutside } from '@/hooks/useClickOutside'

export default function TrendingDropdown({ isActive }: { isActive: boolean }) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const searchParams = useSearchParams()

  // from: days ago start, to: days ago end (0 = today)
  const currentFrom = parseInt(searchParams.get('from') || '30')
  const currentTo = parseInt(searchParams.get('to') || '0')
  const currentMinStars = parseInt(searchParams.get('minStars') || '1000')

  const [fromDays, setFromDays] = useState(currentFrom)
  const [toDays, setToDays] = useState(currentTo)
  const [minStars, setMinStars] = useState(currentMinStars)

  useClickOutside(dropdownRef, () => setIsOpen(false))

  function applyFilter() {
    const params = new URLSearchParams(searchParams.toString())
    params.set('sort', 'trending')
    params.set('from', String(fromDays))
    params.set('to', String(toDays))
    params.set('minStars', String(minStars))
    params.delete('page')
    router.push(`/?${params.toString()}`)
    setIsOpen(false)
  }

  function handleClick() {
    if (isActive) {
      if (!isOpen) {
        setFromDays(currentFrom)
        setToDays(currentTo)
        setMinStars(currentMinStars)
      }
      setIsOpen(!isOpen)
    } else {
      const params = new URLSearchParams(searchParams.toString())
      params.set('sort', 'trending')
      params.set('from', '30')
      params.set('to', '0')
      params.set('minStars', '1000')
      params.delete('page')
      router.push(`/?${params.toString()}`)
    }
  }

  function formatRange() {
    const starsLabel = currentMinStars >= 1000 ? `${Math.floor(currentMinStars / 1000)}k+` : `${currentMinStars}+`
    if (currentTo === 0) {
      return `Last ${currentFrom}d · ${starsLabel}`
    }
    return `${currentFrom}d ago ~ ${currentTo}d ago · ${starsLabel}`
  }

  // Ensure from > to (from is further in the past)
  function handleFromChange(value: number) {
    const newFrom = Math.max(value, toDays + 1)
    setFromDays(newFrom)
  }

  function handleToChange(value: number) {
    const newTo = Math.min(value, fromDays - 1)
    setToDays(Math.max(0, newTo))
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleClick}
        className={`flex items-center gap-1.5 rounded-lg px-3 py-1 transition-colors ${
          isActive
            ? 'bg-zinc-200 font-medium text-zinc-900 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600'
            : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'
        }`}
      >
        <span>Trending</span>
        {isActive && (
          <>
            <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
              {formatRange()}
            </span>
            <svg
              className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-xl border border-zinc-200 bg-white p-4 shadow-xl dark:border-zinc-700 dark:bg-zinc-800">
          <div className="mb-4 text-sm font-medium text-zinc-700 dark:text-zinc-200">
            Date Range
          </div>

          {/* From slider */}
          <div className="mb-4">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-zinc-500">From</span>
              <span className="font-medium text-zinc-900 dark:text-zinc-100">{fromDays}d ago</span>
            </div>
            <input
              type="range"
              min="1"
              max="365"
              value={fromDays}
              onChange={(e) => handleFromChange(parseInt(e.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-zinc-200 accent-emerald-500 dark:bg-zinc-600"
            />
            <div className="mt-1 flex justify-between text-xs text-zinc-400">
              <span>1d</span>
              <span>1y</span>
            </div>
          </div>

          {/* To slider */}
          <div className="mb-4">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-zinc-500">To</span>
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {toDays === 0 ? 'Today' : `${toDays}d ago`}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="364"
              value={toDays}
              onChange={(e) => handleToChange(parseInt(e.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-zinc-200 accent-emerald-500 dark:bg-zinc-600"
            />
            <div className="mt-1 flex justify-between text-xs text-zinc-400">
              <span>Today</span>
              <span>364d ago</span>
            </div>
          </div>

          {/* Preview */}
          <div className="mb-4 rounded-lg bg-zinc-100 p-3 text-center dark:bg-zinc-700">
            <span className="text-sm text-zinc-600 dark:text-zinc-300">
              {toDays === 0 ? (
                <>Last <strong className="text-emerald-600 dark:text-emerald-400">{fromDays}d</strong> + ⭐ <strong className="text-emerald-600 dark:text-emerald-400">{minStars.toLocaleString()}+</strong></>
              ) : (
                <><strong className="text-emerald-600 dark:text-emerald-400">{fromDays}d ago</strong> ~ <strong className="text-emerald-600 dark:text-emerald-400">{toDays}d ago</strong> + ⭐ <strong className="text-emerald-600 dark:text-emerald-400">{minStars.toLocaleString()}+</strong></>
              )}
            </span>
          </div>

          {/* Min stars */}
          <div className="mb-4">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-zinc-500">Min Stars</span>
              <span className="font-medium text-zinc-900 dark:text-zinc-100">{minStars.toLocaleString()}+</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {[100, 500, 1000, 5000].map((preset) => (
                <button
                  key={preset}
                  onClick={() => setMinStars(preset)}
                  className={`rounded-md px-2 py-1 text-xs transition-colors ${
                    minStars === preset
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
                      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-600'
                  }`}
                >
                  {preset >= 1000 ? `${preset / 1000}k+` : `${preset}+`}
                </button>
              ))}
            </div>
          </div>

          {/* Quick presets */}
          <div className="mb-4 flex flex-wrap gap-1.5">
            {[
              { label: '1w', from: 7, to: 0 },
              { label: '1mo', from: 30, to: 0 },
              { label: '3mo', from: 90, to: 0 },
              { label: '6mo', from: 180, to: 0 },
              { label: '1y', from: 365, to: 0 },
            ].map((preset) => (
              <button
                key={preset.label}
                onClick={() => { setFromDays(preset.from); setToDays(preset.to) }}
                className={`rounded-md px-2 py-1 text-xs transition-colors ${
                  fromDays === preset.from && toDays === preset.to
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-600'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Apply button */}
          <button
            onClick={applyFilter}
            className="w-full rounded-lg bg-emerald-500 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-600"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  )
}
