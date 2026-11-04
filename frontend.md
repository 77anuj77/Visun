# Visun — Frontend Design & Implementation Specification

**Document:** `frontend.md`  
**Product:** Visun — *Talk. Manage. Execute.*  
**Version:** 1.2 — implemented frontend (PayPal AI Hackathon MVP)  
**Updated:** 4 November 2026  
**Primary reference:** https://updraft.modulify.website/  
**Product source:** `PRD.md`

> **Implementation status:** The frontend described here is built in `frontend/` with Next.js 16, React 19, TypeScript strict, Tailwind CSS 4, `motion`, `lucide-react`, `date-fns`, and `recharts`. It hydrates from the FastAPI backend (`/api/backend/bootstrap` through a same-origin Next rewrite) and falls back to a clearly labelled local snapshot when the API is unreachable. The design system and UI kit are in-repo rather than shadcn, and server state uses a typed `fetch` client plus a React context store rather than TanStack Query. Sections below record the implemented behaviour; real provider OAuth and Gemini Live transport remain unimplemented, while Clerk sign-in/sign-up is wired conditionally on `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`.

> **Design directive:** Borrow Updraft's expressive editorial *language*, not its brand, content, photography, or exact page composition. Build an original, responsive, accessible and trustworthy financial workspace for freelancers.

---

## 1. Reference analysis — Updraft

### 1.1 Patterns observable on the live site

The accessible Updraft site has the following distinct information and interaction patterns:

| Observed reference pattern | Source evidence | Visun adaptation |
|---|---|---|
| Editorial / newspaper identity | Navigation is also presented as **“The Updraft Times”**, with section titles and page markers | A publication-like landing page and section-index navigation |
| Oversized typographic hero | “Scale your brand on social media” headline with short supporting copy and a clear CTA | Confident headline: **“Your freelance business, finally in sync.”** |
| Numbered narrative sections | `[01] The editorial`, `[02] Services`, `[03] How it works`, etc. | Numbered *Why Visun*, *Meet your agent*, *How it works*, *Proof of control* sections |
| Interactive thematic feature tiles | “Forecast Board” with six service tiles and hover/tap details | Feature tiles for Voice, Scope, Payments, Deadlines, Reports, and Leads |
| Multi-stage visual storytelling | “From hunch to hit”: Brief → Shoot → Post → Read results | Scope workflow: Message → Detect → Approve → Get paid |
| Moving/scrolling collections | Work wall and culture/trend ticker; descriptions mention hover-to-pause | Light motion and an interactive product-activity strip; always offer reduced motion |
| Platform-based interactive demo | “Platform playground” allows platform selection | Demo source tabs: Telegram, Discord, Uploaded chat; show corresponding analysis |
| Editorial framing with human copy | Small section markers, memorable headings, short punchy prose | Direct freelance-focused copy without marketing exaggeration |

**Verification boundary:** The reference was inspected through accessible web page content, not a pixel-accurate browser screenshot or computed CSS. Exact fonts, hex colors, spacing dimensions, breakpoint values and easing curves **could not be verified**. All numerical design tokens below are **original Visun recommendations**, not measurements copied from Updraft.

**Reference source:** https://updraft.modulify.website/

### 1.2 What to adopt vs. avoid

**Adopt:** editorial typography, numbered visual chapters, visual hierarchy, large whitespace, strong CTAs, thoughtfully staged product explanations, tactile hover/focus states, and contextual illustrations or interface previews.

**Avoid:** overly playful financial controls, long animation sequences inside operational screens, misleading counters, heavy photo walls in the dashboard, hidden navigation, hover-only critical information, and styling that obscures payment state.

**Design split:** **Marketing = expressive editorial**, **Authenticated application = calm operational clarity**, **Voice agent = friendly and transparent**. These must share one visual identity.

---

## 2. Product design principles

1. **Clarity over decoration:** Amounts, deadlines, client names, consent and statuses are instantly scannable.
2. **Show evidence:** Every AI claim about money, deadlines, or client requests can expand to its underlying source.
3. **Actions are inspectable:** Users can see what the agent will do, to whom, with what data, and whether it succeeded.
4. **Voice and chat are equal:** Spoken and typed interactions appear in one persistent conversation timeline.
5. **Explicit authorization:** Sending emails, issuing invoices, changing scope, editing calendars or initiating payments requires the right user confirmation and API authorization.
6. **Native responsiveness:** Desktop-first productivity; tablet and phone retain all important capabilities.
7. **Accessibility:** Keyboard, screen reader, captions and reduced motion are first-class features.
8. **No pretend results:** Never render a mock transaction or simulated send as “Paid”, “Sent” or “Completed” without a clearly visible demo label.

---

## 3. Visual identity & design tokens (proposed, not extracted)

### 3.1 Brand direction

**Brand adjective set:** editorial, intelligent, bold, warm, tactile, premium, transparent, precise.

**Approved visual reference:** the five overlapping rounded cards supplied by the user (3 Nov 2026). The visual identity is built around **electric orange, near-black, soft yellow, warm stone, and off-white**. Use large restrained areas of white/stone, dark typography, orange for high-priority interactive moments, and yellow for secondary emphasis. The slight cyan accent visible in the image is not part of the five-color core palette; reserve blue/cyan for accessibility or data visualization only when needed.

### 3.2 Color system — user-selected palette

These hex values are **approximate visual matches** to the supplied reference image, not a calibrated extraction or official brand tokens. Use semantic CSS variables instead of hardcoding values in components.

