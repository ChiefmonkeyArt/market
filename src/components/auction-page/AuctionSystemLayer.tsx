import { cn } from '@/lib/utils'
import { formatSats, type AuctionSystemNotice } from '@/lib/auctionPage/view'
import { useEffect, useState } from 'react'
import { useAuctionPage } from './AuctionPageContext'

/**
 * Screens every auction page shows, whatever the layout (ADR-0023, decision 4).
 *
 * Nothing here is a block. A layout document has no way to name, hide or
 * reorder these, because the parties to an auction rely on them: a bidder must
 * always learn they were outbid and refunded, a winner must always reach the
 * shipping handoff, and a seller must always see the result. Themes restyle
 * them through the same tokens as the rest of the page.
 */
export function AuctionSystemLayer() {
	const ctx = useAuctionPage()
	if (!ctx || ctx.isEditing) return null
	// The storefront root makes its direct children `position: relative` to sit
	// above the grain overlay, so the fixed layers need a plain wrapper.
	return (
		<div data-auction-system-layer>
			<NoticeStack />
			<EndOfAuction />
		</div>
	)
}

const NOTICE_MS = 6000

function noticeText(n: AuctionSystemNotice): { title: string; body: string; tone: 'good' | 'warn' | 'info' } {
	switch (n.kind) {
		case 'outbid':
			return { title: 'You were outbid', body: `${n.byName} bid ${formatSats(n.amountSats)}.`, tone: 'warn' }
		case 'refund':
			return { title: `${formatSats(n.amountSats)} refunded`, body: n.detail, tone: 'info' }
		case 'bid-accepted':
			return { title: 'Bid placed', body: `You lead with ${formatSats(n.amountSats)}.`, tone: 'good' }
		case 'bid-rejected':
			return { title: 'Bid not placed', body: n.reason, tone: 'warn' }
	}
}

function NoticeStack() {
	const ctx = useAuctionPage()
	const notices = ctx?.view.system.notices ?? []
	const dismiss = ctx?.actions.dismissNotice
	useEffect(() => {
		if (!dismiss || notices.length === 0) return
		const timers = notices.map((n) => window.setTimeout(() => dismiss(n.id), NOTICE_MS))
		return () => timers.forEach((t) => window.clearTimeout(t))
	}, [notices, dismiss])
	if (notices.length === 0) return null
	return (
		<div aria-live="assertive" className="pointer-events-none fixed inset-x-0 top-4 z-40 flex flex-col items-center gap-2 px-4">
			{notices.map((n) => {
				const t = noticeText(n)
				return (
					<div
						key={n.id}
						role="status"
						data-testid={`auction-notice-${n.kind}`}
						className={cn(
							'ap-panel ap-toast pointer-events-auto w-full max-w-sm rounded-lg border bg-card p-3 text-card-foreground shadow-lg',
							t.tone === 'warn' && 'border-primary',
							t.tone === 'good' && 'border-border',
							t.tone === 'info' && 'border-border',
						)}
					>
						<p className="font-bold">{t.title}</p>
						<p className="text-sm text-muted-foreground">{t.body}</p>
					</div>
				)
			})}
		</div>
	)
}

type Phase = 'once' | 'twice' | 'sold' | 'result'

