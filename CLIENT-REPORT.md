# TRX Tattoos & Piercing — Automation Integration Report

**Project:** Lightspeed X-Series ↔ GoHighLevel Data Bridge
**Prepared for:** TRX Tattoos & Piercing, St. Louis MO
**Date:** March 22, 2026
**Platform:** n8n (self-hosted at tn.reinventingai.com)

---

## Executive Summary

We built a complete automation system that connects your two core business platforms — **Lightspeed** (your point-of-sale register) and **GoHighLevel** (your CRM for clients, appointments, and deposits) — so they talk to each other automatically with zero manual data entry.

**What this means for your day-to-day operations:**

- When a client pays a **deposit** online through GHL, store credit automatically appears at the register — and their appointment is confirmed
- When a **sale is completed** at the register, the client's profile in GHL is updated with tags (tattoo, piercing, artist name, jewelry style), dollar amounts, and a full sale note
- When a client **no-shows or cancels late**, their store credit is automatically reversed and tagged accordingly
- Every night, a **reconciliation** sweep catches anything that may have been missed during the day
- **Release/waiver forms** are archived to Google Drive nightly for Missouri's 2-year retention requirement
- **Low stock alerts** for jewelry send an automatic SMS so you never run out

The system includes **9 workflows** and **3 shared utilities**, all built with retry logic, error notifications, and safeguards against duplicate data.

---

## What Was Built

### Core Workflows

| # | Workflow | What It Does | How It's Triggered |
|---|---------|-------------|-------------------|
| 1 | **Deposit → Store Credit** | Client pays deposit in GHL → store credit appears at register + appointment auto-confirmed | Automatic (GHL payment) |
| 2 | **Sale → Client Profile Update** | Sale completed at register → GHL contact updated with tags, amounts, artist, and sale notes | Automatic (Lightspeed sale) |
| 3 | **Cancel/No-Show → Credit Reversal** | Client no-shows or cancels late → store credit reversed, contact tagged | Automatic (GHL appointment status) |
| 4 | **Appointment → Sale Attribution** | Completed appointment → matches to that day's sale and assigns correct artist | Automatic (GHL appointment) |
| 5 | **Nightly Reconciliation** | Every night at 11:30 PM → sweeps all daily sales and syncs any missed contacts to GHL | Scheduled (nightly) |
| 6 | **Nightly Waiver Archive** | Every night at midnight → exports completed consent/release forms to Google Drive | Scheduled (nightly) |
| 7 | **Low Stock SMS Alert** | Jewelry inventory drops below reorder point → SMS notification sent | Automatic (Lightspeed inventory) |

### Bonus Workflows

| Workflow | What It Does |
|---------|-------------|
| **Historical Backfill** | One-time tool to migrate existing Lightspeed customer history into GHL (for initial setup) |
| **Release Form Lookup** | Web-accessible page that displays a client's completed release form — can be embedded in GHL pages |

### Shared Utilities (used by multiple workflows)

| Utility | Purpose |
|---------|---------|
| **Customer Matcher** | Finds or creates a customer across both Lightspeed and GHL, matching by email |
| **Tag Applier** | Applies tags, updates custom fields, and adds notes to GHL contacts |
| **Error Logger** | Sends email alerts when something goes wrong (to gabe@tattoonow.com) |

---

## How the Tag System Works

Every interaction automatically tags the client's GHL profile so you can segment, filter, and build automations around these tags.

### Service Tags (set when a sale is made)

| What Happened | Tag Applied |
|--------------|------------|
| Got a tattoo | `[client] tattoo` |
| Got microblading | `[client] tattoo` |
| Got a piercing | `[client] piercing` |
| Got a tooth gem | `[client] piercing` |
| Specific artist | `[client] tattoo: Artist Name` or `[client] piercing: Piercer Name` |
| Piercing location | `[client] piercing: Nostril`, `[client] piercing: Lobe`, etc. |
| Jewelry style | `[client] jewelry: Style Name` |

### No-Show / Late Cancel Tags

| What Happened | Tag Applied |
|--------------|------------|
| Tattoo no-show | `[client] tattoo: no-show` |
| Tattoo late cancel (< 48 hrs) | `[client] tattoo: late-cancel` |
| Piercing no-show | `[client] piercing: no-show` |
| Piercing late cancel (< 48 hrs) | `[client] piercing: late-cancel` |

### System Tags

| Tag | Meaning |
|-----|---------|
| `[system] lightspeed-customer` | Has made at least one purchase at the register |
| `[system] vip` | Lifetime spending is $500 or more |

---

