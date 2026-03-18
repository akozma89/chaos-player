/**
 * Tests for ModerationPanel UI component
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import ModerationPanel from '../components/ModerationPanel'
import type { Session } from '../types'

jest.mock('../lib/moderation', () => ({
  muteUser: jest.fn(),
  removeUser: jest.fn(),
  hostSkipOverride: jest.fn(),
}))

const hostSession: Session = {
  id: 'host-session',
  roomId: 'room-1',
  userId: 'host-id',
  username: 'Host',
  joinedAt: '',
  tokens: 10,
  isHost: true,
}

const guestA: Session = {
  id: 'guest-session-a',
  roomId: 'room-1',
  userId: 'guest-a',
  username: 'Alice',
  joinedAt: '',
  tokens: 7,
  isHost: false,
}

const guestB: Session = {
  id: 'guest-session-b',
  roomId: 'room-1',
  userId: 'guest-b',
  username: 'Bob',
  joinedAt: '',
  tokens: 3,
  isHost: false,
}

describe('ModerationPanel', () => {
  beforeEach(() => jest.clearAllMocks())

  it('renders the panel with host controls heading', () => {
    render(
      <ModerationPanel
        roomId="room-1"
        hostId="host-id"
        participants={[hostSession]}
      />
    )
    expect(screen.getByTestId('moderation-panel')).toBeInTheDocument()
    expect(screen.getByText(/host controls/i)).toBeInTheDocument()
  })

  it('shows "No guests" when only host is present', () => {
    render(
      <ModerationPanel
        roomId="room-1"
        hostId="host-id"
        participants={[hostSession]}
      />
    )
    expect(screen.getByTestId('no-participants')).toBeInTheDocument()
  })

  it('renders mute and remove buttons for each guest', () => {
    render(
      <ModerationPanel
        roomId="room-1"
        hostId="host-id"
        participants={[hostSession, guestA, guestB]}
      />
    )
    expect(screen.getByTestId('mute-btn-guest-a')).toBeInTheDocument()
    expect(screen.getByTestId('remove-btn-guest-a')).toBeInTheDocument()
    expect(screen.getByTestId('mute-btn-guest-b')).toBeInTheDocument()
    expect(screen.getByTestId('remove-btn-guest-b')).toBeInTheDocument()
  })

  it('does not render host in the participant list', () => {
    render(
      <ModerationPanel
        roomId="room-1"
        hostId="host-id"
        participants={[hostSession, guestA]}
      />
    )
    expect(screen.queryByTestId('participant-row-host-id')).not.toBeInTheDocument()
    expect(screen.getByTestId('participant-row-guest-a')).toBeInTheDocument()
  })

  it('calls muteUser and invokes onAction when mute is clicked', async () => {
    const { muteUser } = require('../lib/moderation')
    muteUser.mockResolvedValue({ muted: true, error: null })

    const onAction = jest.fn()
    render(
      <ModerationPanel
        roomId="room-1"
        hostId="host-id"
        participants={[hostSession, guestA]}
        onAction={onAction}
      />
    )

    fireEvent.click(screen.getByTestId('mute-btn-guest-a'))

    await waitFor(() => {
      expect(muteUser).toHaveBeenCalledWith({ roomId: 'room-1', targetUserId: 'guest-a', hostId: 'host-id' })
      expect(onAction).toHaveBeenCalledWith('mute')
    })
  })

  it('calls removeUser and invokes onAction when remove is clicked', async () => {
    const { removeUser } = require('../lib/moderation')
    removeUser.mockResolvedValue({ removed: true, error: null })

    const onAction = jest.fn()
    render(
      <ModerationPanel
        roomId="room-1"
        hostId="host-id"
        participants={[hostSession, guestA]}
        onAction={onAction}
      />
    )

    fireEvent.click(screen.getByTestId('remove-btn-guest-a'))

    await waitFor(() => {
      expect(removeUser).toHaveBeenCalledWith({ roomId: 'room-1', targetUserId: 'guest-a', hostId: 'host-id' })
      expect(onAction).toHaveBeenCalledWith('remove')
    })
  })

  it('displays error message when muteUser fails', async () => {
    const { muteUser } = require('../lib/moderation')
    muteUser.mockResolvedValue({ muted: false, error: new Error('Only the host can mute users') })

    render(
      <ModerationPanel
        roomId="room-1"
        hostId="host-id"
        participants={[hostSession, guestA]}
      />
    )

    fireEvent.click(screen.getByTestId('mute-btn-guest-a'))

    await waitFor(() => {
      expect(screen.getByTestId('moderation-error')).toBeInTheDocument()
      expect(screen.getByText(/only the host/i)).toBeInTheDocument()
    })
  })

  it('host skip button is disabled when no queue item', () => {
    render(
      <ModerationPanel
        roomId="room-1"
        hostId="host-id"
        participants={[hostSession]}
      />
    )
    expect(screen.getByTestId('host-skip-btn')).toBeDisabled()
  })

  it('host skip button calls hostSkipOverride with correct params', async () => {
    const { hostSkipOverride } = require('../lib/moderation')
    hostSkipOverride.mockResolvedValue({ tokensSpent: 0, error: null })

    const onAction = jest.fn()
    render(
      <ModerationPanel
        roomId="room-1"
        hostId="host-id"
        currentQueueItemId="item-1"
        participants={[hostSession]}
        onAction={onAction}
      />
    )

    fireEvent.click(screen.getByTestId('host-skip-btn'))

    await waitFor(() => {
      expect(hostSkipOverride).toHaveBeenCalledWith({ roomId: 'room-1', queueItemId: 'item-1', hostId: 'host-id' })
      expect(onAction).toHaveBeenCalledWith('skip-override')
    })
  })
})
