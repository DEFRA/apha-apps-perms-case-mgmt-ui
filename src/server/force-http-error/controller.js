export const forceHttpErrorController = {
  handler(_request, h) {
    throw new Error('Forced HTTP error')
  }
}
