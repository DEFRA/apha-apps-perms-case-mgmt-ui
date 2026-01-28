import { logoutController } from './controller.js'

const logout = {
  plugin: {
    name: 'logout',
    register: (server) => {
      server.route([
        {
          method: 'GET',
          path: '/auth/logout',
          ...logoutController
        }
      ])
    }
  }
}

export { logout }
