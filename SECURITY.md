# Security policy

Capital Ark handles political-contribution metadata and temporary receipt
images. Treat every security report as potentially privacy-sensitive.

## Supported versions

Capital Ark is currently a `0.x` project without long-term-support releases.
Security fixes are applied to the latest commit on `main`. Older commits,
forks, and independently hosted deployments are not maintained by the Capital
Ark maintainers unless explicitly stated in a release.

## Report a vulnerability privately

1. If the repository Security tab offers **Report a vulnerability**, use it to
   open a private GitHub security report.
2. If private reporting is unavailable, contact the repository owner through a
   private method listed on the [maintainer's GitHub profile](https://github.com/PatrickSean)
   and ask for a private reporting channel before sharing details.
3. If no private method is available, open a public issue containing only the
   words "Private security contact requested." Do not include the
   vulnerability, logs, screenshots, credentials, contributor information, or
   reproduction steps.

Include, through the private channel:

- the affected commit or deployment;
- impact and prerequisites;
- minimal reproduction steps using synthetic data;
- whether the issue may expose receipt content, identity, contribution
  metadata, credentials, or funds; and
- a safe way to contact you.

There is no guaranteed response-time SLA yet. Maintainers will nevertheless
prioritize credible reports involving authentication, receipt images,
cross-user access, remote execution, secrets, or contribution-total integrity.

## Please do not

- upload a real contribution receipt, donor identity, payment detail, API key,
  database URL, session cookie, or production record to an issue or pull
  request;
- test against `capitalark.com` in a way that creates fake public activity,
  changes data, sends traffic to a campaign processor, or degrades the service;
- access, retain, or share another person's data after demonstrating an issue;
  or
- use social engineering, denial of service, physical attacks, or third-party
  account compromise.

Use a local deployment and fabricated fixtures whenever possible. The scripts
named `check-hemp-links.mjs` and `verify-hemp.mjs` can create pledge-intent
records and must not be pointed at production casually.

## High-risk boundaries to review

- visitor-session ownership in `src/lib/auth/`;
- receipt upload, model calls, and evidence tokens in `src/lib/receipts/` and
  `src/app/api/receipts/`;
- pledge confirmation and aggregate-progress integrity;
- outbound processor URL validation and automatic-charge parameter stripping;
- secrets, database TLS, row-level security, and deployment configuration; and
- accidental disclosure through logs, errors, social cards, activity feeds, or
  new integrations.

## Good-faith research

The maintainers intend to work constructively with researchers who follow this
policy, minimize access, avoid user harm, and give reasonable time for a fix
before disclosure. This statement is not a waiver of applicable law or a
promise on behalf of third-party processors or infrastructure providers.
