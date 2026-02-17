import { supabase, Issue } from '@/lib/supabase'
import Link from 'next/link'
import Image from 'next/image'
import IssueCard from '@/components/IssueCard'
import SearchBox from '@/components/SearchBox'
import Pagination from '@/components/Pagination'
import ViewToggle from '@/components/ViewToggle'
import LanguageFilter from '@/components/LanguageFilter'
import TrendingDropdown from '@/components/TrendingDropdown'
import { sanitizeSearchParams } from '@/lib/sanitize'

const PAGE_SIZE = 24

interface RepoGroup {
  repo_full_name: string
  repo_owner: string
  language: string | null
  stars: number | null
  issue_count: number
}

interface OrgGroup {
  org_name: string
  repo_count: number
  issue_count: number
  top_language: string | null
  max_stars: number | null
}

async function getIssues(params: {
  language?: string
  org?: string
  q?: string
  page?: string | number
  sort?: string
  from?: string | number
  to?: string | number
  minStars?: string | number
}) {
  if (!supabase) return { issues: [], total: 0 }

  const page = parseInt(String(params.page || '1'))
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1
  const sort = params.sort || 'newest'

  let query = supabase
    .from('issues')
    .select('*', { count: 'exact' })
    .eq('is_open', true)

  if (params.q) {
    query = query.or(`title.ilike.%${params.q}%,repo_full_name.ilike.%${params.q}%`)
  }
  if (params.language) {
    query = query.eq('language', params.language)
  }
  if (params.org) {
    query = query.eq('repo_owner', params.org)
  }

  if (sort === 'stars') {
    query = query.order('stars', { ascending: false, nullsFirst: false })
  } else if (sort === 'trending') {
    // Trending: stars order within selected date range + min stars
    const fromDays = parseInt(String(params.from || '30'))
    const toDays = parseInt(String(params.to || '0'))
    const minStars = parseInt(String(params.minStars || '1000'))

    const fromDate = new Date()
    fromDate.setDate(fromDate.getDate() - fromDays)

    const toDate = new Date()
    toDate.setDate(toDate.getDate() - toDays)

    query = query
      .gte('created_at', fromDate.toISOString())
      .lte('created_at', toDate.toISOString())
      .gte('stars', minStars)
      .order('created_at', { ascending: false })
      .order('stars', { ascending: false, nullsFirst: false })
  } else if (sort === 'oldest') {
    query = query.order('created_at', { ascending: true })
  } else {
    query = query.order('created_at', { ascending: false })
  }

  query = query.range(from, to)

  const { data, error, count } = await query
  if (error) {
    console.error('Error fetching issues:', error)
    return { issues: [], total: 0 }
  }

  return { issues: data as Issue[], total: count || 0 }
}

async function getRepoGroups(params: {
  language?: string
  q?: string
  sort?: string
  page?: string | number
}): Promise<{ repos: RepoGroup[]; total: number }> {
  if (!supabase) return { repos: [], total: 0 }

  const page = parseInt(String(params.page || '1'))
  const pageSize = 30
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const sort = params.sort || 'issues'
  const orderColumn = sort === 'stars' ? 'stars' : sort === 'name' ? 'repo_full_name' : 'issue_count'
  const ascending = sort === 'name'

  let query = supabase
    .from('repo_stats')
    .select('*', { count: 'exact' })

  if (params.q) {
    query = query.or(`repo_full_name.ilike.%${params.q}%,repo_owner.ilike.%${params.q}%`)
  }
  if (params.language) {
    query = query.eq('language', params.language)
  }

  query = query.order(orderColumn, { ascending, nullsFirst: false }).range(from, to)

  const { data, error, count } = await query
  if (error || !data) return { repos: [], total: 0 }

  return {
    repos: data.map(row => ({
      repo_full_name: row.repo_full_name,
      repo_owner: row.repo_owner,
      language: row.language,
      stars: row.stars,
      issue_count: row.issue_count,
    })),
    total: count || 0,
  }
}

