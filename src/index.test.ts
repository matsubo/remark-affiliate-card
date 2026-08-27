/// <reference types="bun" />
import { describe, expect, test } from 'bun:test'
import plugin, {
  createRemarkAmazon,
  extractAsin,
  remarkAmazon,
  renderAmazonCard,
  resolveShopLinks,
} from './index.js'

// A `remark-*` package default-exports its plugin. That convention is the whole
// reason the entry point stopped being an Astro integration, so it is worth a
// test of its own rather than leaving it to the export map.
describe('package entry point', () => {
  test('default-exports the remark plugin', () => {
    expect(plugin).toBe(remarkAmazon)
  })

  test('re-exports the factory a site registers itself', () => {
    expect(typeof createRemarkAmazon).toBe('function')
  })

  test('re-exports the card renderer', () => {
    expect(typeof renderAmazonCard).toBe('function')
  })

  // A value re-export, not a type one: `export *` would silently drop these if
  // shops.ts ever became types-only.
  test('re-exports the shop helpers as values', () => {
    expect(typeof resolveShopLinks).toBe('function')
    expect(extractAsin('https://www.amazon.co.jp/dp/B00TQMO5E0')).toBe('B00TQMO5E0')
  })
})
