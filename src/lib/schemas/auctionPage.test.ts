import { describe, expect, test } from 'bun:test'
import {
	AUCTION_PAGE_CONTAINER_TYPES,
	AUCTION_PAGE_LIMITS,
	AUCTION_PAGE_LEAF_TYPES,
	AUCTION_TEMPLATE_D_TAG,
	AuctionPageBlockSchema,
	auctionPageDTag,
	countAuctionPageBlocks,
	parseAuctionPage,
	resolveAuctionPageLayout,
	validateAuctionPageForPublish,
	type AuctionPage,
} from './auctionPage'
import { StorefrontBlockSchema } from './storefront'

const text = (id: string) => ({ type: 'Text', props: { id, markdown: 'hi', align: 'left', width: 'normal' } })
const bid = (id: string) => ({ type: 'BidPanel', props: { id } })
const cols = (id: string, ratio: string, a: unknown[], b: unknown[] = [], c: unknown[] = []) => ({
	type: 'Columns',
	props: { id, ratio, a, b, c },
})
const doc = (content: unknown[], enabled = true) => ({
	version: 1,
	enabled,
	root: { props: { title: 't', theme: 'pleb', palette: 'auction-catalogue' } },
	content,
})

describe('document identity (decision 1)', () => {
	test('one seller-wide template tag and one tag per lot override', () => {
		expect(AUCTION_TEMPLATE_D_TAG).toBe('auction-template')
		expect(auctionPageDTag('lot-42')).toBe('auction-page:lot-42')
	})

	test('a lot override wins, then the seller template, then the platform default', () => {
		const make = (title: string, enabled = true) => ({
			...(doc([], enabled) as unknown as AuctionPage),
			root: { props: { ...(doc([]).root.props as AuctionPage['root']['props']), title } },
		})
		const lot = make('lot')
		const seller = make('seller')
		const platform = make('platform')
		expect(resolveAuctionPageLayout(lot, seller, platform).source).toBe('lot')
		expect(resolveAuctionPageLayout(null, seller, platform).source).toBe('seller')
		expect(resolveAuctionPageLayout(null, null, platform).source).toBe('platform')
	})

	test('a disabled lot override falls back to the seller template rather than blanking the lot', () => {
		const seller = doc([]) as unknown as AuctionPage
		const disabled = doc([], false) as unknown as AuctionPage
		expect(resolveAuctionPageLayout(disabled, seller, seller).source).toBe('seller')
		expect(resolveAuctionPageLayout(disabled, disabled, seller).source).toBe('platform')
	})
})

describe('source of truth (decision 2)', () => {
	test('no auction block can carry an amount, a time, a winner or an auction reference', () => {
		const forbidden = /amount|price|sats|currentBid|minimumBid|endsAt|startsAt|winner|auctionDTag|eventId|pubkey|reserveValue/i
		for (const option of AuctionPageBlockSchema.options) {
			const type = option.shape.type.value
			if (['Text', 'Image', 'ProductGrid', 'Divider', 'Spacer'].includes(type)) continue
			const keys = Object.keys(option.shape.props.shape)
			for (const key of keys) expect(forbidden.test(key), `${type}.${key}`).toBe(false)
		}
	})

	test('unknown props such as a smuggled bid amount are stripped, not rendered', () => {
		const parsed = AuctionPageBlockSchema.parse({ type: 'BidPanel', props: { id: 'b', currentBidSats: 1 } })
		expect('currentBidSats' in parsed.props).toBe(false)
	})
})