## Cancel & No-Show Policy (Automated)

The system enforces your cancellation policy automatically:

- **Cancel 48+ hours before appointment** → Store credit is reversed and a Stripe refund notification is sent to ops
- **Cancel less than 48 hours before OR no-show** → Store credit is forfeited (no refund), contact is tagged

This runs entirely on autopilot. No staff action needed.

---

## GHL Custom Fields (on each contact)

These fields are updated automatically by the workflows:

| Field | What It Tracks |
|-------|---------------|
| `last_lightspeed_sale_date` | Date of their most recent purchase |
| `last_lightspeed_sale_amount` | Dollar amount of their most recent purchase |
| `lifetime_value` | Total amount they've spent across all visits |
| `last_artist_id` | The artist/piercer from their most recent appointment |
| `deposit_amount` | Set by the GHL booking form when they pay |
| `jewelry_style_preference` | Set by front of house during contact creation |

---

## Safety & Reliability Features

Every workflow is built with safeguards to prevent errors and duplicates:

| Feature | What It Prevents |
|---------|-----------------|
| **Idempotency keys** | If a webhook fires twice, the same store credit won't be issued or reversed twice |
| **Retry logic** | If an API call fails due to a network hiccup, it retries up to 3 times with delays |
| **Email error alerts** | If something goes wrong, an email is sent to gabe@tattoonow.com with full details |
| **Exact email matching** | Prevents accidentally merging two different customers with similar names |
| **24-hour deduplication** | Low stock alerts won't spam you — one alert per product per 24 hours max |

---

## Deployment Plan

All workflows are built and staged — they are currently **inactive** and will be activated in phases:

### Day 1 — Deposit System Goes Live

| Workflow | Status |
|---------|--------|
| WF1 — Deposit → Store Credit | Ready to activate |
| WF3 — Cancel/No-Show → Reverse Credit | Ready to activate |

These two **must** be active before accepting deposits through GHL.

### Day 2 — Sales Sync & Compliance

| Workflow | Status |
|---------|--------|
| WF2 — Sale → Client Profile Update | Ready to activate |
| WF6 — Nightly Waiver Archive | Ready to activate (needs form IDs — see below) |
| WF7 — Low Stock SMS Alert | Ready to activate |

### Next Visit — Attribution & Reconciliation

| Workflow | Status |
|---------|--------|
| WF4 — Appointment → Sale Attribution | Needs artist mapping configured (see below) |
| WF5 — Nightly Reconciliation | Ready to activate |

---

## Items That Need Your Input

Before certain workflows can go live, we need a few pieces of information from you:

### 1. GHL Consent Form IDs (for Waiver Archive — WF6)

We need the GHL form IDs for your tattoo consent form and piercing consent form. You can find these in GHL under Sites → Forms. We'll plug them in so the nightly archive knows which submissions to export.

### 2. Artist → Employee Mapping (for Sale Attribution — WF4)

We need a list matching each GHL calendar name to the corresponding Lightspeed employee ID. For example:

| GHL Calendar Name | Lightspeed Employee |
|------------------|-------------------|
| "John's Tattoo Calendar" | (employee UUID from Lightspeed) |
| "Sarah's Piercing Calendar" | (employee UUID from Lightspeed) |

### 3. Google Drive Folder ID (for Waiver Archive — WF6)

The folder in Google Drive where archived waivers should be stored. We'll set this as an environment variable in n8n.

### 4. SMS Recipient Contact ID (for Low Stock Alerts — WF7)

The GHL contact ID for whoever should receive low-stock SMS alerts (likely the manager or owner).

---

## Testing Protocol

Before each workflow is activated, we follow this testing sequence:

1. **Unit test** — trigger with a handcrafted test payload, verify each step works
2. **Happy path** — run with real data using test customer `test@trxtattoos.com`
3. **Edge cases** — test what happens when a customer doesn't exist, a webhook fires twice, a network call fails, or a required field is missing
4. **Reversal test** (WF3 only) — verify store credit balance before and after reversal

---

## Technical Appendix

*This section is for the implementation team.*

### Architecture

```
┌──────────────┐         ┌─────────────────┐         ┌──────────────┐
│  GoHighLevel │ ◄─────► │   n8n (bridge)   │ ◄─────► │  Lightspeed  │
│   (CRM)      │         │ tn.reinventingai │         │  (POS)       │
└──────────────┘         │      .com        │         └──────────────┘
                         └────────┬─────────┘
                                  │
                         ┌────────▼─────────┐
                         │  Google Drive     │
                         │  (waiver archive) │
                         └──────────────────┘
```

