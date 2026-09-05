# HR System — Source of Truth

Canonical spec for agents. Matches the running code. If this file and the code disagree, the code wins — then update this file.

---

## 1. Product

HR hiring workspace: departments/roles → jobs → public apply → applications → interviews → guest interviewer access → in-app notifications.

| In scope | Not built (do not invent) |
|---|---|
| HR register/login | Password reset, MFA, email verify, RBAC |
| Dept + Role CRUD (soft inactive) | Role JD template (`defaultDescription` does not exist) |
| Job 4-step wizard, list, detail, publish/close/duplicate/delete | Reopen closed |
| Public careers + apply | Duplicate-apply flag; tags; AI score/chat |
| Application list/detail, reject + bulk reject, approve/trial from list | Approve / trial on application detail |
| Interview schedule/notes/actions | Interviewer assignment; time-based overdue |
| Dept-day guest invite + approve/reject/revoke | Marketing dashboard |
| HR bell + SSE + optional FCM | |

**Timezone:** all calendar dates (`YYYY-MM-DD`) and “today / overdue / link expiry” use `Asia/Karachi`. Interview `time` is display-only; status rules use **date**, not clock time.

---

## 2. Stack

| Layer | Tech |
|---|---|
| API | Node ≥22, Express 5, TypeScript ESM (`Backend/`) |
| DB | MongoDB via Mongoose 9 (`autoIndex: false`; indexes created on boot) |
| Auth | `jose` HS256 JWT in httpOnly cookie `hr_session`; server `Session` row (hash + revoke + TTL) |
| Passwords | bcryptjs, 12 rounds |
| Validation | Zod 4 on every mutating input |
| Uploads | multer memory → disk; PDF/DOC/DOCX; 5 MB; max 12 files/apply |
| Push | Firebase Admin (optional env); FCM tokens on User |
| Email | Resend (`RESEND_API_KEY`); in-process queue; stub log if key unset |
| Web | Next.js 16 App Router, React 19, Tailwind 4, TanStack Query 5 |
| Editor | TipTap JSON `{ type: "doc", content? }` |
| Icons | lucide-react |
| Public API | `http://localhost:4000/api/v1` (`NEXT_PUBLIC_API_URL`) |
| Frontend | `http://localhost:3000` |

Monorepo: `Backend/src`, `Frontend/src`. No shared package.

---

## 3. Actors

| Actor | Identity | Access |
|---|---|---|
| HR | User `role: "hr"` | Full dashboard. One user type. |
| Candidate | No account | Public `/` and `/apply/[slug]`. Identified by application row. |
| Guest interviewer | No account | `/interview-access/[token]`. Cookie `hr_guest_access` after register. Notes + resume for that dept+day’s **scheduled** interviews only. |

---

## 4. Repo map

```
Backend/src
  app.ts                 CORS (credentials), helmet, json 512kb, cookie, /api/v1
  server.ts              HTTP + Mongo connect + graceful shutdown
  config/                env (zod), database
  middleware/            authenticate, origin, apply-upload, error-handler
  models/                one collection per file
  routes/                Express routers = controllers (no extra layer)
  schemas/               Zod
  services/              auth, email/ (transport, queue, templates), application-side-effects
  notifications/         catalog, service, stream (SSE), fcm, routes
  utils/                 rules, serialize, pagination, cookies, token, uploads, dates

Frontend/src
  app/                   routes only; pages compose client managers
  components/            feature folders + ui/
  lib/                   api, query-keys, typed domain helpers
```

---

## 5. Code patterns (required)

**Backend**