| Reference swatch | Approx. hex | Role |
|---|---|---|
| Vivid orange | `#FF5A00` | Primary brand, active controls, voice activation, key CTAs |
| Near-black | `#1D1D1D` | Primary text, navigation, dark cards |
| Soft yellow | `#FFE17B` | Highlight panels, AI insights, secondary emphasis |
| Warm stone | `#E9E6DF` | Muted cards, sidebar surfaces, subtle sections |
| Off-white | `#F8F8F6` | Main page background, light cards |

#### Semantic tokens

| Token | Light | Dark | Usage |
|---|---|---|---|
| `--background` | `#F8F8F6` | `#171717` | Page canvas |
| `--surface` | `#FFFFFF` | `#242424` | Cards, sheets, popovers |
| `--surface-muted` | `#E9E6DF` | `#30302E` | Sidebars, alternate panels |
| `--foreground` | `#1D1D1D` | `#F8F8F6` | Primary text |
| `--muted-foreground` | `#64615C` | `#BDB9B2` | Secondary copy |
| `--border` | `#D7D3CB` | `#44423E` | Dividers, outlines |
| `--primary` | `#FF5A00` | `#FF7330` | Brand / primary actions |
| `--primary-foreground` | `#1D1D1D` | `#1D1D1D` | Accessible text on orange |
| `--accent` | `#FFE17B` | `#FFE17B` | AI insight surfaces, secondary highlights |
| `--accent-foreground` | `#1D1D1D` | `#1D1D1D` | Text on yellow |
| `--success` | `#237A53` | `#79D5A7` | Verified success (semantic exception) |
| `--warning` | `#986000` | `#FFE17B` | Pending approval / attention |
| `--danger` | `#B64038` | `#FF968B` | Failure / destructive action |
| `--focus-ring` | `#236BB2` | `#A6D0FF` | Accessible keyboard focus |

**Usage ratio guideline:** approximately 60% off-white, 20% warm stone/white surfaces, 12% near-black, 6% orange, 2% yellow. This is a design starting point, not a strict measurement.

**UI mapping:**
- **Marketing hero:** off-white canvas, near-black headline, orange primary CTA, layered orange/black/yellow/stone/white rounded-card illustration.
- **Workspace shell:** off-white main area, stone sidebar, black labels; orange only for active navigation and primary actions.
- **Voice assistant:** orange active microphone/ring, yellow contextual insight cards, dark transcript text, clear recording/processing states.
- **Payments:** near-black amounts, orange actionable payment controls; keep paid/pending/failed statuses semantically distinct with text and icons.
- **Reports and scope detection:** yellow highlights for AI-suggested changes, warm-stone evidence panels, orange approval CTA.
- **Dark mode:** dark charcoal surfaces, warm-white text, orange actions, sparing yellow accents; never use yellow body text on white.

**Accessibility rules:** Check WCAG contrast for each text/background pair. Use dark text on bright orange and yellow; do not assume white text on orange passes. Never convey financial status through color alone. Avoid overusing orange as a warning/error signal because it is also the brand color.

### 3.3 Typography

- Display and editorial headings: `Instrument Serif` (or `Georgia` fallback), **only where expressive headings help**.
- Interface, body and forms: `Inter` (fallback: `system-ui`, sans-serif).
- Numeric totals: Inter with `font-variant-numeric: tabular-nums`.
- Optional mono utility labels: `IBM Plex Mono` (fallback `monospace`), used lightly for timestamps and `01 / 06` section markers.
- H1 marketing: `clamp(3.25rem, 6vw, 6.5rem)`, tight leading (`0.98–1.05`).
- H1 in app: 30–36px, sans-serif, calm.
- H2 section: `clamp(2.2rem, 4vw, 4.2rem)`.
- Standard body: 15–16px, line height 1.5–1.65.
- Small labels: 12–13px minimum for essential information, never rely on tiny ultra-light text.

**Type personality:** Use serif for storytelling and editorial emphasis; sans for transactional content. Do not put invoice values or status controls in decorative serif.

### 3.4 Layout, spacing and shape

- Spacing scale: `4, 8, 12, 16, 24, 32, 48, 64, 96px`.
- Marketing max-width: `1320px`; comfortable content gutters `24px` desktop, `16px` mobile.
- Application shell: sidebar `248px` expanded; optional collapsible `72px` rail; main content max-width `1480px`.
- Dashboard cards: radius `16–24px`, softly raised neumorphic surfaces; use clear separation and avoid heavy outlines except where needed for accessibility.
- Inputs/buttons: radius `12–16px`, with inset fields and softly raised buttons; pill shapes reserved for status chips or voice controls.
- Minimum interactive target size: `44 × 44px` where feasible.
- Grid: desktop 12 columns, tablet 8, mobile 4.
- Dividers: subtle thin strokes to preserve editorial rhythm.

### 3.5 Neumorphic design system — REQUIRED (user-selected)

