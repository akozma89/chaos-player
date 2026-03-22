/**
 * YouTube IFrame API loader and constants
 * Ref: https://developers.google.com/youtube/iframe_api_reference
 */

export const YT_STATES = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
} as const

export type YTPlayerState = typeof YT_STATES[keyof typeof YT_STATES]

export type YTPlayer = {
  // Queueing
  cueVideoById: (args: string | { videoId: string; startSeconds?: number; endSeconds?: number }) => void
  loadVideoById: (args: string | { videoId: string; startSeconds?: number; endSeconds?: number }) => void
  
  // Playback
  playVideo: () => void
  pauseVideo: () => void
  stopVideo: () => void
  seekTo: (seconds: number, allowSeekAhead: boolean) => void
  
  // Navigation
  nextVideo: () => void
  previousVideo: () => void
  playVideoAt: (index: number) => void
  
  // Audio
  mute: () => void
  unMute: () => void
  isMuted: () => boolean
  setVolume: (volume: number) => void
  getVolume: () => number
  
  // Settings
  setSize: (width: number, height: number) => void
  getPlaybackRate: () => number
  setPlaybackRate: (suggestedRate: number) => void
  getAvailablePlaybackRates: () => number[]
  setLoop: (loopPlaylists: boolean) => void
  setShuffle: (shufflePlaylist: boolean) => void
  
  // Status
  getVideoLoadedFraction: () => number
  getPlayerState: () => YTPlayerState
  getCurrentTime: () => number
  getDuration: () => number
  getVideoUrl: () => string
  getVideoEmbedCode: () => string
  
  // Lifecycle
  destroy: () => void
  getIframe: () => HTMLIFrameElement
}

declare global {
  interface Window {
    YT: {
      Player: new (
        el: HTMLElement | string,
        opts: {
          videoId?: string
          width?: number | string
          height?: number | string
          playerVars?: {
            autoplay?: 0 | 1
            controls?: 0 | 1 | 2
            disablekb?: 0 | 1
            enablejsapi?: 0 | 1
            fs?: 0 | 1
            iv_load_policy?: 1 | 3
            list?: string
            listType?: 'playlist' | 'search' | 'user_uploads'
            loop?: 0 | 1
            modestbranding?: 1
            mute?: 0 | 1
            origin?: string
            playlist?: string
            playsinline?: 0 | 1
            rel?: 0 | 1
            start?: number
            end?: number
            color?: 'red' | 'white'
          }
          events?: {
            onReady?: (event: { target: YTPlayer }) => void
            onStateChange?: (event: { data: YTPlayerState; target: YTPlayer }) => void
            onPlaybackQualityChange?: (event: { data: string; target: YTPlayer }) => void
            onPlaybackRateChange?: (event: { data: number; target: YTPlayer }) => void
            onError?: (event: { data: number; target: YTPlayer }) => void
            onApiChange?: (event: { target: YTPlayer }) => void
          }
        }
      ) => YTPlayer
      PlayerState: {
        UNSTARTED: -1
        ENDED: 0
        PLAYING: 1
        PAUSED: 2
        BUFFERING: 3
        CUED: 5
      }
    }
    onYouTubeIframeAPIReady: (() => void) | undefined
  }
}

let apiLoading = false
let apiReady = false
const readyCallbacks: Array<() => void> = []

/**
 * Promise-based loader for the YouTube IFrame API
 */
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
      
      const firstScriptTag = document.getElementsByTagName('script')[0]
      if (firstScriptTag && firstScriptTag.parentNode) {
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag)
      } else {
        document.head.appendChild(tag)
      }

      window.onYouTubeIframeAPIReady = () => {
        apiReady = true
        readyCallbacks.forEach((cb) => cb())
        readyCallbacks.length = 0
      }
    }
  })
}