async function getOrgGroups(params: {
  language?: string
  q?: string
  sort?: string
  page?: string | number
}): Promise<{ orgs: OrgGroup[]; total: number }> {
  if (!supabase) return { orgs: [], total: 0 }

  const page = parseInt(String(params.page || '1'))
  const pageSize = 30
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const sort = params.sort || 'issues'
  const orderColumn = sort === 'stars' ? 'max_stars' : sort === 'repos' ? 'repo_count' : sort === 'name' ? 'org_name' : 'issue_count'
  const ascending = sort === 'name'

  let query = supabase
    .from('org_stats')
    .select('*', { count: 'exact' })

  if (params.q) {
    query = query.ilike('org_name', `%${params.q}%`)
  }
  // Note: language filter not directly available on org_stats
  // Would need to join or filter differently if needed

  query = query.order(orderColumn, { ascending, nullsFirst: false }).range(from, to)

  const { data, error, count } = await query
  if (error || !data) return { orgs: [], total: 0 }

  return {
    orgs: data.map(row => ({
      org_name: row.org_name,
      repo_count: row.repo_count,
      issue_count: row.issue_count,
      max_stars: row.max_stars,
      top_language: row.top_language,
    })),
    total: count || 0,
  }
}

async function getLanguages(): Promise<{ name: string; count: number }[]> {
  if (!supabase) return []

  // Use language_stats materialized view
  const { data, error } = await supabase
    .from('language_stats')
    .select('language, issue_count')
    .order('issue_count', { ascending: false })
    .limit(20)

  if (error || !data) return []

  return data.map(row => ({
    name: row.language,
    count: row.issue_count,
  }))
}

