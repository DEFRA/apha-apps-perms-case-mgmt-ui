import { forceHttpErrorController } from './controller.js'

export const forceHttpError = {
  plugin: {
    name: 'force-http-error',
    register(server) {
      server.route({
        method: 'GET',
        path: '/force-http-error',
        ...forceHttpErrorController
      })
    }
  }
}