- Router + `asyncHandler`. Throw `ApiError(status, CODE, message, details?)`.
- `authenticate` on all HR routers. `verifyBrowserOrigin` on mutating HR routes (and public apply).
- Zod `.parse(req.body|query)` first. ObjectIds: 24-hex or 404.
- Serialize `_id` → `id` strings. Never leak passwordHash, resume paths in list JSON (files via download routes).
- Envelope: `{ data }` or `{ error: { code, message, fields? } }`. Zod → 422 `VALIDATION_ERROR`. Duplicate key → 409.
- List tables (jobs, applications, interviews, notifications): `{ pagination: { total, page, limit, pages } }` inside `data`. Offset pagination (`skip`/`limit`). Stats from aggregations, never by loading the full collection.
- Calendar helpers: `todayCalendarDate`, `getDateStateFromCalendarDate` (`future` \| `today` \| `passed`).
- Emails: enqueue via `sendEmailBestEffort` / queue — never fail the HTTP action if mail fails. Bulk sends use Resend batch (≤100) off the request path.
- Rate limits: auth 10/15m; apply 20/15m; guest register 20/15m.

**Frontend**

- Client managers (`*-manager.tsx`) own queries/mutations. `apiRequest` / `apiFormRequest` with `credentials: "include"`.
- `queryKeys` in `lib/query/query-keys.ts`. Invalidate parent `all` keys after writes.
- List tables send `page` + `limit` + filters as query params; `keepPreviousData` while paging.
- Toasts: `alerts.success|error` (portal). Forms: field errors from `ApiClientError.fields`.
- Dashboard layout SSR-checks `/auth/me`; missing session → `/login`.
- Destructive/confirm via modal. Row actions: `icon-button` + `Tooltip`, not labeled pills (except primary CTAs).

**UI patterns**

| Pattern | Use |
|---|---|
| `MetricCard` | List page stat row |
| `StatusPills` + tone | Application/interview/registrant status (success/danger/warning/info/sky/violet/neutral) |
| `UserProfile` | Name + email + initials avatar in tables |
| `DateTimeDisplay` | Absolute date + time (not relative) in HR tables |
| `Dropdown` | Filters and selects |
| `Modal` | All dialogs. Desktop: centered card. Mobile: iOS bottom sheet with slide open/close. Do not copy overlay CSS per screen. |
| Rounded-2xl bordered table card | All list tables |
| `PaginationBar` | Bottom of paginated list tables: “Showing a–b of n” + page numbers |
| Gray-50 thead, uppercase xs | Table headers |
| `h-11`/`h-12` rounded-xl inputs | Forms |
| `ToggleRow` | Full-width setting switch (title + description + ON/OFF) |
| `TagInput` | Type-and-enter chips (select field options) |
| Primary CTA indigo-600 | Create / Publish / View all |
| Dark: `data-theme` on `<html>`, localStorage `hr-theme` | Theme |
| Sidebar | Dashboard, Jobs, Applications, Interviews, Scoring*, Assistant*, Configuration. Collapse key `hr-sidebar-collapsed`. \*Nav only — no pages. |

---

## 6. Auth

- **Register:** name ≥2, email unique, password ≥12 with lower+upper+digit+special. Account active immediately. Issues session.
- **Login:** email+password. Dummy bcrypt compare if user missing (timing). Inactive users cannot log in.
- **Session:** JWT `{ sub: userId, sid: sessionId }` + `Session` doc (`tokenHash`, `expiresAt`, `revokedAt`, lastSeen). Cookie `hr_session` httpOnly, `secure` in production, SameSite from env, TTL default 30d.
- **Logout:** revoke session + clear cookie.
- **HR routes:** cookie must verify, session unrevoked/unexpired, user `active`.
- **Guest:** JWT audience `…-guest`, cookie expires at next Karachi midnight. Bound to `registrantId` + `linkToken`.

---

## 7. Database

All docs: timestamps unless noted. No `versionKey`. Soft-delete = `status: inactive` (dept/role). Hard-delete only zero-application **draft** jobs.

