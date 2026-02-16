import { createLogger } from '../../logging/logger.js'
import { createTokenManager } from './token-manager.js'

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
export const bearerToken = (config) => {
  const tokenManager = createTokenManager({
    ...config,
    logger: config.logger ?? createLogger()
  })

  return async (request) => {
    const { accessToken } = await tokenManager.getAuthorization()

    const headers = new Headers(request.headers)
    headers.set('Authorization', `Bearer ${accessToken}`)

    return new Request(request, { headers })
  }
}
