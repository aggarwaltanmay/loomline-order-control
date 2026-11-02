# Loomline order control

A working sample of a knitwear export control room for Company A, Tiruppur.

- [Live app](https://loomline-order-control.tanmay-aggarwall.chatgpt.site)
- [Technical design](docs/TDD.pdf) (also supplied in the submission ZIP)
- [Deployment guide](deployment.md)

## What works

- Merchandiser sign-in, order setup with size quantities and a generated TNA plan, board filters, date edits with an audit trail, warning confirmation, category correction, stage movement and status export.
- Supervisor sign-in scoped to Unit 2, daily quantity, Tamil note, voice capture when supported by the browser, photo, and an IndexedDB queue that retries on reconnection.
- Buyer sign-in scoped to Company B or Company C, showing only that buyer's milestones, progress, confirmed warnings, date history and photos.
- Run-rate projection with its arithmetic visible. The three supplied orders are seeded, with explicit sample baseline rates until actual floor entries arrive.
- OpenAI note categorization and English summary when the API is available. A clearly labelled rule suggestion is used when it is unavailable or uncertain; merchandisers can correct it.

## Stack

Vinext / React UI and API routes on Cloudflare Workers; D1 for structured records; R2 for photos; IndexedDB for offline pending updates; OpenAI Responses API for note categorization. See [deployment.md](deployment.md) for local setup and demo sign-ins.

## Tests

```sh
node --test tests/*.test.mjs
TEST_BASE_URL=http://127.0.0.1:5173 node --test tests/*.test.mjs
npx tsc --noEmit
```

The integration tests create a new sample order in the local database. Run them against a disposable local preview.

## Scope

This is a reviewer demo with sample data and shared demo passwords. It is not a production identity system. Before rollout, replace demo accounts with individual identities, add account provisioning and operational controls, and validate the pilot with two seasons of data.
