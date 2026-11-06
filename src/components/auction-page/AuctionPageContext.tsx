import type { AuctionLotView, AuctionPageActions } from '@/lib/auctionPage/view'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

/**
 * Ambient facts every auction block reads but no document can set.
 *
 * `view` is the engine's current picture of the lot (ADR-0023, decision 2).
 * The lot itself comes from the route, never from a block prop, which is what
 * lets one seller-wide template serve every lot (decision 1).
 *
 * `isEditing` is true inside the Puck canvas: blocks render against the demo
 * lot there and stay inert, so clicking Bid selects the block rather than
 * placing a bid.
 */
export interface AuctionPageContextValue {
	view: AuctionLotView
	actions: AuctionPageActions
	isEditing: boolean
}

const AuctionPageContext = createContext<AuctionPageContextValue | null>(null)

export function AuctionPageProvider({ value, children }: { value: AuctionPageContextValue; children: ReactNode }) {
	return <AuctionPageContext.Provider value={value}>{children}</AuctionPageContext.Provider>
}

export function useAuctionPage(): AuctionPageContextValue | null {
	return useContext(AuctionPageContext)
}

/** Unix seconds, ticking once a second while mounted. */
export function useNowSeconds(intervalMs = 1000): number {
	const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))
	useEffect(() => {
		const id = window.setInterval(() => setNow(Math.floor(Date.now() / 1000)), intervalMs)
		return () => window.clearInterval(id)
	}, [intervalMs])
	return now
}
