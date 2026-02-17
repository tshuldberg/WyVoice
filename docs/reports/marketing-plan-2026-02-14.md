# MyVoice Marketing Plan (Skill-Driven)

Date: 2026-02-14

## Goal

Grow weekly active users and GitHub release downloads for MyVoice while funding maintenance via voluntary donations.

## Donation Model Decision

Use both.

- Primary: Buy Me a Coffee for creator profile, recurring support, and cleaner donor funnel.
- Secondary: Venmo for fast one-time donations from users who already use Venmo.
- CTA order on page: `Buy Me a Coffee` first, `Venmo` second.

## Positioning Summary

From `/Users/trey/Desktop/Apps/MyVoice/.claude/product-marketing-context.md`:

- Core promise: free, private dictation for macOS; voice stays on-device.
- Primary audience: privacy-conscious Mac users and developers.
- Main alternatives: cloud dictation tools and built-in dictation.
- Buying trigger: faster writing without cloud privacy risk or subscriptions.

## Skill-to-Work Mapping

| Skill | MyVoice use | Deliverable |
|---|---|---|
| `/marketing/product-marketing-context` | Keep audience, objections, and claims current | Updated context doc each month |
| `/marketing/copywriting` | Landing page, README, release copy | Conversion-focused copy blocks |
| `/marketing/copy-editing` | Tighten and simplify claims | Final polished page copy |
| `/marketing/launch-strategy` | Release marketing cadence | Per-release launch checklist |
| `/marketing/social-content` | Weekly posts + release threads | 4-week social calendar |
| `/marketing/content-strategy` | SEO and trust content roadmap | 60-day editorial plan |
| `/marketing/competitor-alternatives` | Comparison pages for key alternatives | 3 comparison pages |
| `/marketing/seo-audit` | Improve discoverability | SEO issue list + fixes |
| `/marketing/schema-markup` | Add software/product structured data | JSON-LD blocks |
| `/marketing/analytics-tracking` | Measure CTA and download funnel | Privacy-safe event taxonomy |
| `/marketing/ab-test-setup` | Test hero and CTA copy | 2 initial experiments |
| `/marketing/pricing-strategy` | Optimize donation framing | Donation CTA and tier strategy |

## 30/60/90 Day Execution

### Days 1-30 (Foundation)

1. Launch basic marketing page with download + dual donation CTAs.
2. Normalize copy across page + README.
3. Add analytics events: `cta_download_clicked`, `cta_donate_clicked` (property `channel=buymeacoffee|venmo`), and `outbound_github_clicked`.
4. Publish first 4 weeks of social posts (X + LinkedIn).

### Days 31-60 (Distribution)

1. Publish 3 comparison pages: `myvoice-vs-superwhisper`, `myvoice-vs-wispr-flow`, and `myvoice-vs-macos-dictation`.
2. Publish 4 educational posts: privacy-first dictation setup, offline dictation workflow, whisper.cpp local transcription explainer, and permission setup troubleshooting.
3. Add schema markup for software + FAQ.

### Days 61-90 (Optimization)

1. Run first A/B tests: hero headline variant and donate CTA copy/order variant.
2. Tune donation page based on click-to-donation conversion.
3. Build referral loop with a "Share MyVoice" section in README/landing page and user-generated setup/workflow examples.

## Channel Plan

### Owned

- GitHub repo + releases
- Website landing page
- Optional monthly email changelog (once list exists)

### Rented

- X
- LinkedIn
- Reddit communities where privacy/productivity tools are discussed

### Borrowed

- Podcast guest appearances in Mac productivity niches
- Creator reviews on YouTube
- Open-source newsletter features

## Weekly Content System

1. Monday: one practical tip post (usage or setup).
2. Wednesday: one comparison or objection-handling post.
3. Friday: one founder/dev update with progress and roadmap.
4. Release week: add launch post + short thread + follow-up clip/GIF.

## Measurement Plan

Primary KPIs:

1. GitHub release download clicks from landing page.
2. Donation CTA clicks by channel.
3. Donation conversion rate by channel.
4. Star growth per month.
5. Returning visitor rate to docs/landing page.

Initial baseline window: first 30 days after page launch.

## Risks and Guardrails

1. Do not over-claim accuracy; preserve trust.
2. Keep privacy-first stance consistent with tracking setup.
3. Avoid heavy paid acquisition until funnel conversion is stable.

## Immediate Next Tasks

1. Set real Venmo handle in landing page.
2. Publish the page.
3. Add CTA tracking to your chosen analytics stack.
4. Draft and schedule first 2 weeks of social posts.
