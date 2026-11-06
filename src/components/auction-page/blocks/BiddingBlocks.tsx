import { cn } from '@/lib/utils'
import { formatCountdown, formatSats } from '@/lib/auctionPage/view'
import type { BidPanelBlockSchema, CountdownBlockSchema, ReserveMeterBlockSchema } from '@/lib/schemas/auctionPage'
import { useRef, useState, type PointerEvent } from 'react'
import type { z } from 'zod'
import { useAuctionPage, useNowSeconds } from '../AuctionPageContext'
import { AuctionPanel, PanelTitle } from './shared'

type Props<S extends z.ZodTypeAny> = Omit<Extract<z.infer<S>, { props: unknown }>['props'], 'id'>

/**
 * Bid entry. The panel offers the amounts the engine says it will accept
 * (`nextMinimumBidSats`, `quickBidSats`) and hands the chosen amount to
 * `actions.placeBid`. Whether the bid stands is the engine's answer, which comes
 * back through the view as a new top bid or a `bid-rejected` notice.
 */
export function BidPanelBlock({ mode, quickSteps, allowMaxBid, showWalletChip, ctaLabel }: Props<typeof BidPanelBlockSchema>) {
	const ctx = useAuctionPage()
	const [custom, setCustom] = useState('')
	const [maxMode, setMaxMode] = useState(mode === 'max-bid')
	if (!ctx) return null
	const { view, actions, isEditing } = ctx
	const closed = view.status !== 'live'
	const steps = view.quickBidSats.slice(0, quickSteps)
	const disabled = closed || isEditing || view.viewer.isSeller

	const submit = (amount: number) => {
		if (disabled || !Number.isFinite(amount) || amount <= 0) return
		if (maxMode && actions.setMaxBid) void actions.setMaxBid(amount)
		else void actions.placeBid(amount)
		setCustom('')
	}

	const customAmount = Number(custom.replace(/[^0-9]/g, ''))

	return (
		<AuctionPanel label="Place a bid" testId="auction-bid-panel" className="ap-bid-panel">
			<div className="flex items-start justify-between gap-3">
				<div>
					<p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
						{view.currentBidSats === null ? 'Starting bid' : 'Current bid'}
					</p>
					<p
						key={view.currentBidSats ?? 0}
						data-testid="auction-current-bid"
						className="ap-price ap-pop text-3xl font-bold tabular-nums text-foreground"
					>
						{formatSats(view.currentBidSats ?? view.startingBidSats)}
					</p>
					{view.viewer.isLeading && <p className="mt-1 text-sm font-semibold text-primary">You are the highest bidder</p>}
				</div>
				{showWalletChip && view.viewer.walletBalanceSats !== null && (
					<div className="flex flex-col items-end gap-1">
						<span
							data-testid="auction-wallet"
							className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold tabular-nums text-foreground"
						>
							{formatSats(view.viewer.walletBalanceSats)}
						</span>
						{actions.topUpWallet && (
							<button
								type="button"
								className="text-xs text-muted-foreground underline"
								onClick={() => actions.topUpWallet?.(1_000_000)}
								disabled={isEditing}
							>
								Add 1M fake sats
							</button>
						)}
					</div>
				)}
			</div>

			{closed ? (
				<p className="mt-4 rounded-md bg-muted p-3 text-center text-sm font-semibold">Bidding has closed</p>
			) : (
				<>
					{steps.length > 0 && mode !== 'swipe' && (
						<div className="mt-4 grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(steps.length, 3)}, minmax(0, 1fr))` }}>
							{steps.map((amount) => (
								<button
									key={amount}
									type="button"
									disabled={disabled}
									onClick={() => submit(amount)}
									className="ap-step rounded-md border border-border bg-background px-2 py-2 text-sm font-semibold tabular-nums hover:border-primary disabled:opacity-50"
								>
									{formatSats(amount)}
								</button>
							))}
						</div>
					)}

					{mode === 'swipe' ? (
						<SwipeToBid
							label={`${ctaLabel} · ${formatSats(view.nextMinimumBidSats)}`}
							disabled={disabled}
							onConfirm={() => submit(view.nextMinimumBidSats)}
						/>
					) : (
						<form
							className="mt-3 flex gap-2"
							onSubmit={(e) => {
								e.preventDefault()
								submit(customAmount || view.nextMinimumBidSats)
							}}
						>
							<label className="sr-only" htmlFor="ap-bid-amount">
								Bid amount in sats
							</label>
							<input
								id="ap-bid-amount"
								inputMode="numeric"
								placeholder={`${view.nextMinimumBidSats.toLocaleString('en-GB')} or more`}
								value={custom}
								onChange={(e) => setCustom(e.target.value)}
								disabled={disabled}
								className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 tabular-nums"
							/>
							<button
								type="submit"
								data-testid="auction-bid-submit"
								disabled={disabled}
								className="ap-cta rounded-md bg-primary px-4 py-2 font-bold text-primary-foreground disabled:opacity-50"
							>
								{maxMode ? 'Set max' : ctaLabel}
							</button>
						</form>
					)}

					{allowMaxBid && mode !== 'swipe' && actions.setMaxBid && (
						<label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
							<input type="checkbox" checked={maxMode} onChange={(e) => setMaxMode(e.target.checked)} disabled={disabled} />
							Bid automatically up to this amount
						</label>
					)}
					<p className="mt-2 text-xs text-muted-foreground">Minimum next bid {formatSats(view.nextMinimumBidSats)}</p>
				</>
			)}
		</AuctionPanel>
	)
}

