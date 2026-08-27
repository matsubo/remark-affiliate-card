// The package entry point. `remark-*` packages default-export their plugin, so
// that is what `.` resolves to; the card renderer and the shop helpers are here
// because a site occasionally builds a card outside Markdown.

export type { AmazonCardData, CardLabels } from './card.js'
export { renderAmazonCard } from './card.js'
export type { AffiliateCardOptions } from './options.js'
export {
  createRemarkAmazon,
  type ProductRecord,
  type RemarkAmazonOptions,
  remarkAmazon,
  remarkAmazon as default,
} from './remark.js'
export * from './shops.js'
