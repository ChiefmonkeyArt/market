import { cn } from '@/lib/utils'
import type { SellerCardBlockSchema } from '@/lib/schemas/auctionPage'
import type { z } from 'zod'
import { useAuctionPage } from '../AuctionPageContext'
import { AuctionPanel, Initial } from './shared'

type Props = Omit<z.infer<typeof SellerCardBlockSchema>['props'], 'id'>

/**
 * The seller, as the auction knows them. The seller is the lot's author, so
 * like `ProfileHeader` on a storefront this block has no prop that could name a
 * different person.
 */
export function SellerCardBlock({ style, showRating, showMessageButton, showFollowButton }: Props) {
	const ctx = useAuctionPage()
	if (!ctx) return null
	const { seller } = ctx.view
	const inert = ctx.isEditing
	return (
		<AuctionPanel label="Seller" testId="auction-seller" className={cn(style === 'host' && 'flex items-center gap-3')}>
			<div className="flex items-center gap-3">
				<Initial name={seller.name} url={seller.avatarUrl} className={style === 'host' ? 'size-12 text-lg' : 'size-10'} />
				<div className="min-w-0">
					<p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{style === 'host' ? 'Your host' : 'Seller'}</p>
					<p className="truncate font-bold">{seller.name}</p>
					{showRating && (seller.rating !== undefined || seller.sales !== undefined) && (
						<p className="text-xs text-muted-foreground">
							{seller.rating !== undefined && `${seller.rating.toFixed(1)} rating`}
							{seller.rating !== undefined && seller.sales !== undefined && ' · '}
							{seller.sales !== undefined && `${seller.sales} sales`}
						</p>
					)}
				</div>
			</div>
			{style !== 'host' && seller.about && <p className="mt-3 text-sm text-muted-foreground">{seller.about}</p>}
			{(showMessageButton || showFollowButton) && (
				<div className={cn('flex gap-2', style === 'host' ? 'ml-auto' : 'mt-3')}>
					{showFollowButton && (
						<button
							type="button"
							disabled={inert}
							className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground"
						>
							Follow
						</button>
					)}
					{showMessageButton && (
						<a
							href={inert ? undefined : seller.profileHref}
							className="rounded-md border border-border px-3 py-1.5 text-sm font-semibold"
							aria-disabled={inert || !seller.profileHref}
						>
							Message
						</a>
					)}
				</div>
			)}
		</AuctionPanel>
	)
}
