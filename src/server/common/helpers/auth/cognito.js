import jwt from '@hapi/jwt'
import {
  CognitoIdentityClient,
  GetOpenIdTokenForDeveloperIdentityCommand
} from '@aws-sdk/client-cognito-identity'
import { config } from '../../../../config/config.js'
import { createLogger } from '../logging/logger.js'

const logger = createLogger()

export class CognitoFederatedCredentialProvider {
  constructor(poolId) {
    this.token = null
    this.poolId = poolId
    this.logins = {
      [config.get('azureFederatedCredentials.providerName')]:
        'apha-apps-perms-case-mgmt-ui'
    }
    this.client = new CognitoIdentityClient()
  }

  async requestCognitoToken() {
    const input = {
      IdentityPoolId: this.poolId,
      Logins: this.logins
    }
    try {
      const command = new GetOpenIdTokenForDeveloperIdentityCommand(input)
      const result = await this.client.send(command)
      logger.info(`Got token from Cognito ${result?.IdentityId}`)
      return result.Token
    } catch (e) {
      logger.error(e, 'Failed to get Cognito Token')
      throw e
    }
  }

  async getToken() {
    if (!this.token || tokenHasExpired(this.token)) {
      logger.info('Refreshing cognito token')
      this.token = await this.requestCognitoToken()
    }
    return this.token
  }
}

export const cognitoFederatedCredentials = {
  plugin: {
    name: 'federated-credentials',
    version: '1.0.0',
    register: (server) => {
      const poolId = config.get('azureFederatedCredentials.identityPoolId')
      if (!poolId) {
        throw new Error(
          'AZURE_IDENTITY_POOL_ID must be set when federated credential mocking is disabled'
        )
      }
      const cognitoProvider = new CognitoFederatedCredentialProvider(poolId)
      server.decorate('server', 'federatedCredentials', cognitoProvider)
    }
  }
}

export function tokenHasExpired(token) {
  try {
    const decodedToken = jwt.token.decode(token)
    jwt.token.verifyTime(decodedToken)
  } catch (e) {
    logger.debug(e, 'Cognito token has expired')
    return true
  }
  return false
}