function EndOfAuction() {
	const ctx = useAuctionPage()
	const ended = ctx?.view.status === 'ended'
	const [phase, setPhase] = useState<Phase>('once')
	const [minimised, setMinimised] = useState(false)

	useEffect(() => {
		if (!ended) return
		setPhase('once')
		setMinimised(false)
		const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
		if (reduce) {
			setPhase('result')
			return
		}
		const a = window.setTimeout(() => setPhase('twice'), 700)
		const b = window.setTimeout(() => setPhase('sold'), 1400)
		const c = window.setTimeout(() => setPhase('result'), 2600)
		return () => [a, b, c].forEach((t) => window.clearTimeout(t))
	}, [ended])

	if (!ctx || !ended) return null
	const { outcome, shipping } = ctx.view.system
	const sold = outcome.kind !== 'no-sale'

	if (phase !== 'result') {
		return (
			<div data-testid="auction-end-sequence" className="fixed inset-0 z-50 grid place-items-center bg-background/80 backdrop-blur-sm">
				<p key={phase} className="ap-gavel text-6xl font-black uppercase tracking-tight text-foreground sm:text-8xl">
					{phase === 'once' ? 'Going once' : phase === 'twice' ? 'Going twice' : sold ? 'Sold' : 'Closed'}
				</p>
			</div>
		)
	}

	const card = (
		<div
			data-testid={`auction-outcome-${outcome.kind}`}
			className="ap-panel sf-raised relative w-full max-w-md overflow-hidden rounded-xl border border-border bg-card p-6 text-card-foreground"
		>
			{outcome.kind === 'won' && <Confetti />}
			{outcome.kind === 'won' && (
				<>
					<p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Winning bid</p>
					<h2 className="ap-pop mt-1 text-4xl font-black text-primary">You won</h2>
					<p className="mt-2 text-lg font-semibold tabular-nums">{formatSats(outcome.amountSats)}</p>
					<p className="mt-2 text-sm text-muted-foreground">Your bid becomes the payment to the seller. Everyone else has been refunded.</p>
				</>
			)}
			{outcome.kind === 'lost' && (
				<>
					<h2 className="text-3xl font-black">Not this time</h2>
					<p className="mt-2 text-sm">Won for {formatSats(outcome.winningSats)}.</p>
					<p className="mt-2 rounded-md bg-muted p-3 text-sm">
						{outcome.refundStatus === 'refunded'
							? `${formatSats(outcome.refundedSats)} is back in your wallet.`
							: `Refund of ${formatSats(outcome.refundedSats)} is on its way.`}
					</p>
				</>
			)}
			{outcome.kind === 'seller' && (
				<>
					<h2 className="text-3xl font-black">Sold</h2>
					<p className="mt-2 text-sm">
						{outcome.winnerName} won for {formatSats(outcome.winningSats)}.
					</p>
				</>
			)}
			{outcome.kind === 'watcher' && (
				<>
					<h2 className="text-3xl font-black">Sold</h2>
					<p className="mt-2 text-sm">
						{outcome.winnerName} won for {formatSats(outcome.winningSats)}.
					</p>
				</>
			)}
			{outcome.kind === 'no-sale' && (
				<>
					<h2 className="text-3xl font-black">No sale</h2>
					<p className="mt-2 text-sm">
						{outcome.reason === 'reserve-not-met'
							? 'The reserve was not met. All bids have been refunded.'
							: 'There were no bids on this lot.'}
					</p>
				</>
			)}
			{shipping && <ShippingHandoff />}
			<button type="button" className="mt-4 text-sm text-muted-foreground underline" onClick={() => setMinimised(true)}>
				Back to the lot
			</button>
		</div>
	)

	if (minimised) {
		return (
			<div className="fixed inset-x-0 bottom-0 z-40 flex justify-center p-3">
				<button
					type="button"
					onClick={() => setMinimised(false)}
					data-testid="auction-outcome-banner"
					className="ap-panel rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold shadow-lg"
				>
					{outcome.kind === 'won'
						? 'You won · arrange shipping'
						: outcome.kind === 'lost'
							? 'Auction ended · refund details'
							: 'Auction ended'}
				</button>
			</div>
		)
	}

	return <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-4 backdrop-blur-sm">{card}</div>
}

function ShippingHandoff() {
	const ctx = useAuctionPage()
	const shipping = ctx?.view.system.shipping
	if (!ctx || !shipping) return null
	const steps = [
		{ key: 'awaiting-address', label: 'Send your address' },
		{ key: 'address-sent', label: 'Seller packs it' },
		{ key: 'shipped', label: 'Shipped' },
	] as const
	const at = steps.findIndex((s) => s.key === shipping.status)
	return (
		<div data-testid="auction-shipping" className="mt-4 rounded-lg border border-border p-3">
			<p className="text-sm font-semibold">You are connected with {shipping.counterpartName} to arrange shipping.</p>
			<ol className="mt-2 flex gap-2 text-xs">
				{steps.map((s, i) => (
					<li
						key={s.key}
						className={cn(
							'flex-1 rounded-md px-2 py-1 text-center',
							i <= at ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
						)}
					>
						{s.label}
					</li>
				))}
			</ol>
			{ctx.actions.openShippingChat && (
				<button
					type="button"
					className="mt-3 w-full rounded-md bg-primary py-2 font-bold text-primary-foreground"
					onClick={() => ctx.actions.openShippingChat?.()}
				>
					{shipping.status === 'awaiting-address' ? 'Message the seller' : 'Open the conversation'}
				</button>
			)}
		</div>
	)
}

/** CSS-only confetti; skipped entirely for reduced motion by the stylesheet. */
function Confetti() {
	return (
		<div aria-hidden className="ap-confetti pointer-events-none absolute inset-0">
			{Array.from({ length: 28 }, (_, i) => (
				<span key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 7) * 90}ms`, ['--ap-hue' as string]: i % 3 }} />
			))}
		</div>
	)
}
