# Swarm Pepe

The static website for SPEPE: Home, Gallery and About, built with Vite, React,
TypeScript and viem. The complete production export is in **`dist/`** alongside
its source and lockfile. No backend, database, API key or server rendering.

## Install, run and rebuild

Use Node.js 22.12 or newer and npm.

```sh
npm ci
npm run dev
npm run typecheck
npm run build
npm run preview
```

Open the URL printed by Vite. `preview` serves the production `dist/`, while
`dev` serves source. A network connection is required for live Ethereum data.
The site shell and About page remain readable when the RPC is unavailable.
Do not open `index.html` as a `file://` URL: ES modules need an HTTP static host.

## Publish

Publish **the contents of `dist/`**, including every asset, the font, its license
and favicon, to any static host or an IPFS directory. Keep their relative layout.
There is no server build step, rewrite rule or environment secret. `base: './'`
in `vite.config.ts` makes assets relative; `#home`, `#gallery` and `#about` make
navigation work under a gateway or subdirectory. If publishing from a repository,
include the regenerated `dist/` in the submission: the publisher does not rebuild.
After each source change, run typecheck and build, then inspect the new export.

## Ethereum and wallet configuration

**`src/config.ts` is the single configuration location.** `RPC_URL` defaults to
`https://ethereum-rpc.publicnode.com`. Replace it with a browser-accessible,
CORS-enabled Ethereum **mainnet** RPC if needed, then rebuild. A URL embedded in a
static site is public; this project does not require an API key.

- SwarmPepe: `0x999ce0ce8c5f7661e0c74a568ffe27ceb9177bdb`
- PixelArt: `0x07Fd9841eEB6a359EfB30f861D59bFa1f6B03FcA`
- Chain ID: `1`

Both verified sources were read before implementation; provenance, source hashes
and contract behavior are in [contract research](artifacts/contract-research.md).
All artwork and attributes are decoded from the contract's `tokenURI()` data URI.
There are no shipped portrait snapshots, metadata APIs, image hosts or IPFS art
URLs. The only bundled visual assets are the UI font and geometric favicon.

Wallet access uses EIP-6963 discovery and an injected EIP-1193 provider. Use a
browser wallet extension or open the site in a mobile wallet's browser. Where
multiple wallets announce themselves, the mint/reveal panel offers a chooser.
There is no WalletConnect relay, QR bridge, remote wallet SDK or project key.
Connecting is explicit; reading and checking any pasted address require no wallet.
Disconnect clears this site's session; wallet-side permissions can be revoked in
the wallet. A wallet on another chain must switch to Ethereum before transacting.

Mint preflight rereads status, owner and allocation, simulates the call, and asks
the connected wallet to sign. Full remaining allocation uses `claim()`; a smaller
selection uses `claim(uint256)`. **No `value` is attached.** Network gas still
applies. The UI blocks closed mint, exhausted slots/supply and the contract owner,
and translates custom errors. Transaction links and receipt states remain visible.

Reveal sends selected IDs in one `reveal(uint256[])` call. It is permissionless;
unready, already revealed and expired commitments can be skipped. Receipt success
does not promise every token changed. The fixed future block hash is available for
8,191 blocks (roughly 27 hours); old commitments may stay unrevealed permanently.
Large batches can exceed gas limits; select fewer tokens if simulation fails.

## Collection loading and rarity

Stats and token reads use one block snapshot. Home scans seeds in batches of 64 to
find up to 12 revealed portraits. Gallery renders 24 IDs per page, loading the
first page and newest 24 IDs first, then the rest. Three paced workers bound
metadata concurrency, including across tab changes. Obsolete responses are ignored.
No collection data is persisted between sessions. Refresh reads a new snapshot.

Trait counts are calculated in the browser from **every minted token's returned
attributes**. Percentages use total minted as denominator, including pending
metadata. They and trait filters stay unavailable until the complete snapshot is
read. They are observed frequencies, not the renderer's theoretical weights.
Status filters can show partial results while scanning. Progress, missing-token
retry and an RPC outage banner explain incomplete reads. At 5,000 tokens the full
scan can take several minutes or longer on a shared endpoint. Changing pages does
not expand the DOM beyond 24 token cards.

## Validation performed

The worker installed dependencies outside the repository in `/tmp/spepe-build/`
to leave repository `node_modules/` untouched, copied the source/config there,
and ran the same `typecheck` and `build` scripts. The generated export was copied
back to `dist/`. Temporary dependency caches and test browsers are not delivered.

- Production build and strict TypeScript check: passed after the final source changes.
- Production Chromium interaction suite: **21 passed, 0 failed**, including both
  mint overloads, no attached ETH value, custom errors, reveal batches, wallet
  restrictions, pagination, rarity completion, RPC recovery and 320px reflow.
- Parser/error checks: **21 passed**. Isolated React data-loader checks: **14 passed**.
- Actual export loaded under `/preview/`; live mainnet portraits and allowlist
  results rendered. One full live snapshot loaded **975/975** records after retrying
  two missed records; Skin: Gold yielded **7 records / 0.72%**. These are dated
  observations, not fixed collection counts.
- Browser screenshots, keyboard and reflow checks, computed pixel sizes, axe scan,
  measured contrast, six-domain review, fixes and limitations are documented in
  [validation](artifacts/validation.md). [Interaction results](artifacts/interaction-results.json)
  distinguish fixtures from live-chain checks.

Wallet signing, extension dialogs and mainnet settlement were simulated; no
transactions were broadcast. Public RPC 429 responses occurred during the live
scan and were surfaced/retried. Full 5,000-token public-network performance,
physical phones, Safari/Firefox, a screen-reader session and native browser 200%
zoom were not verified. Static hosting was checked locally at a subpath; a public
IPFS/ENS deployment was not performed.

## Design and delivery

[DESIGN.md](DESIGN.md) documents the implemented tokens, typography, components,
integer pixel-art scaling and responsive behavior. [Video reference](artifacts/video-reference.md)
records inspection of the original Swarm Pepe film. The pinned Better Interface
reference was applied across accessibility, layout, writing, typography, colors
and UI; its attribution/license notices are retained under `artifacts/`.
VT323's SIL Open Font License is included in `public/` and `dist/`.

[Path budget](artifacts/path-budget.md) explicitly budgets `.gitignore` and the
8 MiB submission cap. Dependencies, caches, scratch harnesses and browser working
files are excluded at every nesting level. Required source/runtime assets and
`dist/` are retained; no vendored registry, dependency archive or submodule is used.
