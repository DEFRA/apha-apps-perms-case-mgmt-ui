import { config } from '../../../../config/config.js'
import {
  IntegrationBridgeClient,
  IntegrationBridgeConfigurationError
} from './client.js'
import { bearerToken } from './middleware/bearer-token.js'

export function buildIntegrationBridgeClient() {
  return new IntegrationBridgeClient({
    baseUrl: config.get('integrationBridge.baseUrl'),
    middleware: bearerToken({
      tokenUrl: config.get('integrationBridge.tokenUrl'),
      clientId: config.get('integrationBridge.clientId'),
      clientSecret: config.get('integrationBridge.clientSecret')
    })
  })
}

function createIntegrationClient() {
  try {
    return buildIntegrationBridgeClient()
  } catch (error) {
    // In tests we don't always configure the Integration Bridge; return a stub that will
    // still surface the configuration error if the client is used.
    if (
      process.env.NODE_ENV === 'test' &&
      error instanceof IntegrationBridgeConfigurationError
    ) {
      return {
        send() {
          throw error
        }
      }
    }
    throw error
  }
}

export const integrationClient = createIntegrationClient()
