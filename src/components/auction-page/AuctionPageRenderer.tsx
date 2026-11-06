import { StorefrontProvider } from '@/components/storefront/StorefrontContext'
import { StorefrontBlockView, StorefrontRoot } from '@/components/storefront/StorefrontRenderer'
import { cn } from '@/lib/utils'
import {
	blockSlots,
	columnCount,
	type AuctionPage,
	type AuctionPageBlock,
	type AuctionPageLeafBlock,
	type ColumnsBlock,
	type LiveShowStageBlock,
} from '@/lib/schemas/auctionPage'
import type { AuctionLotView, AuctionPageActions } from '@/lib/auctionPage/view'
import { formatSats } from '@/lib/auctionPage/view'
import { AuctionPageProvider, useAuctionPage } from './AuctionPageContext'
import { AuctionSystemLayer } from './AuctionSystemLayer'
import { BidPanelBlock, CountdownBlock, ReserveMeterBlock } from './blocks/BiddingBlocks'
import { AuctionStatsBlock, BidFeedBlock, BidTickerBlock, ChatFeedBlock, LeaderboardBlock, UpNextBlock } from './blocks/FeedBlocks'
import { LiveVideoBlock, LotGalleryBlock, LotHeaderBlock, VideoSurface } from './blocks/LotBlocks'
import { SellerCardBlock } from './blocks/SellerCardBlock'
import './auction-page.css'

/**
 * Turns a validated auction page document into elements (ADR-0023).
 *
 * Like `StorefrontBlockView`, the switch is exhaustive over the schema's union,
 * and the same renderer draws the published page and the editor canvas.
 * Storefront content blocks (Text, Image, ProductGrid, Divider, Spacer) are
 * delegated to the storefront renderer, with the seller as the page author.
 */
export function AuctionLeafBlockView({ block }: { block: AuctionPageLeafBlock }) {
	switch (block.type) {
		case 'LotHeader':
			return <LotHeaderBlock {...block.props} />
		case 'LotGallery':
			return <LotGalleryBlock {...block.props} />
		case 'LiveVideo':
			return <LiveVideoBlock {...block.props} />
		case 'BidPanel':
			return <BidPanelBlock {...block.props} />
		case 'Countdown':
			return <CountdownBlock {...block.props} />
		case 'ReserveMeter':
			return <ReserveMeterBlock {...block.props} />
		case 'BidFeed':
			return <BidFeedBlock {...block.props} />
		case 'ChatFeed':
			return <ChatFeedBlock {...block.props} />
		case 'SellerCard':
			return <SellerCardBlock {...block.props} />
		case 'Leaderboard':
			return <LeaderboardBlock {...block.props} />
		case 'AuctionStats':
			return <AuctionStatsBlock {...block.props} />
		case 'BidTicker':
			return <BidTickerBlock {...block.props} />
		case 'UpNext':
			return <UpNextBlock {...block.props} />
		case 'Text':
		case 'Image':
		case 'ProductGrid':
		case 'Divider':
		case 'Spacer':
			return <StorefrontBlockView block={block} />
		default: {
			const exhaustive: never = block
			void exhaustive
			return null
		}
	}
}

export function AuctionBlockView({ block }: { block: AuctionPageBlock }) {
	if (block.type === 'Columns') return <ColumnsView block={block} />
	if (block.type === 'LiveShowStage') return <LiveShowStageView block={block} />
	return <AuctionLeafBlockView block={block} />
}

const gridTemplate: Record<ColumnsBlock['props']['ratio'], string> = {
	'1:1': '1fr 1fr',
	'7:5': '7fr 5fr',
	'5:7': '5fr 7fr',
	'3:2': '3fr 2fr',
	'2:3': '2fr 3fr',
	'1:1:1': '1fr 1fr 1fr',
	'3:5:3': '3fr 5fr 3fr',
}

const gapClass = { sm: 'gap-3', md: 'gap-5', lg: 'gap-8' } as const

/**
 * Columns stack into one column below the chosen breakpoint (decision 3).
 * The breakpoint is a closed enum mapped to a data attribute, so the CSS that
 * switches the grid on is fixed in `auction-page.css`, not author-supplied.
 */
function ColumnsView({ block }: { block: ColumnsBlock }) {
	const slots = blockSlots(block)
	return (
		<div
			data-testid="auction-columns"
			data-collapse={block.props.collapseBelow}
			data-columns={columnCount(block.props.ratio)}
			className={cn('ap-columns grid grid-cols-1', gapClass[block.props.gap])}
			style={{ ['--ap-cols' as string]: gridTemplate[block.props.ratio] }}
		>
			{slots.map((slot, i) => (
				<div key={i} className="flex min-w-0 flex-col gap-4">
					{slot.map((leaf) => (
						<AuctionLeafBlockView key={leaf.props.id} block={leaf} />
					))}
				</div>
			))}
		</div>
	)
}

