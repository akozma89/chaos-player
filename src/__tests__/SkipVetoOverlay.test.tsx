import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import SkipVetoOverlay from '../components/SkipVetoOverlay'

describe('SkipVetoOverlay', () => {
  const mockOnVeto = jest.fn()

  const defaultProps = {
    requestId: 'req-1',
    expiresAt: new Date(Date.now() + 30000).toISOString(),
    vetoCount: 2,
    vetoThreshold: 50,
    activeSessionCount: 10,
    onVeto: mockOnVeto,
    isVetoedByUser: false,
    isHost: false
  }

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('renders nothing if no requestId', () => {
    const { container } = render(<SkipVetoOverlay {...defaultProps} requestId="" />)
    expect(container.firstChild).toBeNull()
  })

  it('displays the host skip message and veto count', () => {
    render(<SkipVetoOverlay {...defaultProps} />)
    expect(screen.getByText(/Host requested a skip/i)).toBeInTheDocument()
    expect(screen.getByText(/2 \/ 5 vetoes/i)).toBeInTheDocument() // 50% of 10 = 5
  })

  it('calls onVeto when veto button is clicked', () => {
    render(<SkipVetoOverlay {...defaultProps} />)
    const button = screen.getByRole('button', { name: /Veto Skip/i })
    fireEvent.click(button)
    expect(mockOnVeto).toHaveBeenCalled()
  })

  it('disables button if user already vetoed', () => {
    render(<SkipVetoOverlay {...defaultProps} isVetoedByUser={true} />)
    const button = screen.getByRole('button', { name: /Veto Cast/i })
    expect(button).toBeDisabled()
  })

  it('shows timer counting down', () => {
    render(<SkipVetoOverlay {...defaultProps} />)
    // Initially shows ~29s because it updates immediately on mount
    expect(screen.getByText((_content, element) => element?.textContent === 'The community has 29s to veto this skip.')).toBeInTheDocument()

    act(() => {
      jest.advanceTimersByTime(1000)
    })
    
    expect(screen.getByText((_content, element) => element?.textContent === 'The community has 28s to veto this skip.')).toBeInTheDocument()
  })
})
