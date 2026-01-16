import { forceErrorLogController } from './controller.js'

export const forceErrorLog = {
  plugin: {
    name: 'force-error-log',
    register(server) {
      server.route({
        method: 'GET',
        path: '/force-error-log',
        ...forceErrorLogController
      })
    }
  }
}
