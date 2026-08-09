# Contributing to Capital Ark

Thank you for helping make political fundraising coordination more transparent
and privacy-preserving. Small, focused pull requests are easiest to review.

By submitting a contribution, you agree that it may be distributed under the
repository's [Apache License 2.0](LICENSE), as described in section 5 of that
license. You must have the right to submit the code, data, copy, or media you
contribute.

## Before opening a pull request

- Search existing issues and pull requests for overlapping work.
- Discuss a large feature or data-model change before implementing it.
- Report vulnerabilities through [SECURITY.md](SECURITY.md), never through a
  public feature issue.
- Do not include secrets, production exports, real receipts, donor identities,
  or screenshots containing personal information.
- Do not imply a candidate, committee, processor, or government agency has
  endorsed the project.

## Local setup

Requirements: Node.js 22 and npm.

```bash
npm install
npm run dev
```

The zero-configuration app uses seeded, in-memory demo data. Copy
`.env.example` to `.env` only when you need Postgres, Supabase, Turnstile, or
receipt-model testing. Never commit an `.env` file.

For persistent local data:

```bash
npm run db:migrate:deploy
npm run db:seed
```

See [README.md](README.md) for deployment-specific configuration.

## Required checks

Run the checks relevant to your change and, before requesting review, the full
quality gate:

```bash
npm test
npm run lint
npm run typecheck -- --incremental false
npx prisma validate
npm run build
```

For interaction or accessibility changes, also run a production server and:

```bash
npm run test:a11y
```

Add regression coverage for behavior changes. Use synthetic processor URLs and
fabricated receipt images in tests; never make a real contribution to verify a
code path.

## Privacy and security checklist

Every feature that reads, stores, logs, exports, displays, or sends user data
must answer these questions in its pull-request description:

1. What is the minimum data required?
2. Is collection obvious and, where appropriate, consented to before it occurs?
3. Which trust boundary receives the data?
4. Where is it persisted, logged, cached, or included in a URL?
5. How long is it needed, and how is deletion or expiry handled?
6. Can the same outcome use an opaque identifier or aggregate instead?
7. Could a small-group activity feed re-identify a contributor?
8. Does failure stay closed without manufacturing public progress?

Update [Privacy architecture](docs/PRIVACY-ARCHITECTURE.md) when a data flow or
subprocessor changes.

## API and integration changes

Current `/api/*` routes are first-party, unversioned implementation details.
Do not present one as a supported public API merely by documenting its current
payload. A public integration requires the readiness gates in
[Integrations](docs/INTEGRATIONS.md), including authentication, authorization,
versioning, an OpenAPI contract, idempotency, abuse controls, and privacy tests.

Webhook proposals must use signed delivery, replay protection, opaque event
identifiers, bounded retries, and an aggregate/minimum-data payload. Receipt
images, model output, IP hashes, user agents, session IDs, and donor identity
must not appear in a webhook by default.

## Candidate and committee data

Use authoritative public sources. Record the source URL, retrieval date, and
reuse terms for photographs or other media. Never guess a donation URL; a
missing link is safer than routing a supporter to the wrong recipient. Test
that each URL belongs to a supported official processor and that unsafe
automatic-charge or personal-prefill parameters are removed.

Political-law copy is a product safeguard, not legal advice. Cite the relevant
authority and have jurisdiction-specific changes reviewed by qualified counsel
before relying on them in production.

## Pull-request expectations

- Explain the user problem and the smallest complete solution.
- Call out migrations, environment variables, data-retention changes, new
  vendors, and backwards-compatibility risk.
- Include screenshots for visual changes at mobile and desktop sizes.
- Keep generated files and unrelated formatting out of the change.
- Preserve existing user work in a dirty worktree.

Please follow the [Code of Conduct](CODE_OF_CONDUCT.md) in all project spaces.