**Reference:** [Neumorphism.io](https://neumorphism.io/#e0e0e0). Adopt the *soft UI / neumorphism* principle of raised and inset surfaces created from paired directional light/dark shadows, rounded corners, and consistent surface color. The website's `#e0e0e0` is an **example generator background, not a Visun palette replacement**. Preserve **exactly** the existing five approved core palette swatches: `#FF5A00`, `#1D1D1D`, `#FFE17B`, `#E9E6DF`, and `#F8F8F6` (and preserve existing semantic status/accessibility exceptions). **Do not replace the background with `#e0e0e0`; do not introduce a new brand color.**

**Visual direction:** **Editorial + warm neumorphism**, not a flat Material dashboard and not full glassmorphism. Use a warm off-white/stone canvas, restrained orange/yellow highlights, strong black type, and tactile components. Use soft highlights and shadows on **neutral** surfaces; keep brand colored call-to-actions distinct. Avoid giving every nested element a shadow: use meaningful elevation hierarchy.

#### Surface elevation rules

| Level | Appearance | Use |
|---|---|---|
| `flat` | Base warm surface with no elevation | Page canvas, dense tables, long transcripts, content regions |
| `raised-sm` | Subtle twin shadows, soft convex appearance | Small buttons, filter chips, icon controls |
| `raised-md` | Soft twin shadows, `16–24px` radius | Dashboard stats, project cards, sidebar sections |
| `raised-lg` | Stronger yet diffused twin shadows | Voice orb, highlighted primary workspace tile |
| `inset` | Two inset shadows create a gently recessed well | Search, composer, text inputs, filter controls, tool panes |
| `pressed` | Inset transition on press/selected | Toggle, segmented control, active tactile navigation |
| `overlay` | Clear border/contrast and separate elevation | Modal, action approval, dropdown, toast; must be visually obvious |

**Shadow rules:** Use a brighter top-left highlight and darker bottom-right shadow; match shadow intensity to the underlying **neutral surface**. Example CSS below uses semi-transparent black/white rather than **new brand colors**. Use less elevation on mobile and dense data views. In dark mode use subdued highlights and contrast outlines rather than bright white glowing shadows. Hover slightly elevates; active/pressed gently insets; focus uses the existing explicit focus-ring token, not shadow alone.

#### Implementation tokens (Tailwind/CSS)

Add these as semantic utilities in the frontend global stylesheet or design-system layer. They are starting values to tune visually, **not color palette changes**:

```css
:root {
  --neu-canvas: #F8F8F6;
  --neu-stone: #E9E6DF;
  --neu-shadow-dark: rgba(28, 25, 20, 0.15);
  --neu-shadow-light: rgba(255, 255, 255, 0.95);
  --neu-raised-sm: 4px 4px 9px var(--neu-shadow-dark),
                    -4px -4px 9px var(--neu-shadow-light);
  --neu-raised-md: 8px 8px 18px var(--neu-shadow-dark),
                    -8px -8px 18px var(--neu-shadow-light);
  --neu-raised-lg: 12px 12px 26px var(--neu-shadow-dark),
                    -12px -12px 26px var(--neu-shadow-light);
  --neu-inset: inset 4px 4px 9px var(--neu-shadow-dark),
               inset -4px -4px 9px var(--neu-shadow-light);
}

.neu-raised-sm { background: var(--neu-canvas); box-shadow: var(--neu-raised-sm); }
.neu-raised-md { background: var(--neu-canvas); box-shadow: var(--neu-raised-md); }
.neu-raised-lg { background: var(--neu-canvas); box-shadow: var(--neu-raised-lg); }
.neu-inset { background: var(--neu-canvas); box-shadow: var(--neu-inset); }
.neu-pressed { background: var(--neu-canvas); box-shadow: var(--neu-inset); }

/* Semantic state and keyboard focus must remain visible without relying on depth. */
.neu-control:focus-visible { outline: 3px solid var(--focus-ring); outline-offset: 3px; }

/* Limit shadows in dense views or for users requesting less visual motion. */
@media (max-width: 640px) {
  .neu-raised-lg { box-shadow: var(--neu-raised-md); }
}
```

For panels using `#E9E6DF`, create a surface-aware `neu-stone` utility with the same two-direction shadow principle and tuned opacity; don't place an off-white raised utility on a stone panel without checking the visual transition. Prefer design tokens via Tailwind utilities (`shadow-neu-sm`, `shadow-neu-md`, `shadow-neu-inset`) or reusable `NeuSurface` and `NeuButton` components. **Do not introduce a heavyweight neumorphism library** when these small reusable utilities plus existing shadcn/ui components suffice.

#### Component treatment

- **App shell and sidebar:** Off-white `#F8F8F6` canvas; warm-stone `#E9E6DF` sidebar; raised navigation tile for the current module with strong text/icon indicator (not depth alone).
- **Dashboard stat cards:** Raised-medium, radius 20px, roomy padding; financial numbers remain high contrast, selectable and legible.
- **Buttons:** Neutral actions gently raised, pressed on activation; orange `#FF5A00` primary buttons retain a solid saturated fill plus controlled elevation. Disable state has explicit text/style cues.
- **Inputs and chat composer:** Inset field with a visible label and subtle focus outline; don't bury the input border or placeholder.
- **Voice agent:** Large softly raised circular microphone/orb; orange active accent; inset transcript well; waveform only when actually active; show listening/processing/speaking in text.
- **Conversation history:** Mostly flat to preserve long-form readability; raised session selector, subtle inset search; voice transcript and typed chat share the same message feed.
- **Payment and approval actions:** Clear borders/contrast, explicit approval controls and verification states; don't rely on tactile shadows to denote payment success.
- **Calendar, lead lists, tables:** Keep dense rows mostly flat with clear dividers, hover backgrounds and semantic badges. Apply neumorphism to containers and controls, **not** every cell.
- **Landing page:** Retain the editorial Updraft-inspired composition; use layered raised/inset geometric cards and the existing orange/black/yellow/stone/white palette. Avoid making the page look like an old-fashioned skeuomorphic control panel.
- **Dialogs, sheets, menus:** High separation and accessible boundaries; elevation enhances, but does not replace, hierarchy and focus management.

#### Accessibility and performance guardrails

1. Keep text/background WCAG contrast appropriate for the content; shadows are decoration, never a substitute for contrast or borders where needed.
2. Focus-visible ring, keyboard traversal, screen reader labels, and `44px` practical touch targets remain required.
3. Do not differentiate `Paid`, `Pending`, `Failed`, or `Needs approval` using only neumorphic depth, color, or animation.
4. Shadow transitions should animate only `transform`/opacity when possible. Avoid long animated multi-layer box-shadow on large surfaces, especially on mobile.
5. Respect `prefers-reduced-motion`; use reduced motion and minimal animation for the voice orb and dashboard.
6. Ensure nested raised/inset UI does not cause an ambiguous hierarchy; one primary elevation per card is usually enough.
7. Informs implementation of every product screen; do not apply styling only to the marketing page.

### 3.6 Motion

- Hover transitions: 150–220ms.
- Panel/dialog entrance: 180–280ms.
- Marketing reveal: subtle fade/translate, not critical to comprehension.
- Voice waveform: animated only while actual audio activity is present.
- Streaming transcript: update without auto-scrolling if user has scrolled away.
- Respect `prefers-reduced-motion` and offer static alternatives to marquees and parallax.
- Avoid scroll-jacking, forced autoplay audio, and motion that blocks work.

---

## 4. Information architecture

### 4.1 Public routes

| Route | Purpose | Status |
|---|---|---|
| `/` | Editorial product landing page | Implemented |
| `/features` | Detail about voice copilot, scope monitoring and finance workflows | Planned: content lives on `/` for the MVP |
| `/how-it-works` | Transparent end-to-end process | Planned: content lives on `/` for the MVP |
| `/privacy` | Consent, integration scopes and data controls | Planned: limitations are shown in Settings and on the landing page |
| `/sign-in/[[...sign-in]]` | Clerk sign-in; falls back to a configuration notice when Clerk is absent | Implemented |
| `/sign-up/[[...sign-up]]` | Clerk sign-up for a new workspace | Implemented |

The landing page has two explicit entry points: **Try Visun** opens the Clerk
sign-in/sign-up modal when `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is present (and
falls back to the demo otherwise), while **Try demo** always opens the seeded
workspace at `/app?demo=1`. A short-lived `visun_demo` cookie keeps demo
navigation working; `?demo=0` clears it. `frontend/proxy.ts` protects `/app`
only when Clerk is configured.

### 4.2 Authenticated routes

| Route | Primary functionality | Status |
|---|---|---|
| `/app` | Today dashboard: priority tasks, upcoming dates, money and agent insights | Implemented |
| `/app/copilot` | Persistent voice/text chat and action timeline | Implemented |
| `/app/projects` | Client and project list | Implemented |
| `/app/projects/[id]` | Milestones, agreement, scope findings and activity | Implemented |
| `/app/inbox` | Authorized Telegram messages / uploaded transcripts and reviews | Implemented |
| `/app/payments` | Invoices, outstanding balances and verified PayPal statuses | Implemented |
| `/app/calendar` | Month/week/day views, task and milestone deadlines | Implemented (month + list) |
| `/app/leads` | CRM/lead list; today's new leads | Implemented |
| `/app/reports` | Generated reports, drafts and delivery history | Implemented |
| `/app/activity` | Global action and source-access audit trail | Implemented |
| `/app/settings/integrations` | Connect, disconnect and inspect permissions | Implemented |
| `/app/settings/preferences` | Voice, language, notifications and transcript controls | Implemented |

There is no separate `/app/approvals` route: approvals render inline in the copilot action card and are audited on Activity. The app shell is `frontend/components/shell/AppShell.tsx`; routes live under `frontend/app/app/`.

### 4.3 Desktop shell

```text
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ VISUN   Workspace ▼                         Search ⌘K      Notifications   Profile │
├───────────────────┬───────────────────────────────────────────────┬──────────────────┤
│ OVERVIEW          │ Page title + context                         │ Context panel    │
│  Today            │                                               │ (optional)       │
│  Copilot          │ Main content                                  │ Sources          │
│  Projects         │                                               │ Approvals        │
│  Inbox            │                                               │ Agent activity   │
│  Payments         │                                               │                  │
│  Calendar         │                                               │                  │
│  Leads            │                                               │                  │
│  Reports          │                                               │                  │
│  Activity         │                                               │                  │
│                   │                                               │                  │
│  Integrations     │                                               │                  │
└───────────────────┴───────────────────────────────────────────────┴──────────────────┘
```

- Shell header is persistently available.
- Left nav has clear active states and keyboard navigation.
- Optional right context panel only when relevant (AI sources, approvals, project summary); never reserve dead width.
- On small screens use a compact top bar and bottom navigation with an overflow sheet. No horizontal clipping of tables; use adaptive row cards.

---

## 5. Screen specifications

### 5.1 Marketing landing page — Updraft-inspired

**Goal:** Explain the pain, make voice-first action legible, and prompt a demo or signup.

**Sections:**

1. **Top navigation:** Visun logotype, Product, How it works, Trust, GitHub (if public), Sign in, Get started.
2. **Hero:** small `VISUN / YOUR FREELANCE OPERATING SYSTEM` kicker; giant headline: **“Freelance work moves fast. Stay ahead of it.”**; subcopy: **“Ask about deadlines, catch scope changes, follow up on payments, and send client updates—by voice or text.”**; CTA “Try Visun” and secondary “See how it works”.
3. **Interactive product preview:** realistic desktop mock showing voice transcript, pending amount and a review-required action. Label all data as *sample*.
4. **`[01] THE PROBLEM`:** fragmented client conversations, missed deadlines and unpaid changes; mini story cards.
5. **`[02] THE WORKSPACE`:** six interactive editorial feature tiles: Voice, Scope, Payments, Calendar, Reports, Leads. Cards expand on tap and work without hover.
6. **`[03] HOW IT WORKS`:** Message → Understand → Propose → Approve → Execute → Verify, illustrated as a staged horizontal/vertical timeline.
7. **`[04] SEE YOUR AGENT THINK`:** showcase the transparent action log and exact source references, not hidden “AI magic”.
8. **`[05] BUILT FOR REAL WORK`:** demo use cases: “What is due today?”, “How much is unpaid?”, “Send Rahul a reminder.”
9. **Final CTA + footer:** get started, privacy, terms, GitHub and hackathon disclosure where relevant.

**Hero visual design:** paper-like background, high-contrast large display heading, one expressive accent highlight, restrained line art or original product UI; no arbitrary stock trading graphs.

**Navigation behavior:** Sticky top bar may compact on scroll; menu must work on keyboard and mobile. Numbered sections use actual anchors. Do not replicate Updraft's branded naming or copy.

### 5.2 Onboarding

Step 1: Create workspace → Step 2: Add first client/project → Step 3: Upload agreement or define milestones → Step 4: Connect optional providers → Step 5: Test your first voice query.

- Each step is skippable except account/workspace creation and necessary consent.
- Show what each integration can access; connections default off.
- No microphone access until user explicitly activates voice.
- Provide sample project seed data for hackathon demo, visibly labeled as such.

### 5.3 Today dashboard

**Header:** “Good afternoon” and today's date with timezone; one prominent “Ask Visun” voice/text launcher.

**Top KPI row:** Outstanding balance, Due this week, Scope changes needing review, New leads today. Values must be grounded in actual project/provider records; display `—` or “Not connected” instead of false zeros.

**Main content:**

- **Priority list:** overdue items before upcoming tasks; due date, client, direct link, source.
- **Calendar snapshot:** compact 7-day strip with milestone deadlines; click to expand.
- **Financial snapshot:** by-client outstanding invoices with verified payment labels.
- **Client signals:** flagged potential scope changes, with links to exact messages and contracts.
- **Recent actions:** “Email sent”, “Report generated”, “Pending approval”, with timestamps and outcomes.
- **Quick actions:** Ask about today, Generate progress report, Draft payment reminder, Add client.

**Empty states:** clear next step (“Connect PayPal”, “Add a project”) rather than fabricated analytics.

### 5.4 Copilot — flagship interface

**Layout:** sidebar session history | main chat/transcript | optional right-side sources/action inspector. Voice controls anchored to message composer.

**Core elements:**

- Session list: date groups, title, search, rename, delete, retention info.
- Messages: user text/voice transcript; assistant response; tool activity; attachments and report previews.
- Composer: text input, microphone, optional attachment, submit/stop.
- Live voice indicators: `Idle`, `Listening`, `Thinking`, `Speaking`, `Disconnected`, `Mic blocked`.
- “What I checked” expanders below grounded responses (e.g., invoice ID, project record and last verified time).
- Tool chips: `get_deadlines`, `get_pending_payments`, `detect_scope_changes`, `draft_email`, etc.
- Action card with recipient, subject, amount/currency if relevant, exact body, editable draft, source context, and explicit `Approve & send` / `Cancel` buttons.
- History includes system/tool execution outcomes, not just conversational sentences.

**Voice history contract:** Interim ASR fragments can display live, but persist only confirmed transcript segments; store speaker role, source modality, time, session ID and message ID. Present correction/edit option for transcription errors. Raw audio storage requires distinct opt-in; text transcript and audio retention settings must be separable.

**Session restoration:** Reopen existing conversation with the original ordered timeline; never silently re-execute old actions.

**Responsive:** On mobile, session list appears as sheet; action inspector as bottom sheet; microphone is large and thumb-accessible.

### 5.5 Projects and scope intelligence

- Project list: searchable/filterable client, value, due date, progress and status.
- Project detail header: name, client, active milestone, budget/currency, next deadline.
- Tabs: Overview, Agreement, Milestones, Conversations, Scope changes, Activity.
- Scope findings list: message excerpt, source link, matched clause, confidence/uncertainty, impact rationale, status `Potential / Needs review / Accepted / Dismissed`.
- Side-by-side diff: **Agreed scope** vs **New request**; supporting evidence and proposed change order.
- Actions: Approve draft, Edit request, Dismiss, Ask agent; never auto-charge based solely on classifier results.
- Allow corrected classifications and log the correction for user-specific context; do not train third-party models on private chats without permission.

### 5.6 Payments

- KPI: Invoiced, Collected (verified), Outstanding (based on invoice/payment reconciliation), Overdue.
- Invoice table with client, invoice ID, issue date, due date, amount, currency, PayPal status, last sync.
- Statuses: Draft, Sent, Unpaid, Partially paid, Paid (provider verified), Overdue (derived), Failed, Refunded, Unknown/Unsynced.
- Provider sync: show `Last checked` and clickable source/provider reference; stale or unavailable status labeled clearly.
- Payment detail: line items, milestone reference, PayPal sandbox/live environment label, event timeline and actions.
- Actions: Draft reminder, Open PayPal invoice, View activity, Retry sync. Payment creation/capture must use supported flows and explicit user/buyer authorizations.
- **Never** display “Escrow protected” or guarantee funds are held indefinitely.

### 5.7 Inbox / client conversation ingestion

- Source filter: Telegram live bot, manually uploaded WhatsApp-style export, Discord (if connected).
- Conversation panel includes consent provenance and last sync.
- Message list shows origin platform, timestamp, client and source link where available.
- Detected request highlights are visually distinct but not presented as indisputable facts.
- Upload flow: clear supported types, size cap, consent checkbox, data retention choices, redaction preview.
- A WhatsApp export is **manual input**, not background access to personal messages.

### 5.8 Calendar and leads

**Calendar:** month/week/day view; deadline chips for project tasks and milestones; external provider state; timezone displayed; drag/reschedule may be deferred until authenticated calendar write access and explicit confirmation are implemented.

**Leads:** name/company, source, received time, interest, next action, status, assignee. “Today's leads” uses workspace timezone and only connected or manually entered data; missing source means “No lead source connected”, not “0 leads”.

### 5.9 Reports

- Report builder: date range, client/project, sections (completed work, blockers, upcoming work, scope changes, invoice status), preview.
- Distinguish source-backed facts from AI narrative summaries.
- Export printable report/PDF where implemented; fallback to shareable HTML/text, never show fake download controls.
- Send flow: preview recipients, attachments/body, explicit approval, provider confirmation, saved artifact and audit trail.

### 5.10 Activity and integrations

**Activity timeline:** filter by action type, project, provider, result and date. Items include actor (user/agent), source, tool, parameters (with secrets redacted), approval record, outcome and provider reference. 

**Integrations hub:** cards for PayPal, Gmail, Google Calendar, Telegram and optional Discord. Each shows connected/disconnected, environment, granted scopes, last sync, reconnect/revoke. Explain limitations before users connect; never suggest that WhatsApp Cloud API reads arbitrary personal chats.

---

## 6. Interaction behavior and UI state machine

### 6.1 Agent command flow

```text
User voice/text input
  -> normalize transcript
  -> parse intent
  -> call read-only tools (if authorized)
  -> display grounded answer + source references
  -> if user requested consequential action:
       create editable proposed action
       -> WAITING_FOR_APPROVAL
       -> user approve / edit / cancel
       -> backend executes idempotently
       -> provider verifies response
       -> COMPLETED / FAILED / UNKNOWN
  -> append messages and tool/action events to history
```

### 6.2 State badges (always text + icon)

| State | UI treatment |
|---|---|
| `Draft` | Neutral; “Not sent” |
| `Awaiting approval` | Amber; explicit action needed |
| `Running` | Progress indicator; avoid duplicate clicks |
| `Succeeded` | Green; evidence from provider or backend |
| `Failed` | Red; reason and safe retry path |
| `Unknown` | Neutral warning; ask user to refresh/check source before retrying |
| `Simulated` | Clear `Demo data` or `Sandbox` label |

### 6.3 Required micro-interactions

- Hover/focus: slight neumorphic elevation on hover, explicit visible outline for keyboard focus, and no layout shifts.
- Primary button: feedback on press/loading/disabled; no duplicate submission.
- Notification toast: concise outcome; link to detail; errors remain discoverable in Activity.
- Copy actions: clear success text.
- Destructive actions: confirm when data or access is affected.
- Keyboard shortcuts: `/` search if not typing; `⌘/Ctrl+K` command palette; `Esc` closes sheets; never hijack accessibility keys.

---

## 7. Component library

**Foundational components:** `AppShell`, `Sidebar`, `Topbar`, `MobileNav`, `PageHeader`, `SectionLabel`, `EditorialHeading`, `StatCard`, `Badge`, `Button`, `Field`, `Panel`, `EmptyState`, `Skeleton`, `Toast`, `Modal`, `Sheet`, `CommandPalette`, `DatePill`.

**Agent components:** `VoiceOrb`, `MicPermissionPrompt`, `VoiceStateLabel`, `TranscriptStream`, `ChatMessage`, `ChatSessionList`, `ToolCallEvent`, `SourceCitation`, `ActionApprovalCard`, `AgentTimeline`, `ConversationSearch`.

**Domain components:** `ProjectCard`, `MilestoneTimeline`, `ScopeDiffViewer`, `ScopeFindingCard`, `PaymentSummary`, `InvoiceTable`, `ProviderStatus`, `DeadlineCalendar`, `LeadCard`, `ReportPreview`, `IntegrationCard`.

**Design implementation:** The shipped UI uses an in-repo UI kit (`frontend/components/ui`) styled with Tailwind 4 helpers in `frontend/app/globals.css`, plus `lucide-react` icons, `motion` only where motion adds context, and Recharts only for real data. Neumorphic shadows are tokenized utilities (`neu-raised`, `neu-inset`, `neu-pressed`) rather than hand-written per component. Radix/shadcn is intentionally not a dependency: the kit covers the handful of primitives the app needs (dialog, sheet, toast, field, badge) with native focus management.

---

## 8. Recommended frontend architecture

### 8.1 Stack

- **Next.js 16 App Router**, React 19, TypeScript (strict)
- **Tailwind CSS 4**, CSS custom properties for theme tokens
- **In-repo UI kit** (`components/ui`) with native dialog/sheet/toast behaviour and accessible focus management
- **Lucide React** icons
- **Typed `fetch` client** (`lib/api.ts`) plus the `AppStoreProvider` React context store; mutations write through to FastAPI and fall back honestly
- **Web Speech API** for browser voice; backend transcript WebSocket `/api/v1/agent/voice` as fallback
- **FastAPI** backend as source of truth for permissions, messages, projects and actions
- **SQLite by default, PostgreSQL/Supabase in production**, owned by the backend

### 8.2 Implemented folders

```text
frontend/
  app/
    page.tsx                 # editorial landing page
    layout.tsx               # fonts + conditional ClerkProvider
    globals.css              # tokens + neumorphic utilities
    sign-in/[[...sign-in]]/page.tsx
    sign-up/[[...sign-up]]/page.tsx
    app/
      layout.tsx             # demo or Clerk provider stack + AppShell
      page.tsx               # Today dashboard
      copilot/page.tsx
      projects/page.tsx
      projects/[id]/page.tsx
      inbox/page.tsx
      payments/page.tsx
      calendar/page.tsx
      leads/page.tsx
      reports/page.tsx
      activity/page.tsx
      settings/integrations/page.tsx
      settings/preferences/page.tsx
  components/
    ui/                      # Button, Badge, Panel, Modal, Toast, Field, ...
    shell/                   # AppShell, Sidebar, Topbar, MobileNav, CommandPalette
    brand/                   # Logo, EditorialHeading
    auth/                    # Clerk CTA buttons and workspace token bridge
  lib/
    api.ts                   # typed backend client + bearer/demo auth bridge
    auth-config.ts           # Clerk key detection, URLs, demo cookie name
    store.tsx                # hydration, write-through mutations, API status
    types.ts                 # UI-facing shapes
    demo-data.ts             # local fallback snapshot
    agent.ts                 # offline demo answer script (clearly labelled)
    utils.ts                 # formatting, cn, ids, sleep
  proxy.ts                   # Clerk /app protection + demo-cookie handling
  next.config.ts             # /api/backend/* rewrite to FastAPI
```

### 8.3 API and data boundaries

- `lib/api.ts` calls same-origin `/api/backend/*`; Next rewrites that prefix to FastAPI. The browser never holds provider credentials.
- With Clerk enabled, `components/auth/ClerkWorkspaceProvider.tsx` waits for Clerk to hydrate and configures a stable `getToken()` bridge; every API request carries `Authorization: Bearer <session token>`. Demo mode sends `X-Visun-Demo: 1` instead. Without a Clerk key the original demo client is unchanged.
- The store hydrates from `GET /bootstrap` and records connection state (`checking`, `online`, `offline`); the topbar shows `API · sandbox`, `API · live`, or `Offline · local`. It also adopts the server's user/workspace profile so the account menu reflects the signed-in Clerk user rather than hard-coded demo text.
- Mutations call the backend first and update local state from the response. If the backend rejects or is unreachable, the store returns an error, keeps the previous state, and the UI reports it. Nothing is silently marked successful.
- Payments, tools, approvals and activity use backend enums (`pending_approval`, `executing`, `completed`, `failed`, `rejected`, `expired`); the UI maps `completed` to “Succeeded” and `expired` to “Failed”.
- Server timestamps are displayed with `date-fns` in readable local time; store and API values remain UTC.
- `POST /actions/{id}/approve` requires `expected_hash`; the UI sends the hash from the prepared action and reconciles the returned state. Replays return the same provider reference.
- Copilot falls back to `lib/agent.ts` only when `/agent/chat` fails, and records an “Offline fallback answer” activity entry so the fallback is visible rather than disguised as a grounded response.

### 8.4 Suggested application states

Handle **loading**, **empty**, **error**, **unauthorized**, **disconnected**, **stale**, **pending approval** and **success** explicitly on every important route. Avoid blank cards or synthetic values when data is unavailable.

---

## 9. Voice-first UX requirements

1. Voice session is opt-in and clearly marked as active; provide obvious Mute, Stop and End controls.
2. Display microphone permission state and actionable recovery on denial.
3. Show realtime user transcript and assistant's spoken response as text; distinguish partial vs finalized text.
4. Preserve chat history on refresh and reconnect from durable backend storage when enabled.
5. Show tool actions inline (“Checking invoices…”, “Reading milestones…”), but do not expose internal secrets or chain-of-thought.
6. Allow interruption of speech and a graceful fallback to text chat when realtime voice connection fails.
7. Never imply knowledge of unconnected sources; say “Gmail isn't connected” or “No lead source is available”.
8. Audio output defaults to user-initiated; never autoplay upon load.
9. Offer language selection and text language fallback. Hindi/Hinglish can be a later enhancement, subject to actual model capability and transcript quality testing.
10. Provide accessible text transcript for every meaningful voice operation.

---

## 10. Accessibility, security, privacy and trust

- WCAG 2.2 AA target; semantic landmarks, skip link, logical focus order, visible focus ring, correctly labelled fields, screen-reader-friendly chart alternatives.
- Keyboard operation for all actions; functional alternatives to hover and swipe interactions.
- Color contrast ≥ 4.5:1 for normal text where required; status also readable without color.
- Respect reduced motion and avoid flashes.
- Ensure progress/status announcements use restrained ARIA live regions; do not announce every streaming token.
- PII: redact credentials and full payment identifiers from UI traces; safe clipboard defaults.
- Confirmation modal before sending email/report/invoice, changing scopes or initiating payment-related actions.
- Display the exact recipient, action summary, relevant amount and currency, and permission scope.
- Consent notice for importing or analyzing client conversations, especially multi-party group chats.
- Transcripts and raw audio should have separate opt-in/retention decisions; expose deletion and export controls when implemented.
- Show PayPal Sandbox unmistakably in testing, with no unverified production-payment claims.

---

## 11. Responsive behavior

| Viewport | Layout |
|---|---|
| ≥ 1440px | Expanded sidebar, central content and optional inspector |
| 1024–1439px | Sidebar plus main content; inspector collapses to drawer |
| 768–1023px | Collapsible rail; 2-column overview cards; chat full width |
| < 768px | Compact header, bottom nav / menu sheet, single-column cards and sheets |

Use content-driven responsive design rather than fixed-width mockups. Payment tables become scroll-aware or card lists on small screens; actions stay accessible without horizontal scrolling. Test with long client names, multiple currencies and large text settings.

---

## 12. Landing page sample copy

**Kicker:** `VISUN / THE FREELANCE OPERATING SYSTEM`  
**Headline:** `More doing. Less chasing.`  
**Support:** `One transparent AI workspace for deadlines, project scope, payments, reports, leads, and client conversations—controlled by your voice.`  
**Primary CTA:** `Try Visun` (Clerk sign-in when configured)  
**Secondary CTA:** `Try demo` (opens `/app?demo=1`)

**Section `[01]`**: `Your work is everywhere. Your answers shouldn't be.`  
**Section `[02]`**: `Six tools. One conversation.`  
**Section `[03]`**: `From client request to clear next step.`  
**Section `[04]`**: `Nothing happens behind your back.`  
**Closing CTA:** `Spend more time making. Less time managing.`

Avoid claims like “guaranteed payment”, “automatically reads your WhatsApp”, “AI verifies work is complete” or “never miss a deadline”.

---

## 13. Build priorities for hackathon

### P0 — implemented

- [x] Responsive Visun application shell and original editorial landing page
- [x] Today dashboard with source-labelled sample or real data
- [x] Persistent voice/text Copilot with readable live transcript
- [x] Project details and agreement vs new-message scope finding
- [x] Telegram live ingestion **or** clearly labelled imported conversation demo (simulated adapter + imported-message inbox)
- [x] PayPal Sandbox invoice/payment status represented accurately (simulated by default; real mode fails without credentials)
- [x] Draft → approval → send email/report with honest provider result (`sim-*` reference when simulated)
- [x] Agent activity and conversation history persists across refresh (backend SQLite or local fallback)
- [x] Loading/error/empty/permissions UI, including `Offline · local` and simulated labels

### P1 — partially implemented

- [x] Calendar month view with deadline chips (Google Calendar sync is credential-gated)
- [x] Leads list and today's lead queries
- [x] Report builder with source-backed facts and narrative toggle
- [x] Session search, rename, and delete
- [ ] Discord permitted-channel integration

### P2 — post-hackathon

- [ ] WhatsApp Business integration for compliant supported business use cases
- [ ] Rich drag/drop scheduling, deeper CRM sync, advanced analytics
- [ ] Team roles and collaboration
- [ ] Personalization and theme customization

---

## 14. Frontend acceptance tests

These are the target behaviours. The verification column records the current demo status; real-provider rows require credentials.

| ID | Scenario | Expected result | Status |
|---|---|---|---|
| UX-01 | Open landing page at 375px and 1440px | No clipping; CTA and navigation work | Verified in responsive CSS |
| UX-02 | Navigate the entire app by keyboard | All controls reachable with visible focus | Verified by design-system focus styles |
| UX-03 | Deny microphone access | Clear message and usable text input | Implemented fallback |
| UX-04 | Ask “What is due today?” | Answer shows project source / timestamp, not fabrication | Verified via backend test |
| UX-05 | Ask “How much is outstanding?” | Amount reconciles with invoice records and clearly indicates stale sync | Verified: $3,200 from seeded invoices |
| UX-06 | Ask to email a client | Preview shows exact recipient/content; nothing sends before approval | Verified via API e2e |
| UX-07 | Approve an email once | Single execution; provider status and audit event recorded | Verified: idempotent replay returns same `sim-gmail-*` |
| UX-08 | Reload an active chat | Persisted finalized transcript and action history reappear | Verified with backend online; local snapshot otherwise |
| UX-09 | Detect possible scope creep | User sees agreement clause and client message behind the flag | Implemented from seeded findings |
| UX-10 | Disconnect provider | UI shows disconnected and blocks unauthorized actions | Verified: backend toggle, rollback on failure |
| UX-11 | PayPal Sandbox transaction | Clear Sandbox indicator and verified status | Simulated mode labels every action; real mode credential-gated |
| UX-12 | Turn on reduced motion | No essential animation or auto-moving content | Implemented with `useReducedMotion` and CSS media query |
| UX-13 | API request fails | Non-destructive error state and safe retry path | Verified: `Offline · local` badge + retained state |
| UX-14 | View activity after approval | Shows actor, action, approval, result and source | Verified in Activity and API tests |

---

## 15. Suggested 3-minute visual demo path

**00:00–00:20 — Editorial landing:** Show Visun brand and promise, then enter workspace.  
**00:20–00:50 — Incoming message:** Teammate sends Telegram request for a feature beyond agreement.  
**00:50–01:25 — Transparent scope finding:** Open side-by-side evidence; show the original milestone and new message.  
**01:25–02:00 — Voice command:** “What's changed, and how much is unpaid?” Live transcript appears, agent calls tools, cites data.  
**02:00–02:35 — Approve action:** “Draft a payment reminder and today's report.” Review and approve email; confirm actual send outcome.  
**02:35–03:00 — PayPal & trust:** Show verified sandbox payment information and complete agent activity/chat history.

Prioritize the working workflow over a large number of static pages.

---

## 16. Definition of done

The frontend is done for MVP when a user can **understand Visun in one glance, enter a responsive workspace, ask a real voice/text question, inspect the factual sources, approve a meaningful external action, verify its result, and reopen the full conversation history**. Visual polish must not misrepresent payment, email or integration states.

**Current status:** the demo satisfies this credential-free. The backend owns the snapshot, grounded answers, approvals, and audit; the frontend hydrates from it and labels simulated provider results. Clerk sign-in/sign-up, `/app` protection, and the token bridge are wired conditionally on `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`. Remaining production work is real provider OAuth consent screens and Gemini Live audio transport.

### Sources and boundaries

- **Visual/information design inspiration:** [Updraft](https://updraft.modulify.website/) — observed accessible page content and interaction descriptions, accessed 3 Nov 2026.
- **Product requirements:** companion `PRD.md` from this Visun project.
- **Neumorphism inspiration:** [Neumorphism.io](https://neumorphism.io/#e0e0e0) — raised/inset shadow principles, not adoption of its sample `#e0e0e0` background.
- **Visual token disclaimer:** The five-color palette is based on the user-supplied image; hex values are approximate and intentionally unchanged. Fonts, sizes, and animation recommendations are proposed Visun design decisions, not verified CSS properties of Updraft.
