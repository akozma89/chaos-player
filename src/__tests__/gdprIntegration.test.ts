/**
 * GDPR erasure integration tests — TEST FIRST
 *
 * eraseUserData() does not exist yet in src/lib/gdpr.ts.
 * These tests run against a real local Supabase instance (see supabase/config.toml).
 * They will fail until eraseUserData is implemented.
 *
 * Run with a local Supabase stack:
 *   npx supabase start
 *   jest gdprIntegration
 */

import { eraseUserData } from '../lib/gdpr'
import { supabase } from '../lib/supabase'

const ROOM_CODE = 'GDPR_INT_TEST'
const USER_ID = 'gdpr-integration-test-user'
const SESSION_ID = '00000000-0000-0000-0000-000000000001'

async function seedUser() {
  const { error: roomErr } = await supabase
    .from('rooms')
    .upsert({ code: ROOM_CODE, name: 'GDPR Integration Test Room', owner_session_id: SESSION_ID })
  if (roomErr) throw roomErr

  const { error: lbErr } = await supabase.from('leaderboard').upsert({
    room_code: ROOM_CODE,
    user_id: USER_ID,
    name: 'Integration Test User',
    score: 42,
  })
  if (lbErr) throw lbErr
}

async function cleanupUser() {
  await supabase.from('leaderboard').delete().eq('user_id', USER_ID)
  await supabase.from('rooms').delete().eq('code', ROOM_CODE)
}

// Skip integration tests unless INTEGRATION=true (requires running local Supabase)
const describeIntegration = process.env.INTEGRATION === 'true' ? describe : describe.skip

describeIntegration('eraseUserData — integration', () => {
  beforeEach(async () => {
    await cleanupUser()
    await seedUser()
  })

  afterAll(async () => {
    await cleanupUser()
  })

  it('removes the user row from the leaderboard table', async () => {
    // Confirm row exists
    const { data: before, error: beforeErr } = await supabase
      .from('leaderboard')
      .select('*')
      .eq('user_id', USER_ID)

    expect(beforeErr).toBeNull()
    expect(before).toHaveLength(1)
    expect(before![0].name).toBe('Integration Test User')

    // Erase — this will fail until eraseUserData is implemented
    await eraseUserData(USER_ID)

    // Confirm row is gone
    const { data: after, error: afterErr } = await supabase
      .from('leaderboard')
      .select('*')
      .eq('user_id', USER_ID)

    expect(afterErr).toBeNull()
    expect(after).toHaveLength(0)
  })

  it('is idempotent — erasing a non-existent user does not throw', async () => {
    await cleanupUser() // remove the row seeded in beforeEach
    await expect(eraseUserData(USER_ID)).resolves.not.toThrow()
  })
})
