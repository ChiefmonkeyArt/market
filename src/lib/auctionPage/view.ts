/**
 * The read-only contract between the auction engine and auction page blocks
 * (ADR-0023, decision 2).
 *
 * Every number on an auction page — current bid, minimum next bid, quick bid
 * steps, reserve progress, time remaining, the winner — arrives here, already
 * computed by the engine from validated events (AUCTIONS.md, ADR-0003,
 * ADR-0012). Blocks format and arrange these values; they never derive a bid
 * rule, a validity decision or a winner of their own.
 *
 * Two adapters produce this shape:
 *   - the live auction route, from the engine's queries (follow-up PR);
 *   - `createDemoAuctionEngine`, fake sats for layout previews and playtests.
 *
 * Amounts are integer sats. Times are unix seconds.
 */

export interface AuctionLotViewBid {
	id: string
	bidderPubkey: string
	bidderName: string
	bidderAvatarUrl?: string
	amountSats: number
	at: number
	isOwn: boolean
}

export interface AuctionLotViewChatMessage {
	id: string
	authorName: string
	authorAvatarUrl?: string
	text: string
	at: number
	isSeller?: boolean
	replyToId?: string
}

export interface AuctionLotViewUpNext {
	id: string
	title: string
	imageUrl?: string
	startsAt: number
	href?: string
}

/**
 * Notices the page shows on every auction, whatever the layout (decision 4).
 * `kind` is closed so the system layer can render each one deliberately.
 */
export type AuctionSystemNotice =
	| { id: string; kind: 'outbid'; amountSats: number; byName: string; at: number }
	| { id: string; kind: 'refund'; amountSats: number; at: number; detail: string }
	| { id: string; kind: 'bid-accepted'; amountSats: number; at: number }
	| { id: string; kind: 'bid-rejected'; at: number; reason: string }

/** The viewer's result once the engine has settled the lot. */
export type AuctionViewerOutcome =
	| { kind: 'none' }
	| { kind: 'won'; amountSats: number }
	| { kind: 'lost'; winningSats: number; refundedSats: number; refundStatus: 'pending' | 'refunded' }
	| { kind: 'seller'; winningSats: number; winnerName: string }
	| { kind: 'watcher'; winningSats: number; winnerName: string }
	| { kind: 'no-sale'; reason: 'reserve-not-met' | 'no-bids' }

export interface AuctionLotView {
	lot: {
		id: string
		lotNumber?: string
		title: string
		category?: string
		summary?: string
		images: string[]
		/** The lot's own live stream or pitch clip, if the seller attached one. */
		videoSrc?: string
		posterUrl?: string
	}
	seller: {
		pubkey: string
		name: string
		avatarUrl?: string
		about?: string
		rating?: number
		sales?: number
		profileHref?: string
	}
	status: 'scheduled' | 'live' | 'ended'
	startsAt: number
	endsAt: number
	/** Seconds the engine extends the close by when a late bid lands, if it does. */
	softCloseSeconds?: number
	startingBidSats: number
	currentBidSats: number | null
	/** Lowest amount the engine will currently accept. */
	nextMinimumBidSats: number
	/** Engine-computed quick bid amounts, ascending. The BidPanel shows a prefix of these. */
	quickBidSats: number[]
	reserve: { hasReserve: boolean; met: boolean; progress: number }
	/** Newest first. */
	bids: AuctionLotViewBid[]
	/** Oldest first. */
	chat: AuctionLotViewChatMessage[]
	stats: { bids: number; bidders: number; watchers: number; bidsPerMinute: number }
	upNext: AuctionLotViewUpNext[]
	viewer: {
		pubkey: string | null
		name?: string
		isLeading: boolean
		isSeller: boolean
		/** Fake or real wallet balance, as the wallet layer reports it. Null when unknown. */
		walletBalanceSats: number | null
		/** A proxy (max) bid the viewer has set, if the engine supports one. */
		maxBidSats: number | null
	}
	system: {
		notices: AuctionSystemNotice[]
		outcome: AuctionViewerOutcome
		/** Set once buyer and seller are connected to arrange shipping. */
		shipping: null | { counterpartName: string; status: 'awaiting-address' | 'address-sent' | 'shipped'; chatHref?: string }
	}
}

/**
 * Everything a block may ask the engine to do. Blocks call these and render the
 * result the engine reports back through `AuctionLotView`; none of them decides
 * whether a bid is valid.
 */
export interface AuctionPageActions {
	placeBid(amountSats: number): void | Promise<void>
	setMaxBid?(amountSats: number): void | Promise<void>
	sendChat?(text: string): void | Promise<void>
	react?(reaction: string): void
	topUpWallet?(amountSats: number): void
	dismissNotice?(id: string): void
	openShippingChat?(): void
}

/** Highest bid per bidder, best first. A presentation of `bids`, not a ruling. */
export function leaderboardFromBids(bids: AuctionLotViewBid[], limit: number): AuctionLotViewBid[] {
	const best = new Map<string, AuctionLotViewBid>()
	for (const bid of bids) {
		const current = best.get(bid.bidderPubkey)
		if (!current || bid.amountSats > current.amountSats) best.set(bid.bidderPubkey, bid)
	}
	return Array.from(best.values())
		.sort((a, b) => b.amountSats - a.amountSats || a.at - b.at)
		.slice(0, limit)
}

export function formatSats(amount: number | null | undefined): string {
	if (amount === null || amount === undefined || !Number.isFinite(amount)) return '—'
	return `${Math.round(amount).toLocaleString('en-GB')} sats`
}

export function formatCountdown(secondsRemaining: number): string {
	const s = Math.max(0, Math.floor(secondsRemaining))
	const d = Math.floor(s / 86400)
	const h = Math.floor((s % 86400) / 3600)
	const m = Math.floor((s % 3600) / 60)
	const sec = s % 60
	const pad = (n: number) => String(n).padStart(2, '0')
	if (d > 0) return `${d}d ${pad(h)}h ${pad(m)}m`
	if (h > 0) return `${h}:${pad(m)}:${pad(sec)}`
	return `${pad(m)}:${pad(sec)}`
}
