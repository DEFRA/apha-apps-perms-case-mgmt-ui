import { removeAuthenticatedUser } from '../common/helpers/auth/user-session.js'
import { fetchWellknown } from '../common/helpers/auth/fetch-well-known.js'

const logoutController = {
  handler: async (request, h) => {
    const userSession = request.auth.credentials

    if (!userSession) {
      return h.redirect('/')
    }

    const payload = await fetchWellknown()

    const logoutBaseUrl = payload.end_session_endpoint
    const referrer = request.info.referrer ?? ''
    const loginHint = userSession?.loginHint ?? ''

    const logoutUrl = `${logoutBaseUrl}?logout_hint=${encodeURIComponent(
      loginHint
    )}&post_logout_redirect_uri=${encodeURIComponent(referrer)}`

    removeAuthenticatedUser(request)

    return h.redirect(logoutUrl)
  }
}

export { logoutController }