async function getStats() {
  if (!supabase) return { totalIssues: 0 }
  const { count } = await supabase
    .from('issues')
    .select('*', { count: 'exact', head: true })
    .eq('is_open', true)
  return { totalIssues: count || 0 }
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string
    language?: string
    org?: string
    q?: string
    page?: string
    sort?: string
    from?: string
    to?: string
    minStars?: string
  }>
}) {
  const rawParams = await searchParams
  const params = sanitizeSearchParams(rawParams)
  const view = rawParams.view || 'issues'
  const isUnifiedSearch = Boolean(params.q?.trim())

  const [languages, { totalIssues }] = await Promise.all([
    getLanguages(),
    getStats()
  ])

  let issues: Issue[] = []
  let issueTotal = 0
  let repoGroups: RepoGroup[] = []
  let repoTotal = 0
  let orgGroups: OrgGroup[] = []
  let orgTotal = 0

  if (isUnifiedSearch) {
    const [issueResult, repoResult, orgResult] = await Promise.all([
      getIssues({ ...params, page: '1' }),
      getRepoGroups({ ...params, page: '1' }),
      getOrgGroups({ ...params, page: '1' }),
    ])
    issues = issueResult.issues
    issueTotal = issueResult.total
    repoGroups = repoResult.repos
    repoTotal = repoResult.total
    orgGroups = orgResult.orgs
    orgTotal = orgResult.total
  } else if (view === 'repos') {
    const result = await getRepoGroups(params)
    repoGroups = result.repos
    repoTotal = result.total
  } else if (view === 'orgs') {
    const result = await getOrgGroups(params)
    orgGroups = result.orgs
    orgTotal = result.total
  } else {
    const result = await getIssues(params)
    issues = result.issues
    issueTotal = result.total
  }

  const total = view === 'repos' ? repoTotal : view === 'orgs' ? orgTotal : issueTotal

  const currentPage = parseInt(String(params.page || '1'))
  const pageSize = view === 'issues' ? PAGE_SIZE : 30
  const totalPages = Math.ceil(total / pageSize)
  const hasFilters = params.q || params.language || params.org

  function buildViewHref(nextView: 'issues' | 'repos' | 'orgs') {
    const sp = new URLSearchParams()
    sp.set('view', nextView)
    if (params.q) sp.set('q', params.q)
    if (params.language) sp.set('language', params.language)
    if (params.org) sp.set('org', params.org)
    return `/?${sp.toString()}`
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 font-bold text-zinc-900 dark:text-zinc-50">
            <Image src="/favicon.png" alt="Start Open Source" width={24} height={24} />
            <span className="hidden sm:inline">Start Open Source</span>
          </Link>
          <span className="text-sm text-zinc-500">
            <strong className="text-emerald-600 dark:text-emerald-400">{totalIssues.toLocaleString()}</strong> issues
          </span>
        </div>
      </header>

      {/* Search & Filters */}
      <section className="border-b border-zinc-200 bg-white px-4 py-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-xl">
            <SearchBox defaultValue={params.q} placeholder="Search..." />
          </div>

          {/* View Toggle */}
          <div className="mt-6 flex justify-center">
            <ViewToggle current={view} />
          </div>

          {/* Language Filter */}
          <div className="mt-4">
            <LanguageFilter languages={languages} selected={params.language} />
          </div>
        </div>
      </section>

      {/* Active Filters */}
      {hasFilters && (
        <div className="border-b border-zinc-200 bg-zinc-100 px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900/50">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2">
            <span className="text-sm text-zinc-500">Filters:</span>
            {params.q && <FilterBadge label={`"${params.q}"`} paramToRemove="q" params={params} />}
            {params.language && <FilterBadge label={params.language} paramToRemove="language" params={params} />}
            {params.org && <FilterBadge label={params.org} paramToRemove="org" params={params} />}
            <Link href={`/?view=${view}`} className="text-sm text-zinc-500 hover:text-zinc-700">
              Clear all
            </Link>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="mx-auto max-w-6xl px-4 py-6">
        {isUnifiedSearch ? (
          <>
            <div className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
              <strong>{(issueTotal + repoTotal + orgTotal).toLocaleString()}</strong> combined results
            </div>

            <section className="mb-10">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Issues</h2>
                <Link className="text-sm text-emerald-600 hover:underline" href={buildViewHref('issues')}>
                  View all {issueTotal.toLocaleString()}
                </Link>
              </div>
              {issues.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {issues.slice(0, 9).map((issue) => (
                    <IssueCard key={issue.id} issue={issue} />
                  ))}
                </div>
              ) : (
                <EmptyState />
              )}
            </section>

            <section className="mb-10">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Repositories</h2>
                <Link className="text-sm text-emerald-600 hover:underline" href={buildViewHref('repos')}>
                  View all {repoTotal.toLocaleString()}
                </Link>
              </div>
              {repoGroups.length > 0 ? (
                <div className="space-y-3">
                  {repoGroups.slice(0, 8).map((repo) => (
                    <RepoCard key={repo.repo_full_name} repo={repo} />
                  ))}
                </div>
              ) : (
                <EmptyState />
              )}
            </section>

            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Organizations</h2>
                <Link className="text-sm text-emerald-600 hover:underline" href={buildViewHref('orgs')}>
                  View all {orgTotal.toLocaleString()}
                </Link>
              </div>
              {orgGroups.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {orgGroups.slice(0, 9).map((org) => (
                    <OrgCard key={org.org_name} org={org} />
                  ))}
                </div>
              ) : (
                <EmptyState />
              )}
            </section>
          </>
        ) : (
          <>
            {/* Issues View */}
            {view === 'issues' && (
              <>
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {hasFilters ? (
                      <><strong>{total.toLocaleString()}</strong> results</>
                    ) : (
                      <>Latest issues</>
                    )}
                  </p>
                  <SortLinks
                    view="issues"
                    current={params.sort}
                    searchParams={{ language: params.language, q: params.q, org: params.org }}
                  />
                </div>

                {issues.length > 0 ? (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {issues.map((issue) => (
                      <IssueCard key={issue.id} issue={issue} />
                    ))}
                  </div>
                ) : (
                  <EmptyState />
                )}

                {totalPages > 1 && (
                  <div className="mt-8">
                    <Pagination currentPage={currentPage} totalPages={totalPages} total={total} />
                  </div>
                )}
              </>
            )}

            {/* Repos View */}
            {view === 'repos' && (
              <>
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    <strong>{total.toLocaleString()}</strong> repositories
                  </p>
                  <SortLinks view="repos" current={params.sort} />
                </div>

                {repoGroups.length > 0 ? (
                  <div className="space-y-3">
                    {repoGroups.map((repo) => (
                      <RepoCard key={repo.repo_full_name} repo={repo} />
                    ))}
                  </div>
                ) : (
                  <EmptyState />
                )}

                {totalPages > 1 && (
                  <div className="mt-8">
                    <Pagination currentPage={currentPage} totalPages={totalPages} total={total} />
                  </div>
                )}
              </>
            )}

            {/* Orgs View */}
            {view === 'orgs' && (
              <>
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    <strong>{total.toLocaleString()}</strong> organizations
                  </p>
                  <SortLinks view="orgs" current={params.sort} />
                </div>

                {orgGroups.length > 0 ? (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {orgGroups.map((org) => (
                      <OrgCard key={org.org_name} org={org} />
                    ))}
                  </div>
                ) : (
                  <EmptyState />
                )}

                {totalPages > 1 && (
                  <div className="mt-8">
                    <Pagination currentPage={currentPage} totalPages={totalPages} total={total} />
                  </div>
                )}
              </>
            )}
          </>
        )}
      </main>
    </div>
  )
}