/** Drag the knob to the end to confirm. Keyboard users press Enter on the knob. */
function SwipeToBid({ label, disabled, onConfirm }: { label: string; disabled: boolean; onConfirm: () => void }) {
	const track = useRef<HTMLDivElement>(null)
	const [x, setX] = useState(0)
	const [dragging, setDragging] = useState(false)
	const knob = 48

	const max = () => (track.current ? track.current.clientWidth - knob - 8 : 200)
	const onMove = (e: PointerEvent) => {
		if (!dragging || !track.current) return
		const rect = track.current.getBoundingClientRect()
		setX(Math.max(0, Math.min(max(), e.clientX - rect.left - knob / 2)))
	}
	const onUp = () => {
		if (!dragging) return
		setDragging(false)
		if (x >= max() * 0.9) onConfirm()
		setX(0)
	}

	return (
		<div
			ref={track}
			data-testid="auction-swipe"
			className={cn('ap-swipe relative mt-4 h-14 select-none overflow-hidden rounded-full bg-primary/15', disabled && 'opacity-50')}
			onPointerMove={onMove}
			onPointerUp={onUp}
			onPointerLeave={onUp}
		>
			<div className="absolute inset-y-0 left-0 bg-primary/30" style={{ width: x + knob }} />
			<span className="pointer-events-none absolute inset-0 grid place-items-center pl-10 text-sm font-bold uppercase tracking-wide text-foreground">
				{label}
			</span>
			<button
				type="button"
				aria-label={label}
				disabled={disabled}
				className="absolute left-1 top-1 grid size-12 touch-none place-items-center rounded-full bg-primary text-xl font-black text-primary-foreground"
				style={{ transform: `translateX(${x}px)`, transition: dragging ? 'none' : 'transform 200ms ease' }}
				onPointerDown={(e) => {
					if (disabled) return
					;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
					setDragging(true)
				}}
				onKeyDown={(e) => e.key === 'Enter' && !disabled && onConfirm()}
			>
				→
			</button>
		</div>
	)
}

export function CountdownBlock({ style, size, pulseUnderSeconds, softCloseNote, showTimePercent }: Props<typeof CountdownBlockSchema>) {
	const ctx = useAuctionPage()
	const now = useNowSeconds()
	if (!ctx) return null
	const { view } = ctx
	const remaining = view.status === 'ended' ? 0 : Math.max(0, view.endsAt - now)
	const total = Math.max(1, view.endsAt - view.startsAt)
	const left = Math.min(1, remaining / total)
	const urgent = view.status === 'live' && remaining <= pulseUnderSeconds
	const label = view.status === 'ended' ? 'Ended' : formatCountdown(remaining)
	const textSize = size === 'xl' ? 'text-5xl' : size === 'lg' ? 'text-4xl' : 'text-2xl'

	return (
		<AuctionPanel label="Time remaining" testId="auction-countdown" className={cn('ap-countdown', urgent && 'ap-urgent')}>
			<PanelTitle
				aside={
					showTimePercent ? <span className="text-xs tabular-nums text-muted-foreground">{Math.round(left * 100)}% left</span> : undefined
				}
			>
				{view.status === 'ended' ? 'Auction' : 'Ends in'}
			</PanelTitle>
			{style === 'ring' ? (
				<div className="mx-auto grid w-fit place-items-center">
					<svg
						viewBox="0 0 120 120"
						className={cn(size === 'xl' ? 'size-48' : size === 'lg' ? 'size-40' : 'size-28', 'col-start-1 row-start-1 -rotate-90')}
						aria-hidden
					>
						<circle cx="60" cy="60" r="52" className="fill-none stroke-muted" strokeWidth="10" />
						<circle
							cx="60"
							cy="60"
							r="52"
							className="fill-none stroke-primary transition-[stroke-dashoffset] duration-1000 ease-linear"
							strokeWidth="10"
							strokeLinecap="round"
							strokeDasharray={2 * Math.PI * 52}
							strokeDashoffset={2 * Math.PI * 52 * (1 - left)}
						/>
					</svg>
					<span className={cn('col-start-1 row-start-1 font-bold tabular-nums', size === 'md' ? 'text-xl' : 'text-3xl')}>{label}</span>
				</div>
			) : style === 'bar' ? (
				<div>
					<p className={cn('font-black tabular-nums', textSize)}>{label}</p>
					<div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-muted">
						<div className="h-full bg-primary transition-[width] duration-1000 ease-linear" style={{ width: `${left * 100}%` }} />
					</div>
				</div>
			) : (
				<p className={cn('font-bold tabular-nums', textSize)}>{label}</p>
			)}
			{softCloseNote && view.softCloseSeconds && view.status === 'live' && (
				<p className="mt-2 text-xs text-muted-foreground">A bid in the last {view.softCloseSeconds}s extends the clock.</p>
			)}
		</AuctionPanel>
	)
}

export function ReserveMeterBlock({ showWhenMet }: Props<typeof ReserveMeterBlockSchema>) {
	const ctx = useAuctionPage()
	if (!ctx || !ctx.view.reserve.hasReserve) return null
	const { met, progress } = ctx.view.reserve
	return (
		<AuctionPanel label="Reserve" testId="auction-reserve" className="py-3">
			<div className="flex items-center justify-between text-sm">
				<span className="font-semibold">{met ? showWhenMet : 'Reserve not yet met'}</span>
				<span className="tabular-nums text-muted-foreground">{Math.round(progress * 100)}%</span>
			</div>
			<div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
				<div
					className={cn('h-full transition-[width] duration-500', met ? 'bg-primary' : 'bg-muted-foreground')}
					style={{ width: `${progress * 100}%` }}
				/>
			</div>
		</AuctionPanel>
	)
}
