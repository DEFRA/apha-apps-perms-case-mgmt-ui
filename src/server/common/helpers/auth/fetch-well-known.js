import { readFileSync } from 'node:fs'
import { config } from '../../../../config/config.js'

function buildMockWellKnown() {
  const tenantId = config.get('azureTenantId')
  const mockWellKnown = JSON.parse(
    readFileSync(new URL('./well-known-mock.json', import.meta.url), 'utf-8')
  )
  const replaceValue = (value) =>
    typeof value === 'string'
      ? value.replaceAll('__TENANT_ID__', tenantId)
      : value

  return Object.fromEntries(
    Object.entries(mockWellKnown).map(([key, value]) => [
      key,
      replaceValue(value)
    ])
  )
}

async function fetchWellknown() {
  if (config.get('azureFederatedCredentials.enableMocking')) {
    return buildMockWellKnown()
  }

  const endpoint = config.get('oidcWellKnownConfigurationUrl')
  const response = await fetch(endpoint)

  if (!response.ok) {
    throw new Error(
      `Failed to fetch well-known configuration from ${endpoint}: ${response.status}`
    )
  }

  return response.json()
}

export { fetchWellknown }
