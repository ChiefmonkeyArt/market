import { AuctionPageRenderer } from '@/components/auction-page/AuctionPageRenderer'
import { useDemoAuction } from '@/components/auction-page/useDemoAuction'
import { AUCTION_PAGE_TEMPLATES, getAuctionPageTemplate, type AuctionTemplateId } from '@/config/auctionPageTemplates'
import { cn } from '@/lib/utils'
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

/**
 * Auction layout preview (ADR-0023). Renders the four built-in layouts against
 * the fake-sats demo engine so the team can playtest them. It never reads or
 * writes a real auction, wallet or relay.
 */
export const Route = createFileRoute('/auction-layouts')({
	validateSearch: z.object({
		layout: z.enum(['catalogue', 'live-show', 'arena', 'brutalist']).optional(),
		/** `off` stops the automatic rivals; use the Rival bid button instead. */
		rivals: z.enum(['on', 'off']).optional(),
	}),
	component: AuctionLayoutsPreview,
})

function AuctionLayoutsPreview() {
	const { layout, rivals } = Route.useSearch()
	const navigate = Route.useNavigate()
	const template = getAuctionPageTemplate(layout)
	const { view, actions, reset, endNow, rivalBid } = useDemoAuction({ rivals: rivals !== 'off' })

	return (
		<div>
			<div className="sticky top-0 z-30 flex flex-wrap items-center gap-2 border-b bg-background/95 px-4 py-2 text-sm backdrop-blur">
				<span className="font-semibold">Auction layouts</span>
				<span className="text-muted-foreground">Preview with fake sats. Nothing here touches a real auction.</span>
				<div className="ml-auto flex flex-wrap gap-1" role="tablist" aria-label="Layout">
					{AUCTION_PAGE_TEMPLATES.map((t) => (
						<button
							key={t.id}
							type="button"
							role="tab"
							aria-selected={t.id === template.id}
							data-testid={`layout-${t.id}`}
							onClick={() => navigate({ search: { layout: t.id as AuctionTemplateId, rivals } })}
							className={cn('rounded-md px-3 py-1', t.id === template.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}
						>
							{t.label}
						</button>
					))}
					<button type="button" onClick={rivalBid} data-testid="demo-rival-bid" className="rounded-md border px-3 py-1">
						Rival bid
					</button>
					<button type="button" onClick={endNow} data-testid="demo-end-now" className="rounded-md border px-3 py-1">
						End now
					</button>
					<button type="button" onClick={reset} data-testid="demo-reset" className="rounded-md border px-3 py-1">
						Restart
					</button>
				</div>
			</div>
			<AuctionPageRenderer key={template.id} page={template.page} view={view} actions={actions} />
		</div>
	)
}
