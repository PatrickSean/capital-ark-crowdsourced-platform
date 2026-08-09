# Capital Ark

Open-source, non-custodial coordination software for collective political
fundraising.

A group sets a goal for a candidate, shares one link, and watches the total
build. Contributions are made **directly on the candidate's own official
processor** — WinRed, ActBlue, or Anedot. Capital Ark never processes, holds,
or forwards a dollar.

[Live site](https://capitalark.com) ·
[Privacy architecture](docs/PRIVACY-ARCHITECTURE.md) ·
[Integration status](docs/INTEGRATIONS.md) ·
[Security](SECURITY.md) ·
[Apache-2.0 license](LICENSE) ·
[Asset and trademark notice](NOTICE)

## Trust the design, verify the code

Capital Ark is open source because privacy claims should be inspectable, not
just marketing copy. The current repository has:

- no payment-processing integration, balance, card-number field, payment token,
  advertising SDK, or customer-data export pipeline;
- public progress derived from aggregate, receipt-backed records rather than
  payment-processor access;
- anonymous-by-default visitor identities and no name requirement for viewing
  or contributing;
- explicit consent before a receipt image is sent for automated checking; and
- source-level controls for receipt disposal, keyed evidence deduplication,
  hashed network addresses, URL sanitization, rate limits, and security headers.

The most useful audit starting points are
[`prisma/schema.prisma`](prisma/schema.prisma),
[`src/lib/tracking/link-builder.ts`](src/lib/tracking/link-builder.ts),
[`src/app/api/receipts/verify/route.ts`](src/app/api/receipts/verify/route.ts),
and the full [privacy architecture](docs/PRIVACY-ARCHITECTURE.md).

Open source makes the design auditable; it does **not** by itself prove which
commit, environment variables, infrastructure logs, or retention settings are
running at `capitalark.com`. That distinction is documented rather than hidden.

## Data boundary at a glance

| Event | Capital Ark receives | Another service receives |
| --- | --- | --- |
| Read a public drive | The application does not ask for a name or account. The host still handles a normal HTTP request and may maintain infrastructure logs. | Hosting/network providers handle the request under their own controls. |
| Start a contribution | An opaque visitor ID, target, intended amount, tracking tag, time, and a salted one-way network-address hash when available. The hash is cleared after 30 days. | Nothing yet. |
| Open the official processor | A minimized attribution event containing target, processor, tracking tag, optional amount, and time. Capital Ark does not save the generated URL, referrer, browser user agent, or separate visitor/pledge fields. | The candidate's processor receives the information entered there plus any prefill the visitor explicitly requested. |
| Check a receipt | After explicit consent, one cropped image is held in request memory. Capital Ark persists only limited match metadata and a keyed digest, not the raw image. | OpenAI receives the image for the one-time check with Responses application-state storage disabled; provider abuse-monitoring retention may still apply. |
| Claim an account | An email address and authentication state, only if the visitor chooses to claim one. | Supabase Auth receives account data when that optional mode is enabled. |
| Create a drive | Organizer-supplied drive, candidate, committee, goal, and official processor-link fields plus an opaque organizer ID. | Nothing is sent to a committee merely by creating a drive. |

See [Privacy architecture](docs/PRIVACY-ARCHITECTURE.md) for the exact trust
boundaries, retained fields, subprocessors, and limitations.

```bash
npm install
npm run dev
```

That's it. With no configuration the app runs in **demo mode** against a seeded
in-memory dataset, so public pages and the contribution journey are walkable
immediately. Receipt confirmation fails closed until `OPENAI_API_KEY` is set.
Open <http://localhost:3000/c/nc-hemp-industry> for the supplied NC slate.

---

## The constraint that shapes everything

The platform cannot observe whether a contribution succeeded.

I verified this against the live processors rather than assuming it. ActBlue
serves `Content-Security-Policy: frame-ancestors 'none'` plus
`X-Frame-Options: sameorigin`; WinRed serves `X-Frame-Options: SAMEORIGIN`. So
there is no iframe, and the same-origin policy means no JavaScript we write can
read or screenshot a page we don't own.

Two consequences run through the whole codebase:

**We detect the user's return, not the payment.** Tapping "Contribute" opens
the processor in a new tab; the modal parks in a waiting state and advances the
instant attention comes back. To the user this is indistinguishable from
watching the transaction, and it carries no anti-phishing or terms-of-service
risk.

**The progress bar shows its own confidence.** Confirmed progress comes only
from contributor receipts whose visible recipient, processor, amount,
completed status, and date pass the server's consistency checks. Clicked-out
but unresolved amounts remain a separate hatched segment and never count as
raised.

## Zero-signup contributing

The realistic entry point is a link in a group chat opened on a phone. Any
signup step before the first dollar is where the funnel dies, so there isn't
one.

Target pages are public and server-rendered. On the first tap of "Contribute",
`signInAnonymously()` runs in the background and the pledge attaches to a real
`auth.users` row with no PII collected. After the pledge is recorded — never
before — the success screen offers an account. Linking an email via
`updateUser()` **preserves the same user id**, so history carries over with no
migration.

Abuse control that doesn't tax the common case: anonymous sign-ins carry a
Cloudflare Turnstile token, link generation and receipt review are rate limited
per identity and IP hash, and one receipt cannot back multiple pledges.

## Auto-charge parameters are blocked

WinRed's `oc=true` and ActBlue's `express_lane=true` charge a saved payment
method the moment a link opens, with no confirmation screen. A platform that
generates links on behalf of third parties must never be able to emit these.

`FORBIDDEN_PARAMS` in `src/lib/tracking/link-builder.ts` strips them
unconditionally — including from the candidate's stored donation URL, which is
organizer-supplied and therefore untrusted. Organizers routinely paste links
copied out of campaign emails, and those carry one-click codes.

There is an end-to-end test for exactly this: paste a URL containing `oc=true`
through the organizer wizard, then generate a contribution link from the saved
drive and assert the parameter is gone.

## Stack

Next.js 16 (App Router) · React 19 · Tailwind 4 · Prisma 7 · PostgreSQL ·
optional Supabase Auth · Zod 4 · tesseract.js for in-browser OCR.

## Integration status

This is a `0.x` application, not yet a public API product. The existing
`/api/*` routes are unversioned implementation details for the first-party web
interface. Most depend on browser cookies, same-origin browser assumptions,
and in-process rate limits. They may change without notice and must not be
treated as a supported production contract.

What is supported today:

- link to public coalition and target pages;
- fork or self-host the application under Apache-2.0; and
- inspect the current route code to prototype an integration against a fork
  you control.

What is not implemented yet:

- API keys, OAuth clients, tenant scopes, or a versioned API;
- signed contribution webhooks or real-time WhatsApp delivery;
- a supported embeddable widget; or
- a service-level agreement for the internal aggregate-progress route.

The proposed privacy-preserving contract, event model, and readiness gates are
in [Integrations](docs/INTEGRATIONS.md). Please do not build a production
dependency on an internal route and assume it is stable.

## Layout

```
prisma/
  schema.prisma          Data model. Money is integer cents everywhere.
  sql/rls.sql            Row level security, run after migrating.
  migrations/            Versioned production database migrations.
  seed.ts                Upserts the audited NC slate; demo data is opt-in.
src/
  app/
    c/[slug]             Coalition dashboard
    t/[slug]             Public target page — where shared links land
    start                One-screen organizer wizard
    api/                 generate-link, pledges/confirm, progress, receipts,
                         account/claim, coalitions
  components/
    contribute/          The flow: modal state machine, return detection,
                         receipt dropzone with OCR, resume banner
    targets/             Layered progress bar, candidate card
    compliance/          Disclaimers and the versioned FEC attestation
    organizer/           Wizard and its success screen
  lib/
    tracking/            The URL parameter engine, per processor
    data/                Store interface: Prisma or in-memory demo
    compliance/          Versioned attestation text
```

## Connecting a real database

Demo mode is process-local and resets on restart. To switch to Postgres:

```bash
cp .env.example .env        # fill in DATABASE_URL and a unique IP_HASH_SALT
npm run db:migrate:deploy
npm run db:seed
```

Setting `DATABASE_URL` is what flips the app off demo mode — `src/lib/data`
is the only module that knows which backend is in use.

The production seed contains only the verified North Carolina slate. Set
`SEED_DEMO_DATA=true` only for a local development database if you also want
the fictional processor examples.

Supabase is optional. Set `NEXT_PUBLIC_AUTH_MODE=local` for the initial
DigitalOcean deployment: anonymous visitor identities and pledge progress are
persisted in PostgreSQL, while email account claiming stays hidden. Required AI
receipt checking does not require Supabase or object storage: the screenshot
stays in request memory, is sent to OpenAI only after explicit consent, and is
discarded after the check. If you later switch to
Supabase, set the mode to `supabase`, configure Auth, and then apply
`prisma/sql/rls.sql` in the Supabase SQL Editor. That SQL is Supabase-specific,
keeps browser roles read-only, and must not be run against a generic
DigitalOcean PostgreSQL database. All application writes continue through the
authorized server and Prisma; the script does not create receipt storage.

## Required receipt verification

Set the encrypted, server-only `OPENAI_API_KEY` to enable receipt-backed
confirmation. `OPENAI_RECEIPT_MODEL` defaults to `gpt-5-mini`, and
`OPENAI_RECEIPT_IMAGE_DETAIL` defaults to `high`. The feature is capability
detected at runtime. If the key or provider is unavailable, confirmation fails
closed and no contribution is added to public progress.

The endpoint accepts one PNG, JPEG, or WebP image up to 8 MB. It validates the
container signature, rate-limits by visitor and hashed IP, sends the image with
`store: false`, and requests strict structured output. The model extracts fields
without receiving the expected candidate, committee, or amount. Server code
then independently matches recipient, processor, exact amount, and a plausible
date. Ambiguous or mismatching results require a clearer or different receipt;
they never fall back to receipt-free reporting. A full match earns the label
`AI-checked receipt`, not `verified contribution`.

Capital Ark does not persist the raw screenshot on this path. It retains only
the model name, controlled reason codes, extracted amount/date, match flags, and
a keyed SHA-256 digest used to prevent the same screenshot from backing two
pledges. The short-lived evidence token is encrypted and bound to the user,
pledge, target, and amount. OpenAI Responses application-state storage is
disabled, but standard abuse-monitoring logs may still be retained by OpenAI
for up to 30 days unless the API organization has Zero Data Retention.

## DigitalOcean App Platform

The supported production shape is one Node.js 22 service plus PostgreSQL in
the same DigitalOcean region. Configure:

- build command: `npm run build`
- run command: `npm start`
- pre-deploy job: `npm run db:deploy`
- scheduled job: `npm run db:expire-pending` on `0 * * * *` (hourly)
- HTTP route: `/`
- health check: `/api/health`
- app variables: `DATABASE_URL`, `DATABASE_CA_CERT`,
  `NEXT_PUBLIC_AUTH_MODE=local`, `NEXT_PUBLIC_ENABLE_DRIVE_CREATION=true`,
  `NEXT_PUBLIC_SITE_URL=${APP_URL}`, `SEED_DEMO_DATA=false`, and a random
  encrypted `IP_HASH_SALT`
- optional encrypted runtime variables: `OPENAI_API_KEY`,
  `OPENAI_RECEIPT_MODEL=gpt-5-mini`, and
  `OPENAI_RECEIPT_IMAGE_DETAIL=high`

Public creation accepts one to twenty candidates per drive. Community-created
drives are immediately shareable and visibly labeled unverified; the feature
flag remains an emergency abuse-response kill switch.

Set every `NEXT_PUBLIC_*` variable to build-and-runtime scope. Next.js embeds
these values in the browser bundle during the build; runtime-only values will
not update the deployed interface.

For DigitalOcean Managed PostgreSQL, bind `DATABASE_CA_CERT` to the database
component's `${<database-component>.CA_CERT}` value. The Prisma runtime and
seed job use it to verify the database certificate without disabling TLS
verification.

Keep one service instance until the in-process rate limiter is replaced by a
shared store. App Platform supplies `PORT`; Next.js binds to it automatically.

## Scripts

| Command                       | What it does                                          |
| ----------------------------- | ----------------------------------------------------- |
| `npm run dev`                 | Dev server                                            |
| `npm run build`               | Production build                                      |
| `npm test`                    | Unit tests (link builder, OCR parsing)                |
| `npm run test:a11y`           | Keyboard, modal, and WCAG AA browser checks           |
| `npm run typecheck`           | `tsc --noEmit`                                        |
| `npm run db:migrate`          | Apply Prisma migrations                               |
| `npm run db:migrate:deploy`   | Apply committed migrations in production              |
| `npm run db:seed`             | Upsert the audited NC slate                           |
| `npm run db:deploy`           | Apply production migrations, then upsert the NC slate |
| `npm run db:expire-pending`   | Expire 72-hour intents and clear 30-day network hashes |
| `node scripts/walk-flow.mjs`  | Walks the whole contributor journey in a real browser |
| `node scripts/a11y-check.mjs` | Keyboard, focus trap, and reduced-motion checks       |
| `node scripts/screenshot.mjs` | Captures mobile and desktop screenshots               |

The browser scripts need a server running (`npx next start -p 3210`) and
Playwright's Chromium (`npx playwright install chromium`).

`check-hemp-links.mjs` and the legacy `verify-hemp.mjs` call the contribution
link API and therefore create pledge-intent rows. They refuse non-local app
URLs by default; use them only with a disposable staging database for a
deliberate end-to-end processor check.

## What this platform is not

Capital Ark is non-partisan software. It is not a PAC, not a political
committee, and not a fundraising agent. It does not endorse candidates, and
candidates do not pay to be listed. Progress figures are crowdsourced from
contributors and are not official fundraising totals.

There is no column anywhere in the schema for a card number, a payment token,
or a balance — the zero-custody claim is enforced by there being nothing to
custody.

## Open-source governance

- **License:** The original software is available under
  [Apache License 2.0](LICENSE), a permissive OSI-approved license with an
  explicit patent grant. The Capital Ark name and marks are not licensed for a
  fork's branding; Apache-2.0 permits only the customary use needed to describe
  the origin of the software.
- **Security:** Please follow [SECURITY.md](SECURITY.md) and do not put a
  vulnerability, secret, or real contribution receipt in a public issue.
- **Contributions:** Development setup, review expectations, and the privacy
  checklist are in [CONTRIBUTING.md](CONTRIBUTING.md).
- **Community:** Participation is governed by the
  [Code of Conduct](CODE_OF_CONDUCT.md).
- **Candidate portraits:** Sources and reuse status are recorded alongside the
  seed data in
  [`src/lib/data/campaigns/nc-hemp-photo-sources.ts`](src/lib/data/campaigns/nc-hemp-photo-sources.ts).

## Roadmap, not promises

Potential next steps are a versioned aggregate API, scoped developer
credentials, signed webhooks, an embeddable progress component, an OpenAPI
description, and deploy-to-source provenance. None is a supported feature until
its authentication, privacy review, documentation, tests, and compatibility
policy land in a release.
