import { z } from 'zod'
import {
	DividerBlockSchema,
	ImageBlockSchema,
	isSafeMediaSrc,
	ProductGridBlockSchema,
	SpacerBlockSchema,
	STOREFRONT_LIMITS,
	STOREFRONT_PAGE_KIND,
	STOREFRONT_PAGE_VERSION,
	StorefrontPageEnvelopeSchema,
	parseStorefrontRootProps,
	TextBlockSchema,
	type StorefrontRootProps,
} from './storefront'

/**
 * Auction page layout documents (ADR-0023).
 *
 * An auction page layout is the storefront page format (ADR-019, ADR-0006,
 * PR #1423 Theme Studio) applied to an auction lot. It reuses the storefront
 * envelope, root props (theme, palette, tune), limits and security model, and
 * adds a closed set of auction blocks plus one layout primitive, `Columns`.
 *
 * What a layout document is NOT: a source of auction facts. The auction engine
 * (four validators, AUCTIONS.md) is the only source of truth for bids, prices,
 * timing, reserve, refunds and settlement. No block in this file has a prop
 * that can carry a bid amount, a price, a time or a winner. Blocks read those
 * from `AuctionLotView`, which the page builds from validated engine events.
 * The document only decides *where* things go and *how they look*.
 *
 * Nor does a block name the auction it shows. The lot comes from the route,
 * exactly as storefront data blocks take the author's pubkey from context. That
 * is what lets one seller-wide template apply to every lot (decision 1), and it
 * means a page cannot be authored to display somebody else's auction.
 *
 * System screens — winner celebration, end-of-auction, outbid refund notices,
 * buyer–seller shipping handoff — are deliberately absent from the union. They
 * are rendered by the page itself on every auction, so a layout cannot remove,
 * hide or reorder them (decision 4). Themes restyle them through the same
 * tokens as everything else.
 */

/** Same addressable kind as storefront pages; the `d` tag distinguishes them. */
export const AUCTION_PAGE_KIND = STOREFRONT_PAGE_KIND

/** `d` tag of the seller-wide auction template. One per seller. */
export const AUCTION_TEMPLATE_D_TAG = 'auction-template'

/** Prefix of the optional per-lot override. Full tag: `auction-page:<auction d tag>`. */
export const AUCTION_PAGE_D_TAG_PREFIX = 'auction-page:'

/** Same document version as storefront pages: the envelope is shared. */
export const AUCTION_PAGE_VERSION = STOREFRONT_PAGE_VERSION

export function auctionPageDTag(auctionDTag: string): string {
	return `${AUCTION_PAGE_D_TAG_PREFIX}${auctionDTag}`
}

/**
 * Nesting rules (decision 3). These cap what one document can make a renderer
 * do, the same way `STOREFRONT_LIMITS` does for flat pages.
 */
export const AUCTION_PAGE_LIMITS = {
	/** Every block counts, including blocks inside columns and stage slots. */
	maxBlocks: STOREFRONT_LIMITS.maxBlocks,
	/** Columns per row. */
	maxColumns: 3,
	/** Container depth: a container may hold leaf blocks, never another container. */
	maxDepth: 1,
	/** Blocks in one column or one stage slot. */
	maxBlocksPerSlot: 20,
} as const

const blockId = z.string().min(1).max(200)
const shortText = z.string().max(STOREFRONT_LIMITS.maxShortTextLength)
const safeMediaSrc = z.string().refine(isSafeMediaSrc, { message: 'Media must be an https:// URL or an in-app path starting with /' })

// ---------------------------------------------------------------------------
// Auction blocks (leaves)
// ---------------------------------------------------------------------------

export const LotHeaderBlockSchema = z.object({
	type: z.literal('LotHeader'),
	props: z.object({
		id: blockId,
		showLotNumber: z.boolean().default(true),
		showCategory: z.boolean().default(true),
		titleStyle: z.enum(['serif', 'sans', 'giant-caps']).default('serif'),
		align: z.enum(['left', 'center']).default('left'),
	}),
})

export const LotGalleryBlockSchema = z.object({
	type: z.literal('LotGallery'),
	props: z.object({
		id: blockId,
		layout: z.enum(['main-thumbs', 'grid', 'carousel']).default('main-thumbs'),
		thumbPosition: z.enum(['below', 'side']).default('below'),
		aspect: z.enum(['1:1', '4:3', '3:4', '16:9']).default('4:3'),
		lightbox: z.boolean().default(true),
		grayscaleUntilHover: z.boolean().default(false),
	}),
})

