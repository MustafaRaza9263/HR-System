# HR Recruitment System — Source of Truth

Business rules, entities, and flows only. No implementation or tech-stack detail — backend and frontend consume this as the shared product spec.

---

## 1. Product overview

HR manages hiring structure, jobs, applications, interviews, and in-app notifications.

### In scope now

1. HR login / register
2. Department and Role CRUD
3. Job creation, listing, and detail
4. Public careers + apply
5. Application listing, detail, reject / bulk reject
6. Interview scheduling, notes, guest department-day access
7. HR notifications (in-app bell + optional browser push)

### Explicitly later (do not build yet)

- AI ranking / autofill / chatbot
- Tags
- Approve / trial decision flow
- Marketing dashboard

---

## 2. Actors

| Actor | Access |
|---|---|
| HR | Registers and logs in via email/password. Full access to departments, roles, jobs, applications, interviews, and configuration. |
| Candidate | No account. Applies via public careers page. Identified by email/application record only. |
| Guest interviewer | No account. Requests access via a department+day link; HR approves. Can add notes on that day's scheduled interviews only. |

---

## 3. Authentication

- **Registration**: email + password. No email verification, OTP, or MFA — account is active immediately.
- **Password storage**: hashed; never stored or logged in plain text.
- **Login**: email + password → session/token issued on success.
- **Session**: signed token (JWT or equivalent) with identity + expiry; stored client-side (secure cookie or equivalent).
- **Expiry**: expired tokens rejected; user redirected to login.
- **Logout**: clears client-side session; no server-side blacklist required at this scale.
- **Authorization**: every protected HR route validates the session token — no anonymous access to panel resources.
- **Gaps (deferred)**: password reset; no RBAC tiers — one HR user type with full access.

---

## 4. Department

| Field | Rules |
|---|---|
| `name` | Required, unique |
| `status` | `active` \| `inactive` |
| `createdAt` | System |

- No hard delete — inactive only. Inactive departments are hidden from dropdowns when creating Roles; existing Roles/Jobs may still reference them.
- A Role cannot exist without a Department.

---

## 5. Role (reusable job-title library)

| Field | Rules |
|---|---|
| `name` | Required |
| `departmentId` | Required (ref Department) |
| `defaultDescription` | Optional JD template (used to pre-fill Job description) |
| `status` | `active` \| `inactive` |

- Lets HR reuse the same title across hiring cycles and keep reporting grouped (e.g. all “Backend Engineer” hires).
- Selecting a Role when creating a Job pre-fills Job title and description from the Role; edits on the Job do **not** mutate the Role template.
- No hard delete — active/inactive only (same reasoning as Department).

---

## 6. Job (the posting)

### 6.1 Fields

| Field | Type / rules |
|---|---|
| `_id` | Auto |
| `slug` | Auto-generated **on publish only** (not on draft save). Format: `slugify(title) + "-" + random 4-char suffix`. Null while draft. |
| `title` | String, required. Auto-filled from Role name on selection; editable. |
| `departmentId` | Ref Department, required |
| `roleId` | Ref Role, required |
| `description` | Rich text JSON (structured doc from editor: bold/italic/bullets/headings) — not a plain string |
| `jobType` | Enum, required: `Full-time` \| `Part-time` \| `Contract` \| `Temporary` \| `Internship` \| `Fresher` |
| `positionsAvailable` | Number, required, default `1`, min `1` |
| `positionsFilled` | Number, default `0`. System-managed; never editable by HR |
| `salaryMin` | Number, required |
| `salaryMax` | Number, required; must be `>= salaryMin` |
| `fieldsConfig` | Embedded per-job application form config — see §6.2. **Not a separate entity.** |
| `status` | `draft` \| `open` \| `filled` \| `closed` — default `draft` |
| `closeReason` | String, nullable; **required** when HR manually closes |
| `applicationCount` | Number, default `0`. System-managed |
| `createdAt` / `updatedAt` | System |
| `publishedAt` | Nullable; set on first successful publish |
| `closedAt` | Nullable; set when manually closed |

**Status meaning**

| Status | Meaning |
|---|---|
| `draft` | Being built; not public |
| `open` | Live; accepting applications (when careers exist) |
| `filled` | System-set when `positionsFilled === positionsAvailable` (later, on hire) |
| `closed` | HR stopped the posting before headcount; requires `closeReason` |

`filled` and `closed` both leave the public list; distinction is for reporting.

### 6.2 `fieldsConfig` (embedded on Job — no Fields library)

Application form shape is configured **per Job** during creation. There is no global Custom Fields entity, library, sidebar page, or experience/education section toggles.

```
fieldsConfig: {
  customFields: [{
    id: string,           // client-stable id within the job
    label: string,
    type: "text" | "textarea" | "number" | "select" | "date" | "checkbox" | "file",
    required: boolean,
    constraint: /* maxLength | min/max | options list — by type */,
    section: "personal" | "experience" | "education"
  }]
}
```

- Wizard Step 3 only offers **+ Add field** (label, type, required, constraint, section) with edit/remove on the list.
- Personal identity fields expected at apply time (name/email/phone/resume) are system defaults for the future Application form — not a managed Fields catalog.

### 6.3 Critical publish rule (API-enforced)

Before a Job may enter `open` (publish or any future re-open):

1. Check whether **any other** Job exists with the same `departmentId` + `roleId` and status `draft` or `open`.
2. If yes → reject with a clear error naming the conflicting Job (`title`, `status`, `slug` if present).
3. Must run **server-side** on publish; UI may warn, but API never trusts the client alone.

