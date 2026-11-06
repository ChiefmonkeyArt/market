import { AuctionPageProvider } from '@/components/auction-page/AuctionPageContext'
import { AuctionLeafBlockView } from '@/components/auction-page/AuctionPageRenderer'
import { StorefrontProvider } from '@/components/storefront/StorefrontContext'
import { storefrontCmsConfig } from '@/config/storefrontCms'
import { createSeededDemoAuction } from '@/lib/auctionPage/demoEngine'
import type { AuctionPageActions } from '@/lib/auctionPage/view'
import {
	AUCTION_PAGE_CONTAINER_TYPES,
	AUCTION_STAT_FIELDS,
	COLUMN_RATIOS,
	type AuctionPageBlockType,
	type AuctionPageLeafBlock,
	type AuctionPageLeafBlockType,
	type ColumnRatio,
} from '@/lib/schemas/auctionPage'
import { cn } from '@/lib/utils'
import type { ComponentConfig, Config, Fields, SlotComponent } from '@puckeditor/core'
import type { ReactNode } from 'react'

/**
 * The auction page component registry for the Puck editor (ADR-0023).
 *
 * Same two invariants as `storefrontCms.tsx`:
 *   1. Every key here is a block type in `AuctionPageBlockSchema`
 *      (`AUCTION_PAGE_COMPONENT_KEYS` is checked against it in tests).
 *   2. Every leaf renders through `AuctionLeafBlockView`, the published
 *      renderer, so the canvas is the page.
 *
 * Nesting (decision 3) is enforced twice: the slot fields below refuse
 * containers, so the editor cannot build a nested layout, and the schema
 * refuses one on publish and on read, so a hand-written document cannot either.
 *
 * The canvas renders against a seeded fake-sats lot. Editing a layout never
 * touches a real auction.
 */

const NOOP_ACTIONS: AuctionPageActions = { placeBid: () => {} }

type Opt = [label: string, value: string | number | boolean]
const radio = (label: string, options: Opt[]) => ({
	type: 'radio' as const,
	label,
	options: options.map(([l, v]) => ({ label: l, value: v })),
})
const select = (label: string, options: Opt[]) => ({
	type: 'select' as const,
	label,
	options: options.map(([l, v]) => ({ label: l, value: v })),
})
const onOff = (label: string) =>
	radio(label, [
		['On', true],
		['Off', false],
	])
const num = (label: string, min: number, max: number) => ({ type: 'number' as const, label, min, max, step: 1 })
const text = (label: string) => ({ type: 'text' as const, label })

function renderLeaf<T extends AuctionPageLeafBlockType>(type: T) {
	return (props: Record<string, unknown>) => {
		const { puck: _puck, editMode: _editMode, ...blockProps } = props as Record<string, unknown> & { puck?: unknown; editMode?: unknown }
		return <AuctionLeafBlockView block={{ type, props: blockProps } as AuctionPageLeafBlock} />
	}
}

function leaf(label: string, type: AuctionPageLeafBlockType, fields: Fields, defaultProps: Record<string, unknown>): ComponentConfig {
	return { label, fields, defaultProps, render: renderLeaf(type) } as ComponentConfig
}

/** Slots accept content blocks only: no Columns, no stage (decision 3). */
const leafSlot = { type: 'slot' as const, disallow: [...AUCTION_PAGE_CONTAINER_TYPES] }

const gridTemplate: Record<ColumnRatio, string> = {
	'1:1': '1fr 1fr',
	'7:5': '7fr 5fr',
	'5:7': '5fr 7fr',
	'3:2': '3fr 2fr',
	'2:3': '2fr 3fr',
	'1:1:1': '1fr 1fr 1fr',
	'3:5:3': '3fr 5fr 3fr',
}

/** Storefront content blocks, re-rendered through the auction renderer. */
function reuseStorefront(type: 'Text' | 'Image' | 'ProductGrid' | 'Divider' | 'Spacer'): ComponentConfig {
	const base = storefrontCmsConfig.components[type] as ComponentConfig
	return { ...base, render: renderLeaf(type) } as ComponentConfig
}

const STAT_OPTIONS: [string, (typeof AUCTION_STAT_FIELDS)[number]][] = [
	['Bids', 'bids'],
	['Bidders', 'bidders'],
	['Watching', 'watchers'],
	['Bids per minute', 'bidsPerMinute'],
]