| Collection | Key fields | Notes |
|---|---|---|
| User | name, email unique, passwordHash select:false, role `hr`, active, fcmTokens[] | |
| Session | userId, tokenHash unique select:false, expiresAt (TTL index), revokedAt, lastSeenAt, ip, ua | |
| Department | name, normalizedName unique, icon, status, createdBy | |
| Role | name, normalizedName, departmentId, icon, status, createdBy | Unique `(departmentId, normalizedName)` |
| Job | see §9 | slug unique when string; `wizardStep` 1–4 |
| Application | see §11 | links **jobId only**; `roleSnapshot` frozen at apply; `statusHistory[]` append-only `{ status, at }` |
| Interview | applicationId, departmentId (copied from snapshot), label (required, ≤80), date, time, durationMinutes 15–240, status, createdBy | |
| InterviewNote | interviewId, authorName, authorEmail, content ≤2000, createdAt | Separate collection |
| DepartmentAccessLink | token unique, departmentId, accessDate, createdBy | Unique `(departmentId, accessDate)` |
| LinkRegistrant | linkToken, name, email, status, requestedAt, approvedAt | |
| Notification | type, title, body, refId, targetRole `hr`, isRead, createdAt | Shared HR inbox (not per-user) |

Job schema also has unused `locations[]` / `remote` — do not expose or build on them.

---

## 8. API

Base `/api/v1`. Public unless marked **HR**.

| Method | Path | Rules |
|---|---|---|
| GET | `/health` | DB connected? |
| POST | `/auth/register` `/login` | Origin + rate limit |
| GET | `/auth/me` | HR |
| POST | `/auth/logout` | Origin; revoke if cookie present |
| GET/POST/PATCH | `/departments` `/departments/:id` | HR; no DELETE |
| GET/POST/PATCH | `/roles` `/roles/:id` | HR; `?departmentId=`; create needs **active** dept |
| GET | `/jobs` | HR; `q, departmentId, roleId, status, page, limit≤50` default 15; slim list rows (no description/fieldsConfig); stats via aggregation; `{ jobs, stats, pagination }` |
| POST | `/jobs` | HR draft |
| GET | `/jobs/options` | HR; compact `{ id, title, status }[]` for filter dropdowns |
| GET/PATCH/DELETE | `/jobs/:jobId` | PATCH/DELETE **draft only**; DELETE also `applicationCount===0` |
| POST | `/jobs/:id/publish` `/close` `/duplicate` | see §9 |
| GET | `/careers/jobs` | `open` only |
| GET | `/careers/jobs/:slug` | not draft; closed still 200 (apply blocked) |
| POST | `/careers/jobs/:slug/apply` | multipart; origin; rate limit; 409 `DUPLICATE_APPLICATION` if same job + (email **or** CNIC) exists in a non-`rejected` status |
| GET | `/applications` | HR; `q, jobId, status, page, limit≤50` default 15; list fields only; stats via aggregation; `{ applications, stats, pagination }` |
| POST | `/applications/bulk-reject` | HR; requires `jobId`; `dryRun` skips reason; `sendEmail` default true (queued, non-blocking) |
| GET | `/applications/:id` | HR; **side effect:** `submitted` → `under_review` |
| PATCH | `/applications/:id/reject` | reason ≥10 ≤500; `sendEmail` default true |
| PATCH | `/applications/:id/approve` | reason ≥10 ≤500; `sendEmail` default true |
| PATCH | `/applications/:id/trial` | no body |
| GET | `/applications/:id/resume` `/files/:fieldId` | HR download |
| GET/POST | `/applications/:id/interviews` | POST = schedule |
| GET | `/interviews` | HR; `q, jobId, status, bucket, page, limit≤50` default 15; Mongo filters (lookup only when `q`/`jobId`); stats via aggregation; `{ interviews, stats, pagination }` |
| PATCH | `/interviews/:id/reschedule` `/cancel` `/no-show` `/complete` | reschedule: `sendEmail` default true; same date+time as current row → 422 `INTERVIEW_UNCHANGED` |
| POST | `/interviews/:id/notes` | HR |
| POST/GET | `/department-links` | HR create today’s link (idempotent per dept+day) |
| GET | `/department-links/pending` | today’s pending registrants |
| GET | `/department-links/:token/registrants` | |
| POST | `/department-links/:token/send-email` | `{ email }`; unexpired link only |
| PATCH | `/link-registrants/:id/approve` `/reject` `/revoke` | |
| GET | `/interview-access/:token` | public state + expired flag + `expiresAt` |
| POST | `/interview-access/:token/register` | live link only |
| GET | `/interview-access/:token/interviews` | approved guest |
| GET | `…/interviews/:id/resume` | approved guest, scheduled, same dept+date |
| GET | `…/interviews/:id/application` | same; application profile (no status side effect) |
| GET | `…/interviews/:id/files/:fieldId` | same; custom-field file |
| POST | `…/interviews/:id/notes` | same |
| PATCH | `…/interviews/:id/complete` | same; requires ≥1 note |
| GET | `/notifications` | HR; `q, unreadOnly, page, limit≤50` default 20; `{ notifications, unreadCount, pagination }` |
| GET | `/notifications/unread-count` `/stream` | SSE `notification` events |
| PATCH | `/notifications/read-all` `/:id/read` | |
| POST | `/users/fcm-token` | `{ token }` |

