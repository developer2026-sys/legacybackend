# Lasting Legacy Cleaners backend

## Tenancy model

The portal now uses a server-enforced account boundary:

`Super Admin → Client Account (optionally parented) → Locations → Requests`

Partner portal users are account members with an `accountRole` of `client_admin`
or `family_advisor`. New restoration and monument-setting requests, uploaded
photos/documents, settings, and team memberships carry `clientAccountId`.
Authenticated partner reads use the account ID from the verified JWT/database
membership, never a client ID supplied by the browser.

On startup, `migrations/ensureTenancy.js` adds missing tenancy columns and
backfills legacy partner data into separate client accounts without dropping
records. Existing `.env` files are intentionally not included in source
archives; copy `.env.example` to `.env` and supply secrets through deployment
secrets.

## Core lifecycle records

`migrations/ensureCoreDataObjects.js` adds the explicit approval-event,
payment, work-order, schedule, attachment metadata, permissions, and invoice
pricing-snapshot fields used by the canonical request lifecycle. It is
idempotent and backfills legacy approval/payment/monument-setting records when
they can be traced to `memorial_requests.id`.