export const LiveVideoBlockSchema = z.object({
	type: z.literal('LiveVideo'),
	props: z.object({
		id: blockId,
		/** Optional fixed clip (e.g. a seller's pitch). Empty means "the lot's live stream, if any". */
		videoSrc: safeMediaSrc.or(z.literal('')).default(''),
		posterUrl: safeMediaSrc.or(z.literal('')).default(''),
		orientation: z.enum(['portrait', 'landscape']).default('landscape'),
		/** Browsers may block audible autoplay; the block then unmutes on the first tap. */
		soundDefault: z.enum(['on', 'off']).default('on'),
	}),
})

export const BidPanelBlockSchema = z.object({
	type: z.literal('BidPanel'),
	props: z.object({
		id: blockId,
		/**
		 * Interaction style only. Minimum bid, increment and validity always come
		 * from the engine; `steps` offers engine-computed increments as buttons.
		 */
		mode: z.enum(['steps', 'swipe', 'max-bid']).default('steps'),
		quickSteps: z.number().int().min(0).max(6).default(3),
		allowMaxBid: z.boolean().default(true),
		showWalletChip: z.boolean().default(true),
		ctaLabel: shortText.default('Bid now'),
	}),
})

export const CountdownBlockSchema = z.object({
	type: z.literal('Countdown'),
	props: z.object({
		id: blockId,
		style: z.enum(['digits', 'ring', 'bar']).default('digits'),
		size: z.enum(['md', 'lg', 'xl']).default('md'),
		pulseUnderSeconds: z.number().int().min(0).max(300).default(10),
		softCloseNote: z.boolean().default(true),
		showTimePercent: z.boolean().default(false),
	}),
})

export const ReserveMeterBlockSchema = z.object({
	type: z.literal('ReserveMeter'),
	props: z.object({
		id: blockId,
		showWhenMet: shortText.default('Reserve met'),
	}),
})

const feedStyle = z.enum(['default', 'index'])

export const BidFeedBlockSchema = z.object({
	type: z.literal('BidFeed'),
	props: z.object({
		id: blockId,
		title: shortText.default('Bids'),
		limit: z.number().int().min(1).max(50).default(20),
		highlightOwn: z.boolean().default(true),
		animateNew: z.enum(['none', 'subtle', 'slide']).default('subtle'),
		style: feedStyle.default('default'),
	}),
})

export const ChatFeedBlockSchema = z.object({
	type: z.literal('ChatFeed'),
	props: z.object({
		id: blockId,
		title: shortText.default('Chat'),
		style: z.enum(['threaded', 'stream', 'index']).default('stream'),
		allowReplies: z.boolean().default(true),
		allowReactions: z.boolean().default(true),
	}),
})

export const SellerCardBlockSchema = z.object({
	type: z.literal('SellerCard'),
	props: z.object({
		id: blockId,
		style: z.enum(['compact', 'host', 'index']).default('compact'),
		showRating: z.boolean().default(true),
		showMessageButton: z.boolean().default(true),
		showFollowButton: z.boolean().default(false),
	}),
})

export const LeaderboardBlockSchema = z.object({
	type: z.literal('Leaderboard'),
	props: z.object({
		id: blockId,
		limit: z.number().int().min(1).max(20).default(8),
		showAvatars: z.boolean().default(true),
		highlightLeader: z.boolean().default(true),
	}),
})

export const AUCTION_STAT_FIELDS = ['bids', 'bidders', 'watchers', 'bidsPerMinute'] as const

export const AuctionStatsBlockSchema = z.object({
	type: z.literal('AuctionStats'),
	props: z.object({
		id: blockId,
		fields: z.array(z.enum(AUCTION_STAT_FIELDS)).min(1).max(AUCTION_STAT_FIELDS.length).default(['bids', 'bidders', 'watchers']),
		style: z.enum(['inline', 'big-numbers', 'index']).default('inline'),
	}),
})

export const BidTickerBlockSchema = z.object({
	type: z.literal('BidTicker'),
	props: z.object({
		id: blockId,
		speed: z.enum(['slow', 'normal', 'fast']).default('normal'),
		style: z.enum(['default', 'inverted']).default('default'),
	}),
})

export const UpNextBlockSchema = z.object({
	type: z.literal('UpNext'),
	props: z.object({
		id: blockId,
		title: shortText.default('Up next'),
		limit: z.number().int().min(1).max(12).default(4),
	}),
})

