# HR System — Source of Truth

Canonical spec for agents. Matches the running code. If this file and the code disagree, the code wins — then update this file.

---

## 1. Product

HR hiring workspace: departments/roles → jobs → public apply → applications → interviews → guest interviewer access → in-app notifications.

| In scope | Not built (do not invent) |
|---|---|
| HR register/login | Password reset, MFA, email verify, RBAC |
| Dept + Role CRUD (soft inactive) | Role JD template (`defaultDescription` does not exist) |
| Job 4-step wizard, list, detail, publish/close/duplicate/delete | Auto-`filled` on hire; reopen closed/filled |
| Public careers + apply | Duplicate-apply flag; tags; AI score/chat |
| Application list/detail, reject + bulk reject | Approve / trial decision UI |
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
| Email | Stub: logs template name. Callers already wired — swap transport later |
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
  services/              auth, email, application-side-effects
  notifications/         catalog, service, stream (SSE), fcm, routes
  utils/                 rules, serialize, cookies, token, uploads, dates

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
- Calendar helpers: `todayCalendarDate`, `getDateStateFromCalendarDate` (`future` \| `today` \| `passed`).
- Emails: `sendEmailBestEffort` — never fail the HTTP action if mail fails.
- Rate limits: auth 10/15m; apply 20/15m; guest register 20/15m.

**Frontend**

- Client managers (`*-manager.tsx`) own queries/mutations. `apiRequest` / `apiFormRequest` with `credentials: "include"`.
- `queryKeys` in `lib/query/query-keys.ts`. Invalidate parent `all` keys after writes.
- Toasts: `alerts.success|error` (portal). Forms: field errors from `ApiClientError.fields`.
- Dashboard layout SSR-checks `/auth/me`; missing session → `/login`.
- Destructive/confirm via modal. Row actions: `icon-button` + `Tooltip`, not labeled pills (except primary CTAs).

**UI patterns**

| Pattern | Use |
|---|---|
| `MetricCard` | List page stat row |
| `StatusPills` + tone | Application/interview/registrant status (success/danger/warning/info/neutral) |
| `UserProfile` | Name + email + initials avatar in tables |
| `DateTimeDisplay` | Absolute date + time (not relative) in HR tables |
| `Dropdown` | Filters and selects |
| Rounded-2xl bordered table card | All list tables |
| Gray-50 thead, uppercase xs | Table headers |
| `h-11`/`h-12` rounded-xl inputs | Forms |
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
| Application | see §10 | links **jobId only**; `roleSnapshot` frozen at apply |
| Interview | applicationId, departmentId (copied from snapshot), date, time, durationMinutes 15–240, status, createdBy | |
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
| GET | `/jobs` | HR; `q, departmentId, roleId, status` + stats |
| POST | `/jobs` | HR draft |
| GET/PATCH/DELETE | `/jobs/:jobId` | PATCH/DELETE **draft only**; DELETE also `applicationCount===0` |
| POST | `/jobs/:id/publish` `/close` `/duplicate` | see §9 |
| GET | `/careers/jobs` | `open` only |
| GET | `/careers/jobs/:slug` | not draft; closed/filled still 200 (apply blocked) |
| POST | `/careers/jobs/:slug/apply` | multipart; origin; rate limit |
| GET | `/applications` | HR; `q, jobId, status` + stats |
| POST | `/applications/bulk-reject` | HR; requires `jobId`; `dryRun` skips reason |
| GET | `/applications/:id` | HR; **side effect:** `submitted` → `under_review` |
| PATCH | `/applications/:id/reject` | reason ≥10 ≤500 |
| GET | `/applications/:id/resume` `/files/:fieldId` | HR download |
| GET/POST | `/applications/:id/interviews` | POST = schedule |
| GET | `/interviews` | HR; filter `q, jobId, status, bucket` |
| PATCH | `/interviews/:id/reschedule` `/cancel` `/no-show` `/complete` | |
| POST | `/interviews/:id/notes` | HR |
| POST/GET | `/department-links` | HR create today’s link (idempotent per dept+day) |
| GET | `/department-links/pending` | today’s pending registrants |
| GET | `/department-links/:token/registrants` | |
| POST | `/department-links/:token/send-email` | `{ email }` |
| PATCH | `/link-registrants/:id/approve` `/reject` `/revoke` | |
| GET | `/interview-access/:token` | public state + expired flag |
| POST | `/interview-access/:token/register` | live link only |
| GET | `/interview-access/:token/interviews` | approved guest |
| GET | `…/interviews/:id/resume` | approved guest, scheduled, same dept+date |
| POST | `…/interviews/:id/notes` | same |
| GET | `/notifications` | HR; `q, unreadOnly, page, limit≤50` default 20 |
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

