'use client'

import { useRouter, useSearchParams } from 'next/navigation'

interface LanguageFilterProps {
  languages: { name: string; count: number }[]
  selected?: string
}

const languageColors: Record<string, string> = {
  TypeScript: 'bg-blue-500',
  JavaScript: 'bg-yellow-400',
  Python: 'bg-green-500',
  Go: 'bg-cyan-500',
  Rust: 'bg-orange-500',
  Java: 'bg-red-500',
  'C++': 'bg-purple-500',
  'C#': 'bg-green-600',
  Ruby: 'bg-red-600',
  PHP: 'bg-indigo-500',
  Swift: 'bg-orange-400',
  Kotlin: 'bg-violet-500',
  Shell: 'bg-green-400',
}

export default function LanguageFilter({ languages, selected }: LanguageFilterProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleClick = (lang: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (selected === lang) {
      params.delete('language')
    } else {
      params.set('language', lang)
    }
    params.delete('page')
    router.push(`/?${params.toString()}`)
  }

  return (
    <div className="flex flex-wrap justify-center gap-2">
      {languages.slice(0, 12).map((lang) => (
        <button
          key={lang.name}
          onClick={() => handleClick(lang.name)}
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition ${
            selected === lang.name
              ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
              : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-600'
          }`}
        >
          <span className={`h-2.5 w-2.5 rounded-full ${languageColors[lang.name] || 'bg-zinc-400'}`} />
          {lang.name}
        </button>
      ))}
    </div>
  )
}