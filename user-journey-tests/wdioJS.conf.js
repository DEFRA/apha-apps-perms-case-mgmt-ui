import merge from 'deepmerge'
import { config as wdioConf } from './wdio.conf.js'

export const config = merge(wdioConf, {
  specs: ['./specs/**/*.spec.js'],
  exclude: ['./specs/noJavascript/**/*.js'],
  maxInstances: 7,
  capabilities: [
    {
      browserName: 'chrome',
      browserVersion: 'stable',
      'goog:chromeOptions': {
        args: ['headless', 'disable-gpu']
      }
    }
  ]
})
