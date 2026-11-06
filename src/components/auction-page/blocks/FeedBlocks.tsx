import { cn } from '@/lib/utils'
import { formatSats, leaderboardFromBids } from '@/lib/auctionPage/view'
import type {
	AuctionStatsBlockSchema,
	BidFeedBlockSchema,
	BidTickerBlockSchema,
	ChatFeedBlockSchema,
	LeaderboardBlockSchema,
	UpNextBlockSchema,
} from '@/lib/schemas/auctionPage'
import { useEffect, useRef, useState } from 'react'
import type { z } from 'zod'
import { useAuctionPage, useNowSeconds } from '../AuctionPageContext'
import { ago, AuctionPanel, EmptyLine, Initial, PanelTitle } from './shared'

type Props<S extends z.ZodTypeAny> = Omit<Extract<z.infer<S>, { props: unknown }>['props'], 'id'>

export function BidFeedBlock({ title, limit, highlightOwn, animateNew, style }: Props<typeof BidFeedBlockSchema>) {
	const ctx = useAuctionPage()
	const now = useNowSeconds()
	if (!ctx) return null
	const bids = ctx.view.bids.slice(0, limit)
	return (
		<AuctionPanel label={title || 'Bids'} testId="auction-bid-feed">
			<PanelTitle aside={<span className="text-xs tabular-nums text-muted-foreground">{ctx.view.stats.bids}</span>}>{title}</PanelTitle>
			{bids.length === 0 ? (
				<EmptyLine>No bids yet. Be the first.</EmptyLine>
			) : (
				<ol className="flex flex-col gap-1" aria-live="polite">
					{bids.map((bid, i) => (
						<li
							key={bid.id}
							className={cn(
								'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm',
								i === 0 && animateNew === 'subtle' && 'ap-flash',
								i === 0 && animateNew === 'slide' && 'ap-slide-in',
								highlightOwn && bid.isOwn && 'bg-primary/10',
								style === 'index' && 'border-b border-border',
							)}
						>
							{style === 'index' ? (
								<span className="w-6 tabular-nums text-muted-foreground">{ctx.view.stats.bids - i}</span>
							) : (
								<Initial name={bid.bidderName} url={bid.bidderAvatarUrl} />
							)}
							<span className="min-w-0 flex-1 truncate font-medium">{bid.isOwn ? 'You' : bid.bidderName}</span>
							<span className="font-semibold tabular-nums">{formatSats(bid.amountSats)}</span>
							<span className="w-8 text-right text-xs text-muted-foreground">{ago(bid.at, now)}</span>
						</li>
					))}
				</ol>
			)}
		</AuctionPanel>
	)
}

export function ChatFeedBlock({ title, style, allowReplies, allowReactions }: Props<typeof ChatFeedBlockSchema>) {
	const ctx = useAuctionPage()
	const [draft, setDraft] = useState('')
	const list = useRef<HTMLDivElement>(null)
	const count = ctx?.view.chat.length ?? 0
	useEffect(() => {
		const el = list.current
		if (el) el.scrollTop = el.scrollHeight
	}, [count])
	if (!ctx) return null
	const { view, actions, isEditing } = ctx
	const canSend = Boolean(actions.sendChat) && !isEditing && view.viewer.pubkey !== null

	return (
		<AuctionPanel label={title || 'Chat'} testId="auction-chat" className="flex min-h-0 flex-col">
			<PanelTitle>{title}</PanelTitle>
			<div ref={list} className="flex max-h-80 min-h-32 flex-col gap-2 overflow-y-auto pr-1">
				{view.chat.length === 0 ? (
					<EmptyLine>No messages yet.</EmptyLine>
				) : (
					view.chat.map((m) => (
						<div
							key={m.id}
							className={cn(
								'flex gap-2 text-sm',
								style === 'index' && 'border-b border-border pb-1',
								m.replyToId && allowReplies && style === 'threaded' && 'ml-8',
							)}
						>
							{style !== 'index' && <Initial name={m.authorName} url={m.authorAvatarUrl} className="size-6" />}
							<p className="min-w-0">
								<span className={cn('mr-1 font-semibold', m.isSeller && 'text-primary')}>{m.authorName}</span>
								<span className="break-words text-foreground/90">{m.text}</span>
							</p>
						</div>
					))
				)}
			</div>
			{allowReactions && actions.react && (
				<div className="mt-2 flex gap-1">
					{['Fire', 'LOL', 'Wow'].map((r) => (
						<button
							key={r}
							type="button"
							disabled={isEditing}
							className="rounded-full border border-border px-2 py-0.5 text-xs"
							onClick={() => actions.react?.(r)}
						>
							{r}
						</button>
					))}
				</div>
			)}
			<form
				className="mt-2 flex gap-2"
				onSubmit={(e) => {
					e.preventDefault()
					if (!canSend || !draft.trim()) return
					void actions.sendChat?.(draft)
					setDraft('')
				}}
			>
				<label className="sr-only" htmlFor="ap-chat-input">
					Message
				</label>
				<input
					id="ap-chat-input"
					value={draft}
					maxLength={280}
					onChange={(e) => setDraft(e.target.value)}
					disabled={!canSend}
					placeholder={canSend ? 'Say something' : 'Sign in to chat'}
					className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm"
				/>
				<button type="submit" disabled={!canSend} className="rounded-md bg-secondary px-3 text-sm font-semibold disabled:opacity-50">
					Send
				</button>
			</form>
		</AuctionPanel>
	)
}

