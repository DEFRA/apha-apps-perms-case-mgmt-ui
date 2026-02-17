import { readFileSync } from 'node:fs'

const pageLayoutTemplate = readFileSync(
  new URL('./page.njk', import.meta.url),
  {
    encoding: 'utf-8'
  }
)

describe('page layout header', () => {
  test('uses govukServiceNavigation for service-level navigation', () => {
    expect(pageLayoutTemplate).toContain('govukServiceNavigation({')
  })

  test('places the service name in service navigation rather than govukHeader', () => {
    const govukHeaderInvocation =
      pageLayoutTemplate.match(/govukHeader\(\{[\s\S]*?\}\)/)?.[0] ?? ''

    expect(pageLayoutTemplate).toMatch(
      /govukServiceNavigation\(\{[\s\S]*serviceName: serviceName/
    )
    expect(govukHeaderInvocation).not.toContain('serviceName:')
  })

  test('uses a custom navigationEnd slot for authenticated account details', () => {
    expect(pageLayoutTemplate).toContain('navigationEnd')
    expect(pageLayoutTemplate).toContain('account-banner-name')
  })

  test('does not use inline styles for account navigation alignment', () => {
    expect(pageLayoutTemplate).not.toContain('style="margin-left: auto;"')
  })

  test('adds a custom navigation class so account details can be positioned correctly', () => {
    expect(pageLayoutTemplate).toContain(
      'navigationClasses: "app-service-navigation__nav"'
    )
  })
})
