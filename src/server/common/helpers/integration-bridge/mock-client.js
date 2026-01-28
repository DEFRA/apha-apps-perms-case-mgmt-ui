import { IntegrationBridgeRequestError } from './client.js'

function buildAllowlist(allowlistString) {
  if (!allowlistString) {
    return new Set()
  }

  return new Set(
    allowlistString
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  )
}

class MockIntegrationBridgeClient {
  /**
   * @param {string} allowlistString
   */
  constructor(allowlistString = '') {
    this.allowlist = buildAllowlist(allowlistString)
  }

  /**
   * @param {string | undefined | null} emailAddress
   * @returns {Promise<{ data: Array<{ id: string, type: string, emailAddress: string }> }>}
   */
  async findCaseManagementUser(emailAddress) {
    if (!emailAddress) {
      throw new IntegrationBridgeRequestError(
        'emailAddress is required to look up a case management user'
      )
    }

    const isAllowed =
      this.allowlist.size === 0 ||
      this.allowlist.has(String(emailAddress).toLowerCase())

    if (!isAllowed) {
      return { data: [] }
    }

    return {
      data: [
        {
          id: `mock-${emailAddress}`,
          type: 'case-management-user',
          emailAddress
        }
      ]
    }
  }
}

export { MockIntegrationBridgeClient, buildAllowlist }
