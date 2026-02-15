'use client'

import { useRouter, useSearchParams } from 'next/navigation'

interface PaginationProps {
  currentPage: number
  totalPages: number
  total: number
}

export default function Pagination({ currentPage, totalPages, total }: PaginationProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function goToPage(page: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', page.toString())
    router.push(`/?${params.toString()}`)
  }

  // 표시할 페이지 번호 계산
  const pages: number[] = []
  const showPages = 5
  let start = Math.max(1, currentPage - Math.floor(showPages / 2))
  const end = Math.min(totalPages, start + showPages - 1)

  if (end - start + 1 < showPages) {
    start = Math.max(1, end - showPages + 1)
  }

  for (let i = start; i <= end; i++) {
    pages.push(i)
  }

  return (
    <div className="mt-8 flex flex-col items-center gap-4">
      <div className="flex items-center gap-2">
        <button
          onClick={() => goToPage(1)}
          disabled={currentPage === 1}
          className="pagination-btn rounded-md border border-zinc-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700"
        >
          ««
        </button>
        <button
          onClick={() => goToPage(currentPage - 1)}
          disabled={currentPage === 1}
          className="pagination-btn rounded-md border border-zinc-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700"
        >
          «
        </button>

        {start > 1 && (
          <span className="px-2 text-zinc-400">...</span>
        )}

        {pages.map((page) => (
          <button
            key={page}
            onClick={() => goToPage(page)}
            className={`rounded-md px-3 py-2 text-sm ${
              page === currentPage
                ? 'pagination-btn border border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
                : 'pagination-btn border border-zinc-300 dark:border-zinc-700'
            }`}
          >
            {page}
          </button>
        ))}

        {end < totalPages && (
          <span className="px-2 text-zinc-400">...</span>
        )}

        <button
          onClick={() => goToPage(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="pagination-btn rounded-md border border-zinc-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700"
        >
          »
        </button>
        <button
          onClick={() => goToPage(totalPages)}
          disabled={currentPage === totalPages}
          className="pagination-btn rounded-md border border-zinc-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700"
        >
          »»
        </button>
      </div>

      <div className="text-sm text-zinc-500">
        Page {currentPage} of {totalPages.toLocaleString()} ({total.toLocaleString()} issues)
      </div>
    </div>
  )
}
