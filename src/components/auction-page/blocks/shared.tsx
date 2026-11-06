import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

/**
 * The one surface every auction block draws on. It opts into the Theme Studio
 * surface axes (`sf-raised`, `sf-glass`) so the Shadows and Glass sliders apply,
 * and carries `ap-panel` so a layout theme (e.g. `brut`) can restyle every
 * auction surface at once from `auction-page.css` without touching a block.
 */
export function AuctionPanel({
	children,
	className,
	as: Tag = 'section',
	label,
	testId,
}: {
	children: ReactNode
	className?: string
	as?: 'section' | 'div' | 'aside'
	label?: string
	testId?: string
}) {
	return (
		<Tag
			aria-label={label}
			data-testid={testId}
			className={cn('ap-panel sf-raised sf-glass rounded-lg border border-border bg-card p-4 text-card-foreground', className)}
		>
			{children}
		</Tag>
	)
}

export function PanelTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
	return (
		<div className="mb-3 flex items-center justify-between gap-2">
			<h3 className="ap-title text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{children}</h3>
			{aside}
		</div>
	)
}

export function Initial({ name, url, className }: { name: string; url?: string; className?: string }) {
	if (url) return <img src={url} alt="" className={cn('size-7 shrink-0 rounded-full object-cover', className)} />
	return (
		<span
			aria-hidden
			className={cn(
				'grid size-7 shrink-0 place-items-center rounded-full bg-secondary text-xs font-bold uppercase text-foreground',
				className,
			)}
		>
			{name.slice(0, 1)}
		</span>
	)
}

/** Shown where the engine has nothing yet (no bids, no chat). */
export function EmptyLine({ children }: { children: ReactNode }) {
	return <p className="py-4 text-center text-sm text-muted-foreground">{children}</p>
}

/** "12s ago", for feeds. */
export function ago(at: number, now: number): string {
	const s = Math.max(0, now - at)
	if (s < 5) return 'now'
	if (s < 60) return `${s}s`
	if (s < 3600) return `${Math.floor(s / 60)}m`
	return `${Math.floor(s / 3600)}h`
}
