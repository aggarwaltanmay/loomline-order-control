# Deployment guide

Project: https://github.com/aggarwaltanmay/loomline-order-control  
Live app: https://loomline-order-control.vercel.app

## Local run

1. Install Node.js 22.13+ and Git.
2. Clone the public repository and enter it:

   ```sh
   git clone https://github.com/aggarwaltanmay/loomline-order-control.git
   cd loomline-order-control
   ```

3. Install locked dependencies: `npm ci`.
4. Create an ignored `.env.local` file with `DATABASE_URL=memory:` for a disposable local database. To use persistent data, replace that setting with a PostgreSQL connection string for a database you control. Optionally add `OPENAI_API_KEY` for live note classification. Never commit this file.
5. Run `npm run dev` and open `http://localhost:3000`. The first demo sign-in creates tables and seeds the three sample POs and role accounts.
6. Run `npm test` and `npm run build`. To include API integration tests, keep the local server running and run `TEST_BASE_URL=http://localhost:3000 npm test`. Integration tests create a sample order, so use a disposable database.

## Hosted deployment

The public GitHub `main` branch is imported as a Next.js project on Vercel. Set `DATABASE_URL` in Vercel to the project's PostgreSQL connection string (a Neon integration works), then redeploy. The app creates its tables and seeds invented reviewer data on first sign-in. Set `OPENAI_API_KEY` as an optional server-side secret for OpenAI Responses API categorization. Never put either value in Git or in a public `NEXT_PUBLIC_` variable.

Environment variable names:

- `DATABASE_URL` — required for durable production data.
- `OPENAI_API_KEY` — optional for live AI; a labelled Tamil/English rule suggestion handles missing credentials, API failure or uncertain notes.

The OpenAI project used during development still had no credits on 5 November 2026, so live model output needs retesting after funding. The fallback, original-note display and merchandiser correction remain usable.

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

This is a reviewer demo with shared credentials. Replace them with individual accounts before real buyer use. Offline updates replay when the app is open and connectivity returns; closed-browser background sync is not implemented. Browser voice recognition availability varies, and text entry is always available. Status export is an Excel-compatible CSV. Sample baseline rates are replaced by live floor entries per stage. Photos are stored in PostgreSQL as data URLs for this limited demo; move them to object storage before a real rollout.