/** Checkbox list, so the stored value stays the plain string array the schema expects. */
function StatFieldsPicker({ value, onChange, readOnly }: { value: string[]; onChange: (v: string[]) => void; readOnly?: boolean }) {
	return (
		<div className="flex flex-col gap-1 text-sm">
			{STAT_OPTIONS.map(([label, key]) => (
				<label key={key} className="flex items-center gap-2">
					<input
						type="checkbox"
						disabled={readOnly}
						checked={value.includes(key)}
						onChange={(e) => {
							const next = e.target.checked ? [...value, key] : value.filter((v) => v !== key)
							// At least one stat, in a stable order.
							if (next.length > 0) onChange(AUCTION_STAT_FIELDS.filter((k) => next.includes(k)))
						}}
					/>
					{label}
				</label>
			))}
		</div>
	)
}

const demo = createSeededDemoAuction(Math.floor(Date.now() / 1000), { durationSeconds: 3600 })

/**
 * Exactly one entry per block type: `satisfies` fails the build if a type is
 * missing here or an extra key appears that the schema would reject.
 */
const components = {
	LotHeader: leaf(
		'Lot header',
		'LotHeader',
		{
			showLotNumber: onOff('Lot number'),
			showCategory: onOff('Category'),
			titleStyle: select('Title style', [
				['Serif', 'serif'],
				['Sans', 'sans'],
				['Giant caps', 'giant-caps'],
			]),
			align: radio('Align', [
				['Left', 'left'],
				['Centre', 'center'],
			]),
		},
		{ showLotNumber: true, showCategory: true, titleStyle: 'serif', align: 'left' },
	),
	LotGallery: leaf(
		'Gallery',
		'LotGallery',
		{
			layout: select('Layout', [
				['Main and thumbnails', 'main-thumbs'],
				['Grid', 'grid'],
				['Carousel', 'carousel'],
			]),
			thumbPosition: radio('Thumbnails', [
				['Below', 'below'],
				['Side', 'side'],
			]),
			aspect: select('Shape', [
				['Square', '1:1'],
				['4:3', '4:3'],
				['Portrait 3:4', '3:4'],
				['Wide 16:9', '16:9'],
			]),
			lightbox: onOff('Tap to enlarge'),
			grayscaleUntilHover: onOff('Greyscale until hover'),
		},
		{ layout: 'main-thumbs', thumbPosition: 'below', aspect: '4:3', lightbox: true, grayscaleUntilHover: false },
	),
	LiveVideo: leaf(
		'Video',
		'LiveVideo',
		{
			videoSrc: text('Clip URL (leave empty for the lot’s stream)'),
			posterUrl: text('Poster image URL'),
			orientation: radio('Orientation', [
				['Landscape', 'landscape'],
				['Portrait', 'portrait'],
			]),
			soundDefault: radio('Sound', [
				['On', 'on'],
				['Off', 'off'],
			]),
		},
		{ videoSrc: '', posterUrl: '', orientation: 'landscape', soundDefault: 'on' },
	),
	BidPanel: leaf(
		'Bid panel',
		'BidPanel',
		{
			mode: select('Style', [
				['Step buttons', 'steps'],
				['Swipe to bid', 'swipe'],
				['Max bid', 'max-bid'],
			]),
			quickSteps: num('Quick bid buttons', 0, 6),
			allowMaxBid: onOff('Offer automatic bidding'),
			showWalletChip: onOff('Show wallet balance'),
			ctaLabel: text('Button label'),
		},
		{ mode: 'steps', quickSteps: 3, allowMaxBid: true, showWalletChip: true, ctaLabel: 'Bid now' },
	),
	Countdown: leaf(
		'Countdown',
		'Countdown',
		{
			style: select('Style', [
				['Digits', 'digits'],
				['Ring', 'ring'],
				['Bar', 'bar'],
			]),
			size: radio('Size', [
				['Medium', 'md'],
				['Large', 'lg'],
				['Extra large', 'xl'],
			]),
			pulseUnderSeconds: num('Pulse in the last (seconds)', 0, 300),
			softCloseNote: onOff('Explain soft close'),
			showTimePercent: onOff('Show % remaining'),
		},
		{ style: 'digits', size: 'md', pulseUnderSeconds: 10, softCloseNote: true, showTimePercent: false },
	),
	ReserveMeter: leaf('Reserve meter', 'ReserveMeter', { showWhenMet: text('Text when met') }, { showWhenMet: 'Reserve met' }),
	BidFeed: leaf(
		'Bid feed',
		'BidFeed',
		{
			title: text('Title'),
			limit: num('Bids shown', 1, 50),
			highlightOwn: onOff('Highlight my bids'),
			animateNew: select('New bid animation', [
				['None', 'none'],
				['Subtle', 'subtle'],
				['Slide', 'slide'],
			]),
			style: radio('Style', [
				['Default', 'default'],
				['Index', 'index'],
			]),
		},
		{ title: 'Bids', limit: 20, highlightOwn: true, animateNew: 'subtle', style: 'default' },
	),
	ChatFeed: leaf(
		'Chat',
		'ChatFeed',
		{
			title: text('Title'),
			style: select('Style', [
				['Stream', 'stream'],
				['Threaded', 'threaded'],
				['Index', 'index'],
			]),
			allowReplies: onOff('Replies'),
			allowReactions: onOff('Reactions'),
		},
		{ title: 'Chat', style: 'stream', allowReplies: true, allowReactions: true },
	),
	SellerCard: leaf(
		'Seller card',
		'SellerCard',
		{
			style: select('Style', [
				['Compact', 'compact'],
				['Host', 'host'],
				['Index', 'index'],
			]),
			showRating: onOff('Rating and sales'),
			showMessageButton: onOff('Message button'),
			showFollowButton: onOff('Follow button'),
		},
		{ style: 'compact', showRating: true, showMessageButton: true, showFollowButton: false },
	),
	Leaderboard: leaf(
		'Leaderboard',
		'Leaderboard',
		{ limit: num('Rows', 1, 20), showAvatars: onOff('Avatars'), highlightLeader: onOff('Highlight the leader') },
		{ limit: 8, showAvatars: true, highlightLeader: true },
	),
	AuctionStats: leaf(
		'Auction stats',
		'AuctionStats',
		{
			fields: {
				type: 'custom',
				label: 'Stats',
				render: ({ value, onChange, readOnly }: { value?: string[]; onChange: (v: string[]) => void; readOnly?: boolean }) => (
					<StatFieldsPicker value={value ?? []} onChange={onChange} readOnly={readOnly} />
				),
			},
			style: select('Style', [
				['Inline', 'inline'],
				['Big numbers', 'big-numbers'],
				['Index', 'index'],
			]),
		} as unknown as Fields,
		{ fields: ['bids', 'bidders', 'watchers'], style: 'inline' },
	),
	BidTicker: leaf(
		'Bid ticker',
		'BidTicker',
		{
			speed: radio('Speed', [
				['Slow', 'slow'],
				['Normal', 'normal'],
				['Fast', 'fast'],
			]),
			style: radio('Colours', [
				['Accent', 'default'],
				['Inverted', 'inverted'],
			]),
		},
		{ speed: 'normal', style: 'default' },
	),
	UpNext: leaf('Up next', 'UpNext', { title: text('Title'), limit: num('Lots shown', 1, 12) }, { title: 'Up next', limit: 4 }),

	Columns: {
		label: 'Columns',
		fields: {
			ratio: select(
				'Columns',
				COLUMN_RATIOS.map((r) => [r.split(':').length === 3 ? `Three · ${r}` : `Two · ${r}`, r] as Opt),
			),
			collapseBelow: radio('Stack on', [
				['Phones', 'sm'],
				['Tablets', 'md'],
				['Small laptops', 'lg'],
			]),
			gap: radio('Gap', [
				['Small', 'sm'],
				['Medium', 'md'],
				['Large', 'lg'],
			]),
			a: leafSlot,
			b: leafSlot,
			c: leafSlot,
		},
		defaultProps: { ratio: '1:1', collapseBelow: 'md', gap: 'md', a: [], b: [], c: [] },
		render: ({
			ratio,
			gap,
			a: A,
			b: B,
			c: C,
		}: {
			ratio: ColumnRatio
			gap: 'sm' | 'md' | 'lg'
			a: SlotComponent
			b: SlotComponent
			c: SlotComponent
		}) => {
			const three = ratio.split(':').length === 3
			return (
				<div
					className={cn('grid', gap === 'sm' ? 'gap-3' : gap === 'lg' ? 'gap-8' : 'gap-5')}
					style={{ gridTemplateColumns: gridTemplate[ratio] }}
				>
					<A className="flex min-h-20 min-w-0 flex-col gap-4" />
					<B className="flex min-h-20 min-w-0 flex-col gap-4" />
					{three && <C className="flex min-h-20 min-w-0 flex-col gap-4" />}
				</div>
			)
		},
	} as unknown as ComponentConfig,

	LiveShowStage: {
		label: 'Live show stage',
		fields: {
			videoSrc: text('Clip URL (leave empty for the lot’s stream)'),
			posterUrl: text('Poster image URL'),
			orientation: radio('Orientation', [
				['Portrait', 'portrait'],
				['Landscape', 'landscape'],
			]),
			soundDefault: radio('Sound', [
				['On', 'on'],
				['Off', 'off'],
			]),
			overlayCountdown: select('Clock on video', [
				['None', 'none'],
				['Ring', 'ring'],
				['Digits', 'digits'],
			]),
			overlayTopBid: onOff('Top bid on video'),
			overlayTicker: onOff('Ticker on video'),
			overlayReactions: onOff('Reactions'),
			overlayBidPanel: select('Bid on video', [
				['None', 'none'],
				['Step buttons', 'steps'],
				['Swipe', 'swipe'],
			]),
			left: leafSlot,
			right: leafSlot,
		},
		defaultProps: {
			videoSrc: '',
			posterUrl: '',
			orientation: 'portrait',
			soundDefault: 'on',
			overlayCountdown: 'ring',
			overlayTopBid: true,
			overlayTicker: true,
			overlayReactions: true,
			overlayBidPanel: 'swipe',
			left: [],
			right: [],
		},
		render: ({ left: Left, right: Right }: { left: SlotComponent; right: SlotComponent }) => (
			<div className="grid items-start gap-5" style={{ gridTemplateColumns: '1fr minmax(260px, 360px) 1fr' }}>
				<Left className="flex min-h-20 min-w-0 flex-col gap-4" />
				<div className="grid aspect-[9/16] place-items-center rounded-lg bg-black text-sm text-white/70">Live video with overlays</div>
				<Right className="flex min-h-20 min-w-0 flex-col gap-4" />
			</div>
		),
	} as unknown as ComponentConfig,

	Text: reuseStorefront('Text'),
	Image: reuseStorefront('Image'),
	ProductGrid: reuseStorefront('ProductGrid'),
	Divider: reuseStorefront('Divider'),
	Spacer: reuseStorefront('Spacer'),
} satisfies Record<AuctionPageBlockType, ComponentConfig>

