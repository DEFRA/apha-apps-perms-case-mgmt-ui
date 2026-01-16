import { statusCodes } from '../common/constants/status-codes.js'
import { createLogger } from '../common/helpers/logging/logger.js'

export const forceErrorLogController = {
  handler(_request, h) {
    createLogger().error('This is a forced error log message')
    return h.response({ message: 'error log generated' }).code(statusCodes.ok)
  }
}
