import { describe, expect, test, vi } from 'vitest'

import { asExternalUrl, redirectWithRefresh } from './url-helpers.js'

describe('url-helpers', () => {
  test('asExternalUrl replaces host, protocol and port', () => {
    const result = asExternalUrl(
      'http://localhost:3000/foo?a=b',
      'https://example.com:8443'
    )

    expect(result.toString()).toBe('https://example.com:8443/foo?a=b')
  })

  test('redirectWithRefresh returns takeover response with escaped URL', () => {
    const response = vi.fn().mockReturnValue({ takeover: vi.fn(() => 'taken') })
    const h = { response }
    const result = redirectWithRefresh(h, 'https://example.com/next?x=1&y=2')

    expect(response).toHaveBeenCalledWith(
      expect.stringContaining(
        'content="0;URL=\'https://example.com/next?x=1&amp;y=2\'"'
      )
    )
    expect(result).toBe('taken')
  })
})
