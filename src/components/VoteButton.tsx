'use client'

interface Props {
  type: 'upvote' | 'downvote'
  count: number
  onClick: () => void
  disabled?: boolean
}

export function VoteButton({ type, count, onClick, disabled }: Props) {
  const isUp = type === 'upvote'
  const arrow = isUp ? '▲' : '▼'
  const color = isUp ? 'text-neon-cyan hover:text-white' : 'text-neon-pink hover:text-white'

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={isUp ? 'Upvote' : 'Downvote'}
      className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded transition-colors ${color} disabled:opacity-40 disabled:cursor-not-allowed`}
    >
      <span className="text-lg leading-none">{arrow}</span>
      <span className="text-xs font-mono font-bold">{count}</span>
    </button>
  )
}
