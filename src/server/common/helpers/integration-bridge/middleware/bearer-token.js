import { Buffer } from 'node:buffer'

import { TokenResponseSchema } from '../schemas.js'
import { createLogger } from '../../logging/logger.js'
import {
  IntegrationBridgeConfigurationError,
  IntegrationBridgeRequestError
} from '../client.js'

/**
 * @typedef {{ accessToken: string, expiresAt: Date }} Authorization
 */

/**
 * @param {{
 *   tokenUrl: string
 *   clientId: string
 *   clientSecret: string
 *   tokenBufferSeconds?: number
 *   fetchImpl?: typeof fetch
 *   logger?: import('pino').BaseLogger
 * }} config
 * @returns {(request: Request) => Promise<Request>}
 */
const bearerToken = ({
  tokenUrl,
  clientId,
  clientSecret,
  tokenBufferSeconds = 30,
  fetchImpl = fetch,
  logger = createLogger()
}) => {
  if (!tokenUrl || !clientId || !clientSecret) {
    throw new IntegrationBridgeConfigurationError(
      'Integration Bridge bearerToken requires tokenUrl, clientId and clientSecret'
    )
  }

  /** @type {Promise<Authorization> | null} */
  let authorization = null

  /** @type {Promise<Authorization> | null} */
  let refreshPromise = null

  const authorizationIsValid = (currentAuthorization) =>
    Boolean(currentAuthorization?.expiresAt) &&
    currentAuthorization.expiresAt.getTime() > Date.now()

  const calculateExpiry = (expiresInSeconds) => {
    const expiresIn = Number(expiresInSeconds ?? 0)
    const bufferMs = tokenBufferSeconds * 1000

    if (expiresIn <= 0) {
      return new Date()
    }

    const expiresAtMs = Date.now() + Math.max(expiresIn * 1000 - bufferMs, 0)

    return new Date(expiresAtMs)
  }

  const readPayload = async (response) => {
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

  const validatePayload = (payload, schema, contextLabel) => {
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

  const safeFetch = async (url, options) => {
    try {
      return await fetchImpl(url, options)
    } catch (error) {
      throw new IntegrationBridgeRequestError(
        'Failed to communicate with the APHA Integration Bridge',
        { cause: error }
      )
    }
  }

  const requestAccessToken = async () => {
    logger.info('Fetching Cognito access token for the APHA Integration Bridge')

    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret
    })

    const response = await safeFetch(tokenUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(
          `${clientId}:${clientSecret}`
        ).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body
    })

    const payload = await readPayload(response)

    if (!response.ok) {
      throw new IntegrationBridgeRequestError(
        `Failed to fetch access token: ${response.status}`,
        { status: response.status, payload }
      )
    }

    const validatedToken = validatePayload(
      payload,
      TokenResponseSchema,
      'token response'
    )

    const accessToken = validatedToken.access_token
    const expiresAt = calculateExpiry(validatedToken.expires_in)

    return { accessToken, expiresAt }
  }

  const getAuthorization = async () => {
    if (!authorization) {
      authorization = requestAccessToken().catch((error) => {
        authorization = null
        throw error
      })

      return authorization
    }

    if (refreshPromise) {
      return refreshPromise
    }

    const currentAuthorization = await authorization

    if (authorizationIsValid(currentAuthorization)) {
      return currentAuthorization
    }

    if (!refreshPromise) {
      refreshPromise = requestAccessToken()
        .then((refreshedAuthorization) => {
          authorization = Promise.resolve(refreshedAuthorization)
          return refreshedAuthorization
        })
        .catch((error) => {
          authorization = null
          throw error
        })
        .finally(() => {
          refreshPromise = null
        })
    }

    return refreshPromise
  }

  return async (request) => {
    const { accessToken } = await getAuthorization()

    const headers = new Headers(request.headers)
    headers.set('Authorization', `Bearer ${accessToken}`)

    return new Request(request, { headers })
  }
}

export { bearerToken }
