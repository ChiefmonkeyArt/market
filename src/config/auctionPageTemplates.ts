import {
	AUCTION_PAGE_VERSION,
	type AuctionPage,
	type AuctionPageBlock,
	type AuctionPageLeafBlock,
	type ColumnRatio,
} from '@/lib/schemas/auctionPage'
import { STOREFRONT_TUNE_DEFAULTS, type StorefrontThemeId, type StorefrontThemeTune } from '@/lib/schemas/storefront'

/**
 * Built-in auction layouts (ADR-0023). These are the four mockups the team
 * playtested — A Catalogue, B Live Show, C Arena, D Brutalist — written as
 * ordinary page documents. A seller picks one as their site-wide template and
 * can override it per lot (decision 1). `catalogue` is the platform default.
 *
 * They are documents, not code: every one must pass
 * `validateAuctionPageForPublish`, which the tests enforce.
 */

export type AuctionTemplateId = 'catalogue' | 'live-show' | 'arena' | 'brutalist'

export interface AuctionPageTemplate {
	id: AuctionTemplateId
	label: string
	description: string
	page: AuctionPage
}

type Leaf = AuctionPageLeafBlock
const leaf = <T extends Leaf['type']>(type: T, id: string, props: Omit<Extract<Leaf, { type: T }>['props'], 'id'>) =>
	({ type, props: { id, ...props } }) as unknown as Extract<Leaf, { type: T }>

function columns(id: string, ratio: ColumnRatio, a: Leaf[], b: Leaf[], c: Leaf[] = []): AuctionPageBlock {
	return { type: 'Columns', props: { id, ratio, collapseBelow: 'md', gap: 'md', a, b, c } }
}

function page(
	title: string,
	theme: StorefrontThemeId,
	palette: string,
	tune: Partial<StorefrontThemeTune>,
	content: AuctionPageBlock[],
): AuctionPage {
	return {
		version: AUCTION_PAGE_VERSION,
		enabled: true,
		root: { props: { title, theme, palette, tune: { ...STOREFRONT_TUNE_DEFAULTS, ...tune } } },
		content,
	}
}

const bidFeed = (
	id: string,
	title = 'Bids',
	style: 'default' | 'index' = 'default',
	animateNew: 'none' | 'subtle' | 'slide' = 'subtle',
	limit = 20,
) => leaf('BidFeed', id, { title, limit, highlightOwn: true, animateNew, style })

const chat = (id: string, title = 'Chat', style: 'threaded' | 'stream' | 'index' = 'stream') =>
	leaf('ChatFeed', id, { title, style, allowReplies: true, allowReactions: style === 'stream' })

const stats = (
	id: string,
	style: 'inline' | 'big-numbers' | 'index' = 'inline',
	fields: ('bids' | 'bidders' | 'watchers' | 'bidsPerMinute')[] = ['bids', 'bidders', 'watchers'],
) => leaf('AuctionStats', id, { fields, style })

const seller = (id: string, style: 'compact' | 'host' | 'index' = 'compact') =>
	leaf('SellerCard', id, { style, showRating: true, showMessageButton: style !== 'host', showFollowButton: style === 'host' })

