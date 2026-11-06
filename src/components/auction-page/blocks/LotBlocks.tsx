import { cn } from '@/lib/utils'
import type { LiveVideoBlockSchema, LotGalleryBlockSchema, LotHeaderBlockSchema } from '@/lib/schemas/auctionPage'
import { useEffect, useRef, useState } from 'react'
import type { z } from 'zod'
import { useAuctionPage } from '../AuctionPageContext'
import { AuctionPanel } from './shared'

type Props<S extends z.ZodTypeAny> = Omit<Extract<z.infer<S>, { props: unknown }>['props'], 'id'>

export function LotHeaderBlock({ showLotNumber, showCategory, titleStyle, align }: Props<typeof LotHeaderBlockSchema>) {
	const ctx = useAuctionPage()
	if (!ctx) return null
	const { lot, status } = ctx.view
	return (
		<header data-testid="auction-lot-header" className={cn('ap-lot-header py-2', align === 'center' && 'text-center')}>
			<div
				className={cn(
					'mb-2 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground',
					align === 'center' && 'justify-center',
				)}
			>
				{showLotNumber && lot.lotNumber && <span>Lot {lot.lotNumber}</span>}
				{showCategory && lot.category && <span>· {lot.category}</span>}
				<span
					className={cn(
						'rounded-full px-2 py-0.5 text-[10px]',
						status === 'live' ? 'ap-live-dot bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
					)}
				>
					{status === 'live' ? 'Live' : status === 'ended' ? 'Ended' : 'Soon'}
				</span>
			</div>
			<h1
				className={cn(
					'text-balance text-foreground',
					titleStyle === 'serif' && 'font-heading text-3xl leading-tight sm:text-5xl',
					titleStyle === 'sans' && 'text-2xl font-bold sm:text-4xl',
					titleStyle === 'giant-caps' && 'ap-giant text-4xl font-black uppercase leading-[0.9] tracking-tight sm:text-7xl',
				)}
			>
				{lot.title}
			</h1>
			{lot.summary && <p className={cn('mt-3 max-w-3xl text-muted-foreground', align === 'center' && 'mx-auto')}>{lot.summary}</p>}
		</header>
	)
}

const aspectClass = { '1:1': 'aspect-square', '4:3': 'aspect-[4/3]', '3:4': 'aspect-[3/4]', '16:9': 'aspect-video' } as const

export function LotGalleryBlock({ layout, thumbPosition, aspect, lightbox, grayscaleUntilHover }: Props<typeof LotGalleryBlockSchema>) {
	const ctx = useAuctionPage()
	const [index, setIndex] = useState(0)
	const [open, setOpen] = useState(false)
	if (!ctx) return null
	const images = ctx.view.lot.images
	if (images.length === 0) return null
	const current = images[Math.min(index, images.length - 1)]
	const imgClass = cn('size-full object-cover transition', grayscaleUntilHover && 'grayscale hover:grayscale-0')
	const openLightbox = () => lightbox && !ctx.isEditing && setOpen(true)

	if (layout === 'grid') {
		return (
			<div data-testid="auction-gallery" className="grid grid-cols-2 gap-2">
				{images.map((src, i) => (
					<button
						key={src}
						type="button"
						className={cn('ap-media overflow-hidden rounded-lg bg-muted', aspectClass[aspect])}
						onClick={() => (setIndex(i), openLightbox())}
					>
						<img src={src} alt={`${ctx.view.lot.title}, image ${i + 1}`} className={imgClass} />
					</button>
				))}
				{open && <Lightbox src={current} onClose={() => setOpen(false)} />}
			</div>
		)
	}

	const thumbs = (
		<div className={cn('flex gap-2', thumbPosition === 'side' ? 'flex-col' : 'flex-row overflow-x-auto')}>
			{images.map((src, i) => (
				<button
					key={src}
					type="button"
					aria-label={`Show image ${i + 1}`}
					aria-current={i === index}
					onClick={() => setIndex(i)}
					className={cn(
						'ap-thumb size-16 shrink-0 overflow-hidden rounded-md border-2 bg-muted',
						i === index ? 'border-primary' : 'border-transparent opacity-70 hover:opacity-100',
					)}
				>
					<img src={src} alt="" className={imgClass} />
				</button>
			))}
		</div>
	)

	return (
		<div data-testid="auction-gallery" className={cn('flex gap-3', thumbPosition === 'side' ? 'flex-row-reverse' : 'flex-col')}>
			<button
				type="button"
				onClick={openLightbox}
				className={cn('ap-media relative w-full overflow-hidden rounded-lg bg-muted', aspectClass[aspect])}
			>
				<img key={current} src={current} alt={ctx.view.lot.title} className={cn(imgClass, 'ap-fade-in')} />
				{layout === 'carousel' && images.length > 1 && (
					<span className="absolute bottom-2 right-2 rounded-full bg-background/80 px-2 py-0.5 text-xs">
						{index + 1}/{images.length}
					</span>
				)}
			</button>
			{layout === 'main-thumbs' && images.length > 1 && thumbs}
			{open && <Lightbox src={current} onClose={() => setOpen(false)} />}
		</div>
	)
}

