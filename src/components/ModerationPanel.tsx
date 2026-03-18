'use client'

import { useState } from 'react'
import { muteUser, removeUser, hostSkipOverride } from '../lib/moderation'
import type { Session } from '../types'

interface ModerationPanelProps {
  roomId: string
  hostId: string
  currentQueueItemId?: string
  participants: Session[]
  onAction?: (action: string) => void
}

type ActionState = 'idle' | 'loading' | 'error'

export default function ModerationPanel({
  roomId,
  hostId,
  currentQueueItemId,
  participants,
  onAction,
}: ModerationPanelProps) {
  const [actionState, setActionState] = useState<ActionState>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [skipState, setSkipState] = useState<ActionState>('idle')

  const guests = participants.filter((p) => !p.isHost)

  async function handleMute(targetUserId: string) {
    setActionState('loading')
    setErrorMsg(null)
    const { error } = await muteUser({ roomId, targetUserId, hostId })
    if (error) {
      setErrorMsg(error.message)
      setActionState('error')
    } else {
      setActionState('idle')
      onAction?.('mute')
    }
  }

  async function handleRemove(targetUserId: string) {
    setActionState('loading')
    setErrorMsg(null)
    const { error } = await removeUser({ roomId, targetUserId, hostId })
    if (error) {
      setErrorMsg(error.message)
      setActionState('error')
    } else {
      setActionState('idle')
      onAction?.('remove')
    }
  }

  async function handleHostSkip() {
    if (!currentQueueItemId) return
    setSkipState('loading')
    const { error } = await hostSkipOverride({ roomId, queueItemId: currentQueueItemId, hostId })
    if (error) {
      setSkipState('error')
    } else {
      setSkipState('idle')
      onAction?.('skip-override')
    }
  }

  return (
    <div
      className="rounded-xl border border-red-500/30 bg-gray-900 p-4 shadow-lg shadow-red-900/20"
      data-testid="moderation-panel"
    >
      {/* Header */}
      <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-red-400">
        Host Controls
      </h2>

      {/* Host skip override */}
      <div className="mb-4">
        <button
          onClick={handleHostSkip}
          disabled={!currentQueueItemId || skipState === 'loading'}
          className="w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
          data-testid="host-skip-btn"
        >
          {skipState === 'loading' ? 'Skipping…' : 'Skip Track (Free)'}
        </button>
      </div>

      {/* Error banner */}
      {errorMsg && (
        <p
          className="mb-3 rounded-lg bg-red-900/30 px-3 py-2 text-xs text-red-300"
          data-testid="moderation-error"
        >
          {errorMsg}
        </p>
      )}

      {/* Participant list */}
      {guests.length === 0 ? (
        <p className="text-xs text-gray-500" data-testid="no-participants">
          No guests in the room.
        </p>
      ) : (
        <ul className="space-y-2">
          {guests.map((participant) => (
            <li
              key={participant.userId}
              className="flex items-center gap-2 rounded-lg bg-gray-800/60 px-3 py-2"
              data-testid={`participant-row-${participant.userId}`}
            >
              <span className="flex-1 truncate text-sm text-white">{participant.username}</span>

              <button
                onClick={() => handleMute(participant.userId)}
                disabled={actionState === 'loading'}
                className="rounded bg-yellow-600/80 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-yellow-500 disabled:opacity-40"
                data-testid={`mute-btn-${participant.userId}`}
              >
                Mute
              </button>

              <button
                onClick={() => handleRemove(participant.userId)}
                disabled={actionState === 'loading'}
                className="rounded bg-red-700/80 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-red-600 disabled:opacity-40"
                data-testid={`remove-btn-${participant.userId}`}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
