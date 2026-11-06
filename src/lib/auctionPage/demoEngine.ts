import type { AuctionLotView, AuctionLotViewBid, AuctionSystemNotice } from './view'

/**
 * Fake-sats auction for layout previews and playtests.
 *
 * This is NOT the auction engine and must never be wired to a real lot. It
 * exists so designers and testers can feel a layout — bid, get outbid, get
 * refunded, win, lose, connect for shipping — without validators, a mint or a
 * wallet. The wallet tops up without limit, rival bidders are simulated, and
 * every state transition is a pure function so it can be unit-tested.
 *
 * The rules are intentionally simple and illustrative (fixed increments, a
 * soft close, highest bid wins). The real rules live in AUCTIONS.md and
 * ADR-0012 and are not modelled here.
 */

export const DEMO_VIEWER_PUBKEY = 'demo-viewer'
export const DEMO_SELLER_PUBKEY = 'demo-seller-chiefmonkey'

const RIVALS = [
	{ pubkey: 'demo-rival-satoshi', name: 'satsmaxi' },
	{ pubkey: 'demo-rival-hodl', name: 'hodlqueen' },
	{ pubkey: 'demo-rival-stacker', name: 'stacker21' },
	{ pubkey: 'demo-rival-pleb', name: 'plebdad' },
	{ pubkey: 'demo-rival-ostrich', name: 'ostrichfan' },
] as const

const CHAT_LINES = [
	'that dial is unreal',
	'is the strap original?',
	'time is free, sats are not',
	'chiefmonkey selling the good stuff again',
	'GO GO GO',
	'someone stop me',
	'how much for shipping to Lisbon?',
	'the custard was worth the price of entry',
]

export interface DemoAuctionState {
	view: AuctionLotView
	/** Sats the viewer currently has locked in their leading bid, if any. */
	lockedSats: number
	reserveSats: number
	seq: number
}

export interface DemoAuctionOptions {
	now: number
	durationSeconds?: number
	softCloseSeconds?: number
	startingBidSats?: number
	reserveSats?: number
	walletSats?: number
}

const STEP_SATS = 5_000

function increment(current: number): number {
	if (current < 100_000) return STEP_SATS
	if (current < 500_000) return 10_000
	return 25_000
}

function quickBids(nextMin: number): number[] {
	const out: number[] = []
	let amount = nextMin
	for (let i = 0; i < 6; i++) {
		out.push(amount)
		amount += increment(amount)
	}
	return out
}

function reserveFor(current: number | null, reserveSats: number) {
	const value = current ?? 0
	return {
		hasReserve: reserveSats > 0,
		met: reserveSats > 0 ? value >= reserveSats : true,
		progress: reserveSats > 0 ? Math.min(1, value / reserveSats) : 1,
	}
}

export function createDemoAuctionState(options: DemoAuctionOptions): DemoAuctionState {
	const {
		now,
		durationSeconds = 180,
		softCloseSeconds = 15,
		startingBidSats = 50_000,
		reserveSats = 210_000,
		walletSats = 1_000_000,
	} = options
	const view: AuctionLotView = {
		lot: {
			id: 'demo-lot-watch',
			lotNumber: '001',
			title: 'Chiefmonkey’s automatic watch — “time is free”',
			category: 'Watches',
			summary:
				'Chiefmonkey is selling his watch because he thinks time is free and it shouldn’t be tied down. Automatic movement, sapphire crystal, light desk wear.',
			images: [
				'/images/auction-demo-watch-1.jpg',
				'/images/auction-demo-watch-2.jpg',
				'/images/auction-demo-watch-3.jpg',
				'/images/auction-demo-watch-4.jpg',
			],
			posterUrl: '/images/auction-demo-live-frame.jpg',
		},
		seller: {
			pubkey: DEMO_SELLER_PUBKEY,
			name: 'chiefmonkey',
			about: 'Cornwall. Sells things that should not be tied down.',
			rating: 4.9,
			sales: 128,
		},
		status: 'live',
		startsAt: now,
		endsAt: now + durationSeconds,
		softCloseSeconds,
		startingBidSats,
		currentBidSats: null,
		nextMinimumBidSats: startingBidSats,
		quickBidSats: quickBids(startingBidSats),
		reserve: reserveFor(null, reserveSats),
		bids: [],
		chat: [{ id: 'c0', authorName: 'chiefmonkey', text: 'Welcome in. Fake sats only, go wild.', at: now, isSeller: true }],
		stats: { bids: 0, bidders: 0, watchers: 37, bidsPerMinute: 0 },
		upNext: [
			{
				id: 'demo-lot-camera',
				title: 'Rangefinder camera, 1970s',
				imageUrl: '/images/auction-demo-lot-camera.jpg',
				startsAt: now + durationSeconds + 60,
			},
			{
				id: 'demo-lot-keyboard',
				title: 'Mechanical keyboard, orange caps',
				imageUrl: '/images/auction-demo-lot-keyboard.jpg',
				startsAt: now + durationSeconds + 300,
			},
		],
		viewer: { pubkey: DEMO_VIEWER_PUBKEY, name: 'you', isLeading: false, isSeller: false, walletBalanceSats: walletSats, maxBidSats: null },
		system: { notices: [], outcome: { kind: 'none' }, shipping: null },
	}
	return { view, lockedSats: 0, reserveSats, seq: 1 }
}

