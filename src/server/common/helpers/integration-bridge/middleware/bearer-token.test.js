import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  test,
  vi
} from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

import { bearerToken } from './bearer-token.js'
import { IntegrationBridgeRequestError } from '../client.js'

const tokenUrl = 'https://bridge.example/oauth2/token'

const server = setupServer()

beforeAll(() => server.listen())

afterAll(() => server.close())

afterEach(() => server.resetHandlers())

describe('bearerToken middleware', () => {
  test('adds Authorization header to the request', async () => {
    server.use(
      http.post(tokenUrl, () =>
        HttpResponse.json({ access_token: 'token-123', expires_in: 3600 })
      )
    )

    const middleware = bearerToken({
      tokenUrl,
      clientId: 'client-id',
      clientSecret: 'client-secret',
      tokenBufferSeconds: 0
    })

    const request = new Request('https://bridge.example/foo', {
      method: 'POST'
    })

    const updatedRequest = await middleware(request)

    expect(updatedRequest).toBeInstanceOf(Request)
    expect(updatedRequest.headers.get('authorization')).toBe('Bearer token-123')
  })

  test('reuses cached token for subsequent requests', async () => {
    let tokenCalls = 0
    server.use(
      http.post(tokenUrl, () => {
        tokenCalls += 1
        return HttpResponse.json({
          access_token: 'token-123',
          expires_in: 3600
        })
      })
    )

    const middleware = bearerToken({
      tokenUrl,
      clientId: 'client-id',
      clientSecret: 'client-secret',
      tokenBufferSeconds: 0
    })

    const first = await middleware(
      new Request('https://bridge.example/one', { method: 'POST' })
    )
    const second = await middleware(
      new Request('https://bridge.example/two', { method: 'POST' })
    )

    expect(first.headers.get('authorization')).toBe('Bearer token-123')
    expect(second.headers.get('authorization')).toBe('Bearer token-123')
    expect(tokenCalls).toBe(1)
  })

  test('refreshes only once when concurrent requests happen after expiry', async () => {
    let tokenCalls = 0
    let now = 0
    vi.spyOn(Date, 'now').mockImplementation(() => now)

    server.use(
      http.post(tokenUrl, () => {
        tokenCalls += 1
        return HttpResponse.json({
          access_token: `token-${tokenCalls}`,
          expires_in: 1
        })
      })
    )

    const middleware = bearerToken({
      tokenUrl,
      clientId: 'client-id',
      clientSecret: 'client-secret',
      tokenBufferSeconds: 0
    })

    await middleware(
      new Request('https://bridge.example/seed', { method: 'POST' })
    )

    now = 2000

    const [first, second] = await Promise.all([
      middleware(new Request('https://bridge.example/one', { method: 'POST' })),
      middleware(new Request('https://bridge.example/two', { method: 'POST' }))
    ])

    expect(tokenCalls).toBe(2)
    expect(first.headers.get('authorization')).toBe('Bearer token-2')
    expect(second.headers.get('authorization')).toBe('Bearer token-2')

    vi.restoreAllMocks()
  })

  test('throws when token response is missing required fields', async () => {
    server.use(
      http.post(tokenUrl, () =>
        HttpResponse.json({ expires_in: 3600 }, { status: 200 })
      )
    )

    const middleware = bearerToken({
      tokenUrl,
      clientId: 'client-id',
      clientSecret: 'client-secret'
    })

    await expect(
      middleware(new Request('https://bridge.example/foo', { method: 'POST' }))
    ).rejects.toBeInstanceOf(IntegrationBridgeRequestError)
  })
})
