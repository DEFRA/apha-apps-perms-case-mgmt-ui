/**
 * Get the user session from the cache
 * @param {string} [sessionId] - optional sessionId. Only needed when the userSessionCookie.sessionId is not available
 * @returns {Promise<UserSession | null>}
 */
async function getUserSession(
  sessionId = this.state?.userSessionCookie?.sessionId
) {
  if (!sessionId || !this.server.session) {
    return null
  }

  return this.server.session.get(sessionId)
}

export { getUserSession }

/**
 * @import { UserSession } from './user-session.js'
 */
