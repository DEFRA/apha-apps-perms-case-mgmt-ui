/**
 * Drop the user session from the cache
 * @param {string} [sessionId]
 * @returns {Promise<void>}
 */
async function dropUserSession(
  sessionId = this.state?.userSessionCookie?.sessionId
) {
  if (!sessionId || !this.server.session) {
    return
  }

  await this.server.session.drop(sessionId)
}

export { dropUserSession }