function withView(state: DemoAuctionState, view: AuctionLotView, patch: Partial<DemoAuctionState> = {}): DemoAuctionState {
	return { ...state, ...patch, view }
}

function pushNotice(notices: AuctionSystemNotice[], notice: AuctionSystemNotice): AuctionSystemNotice[] {
	return [...notices, notice].slice(-4)
}

function recomputeStats(bids: AuctionLotViewBid[], now: number, watchers: number) {
	const recent = bids.filter((b) => now - b.at <= 60).length
	return { bids: bids.length, bidders: new Set(bids.map((b) => b.bidderPubkey)).size, watchers, bidsPerMinute: recent }
}

/** Applies one accepted bid from anyone. Shared by the viewer and the rivals. */
function applyBid(state: DemoAuctionState, bidder: { pubkey: string; name: string }, amountSats: number, now: number): DemoAuctionState {
	const { view } = state
	const isOwn = bidder.pubkey === DEMO_VIEWER_PUBKEY
	const seq = state.seq + 1
	const bid: AuctionLotViewBid = { id: `b${seq}`, bidderPubkey: bidder.pubkey, bidderName: bidder.name, amountSats, at: now, isOwn }
	const bids = [bid, ...view.bids]
	const nextMin = amountSats + increment(amountSats)
	const { reserveSats } = state

	let notices = view.system.notices
	let wallet = view.viewer.walletBalanceSats ?? 0
	let lockedSats = state.lockedSats

	if (isOwn) {
		// Raising your own bid releases the previous lock first.
		wallet = wallet + lockedSats - amountSats
		lockedSats = amountSats
		notices = pushNotice(notices, { id: `n${seq}`, kind: 'bid-accepted', amountSats, at: now })
	} else if (view.viewer.isLeading && lockedSats > 0) {
		// Outbid: the fake wallet is refunded straight away.
		notices = pushNotice(notices, { id: `n${seq}o`, kind: 'outbid', amountSats, byName: bidder.name, at: now })
		notices = pushNotice(notices, {
			id: `n${seq}r`,
			kind: 'refund',
			amountSats: lockedSats,
			at: now,
			detail: 'Your bid was released back to your wallet.',
		})
		wallet += lockedSats
		lockedSats = 0
	}

	const remaining = view.endsAt - now
	const softClose = view.softCloseSeconds ?? 0
	const endsAt = softClose > 0 && remaining < softClose ? now + softClose : view.endsAt

	const next: AuctionLotView = {
		...view,
		endsAt,
		currentBidSats: amountSats,
		nextMinimumBidSats: nextMin,
		quickBidSats: quickBids(nextMin),
		reserve: reserveFor(amountSats, reserveSats),
		bids,
		stats: recomputeStats(bids, now, view.stats.watchers),
		viewer: { ...view.viewer, isLeading: isOwn, walletBalanceSats: wallet },
		system: { ...view.system, notices },
	}
	return withView(state, next, { lockedSats, seq })
}

export function demoPlaceBid(state: DemoAuctionState, amountSats: number, now: number): DemoAuctionState {
	const { view } = state
	const seq = state.seq + 1
	const reject = (reason: string) =>
		withView(
			state,
			{
				...view,
				system: { ...view.system, notices: pushNotice(view.system.notices, { id: `n${seq}x`, kind: 'bid-rejected', at: now, reason }) },
			},
			{ seq },
		)

	if (view.status !== 'live') return reject('Bidding has closed.')
	if (!Number.isFinite(amountSats) || amountSats < view.nextMinimumBidSats)
		return reject(`The minimum bid is ${view.nextMinimumBidSats.toLocaleString('en-GB')} sats.`)
	const available = (view.viewer.walletBalanceSats ?? 0) + state.lockedSats
	if (amountSats > available) return reject('Not enough fake sats. Top up and try again.')
	return applyBid(state, { pubkey: DEMO_VIEWER_PUBKEY, name: view.viewer.name ?? 'you' }, Math.round(amountSats), now)
}

