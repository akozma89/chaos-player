/**
 * YouTube IFrame API loader utility
 */

export const YT_STATES = {
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
} as const

export type YTPlayer = {
  seekTo: (seconds: number) => void
  playVideo: () => void
  pauseVideo: () => void
  stopVideo: () => void
  unMute: () => void
  setVolume: (volume: number) => void
  destroy: () => void
}

declare global {
  interface Window {
    YT: {
      Player: new (
        el: HTMLElement,
        opts: {
          videoId: string
          playerVars?: Record<string, unknown>
          events?: {
            onReady?: () => void
            onStateChange?: (e: { data: number }) => void
          }
        }
      ) => YTPlayer
    }
    onYouTubeIframeAPIReady: (() => void) | undefined
  }
}

let apiLoading = false
let apiReady = false
const readyCallbacks: Array<() => void> = []

export function loadYouTubeIframeAPI(): Promise<void> {
  return new Promise((resolve) => {
    if (apiReady) {
      resolve()
      return
    }

    readyCallbacks.push(resolve)

    if (!apiLoading) {
      apiLoading = true
      const tag = document.createElement('script')
      tag.src = 'https://www.youtube.com/iframe_api'
      document.head.appendChild(tag)

      window.onYouTubeIframeAPIReady = () => {
        apiReady = true
        readyCallbacks.forEach((cb) => cb())
        readyCallbacks.length = 0
      }
    }
  })
}
