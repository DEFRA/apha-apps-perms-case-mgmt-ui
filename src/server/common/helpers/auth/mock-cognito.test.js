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
    const decorate = vi.fn()

    await mockCognitoFederatedCredentials.plugin.register({ decorate })

    expect(warn).toHaveBeenCalled()
    expect(decorate).toHaveBeenCalledWith(
      'server',
      'federatedCredentials',
      expect.objectContaining({ getToken: expect.any(Function) })
    )
  })
})