export const auctionPageCmsConfig: Config = {
	categories: {
		lot: { title: 'Lot', components: ['LotHeader', 'LotGallery', 'LiveVideo', 'SellerCard'] },
		bidding: { title: 'Bidding', components: ['BidPanel', 'Countdown', 'ReserveMeter'] },
		live: { title: 'Live', components: ['BidFeed', 'ChatFeed', 'Leaderboard', 'AuctionStats', 'BidTicker', 'UpNext'] },
		layout: { title: 'Layout', components: ['Columns', 'LiveShowStage', 'Divider', 'Spacer'] },
		content: { title: 'Content', components: ['Text', 'Image', 'ProductGrid'] },
	},

	root: {
		...storefrontCmsConfig.root,
		render: (props: { children?: ReactNode }) => {
			const Root = storefrontCmsConfig.root?.render as (p: { children?: ReactNode }) => ReactNode
			return (
				<StorefrontProvider value={{ pubkey: demo.view.seller.pubkey, isEditing: true }}>
					<AuctionPageProvider value={{ view: demo.view, actions: NOOP_ACTIONS, isEditing: true }}>
						<Root {...props}>
							<div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6">{props.children}</div>
						</Root>
					</AuctionPageProvider>
				</StorefrontProvider>
			)
		},
	},

	components,
}

export const AUCTION_PAGE_COMPONENT_KEYS = Object.keys(auctionPageCmsConfig.components) as AuctionPageBlockType[]