| Allowed | Blocked |
|---|---|
| Multiple drafts for same dept+role | Publishing to `open` while another draft/open exists for same dept+role |
| New open after prior jobs are only `closed`/`filled` | Treating closed/filled as blockers |

Drafts with the same department+role are allowed so HR can prepare the next cycle while one posting is still open — the block applies only at transition to `open`.

### 6.4 Lifecycle rules

- **Delete**: only if `applicationCount === 0`. Once applications exist, no hard delete.
- **Reopen**: never reopen `closed`/`filled` for a new cycle. Use **Duplicate Job** → new `draft` copying all fields except `status`, `slug`, `positionsFilled`, `applicationCount`. Original remains history.
- **Positions**: later, each Hired application increments `positionsFilled`; at headcount, status → `filled`.

---

## 7. Job creation — 4-step wizard (autosave draft each step)

Each **Next** upserts the draft Job so HR can leave and resume from the list (“Continue Editing”).

### Step 1 — Basics

Department → Role (filtered by department) → Title (from Role, editable) → Job Type → Positions Available → Salary Min / Max (`max >= min`).

### Step 2 — Description

Rich text editor (bold, italic, bullets, numbered list, headings). Pre-fill from `role.defaultDescription` if present; fully editable; does not mutate Role.

### Step 3 — Application Fields

- **+ Add field** only (no experience/education section toggles): label, type, required, constraint, section (`personal` \| `experience` \| `education`). List with edit/remove. Empty list is allowed (system personal fields still apply later at apply time).

### Step 4 — Review & Publish

Read-only public-style preview: title, formatted description, job type, salary range, positions available.

| Action | Effect |
|---|---|
| **Save as Draft** | Stay `draft`; no slug |
| **Publish** | Conflict check (§6.3); on success generate slug, `status = open`, `publishedAt = now` |

---

## 8. Job listing (HR-facing)

Top metric cards: **Total jobs**, **Total opened jobs**, **Average applicants on a job**, **Total closed jobs**.

Toolbar: search (title, description plain text, job id) + department filter + role filter + **Create job** (opens wizard page).

Table columns: title, department, role, status (badge), positions (`filled/available`), jobType, createdAt, applicationCount.

| Status | Row actions |
|---|---|
| `draft` | Continue Editing (resume wizard at last incomplete step); Delete (only if `applicationCount === 0`) |
| `open` | View; Close (modal → required `closeReason` → `closed` + `closedAt = now`) |
| `filled` / `closed` | View; Duplicate Job |

---

## 9. Job detail (HR-facing)

Read-only: all Job fields, rendered rich-text description, status badge, positions progress, and the same status-appropriate actions as the list (Close / Duplicate / Continue Editing).

---

## 10. Application

- Fields: `jobId`, `roleSnapshot` (dept + role title at submit), `answers[]` matching that Job’s `fieldsConfig` at submit, `resumeUrl`, `status`, `source`, `campaign`, `createdAt`.
- Applications link to **Job only** — never directly to Department or Role.
- Status: `submitted` → `under_review` → `interview_scheduled` / `interviewed` → decided (`approved` / `rejected` / `trial`). Interview statuses are derived from interview records.
- Duplicate reapply: flag, do not block.

---

## 11. Tags (later)

Free-form `{name, color}`, many-to-many with Applications. Filtering and bulk actions.

---

## 12. Interview process

- HR schedules interviews on an application with date, time (display only), and duration. No interviewer assignment.
- Statuses: Scheduled, Completed, Cancelled, No Show. Overdue is a display flag when still Scheduled and the date has passed.
- HR invites guests with one department link for today. Guest submits name/email; HR approves or rejects. Link expires at midnight.
- Notes are a separate history (author name/email + time). Mark Complete requires at least one note and is HR-only.
- Reschedule updates the same interview in place. Cancel and No Show keep notes.

---

## 13. Decision (later)

- Approve / Reject / Trial — written reason mandatory.
- Approve (hired) increments `Job.positionsFilled`; at capacity → `filled`.
- Remaining applicants: manual status updates; optional bulk reject remaining.

---

## 14. Notifications

HR in-app bell + optional browser push for: new application, interview access request pending approval. Guest interviewers are notified by email on approve/reject only (no account, no bell).

---

## 15. AI agent (later)

1. **Smart Autofill** — resume → form prefill; candidate confirms.
2. **Automatic Ranking** — on submit; summary + fit score stored on Application.
3. **HR Chatbot** — read-only Q&A over stored HR data; never writes or decides.

---

## 16. Source & campaign tracking (later)

- Marketers append UTMs to the Job public URL externally; system stores `utm_source` / `utm_campaign` on Application at submit.
- No create-campaign UI; dashboard is a live read of arrived UTMs.
- Missing UTMs → `source: website`.
- Ad-locked landing: tagged link → that Job only (optional unlock to full careers list).

---

## 17. Public careers page (`/`)

- Lists `open` Jobs grouped by department (accordion).
- Filters: team (department) + search by role title. No office/location filter.
- Permanent slug URL per Job; Apply form comes later.

---

## Cross-entity rules (quick reference)

- No hard delete except a zero-application Job (explicit HR action + guard).
- Status changes that affect candidates trigger automatic notifications (when that layer exists).
- Every HR decision requires a written reason.
- Every Application resolves to exactly one Job; Department/Role are via Job (plus snapshots for history).
- Fields are **not** a first-class entity — only `Job.fieldsConfig`.
- At most one **active** posting (`draft` or `open`) may become/stay `open` per department+role pair — enforced on publish at the API.
- AI is assist/read-only — never overrides HR decisions.
