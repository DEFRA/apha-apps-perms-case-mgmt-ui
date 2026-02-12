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
import {
  IntegrationBridgeConfigurationError,
  IntegrationBridgeRequestError
} from '../client.js'

const tokenUrl = 'https://bridge.example/oauth2/token'

const server = setupServer()

beforeAll(() => server.listen())

afterAll(() => server.close())

afterEach(() => {
  server.resetHandlers()
  vi.restoreAllMocks()
})

describe('bearerToken middleware', () => {
  test('throws when required configuration is missing', () => {
    expect(() =>
      bearerToken({
        tokenUrl: '',
        clientId: 'client-id',
        clientSecret: 'client-secret'
      })
    ).toThrow(IntegrationBridgeConfigurationError)
  })

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

  test('returns in-flight refresh promise for concurrent refresh requests', async () => {
    let tokenCalls = 0
    let now = 0
    vi.spyOn(Date, 'now').mockImplementation(() => now)

    const refreshGate = (() => {
      /** @type {(value?: void) => void} */
      let resolvePromise = () => {}
      /** @type {(reason?: unknown) => void} */
      let rejectPromise = () => {}

      const promise = new Promise((resolve, reject) => {
        resolvePromise = resolve
        rejectPromise = reject
      })

      return { promise, resolve: resolvePromise, reject: rejectPromise }
    })()

    server.use(
      http.post(tokenUrl, async () => {
        tokenCalls += 1
        if (tokenCalls === 1) {
          return HttpResponse.json({
            access_token: 'token-1',
            expires_in: 1
          })
        }
        await refreshGate.promise
        return HttpResponse.json({
          access_token: 'token-2',
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

    await middleware(
      new Request('https://bridge.example/seed', { method: 'POST' })
    )

    now = 2000

    const firstPromise = middleware(
      new Request('https://bridge.example/one', { method: 'POST' })
    )

    await Promise.resolve()

    const secondPromise = middleware(
      new Request('https://bridge.example/two', { method: 'POST' })
    )

    refreshGate.resolve()

    const [first, second] = await Promise.all([firstPromise, secondPromise])

    expect(tokenCalls).toBe(2)
    expect(first.headers.get('authorization')).toBe('Bearer token-2')
    expect(second.headers.get('authorization')).toBe('Bearer token-2')
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

  test('retries after refresh failure by clearing cached authorization', async () => {
    let tokenCalls = 0
    let now = 0
    vi.spyOn(Date, 'now').mockImplementation(() => now)

    server.use(
      http.post(tokenUrl, () => {
        tokenCalls += 1
        if (tokenCalls === 1) {
          return HttpResponse.json({
            access_token: 'token-1',
            expires_in: 1
          })
        }
        if (tokenCalls === 2) {
          return HttpResponse.json({ message: 'boom' }, { status: 500 })
        }
        return HttpResponse.json({
          access_token: 'token-2',
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

    await middleware(
      new Request('https://bridge.example/seed', { method: 'POST' })
    )

    now = 2000

    await expect(
      middleware(
        new Request('https://bridge.example/refresh', { method: 'POST' })
      )
    ).rejects.toBeInstanceOf(IntegrationBridgeRequestError)

    const next = await middleware(
      new Request('https://bridge.example/next', { method: 'POST' })
    )

    expect(tokenCalls).toBe(3)
    expect(next.headers.get('authorization')).toBe('Bearer token-2')
  })

  test('throws when token response body is empty', async () => {
    server.use(
      http.post(tokenUrl, () => HttpResponse.text('', { status: 200 }))
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

  test('throws when token response is not json', async () => {
    server.use(
      http.post(tokenUrl, () => HttpResponse.text('not-json', { status: 200 }))
    )

    const middleware = bearerToken({
      tokenUrl,
      clientId: 'client-id',
      clientSecret: 'client-secret'
    })

    try {
      await middleware(
        new Request('https://bridge.example/foo', { method: 'POST' })
      )
    } catch (error) {
      expect(error).toBeInstanceOf(IntegrationBridgeRequestError)
      expect(error.payload).toBe('not-json')
      return
    }

    throw new Error('Expected middleware to throw')
  })

  test('wraps token fetch errors', async () => {
    const middleware = bearerToken({
      tokenUrl,
      clientId: 'client-id',
      clientSecret: 'client-secret',
      fetchImpl: () => {
        throw new Error('network down')
      }
    })

    await expect(
      middleware(new Request('https://bridge.example/foo', { method: 'POST' }))
    ).rejects.toBeInstanceOf(IntegrationBridgeRequestError)
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

  test('redacts access_token in validation error payloads', async () => {
    server.use(
      http.post(tokenUrl, () =>
        HttpResponse.json({ access_token: 'token-123' }, { status: 200 })
      )
    )

    const middleware = bearerToken({
      tokenUrl,
      clientId: 'client-id',
      clientSecret: 'client-secret'
    })

    try {
      await middleware(
        new Request('https://bridge.example/foo', { method: 'POST' })
      )
    } catch (error) {
      expect(error.payload?.access_token).toBe('[REDACTED]')
      return
    }

    throw new Error('Expected middleware to throw')
  })
})
