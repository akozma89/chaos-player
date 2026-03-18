/**
 * GDPR erasure unit tests — TEST FIRST
 *
 * eraseUserData() exists in src/lib/gdpr.ts but calls getSupabase()
 * which is not yet exported from src/lib/supabase.ts.
 * These tests mock that dependency and verify the erasure contract.
 */

import { eraseUserData } from '../lib/gdpr'

jest.mock('../lib/supabase', () => {
  const mockEq = jest.fn()
  const mockDelete = jest.fn(() => ({ eq: mockEq }))
  const mockFrom = jest.fn(() => ({ delete: mockDelete }))
  const client = { from: mockFrom }
  return {
    getSupabase: jest.fn(() => client),
    supabase: client,
    __mocks: { mockEq, mockDelete, mockFrom },
  }
})

function getMocks() {
  return require('../lib/supabase').__mocks as {
    mockEq: jest.Mock
    mockDelete: jest.Mock
    mockFrom: jest.Mock
  }
}

describe('eraseUserData — unit', () => {
  beforeEach(() => {
    const { mockEq, mockDelete, mockFrom } = getMocks()
    jest.clearAllMocks()
    mockEq.mockResolvedValue({ error: null })
    mockDelete.mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ delete: mockDelete })
  })

  it('deletes from the leaderboard table for the given userId', async () => {
    const { mockFrom, mockDelete, mockEq } = getMocks()
    const userId = 'user-to-be-erased'

    await eraseUserData(userId)

    expect(mockFrom).toHaveBeenCalledWith('leaderboard')
    expect(mockDelete).toHaveBeenCalled()
    expect(mockEq).toHaveBeenCalledWith('user_id', userId)
  })

  it('resolves without throwing when supabase returns an error', async () => {
    const { mockEq } = getMocks()
    mockEq.mockResolvedValueOnce({ error: new Error('DB Error') })

    await expect(eraseUserData('user-with-error')).resolves.not.toThrow()
  })

  it('resolves without throwing when the db call rejects', async () => {
    const { mockEq } = getMocks()
    mockEq.mockRejectedValueOnce(new Error('network failure'))

    await expect(eraseUserData('user-network-fail')).resolves.not.toThrow()
  })

  it('accepts any non-empty userId string and returns undefined', async () => {
    await expect(eraseUserData('arbitrary-uuid-1234')).resolves.toBeUndefined()
  })
})
