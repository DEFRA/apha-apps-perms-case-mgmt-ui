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
 * Get the user session from the cache
 * @param {string} [sessionId] - optional sessionId. Only needed when the userSessionCookie.sessionId is not available
 * @returns {Promise<UserSession | null>}
 */
async function getUserSession(
  request,
  sessionId = request?.state?.userSessionCookie?.sessionId
) {
  if (!sessionId || !request?.server?.app?.session) {
    return null
  }

  return request.server.app.session.get(sessionId)
}

export { getUserSession }