Frontend routes: `/` careers, `/apply/[slug]`, `/login` `/register`, `/dashboard`, `/dashboard/jobs` `/new` `/[id]` `/[id]/edit`, `/dashboard/applications` `/[id]`, `/dashboard/interviews`, `/dashboard/notifications`, `/dashboard/configuration` `/job-roles`, `/interview-access/[token]`. Alias `/dashboard/job-roles`.

---

## 9. Department & Role

- Unique names case-insensitive (`normalizedName`). Role unique **within** department.
- Inactive: hidden from job-wizard dropdowns (active-only filter on client). Existing jobs keep refs.
- Role create/move: department must be **active**.
- Icon string (lucide-style). No hard delete.

---

## 10. Job

**Statuses:** `draft` → `open` → `closed` (HR).

**Fields:** title, departmentId, roleId, description (TipTap JSON), descriptionPlain, jobType (`Full-time` \| `Part-time` \| `Contract` \| `Temporary` \| `Internship` \| `Fresher`), salaryMin/Max ≥0, fieldsConfig.customFields[], status, closeReason, applicationCount, wizardStep, slug (null until publish), publishedAt, closedAt, createdBy.

**fieldsConfig.customFields[]:** `{ id, label, type: text|textarea|number|select|date|checkbox|file, required, constraint?, section: personal|experience|education }`. Max 50. Select needs ≥1 option. Empty list allowed.

### Workflow — create (wizard)

Pages: `/dashboard/jobs/new`, resume `/dashboard/jobs/:id/edit` at saved `wizardStep`.

Each **Next** upserts draft (`POST /jobs` then `PATCH`). Stay on step until save succeeds.

1. **Basics** — active dept → roles of that dept → title auto-fills from role name until user edits title → jobType, salary (`max ≥ min` when both set).
2. **Description** — TipTap (bold/italic/lists/headings). Blank JSON allowed on draft; **required to publish**. Does not read/write Role.
3. **Fields** — add/edit/remove custom fields only. Field editor: required is a full-line toggle; select options are type-and-enter chips. No section toggles.
4. **Review** — public-style preview. **Publish** or leave as draft (no slug).

**Publish (`POST …/publish`) — API-enforced:**

1. Status must be `draft`.
2. Complete: non-empty title, jobType, both salaries, salaryMax ≥ min, description present.
3. **Conflict:** no other job with same `departmentId+roleId` and status `draft` or `open` (exclude self). 409 `JOB_DEPARTMENT_ROLE_CONFLICT` names title/status/slug. Closed does **not** block.
4. Slug = `slugify(title)-` + 4 hex chars; retry on collision. `status=open`, `publishedAt=now`, `wizardStep=4`.

Multiple drafts for same dept+role are allowed until one publishes.

**Close:** only `open`; `closeReason` required; sets `closed` + `closedAt`. 409 `JOB_HAS_PENDING_APPLICATIONS` (with `pendingCount`) if any application is not `approved`/`rejected`. `trial` counts as pending. No force-close.

**Duplicate:** only `closed`. New **draft** copies content/fields; resets slug, counts, wizardStep=1, new createdBy.

**Delete:** only `draft` with `applicationCount===0`.

**List UX:** metrics total / opened / avg applicants / closed. Search title + descriptionPlain + ObjectId. Filters dept/role. Columns: title, dept, role, status, type, createdAt, applicants, icon actions. Backend pagination default 15. Filter dropdowns on other pages use `GET /jobs/options`, not the full list.