/**
 * Leaf blocks: the auction set plus the storefront content blocks that make
 * sense on a lot page. Profile and hero blocks are left out on purpose — the
 * seller card and lot header are the auction equivalents.
 */
export const AuctionPageLeafBlockSchema = z.discriminatedUnion('type', [
	LotHeaderBlockSchema,
	LotGalleryBlockSchema,
	LiveVideoBlockSchema,
	BidPanelBlockSchema,
	CountdownBlockSchema,
	ReserveMeterBlockSchema,
	BidFeedBlockSchema,
	ChatFeedBlockSchema,
	SellerCardBlockSchema,
	LeaderboardBlockSchema,
	AuctionStatsBlockSchema,
	BidTickerBlockSchema,
	UpNextBlockSchema,
	TextBlockSchema,
	ImageBlockSchema,
	ProductGridBlockSchema,
	DividerBlockSchema,
	SpacerBlockSchema,
])

export type AuctionPageLeafBlock = z.infer<typeof AuctionPageLeafBlockSchema>
export type AuctionPageLeafBlockType = AuctionPageLeafBlock['type']

// ---------------------------------------------------------------------------
// Containers
// ---------------------------------------------------------------------------

/**
 * Closed ratio list. The number of parts is the number of columns, so no ratio
 * can express more than `maxColumns`.
 */
export const COLUMN_RATIOS = ['1:1', '7:5', '5:7', '3:2', '2:3', '1:1:1', '3:5:3'] as const
export type ColumnRatio = (typeof COLUMN_RATIOS)[number]

export function columnCount(ratio: ColumnRatio): 2 | 3 {
	return ratio.split(':').length === 3 ? 3 : 2
}

/** A slot holds leaf blocks only. That single type is the depth limit. */
const slot = z.array(AuctionPageLeafBlockSchema).max(AUCTION_PAGE_LIMITS.maxBlocksPerSlot).default([])

/**
 * Side-by-side layout. Slot names `a`, `b`, `c` are Puck slot fields, so the
 * persisted shape is exactly what the editor produces. Slot `c` is ignored
 * (and must be empty on publish) for two-column ratios.
 */
export const ColumnsBlockSchema = z.object({
	type: z.literal('Columns'),
	props: z.object({
		id: blockId,
		ratio: z.enum(COLUMN_RATIOS).default('1:1'),
		collapseBelow: z.enum(['sm', 'md', 'lg']).default('md'),
		gap: z.enum(['sm', 'md', 'lg']).default('md'),
		a: slot,
		b: slot,
		c: slot,
	}),
})

/**
 * Layout B (Live Show) as a single block: a vertical video with overlays and a
 * slot either side. Overlays are toggles over engine data, not content.
 */
export const LiveShowStageBlockSchema = z.object({
	type: z.literal('LiveShowStage'),
	props: z.object({
		id: blockId,
		videoSrc: safeMediaSrc.or(z.literal('')).default(''),
		posterUrl: safeMediaSrc.or(z.literal('')).default(''),
		orientation: z.enum(['portrait', 'landscape']).default('portrait'),
		soundDefault: z.enum(['on', 'off']).default('on'),
		overlayCountdown: z.enum(['none', 'ring', 'digits']).default('ring'),
		overlayTopBid: z.boolean().default(true),
		overlayTicker: z.boolean().default(true),
		overlayReactions: z.boolean().default(true),
		overlayBidPanel: z.enum(['none', 'steps', 'swipe']).default('swipe'),
		left: slot,
		right: slot,
	}),
})

export const AuctionPageBlockSchema = z.discriminatedUnion('type', [
	...AuctionPageLeafBlockSchema.options,
	ColumnsBlockSchema,
	LiveShowStageBlockSchema,
])

export type AuctionPageBlock = z.infer<typeof AuctionPageBlockSchema>
export type AuctionPageBlockType = AuctionPageBlock['type']
export type ColumnsBlock = z.infer<typeof ColumnsBlockSchema>
export type LiveShowStageBlock = z.infer<typeof LiveShowStageBlockSchema>

export const AUCTION_PAGE_CONTAINER_TYPES = ['Columns', 'LiveShowStage'] as const satisfies readonly AuctionPageBlockType[]

export const AUCTION_PAGE_LEAF_TYPES = AuctionPageLeafBlockSchema.options.map((o) => o.shape.type.value) as AuctionPageLeafBlockType[]

