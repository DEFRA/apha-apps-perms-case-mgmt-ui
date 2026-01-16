import { refreshUserSession, removeAuthenticatedUser } from './user-session.js'
import { isPast, parseISO } from 'date-fns'

/**
 * To be used as a server ext method to check if a token has expired and attempt to use the refresh token to get a
 * new one.
 * Requires a refreshToken function as the first param to provide a new token.
 * @param {Function} refreshToken
 * @param {{}} request
 * @param {{}} userSession
 * @returns {Promise<*>}
 */
export async function refreshTokenIfExpired(
  refreshToken,
  request,
  userSession
) {
  if (!userSession?.expiresAt) {
    return null
  }

  const tokenHasExpired =
    Boolean(userSession?.expiresAt) && isPast(parseISO(userSession?.expiresAt))

  if (!tokenHasExpired) {
    return null
  }

  request.logger.info(
    `Token for user ${userSession?.displayName} has expired, attempting to refresh`
  )

  try {
    const refreshTokenResponse = await refreshToken(userSession?.refreshToken)
    return refreshUserSession(request, refreshTokenResponse)
  } catch (error) {
    request.logger.debug(
      error,
      `Token refresh for ${userSession?.displayName} failed`
    )
    removeAuthenticatedUser(request)
    return null
  }
}
