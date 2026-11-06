# ADR-0023: Auction Page Layouts on the Storefront CMS

## Status

Proposed

## Date

2026-11-06

## Related

- ADR-0003: comprehensive validation protocol for auctions (the rules that decide which bids count)
- ADR-0006: Nostr-native page building (the CMS this extends)
- ADR-0012: bid validity selection and winner derivation
- ADR-0017: four-validator BFT consensus for auctions
- ADR-019: unified storefront identity and page builder
- PR #953 (Puck editor spike), PR #1413 (`feat/cms-spike`), PR #1423 (Theme Studio: themes, palettes, bounded tune)
- Current code: `src/lib/schemas/storefront.ts`, `src/config/storefrontThemes.ts`, `src/config/storefrontCms.tsx`
- New code: `src/lib/schemas/auctionPage.ts`, `src/lib/auctionPage/`, `src/components/auction-page/`,
  `src/config/auctionPageTemplates.ts`, `src/config/auctionPageCms.tsx`, `src/routes/auction-layouts.tsx`

## Context

The storefront CMS (#1413, #1423) lets a seller lay out their shop from a closed set of blocks, then pick a theme, a
palette and a bounded tune. Auction lots still use one fixed page. Sellers have asked for auction pages that feel
like their shop, and product wants to playtest different auction experiences (a quiet catalogue, a live show, a
game-like arena, a brutalist poster) without touching the auction engine.

An auction page is not a storefront page. Three things make it riskier:

1. **Money is on screen.** Current bid, minimum next bid, reserve, time left and the winner are outputs of the
   validator protocol (ADR-0003, ADR-0012, ADR-0017). If a page document could carry or compute any of them, a seller
   could show a buyer a number the engine never agreed to.
2. **Layouts need columns.** A bid panel beside a gallery is the basic auction shape. The storefront schema is a flat
   list of blocks, so auction pages need containers, which brings nesting, size and recursion limits.
3. **Some screens are obligations.** Outbid and refund notices, the end-of-auction sequence, the outcome for winner,
   losers and seller, and the buyer–seller shipping handoff must reach every participant on every lot.

The product owner decided the four open questions on 6 November 2026. This ADR records them.

## Decision

### 1. Document identity: seller-wide template with a per-lot override

An auction page is a kind 30024 parameterised replaceable event, the same kind and envelope as a storefront page
(`version`, `enabled`, `root`, `content`). Two d-tags are used:

| d-tag                      | Scope                    | Count                 |
| -------------------------- | ------------------------ | --------------------- |
| `auction-template`         | Every lot by this seller | One per seller        |
| `auction-page:<auction d>` | One lot                  | Optional, one per lot |

Render order is lot override, then seller template, then the platform default (Layout A, Catalogue). A candidate is
used only if it parses and `enabled` is true, so a broken or disabled override falls back instead of blanking the lot
(`resolveAuctionPageLayout`). Deleting a lot override returns the lot to the seller template.

Blocks do not name an auction. The lot comes from the route through `AuctionPageContext`, which is what lets one
seller template serve every lot.

### 2. The auction engine is the source of truth

Page documents are surface UX only. The engine publishes a read-only `AuctionLotView` (`src/lib/auctionPage/view.ts`)
and accepts `AuctionPageActions` (`placeBid`, `setMaxBid`, `sendChat`, and so on). Blocks format and arrange the view;
they never decide whether a bid is valid, what the next minimum is, or who won.

Enforced by:

- No block prop may carry an amount, a time, a winner, a pubkey or an auction reference. A test fails if any block
  schema gains a key matching `amount|price|sats|currentBid|minimumBid|endsAt|startsAt|winner|auctionDTag|eventId|pubkey|reserveValue`.
- Unknown props are stripped on parse, so a smuggled value never reaches a component.
- Quick-bid steps are taken from the engine's `quickBidSats`. A block only chooses how many to show.

### 3. Nesting limits

Two containers are added: `Columns` and `LiveShowStage`. The rules are:

| Rule            | Value                                                                                     |
| --------------- | ----------------------------------------------------------------------------------------- |
| Depth           | 1. A container holds leaf blocks only. No Columns in Columns, no stage in a slot.         |
| Page cap        | 100 blocks, counting every block inside every slot (same cap as storefront).              |
| Columns per row | At most 3, from a closed ratio list: `1:1`, `7:5`, `5:7`, `3:2`, `2:3`, `1:1:1`, `3:5:3`. |
| Blocks per slot | 20                                                                                        |
| Mobile          | Columns stack below `collapseBelow` (`sm`, `md` or `lg`; default `md`).                   |
| Slot names      | `a`, `b`, `c` for Columns; `left`, `right` for LiveShowStage.                             |

Reading is lenient and publishing is strict. `parseAuctionPage` drops a nested container but keeps the rest of the
column, stops at the block budget, and ignores slot `c` on a two-column ratio. `validateAuctionPageForPublish` rejects
all of those with a reason. The Puck slot fields allow only leaf blocks, so the editor cannot produce a nested
container.

### 4. System screens are fixed

These are not blocks and cannot be named by a document, so a seller cannot remove, hide or reorder them:

- bid accepted, outbid and refund notices
- the end-of-auction sequence (Going once, Going twice, Sold or Closed)
- outcome cards for winner, loser (with refund status), seller, watcher and no sale
- the buyer–seller shipping handoff

`AuctionSystemLayer` renders them from `AuctionLotView.system` above every layout. Themes and palettes restyle them
through the same tokens as the page. They respect `prefers-reduced-motion`.

### 5. Security model

The storefront rules carry over unchanged. The block set is a closed discriminated union, there is no raw HTML and no
seller script, and video and poster URLs must be `https://` or an in-app path. Storefront pages cannot contain auction
blocks, and auction pages reuse only the storefront leaf blocks `Text`, `Image`, `ProductGrid`, `Divider` and
`Spacer`. A document with the wrong `version` is refused whole.

### 6. Themes own the look

The four templates are documents plus a palette, not new code paths:

| Template  | Theme  | Palette               |
| --------- | ------ | --------------------- |
| Catalogue | `pleb` | `auction-catalogue`   |
| Live Show | `pleb` | `auction-live-night`  |
| Arena     | `elec` | `auction-arena`       |
| Brutalist | `brut` | `auction-brutal-pink` |

The four palettes are added to `STOREFRONT_PALETTE_KEYS`. The brutalist borders and offset shadows come from the
`brut` theme CSS (`[data-storefront-theme='brut']`), not from a new tune axis, so #1423's bounded tune stays as it is.

## Rollout

**Stage 1, this PR.** Schema, blocks, renderer, system layer, Puck registry, the four templates, and a fake-sats
preview at `/auction-layouts`. The preview runs a pure demo engine (`demoEngine.ts`) with locked bids, refunds on
outbid, soft close, reserve, all outcomes and the shipping handoff. The live `auctions.$auctionId` route and every
money path are unchanged.

**Stage 2, follow-up.** An engine adapter that builds `AuctionLotView` from validated auction events for
`auctions.$auctionId`, then publishing and the editor for the `auction-template` and `auction-page:<d>` d-tags. Stage 2
needs its own review against ADR-0003 and ADR-0017 before merge.

## Consequences

### Positive

- Sellers get auction pages that match their shop, and product can playtest layouts with fake sats.
- The engine contract is explicit and testable, and the same blocks render demo and live data.
- Nesting is bounded in the schema, the parser and the editor, so a page cannot grow without limit.

### Negative

- A second page family to keep in step with storefront blocks and themes.
- Containers add schema and editor complexity that storefront pages do not have yet.
- Sellers can make a lot look very different from the platform default, which may confuse first-time bidders. The
  fixed system layer limits how far that goes.

### Neutral

- If storefront pages later need columns, they can adopt these containers and limits.

## Alternatives Considered

- **Per-lot pages only.** Rejected. Most sellers want one look for every lot.
- **Seller-wide only.** Rejected. Sellers want to try a layout on a single lot.
- **Blocks that read the auction by d-tag.** Rejected. It ties a template to one lot and invites blocks to fetch and
  interpret auction data themselves.
- **Unlimited nesting.** Rejected. Recursion makes size limits, mobile stacking and editor UX much harder for little
  gain on an auction page.
- **System screens as optional blocks.** Rejected. Refund and outcome messages are obligations to every participant.
