import { statusCodes } from '../common/constants/status-codes.js'

export const forceHttpErrorController = {
  handler(_request, h) {
    return h
      .response({ message: 'Internal Server Error' })
      .code(statusCodes.internalServerError)
  }
}
