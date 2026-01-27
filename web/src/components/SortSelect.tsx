'use client'

import { useRouter, useSearchParams } from 'next/navigation'

interface Option {
  value: string
  label: string
}

export default function SortSelect({
  options,
  paramName = 'sort',
  defaultValue,
}: {
  options: Option[]
  paramName?: string
  defaultValue?: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const current = searchParams.get(paramName) || defaultValue || options[0]?.value

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set(paramName, value)
    router.push(`?${params.toString()}`)
  }

  return (
    <select
      value={current}
      onChange={(e) => handleChange(e.target.value)}
      className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
    >
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  )
}
