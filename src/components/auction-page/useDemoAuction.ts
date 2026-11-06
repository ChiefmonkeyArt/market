import {
	createSeededDemoAuction,
	demoAdvanceShipping,
	demoDismissNotice,
	demoPlaceBid,
	demoRivalBid,
	demoRivalChat,
	demoSendChat,
	demoTick,
	demoTopUp,
	type DemoAuctionState,
} from '@/lib/auctionPage/demoEngine'
import type { AuctionPageActions } from '@/lib/auctionPage/view'
import { useCallback, useEffect, useMemo, useState } from 'react'

const nowS = () => Math.floor(Date.now() / 1000)

/**
 * Runs the fake-sats demo auction in the browser: rivals bid and chat on a
 * timer, the clock ticks, and the lot settles. Preview and playtest only.
 */
export function useDemoAuction({ durationSeconds = 120, rivals = true }: { durationSeconds?: number; rivals?: boolean } = {}) {
	const [state, setState] = useState<DemoAuctionState>(() => createSeededDemoAuction(nowS(), { durationSeconds }))

	useEffect(() => {
		const tick = window.setInterval(() => setState((s) => demoTick(s, nowS())), 500)
		// `rivals: false` keeps the room quiet so a playtest or e2e run decides every bid.
		const rivalTimer = !rivals
			? undefined
			: window.setInterval(() => {
					setState((s) => {
						if (s.view.status !== 'live') return s
						const pick = Math.random()
						// Rivals get keener as the clock runs down.
						const remaining = s.view.endsAt - nowS()
						const chance = remaining < 20 ? 0.7 : 0.35
						let next = pick < chance ? demoRivalBid(s, nowS(), Math.random()) : s
						if (Math.random() < 0.4) next = demoRivalChat(next, nowS(), Math.random())
						return next
					})
				}, 2500)
		return () => {
			window.clearInterval(tick)
			if (rivalTimer) window.clearInterval(rivalTimer)
		}
	}, [rivals])

	const reset = useCallback(() => setState(createSeededDemoAuction(nowS(), { durationSeconds })), [durationSeconds])
	const rivalBid = useCallback(() => setState((s) => (s.view.status === 'live' ? demoRivalBid(s, nowS(), Math.random()) : s)), [])
	const endNow = useCallback(() => setState((s) => demoTick({ ...s, view: { ...s.view, endsAt: nowS() } }, nowS())), [])

	const actions: AuctionPageActions = useMemo(
		() => ({
			placeBid: (amount) => setState((s) => demoPlaceBid(s, amount, nowS())),
			setMaxBid: (amount) => setState((s) => demoPlaceBid(s, amount, nowS())),
			sendChat: (text) => setState((s) => demoSendChat(s, text, nowS())),
			react: (r) => setState((s) => demoSendChat(s, r, nowS())),
			topUpWallet: (amount) => setState((s) => demoTopUp(s, amount)),
			dismissNotice: (id) => setState((s) => demoDismissNotice(s, id)),
			openShippingChat: () => setState((s) => demoAdvanceShipping(s)),
		}),
		[],
	)

	return { view: state.view, actions, reset, endNow, rivalBid }
}
