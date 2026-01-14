/**
 * Service home page controller.
 */
export const homeController = {
  handler(_request, h) {
    return h.view('home/index', {
      pageTitle: 'Case Management Service',
      heading: 'Case Management Service'
    })
  }
}