| Status | Actions |
|---|---|
| draft | Continue editing, Delete (if 0 apps) |
| open | View, Close (modal + reason) |
| closed | View, Duplicate |

---

## 11. Application

**Link:** Job only. Snapshot `{ departmentId, roleId, departmentName, roleName, title }` at submit.

**Status (stored):** `submitted` → `under_review` → `interview_scheduled` \| `interviewed` → `approved` \| `rejected` \| `trial`.

**Status history:** append-only `statusHistory: { status, at }[]` on the application (not a separate collection). `status` stays the denormalized current value for list filters. Every real status write also `$push`es an entry: apply (`submitted`), first detail GET (`under_review`), `recomputeApplicationStatus` (only when the computed status changes), trial (including re-trial), approve, reject/bulk-reject. Re-entries are kept (interview bounce, trial then overwrite then trial again). Existing rows without history are backfilled on boot from `createdAt` + `trialAt`/`approvedAt`/`rejectedAt`/`updatedAt` — intermediate times that were never stored stay missing. Detail JSON includes `statusHistory`; list rows do not. Guest application modal does not render it.

- Opening detail: first GET while `submitted` sets `under_review`.
- **HR detail UX:** candidate header (initials avatar, mailto/tel, `StatusPills`, job link) → quick facts from the detail payload (applied `DateTimeDisplay`, source, interview summary from `status` + `completedInterviewCount`, resume opens existing viewer on click) → decision banner for `approved` / `rejected` / `trial` → Profile / Interviews tabs. Profile is two columns: personal / experience / education / custom answers, plus sidebar snapshot and status timeline (`StatusPills` + `DateTimeDisplay`). Interviews tab is the same table + `icon-button` actions as the interviews list; notes expand from the interview payload already returned by `GET /applications/:id/interviews` (batched notes, no extra fetch). Interviews are requested only when that tab is opened. Reject stays on detail. Approve / trial stay on the list.
- Interview writes call `recomputeApplicationStatus`: if not locked (`approved`/`rejected`): any `scheduled` interview → `interview_scheduled`; else any `completed` → `interviewed`; else `under_review`. `trial` is not locked — a later interview write overwrites it (timestamp `trialAt` remains).
- **Reject** (single/bulk): not if `approved` or `rejected`. Sets reason + `rejectedAt`, **cancels all scheduled interviews**. Optional `sendEmail` (default true) — approve/reject/bulk-reject modals have a Send email toggle, default on. Bulk: same list filters + optional `applicationIds`; `jobId` required; `dryRun` returns count. HTTP returns after the DB write; rejection emails are queued and sent in Resend batches of up to 100 (one click of 50 does not wait on SMTP).
- **Approve** (list): not if `approved` or `rejected`. Reason required (≥10 ≤500) stored as `decisionReason` + `approvedAt`. Does **not** cancel interviews. Optional `sendEmail` (default true). Terminal.
- **Trial** (list): not if `approved` or `rejected`. No reason. Sets `trialAt`. Does **not** cancel interviews. **No email.** Not terminal — can still approve, reject, or schedule more interviews. Re-trial allowed (refreshes `trialAt`).
- Reapply: blocked unless every existing application for that job with the same email **or** CNIC is **rejected**. Not flagged on the HR list.

### Workflow — public apply

`/` lists `open` jobs grouped by department accordion. Filters: team + search title/dept/jobType. Apply → `/apply/[slug]`. Apply page: no brand header; eyebrow is department name only; no divider before the description; Source Serif 4 on this route only. After the JD: divider, sans “Apply for this job”, serif “* indicates a required field”. Apply now scrolls to that heading with a gap below the viewport top and focuses the name field.

Closed slug page still loads; apply returns 409 `JOB_NOT_OPEN`. Draft slug → 404.

**Required system fields:** name, email, phone, date of birth, CNIC (`xxxxx-xxxxxxx-x`), marital status (Single / Married / Divorced / Widowed), resume (pdf/doc/docx ≤5MB). Optional: alternative phone. **Required sections:** ≥1 experience (company, title, startDate; currentlyWorking checkbox disables end date; optional salary; end ≥ start when set), ≥1 education (school, degree; optional CGPA/percentage). Max 8 each.

