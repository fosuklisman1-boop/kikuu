import { describe, it, expect, vi, beforeEach } from 'vitest'
import { requireShopOwner } from './require-shop-owner'

const mockGetUser = vi.fn()
const mockSingle = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: mockGetUser },
  }),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: mockSingle,
        }),
      }),
    }),
  }),
}))

describe('requireShopOwner', () => {
  beforeEach(() => {
    mockGetUser.mockReset()
    mockSingle.mockReset()
  })

  it('throws when no user is authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    await expect(requireShopOwner()).rejects.toThrow('Unauthorized')
  })

  it('throws when the user has no shop', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockSingle.mockResolvedValue({ data: null })
    await expect(requireShopOwner()).rejects.toThrow('Forbidden: no shop found for this user')
  })

  it('returns userId and shopId for a valid shop owner', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockSingle.mockResolvedValue({ data: { id: 'shop-1' } })
    const result = await requireShopOwner()
    expect(result).toEqual({ userId: 'user-1', shopId: 'shop-1' })
  })
})