function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
		window.addEventListener('keydown', onKey)
		return () => window.removeEventListener('keydown', onKey)
	}, [onClose])
	return (
		<div
			role="dialog"
			aria-modal="true"
			aria-label="Image"
			className="fixed inset-0 z-50 grid place-items-center bg-black/85 p-6"
			onClick={onClose}
		>
			<img src={src} alt="" className="max-h-full max-w-full rounded-lg object-contain" />
		</div>
	)
}

/**
 * A pitch clip or live stream. Audible autoplay is often blocked; when it is,
 * the clip plays muted and the first tap anywhere unmutes it.
 */
export function LiveVideoBlock({ videoSrc, posterUrl, orientation, soundDefault }: Props<typeof LiveVideoBlockSchema>) {
	const ctx = useAuctionPage()
	const src = videoSrc || ctx?.view.lot.videoSrc || ''
	const poster = posterUrl || ctx?.view.lot.posterUrl || ctx?.view.lot.images[0]
	return (
		<VideoSurface src={src} poster={poster} orientation={orientation} soundDefault={soundDefault} isEditing={ctx?.isEditing ?? false} />
	)
}

export function VideoSurface({
	src,
	poster,
	orientation,
	soundDefault,
	isEditing,
	className,
	children,
}: {
	src: string
	poster?: string
	orientation: 'portrait' | 'landscape'
	soundDefault: 'on' | 'off'
	isEditing: boolean
	className?: string
	children?: React.ReactNode
}) {
	const ref = useRef<HTMLVideoElement>(null)
	const [muted, setMuted] = useState(soundDefault === 'off' || isEditing)

	useEffect(() => {
		const video = ref.current
		if (!video || !src || isEditing) return
		video.muted = soundDefault === 'off'
		video.play().catch(() => {
			video.muted = true
			setMuted(true)
			video.play().catch(() => {})
			if (soundDefault !== 'on') return
			const unmute = () => {
				video.muted = false
				setMuted(false)
				video.currentTime = 0
				video.play().catch(() => {})
			}
			window.addEventListener('pointerdown', unmute, { once: true })
		})
	}, [src, soundDefault, isEditing])

	return (
		<div
			data-testid="auction-video"
			className={cn(
				'ap-media relative overflow-hidden rounded-lg bg-black',
				orientation === 'portrait' ? 'aspect-[9/16]' : 'aspect-video',
				className,
			)}
		>
			{src ? (
				<video ref={ref} src={src} poster={poster} playsInline loop muted={muted} className="size-full object-cover" />
			) : poster ? (
				<img src={poster} alt="" className="size-full object-cover" />
			) : null}
			{src && (
				<button
					type="button"
					className="absolute right-2 top-2 z-10 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white"
					onClick={(e) => {
						e.stopPropagation()
						const video = ref.current
						if (!video) return
						video.muted = !video.muted
						setMuted(video.muted)
					}}
				>
					{muted ? 'Sound off' : 'Sound on'}
				</button>
			)}
			{children}
		</div>
	)
}

export { AuctionPanel }
