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

## Amendment (2026-11): Stage 2, the real auction rules

Status: Proposed. This amendment governs stage 2 only, when `auctions.$auctionId` renders through the layout system.
Stage 1 (the `/auction-layouts` preview) is unchanged until the demo rules mode below lands.

### Context

The stage 1 demo engine was built for gameplay. The auction protocol (`AUCTIONS.md`, ADR-0003, ADR-0012, ADR-0017)
behaves differently in four places that bidders can see:

1. **No clock extension.** Bids in `[start_at, end_at]` pay the flat floor. Bids in `(end_at, max_end_at]` pay the
   `min_bid_curve` floor, and `max_end_at` is a hard cutoff fixed at publish. The older scheme that shifted `end_at` is
   retired (`AUCTIONS.md` §3).
2. **The curve floor is a selection rule, not a validity rule.** A bid below it is valid but not leading. It keeps its
   lock and refunds through the loser path. A compliant client must not hard-reject it, and the computed floor is only
   a warning (`AUCTIONS.md` §3, ADR-0012 Phase 1).
3. **Outbid ecash stays locked until `locktime = max_end_at + settlement_grace`.** Raising your own bid uses the
   additive rebid chain: each new leg locks only the delta, and every leg shares the same locktime (`AUCTIONS.md`
   §4.2.1).
4. **Bids are pending until the verdict quorum classifies them.** After the lot closes, the winner must release the
   derivation path before the seller can redeem. If the winner does not settle within `fallback_delay_sec`, the seller
   may offer settlement to the second-highest valid bid. Every unsettled bid refunds at locktime (`AUCTIONS.md` §2,
   §9).

### Decisions

**A1. Lifecycle phase replaces soft close.** `AuctionLotView` gains:

- `phase: 'scheduled' | 'bidding' | 'final-call' | 'settling' | 'settled' | 'no-sale'`
- `endAt`, `maxEndAt` and `locktime`
- `curveFloorSats`, the floor right now during final call, or `null`

`status` stays as a derived alias (`live` covers `bidding` and `final-call`), so stage 1 blocks keep working.
`softCloseSeconds` is removed for real lots. `Countdown` shows "Bidding" until `endAt`, then "Final call" until
`maxEndAt`, and its soft-close note becomes a final-call note.

**A2. Under the curve floor is a warning, not a block.** `nextMinimumBidSats` remains the leading floor.
`BidPanel` must allow a bid between the flat floor and the curve floor. It shows "valid, but will not lead" and asks
for one confirmation. Only the engine can refuse a bid, and only for a validity rule.

**A3. Outbid means locked, not refunded.** Notice kinds change:

| Kind               | Fields                    | Meaning                                                        |
| ------------------ | ------------------------- | -------------------------------------------------------------- |
| `outbid`           | `byName`, `lockedUntil`   | You no longer lead. Your sats stay locked until `lockedUntil`. |
| `refund-pending`   | `amountSats`, `unlocksAt` | A losing bid will refund at locktime.                          |
| `refund-available` | `amountSats`              | Locktime has passed, so the refund can be swept.               |
| `bid-pending`      | `amountSats`              | Published and waiting for validator classification.            |
| `bid-invalid`      | `reason` (closed enum)    | Classified invalid, with the reason code from the verdicts.    |

The stage 1 `refund` kind is kept for the demo only. Copy on real lots must never say "refunded" before locktime.

**A4. Raising your own bid is a top-up.** Add `topUpBid(newTotalSats)` to `AuctionPageActions`. The engine
publishes a rebid leg whose `amount` is the new total, and it locks only the delta. The viewer gains `lockedSats`
(the sum of the viewer's legs) and `unlocksAt`. The outbid notice offers "Top up to X", which costs only
`X − lockedSats`.

**A5. Bid state is visible.** Each `AuctionLotViewBid` gains `state: 'pending' | 'valid' | 'invalid'`. `BidFeed` and
`Leaderboard` show pending bids muted and hide invalid ones. "You lead" appears only once your top bid is `valid`. The
leader and the winner come from the existing quorum and selection helpers (`computeValidatedBids`,
`computeVerdictQuorum`), never from raw events.

**A6. Settlement is a system screen.** Outcomes gain:

| Kind             | Who          | Next step                                                                      |
| ---------------- | ------------ | ------------------------------------------------------------------------------ |
| `settling`       | winner       | "Release to seller" (`releasePath()`), with a deadline of `fallback_delay_sec` |
| `settling`       | seller       | Waiting for the winner, with a countdown to the fallback                       |
| `fallback-offer` | runner-up    | Accept or decline settlement at their own bid                                  |
| `refund-pending` | losers       | Locked until `locktime`                                                        |
| `settled`        | buyer/seller | Shipping handoff opens                                                         |

`releasePath()` and `claimRefund()` are added to `AuctionPageActions`. Both route through the existing settlement
and wallet paths. Like every money step, they render only in `AuctionSystemLayer` and are never blocks.

**A7. The demo learns the real rules.** `demoEngine.ts` gains `rules: 'arcade' | 'protocol'`. `arcade` is the
current stage 1 behaviour. `protocol` mirrors A1 to A6: a curve floor, locked-until-locktime, pending then valid, a
settling step and a runner-up fallback. The preview gets a toggle so playtests can compare them. The engine-contract
tests run on both modes.

**A8. Parity and tests.** For the same fixture events, every layout must show the same `phase`, current bid,
`nextMinimumBidSats`, `curveFloorSats` and viewer lock. The stage 2 builder `buildAuctionLotView` is a pure function
with fixtures for:

- pending, valid and invalid bids
- a bid below the curve floor
- a three-leg rebid chain
- settlement
- a fallback after `fallback_delay_sec`
- reserve not met
- seller offline, where everything refunds at locktime

The E2E auction specs run once per layout, with video.

### Consequences

- Real lots stop over-promising: there is no instant refund and no clock extension.
- Final-call bidding needs clearer copy, because "valid but not leading" is a new idea for bidders.
- The demo stays fun in `arcade` mode, while `protocol` mode lets the team test the real experience on fake sats first.
- Before a real-money lot uses a custom layout, the system layer must pass a z-order audit: no seller block can cover
  it.
