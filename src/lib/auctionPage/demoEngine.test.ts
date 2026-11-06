import { describe, expect, test } from 'bun:test'
import {
	createDemoAuctionState,
	createSeededDemoAuction,
	demoAdvanceShipping,
	demoPlaceBid,
	demoRivalBid,
	demoTick,
	demoTopUp,
} from './demoEngine'
import { leaderboardFromBids } from './view'

const T = 1_800_000_000

describe('fake-sats demo engine', () => {
	test('a bid below the minimum is refused with a notice and nothing changes', () => {
		const s0 = createDemoAuctionState({ now: T })
		const s1 = demoPlaceBid(s0, 1, T)
		expect(s1.view.currentBidSats).toBeNull()
		expect(s1.view.system.notices.at(-1)?.kind).toBe('bid-rejected')
	})

	test('bidding locks sats; being outbid refunds them straight away', () => {
		const s0 = createDemoAuctionState({ now: T, walletSats: 100_000 })
		const s1 = demoPlaceBid(s0, 50_000, T + 1)
		expect(s1.view.viewer.isLeading).toBe(true)
		expect(s1.view.viewer.walletBalanceSats).toBe(50_000)
		const s2 = demoRivalBid(s1, T + 2, 0.1)
		expect(s2.view.viewer.isLeading).toBe(false)
		expect(s2.view.viewer.walletBalanceSats).toBe(100_000)
		expect(s2.view.system.notices.map((n) => n.kind)).toEqual(['bid-accepted', 'outbid', 'refund'])
	})

	test('raising your own bid releases the previous lock', () => {
		let s = createDemoAuctionState({ now: T, walletSats: 200_000 })
		s = demoPlaceBid(s, 50_000, T + 1)
		s = demoPlaceBid(s, 60_000, T + 2)
		expect(s.view.viewer.walletBalanceSats).toBe(140_000)
	})

	test('top-ups are unlimited', () => {
		const s = demoTopUp(createDemoAuctionState({ now: T, walletSats: 0 }), 5_000_000)
		expect(s.view.viewer.walletBalanceSats).toBe(5_000_000)
	})

	test('a late bid extends the close (soft close)', () => {
		const s0 = createDemoAuctionState({ now: T, durationSeconds: 60, softCloseSeconds: 15 })
		const s1 = demoPlaceBid(s0, 50_000, T + 55)
		expect(s1.view.endsAt).toBe(T + 70)
	})

	test('the winner is connected with the seller for shipping', () => {
		let s = createDemoAuctionState({ now: T, durationSeconds: 60, reserveSats: 0 })
		s = demoPlaceBid(s, 50_000, T + 1)
		s = demoTick(s, T + 61)
		expect(s.view.status).toBe('ended')
		expect(s.view.system.outcome).toEqual({ kind: 'won', amountSats: 50_000 })
		expect(s.view.system.shipping?.status).toBe('awaiting-address')
		expect(demoAdvanceShipping(s).view.system.shipping?.status).toBe('address-sent')
	})

	test('a losing bidder ends refunded', () => {
		let s = createDemoAuctionState({ now: T, durationSeconds: 60, reserveSats: 0 })
		s = demoPlaceBid(s, 50_000, T + 1)
		s = demoRivalBid(s, T + 2, 0.1)
		s = demoTick(s, T + 61)
		expect(s.view.system.outcome.kind).toBe('lost')
	})

	test('reserve not met is a no sale, and any lock is released', () => {
		let s = createDemoAuctionState({ now: T, durationSeconds: 60, reserveSats: 10_000_000 })
		s = demoPlaceBid(s, 50_000, T + 1)
		s = demoTick(s, T + 61)
		expect(s.view.system.outcome).toEqual({ kind: 'no-sale', reason: 'reserve-not-met' })
		expect(s.view.viewer.walletBalanceSats).toBe(1_000_000)
	})

	test('the seeded demo has history and a sensible leaderboard', () => {
		const s = createSeededDemoAuction(T)
		expect(s.view.bids.length).toBeGreaterThan(2)
		const board = leaderboardFromBids(s.view.bids, 8)
		expect(board[0].amountSats).toBe(s.view.currentBidSats!)
		expect(new Set(board.map((b) => b.bidderPubkey)).size).toBe(board.length)
	})
})
