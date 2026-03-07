import { UsersService } from './users.service'

describe('UsersService authenticated user summary', () => {
  it('returns persisted per-user search run totals grouped by run kind', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-1',
          email: 'user@example.com',
        }),
      },
      jobSearchRun: {
        count: jest
          .fn()
          .mockResolvedValueOnce(5)
          .mockResolvedValueOnce(3)
          .mockResolvedValueOnce(2)
          .mockResolvedValueOnce(0),
      },
    }

    const service = new UsersService(prisma as any)
    const summary = await service.getAuthenticatedUserSummary('user-1')

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      select: { id: true, email: true },
    })
    expect(prisma.jobSearchRun.count).toHaveBeenNthCalledWith(1, {
      where: { userId: 'user-1' },
    })
    expect(prisma.jobSearchRun.count).toHaveBeenNthCalledWith(2, {
      where: { userId: 'user-1', runKind: 'job' },
    })
    expect(prisma.jobSearchRun.count).toHaveBeenNthCalledWith(3, {
      where: { userId: 'user-1', runKind: 'scholarship' },
    })
    expect(prisma.jobSearchRun.count).toHaveBeenNthCalledWith(4, {
      where: { userId: 'user-1', runKind: 'visa' },
    })
    expect(summary).toEqual({
      userId: 'user-1',
      email: 'user@example.com',
      searchRunSummary: {
        totalSearchesRun: 5,
        jobsRun: 3,
        scholarshipsRun: 2,
        visasRun: 0,
      },
    })
  })
})
