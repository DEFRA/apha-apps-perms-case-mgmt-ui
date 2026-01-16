import { beforeEach, describe, expect, test, vi } from 'vitest'
import jwt from '@hapi/jwt'

import {
  CognitoFederatedCredentialProvider,
  cognitoFederatedCredentials,
  tokenHasExpired
} from './cognito.js'
import { config } from '../../../../config/config.js'

const { sendMock, cognitoIdentityClientMock, getOpenIdTokenCommandMock } =
  vi.hoisted(() => {
    const send = vi.fn()
    const cognitoClient = vi.fn(function () {
      return { send }
    })
    const getOpenIdCommand = vi.fn(function (input) {
      this.input = input
      return { input }
    })
    return {
      sendMock: send,
      cognitoIdentityClientMock: cognitoClient,
      getOpenIdTokenCommandMock: getOpenIdCommand
    }
  })

vi.mock('@aws-sdk/client-cognito-identity', () => ({
  CognitoIdentityClient: cognitoIdentityClientMock,
  GetOpenIdTokenForDeveloperIdentityCommand: getOpenIdTokenCommandMock
}))

describe('CognitoFederatedCredentialProvider', () => {
  beforeEach(() => {
    sendMock.mockReset()
    getOpenIdTokenCommandMock.mockClear()
    cognitoIdentityClientMock.mockClear()
  })

  test('requests a new token with the expected logins map', async () => {
    sendMock.mockResolvedValue({
      IdentityId: 'identity-id',
      Token: 'issued-token'
    })
    const provider = new CognitoFederatedCredentialProvider('pool-id')

    const token = await provider.requestCognitoToken()

    expect(getOpenIdTokenCommandMock).toHaveBeenCalledWith({
      IdentityPoolId: 'pool-id',
      Logins: provider.logins
    })
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({ input: expect.any(Object) })
    )
    expect(token).toBe('issued-token')
  })

  test('reuses an existing unexpired token and avoids re-fetching', async () => {
    const provider = new CognitoFederatedCredentialProvider('pool-id')
    const validToken = jwt.token.generate(
      { exp: Math.floor(Date.now() / 1000) + 60 },
      { key: 'secret', algorithm: 'HS256' }
    )
    provider.token = validToken

    const token = await provider.getToken()

    expect(token).toBe(validToken)
    expect(sendMock).not.toHaveBeenCalled()
  })

  test('refreshes when the cached token is expired', async () => {
    sendMock.mockResolvedValue({ Token: 'new-token' })
    const provider = new CognitoFederatedCredentialProvider('pool-id')
    provider.token = jwt.token.generate(
      { exp: Math.floor(Date.now() / 1000) - 60 },
      { key: 'secret', algorithm: 'HS256' }
    )

    const token = await provider.getToken()

    expect(token).toBe('new-token')
    expect(sendMock).toHaveBeenCalled()
  })

  test('propagates errors when Cognito fails to issue a token', async () => {
    sendMock.mockRejectedValue(new Error('bad-request'))
    const provider = new CognitoFederatedCredentialProvider('pool-id')

    await expect(provider.requestCognitoToken()).rejects.toThrow('bad-request')
  })
})

describe('cognitoFederatedCredentials plugin', () => {
  const originalPoolId = config.get('azureFederatedCredentials.identityPoolId')

  afterEach(() => {
    config.set('azureFederatedCredentials.identityPoolId', originalPoolId)
  })

  test('throws when identityPoolId is missing', async () => {
    config.set('azureFederatedCredentials.identityPoolId', null)

    expect(() =>
      cognitoFederatedCredentials.plugin.register({ decorate: vi.fn() })
    ).toThrow('AZURE_IDENTITY_POOL_ID')
  })

  test('decorates the server with a credential provider when configured', async () => {
    config.set('azureFederatedCredentials.identityPoolId', 'pool-id')
    const decorate = vi.fn()

    await cognitoFederatedCredentials.plugin.register({ decorate })

    expect(decorate).toHaveBeenCalledWith(
      'server',
      'federatedCredentials',
      expect.any(CognitoFederatedCredentialProvider)
    )
  })
})

describe('cognito tokenHasExpired', () => {
  test('returns false when the token is still valid', () => {
    const token = jwt.token.generate(
      { exp: Math.floor(Date.now() / 1000) + 60 },
      { key: 'secret', algorithm: 'HS256' }
    )

    expect(tokenHasExpired(token)).toBe(false)
  })

  test('returns true when the token has expired', () => {
    const token = jwt.token.generate(
      { exp: Math.floor(Date.now() / 1000) - 60 },
      { key: 'secret', algorithm: 'HS256' }
    )

    expect(tokenHasExpired(token)).toBe(true)
  })
})