- **GHL owns:** Client records, appointments, deposits, follow-up sequences
- **Lightspeed owns:** In-store sales, inventory, store credit, tip tracking
- **n8n owns:** All data movement between systems
- **Customer matching key:** Email address (exact match, case-insensitive)

### Credentials

| Credential | n8n ID | System |
|-----------|--------|--------|
| Lightspeed TRX | `rwkPiSgkd7mzdn83` | All Lightspeed API calls |
| GHL TRX | `AcpfpX2vSAGlSAfK` | All GoHighLevel API calls |

### API Endpoints

| System | Base URL |
|--------|----------|
| Lightspeed X-Series | `https://trxtattoospiercings.retail.lightspeed.app` |
| GoHighLevel | `https://services.leadconnectorhq.com` |
| GHL Location ID | `n3G3ccCrPjsSH9bGlfIQ` |

### Webhook Endpoints (on n8n)

| Workflow | Method | Path | Source |
|---------|--------|------|--------|
| WF1 | POST | `/webhook/ghl-deposit` | GHL payment webhook |
| WF2 | POST | `/webhook/ls-sale-complete` | Lightspeed sale.update webhook |
| WF3 | POST | `/webhook/ghl-appointment-cancel` | GHL appointment status webhook |
| WF4 | POST | `/webhook/ghl-appointment-complete` | GHL appointment completed webhook |
| WF7 | POST | `/webhook/ls-product-update` | Lightspeed product.update webhook |
| Release Form | GET | `/webhook/trx-release-form?contactId=` | Browser / GHL iframe |
| Backfill | GET | `/webhook/ls-backfill-test?offset=` | Manual (testing only) |

### n8n Workflow Tag

All workflows are tagged **TRX** (ID: `k2B6iG1Tdu1xzdHk`) for organization within the n8n instance.

### Sub-Workflow IDs

| Utility | n8n Workflow ID |
|---------|----------------|
| Customer Matcher | `vQc7pV2wjDImrvks` |
| Error Logger | `NjQ4osMVHKK4l1Wa` |
| Tag Applier | (referenced by name) |

### GHL Custom Fields Required

| Field Name | Type | Set By |
|-----------|------|--------|
| `last_lightspeed_sale_date` | Date | WF2, WF5 |
| `last_lightspeed_sale_amount` | Number | WF2, WF5 |
| `lifetime_value` | Number | WF2, WF5 |
| `last_artist_id` | Text | WF4 |
| `deposit_amount` | Number | GHL booking form |
| `jewelry_style_preference` | Multi-select | Front of house |

### Release Form Embed Code

To embed the release form lookup on a GHL page, add a Custom Code element with this HTML:

```html
<div id="release-form-container">
  <iframe
    id="release-form"
    style="width:100%;min-height:800px;border:none;display:none;"
    src="about:blank">
  </iframe>
</div>
<script>
  (function() {
    var params = new URLSearchParams(window.location.search);
    var contactId = params.get('contact_id') || params.get('contactId');
    if (contactId) {
      var iframe = document.getElementById('release-form');
      iframe.src = 'https://tn.reinventingai.com/webhook/trx-release-form?contactId='
        + encodeURIComponent(contactId);
      iframe.style.display = 'block';
    }
  })();
</script>
```

**Important:** The iframe `src` must be `"about:blank"`, not empty. An empty `src=""` causes the browser to reload the page inside the iframe, creating a blank page loop.

### Development History

34 commits across the project lifecycle, including:

- Initial architecture and workflow scaffolding
- Real credential integration and API endpoint corrections
- Payload parsing rewrites for actual GHL and Lightspeed webhook structures
- Product enrichment pipeline for automatic tag generation
- Appointment auto-confirmation after deposit payment
- Store credit matching improvements with fallback logic
- Release form lookup with iframe embed
- Comprehensive error handling and idempotency safeguards

### File Inventory

```
workflows/
├── 01-ghl-deposit-to-ls-store-credit.json
├── 02-ls-sale-to-ghl-contact-update.json
├── 03-cancel-noshow-reverse-credit.json
├── 04-ghl-appointment-to-ls-attribution.json
├── 05-nightly-reconciliation.json
├── 06-nightly-waiver-archive.json
├── 07-low-stock-sms-alert.json
├── backfill-ls-to-ghl.json
├── release-form-lookup.json
└── utils/
    ├── customer-matcher.json
    ├── error-logger.json
    ├── tag-applier.json
    └── release-form-embed.html
```

---

*Report generated March 22, 2026 — TattooNOW / ReinventingAI*