**Statuses:** `draft` → `open` → `closed` (HR) or `filled` (reserved; never set yet).

**Fields:** title, departmentId, roleId, description (TipTap JSON), descriptionPlain, jobType (`Full-time` \| `Part-time` \| `Contract` \| `Temporary` \| `Internship` \| `Fresher`), positionsAvailable ≥1, positionsFilled (system), salaryMin/Max ≥0, fieldsConfig.customFields[], status, closeReason, applicationCount, wizardStep, slug (null until publish), publishedAt, closedAt, createdBy.

**fieldsConfig.customFields[]:** `{ id, label, type: text|textarea|number|select|date|checkbox|file, required, constraint?, section: personal|experience|education }`. Max 50. Select needs ≥1 option. Empty list allowed.

### Workflow — create (wizard)

Pages: `/dashboard/jobs/new`, resume `/dashboard/jobs/:id/edit` at saved `wizardStep`.

Each **Next** upserts draft (`POST /jobs` then `PATCH`). Stay on step until save succeeds.

1. **Basics** — active dept → roles of that dept → title auto-fills from role name until user edits title → jobType, positions, salary (`max ≥ min` when both set).
2. **Description** — TipTap (bold/italic/lists/headings). Blank JSON allowed on draft; **required to publish**. Does not read/write Role.
3. **Fields** — add/edit/remove custom fields only. No section toggles.
4. **Review** — public-style preview. **Publish** or leave as draft (no slug).

**Publish (`POST …/publish`) — API-enforced:**

1. Status must be `draft`.
2. Complete: non-empty title, jobType, both salaries, salaryMax ≥ min, description present.
3. **Conflict:** no other job with same `departmentId+roleId` and status `draft` or `open` (exclude self). 409 `JOB_DEPARTMENT_ROLE_CONFLICT` names title/status/slug. Closed/filled do **not** block.
4. Slug = `slugify(title)-` + 4 hex chars; retry on collision. `status=open`, `publishedAt=now`, `wizardStep=4`.

Multiple drafts for same dept+role are allowed until one publishes.

**Close:** only `open`; `closeReason` required; sets `closed` + `closedAt`.

**Duplicate:** only `filled`/`closed`. New **draft** copies content/fields; resets slug, counts, positionsFilled, wizardStep=1, new createdBy.

**Delete:** only `draft` with `applicationCount===0`.

**List UX:** metrics total / opened / avg applicants / closed. Search title + descriptionPlain + ObjectId. Filters dept/role. Columns: title, dept, role, status, filled/available, type, createdAt, applicants, icon actions.

| Status | Actions |
|---|---|
| draft | Continue editing, Delete (if 0 apps) |
| open | View, Close (modal + reason) |
| filled/closed | View, Duplicate |

---

## 11. Application

**Link:** Job only. Snapshot `{ departmentId, roleId, departmentName, roleName, title }` at submit.

**Status (stored):** `submitted` → `under_review` → `interview_scheduled` \| `interviewed` → `approved` \| `rejected` \| `trial`.

- Opening detail: first GET while `submitted` sets `under_review`.
- Interview writes call `recomputeApplicationStatus`: if not locked (`approved`/`rejected`/`trial`): any `scheduled` interview → `interview_scheduled`; else any `completed` → `interviewed`; else `under_review`.
- **Reject** (single/bulk): not if `approved` or `rejected`. Sets reason + `rejectedAt`, **cancels all scheduled interviews**, emails candidate. Bulk: same list filters + optional `applicationIds`; `jobId` required; `dryRun` returns count.
- Approve/trial: schema only; no HR endpoints yet. `trial` still locked against interview recompute.
- Reapply: **not blocked and not flagged**.

### Workflow — public apply

`/` lists `open` jobs grouped by department accordion. Filters: team + search title/dept/jobType. Apply → `/apply/[slug]`.

