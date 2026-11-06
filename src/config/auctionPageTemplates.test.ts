import { describe, expect, test } from 'bun:test'
import { countAuctionPageBlocks, validateAuctionPageForPublish } from '@/lib/schemas/auctionPage'
import { isPaletteInTheme } from './storefrontThemes'
import {
	AUCTION_PAGE_TEMPLATES,
	DEFAULT_AUCTION_TEMPLATE_ID,
	getAuctionPageTemplate,
	PLATFORM_DEFAULT_AUCTION_PAGE,
} from './auctionPageTemplates'

describe('AUCTION_PAGE_TEMPLATES', () => {
	test('ships the four playtested layouts', () => {
		expect(AUCTION_PAGE_TEMPLATES.map((t) => t.id)).toEqual(['catalogue', 'live-show', 'arena', 'brutalist'])
	})

	test('every template is a publishable document', () => {
		for (const template of AUCTION_PAGE_TEMPLATES) {
			const result = validateAuctionPageForPublish(template.page)
			expect(result.ok ? [] : result.errors, template.id).toEqual([])
		}
	})

	test('every template survives a JSON round trip unchanged', () => {
		for (const template of AUCTION_PAGE_TEMPLATES) {
			const result = validateAuctionPageForPublish(JSON.parse(JSON.stringify(template.page)))
			expect(result.ok && result.page, template.id).toEqual(template.page)
		}
	})

	test('every template uses a colourway its layout offers', () => {
		for (const { id, page } of AUCTION_PAGE_TEMPLATES) {
			expect(isPaletteInTheme(page.root.props.theme, page.root.props.palette), id).toBe(true)
		}
	})

	test('block ids are unique within each template, including inside columns', () => {
		for (const { id, page } of AUCTION_PAGE_TEMPLATES) {
			const ids: string[] = []
			for (const block of page.content) {
				ids.push(block.props.id)
				if (block.type === 'Columns')
					for (const slot of [block.props.a, block.props.b, block.props.c]) ids.push(...slot.map((b) => b.props.id))
				if (block.type === 'LiveShowStage')
					for (const slot of [block.props.left, block.props.right]) ids.push(...slot.map((b) => b.props.id))
			}
			expect(new Set(ids).size, id).toBe(ids.length)
			expect(countAuctionPageBlocks(page.content), id).toBe(ids.length)
		}
	})

	test('the brutalist layout has square corners and full hard shadows', () => {
		const { tune, theme } = getAuctionPageTemplate('brutalist').page.root.props
		expect(theme).toBe('brut')
		expect(tune.radiusPx).toBe(0)
		expect(tune.shadow).toBe(1)
	})

	test('catalogue is the platform default, and unknown ids fall back to it', () => {
		expect(DEFAULT_AUCTION_TEMPLATE_ID).toBe('catalogue')
		expect(PLATFORM_DEFAULT_AUCTION_PAGE).toBe(getAuctionPageTemplate('catalogue').page)
		expect(getAuctionPageTemplate('nope').id).toBe('catalogue')
	})
})