/** Layout B: vertical video with overlays and a slot either side. */
function LiveShowStageView({ block }: { block: LiveShowStageBlock }) {
	const ctx = useAuctionPage()
	if (!ctx) return null
	const p = block.props
	const { view } = ctx
	const top = view.bids[0]
	return (
		<div
			data-testid="auction-stage"
			data-collapse="lg"
			className="ap-stage grid grid-cols-1 items-start gap-5"
			style={{ ['--ap-cols' as string]: '1fr minmax(320px, 440px) 1fr' }}
		>
			<div className="order-2 flex min-w-0 flex-col gap-4 lg:order-1">
				{p.left.map((leaf) => (
					<AuctionLeafBlockView key={leaf.props.id} block={leaf} />
				))}
			</div>
			<div className="order-1 lg:order-2">
				<VideoSurface
					src={p.videoSrc || view.lot.videoSrc || ''}
					poster={p.posterUrl || view.lot.posterUrl || view.lot.images[0]}
					orientation={p.orientation}
					soundDefault={p.soundDefault}
					isEditing={ctx.isEditing}
				>
					<div className="pointer-events-none absolute inset-0 flex flex-col justify-between bg-gradient-to-b from-black/50 via-transparent to-black/70 p-3 text-white">
						<div className="flex items-start justify-between gap-2">
							<span className="ap-live-dot rounded-full bg-primary px-2 py-0.5 text-xs font-bold uppercase text-primary-foreground">
								{view.status === 'live' ? 'Live' : 'Ended'}
							</span>
							{p.overlayCountdown !== 'none' && (
								<div className="pointer-events-auto mr-14 shrink-0 text-foreground">
									<CountdownBlock
										style={p.overlayCountdown === 'ring' ? 'ring' : 'digits'}
										size="md"
										pulseUnderSeconds={10}
										softCloseNote={false}
										showTimePercent={false}
									/>
								</div>
							)}
						</div>
						<div className="flex flex-col gap-2">
							{p.overlayTopBid && (
								<div key={top?.id ?? 'none'} className="ap-slide-in w-fit rounded-lg bg-black/60 px-3 py-2">
									<p className="text-xs uppercase tracking-[0.14em] opacity-80">
										{top ? `${top.isOwn ? 'You' : top.bidderName} leads` : 'Opening bid'}
									</p>
									<p className="text-2xl font-black tabular-nums">{formatSats(top?.amountSats ?? view.startingBidSats)}</p>
								</div>
							)}
							{p.overlayTicker && view.bids.length > 0 && (
								<div className="-mx-3">
									<BidTickerBlock speed="fast" style="default" />
								</div>
							)}
							{p.overlayBidPanel !== 'none' && (
								<div className="pointer-events-auto text-foreground">
									<BidPanelBlock
										mode={p.overlayBidPanel}
										quickSteps={p.overlayBidPanel === 'steps' ? 3 : 0}
										allowMaxBid={false}
										showWalletChip
										ctaLabel="Bid"
									/>
								</div>
							)}
						</div>
					</div>
				</VideoSurface>
			</div>
			<div className="order-3 flex min-w-0 flex-col gap-4">
				{p.right.map((leaf) => (
					<AuctionLeafBlockView key={leaf.props.id} block={leaf} />
				))}
			</div>
		</div>
	)
}

export interface AuctionPageRendererProps {
	page: AuctionPage
	view: AuctionLotView
	actions: AuctionPageActions
	isEditing?: boolean
	className?: string
}

/**
 * The page: theme wrapper, the author's blocks, then the system layer, which
 * no document can remove (decision 4).
 */
export function AuctionPageRenderer({ page, view, actions, isEditing = false, className }: AuctionPageRendererProps) {
	return (
		<StorefrontProvider value={{ pubkey: view.seller.pubkey, isEditing }}>
			<AuctionPageProvider value={{ view, actions, isEditing }}>
				<StorefrontRoot props={page.root.props} className={cn('ap-root', className)}>
					<div
						data-testid="auction-page"
						className="ap-flow mx-auto flex w-full max-w-7xl flex-col px-4 py-6 sm:px-6"
						style={{ gap: 'calc(var(--storefront-space, 1rem) * 1.25)' }}
					>
						{page.content.map((block) => (
							<AuctionBlockView key={block.props.id} block={block} />
						))}
					</div>
					<AuctionSystemLayer />
				</StorefrontRoot>
			</AuctionPageProvider>
		</StorefrontProvider>
	)
}
