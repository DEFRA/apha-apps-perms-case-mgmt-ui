import { afterEach, describe, expect, test } from 'vitest'

import { createServer } from './server.js'
import { config } from '../config/config.js'
import { CognitoFederatedCredentialProvider } from './common/helpers/auth/cognito.js'

const originalMocking = config.get('azureFederatedCredentials.enableMocking')
const originalPoolId = config.get('azureFederatedCredentials.identityPoolId')

afterEach(() => {
  config.set('azureFederatedCredentials.enableMocking', originalMocking)
  config.set('azureFederatedCredentials.identityPoolId', originalPoolId)
})

describe('createServer credential provider', () => {
  test('uses mock cognito when mocking is enabled', async () => {
    config.set('azureFederatedCredentials.enableMocking', true)
    const server = await createServer()

    const app = /** @type {any} */ (server.app)
    expect(app.federatedCredentials).toBeDefined()
    expect(await app.federatedCredentials.getToken()).toBeTruthy()

    await server.stop()
  })

  test('uses cognito provider when mocking is disabled', async () => {
    config.set('azureFederatedCredentials.enableMocking', false)
    config.set('azureFederatedCredentials.identityPoolId', 'pool-id')

    const server = await createServer()

    const app = /** @type {any} */ (server.app)
    expect(app.federatedCredentials).toBeInstanceOf(
      CognitoFederatedCredentialProvider
    )

    await server.stop()
  })
})
