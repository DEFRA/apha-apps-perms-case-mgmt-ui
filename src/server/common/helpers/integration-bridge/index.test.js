import { describe, expect, test, vi } from 'vitest'

describe('integration-bridge index', () => {
  test('returns a stubbed client in test env when configuration is invalid', async () => {
    vi.doMock('./client.js', () => {
      class IntegrationBridgeConfigurationError extends Error {}
      class IntegrationBridgeClient {
        constructor() {
          throw new IntegrationBridgeConfigurationError('missing config')
        }
      }
      return { IntegrationBridgeClient, IntegrationBridgeConfigurationError }
    })

    const { integrationClient } = await import('./index.js')

    expect(() => integrationClient.findCaseManagementUser()).toThrow(
      'missing config'
    )

    vi.resetModules()
    vi.doUnmock('./client.js')
  })

  test('rethrows configuration errors outside of the test environment', async () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'

    vi.doMock('./client.js', () => {
      class IntegrationBridgeConfigurationError extends Error {}
      class IntegrationBridgeClient {
        constructor() {
          throw new IntegrationBridgeConfigurationError('prod config error')
        }
      }
      return { IntegrationBridgeClient, IntegrationBridgeConfigurationError }
    })

    await expect(import('./index.js')).rejects.toThrow('prod config error')

    process.env.NODE_ENV = originalEnv
    vi.resetModules()
    vi.doUnmock('./client.js')
  })
})
