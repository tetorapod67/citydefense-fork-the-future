# CityDefense: Fork the Future

**A bounded WebMCP city-defense proof with server-backed state.**

CityDefense is a crisis-management city-builder prototype centered on safe, visible agent delegation. This public release documents the verified Gate 1 Core Proof. Replay, branch creation, fresh-thread handoff, and the broader crisis catalog are not live runtime claims.

- **Public deployment:** https://citydefense-fork-the-future.suguri-a.chatgpt.site
- **Source:** public in this repository
- **License:** [MIT](LICENSE)
- **Release mode:** `CORE_PROOF_RELEASE`

This source integration does not deploy or mutate production. The release is ready for the existing ChatGPT Sites deployment route once that route is separately verified.

## Verified Core Proof

The Codex In-app Browser host proof is complete for the following bounded flow:

- exactly two WebMCP tools: `get_city_context` and `place_stamp_bundle`
- the read tool was invoked
- exactly one authorized Gate 1 write was invoked during the proof
- the page visibly updated after the write
- `BRANCH-MAIN` advanced from v0 to v1
- the result was persisted in server-backed Cloudflare D1
- a normal reload restored the same branch version, stamp, and activity state
- the implementation source is public and MIT-licensed

The native **Recently used** surface was not observed, so this release makes no claim that it was. Remote CI is not configured, and no remote-CI pass is claimed.

## Why WebMCP

Pixel-driven automation has to infer meaning from layout and click targets. WebMCP lets the page expose a small set of semantically named, schema-validated operations instead. The agent can request the authenticated city context or submit one tightly constrained command while the server remains the authority for identity, role, branch, version, and persistence.

The result is a clearer contract: the agent knows which inputs are accepted, the human can see the same state in the normal page, and the server rejects actions outside the Gate 1 boundary.

## UX improvement

Humans keep the familiar authenticated `/play` surface. They can see the active Seat, Branch, Branch Version, Site Tools state, Central Ward, confirmation stamps, and public activity. An accepted tool call refreshes that visible state; a normal reload proves that the update came from D1 rather than transient client state.

Agents no longer need to navigate the visual map to understand or update the proof state. They receive structured results with stable IDs and can use optimistic versioning and request idempotency without hiding the outcome from the person watching the page.

## What humans and agents can do

Humans can:

- authenticate a disposable demo Seat through `/login`
- inspect the active Seat, role, branch, version, Central Ward state, stamp IDs, event IDs, and activity
- refresh or normally reload the page to confirm persistence
- observe whether Site Tools registration is `READY`

Agents can:

- call `get_city_context` to read the authenticated Seat, active Branch Version, Central Ward confirmation state, and recent public activity without changing state
- call `place_stamp_bundle` with the current Branch Version and a request ID to request one canonical `STAMP_CONFIRM` on `district:CENTRAL_WARD` with `BRANCH_PUBLIC` scope

Both tools are registered for an authenticated page. Write authority is not inferred from visibility: the server permits the Gate 1 write only for `PLANNER-01`. The completed host proof executed exactly one write; the runtime does not impose a permanent one-write-total limit on future valid local requests.

## Implementation

`src/app/play/city-defense-client.tsx` reads the top-level `document.modelContext` and invokes `modelContext.registerTool(...)` exactly twice. This is the `document.modelContext.registerTool` integration point. No iframe is used.

The two tools call same-origin routes:

- `GET /api/branches/:branchId/context`
- `POST /api/branches/:branchId/commands/place-stamp-bundle`

Every request is authenticated again on the server and checked against the active branch. When an `Origin` header is present, the write route rejects it if it does not match the request URL. The route also enforces `PLANNER-01`, the exact target/stamp/scope, a current expected Branch Version, and request idempotency. Accepted events, stamps, version changes, and stored results are written to D1. The client refreshes after tool completion and periodically refreshes while the page remains open.

The broader definitions under `src/contracts/**` are design contracts and expansion data. They are not additional registered Core Proof tools.

## Local setup

Requirements:

- Node.js 22.13.0 or newer
- npm

Install and initialize the local D1 database:

```text
npm ci --no-audit --no-fund
npm run db:migrate:local
```

No password or verifier is committed. Create a disposable local password between 12 and 160 characters, supply it to the current process as `CITYDEFENSE_SEED_PASSWORD`, and run:

```text
npm run --silent seed:password-verifier
```

Treat the generated verifier as a secret. Supply it only to the local process as `CITYDEFENSE_PLANNER_PASSWORD_VERIFIER`, remove `CITYDEFENSE_SEED_PASSWORD`, and start the app:

```text
npm run dev
```

Open `/login` and use account `DEMO-CITY`, Seat `PLANNER-01`, and the disposable local password. Do not reuse a personal or production credential.

## Test commands

Run the checked-in validation in this order; the built-route and UI checks inspect `dist`, so the build must come first:

```text
npm ci --no-audit --no-fund
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:integration
npm run build
npm run test:e2e
npm run test:ui
npx --no-install drizzle-kit check --config drizzle.config.ts
npm run db:migrate:local
npx --no-install wrangler d1 migrations list DB --local --config wrangler.jsonc
```

Release qualification also includes a tracked-tree secret/privacy scan, migration/source comparison, direct HTTP checks for every rendered static asset, and real-browser smoke checks at 1366×768 and 1920×1080. Those release checks are local evidence; they are not a substitute claim that remote CI passed.

## Security and limitations

- New and rotated verifier secrets use PBKDF2-SHA256; no password or verifier is committed.
- A narrow legacy SHA-256 compatibility path accepts only the existing disposable `PLANNER-01` row's exact lowercase 32-hex salt and lowercase `sha256:`-prefixed digest of `salt + ":" + password`, and will be retired after its verifier is rotated.
- Sessions use a hashed opaque token in an HttpOnly, SameSite=Lax cookie with a two-hour lifetime and `Secure` on HTTPS.
- Tool requests are authenticated and branch-authorized on the server. Tool visibility alone is never treated as authorization.
- The Gate 1 write is schema-constrained, rejects a mismatched `Origin` header when present, is Planner-only, is version-checked, and is idempotent by request ID.
- No production write or deployment is performed by this release integration.

The following are unsupported or explicitly not claimed as live in this release:

- native **Recently used** was observed
- Tutorial Arc Fire is live
- Avalanche is live
- the Sentinel runtime is live
- Semantic Replay is live
- Owner Branch creation is live
- fresh-thread handoff is live
- forty crises are playable
- remote CI passed

Related names may appear in design contracts, provenance, or expansion data without representing live runtime features.

## Asset provenance

The judged P0 set contains 50 accepted assets with zero missing. It combines 17 reviewed individual sprites from the Owner-provided implementation pack with 33 normalized outputs from built-in image generation. No third-party reference image, raw source board, atlas, or raw generation sheet is committed.

- [Asset provenance](docs/ASSET_PROVENANCE_P0.md)
- [Asset manifest](public/assets/p0/asset-manifest.json)
- [Machine-readable provenance](public/assets/p0/provenance.json)
- [Contact sheet](public/assets/p0/contact-sheet.png)

This release's proof UI uses accepted individual P0 assets, not the contact sheet or QA boards.

## Judge path

The public judge check after the completed proof is intentionally read-only:

1. Open the public deployment and authenticate with disposable judge credentials supplied separately.
2. On `/play`, confirm the page reports server-backed D1 state and Site Tools readiness with exactly `get_city_context` and `place_stamp_bundle` registered.
3. Invoke `get_city_context` and confirm `BRANCH-MAIN` is v1 with the existing Central Ward confirmation stamp and matching activity.
4. Perform a normal reload, invoke the read tool again, and confirm the same Branch Version and stable stamp/event IDs.

Do not perform a second production write for judging. The historical host proof already recorded the single authorized write that advanced v0 to v1 and produced the visible, reload-persistent state. Native **Recently used** is not part of the evidence.

## License

Code and Owner-authorized repository content are published under the [MIT License](LICENSE). Asset-specific handling and the declared license note are recorded in [docs/ASSET_PROVENANCE_P0.md](docs/ASSET_PROVENANCE_P0.md).
