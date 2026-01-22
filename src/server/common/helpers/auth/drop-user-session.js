/**
 * Drop the user session from the cache
 * @param {string} [sessionId]
 * @returns {Promise<void>}
 */
async function dropUserSession(
  request,
  sessionId = request?.state?.userSessionCookie?.sessionId
) {
  if (!sessionId || !request?.server?.app?.session) {
    return
  }

  await request.server.app.session.drop(sessionId)
}

export { dropUserSession }
