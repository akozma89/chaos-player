import React from 'react'
import { render, screen } from '@testing-library/react'
import { TokenEarnNotification } from '../components/TokenEarnNotification'

describe('TokenEarnNotification', () => {
  it('renders the reward amount and message for current user', () => {
    render(<TokenEarnNotification amount={3} userId="user-1" currentUserId="user-1" />)
    expect(screen.getByText(/\+3 tokens/i)).toBeInTheDocument()
    expect(screen.getByText(/Crowd Pleaser!/i)).toBeInTheDocument()
    expect(screen.getByText(/Your track is a hit/i)).toBeInTheDocument()
  })

  it('renders a general message when another user earns tokens', () => {
    render(<TokenEarnNotification amount={3} userId="user-2" currentUserId="user-1" />)
    expect(screen.getByText(/Someone's track is a hit/i)).toBeInTheDocument()
  })
})