function FilterBadge({ label, paramToRemove, params }: { label: string; paramToRemove: string; params: Record<string, string | number | undefined> }) {
  const newParams = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (key !== paramToRemove && value !== undefined) newParams.set(key, String(value))
  })
  const href = newParams.toString() ? `/?${newParams.toString()}` : '/'

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-sm dark:bg-zinc-800">
      {label}
      <Link href={href} className="ml-1 text-zinc-400 hover:text-red-500">×</Link>
    </span>
  )
}

function SortLinks({ view, current, searchParams }: {
  view: string
  current?: string
  searchParams?: Record<string, string | undefined>
}) {
  const options = view === 'issues'
    ? [
        { value: 'newest', label: 'Newest' },
        { value: 'stars', label: 'Stars' },
      ]
    : view === 'repos'
    ? [
        { value: 'issues', label: 'Issues' },
        { value: 'stars', label: 'Stars' },
        { value: 'name', label: 'Name' },
      ]
    : [
        { value: 'issues', label: 'Issues' },
        { value: 'repos', label: 'Repos' },
        { value: 'stars', label: 'Stars' },
      ]

  const defaultSort = view === 'issues' ? 'newest' : 'issues'
  const currentSort = current || defaultSort

  function buildHref(sort: string) {
    const params = new URLSearchParams()
    params.set('view', view)
    params.set('sort', sort)
    if (searchParams?.language) params.set('language', searchParams.language)
    if (searchParams?.q) params.set('q', searchParams.q)
    if (searchParams?.org) params.set('org', searchParams.org)
    return `/?${params.toString()}`
  }

  return (
    <div className="flex items-center gap-1 text-sm">
      {options.map((opt) => (
        <Link
          key={opt.value}
          href={buildHref(opt.value)}
          className={`rounded-lg px-3 py-1 ${
            currentSort === opt.value
              ? 'bg-zinc-200 font-medium text-zinc-900 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600'
              : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'
          }`}
        >
          {opt.label}
        </Link>
      ))}
      {view === 'issues' && (
        <TrendingDropdown isActive={currentSort === 'trending'} />
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-4xl">🔍</div>
      <p className="mt-4 text-lg font-medium text-zinc-900 dark:text-zinc-100">No results found</p>
      <Link href="/" className="mt-4 inline-block text-blue-600 hover:underline">
        Reset filters
      </Link>
    </div>
  )
}

const languageColors: Record<string, string> = {
  TypeScript: 'bg-blue-500', JavaScript: 'bg-yellow-400', Python: 'bg-green-500',
  Go: 'bg-cyan-500', Rust: 'bg-orange-500', Java: 'bg-red-500',
  'C++': 'bg-purple-500', Ruby: 'bg-red-600', 'C#': 'bg-green-600', PHP: 'bg-indigo-500',
}

function RepoCard({ repo }: { repo: RepoGroup }) {
  return (
    <Link
      href={`/?q=${encodeURIComponent(repo.repo_full_name)}`}
      className="block rounded-xl border border-zinc-200 bg-white p-4 transition hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-medium text-zinc-900 dark:text-zinc-100">
            {repo.repo_full_name}
          </h3>
          <div className="mt-1 flex items-center gap-3 text-sm text-zinc-500">
            {repo.language && (
              <span className="flex items-center gap-1">
                <span className={`h-2.5 w-2.5 rounded-full ${languageColors[repo.language] || 'bg-zinc-400'}`} />
                {repo.language}
              </span>
            )}
            {repo.stars !== null && (
              <span>⭐ {repo.stars >= 1000 ? `${(repo.stars / 1000).toFixed(1)}k` : repo.stars}</span>
            )}
          </div>
        </div>
        <span className="ml-2 shrink-0 rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
          {repo.issue_count} issues
        </span>
      </div>
    </Link>
  )
}

function OrgCard({ org }: { org: OrgGroup }) {
  return (
    <Link
      href={`/?org=${encodeURIComponent(org.org_name)}`}
      className="block rounded-xl border border-zinc-200 bg-white p-4 transition hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-lg font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
          {org.org_name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-medium text-zinc-900 dark:text-zinc-100">
            {org.org_name}
          </h3>
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <span>{org.repo_count} repos</span>
            {org.top_language && (
              <span className="flex items-center gap-1">
                <span className={`h-2 w-2 rounded-full ${languageColors[org.top_language] || 'bg-zinc-400'}`} />
                {org.top_language}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
          {org.issue_count} issues
        </span>
        {org.max_stars && (
          <span className="text-sm text-zinc-500">
            ⭐ {org.max_stars >= 1000 ? `${(org.max_stars / 1000).toFixed(0)}k` : org.max_stars}
          </span>
        )}
      </div>
    </Link>
  )
}
