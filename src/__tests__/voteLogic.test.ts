/**
 * TDD: vote delta logic and useQueue votes subscription fix
 */

import { computeVoteDelta } from '../lib/queue'

describe('computeVoteDelta', () => {
  it('returns +1 upvote delta when casting first upvote (no prior vote)', () => {
    const delta = computeVoteDelta('upvote', undefined)
    expect(delta).toEqual({ upvoteDelta: 1, downvoteDelta: 0 })
  })

  it('returns +1 downvote delta when casting first downvote (no prior vote)', () => {
    const delta = computeVoteDelta('downvote', undefined)
    expect(delta).toEqual({ upvoteDelta: 0, downvoteDelta: 1 })
  })

  it('returns zero delta when repeating same upvote (idempotent)', () => {
    const delta = computeVoteDelta('upvote', 'upvote')
    expect(delta).toEqual({ upvoteDelta: 0, downvoteDelta: 0 })
  })

  it('returns zero delta when repeating same downvote (idempotent)', () => {
    const delta = computeVoteDelta('downvote', 'downvote')
    expect(delta).toEqual({ upvoteDelta: 0, downvoteDelta: 0 })
  })

  it('returns -1 up +1 down when flipping from upvote to downvote', () => {
    const delta = computeVoteDelta('downvote', 'upvote')
    expect(delta).toEqual({ upvoteDelta: -1, downvoteDelta: 1 })
  })

  it('returns +1 up -1 down when flipping from downvote to upvote', () => {
    const delta = computeVoteDelta('upvote', 'downvote')
    expect(delta).toEqual({ upvoteDelta: 1, downvoteDelta: -1 })
  })
})
