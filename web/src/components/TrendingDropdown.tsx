'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

const periodOptions = [
  { value: '7', label: '1주일', desc: '최근 7일' },
  { value: '30', label: '1개월', desc: '최근 30일' },
  { value: '90', label: '3개월', desc: '최근 90일' },
  { value: '180', label: '6개월', desc: '최근 180일' },
  { value: '365', label: '1년', desc: '최근 1년' },
]

export default function TrendingDropdown({ isActive }: { isActive: boolean }) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const searchParams = useSearchParams()

  const currentPeriod = searchParams.get('period') || '30'
  const currentLabel = periodOptions.find(p => p.value === currentPeriod)?.label || '1개월'

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function selectPeriod(period: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('sort', 'trending')
    params.set('period', period)
    params.delete('page')
    router.push(`/?${params.toString()}`)
    setIsOpen(false)
  }

  function handleClick() {
    if (isActive) {
      setIsOpen(!isOpen)
    } else {
      const params = new URLSearchParams(searchParams.toString())
      params.set('sort', 'trending')
      params.set('period', currentPeriod)
      params.delete('page')
      router.push(`/?${params.toString()}`)
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleClick}
        className={`flex items-center gap-1 rounded-lg px-3 py-1 transition-colors ${
          isActive
            ? 'bg-zinc-200 font-medium text-zinc-900 dark:bg-zinc-700 dark:text-zinc-100'
            : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'
        }`}
      >
        <span>Trending</span>
        {isActive && (
          <>
            <span className="text-emerald-600 dark:text-emerald-400">({currentLabel})</span>
            <svg
              className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
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
        <div className="absolute right-0 top-full z-50 mt-2 w-48 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
          <div className="p-2">
            <div className="mb-2 px-2 text-xs font-medium text-zinc-400">기간 선택</div>
            {periodOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => selectPeriod(option.value)}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition-colors ${
                  currentPeriod === option.value
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                    : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700'
                }`}
              >
                <span className="font-medium">{option.label}</span>
                <span className="text-xs text-zinc-400">{option.desc}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
