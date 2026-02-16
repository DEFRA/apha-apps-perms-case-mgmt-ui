import { Buffer } from 'node:buffer'

import { TokenResponseSchema } from '../schemas.js'
import {
  IntegrationBridgeConfigurationError,
  IntegrationBridgeRequestError
} from '../client.js'

/**
 * @param {number} expiresInSeconds
 * @param {number} tokenBufferSeconds
 * @typedef {{ accessToken: string, expiresAt: Date }} Authorization
 */

const calculateExpiry = (expiresInSeconds, tokenBufferSeconds) => {
  const expiresIn = Math.max(Number(expiresInSeconds ?? 0), 0)
  const bufferMs = tokenBufferSeconds * 1000
  const expiresAtMs = Date.now() + Math.max(expiresIn * 1000 - bufferMs, 0)

  return new Date(expiresAtMs)
}

/**
 * @param {{
 *   tokenUrl: string
 *   clientId: string
 *   clientSecret: string
 *   tokenBufferSeconds?: number
 *   fetchImpl?: typeof fetch
 *   logger: import('pino').BaseLogger
 * }} config
 * @returns {{ getAuthorization: () => Promise<Authorization> }}
 */
export const createTokenManager = ({
  tokenUrl,
  clientId,
  clientSecret,
  tokenBufferSeconds = 30,
  fetchImpl = fetch,
  logger
}) => {
  if (!tokenUrl || !clientId || !clientSecret) {
    throw new IntegrationBridgeConfigurationError(
      'Integration Bridge bearerToken requires tokenUrl, clientId and clientSecret'
    )
  }

  /** @type {Authorization | null} */
  let authorization = null

  /** @type {Promise<Authorization> | null} */
  let authorizationPromise = null

  const authorizationIsValid = (currentAuthorization) =>
    Boolean(currentAuthorization?.expiresAt) &&
    currentAuthorization.expiresAt.getTime() > Date.now()

  const requestAccessToken = async () => {
    logger.info('Fetching Cognito access token for the APHA Integration Bridge')

    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret
    })

    const response = await fetchImpl(tokenUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(
          `${clientId}:${clientSecret}`
        ).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body
    })

    if (!response.ok) {
      throw new IntegrationBridgeRequestError(
        `Failed to fetch access token: ${response.status}`,
        { status: response.status, payload: await response.text() }
      )
    }

    const { error, value } = TokenResponseSchema.validate(await response.json())

    if (error) {
      throw new IntegrationBridgeRequestError(
        'Integration Bridge token response validation failed',
        { cause: error }
      )
    }

    return {
      accessToken: value.access_token,
      expiresAt: calculateExpiry(value.expires_in, tokenBufferSeconds)
    }
  }

  const getAuthorization = async () => {
    if (authorization && authorizationIsValid(authorization)) {
      return authorization
    }

    if (authorizationPromise) {
      return authorizationPromise
    }

    authorizationPromise = requestAccessToken()
      .then((nextAuthorization) => {
        authorization = nextAuthorization
        return nextAuthorization
      })
      .finally(() => {
        authorizationPromise = null
      })

    return authorizationPromise
  }

  return { getAuthorization }
}
