# CityDefense: Fork the Future

**A WebMCP city-defense prototype where temporary agent threads act on durable, human-visible application state.**

> **The chat is temporary. The city remembers.**

[Open the live demo](https://citydefense-fork-the-future.suguri-a.chatgpt.site) · [MIT License](LICENSE)

## What CityDefense demonstrates

CityDefense explores a practical problem in human–agent collaboration: an AI chat may be temporary, but the work it performs belongs to a long-lived web application.

The submission build demonstrates a focused end-to-end WebMCP flow:

- an authenticated agent reads the same live city branch the human is viewing;
- the page exposes typed, schema-validated Site Tools instead of requiring pixel-driven navigation;
- a bounded agent action visibly updates the normal web interface;
- the server issues stable event and stamp identifiers;
- the result is stored in Cloudflare D1;
- a normal reload restores the same state.

## Why WebMCP

A visual interface is designed for people. An agent using only screenshots must infer which object, button, or state a visual element represents.

WebMCP gives the page a semantic interface. CityDefense exposes stable city identifiers, explicit input schemas, and compact structured results while keeping the normal human interface visible and authoritative.

The agent and the human therefore work against the same authenticated Seat, Branch, server rules, and persistent state.

## Live Site Tools

| Tool | Purpose | State change |
| --- | --- | --- |
| `get_city_context` | Reads the authenticated Seat, active Branch Version, Central Ward state, and recent activity. | No |
| `place_stamp_bundle` | Places one schema-constrained `STAMP_CONFIRM` on `district:CENTRAL_WARD` using an expected Branch Version and idempotency request ID. | Yes |

Both tools are registered from the authenticated top-level `/play` page with `document.modelContext.registerTool(...)`. No iframe is used.

## Verified WebMCP flow

The flow was exercised in the Codex in-app browser:

1. the host discovered exactly `get_city_context` and `place_stamp_bundle`;
2. `get_city_context` read `BRANCH-MAIN` without mutation;
3. one authorized `place_stamp_bundle` call created a visible confirmation stamp and activity entry;
4. the Branch advanced from `v0` to `v1`;
5. the server returned stable Stamp and Event IDs with `persisted=true`;
6. a normal reload restored the same D1-backed state.

Detailed proof notes are available in [Verified WebMCP Proof](docs/VERIFIED_WEBMCP_PROOF.md).

## Try the live demo

Judge credentials are supplied privately in the Devpost testing instructions.

1. Open the [live site](https://citydefense-fork-the-future.suguri-a.chatgpt.site) in the ChatGPT or Codex in-app browser.
2. Sign in once with the supplied `DEMO-CITY` / `PLANNER-01` credentials.
3. If the browser does not transition automatically, wait briefly and open `/play` in the same tab.
4. Confirm that the page reports `SERVER_BACKED_D1` and Site Tools `READY`.
5. Call `get_city_context`.
6. Reload normally and call the read tool again to confirm persistence.

The fastest judge path is read-only. The bounded write tool remains registered and server-authorized, but the recorded demo already contains the verified write flow.

## Architecture

```text
Human UI ───────────────┐
                       │
WebMCP Site Tools ─────┼──> Same-origin query / command routes
                       │                 │
                       └─────────────────┼──> Authentication
                                         ├──> Role and Branch authorization
                                         ├──> Schema validation
                                         ├──> Optimistic version checks
                                         ├──> Request idempotency
                                         └──> Cloudflare D1
                                                        │
                                                        └──> Visible UI refresh and reload
```

The server—not the tool description—is the authority for identity, target, branch, version, and persistence.

## Run locally

Requirements:

- Node.js 22.13.0 or newer
- npm

```bash
npm ci --no-audit --no-fund
npm run db:migrate:local
```

Create a disposable local password, generate a PBKDF2 verifier, and provide the verifier only through your local environment:

```bash
CITYDEFENSE_SEED_PASSWORD="<your disposable password>" \
  npm run --silent seed:password-verifier
```

Set the generated value as `CITYDEFENSE_PLANNER_PASSWORD_VERIFIER`, remove the plaintext seed password from the environment, and run:

```bash
npm run dev
```

Open `/login` with account `DEMO-CITY` and Seat `PLANNER-01`.

## Test

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:integration
npm run build
npm run test:e2e
npm run test:ui
npx --no-install drizzle-kit check --config drizzle.config.ts
```

## Submission scope and next steps

The submission build focuses on the durable WebMCP coordination layer. The broader CityDefense design extends this foundation with crisis forecasting, persistent Sentinel and Planner roles, structured city signals, semantic replay, owner-controlled branching, transport systems, and a data-driven crisis catalog.

Those broader systems are documented development directions rather than claims about the current live build.

## Security and assets

- Passwords, verifier values, cookies, and deployment secrets are not committed.
- Tool calls are authenticated and authorized again on the server.
- Writes are schema-constrained, version-checked, and idempotent.
- The repository includes 50 accepted P0 visual assets with machine-readable provenance.
- No third-party game assets or raw reference boards are committed.

See [Asset provenance](docs/ASSET_PROVENANCE_P0.md) and [Security notes](docs/SECURITY_NOTES.md).

## License

Code and Owner-authorized repository content are released under the [MIT License](LICENSE).