**Duplicate apply:** after system-field parse, 409 `DUPLICATE_APPLICATION` (“You already have an application for this role.”) if another row for this job has the same email **or** CNIC and status is not `rejected`. A rejected-only match is allowed. Apply page shows this on the existing error alert (not a field error).

Custom answers validated against **that job’s** `fieldsConfig` (required, type, constraints, select options, file types). Stored with label/type/section snapshot. Files saved under uploads; JSON returns `hasFile` not path.

UTM: frontend captures `utm_source`/`utm_campaign` into sessionStorage; apply sends them. Missing source → `"website"`.

On success: `applicationCount++` only if job still `open` (else delete created row + 409). Then async: `notifyHR("new_application")` and `submission-confirmed` email to the candidate.

**HR list:** search name/email; filter job/status. Metrics: total, scheduled, rejected, approved (real counts). Backend pagination default 15. Row click → detail (see HR detail UX above). Every row: view resume, view notes (read-only modal of all interview notes, grouped by interview; fetched on open via `GET /applications/:id/interviews`, not on the list payload). Unlocked row actions: schedule interview, trial (confirm), approve (reason), reject (reason). Approve/reject/bulk-reject modals: heading + close in the header, reason in the body, Send email toggle default on. Trial confirm: heading + close in the header, explanation in the body, no icon. Bulk reject from the filter bar. Status pills: submitted sky, under review amber, interview scheduled indigo, interviewed/trial violet, approved green, rejected red.

---

## 12. Interview

**Stored status:** `scheduled` \| `completed` \| `cancelled` \| `no_show`.

**Display:** if stored `scheduled` and date `< today` → `overdue`. Time unused.

**Actions (scheduled only):**

| Action | When |
|---|---|
| reschedule, cancel | always while scheduled |
| no_show | date is today or passed |
| mark_complete | date today/passed; completing requires ≥1 note (HR or interviewer). Confirmation modal. |

Completed: locked for status changes. **Notes:** writable on `scheduled` and `completed`; not on `cancelled` or `no_show`. Cancel/no-show keep existing notes. Reschedule updates the **same** row (label/date/time/duration), stays `scheduled`.

**Create (`POST /applications/:id/interviews`):** application not approved/rejected. Requires `label`, date, time, duration. Copies `departmentId` from snapshot. Emails candidate scheduled. Recomputes application status. **Conflict:** no other `scheduled` interview for the same application with the same `date` + `time` (409 `INTERVIEW_SLOT_TAKEN`). Duration and label are not part of the check. Cancelled / completed / no-show rows do not block. Same rule on reschedule (exclude the row being updated). Reschedule also requires a new `date` or `time` vs the current row (422 `INTERVIEW_UNCHANGED`); label/duration-only changes are rejected and the interviews page shows an error alert. Reschedule modal: Send email toggle, default on (`sendEmail`, default true).

**Complete:** increments `completedInterviewCount`. **Cancel:** no email. **No-show:** no email.

**Notes:** HR uses session name/email; guest uses registrant name/email. History, never edited. HR may add notes only while status is `scheduled` or `completed`. Notes modal: history cards in the body (compact `UserProfile` initials, note text, bottom-left calendar/clock timestamp); composer in the footer with a circular send-arrow (no Close/Add buttons). Add locked on cancelled/no-show.

**HR list:** search name/email/phone/job/label. Buckets: scheduled / today / tomorrow / overdue. Columns: candidate (`UserProfile`), job, label, phone, when, status pills, icon actions. Backend pagination default 15. Cancel, no-show, and complete open a confirmation modal (heading + close in the header, explanation in the body, no icon); complete is blocked until a note exists. Notes use the same plus-icon modal as guest access (history + add; add locked on cancelled/no-show). Invite modal from this page.

**UX — schedule modal:** heading + close in the header (no helper text). Required label + date on the first row; time + duration on the second. Same modal for reschedule (label prefilled); reschedule adds a Send email toggle, default on.

---

## 13. Invitation (department-day guest access)

