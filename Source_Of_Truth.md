The system is an HR management system with this features

1. HR login / Register
2. Department and Roles Creation [full CRUD]
3. Fields creation with the section 
4. Job creation [department, role, JD, pay range etc etc]
5. Job Listing page [cleint facing]
6. Agent scoring 
7. Job filling form [Auto fill from resume]
8. chat bot [assistant for asking question]

# HR Recruitment System — Source of Truth

Business rules, entities, and flows only. No implementation/tech-stack detail — backend and frontend (Next.js) are separate projects consuming this as shared spec.

---

### §1 Actors (updated HR row)

| Actor | Access |
|---|---|
| HR | Registers and logs in via standard email/password auth. Full access: jobs, departments, roles, applications, interviews, decisions, tags, marketing/source dashboard, chatbot. |
| Candidate | No account. Applies via public careers page. Identified by email/application record only. |
| Interviewer | No account. One-time access via a single-use secure link per interview assignment. |

### §1a Authentication (new section)

- **Registration**: standard email + password sign-up. No email verification step, no OTP, no MFA — account is active immediately on registration.
- **Password storage**: hashed (industry-standard hashing algorithm), never stored or logged in plain text.
- **Login**: email + password → validated against stored hash → session/token issued on success.
- **Session/Token issuance**: on successful login, a signed session token is issued (standard JWT or equivalent) and returned to the client. Token carries user identity + expiry; used to authenticate all subsequent requests.
- **Session persistence**: token stored client-side (standard secure cookie or equivalent) so the user stays logged in across visits until expiry or logout.
- **Token expiry**: sessions expire after a defined duration; expired tokens are rejected, user is redirected to login.
- **Logout**: invalidates the client-side session (clears token/cookie); no server-side token blacklist required at this scale.
- **Authorization**: every protected route/endpoint validates the session token before returning data — no anonymous access to any `/panel`-equivalent resource.
- **No password reset flow defined yet** — flag this as a gap to decide on later if needed (out of scope for now, matches "no email verification/OTP" stance).
- **No role-based permission tiers** — one authenticated user type (HR) for now, full access on login, no granular permission system.

---

## 2. Department

- Fields: `name` (required, unique), `status` (active/inactive), `createdAt`
- No delete — only `active`/`inactive`. Inactive just hides it from dropdowns when creating new Roles; historical Roles/Jobs keep referencing it fine.
- A Role cannot exist without a Department.

## 3. Role (job-title library, reusable across hiring cycles)

- Fields: `name` (required), `departmentId` (required), `defaultDescription` (optional JD template text), `status` (active/inactive)
- Purpose: lets HR create multiple Job postings over time under the same title without retyping, and groups reporting cleanly (e.g. "all Backend Engineer hires ever").
- Picking a Role while creating a Job auto-fills the Job's description from `defaultDescription` (editable per posting, doesn't alter the template).
- No delete — active/inactive only, same reasoning as Department.

## 4. Job (the actual posting)

- Required at creation: `department`, `role`, `title`, `description`, `positionsAvailable` (default 1)
- Optional/configurable: `payInfo`, `officeLocation`, custom fields (see §5)
- **Status**: `draft` → `open` → `filled` / `closed`
  - `draft` — being built, not public
  - `open` — live on careers page, accepting applications
  - `filled` — system-set automatically when `positionsFilled === positionsAvailable`
  - `closed` — HR manually stopped it before headcount reached (e.g. cancelled, paused)
  - Both `filled` and `closed` remove it from the public careers page; distinction is for accurate reporting only.
- `positionsFilled` increments by 1 automatically each time an application under this Job is marked `Hired`.
- **No hard delete, ever**, except: a Job with zero applications may be deleted outright (guard: delete action disabled once `applicationCount >= 1`).
- **Reopening**: a `closed`/`filled` Job is never reopened for a new hiring round. Instead, HR uses **"Duplicate Job"** — copies title, department, role, description, pay, location, field config into a new `draft` Job. Old Job remains untouched as permanent history (its applications, source data, interview records stay intact and queryable).
- Each Job has a stable, unique public URL (slug-based).

## 5. Field Definitions (dynamic per-job application form)

Two-part model:

**a) `fieldDefinitions`** — reusable field library, created once, referenced by many jobs:
- `key`, `label`, `type` (text/url/textarea/select/file/number), `options` (for select), `section`, `isSystemDefault` (true = auto-attached to every job, e.g. name/email/phone/resume)

**b) On each Job** — `fields[]` = array of references with per-job overrides:
- `{ fieldId, required: true/false, order }`
- Same field definition can be required on one Job and optional/absent on another, without duplicating the definition.

**Sections (clustering)**: fixed global list — `personal | experience | education | links | other`. Defined once as a constant, not a separate managed entity. Every field must have a section; fields with no natural grouping default to `other`. Sections with zero fields on a given Job are simply not rendered (no empty headers). No custom/reorderable sections per job — structure is global and fixed.

## 6. Application

