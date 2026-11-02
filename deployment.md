# Deployment guide

Project: https://github.com/aggarwaltanmay/loomline-order-control  
Live app: https://loomline-order-control.tanmay-aggarwall.chatgpt.site

## Local run

1. Install Node.js 22.13+ and Git.
2. Clone the repository and enter it:

   ```sh
   git clone https://github.com/aggarwaltanmay/loomline-order-control.git
   cd loomline-order-control
   ```

3. Install locked dependencies: `npm ci`.
4. Optionally create an ignored `.dev.vars` file with `OPENAI_API_KEY` for AI classification. Without it, the Tamil/English rule suggestion remains functional. Do not commit the file.
5. Build once to generate the local Worker configuration: `npm run build`.
6. Apply the committed D1 migration to the local database:

   ```sh
   node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_elite_raider.sql
   ```

7. Start the app: `npm run dev`. Open the printed local URL, usually `http://127.0.0.1:5173/`. The first successful demo sign-in seeds the three orders and role accounts.
8. Run checks: `node --test tests/*.test.mjs` and `npx tsc --noEmit`. For API access tests, run `TEST_BASE_URL=http://127.0.0.1:5173 node --test tests/*.test.mjs` while the local server is up. Integration tests add a sample order, so use a disposable local database.

## Hosted deployment

The live app is a Git-backed Sites deployment. `.openai/hosting.json` binds D1 as `DB` and R2 as `BUCKET`; deployment applies the committed Drizzle migration, builds the Vinext Worker and publishes the saved version. Set `OPENAI_API_KEY` as a secret runtime environment variable in Sites. The key must belong to a funded OpenAI API project for live AI classification; a rule-based suggestion handles API failure. Site identity and source synchronization are managed by Sites. A new owner should create their own Sites project and update the opaque `project_id` in the hosting manifest through the Sites workflow.

Required environment variable names: `OPENAI_API_KEY` for live AI classification. No key is required for the rule-based fallback.

## Reviewer demo logins

All accounts use password **Demo@2026!** and contain invented sample data only.

| Role | Email | Access |
| --- | --- | --- |
| Merchandiser | `merch@loomline.demo` | All sample orders; can edit and confirm warnings |
| Unit supervisor | `floor@loomline.demo` | Unit 2 orders; can send daily updates |
| Buyer B | `buyer-b@loomline.demo` | Only Company B orders; read-only |
| Buyer C | `buyer-c@loomline.demo` | Only Company C orders; read-only |

The buyer link is the app URL with `?view=buyer`. The server scopes data to the signed-in buyer account, regardless of the link. The merchandiser screen can copy this link.

## Operational limits

This is a demo auth system with shared credentials. Replace it with individual accounts before real buyer use. Offline updates replay when the app is open and connectivity returns; closed-browser background sync is not implemented. Browser voice recognition availability varies, and text entry is always available. The status export is an Excel-compatible CSV. The site uses sample order values and baseline rates; live floor entries replace the latter per stage.