/** One simulated rival bid. `pick` is a 0–1 number so tests can be deterministic. */
export function demoRivalBid(state: DemoAuctionState, now: number, pick: number): DemoAuctionState {
	if (state.view.status !== 'live') return state
	const rival = RIVALS[Math.floor(pick * RIVALS.length) % RIVALS.length]
	const leader = state.view.bids[0]
	if (leader && leader.bidderPubkey === rival.pubkey) return state
	const extraSteps = pick > 0.8 ? 1 : 0
	let amount = state.view.nextMinimumBidSats
	for (let i = 0; i < extraSteps; i++) amount += increment(amount)
	return applyBid(state, rival, amount, now)
}

export function demoRivalChat(state: DemoAuctionState, now: number, pick: number): DemoAuctionState {
	const rival = RIVALS[Math.floor(pick * RIVALS.length) % RIVALS.length]
	const text = CHAT_LINES[Math.floor(pick * 997) % CHAT_LINES.length]
	const seq = state.seq + 1
	const chat = [...state.view.chat, { id: `c${seq}`, authorName: rival.name, text, at: now }].slice(-60)
	return withView(state, { ...state.view, chat }, { seq })
}

export function demoSendChat(state: DemoAuctionState, text: string, now: number): DemoAuctionState {
	const trimmed = text.trim().slice(0, 280)
	if (!trimmed) return state
	const seq = state.seq + 1
	const chat = [...state.view.chat, { id: `c${seq}`, authorName: state.view.viewer.name ?? 'you', text: trimmed, at: now }].slice(-60)
	return withView(state, { ...state.view, chat }, { seq })
}

export function demoTopUp(state: DemoAuctionState, amountSats: number): DemoAuctionState {
	const wallet = (state.view.viewer.walletBalanceSats ?? 0) + Math.max(0, Math.round(amountSats))
	return withView(state, { ...state.view, viewer: { ...state.view.viewer, walletBalanceSats: wallet } })
}

export function demoDismissNotice(state: DemoAuctionState, id: string): DemoAuctionState {
	return withView(state, { ...state.view, system: { ...state.view.system, notices: state.view.system.notices.filter((n) => n.id !== id) } })
}

/** Closes the lot once time is up and settles every party's outcome. */
export function demoTick(state: DemoAuctionState, now: number): DemoAuctionState {
	const { view } = state
	if (view.status !== 'live' || now < view.endsAt) return state

	const top = view.bids[0]
	let outcome: AuctionLotView['system']['outcome']
	let shipping: AuctionLotView['system']['shipping'] = null
	if (!top) outcome = { kind: 'no-sale', reason: 'no-bids' }
	else if (!view.reserve.met) outcome = { kind: 'no-sale', reason: 'reserve-not-met' }
	else if (top.isOwn) {
		outcome = { kind: 'won', amountSats: top.amountSats }
		shipping = { counterpartName: view.seller.name, status: 'awaiting-address' }
	} else {
		const viewerBid = view.bids.find((b) => b.isOwn)
		outcome = viewerBid
			? { kind: 'lost', winningSats: top.amountSats, refundedSats: viewerBid.amountSats, refundStatus: 'refunded' }
			: { kind: 'watcher', winningSats: top.amountSats, winnerName: top.bidderName }
	}

	// No sale: whatever the viewer still has locked goes back.
	let wallet = view.viewer.walletBalanceSats ?? 0
	let lockedSats = state.lockedSats
	let notices = view.system.notices
	if (outcome.kind === 'no-sale' && lockedSats > 0) {
		notices = pushNotice(notices, {
			id: `n${state.seq + 1}r`,
			kind: 'refund',
			amountSats: lockedSats,
			at: now,
			detail: 'No sale, so your bid was released.',
		})
		wallet += lockedSats
		lockedSats = 0
	}

	return withView(
		state,
		{ ...view, status: 'ended', viewer: { ...view.viewer, walletBalanceSats: wallet }, system: { notices, outcome, shipping } },
		{ lockedSats, seq: state.seq + 1 },
	)
}

export function demoAdvanceShipping(state: DemoAuctionState): DemoAuctionState {
	const shipping = state.view.system.shipping
	if (!shipping) return state
	const status = shipping.status === 'awaiting-address' ? 'address-sent' : 'shipped'
	return withView(state, { ...state.view, system: { ...state.view.system, shipping: { ...shipping, status } } })
}

/** A lot with some history already on it, for editor canvases and screenshots. */
export function createSeededDemoAuction(now: number, options: Omit<DemoAuctionOptions, 'now'> = {}): DemoAuctionState {
	let state = createDemoAuctionState({ now: now - 60, ...options })
	const picks = [0.1, 0.5, 0.3, 0.9, 0.7]
	picks.forEach((pick, i) => {
		state = demoRivalBid(state, now - 50 + i * 9, pick)
		state = demoRivalChat(state, now - 48 + i * 9, pick)
	})
	return { ...state, view: { ...state.view, system: { ...state.view.system, notices: [] } } }
}
