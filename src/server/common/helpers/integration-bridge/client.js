import { Buffer } from 'node:buffer'

import { FindUserResponseSchema, TokenResponseSchema } from './schemas.js'
import { createLogger } from '../logging/logger.js'

class IntegrationBridgeConfigurationError extends Error {
  constructor(message) {
    super(message)

    this.name = 'IntegrationBridgeConfigurationError'
  }
}

class IntegrationBridgeRequestError extends Error {
  /**
   * @param {string} message
   * @param {{ status?: number, payload?: unknown, cause?: unknown }} [options]
   */
  constructor(message, options = {}) {
    super(message, options?.cause ? { cause: options.cause } : undefined)

    this.name = 'IntegrationBridgeRequestError'

    this.status = options.status

    this.payload = options.payload
  }
}

class IntegrationBridgeClient {
  /**
   * @param {{
   *   baseUrl: string
   *   tokenUrl: string
   *   clientId: string
   *   clientSecret: string
   *   fetchImpl?: typeof fetch
   *   logger?: import('pino').BaseLogger
   *   tokenBufferSeconds?: number
   * }} options
   */
  constructor({
    baseUrl,
    tokenUrl,
    clientId,
    clientSecret,
    fetchImpl = fetch,
    logger = createLogger(),
    tokenBufferSeconds = 30
  }) {
    if (!baseUrl || !tokenUrl || !clientId || !clientSecret) {
      throw new IntegrationBridgeConfigurationError(
        'Integration Bridge requires baseUrl, tokenUrl, clientId and clientSecret to be configured'
      )
    }

    this.baseUrl = baseUrl

    this.tokenUrl = tokenUrl

    this.clientId = clientId

    this.clientSecret = clientSecret

    this.fetch = fetchImpl

    this.logger = logger

    this.tokenBufferSeconds = tokenBufferSeconds

    this.accessToken = null

    this.accessTokenExpiresAt = null

    this.pendingTokenPromise = null
  }

  async findCaseManagementUser(emailAddress) {
    if (!emailAddress) {
      throw new IntegrationBridgeRequestError(
        'emailAddress is required to look up a case management user'
      )
    }

    return this.postJson(
      '/case-management/users/find',
      { emailAddress },
      FindUserResponseSchema,
      'case-management/users/find'
    )
  }

  /**
   * @param {string} path
   * @param {any} body
   * @param {import('joi').Schema | null} schema
   * @param {string} [contextLabel]
   * @param {string} [forwardedUserToken] - Optional user access token to forward to downstream services
   */
  async postJson(path, body, schema, contextLabel, forwardedUserToken) {
    if (!this.baseUrl) {
      throw new IntegrationBridgeConfigurationError(
        'APHA_INTEGRATION_BRIDGE_BASE_URL must be configured'
      )
    }

    const token = await this.getAccessToken()

    const url = new URL(path, this.baseUrl)

    const forwardedAuthorization =
      this.formatForwardedAuthorization(forwardedUserToken)

    const response = await this.safeFetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(forwardedAuthorization
          ? { 'X-Forwarded-Authorization': forwardedAuthorization }
          : {})
      },
      body: JSON.stringify(body)
    })

    const payload = await this.readPayload(response)

    if (!response.ok) {
      throw new IntegrationBridgeRequestError(
        `Integration Bridge responded with ${response.status}`,
        { status: response.status, payload }
      )
    }

    if (schema) {
      return this.validatePayload(payload, schema, contextLabel ?? path)
    }

    return payload
  }

  async getAccessToken() {
    if (!this.tokenUrl || !this.clientId || !this.clientSecret) {
      throw new IntegrationBridgeConfigurationError(
        'APHA Integration Bridge credentials are not configured'
      )
    }

    if (this.accessToken && this.tokenIsValid()) {
      return this.accessToken
    }

    if (this.pendingTokenPromise) {
      return this.pendingTokenPromise
    }

    this.logger.info(
      'Fetching Cognito access token for the APHA Integration Bridge'
    )

    this.pendingTokenPromise = this.requestAccessToken().finally(() => {
      this.pendingTokenPromise = null
    })

    return this.pendingTokenPromise
  }

  tokenIsValid() {
    return (
      Boolean(this.accessTokenExpiresAt) &&
      (this.accessTokenExpiresAt ?? 0) > Date.now()
    )
  }

  async requestAccessToken() {
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.clientId,
      client_secret: this.clientSecret
    })

    const response = await this.safeFetch(this.tokenUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(
          `${this.clientId}:${this.clientSecret}`
        ).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body
    })

    const payload = await this.readPayload(response)

    if (!response.ok) {
      throw new IntegrationBridgeRequestError(
        `Failed to fetch access token: ${response.status}`,
        { status: response.status, payload }
      )
    }

    const validatedToken = this.validatePayload(
      payload,
      TokenResponseSchema,
      'token response'
    )

    const accessToken = validatedToken.access_token

    this.accessToken = accessToken

    const expiresInSeconds = Number(validatedToken.expires_in ?? 0)

    const bufferMs = this.tokenBufferSeconds * 1000

    let expiryMs = 0

    if (expiresInSeconds > 0) {
      expiryMs = Math.max(expiresInSeconds * 1000 - bufferMs, 0)
    }

    this.accessTokenExpiresAt = Date.now() + expiryMs

    return accessToken
  }

  async safeFetch(url, options) {
    try {
      return await this.fetch(url, options)
    } catch (error) {
      throw new IntegrationBridgeRequestError(
        'Failed to communicate with the APHA Integration Bridge',
        { cause: error }
      )
    }
  }

  validatePayload(payload, schema, contextLabel) {
    const { error, value } = schema.validate(payload, {
      abortEarly: false
    })

    if (error) {
      throw new IntegrationBridgeRequestError(
        `Integration Bridge payload validation failed for ${contextLabel}`,
        { payload, cause: error }
      )
    }

    return value
  }

  async readPayload(response) {
    const text = await response.text()

    if (!text) {
      return null
    }

    try {
      return JSON.parse(text)
    } catch {
      return text
    }
  }

  /**
   * Normalises an access token so it is safe to forward downstream.
   * Returns null when no token is provided.
   * @param {string} [forwardedUserToken]
   * @returns {string | null}
   */
  formatForwardedAuthorization(forwardedUserToken) {
    if (typeof forwardedUserToken !== 'string') {
      return null
    }

    const trimmedToken = forwardedUserToken.trim()

    if (!trimmedToken) {
      return null
    }

    return trimmedToken.startsWith('Bearer ')
      ? trimmedToken
      : `Bearer ${trimmedToken}`
  }
}

export {
  IntegrationBridgeClient,
  IntegrationBridgeConfigurationError,
  IntegrationBridgeRequestError
}