/** Slots of a container in render order; for leaves, none. */
export function blockSlots(block: AuctionPageBlock): AuctionPageLeafBlock[][] {
	if (block.type === 'Columns') {
		const { a, b, c } = block.props
		return columnCount(block.props.ratio) === 3 ? [a, b, c] : [a, b]
	}
	if (block.type === 'LiveShowStage') return [block.props.left, block.props.right]
	return []
}

/** Total block count, containers and everything inside them. */
export function countAuctionPageBlocks(content: AuctionPageBlock[]): number {
	return content.reduce((total, block) => total + 1 + blockSlots(block).reduce((n, s) => n + s.length, 0), 0)
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

export interface AuctionPage {
	version: typeof AUCTION_PAGE_VERSION
	enabled: boolean
	root: { props: StorefrontRootProps }
	content: AuctionPageBlock[]
}

export interface AuctionPageParseResult {
	page: AuctionPage | null
	droppedBlocks: number
	error: string | null
}

/**
 * Lenient parse for rendering, mirroring `parseStorefrontPage`:
 *   - a bad leaf inside a slot drops that leaf, not the container;
 *   - a container nested in a slot is dropped (depth limit);
 *   - blocks past the 100-block budget are dropped in document order;
 *   - a two-column `Columns` renders only `a` and `b`.
 */
export function parseAuctionPage(raw: string | null | undefined): AuctionPageParseResult {
	if (typeof raw !== 'string' || raw.trim().length === 0) {
		return { page: null, droppedBlocks: 0, error: 'Empty page document' }
	}
	let json: unknown
	try {
		json = JSON.parse(raw)
	} catch {
		return { page: null, droppedBlocks: 0, error: 'Page document is not valid JSON' }
	}
	if (typeof json !== 'object' || json === null || Array.isArray(json)) {
		return { page: null, droppedBlocks: 0, error: 'Page document does not match the expected format' }
	}
	const doc = json as Record<string, unknown>
	if (doc.version !== AUCTION_PAGE_VERSION) {
		return { page: null, droppedBlocks: 0, error: 'Page document does not match the expected format' }
	}

	const rootCandidate =
		doc.root && typeof doc.root === 'object' && !Array.isArray(doc.root) ? (doc.root as Record<string, unknown>).props : undefined
	const root = { props: parseStorefrontRootProps(rootCandidate) }
	const rawContent = Array.isArray(doc.content) ? doc.content : []

	let budget: number = AUCTION_PAGE_LIMITS.maxBlocks
	let droppedBlocks = 0
	const content: AuctionPageBlock[] = []

	const parseSlot = (candidate: unknown): AuctionPageLeafBlock[] => {
		const items = Array.isArray(candidate) ? candidate : []
		const out: AuctionPageLeafBlock[] = []
		for (const item of items) {
			if (budget <= 0 || out.length >= AUCTION_PAGE_LIMITS.maxBlocksPerSlot) {
				droppedBlocks += 1
				continue
			}
			const leaf = AuctionPageLeafBlockSchema.safeParse(item)
			if (leaf.success) {
				out.push(leaf.data)
				budget -= 1
			} else {
				droppedBlocks += 1
			}
		}
		return out
	}

	/** A dropped container takes its slots with it; count them so the editor can say how much was lost. */
	const sizeOf = (candidate: unknown): number => {
		const props = candidate && typeof candidate === 'object' ? (candidate as { props?: Record<string, unknown> }).props : undefined
		if (!props || typeof props !== 'object') return 1
		return (
			1 +
			(['a', 'b', 'c', 'left', 'right'] as const).reduce((n, k) => n + (Array.isArray(props[k]) ? (props[k] as unknown[]).length : 0), 0)
		)
	}

	for (const candidate of rawContent) {
		if (budget <= 0) {
			droppedBlocks += sizeOf(candidate)
			continue
		}
		const type = candidate && typeof candidate === 'object' ? (candidate as { type?: unknown }).type : undefined
		const props =
			candidate &&
			typeof candidate === 'object' &&
			(candidate as { props?: unknown }).props &&
			typeof (candidate as { props?: unknown }).props === 'object'
				? ((candidate as { props: Record<string, unknown> }).props as Record<string, unknown>)
				: {}

		if (type === 'Columns' || type === 'LiveShowStage') {
			const slotKeys = type === 'Columns' ? (['a', 'b', 'c'] as const) : (['left', 'right'] as const)
			const shell = { ...props }
			for (const key of slotKeys) shell[key] = []
			const parsedShell = (type === 'Columns' ? ColumnsBlockSchema : LiveShowStageBlockSchema).safeParse({ type, props: shell })
			if (!parsedShell.success) {
				droppedBlocks += sizeOf(candidate)
				continue
			}
			budget -= 1
			const block = parsedShell.data as AuctionPageBlock
			const filled = { ...block.props } as Record<string, unknown>
			const usedKeys = type === 'Columns' && columnCount((block as ColumnsBlock).props.ratio) === 2 ? (['a', 'b'] as const) : slotKeys
			for (const key of usedKeys) filled[key] = parseSlot(props[key])
			content.push({ type, props: filled } as AuctionPageBlock)
			continue
		}

		const leaf = AuctionPageLeafBlockSchema.safeParse(candidate)
		if (leaf.success) {
			content.push(leaf.data)
			budget -= 1
		} else {
			droppedBlocks += 1
		}
	}

	return { page: { version: AUCTION_PAGE_VERSION, enabled: doc.enabled === true, root, content }, droppedBlocks, error: null }
}

/**
 * Strict validation for publishing. Everything the lenient parser would drop
 * is reported instead, so the author sees it in the editor.
 */
export function validateAuctionPageForPublish(page: unknown): { ok: true; page: AuctionPage } | { ok: false; errors: string[] } {
	const envelope = StorefrontPageEnvelopeSchema.safeParse(page)
	if (!envelope.success) {
		return { ok: false, errors: envelope.error.issues.map((i) => `${i.path.join('.') || 'document'}: ${i.message}`) }
	}

	const errors: string[] = []
	const content: AuctionPageBlock[] = []

	envelope.data.content.forEach((candidate, index) => {
		const label = `Block ${index + 1}`
		const type =
			candidate && typeof candidate === 'object' && 'type' in candidate ? String((candidate as { type: unknown }).type) : 'unknown'
		const parsed = AuctionPageBlockSchema.safeParse(candidate)
		if (!parsed.success) {
			const nested = parsed.error.issues.some(
				(i) =>
					i.path.length >= 4 &&
					(i.path[1] === 'a' || i.path[1] === 'b' || i.path[1] === 'c' || i.path[1] === 'left' || i.path[1] === 'right'),
			)
			const detail = parsed.error.issues.map((i) => `${i.path.join('.')} ${i.message}`.trim()).join('; ')
			errors.push(
				nested && (type === 'Columns' || type === 'LiveShowStage')
					? `${label} (${type}): slots may only contain content blocks, not Columns or a stage — ${detail}`
					: `${label} (${type}): ${detail}`,
			)
			return
		}
		const block = parsed.data
		if (block.type === 'Columns' && columnCount(block.props.ratio) === 2 && block.props.c.length > 0) {
			errors.push(`${label} (Columns): ratio ${block.props.ratio} has two columns, but the third column is not empty`)
			return
		}
		content.push(block)
	})

	const total = countAuctionPageBlocks(content)
	if (total > AUCTION_PAGE_LIMITS.maxBlocks) {
		errors.push(`A page may contain at most ${AUCTION_PAGE_LIMITS.maxBlocks} blocks, including blocks inside columns (found ${total})`)
	}

	if (errors.length > 0) return { ok: false, errors }
	return { ok: true, page: { version: AUCTION_PAGE_VERSION, enabled: envelope.data.enabled, root: envelope.data.root, content } }
}

// ---------------------------------------------------------------------------
// Which layout a lot uses (decision 1)
// ---------------------------------------------------------------------------

export type AuctionLayoutSource = 'lot' | 'seller' | 'platform'

/**
 * Fallback order: the lot's own layout, else the seller's template, else the
 * platform default. A candidate counts only if it parsed and is enabled, so a
 * disabled or broken override quietly falls back instead of blanking the lot.
 */
export function resolveAuctionPageLayout(
	lotOverride: AuctionPage | null | undefined,
	sellerTemplate: AuctionPage | null | undefined,
	platformDefault: AuctionPage,
): { page: AuctionPage; source: AuctionLayoutSource } {
	if (lotOverride?.enabled) return { page: lotOverride, source: 'lot' }
	if (sellerTemplate?.enabled) return { page: sellerTemplate, source: 'seller' }
	return { page: platformDefault, source: 'platform' }
}