**Model:** one `DepartmentAccessLink` per **department + calendar day**. Creating again returns the existing token (200 vs 201). Optional `email` on create sends invite. HR can email the URL later.

URL: `{FRONTEND_URL}/interview-access/{token}`. Expires when `accessDate < today` (midnight Karachi).

**Guest register:** live (unexpired, **today’s**) link; name+email; status `pending_approval`; sets guest cookie; `notifyHR("interview_request")`.

**HR:** approve / reject only from `pending_approval` on unexpired link. Approve sets `approvedAt`, emails guest with URL. Reject emails. **Revoke** only from `approved` (no email). Expired link: cannot approve/reject or email the URL.

**Approved guest:** list interviews `departmentId + accessDate + status=scheduled` only. Resume preview + application details + add notes + mark complete (requires ≥1 note) on those rows. Mark complete notifies HR (`interview_completed`). Revoked/pending → 403. Wrong-day or expired → 410 on live routes.

**UX — guest `/interview-access/[token]`:** Header `HR System` (left) · `Interviewer Portal` (center) · initials avatar (right). Avatar opens name, email, status, expires-at. **Expired or invalid link:** no header — centered expiry/unavailable card only. Approved view is a table (Candidate, Job, Label, Duration, icon actions: mark complete, view CV modal, view application modal, add note modal). Mark complete uses the same confirmation modal as HR (heading + close in the header, explanation in the body, no icon). Register / pending / rejected / revoked stay as centered cards under the header.

**UX — HR Interviews “Invite” modal:** pick department (creates/reuses today’s link), copy URL, email (disabled when expired), history table with created-at, requester pills, Active/Expired status pills, expand registrants, approve/reject/revoke icon actions.

---

## 14. Notifications

Types: `new_application` (href `/dashboard/applications/:id`), `interview_request` (href `/dashboard/interviews?pending=1`), `interview_completed` (href `/dashboard/interviews`; guest mark-complete: “[interviewer] completed interview with [candidate] for [role]”).

Shared HR feed. Insert only via `notifyHR(type, refId)`. Also SSE + optional FCM.

Bell: last 20, mark one/all read, link to `/dashboard/notifications` (search, unread filter, pagination). Unread badge from `/unread-count`.

---

## 15. Emails (Resend)

Optional `RESEND_API_KEY`. If `EMAIL_FROM` is unset (or still a placeholder `example.com` address), the API uses Resend's sandbox sender from their Node.js docs. Sandbox delivers only to the Resend-account email or `delivered@resend.dev`. Production: set `EMAIL_FROM` to an address on a verified domain. Missing key → log stub.

Queue: in-process; HTTP never waits on Resend. Failures retry (429/5xx, 4 attempts) then log. Bulk reject uses `batch.send` (≤100 per call).

Templates live in `Backend/src/services/email/templates/` (one module per family).

| Template | When | Recipient |
|---|---|---|
| `submission-confirmed` | public apply succeeds | candidate |
| `application-approved` | approve and `sendEmail` | candidate (includes reason) |
| `application-rejected` | reject / bulk reject and `sendEmail` | candidate (no reason in the email) |
| `interview-scheduled` | first schedule | candidate |
| `interview-rescheduled` | reschedule and `sendEmail` | candidate |
| `access-invite` | create link with email, or `POST …/send-email` | guest |
| `access-approved` | HR approves registrant | guest + URL |
| `access-rejected` | HR rejects registrant | guest |

No email: interview cancel, no-show, trial, revoke.

Approve / reject / bulk reject / reschedule modals: `ToggleRow` “Send email”, default on.

---

## 16. Cross-rules

- Applications resolve to one Job; dept/role via job + snapshot.
- Fields are not a library — only `Job.fieldsConfig`.
- At most one posting may **become `open`** per dept+role while any other draft/open exists.
- No reopen; next cycle = Duplicate.
- Hiring capacity is not tracked (no positions / `filled`). Approved count is a list metric only.
- Scoring + Assistant sidebar links have no routes.
- Dashboard home metrics are static placeholders.
- Guest never sees HR panel. HR never uses guest cookie.