describe('nesting limits (decision 3)', () => {
	test('columns hold content blocks', () => {
		const result = validateAuctionPageForPublish(doc([cols('c', '1:1', [bid('b')], [text('t')])]))
		expect(result.ok).toBe(true)
	})

	test('columns cannot contain columns', () => {
		const result = validateAuctionPageForPublish(doc([cols('outer', '1:1', [cols('inner', '1:1', [text('t')])])]))
		expect(result.ok).toBe(false)
		if (!result.ok) expect(result.errors[0]).toContain('slots may only contain content blocks')
	})

	test('a live show stage cannot contain columns or another stage', () => {
		const stage = (left: unknown[]) => ({ type: 'LiveShowStage', props: { id: 's', left, right: [] } })
		expect(validateAuctionPageForPublish(doc([stage([cols('c', '1:1', [])])])).ok).toBe(false)
		expect(validateAuctionPageForPublish(doc([stage([stage([])])])).ok).toBe(false)
		expect(validateAuctionPageForPublish(doc([stage([bid('b')])])).ok).toBe(true)
	})

	test('no ratio expresses more than three columns', () => {
		expect(validateAuctionPageForPublish(doc([cols('c', '1:1:1:1', [])])).ok).toBe(false)
		expect(AUCTION_PAGE_LIMITS.maxColumns).toBe(3)
	})

	test('a two-column ratio with content in the third column is rejected on publish', () => {
		const result = validateAuctionPageForPublish(doc([cols('c', '7:5', [text('a')], [text('b')], [text('c')])]))
		expect(result.ok).toBe(false)
	})

	test('blocks inside columns count towards the 100-block cap', () => {
		const inner = Array.from({ length: 20 }, (_, i) => text(`t${i}`))
		// 5 containers × (1 + 20) = 105 blocks.
		const content = Array.from({ length: 5 }, (_, i) => cols(`c${i}`, '1:1', inner))
		const result = validateAuctionPageForPublish(doc(content))
		expect(result.ok).toBe(false)
		if (!result.ok) expect(result.errors.join(' ')).toContain('including blocks inside columns')
	})

	test('a slot holds at most 20 blocks', () => {
		const inner = Array.from({ length: 21 }, (_, i) => text(`t${i}`))
		expect(validateAuctionPageForPublish(doc([cols('c', '1:1', inner)])).ok).toBe(false)
	})

	test('the lenient parser drops a nested container but keeps the rest of the column', () => {
		const raw = JSON.stringify(doc([cols('outer', '1:1', [text('keep'), cols('inner', '1:1', [])], [bid('b')])]))
		const { page, droppedBlocks } = parseAuctionPage(raw)
		expect(droppedBlocks).toBe(1)
		const outer = page!.content[0]
		expect(outer.type).toBe('Columns')
		if (outer.type === 'Columns') {
			expect(outer.props.a.map((b) => b.props.id)).toEqual(['keep'])
			expect(outer.props.b.map((b) => b.props.id)).toEqual(['b'])
		}
	})

	test('the lenient parser stops at the block budget, counting nested blocks', () => {
		const inner = Array.from({ length: 20 }, (_, i) => text(`t${i}`))
		const raw = JSON.stringify(doc(Array.from({ length: 6 }, (_, i) => cols(`c${i}`, '1:1', inner))))
		const { page, droppedBlocks } = parseAuctionPage(raw)
		expect(countAuctionPageBlocks(page!.content)).toBe(AUCTION_PAGE_LIMITS.maxBlocks)
		expect(droppedBlocks).toBe(6 * 21 - AUCTION_PAGE_LIMITS.maxBlocks)
	})

	test('a two-column ratio ignores a third slot when reading', () => {
		const { page } = parseAuctionPage(JSON.stringify(doc([cols('c', '1:1', [text('a')], [text('b')], [text('c')])])))
		const block = page!.content[0]
		if (block.type === 'Columns') expect(block.props.c).toEqual([])
	})
})

describe('system screens (decision 4)', () => {
	test('winner, refund, end-of-auction and shipping screens are not blocks a document can name', () => {
		const all = [...AUCTION_PAGE_LEAF_TYPES, ...AUCTION_PAGE_CONTAINER_TYPES].map((t) => t.toLowerCase())
		for (const word of ['winner', 'celebration', 'refund', 'outbid', 'shipping', 'notice', 'outcome', 'system']) {
			expect(
				all.some((t) => t.includes(word)),
				word,
			).toBe(false)
		}
	})
})

describe('security model', () => {
	test('video and poster URLs must be https or in-app', () => {
		expect(AuctionPageBlockSchema.safeParse({ type: 'LiveVideo', props: { id: 'v', videoSrc: 'javascript:alert(1)' } }).success).toBe(false)
		expect(AuctionPageBlockSchema.safeParse({ type: 'LiveVideo', props: { id: 'v', videoSrc: 'http://x.test/a.mp4' } }).success).toBe(false)
		expect(AuctionPageBlockSchema.safeParse({ type: 'LiveVideo', props: { id: 'v', videoSrc: 'https://x.test/a.mp4' } }).success).toBe(true)
		expect(
			AuctionPageBlockSchema.safeParse({ type: 'LiveShowStage', props: { id: 's', posterUrl: 'data:image/png;base64,AA' } }).success,
		).toBe(false)
	})

	test('storefront pages cannot contain auction blocks', () => {
		expect(StorefrontBlockSchema.safeParse({ type: 'BidPanel', props: { id: 'b' } }).success).toBe(false)
		expect(StorefrontBlockSchema.safeParse({ type: 'Columns', props: { id: 'c' } }).success).toBe(false)
	})

	test('unknown block types are dropped on read and reported on publish', () => {
		const raw = JSON.stringify(doc([{ type: 'Html', props: { id: 'x', html: '<script>' } }, bid('b')]))
		const { page, droppedBlocks } = parseAuctionPage(raw)
		expect(droppedBlocks).toBe(1)
		expect(page!.content.map((b) => b.type)).toEqual(['BidPanel'])
		expect(validateAuctionPageForPublish(JSON.parse(raw)).ok).toBe(false)
	})

	test('a document with the wrong version is refused whole', () => {
		expect(parseAuctionPage(JSON.stringify({ ...doc([]), version: 2 })).page).toBeNull()
		expect(parseAuctionPage('not json').page).toBeNull()
	})
})
