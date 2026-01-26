import jwt from '@hapi/jwt'
import { addSeconds } from 'date-fns'
import { dropUserSession } from './drop-user-session.js'

/**
 * @typedef {object} UserSession
 * @property {string} id
 * @property {string} email
 * @property {string} displayName
 * @property {string} [loginHint]
 * @property {boolean} isAuthenticated
 * @property {string} token
 * @property {string} refreshToken
 * @property {number} expiresIn
 * @property {string} expiresAt
 */

/**
 * Remove authenticated user from the portal
 * @param {any} request
 */
function removeAuthenticatedUser(request) {
  dropUserSession(request)

  if (request.sessionCookie?.h) {
    request.sessionCookie.clear()
    request.sessionCookie.h.unstate('csrfToken')
    request.sessionCookie.h.unstate('userSessionCookie')
  }
}

/**
 * Create user session
 * @param {any} request
 * @param {string} sessionId
 * @returns {Promise<UserSession>}
 */
async function createUserSession(request, sessionId) {
  const expiresInSeconds = request.auth.credentials.expiresIn
  const expiresInMilliSeconds = expiresInSeconds * 1000
  const expiresAt = addSeconds(new Date(), expiresInSeconds).toISOString()

  const { id, email, displayName, loginHint } = request.auth.credentials.profile

  const session = {
    id,
    email,
    displayName,
    loginHint,
    isAuthenticated: request.auth.isAuthenticated,
    token: request.auth.credentials.token,
    refreshToken: request.auth.credentials.refreshToken,
    expiresIn: expiresInMilliSeconds,
    expiresAt
  }

  await request.server.app.session.set(sessionId, session)
  return session
}

/**
 * @description MicroSoft refresh token response
 * @typedef {object} RefreshTokenResponse
 * @property {string} token_type
 * @property {string} scope
 * @property {number} expires_in
 * @property {string} ext_expires_in
 * @property {string} access_token
 * @property {string} refresh_token
 * @property {string} id_token
 */

/**
 * @typedef {object} JwtPayload
 * @property {string} oid
 * @property {string} preferred_username
 * @property {string} name
 * @property {string} login_hint
 */

/**
 * Refresh user session
 * @param {any} request
 * @param {RefreshTokenResponse} refreshTokenResponse
 * @returns {Promise<void | any>}
 */
async function refreshUserSession(request, refreshTokenResponse) {
  request.logger.debug('User session refreshing')

  const refreshedToken = refreshTokenResponse.access_token

  /** @type {JwtPayload} */
  const payload = jwt.token.decode(refreshedToken).decoded.payload

  // Update userSession with new access token and new expiry details
  const expiresInSeconds = refreshTokenResponse.expires_in
  const expiresInMilliSeconds = expiresInSeconds * 1000
  const expiresAt = addSeconds(new Date(), expiresInSeconds).toISOString()

  request.logger.info(
    `User session refreshed, UserId: ${payload.oid}, displayName: ${payload.name}`
  )

  const session = {
    id: payload.oid,
    email: payload.preferred_username,
    displayName: payload.name,
    loginHint: payload.login_hint,
    isAuthenticated: true,
    token: refreshTokenResponse.access_token,
    refreshToken: refreshTokenResponse.refresh_token,
    expiresIn: expiresInMilliSeconds,
    expiresAt
  }

  await request.server.app.session.set(
    request.state.userSessionCookie.sessionId,
    session
  )

  return session
}

export { createUserSession, refreshUserSession, removeAuthenticatedUser }
