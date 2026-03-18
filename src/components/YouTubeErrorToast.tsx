'use client'

import type { YouTubeError } from '../lib/youtube'

interface YouTubeErrorToastProps {
  error: YouTubeError
  onDismiss?: () => void
}

const ERROR_MESSAGES: Record<string, { heading: string; body: string }> = {
  quota_exceeded: {
    heading: 'YouTube Quota Exceeded',
    body: 'Daily API limit reached. Search will resume tomorrow.',
  },
  network_error: {
    heading: 'Connection Error',
    body: 'Could not reach YouTube. Check your internet connection.',
  },
  api_error: {
    heading: 'YouTube Unavailable',
    body: 'YouTube API returned an error. Please try again.',
  },
}

export function YouTubeErrorToast({ error, onDismiss }: YouTubeErrorToastProps) {
  const msg = ERROR_MESSAGES[error.type] ?? { heading: 'YouTube Error', body: error.message }

  return (
    <div
      role="alert"
      data-testid="yt-error-toast"
      className="flex items-start gap-3 px-4 py-3 rounded-lg border border-pink-500 bg-black/80 text-sm"
    >
      <span className="text-pink-500 font-bold text-base leading-none mt-0.5" aria-hidden>
        ⚠
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-pink-500 font-bold">{msg.heading}</p>
        <p className="text-gray-300 mt-0.5">{msg.body}</p>
      </div>
      {onDismiss && (
        <button
          data-testid="yt-error-dismiss"
          onClick={onDismiss}
          aria-label="Dismiss error"
          className="text-gray-500 hover:text-white transition shrink-0"
        >
          ✕
        </button>
      )}
    </div>
  )
}
