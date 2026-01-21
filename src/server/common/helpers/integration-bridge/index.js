import { config } from '../../../../config/config.js'
import { IntegrationBridgeClient } from './client.js'

function buildIntegrationBridgeClient() {
  return new IntegrationBridgeClient({
    baseUrl: config.get('integrationBridge.baseUrl'),
    tokenUrl: config.get('integrationBridge.tokenUrl'),
    clientId: config.get('integrationBridge.clientId'),
    clientSecret: config.get('integrationBridge.clientSecret')
  })
}

export const integrationClient = buildIntegrationBridgeClient()
