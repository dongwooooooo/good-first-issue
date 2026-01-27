import { Issue } from '@/lib/supabase'

const labelColors: Record<string, string> = {
  'good first issue': 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300',
  'help wanted': 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300',
  'beginner': 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
  'easy': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300',
}

function getLabelColor(label: string): string {
  const lowerLabel = label.toLowerCase()
  for (const [key, value] of Object.entries(labelColors)) {
    if (lowerLabel.includes(key)) return value
  }
  return 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
}

function timeAgo(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)
  const days = Math.floor(seconds / 86400)

  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (days < 30) return `${days}d ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

const languageColors: Record<string, string> = {
  TypeScript: 'bg-blue-500',
  JavaScript: 'bg-yellow-400',
  Python: 'bg-green-500',
  Go: 'bg-cyan-500',
  Rust: 'bg-orange-500',
  Java: 'bg-red-500',
  'C++': 'bg-purple-500',
  Ruby: 'bg-red-600',
}

export default function IssueCard({ issue }: { issue: Issue }) {
  return (
    <a
      href={issue.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col rounded-xl border border-zinc-200 bg-white p-4 transition-all hover:border-zinc-300 hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          {issue.language && (
            <span className="flex items-center gap-1">
              <span className={`h-2.5 w-2.5 rounded-full ${languageColors[issue.language] || 'bg-zinc-400'}`} />
              {issue.language}
            </span>
          )}
          {issue.stars !== null && issue.stars !== undefined && (
            <span className="flex items-center gap-0.5">
              <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              {issue.stars >= 1000 ? `${(issue.stars / 1000).toFixed(1)}k` : issue.stars}
            </span>
          )}
        </div>
        <span className="shrink-0 text-xs text-zinc-400">{timeAgo(issue.created_at)}</span>
      </div>

      {/* Repo */}
      <p className="mt-2 text-sm font-medium text-zinc-500 dark:text-zinc-400">
        {issue.repo_full_name}
      </p>

      {/* Title */}
      <h3 className="mt-1 flex-1 font-medium leading-snug text-zinc-900 group-hover:text-blue-600 dark:text-zinc-100 dark:group-hover:text-blue-400">
        {issue.title}
      </h3>

      {/* Labels */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {issue.labels.slice(0, 3).map((label) => (
          <span
            key={label}
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${getLabelColor(label)}`}
          >
            {label}
          </span>
        ))}
        {issue.labels.length > 3 && (
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800">
            +{issue.labels.length - 3}
          </span>
        )}
      </div>
    </a>
  )
}
