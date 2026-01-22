import { describe, expect, test, vi } from 'vitest'

import { mockCognitoFederatedCredentials } from './mock-cognito.js'

const { warn } = vi.hoisted(() => ({
  warn: vi.fn()
}))

vi.mock('../logging/logger.js', () => ({
  createLogger: () => ({ warn })
}))

describe('mockCognitoFederatedCredentials', () => {
  test('decorates server and warns about mock usage', async () => {
    const server = { app: {} }

    await mockCognitoFederatedCredentials.plugin.register(server)

    expect(warn).toHaveBeenCalled()
    expect(server.app.federatedCredentials).toEqual(
      expect.objectContaining({ getToken: expect.any(Function) })
    )
  })
})
