import { expect, test } from '@playwright/test'

/**
 * Auction page layouts preview (ADR-0023).
 *
 * `/auction-layouts` runs the fake-sats demo engine in the browser. It reads no
 * relay, wallet or mint, so this spec needs only the dev server. `rivals=off`
 * stops the automatic rival bids; the spec triggers them with the Rival bid
 * button so every step is deterministic.
 */

test.use({ video: 'on' })

const LAYOUTS = ['catalogue', 'live-show', 'arena', 'brutalist'] as const

test.describe('Auction page layouts', () => {
	for (const layout of LAYOUTS) {
		test(`${layout} renders the lot, bid panel and countdown`, async ({ page }) => {
			await page.goto(`/auction-layouts?layout=${layout}&rivals=off`)
			await expect(page.getByTestId('auction-page')).toBeVisible()
			await expect(page.getByTestId('auction-lot-header').first()).toBeVisible()
			await expect(page.getByTestId('auction-current-bid').first()).toBeVisible()
			await expect(page.getByTestId('auction-countdown').first()).toBeVisible()
		})
	}

	test('outbid refunds the bid, and the winner is connected to the seller', async ({ page }) => {
		await page.goto('/auction-layouts?layout=catalogue&rivals=off')
		const wallet = page.getByTestId('auction-wallet').first()
		await expect(wallet).toHaveText('1,000,000 sats')

		// Bid: the amount is locked out of the wallet.
		await page.locator('#ap-bid-amount').fill('100000')
		await page.getByTestId('auction-bid-submit').first().click()
		await expect(page.getByTestId('auction-notice-bid-accepted')).toBeVisible()
		await expect(wallet).toHaveText('900,000 sats')

		// A rival outbids: the viewer is told and refunded.
		await page.getByTestId('demo-rival-bid').click()
		await expect(page.getByTestId('auction-notice-outbid')).toBeVisible()
		await expect(page.getByTestId('auction-notice-refund')).toBeVisible()
		await expect(wallet).toHaveText('1,000,000 sats')

		// Bid over the reserve, then close the lot.
		await page.locator('#ap-bid-amount').fill('400000')
		await page.getByTestId('auction-bid-submit').first().click()
		await expect(wallet).toHaveText('600,000 sats')
		await page.getByTestId('demo-end-now').click()

		await expect(page.getByTestId('auction-end-sequence')).toBeVisible()
		await expect(page.getByTestId('auction-outcome-won')).toBeVisible({ timeout: 6_000 })
		await expect(page.getByTestId('auction-shipping')).toContainText('connected with chiefmonkey')
		await page.getByRole('button', { name: 'Message the seller' }).click()
		await expect(page.getByRole('button', { name: 'Open the conversation' })).toBeVisible()
	})

	test('a lot that misses its reserve ends with no sale and releases the bid', async ({ page }) => {
		await page.goto('/auction-layouts?layout=brutalist&rivals=off')
		const wallet = page.getByTestId('auction-wallet').first()
		await page.locator('#ap-bid-amount').fill('100000')
		await page.getByTestId('auction-bid-submit').first().click()
		await expect(wallet).toHaveText('900,000 sats')

		await page.getByTestId('demo-end-now').click()
		await expect(page.getByTestId('auction-outcome-no-sale')).toBeVisible({ timeout: 6_000 })
		await expect(page.getByTestId('auction-outcome-no-sale')).toContainText('reserve was not met')
		await expect(wallet).toHaveText('1,000,000 sats')
	})
})