Closed/filled slug page still loads; apply returns 409 `JOB_NOT_OPEN`. Draft slug → 404.

**Required system fields:** name, email, phone, resume (pdf/doc/docx ≤5MB). **Required sections:** ≥1 experience (company, title, startDate; end ≥ start), ≥1 education (school, degree). Max 8 each.

Custom answers validated against **that job’s** `fieldsConfig` (required, type, constraints, select options, file types). Stored with label/type/section snapshot. Files saved under uploads; JSON returns `hasFile` not path.

UTM: frontend captures `utm_source`/`utm_campaign` into sessionStorage; apply sends them. Missing source → `"website"`.

On success: `applicationCount++` only if job still `open` (else delete created row + 409). Then `notifyHR("new_application")` async.

**HR list:** search name/email; filter job/status. Metrics: total, scheduled, rejected, approved. Row click → detail (profile + interviews tabs). Reject from list or detail.

---

## 12. Interview

**Stored status:** `scheduled` \| `completed` \| `cancelled` \| `no_show`.

**Display:** if stored `scheduled` and date `< today` → `overdue`. Time unused.

**Actions (scheduled only):**

| Action | When |
|---|---|
| reschedule, cancel | always while scheduled |
| no_show | date is today or passed |
| mark_complete | date today/passed **and** ≥1 note |

Completed: locked (no status change, no new notes). Cancel/no-show keep notes. Reschedule updates the **same** row (date/time/duration), stays `scheduled`.

**Create (`POST /applications/:id/interviews`):** application not approved/rejected. Copies `departmentId` from snapshot. Emails candidate scheduled. Recomputes application status.

**Complete:** increments `completedInterviewCount`. **Cancel:** emails candidate. **No-show:** no email.

**Notes:** HR uses session name/email; guest uses registrant name/email. History, never edited.

**HR list:** search name/email/phone/job. Buckets: scheduled / today / tomorrow / overdue. Columns: candidate (`UserProfile`), job, phone, when, status pills, icon actions. Invite modal from this page.

---

## 13. Invitation (department-day guest access)

**Model:** one `DepartmentAccessLink` per **department + calendar day**. Creating again returns the existing token (200 vs 201). Optional `email` on create sends invite. HR can email the URL later.

URL: `{FRONTEND_URL}/interview-access/{token}`. Expires when `accessDate < today` (midnight Karachi).

**Guest register:** live (unexpired, **today’s**) link; name+email; status `pending_approval`; sets guest cookie; `notifyHR("interview_request")`.

**HR:** approve / reject only from `pending_approval` on unexpired link. Approve sets `approvedAt`, emails guest with URL. Reject emails. **Revoke** only from `approved` (no email). Expired link: cannot approve/reject.

**Approved guest:** list interviews `departmentId + accessDate + status=scheduled` only. Resume download + add notes on those rows. Revoked/pending → 403. Wrong-day or expired → 410 on live routes.

**UX:** Interviews page “Invite” modal: pick department (creates/reuses today’s link), copy URL, email, history table with requester pills, expand registrants, approve/reject/revoke icon actions.

---

## 14. Notifications

Types: `new_application` (href `/dashboard/applications/:id`), `interview_request` (href `/dashboard/interviews?pending=1`).

Shared HR feed. Insert only via `notifyHR(type, refId)`. Also SSE + optional FCM.

Bell: last 20, mark one/all read, link to `/dashboard/notifications` (search, unread filter, pagination). Unread badge from `/unread-count`.

---

## 15. Emails (stubbed)

| Template | When |
|---|---|
| `interview-scheduled` / `rescheduled` / `cancelled` | candidate |
| `application-rejected` | candidate (reason) |
| `access-link-invite` / `approved` / `rejected` | guest |

---

## 16. Cross-rules

- Applications resolve to one Job; dept/role via job + snapshot.
- Fields are not a library — only `Job.fieldsConfig`.
- At most one posting may **become `open`** per dept+role while any other draft/open exists.
- No reopen; next cycle = Duplicate.
- `positionsFilled` / `filled` unused until hire flow.
- Scoring + Assistant sidebar links have no routes.
- Dashboard home metrics are static placeholders.
- Guest never sees HR panel. HR never uses guest cookie.
