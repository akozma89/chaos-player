import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { VoteButton } from '../components/VoteButton'

describe('VoteButton', () => {
  it('renders upvote arrow and count', () => {
    render(<VoteButton type="upvote" count={5} onClick={jest.fn()} />)
    expect(screen.getByText('▲')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('renders downvote arrow and count', () => {
    render(<VoteButton type="downvote" count={2} onClick={jest.fn()} />)
    expect(screen.getByText('▼')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('calls onClick when clicked', () => {
    const handleClick = jest.fn()
    render(<VoteButton type="upvote" count={0} onClick={handleClick} />)
    fireEvent.click(screen.getByRole('button'))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('is disabled when disabled prop is true', () => {
    render(<VoteButton type="upvote" count={0} onClick={jest.fn()} disabled />)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('applies neon-blue active class when active=true on upvote', () => {
    render(<VoteButton type="upvote" count={3} onClick={jest.fn()} active />)
    const btn = screen.getByRole('button')
    expect(btn.className).toMatch(/neon-blue/)
  })

  it('applies neon-pink active class when active=true on downvote', () => {
    render(<VoteButton type="downvote" count={1} onClick={jest.fn()} active />)
    const btn = screen.getByRole('button')
    expect(btn.className).toMatch(/neon-pink/)
  })

  it('does not apply active highlight when active=false', () => {
    const { container } = render(<VoteButton type="upvote" count={0} onClick={jest.fn()} active={false} />)
    const btn = container.querySelector('button')!
    expect(btn.className).not.toMatch(/bg-neon-blue\/20/)
  })
})
