## What

Auction page layouts on the storefront CMS: sellers can lay out auction lots with the same page builder, themes and palettes as their shop. This is **stage 1** of [ADR-0023](https://github.com/ChiefmonkeyArt/market/blob/feat/auction-page-layouts/docs/adr/ADR-0023-auction-page-layouts.md). It adds the schema, blocks, renderer, system screens, Puck registry, four templates and a fake-sats preview at `/auction-layouts`. **The live `auctions.$auctionId` route and every money path are unchanged.**

> **Stacked PR.** The base is `feat/cms-spike` (#1413). The branch builds on #1423 (`maxime-tt:feat/cms-theme-studio` @ `12312ef5`), so the diff includes #1423's two commits until that merges. Review the last four commits only. Retarget to `feat/cms-spike` after #1423 lands. cc @maxime-tt

Related: #953 (Puck spike), #1413 (CMS spike), #1423 (Theme Studio), #900 (CMS V1).

## Decisions (ADR-0023, all decided by the product owner)

1. **Document identity.** Kind 30024 with the same envelope as storefront pages. `auction-template` is one per seller and applies to every lot. `auction-page:<auction d>` is an optional per-lot override. The render order is lot override, then seller template, then platform default (Catalogue). A disabled or broken override falls back instead of blanking the lot.
2. **The engine is the source of truth.** Blocks render a read-only `AuctionLotView` and call `AuctionPageActions`. No block prop can carry an amount, a time, a winner, a pubkey or an auction reference, and a test enforces this. Unknown props are stripped.
3. **Nesting limits.** These apply to the `Columns` and `LiveShowStage` containers:
   - depth 1 (a container holds leaf blocks only)
   - at most 3 columns, from a closed ratio list
   - at most 20 blocks per slot
   - nested blocks count towards the 100-block cap
   - columns stack below `collapseBelow`

   Reads are lenient and publishing is strict. The Puck slots accept leaf blocks only.
4. **System screens are fixed.** These are not blocks, so a document cannot remove them:
   - outbid and refund notices
   - the Going once / Going twice / Sold sequence
   - the outcome cards for won, lost, seller, watcher and no sale
   - the buyer–seller shipping handoff

The security model is unchanged from storefront pages:
- a closed union
- no raw HTML or scripts
- media must be `https://` or an in-app path

The brutalist look is owned by the `brut` theme CSS, so no new tune axis is added.

## Commits

- `docs(adr)`: ADR-0023 and the index row (0022 is retired per ADR-0002, so this takes 0023)
- `feat(auction-page)`: schema, `AuctionLotView` contract, pure demo engine, templates and four palettes
- `feat(auction-page)`: 13 blocks, renderer, system layer, Puck registry and the `/auction-layouts` preview
- `test(e2e)`: `e2e/tests/auction-layouts.spec.ts`

## Evidence

- Unit tests: `bun test src/lib/schemas/ src/config/ src/lib/auctionPage/` gives 130 passing (schema limits, decision tests, demo engine, templates).
- E2E: `e2e/tests/auction-layouts.spec.ts` gives 6 passing with `video: 'on'`. It covers:
  - all four layouts render
  - bid → rival outbid → refund
  - win → shipping handoff
  - reserve not met → no sale and the bid is released

  The spec needs only the dev server, because the preview reads no relay, wallet or mint. [Video](https://github.com/ChiefmonkeyArt/market/blob/evidence/auction-layouts/auction-layouts-e2e.mp4) is on an evidence-only branch; do not merge that branch.
- `tsc`: no errors in the new or changed files (the base branch has pre-existing errors elsewhere).
- Prettier: clean.

Try it: `/auction-layouts?layout=catalogue|live-show|arena|brutalist`. Add `&rivals=off` to drive every bid with the Rival bid button.

## Not in this PR (stage 2)

- An engine adapter that builds `AuctionLotView` from validated auction events for `auctions.$auctionId`. It needs its own review against ADR-0003 and ADR-0017.
- Publishing and the editor for the `auction-template` and `auction-page:<d>` d-tags.
