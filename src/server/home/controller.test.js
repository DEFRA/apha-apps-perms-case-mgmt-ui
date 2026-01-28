import { createServer } from '../server.js'
import { statusCodes } from '../common/constants/status-codes.js'

describe('#homeController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should provide expected response', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/',
      auth: {
        strategy: 'session',
        credentials: {
          id: 'test-user',
          email: 'user@example.com',
          displayName: 'Test User',
          isAuthenticated: true
        }
      }
    })

    expect(result).toEqual(expect.stringContaining('Case Management Tool'))
    expect(statusCode).toBe(statusCodes.ok)
  })
})
