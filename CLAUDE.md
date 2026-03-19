# n8n Integration: Lightspeed X-Series ↔ GoHighLevel

## Project Overview

Build a set of n8n automation workflows that create a bidirectional data bridge between Lightspeed Retail (X-Series) and GoHighLevel (GHL). These two platforms serve a tattoo and piercing studio (TRX Tattoos & Piercing, St. Louis MO) and must communicate automatically without any manual data entry.

- **n8n instance:** Self-hosted at `tn.reinventingai.com`
- **GHL Location ID:** `n3G3ccCrPjsSH9bGlfIQ`
- **GHL Account:** TRX Tattoos & Piercing — standalone account, separate from TattooNOW
- **Lightspeed base URL:** `https://trxtattoospiercings.retail.lightspeed.app`

## Architecture Principle

- **GHL owns:** Client records, appointments, deposits, follow-up sequences
- **Lightspeed owns:** In-store sales, inventory, store credit (deposit visibility at register), tip tracking
- **n8n owns:** Everything in between — it is the only thing that talks to both systems
- **Customer matching key:** Email address. Always match on email first. If no match, create.
- **Idempotency:** Every workflow that writes data must use an external reference ID to prevent double-writes on retry

## Credentials Required

### Lightspeed X-Series
- Auth method: Personal Token (for single retailer) or OAuth 2.0
- Base URL: `https://trxtattoospiercings.retail.lightspeed.app`
- API versions: v2.0 preferred, v0.9 for sale creation (still required)
- Webhook secret: for HMAC-SHA256 signature verification

### GoHighLevel
- Auth method: Private Integration Token (PIT) — NOT the regular API key
- Account: TRX Tattoos & Piercing — standalone GHL account, separate from TattooNOW
- Base URL: `https://services.leadconnectorhq.com`
- Location ID: `n3G3ccCrPjsSH9bGlfIQ`
- Scopes required: `contacts.write`, `contacts.read`, `payments.read`, `calendars.read`, `conversations.write`

## Workflows

| # | Name | Direction | Trigger | Priority |
|---|------|-----------|---------|----------|
| 1 | GHL Deposit → LS Store Credit | GHL → LS | GHL payment webhook | CRITICAL (Day 1) |
| 2 | LS Sale → GHL Contact Update | LS → GHL | LS sale.update webhook | HIGH (Day 2) |
| 3 | Cancel/No-Show → Reverse Credit | GHL → LS | GHL appointment webhook | HIGH (Day 1) |
| 4 | Appointment → Sale Attribution | GHL → LS | GHL appointment webhook | MEDIUM |
| 5 | Nightly Reconciliation | LS → GHL | Schedule 11:30 PM | MEDIUM |
| 6 | Nightly Waiver Archive | GHL → GDrive | Schedule midnight | HIGH (Day 2) |
| 7 | Low Stock SMS Alert | LS → SMS | LS product.update webhook | MEDIUM (Day 2) |

## Data Mapping Reference

### Lightspeed Sale → GHL Tags

| Lightspeed Product Category (actual names) | GHL Tag |
|--------------------------------------------|---------|
| `Tattoo Artist` | `[client] tattoo` |
| `Microblader` | `[client] tattoo` |
| `Piercing` | `[client] piercing` |
| `Piercer` | `[client] piercing` |
| `Tooth Gem` | `[client] piercing` |

### Cancel/No-Show Tags (derived from GHL calendar name)

| Scenario | Tag |
|----------|-----|
| Tattoo no-show | `[client] tattoo: no-show` |
| Tattoo late cancel (<48hrs) | `[client] tattoo: late-cancel` |
| Piercing no-show | `[client] piercing: no-show` |
| Piercing late cancel (<48hrs) | `[client] piercing: late-cancel` |

### System Tags (set automatically by workflows)

| Tag | Set By | Meaning |
|-----|--------|---------|
| `[system] lightspeed-customer` | WF2, WF5 | Customer has purchased in Lightspeed |
| `[system] vip` | WF2 | Lifetime value ≥ $500 |

### n8n Credential IDs

| Credential | n8n ID | Used By |
|-----------|--------|---------|
| Lightspeed TRX | `rwkPiSgkd7mzdn83` | All LS API calls |
| GHL TRX | `AcpfpX2vSAGlSAfK` | All GHL API calls |

### n8n Tag

All TRX workflows are tagged `TRX` (ID: `k2B6iG1Tdu1xzdHk`) for organization.

### GHL Custom Fields Needed on Contact

| Field Name | Type | Set By |
|-----------|------|--------|
| `last_lightspeed_sale_date` | Date | Workflow 2 |
| `last_lightspeed_sale_amount` | Number | Workflow 2 |
| `lifetime_value` | Number | Workflow 2 |
| `last_artist_id` | Text | Workflow 4 |
| `deposit_amount` | Number | GHL booking form |
| `jewelry_style_preference` | Multi-select | FOH on contact creation |

## Testing Protocol

For each workflow, test in this order before marking done:

1. **Unit test** — trigger with a handcrafted payload, verify each node behaves correctly
2. **Happy path** — run with real test data (use a test customer with email `test@trxtattoos.com`)
3. **Edge cases:**
   - Customer does not exist in the destination system → must be created
   - Duplicate trigger fires twice → idempotency must prevent double-write
   - Network timeout on API call → retry logic must handle gracefully
   - Missing required field in payload → error logger must catch, workflow must not crash
4. **Reversal test** (Workflow 3 only) — verify store credit balance before and after REVERSE transaction

## Deployment Notes

- Deploy to the existing n8n instance at `tn.reinventingai.com`
- Each workflow should be inactive by default — activate one at a time after testing
- Workflow 1 and Workflow 3 must be active before the deposit system goes live (Day 1)
- Workflow 2, 6, and 7 must be active before end of Day 2
- Workflow 4 and 5 can be activated on the next visit
- All workflows should have execution logging enabled (n8n Settings → Log Level: Info)