export const AUCTION_PAGE_TEMPLATES: AuctionPageTemplate[] = [
	{
		id: 'catalogue',
		label: 'A · Catalogue',
		description: 'A classic lot page: gallery on the left, clock and bidding on the right, history and comments below.',
		page: page('Catalogue lot', 'pleb', 'auction-catalogue', { radiusPx: 14, shadow: 0.25, glass: 0.2, spacing: 1.1 }, [
			leaf('LotHeader', 'lot-head', { showLotNumber: true, showCategory: true, titleStyle: 'serif', align: 'left' }),
			columns(
				'main',
				'7:5',
				[
					leaf('LotGallery', 'gallery', {
						layout: 'main-thumbs',
						thumbPosition: 'below',
						aspect: '4:3',
						lightbox: true,
						grayscaleUntilHover: false,
					}),
				],
				[
					leaf('Countdown', 'clock', { style: 'digits', size: 'lg', pulseUnderSeconds: 10, softCloseNote: true, showTimePercent: false }),
					leaf('ReserveMeter', 'reserve', { showWhenMet: 'Reserve met' }),
					leaf('BidPanel', 'bid', { mode: 'steps', quickSteps: 3, allowMaxBid: true, showWalletChip: true, ctaLabel: 'Bid now' }),
					stats('stats'),
					seller('seller'),
				],
			),
			columns('lower', '1:1', [bidFeed('history', 'Bid history')], [chat('comments', 'Comments', 'threaded')]),
		]),
	},
	{
		id: 'live-show',
		label: 'B · Live Show',
		description: 'Whatnot-style: a vertical stream with the clock, top bid and swipe-to-bid on the video, bids and chat either side.',
		page: page('Live show', 'pleb', 'auction-live-night', { radiusPx: 18, shadow: 0.5, glass: 0.8, spacing: 0.9 }, [
			{
				type: 'LiveShowStage',
				props: {
					id: 'stage',
					videoSrc: '',
					posterUrl: '',
					orientation: 'portrait',
					soundDefault: 'on',
					overlayCountdown: 'ring',
					overlayTopBid: true,
					overlayTicker: true,
					overlayReactions: true,
					overlayBidPanel: 'swipe',
					left: [
						leaf('LotHeader', 'lot-head', { showLotNumber: true, showCategory: false, titleStyle: 'sans', align: 'left' }),
						bidFeed('feed', 'Live bids', 'default', 'slide', 12),
					],
					right: [seller('host', 'host'), chat('chat')],
				},
			},
			leaf('UpNext', 'queue', { title: 'Up next', limit: 4 }),
		]),
	},
	{
		id: 'arena',
		label: 'C · Arena',
		description: 'A game show: leaderboard, a big ring clock over the video, swipe-to-bid, live stats and a ticker.',
		page: page('Arena', 'elec', 'auction-arena', { radiusPx: 16, shadow: 0.6, glass: 0.4, spacing: 1 }, [
			leaf('BidTicker', 'ticker', { speed: 'normal', style: 'default' }),
			leaf('LotHeader', 'lot-head', { showLotNumber: true, showCategory: true, titleStyle: 'sans', align: 'center' }),
			columns(
				'arena',
				'3:5:3',
				[leaf('Leaderboard', 'board', { limit: 8, showAvatars: true, highlightLeader: true }), seller('seller')],
				[
					leaf('LiveVideo', 'video', { videoSrc: '', posterUrl: '', orientation: 'landscape', soundDefault: 'on' }),
					leaf('Countdown', 'clock', { style: 'ring', size: 'xl', pulseUnderSeconds: 10, softCloseNote: true, showTimePercent: false }),
					leaf('BidPanel', 'bid', { mode: 'swipe', quickSteps: 0, allowMaxBid: false, showWalletChip: true, ctaLabel: 'Swipe to bid' }),
				],
				[stats('stats', 'big-numbers', ['bids', 'bidders', 'watchers', 'bidsPerMinute']), chat('chat')],
			),
			leaf('UpNext', 'queue', { title: 'Next in the arena', limit: 4 }),
		]),
	},
	{
		id: 'brutalist',
		label: 'D · Brutalist',
		description: 'Concrete: giant type, hard black rules, offset shadows, a time bar and max-bid entry.',
		page: page('LOT 001', 'brut', 'auction-brutal-pink', { radiusPx: 0, shadow: 1, glass: 0, spacing: 1, texture: 0, handmade: 0 }, [
			leaf('BidTicker', 'ticker', { speed: 'fast', style: 'inverted' }),
			leaf('LotHeader', 'lot-head', { showLotNumber: true, showCategory: true, titleStyle: 'giant-caps', align: 'left' }),
			columns(
				'main',
				'3:2',
				[
					leaf('LotGallery', 'gallery', {
						layout: 'main-thumbs',
						thumbPosition: 'below',
						aspect: '1:1',
						lightbox: true,
						grayscaleUntilHover: true,
					}),
				],
				[
					leaf('Countdown', 'clock', { style: 'bar', size: 'xl', pulseUnderSeconds: 10, softCloseNote: true, showTimePercent: true }),
					leaf('BidPanel', 'bid', { mode: 'max-bid', quickSteps: 3, allowMaxBid: true, showWalletChip: true, ctaLabel: 'BID' }),
					leaf('ReserveMeter', 'reserve', { showWhenMet: 'RESERVE MET' }),
					stats('stats', 'index'),
				],
			),
			columns(
				'lower',
				'1:1:1',
				[bidFeed('history', 'BIDS', 'index', 'subtle', 15)],
				[chat('chat', 'TALK', 'index')],
				[seller('seller', 'index')],
			),
		]),
	},
]

export const DEFAULT_AUCTION_TEMPLATE_ID: AuctionTemplateId = 'catalogue'

export function getAuctionPageTemplate(id: string | undefined): AuctionPageTemplate {
	return AUCTION_PAGE_TEMPLATES.find((t) => t.id === id) ?? AUCTION_PAGE_TEMPLATES.find((t) => t.id === DEFAULT_AUCTION_TEMPLATE_ID)!
}

/** The platform default for decision 1's fallback order. */
export const PLATFORM_DEFAULT_AUCTION_PAGE: AuctionPage = getAuctionPageTemplate(DEFAULT_AUCTION_TEMPLATE_ID).page
