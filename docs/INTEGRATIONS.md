# Integrations

Capital Ark should eventually let organizations keep the experience on their
own sites while using the platform's drive, target, and progress primitives.
That can widen adoption, but only if the contract is stable, authenticated, and
more privacy-preserving than screen scraping or direct database access.

## Current status: no supported public API

The repository contains Next.js route handlers under `/api/*`, but they are
first-party implementation details for the Capital Ark web interface. They are:

- unversioned;
- authenticated with browser-session cookies where identity is required;
- designed around same-origin browser behavior, not third-party CORS clients;
- guarded by an in-process limiter sized for one service instance; and
- free to change while the application remains `0.x`.

Reading the code is encouraged. Building a production dependency on the hosted
internal routes is not supported yet.

| Capability | Current state | Supported integration? |
| --- | --- | --- |
| Link to `/c/{coalition-slug}` or `/t/{target-slug}` | Public web experience | **Yes.** Use ordinary HTTPS links. |
| Self-host or fork the application | Apache-2.0 source | **Yes.** You own compatibility and operations. |
| Read aggregate target progress | First-party `GET /api/targets/{id}/progress` exists | **No stable contract.** Prototype only against a fork you control. |
| Create a drive | User-facing form and unversioned internal route exist | **No external contract.** Use the hosted form today. |
| Start/confirm a pledge or check a receipt | Browser-session internal routes exist | **No.** These are sensitive state transitions, not integration endpoints. |
| API keys or OAuth clients | Not implemented | **No.** |
| Webhooks | Not implemented | **No.** |
| WhatsApp group automation | Not implemented; a group invite URL cannot receive messages | **No.** Official WhatsApp Business/Cloud API capabilities and group restrictions must be evaluated separately. |
| Embeddable widget | Not implemented; the current CSP denies framing | **No.** Link to a target page instead. |

The public progress route returns aggregate data today because the first-party
UI needs it. Its existence is not a promise of field names, uptime, rate limits,
deprecation notice, or future anonymous access.

## Safe options today

### Link to a public page

Use the canonical coalition or target URL. It is mobile-ready, contains the
required context and disclaimers, and keeps the contribution step on the
candidate's official processor.

### Run a fork you control

Apache-2.0 permits organizations to use, modify, and deploy the code with the
license and notice obligations described in [LICENSE](../LICENSE). A fork
should use its own branding, secrets, database, legal review, privacy policy,
subprocessor agreements, and candidate-data verification.

Do not point development scripts at `capitalark.com`, create synthetic public
activity, or use real contribution receipts as fixtures.

### Propose an integration

Open a GitHub issue describing:

- the user outcome, not just an endpoint shape;
- read versus write access;
- organization/tenant boundaries;
- minimum required fields and retention;
- expected request/event volume;
- failure, retry, and idempotency behavior; and
- whether any output could reveal political activity about a person.

Do not include production credentials, customer lists, donor data, or receipts
in an issue.

## Proposed public API principles

A future API should be a separate, versioned product surface rather than a new
name for the current routes.

### Authentication and authorization

- per-organization credentials, never shared browser cookies;
- scoped access such as `drives:read`, `drives:write`, and `progress:read`;
- explicit ownership or delegated access for every drive;
- revocation, rotation, last-used visibility, and auditable credential events;
- server-to-server credentials kept out of browser bundles; and
- no endpoint that accepts a user ID as proof of identity.

OAuth may be appropriate for user-delegated access. Server-managed API keys may
be simpler for a first read-only release. The project should choose one only
after defining tenant ownership and revocation.

### Contract and compatibility

- a versioned base path such as `/api/v1`;
- an OpenAPI description checked in with generated contract tests;
- documented errors, pagination, rate-limit headers, and idempotency keys;
- a published compatibility and deprecation window;
- request IDs safe to share with support; and
- sandbox data that cannot affect public totals or real processor traffic.

### Minimum-data resources

A sensible first release is read-only and aggregate-first:

- public drive metadata;
- public target/candidate metadata already visible on the site; and
- aggregate receipt-backed progress.

It should not expose user rows, email addresses, session IDs, IP hashes, user
agents, referrers, outbound URLs containing prefill, raw receipts, receipt
digests, extracted receipt fields, model output, attestation records, or an
individual's contribution history.

Drive creation can follow after tenant authentication, moderation, supported-
processor validation, abuse controls, and idempotent multi-target transactions
are part of the public contract.

## Proposed webhooks

Webhooks are preferable to polling for server-owned integrations, but an event
about a political contribution is sensitive even without a name. The default
event should therefore be aggregate:

```json
{
  "id": "evt_opaque",
  "type": "progress.updated",
  "occurred_at": "2026-08-09T20:00:00Z",
  "data": {
    "drive_id": "drv_opaque",
    "target_id": "tgt_opaque",
    "raised_cents": 125000,
    "goal_cents": 500000,
    "donor_count": 4
  }
}
```

This is a design example, not an implemented payload or compatibility promise.
An individual receipt-checked event should be a separately approved scope and
remain anonymous by default. A webhook must never contain a receipt image,
receipt hash, extracted identity, email, network hash, browser fingerprint,
model text, or payment credential.

Production delivery needs:

- HTTPS-only endpoints;
- an HMAC signature over the exact body plus timestamp;
- timestamp tolerance and event-ID replay protection;
- bounded exponential retries and a disable/dead-letter policy;
- delivery logs with secrets and sensitive payloads redacted;
- endpoint verification and secret rotation; and
- an operator-visible test event.

Third-party messaging products should consume a signed Capital Ark event in a
customer-controlled service and then call the messaging provider's supported
business API. A WhatsApp group invite URL is for joining a group; it is not a
webhook destination and cannot authorize Capital Ark to post messages.

## Proposed embeddable experience

A first-party web component can keep an organization's users on its site while
avoiding direct API handling in the browser. Before shipping, it needs:

- an explicit allowlist of embedding origins rather than weakening
  `frame-ancestors` globally;
- signed, short-lived configuration that identifies only a public drive;
- accessible keyboard, screen-reader, reduced-motion, and responsive behavior;
- a clear transition to the official processor and return-to-confirm flow;
- isolation from the host page's cookies and scripts; and
- no cross-site user tracking.

A read-only progress component is lower risk than an embedded receipt flow and
should come first.

## Readiness gates

An API, webhook, or widget is not supported until all applicable boxes are
complete:

- [ ] named owner and versioning/deprecation policy;
- [ ] authentication, authorization, tenant-isolation, and revocation tests;
- [ ] privacy data-flow review and updated subprocessor/retention disclosures;
- [ ] OpenAPI or equivalent machine-readable contract;
- [ ] shared rate limiting and abuse monitoring with no receipt-content logs;
- [ ] idempotency and replay tests for writes/events;
- [ ] synthetic sandbox and end-to-end test suite;
- [ ] accessibility review for embedded UI;
- [ ] key/secret rotation and incident-response runbook;
- [ ] load, failure, retry, and backwards-compatibility tests; and
- [ ] a release that explicitly declares the surface supported.

## Open source and official-service policy

Apache-2.0 is a genuine open-source license and therefore does not restrict a
fork to particular industries or business models. A custom "no data farming"
license restriction would make the project source-available rather than
open-source and would create adoption uncertainty.

The official hosted service should instead earn trust through data-minimizing
architecture, enforceable integration terms, narrow scopes, transparent
subprocessors and retention, auditable code, and eventually deploy-to-source
provenance. Fork operators are responsible for disclosing and governing their
own behavior.
