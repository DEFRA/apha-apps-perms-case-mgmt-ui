import { getUserSession } from './auth/get-user-session.js'
import { dropUserSession } from './auth/drop-user-session.js'

/**
 * Add global server methods
 * @param {import('@hapi/hapi').Server} server
 */
function addDecorators(server) {
  server.decorate('request', 'getUserSession', getUserSession)
  server.decorate('request', 'dropUserSession', dropUserSession)
}

export { addDecorators }