const tickerDuration = { slow: '40s', normal: '24s', fast: '12s' } as const

export function BidTickerBlock({ speed, style }: Props<typeof BidTickerBlockSchema>) {
	const ctx = useAuctionPage()
	if (!ctx) return null
	const { view } = ctx
	const items =
		view.bids.length > 0
			? view.bids.slice(0, 10).map((b) => `${b.isOwn ? 'YOU' : b.bidderName.toUpperCase()} ${formatSats(b.amountSats)}`)
			: [`LOT ${view.lot.lotNumber ?? ''} ${view.lot.title.toUpperCase()}`, `STARTS AT ${formatSats(view.startingBidSats)}`]
	const line = items.join('   ·   ')
	return (
		<div
			data-testid="auction-ticker"
			aria-hidden
			className={cn(
				'ap-ticker overflow-hidden whitespace-nowrap py-2 text-sm font-bold tracking-wide',
				style === 'inverted' ? 'bg-foreground text-background' : 'bg-primary text-primary-foreground',
			)}
		>
			<div className="ap-marquee inline-flex gap-12" style={{ animationDuration: tickerDuration[speed] }}>
				<span>{line}</span>
				<span>{line}</span>
			</div>
		</div>
	)
}

export function LeaderboardBlock({ limit, showAvatars, highlightLeader }: Props<typeof LeaderboardBlockSchema>) {
	const ctx = useAuctionPage()
	if (!ctx) return null
	const rows = leaderboardFromBids(ctx.view.bids, limit)
	return (
		<AuctionPanel label="Leaderboard" testId="auction-leaderboard">
			<PanelTitle>Leaderboard</PanelTitle>
			{rows.length === 0 ? (
				<EmptyLine>Nobody on the board yet.</EmptyLine>
			) : (
				<ol className="flex flex-col gap-1">
					{rows.map((bid, i) => (
						<li
							key={bid.bidderPubkey}
							className={cn(
								'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-all',
								highlightLeader && i === 0 && 'bg-primary font-bold text-primary-foreground',
								bid.isOwn && !(highlightLeader && i === 0) && 'bg-secondary',
							)}
						>
							<span className="w-5 tabular-nums">{i + 1}</span>
							{showAvatars && <Initial name={bid.bidderName} url={bid.bidderAvatarUrl} className="size-6" />}
							<span className="min-w-0 flex-1 truncate">{bid.isOwn ? 'You' : bid.bidderName}</span>
							<span className="tabular-nums">{formatSats(bid.amountSats)}</span>
						</li>
					))}
				</ol>
			)}
		</AuctionPanel>
	)
}

const statLabel = { bids: 'Bids', bidders: 'Bidders', watchers: 'Watching', bidsPerMinute: 'Bids / min' } as const

export function AuctionStatsBlock({ fields, style }: Props<typeof AuctionStatsBlockSchema>) {
	const ctx = useAuctionPage()
	if (!ctx) return null
	const { stats } = ctx.view
	return (
		<AuctionPanel label="Auction stats" testId="auction-stats" className={cn(style === 'inline' && 'py-3')}>
			<dl className={cn('grid gap-3', style === 'inline' ? 'grid-flow-col auto-cols-fr' : 'grid-cols-2')}>
				{fields.map((f) => (
					<div key={f} className={cn(style === 'index' && 'border-l-4 border-foreground pl-2')}>
						<dt className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{statLabel[f]}</dt>
						<dd key={stats[f]} className={cn('ap-pop font-bold tabular-nums', style === 'big-numbers' ? 'text-4xl' : 'text-xl')}>
							{stats[f]}
						</dd>
					</div>
				))}
			</dl>
		</AuctionPanel>
	)
}

export function UpNextBlock({ title, limit }: Props<typeof UpNextBlockSchema>) {
	const ctx = useAuctionPage()
	if (!ctx || ctx.view.upNext.length === 0) return null
	return (
		<AuctionPanel label={title || 'Up next'} testId="auction-up-next">
			<PanelTitle>{title}</PanelTitle>
			<ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
				{ctx.view.upNext.slice(0, limit).map((item) => (
					<li key={item.id} className="overflow-hidden rounded-md border border-border bg-background">
						{item.imageUrl && <img src={item.imageUrl} alt="" className="aspect-square w-full object-cover" />}
						<p className="truncate p-2 text-sm font-medium">{item.title}</p>
					</li>
				))}
			</ul>
		</AuctionPanel>
	)
}
