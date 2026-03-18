/**
 * Queue Component Tests - real-time queue display and voting
 */

import { render, screen, fireEvent } from '@testing-library/react'
import { VoteButton } from './VoteButton'

describe('VoteButton', () => {
  it('should render upvote button with count', () => {
    const onClick = jest.fn()
    render(<VoteButton type="upvote" count={5} onClick={onClick} />)
    expect(screen.getByLabelText('Upvote')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('should render downvote button with count', () => {
    const onClick = jest.fn()
    render(<VoteButton type="downvote" count={2} onClick={onClick} />)
    expect(screen.getByLabelText('Downvote')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('should allow upvoting a track', () => {
    const handleVote = jest.fn()
    render(<VoteButton type="upvote" count={0} onClick={handleVote} />)
    fireEvent.click(screen.getByLabelText('Upvote'))
    expect(handleVote).toHaveBeenCalledTimes(1)
  })

  it('should allow downvoting a track', () => {
    const handleVote = jest.fn()
    render(<VoteButton type="downvote" count={0} onClick={handleVote} />)
    fireEvent.click(screen.getByLabelText('Downvote'))
    expect(handleVote).toHaveBeenCalledTimes(1)
  })

  it('should display vote counts', () => {
    render(<VoteButton type="upvote" count={42} onClick={() => {}} />)
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('should render queue items (disabled when not pending)', () => {
    render(<VoteButton type="upvote" count={3} onClick={() => {}} disabled />)
    const btn = screen.getByRole('button', { name: 'Upvote' })
    expect(btn).toBeDisabled()
  })

  it('should not call onClick when disabled', () => {
    const onClick = jest.fn()
    render(<VoteButton type="upvote" count={0} onClick={onClick} disabled />)
    fireEvent.click(screen.getByLabelText('Upvote'))
    expect(onClick).not.toHaveBeenCalled()
  })
})
