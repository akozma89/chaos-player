/**
 * Task 3 (RED then GREEN): Tests for TokenEarnNotification component
 * Neon-green animated toast when user earns crowd pleaser tokens
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { TokenEarnNotification } from '../components/TokenEarnNotification'

describe('TokenEarnNotification', () => {
  const defaultProps = {
    username: 'Alice',
    tokensEarned: 3,
    trackTitle: 'Bohemian Rhapsody',
    onDismiss: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders with role="alert" for accessibility', () => {
    render(<TokenEarnNotification {...defaultProps} />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('shows crowd pleaser label', () => {
    render(<TokenEarnNotification {...defaultProps} />)
    expect(screen.getByText(/crowd pleaser/i)).toBeInTheDocument()
  })

  it('displays tokens earned amount', () => {
    render(<TokenEarnNotification {...defaultProps} />)
    expect(screen.getByText(/\+3/)).toBeInTheDocument()
  })

  it('displays track title', () => {
    render(<TokenEarnNotification {...defaultProps} />)
    expect(screen.getByText('Bohemian Rhapsody')).toBeInTheDocument()
  })

  it('displays username', () => {
    render(<TokenEarnNotification {...defaultProps} />)
    expect(screen.getByText(/Alice/)).toBeInTheDocument()
  })

  it('calls onDismiss when dismiss button clicked', () => {
    render(<TokenEarnNotification {...defaultProps} />)
    const dismissBtn = screen.getByRole('button', { name: /dismiss/i })
    fireEvent.click(dismissBtn)
    expect(defaultProps.onDismiss).toHaveBeenCalledTimes(1)
  })

  it('has neon-green styling indicator in class names', () => {
    render(<TokenEarnNotification {...defaultProps} />)
    const alert = screen.getByRole('alert')
    expect(alert.className).toMatch(/neon-green/)
  })

  it('has data-testid for targeting', () => {
    render(<TokenEarnNotification {...defaultProps} />)
    expect(screen.getByTestId('token-earn-notification')).toBeInTheDocument()
  })

  it('renders token amount with custom value', () => {
    render(<TokenEarnNotification {...defaultProps} tokensEarned={5} />)
    expect(screen.getByText(/\+5/)).toBeInTheDocument()
  })

  it('dismiss button has accessible aria-label', () => {
    render(<TokenEarnNotification {...defaultProps} />)
    const btn = screen.getByRole('button', { name: /dismiss/i })
    expect(btn).toHaveAttribute('aria-label')
  })
})