- Fields: `jobId`, `roleSnapshot` (department + role title, copied at submit time — protects history if Job is edited later), `answers[]` (`{fieldId, value}` matching that Job's field config at submit time), `resumeUrl`, `status`, `source`, `campaign`, `tags[]`, `createdAt`
- **Applications link to the Job only** — never directly to Department or Role.
- **Status lifecycle**: `submitted` → `under_review` → `interviewing` → `decided (approved / rejected / trial)`
- **Duplicate/reapplication detection**: same email/phone/resume reapplying should be flagged (e.g. "previously rejected on [date], reason: [x]") — not blocked, just surfaced to HR.
- **Misrouted application fix**: HR can reassign an application to the correct Job (e.g. marketing CV submitted under a developer opening). This is a logged edit (`originalJobId`, `reassignedBy`, `reason`), never a silent overwrite.

## 7. Tags

- Free-form, HR-created (`{name, color}`), many-to-many with Applications.
- Used for filtering and bulk actions (e.g. bulk-tag, bulk-reject by tag).

## 8. Interview Process

- HR creates any number of interview rounds per Application.
- Each interview: `{applicationId, roundNumber, interviewerName, interviewerEmail, scheduledAt, status, notes, secureToken, tokenExpiry, cancelReason}`
- **Interviewer has no account.** System emails a single-use secure link tied to that specific interview. Opening it shows only: candidate name + a note-writing field + "submit & mark complete." No access to application data, other candidates, or any other part of the system.
- Link expires after submission or after a set date — cannot be reused.
- **Cancellation**: HR can cancel an interview with a required reason; candidate is notified automatically.
- Interviews are visible on an HR dashboard (upcoming / completed), linked to reminders (see §10).

## 9. Decision

- Final HR action per Application: **Approve / Reject / Trial** — each requires a written reason (mandatory, not optional).
- `Trial` = a status + note (e.g. duration, re-review date) — not a separate workflow engine.
- All decisions + reasons are permanently stored and are visible to the chatbot agent (§12) for future queries.
- On `Approve` (hired), `Job.positionsFilled` increments; if it reaches `positionsAvailable`, Job auto-moves to `filled`.
- Remaining shortlisted-but-not-hired applicants: HR manually updates their status (Rejected with reason, or held as Trial/Reserve). Untouched applicants simply remain in their prior status — no forced cleanup required. An optional bulk "reject remaining" action may be used.

## 10. Notifications (candidate-facing, automatic)

Triggered on:
- Application submitted (confirmation)
- Interview scheduled (+ a reminder sent before the interview, lead time configurable by HR per interview)
- Interview cancelled (with reason)
- Final decision communicated (approved / rejected / trial)

All notifications are email-based. No manual sending — system-triggered on the relevant status change.

## 11. AI Agent — three capabilities, one agent

**a) Smart Autofill**
On resume upload during application, extracts candidate info and pre-fills the form. Candidate reviews/edits before submitting — autofill never bypasses candidate confirmation.

**b) Automatic Ranking**
Triggered in the background the moment an Application is submitted. Combines resume, form answers, and any supplied external links (LinkedIn summary/PDF, GitHub, portfolio, Instagram) into: a concise candidate summary + a fit score against the Job's requirements (skills, experience, pay band). Result is stored on the Application and visible to HR immediately — no manual screening required before HR sees a ranked view.

**c) HR Chatbot**
Plain-language Q&A over the system's own data — e.g. "Why was this candidate rejected six months ago," "How many applications did we get for Role X last month," "Which source produced the best hires this quarter." Answers must be grounded only in real stored data (resumes, ranking summaries, interview notes, decision reasons, tags, source/campaign records) — never fabricated. Output is presented as text, tables, or charts as appropriate to the question. The agent has full read access to all HR data; it has no write/delete capability under any circumstance.

## 12. Source & Campaign Tracking (marketing intelligence)

- Marketers run ads externally, in their own ad platform's Ads Manager (Meta, Google, TikTok, LinkedIn, X), or post organically (Indeed, LinkedIn Jobs). They append their own UTM parameters (`utm_source`, `utm_campaign`, etc.) to the Job's public URL — nothing is pre-created or registered in this system.
- On landing, the system captures `utm_source`/`utm_campaign` from the URL and stores them against the resulting Application at submit time. No application-side or manual entry required.
- If no UTM parameters are present, the Application defaults to `source: website` (direct/organic traffic) — this is the natural fallback, not a special case.
- **No separate "create campaign" or "create source" UI** — sources and campaigns are derived entirely from whatever UTM values actually arrive on real applications. The dashboard is a live read view, not manually maintained data.
- **Ad-locked landing**: a candidate arriving via a tagged ad link lands directly on that specific Job page only, with no ability to browse other open roles from that entry point (a visible "see other openings" link may unlock the full careers page if clicked).
- The same HR account views the Source & Campaign dashboard (applications by source/campaign/job, over time) — no separate marketer role/account for now.

## 13. Public Careers Page

- Lists all `open` Jobs; each Job has a permanent, shareable URL.
- Candidates arriving from a tagged ad link land directly on that Job (see §12); candidates browsing the main site see the full open-roles list.
- Application form is dynamically built from that Job's configured fields (§5), grouped by section, autofill-assisted (§11a).

---

## Cross-Entity Rules Summary (quick reference)

- Nothing in this system is ever hard-deleted except a zero-application Job (explicit HR action, explicit guard).
- Every status change (Job, Application, Interview) that affects the candidate triggers an automatic notification.
- Every HR decision requires a written reason — no bare approve/reject/trial.
- Every Application always resolves to exactly one Job; Department/Role are read through the Job, never linked to directly.
- Historical accuracy over live-joins: Applications snapshot Department/Role text at submit time so later edits to Job/Role don't rewrite history.
- The AI agent (autofill, ranking, chatbot) is read/assist-only — it never makes or overrides an HR decision.