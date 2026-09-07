# Colan — Multi-Tenant Employee Workspace

Next.js App Router application with MongoDB, JWT auth, RBAC, and tenant-isolated seating / people management.

## Getting Started

```bash
npm install
npm run dev
```

Set `MONGODB_URI` in `.env` for production data. Without it, the app falls back to in-memory demo mode.

**API testing:** See [`docs/API-TEST.md`](docs/API-TEST.md) for curl/HTTP examples to test every endpoint.

---

## Multi-Tenant Architecture

Each **company** is an isolated workspace (tenant). Users belong to exactly one company via `companyId` on their login account. All tenant-scoped queries filter by `companyId` so one tenant's data never leaks into another's.

### Onboarding a new workspace

```http
POST /api/companies/onboard
Content-Type: application/json

{
  "companyName": "Acme Corp",
  "adminName": "Jane Admin",
  "adminEmail": "jane@acme.com",
  "adminPassword": "securepass123"
}
```

Creates the company, seeds system RBAC roles, creates the first admin employee + login account, and returns a session cookie.

Existing deployments are migrated automatically: a default company (`slug: colan`, name **Colan Infotech**) is created and legacy rows without `companyId` are backfilled.

---

## Database Structure

MongoDB collections and tenant-scoped fields:

### `companies` (tenants)

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | Tenant id |
| `name` | string | Display name |
| `slug` | string | Unique URL slug |
| `createdAt` / `updatedAt` | Date | |

**Indexes:** `{ slug: 1 }` unique

---

### Tenant-scoped collections

All documents below include `companyId: ObjectId` referencing `companies._id`.

#### `app_users` — login accounts

| Field | Type | Notes |
|-------|------|-------|
| `companyId` | ObjectId | Tenant |
| `email` | string | Globally unique login |
| `passwordHash` | string | bcrypt |
| `name` | string | |
| `appRole` | string | RBAC role key |
| `team` | string? | Squad for team-scoped roles |
| `employeeId` | string | Linked directory id |
| `imageUrl` | string | |
| `isProfileCompleted` | boolean | |

**Indexes:** `{ email: 1 }` unique, `{ companyId: 1, email: 1 }`

#### `employees` — people / directory (seating source of truth)

| Field | Type | Notes |
|-------|------|-------|
| `companyId` | ObjectId | Tenant |
| `employeeId` | string | Human-readable id (unique per tenant) |
| `name` | string | |
| `team` | string | Squad name |
| `role` | string | Job title enum |
| `bayNumber` | string | Desk seat id (e.g. `A1`) |
| `officeSlug` | string? | Floor plan slug |
| `cabinId` | string? | Cabin assignment |
| `gender` | string? | |
| `imageUrl` | string | |
| `email` | string? | |
| `directory` | object? | HR fields (department, designation, etc.) |

**Indexes:** `{ companyId: 1, employeeId: 1 }` unique, `{ companyId: 1, officeSlug: 1, bayNumber: 1 }`

> Seating assignments live on `employees.bayNumber` + `officeSlug` / `cabinId`. There are no separate bay/assignment collections.

#### `company_roles` — RBAC role definitions

| Field | Type | Notes |
|-------|------|-------|
| `companyId` | ObjectId | Tenant |
| `key` | string | Stable slug (`admin`, `manager`, …) |
| `name` | string | |
| `permissions` | object | Module permission map |
| `isSystem` | boolean | Built-in roles |
| `teamScopedProjects` / `teamScopedSeating` | boolean? | |

**Indexes:** `{ companyId: 1, key: 1 }` unique

#### `floor_plans` — office layout geometry

| Field | Type | Notes |
|-------|------|-------|
| `companyId` | ObjectId | Tenant |
| `slug` | string | Unique per tenant (`chennai`, …) |
| `name` | string | |
| `rows` | array | Seating row config |
| `seatIds` | string[] | All seat ids |
| `cabins` | object? | Cabin layout |
| `isActive` | boolean | |
| `source` | string? | `seed` \| `manual` \| `excel` \| `ai` |

**Indexes:** `{ companyId: 1, slug: 1 }` unique

#### `seating_versions` — batched seating change snapshots

| Field | Type | Notes |
|-------|------|-------|
| `companyId` | ObjectId | Tenant |
| `officeSlug` | string | Floor plan |
| `version` | number | Incrementing per office |
| `createdBy` | object | Actor (userId, name, email) |
| `changes` | array | Change log |
| `snapshot` | object | Seats + cabins occupancy map |

**Indexes:** `{ companyId: 1, officeSlug: 1, version: -1 }` unique

#### `seating_seat_history` — per-seat audit trail

| Field | Type | Notes |
|-------|------|-------|
| `companyId` | ObjectId | Tenant |
| `officeSlug` | string | |
| `seatId` | string | |
| `action` | string | `assigned`, `moved-in`, … |
| `employeeName` / `employeeId` | string | |
| `previousSeat` / `newSeat` | string? | |
| `createdBy` | object | |

**Indexes:** `{ companyId: 1, officeSlug: 1, seatId: 1, createdAt: -1 }`

---

### Shared (non-tenant) collections

These are not scoped by `companyId` in the current release:

| Collection | Purpose |
|------------|---------|
| `teams` | Squad catalog |
| `employee_details` | Extended HR fields (linked via `employeeRef`) |
| `projects` | Project records |
| `tasks` / `task_comments` / `task_activity` | Task management |
| `team_members` | App user ↔ employee links |
| `gallery` | Image gallery |
| `conversations` / `messages` | Chat |
| `notifications` | User notifications |
| `daily_updates` | Daily standup updates |
| `password_reset_tokens` | Password reset flow |

---

## API Reference

All authenticated routes read `companyId` from the JWT session (`colan_token` cookie). Responses are scoped to the user's tenant automatically.

### New — Companies / Tenants

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `POST` | `/api/companies/onboard` | Public | Create workspace + first admin; sets session cookie |
| `GET` | `/api/companies/me` | Required | Current user's tenant workspace |

---

### Auth

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/api/auth/login` | Credentials → JWT cookie |
| `POST` | `/api/auth/logout` | Clear session |
| `GET` | `/api/auth/me` | Current session (includes `companyId`) |
| `POST` | `/api/auth/refresh` | Refresh JWT from DB |
| `POST` | `/api/auth/forgot-password` | Request reset email |
| `POST` | `/api/auth/reset-password` | Complete password reset |

---

### People & Employees (tenant-scoped)

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/people` | List people (directory view) |
| `POST` | `/api/people` | Create person |
| `GET` | `/api/people/[id]` | Person detail |
| `PATCH` | `/api/people/[id]` | Update person |
| `DELETE` | `/api/people/[id]` | Delete person |
| `GET` | `/api/employees` | List employees |
| `POST` | `/api/employees` | Create employee |
| `PATCH` | `/api/employees` | Batch seating assign / swap / cabin ops |
| `GET` | `/api/employees/[id]` | Employee detail |
| `PATCH` | `/api/employees/[id]` | Update employee |
| `DELETE` | `/api/employees/[id]` | Delete employee |
| `GET` | `/api/employees/[id]/projects` | Employee's projects |

---

### Roles & Permissions (tenant-scoped)

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/roles` | List workspace roles |
| `POST` | `/api/roles` | Create custom role |
| `PATCH` | `/api/roles/[id]` | Update role |
| `DELETE` | `/api/roles/[id]` | Delete role |
| `GET` | `/api/permissions` | Permission catalog |
| `GET` | `/api/permissions/[roleId]` | Role permissions |
| `PATCH` | `/api/permissions/[roleId]` | Update role permissions |

---

### Floor Plans & Seating (tenant-scoped)

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/floor-plans` | List floor plans |
| `POST` | `/api/floor-plans` | Create floor plan |
| `GET` | `/api/floor-plans/[slug]` | Get floor plan |
| `PATCH` | `/api/floor-plans/[slug]` | Update floor plan |
| `DELETE` | `/api/floor-plans/[slug]` | Delete floor plan |
| `GET` | `/api/floor-plans/[slug]/occupancy` | Seat occupancy |
| `POST` | `/api/floor-plans/[slug]/swap-cabins` | Swap cabin identities |
| `POST` | `/api/floor-plans/import` | Bulk import plans |
| `GET` | `/api/seating/versions?officeSlug=` | List seating versions |
| `POST` | `/api/seating/versions` | Save seating changes (batch) |
| `GET` | `/api/seating/versions/[id]` | Version detail + snapshot |
| `GET` | `/api/seating/seat-history?officeSlug=&seatId=` | Per-seat history |
| `POST` | `/api/seating/layout-edit` | AI layout editing |
| `POST` | `/api/seating/ai-generate` | AI layout generation |

---

### App Users (tenant-scoped)

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/app-users` | List login accounts |
| `POST` | `/api/app-users` | Create account |
| `GET` | `/api/app-users/[id]` | Get account |
| `PATCH` | `/api/app-users/[id]` | Update account |
| `DELETE` | `/api/app-users/[id]` | Delete account |

---

### Other domains

| Method | Route | Description |
|--------|-------|-------------|
| `GET/POST` | `/api/projects` | Projects CRUD |
| `GET/PATCH/DELETE` | `/api/projects/[slug]` | Project detail |
| `GET/POST` | `/api/projects/[slug]/members` | Project members |
| `DELETE` | `/api/projects/[slug]/members/[memberId]` | Remove member |
| `GET` | `/api/projects/project-managers` | PM accounts |
| `GET/POST` | `/api/teams` | Teams |
| `GET/PATCH/DELETE` | `/api/teams/[id]` | Team detail |
| `GET` | `/api/teams/assignable-accounts` | Team lead/manager accounts |
| `GET/POST` | `/api/tasks` | Tasks |
| `GET/PATCH/DELETE` | `/api/tasks/[id]` | Task detail |
| `PATCH` | `/api/tasks/[id]/status` | Update task status |
| `GET/POST` | `/api/daily-updates` | Daily updates |
| `GET` | `/api/daily-updates/attendance` | Attendance view |
| `GET` | `/api/daily-updates/project/[id]` | Project daily updates |
| `GET/POST` | `/api/chat/conversations` | Chat conversations |
| `POST` | `/api/chat/conversations/start` | Start conversation |
| `GET/PATCH/DELETE` | `/api/chat/conversations/[id]` | Conversation detail |
| `GET/POST` | `/api/chat/conversations/[id]/messages` | Messages |
| `POST` | `/api/chat/conversations/[id]/read` | Mark read |
| `GET` | `/api/chat/users` | Chat user list |
| `GET` | `/api/chat/users/by-employee/[id]` | User by employee |
| `GET` | `/api/chat/unread` | Unread count |
| `GET/POST` | `/api/notifications` | Notifications |
| `GET` | `/api/notifications/unread` | Unread notifications |
| `POST` | `/api/notifications/read-all` | Mark all read |
| `POST` | `/api/notifications/[id]/read` | Mark one read |
| `GET/POST` | `/api/gallery` | Gallery images |
| `GET/PATCH/DELETE` | `/api/gallery/[id]` | Gallery item |
| `GET` | `/api/analytics/projects` | Project analytics |
| `GET` | `/api/analytics/tasks` | Task analytics |
| `GET` | `/api/analytics/workload` | Workload analytics |
| `GET/PATCH` | `/api/profile-settings` | Profile settings |
| `GET` | `/api/db-status` | Database / collection summary |

---

## Tenant Scoping Implementation

| Layer | File | Role |
|-------|------|------|
| Model | `models/company.model.ts` | Tenant entity |
| Scope helper | `lib/tenant-scope.ts` | `companyScope()`, `requireSessionCompanyId()` |
| Migration | `lib/tenant-migration.ts` | Default company + backfill |
| Business logic | `lib/companies.ts` | Onboarding, lookup |
| API guard | `lib/api/tenant-context.ts` | `requireTenantContext()` for routes |
| Auth | JWT payload includes `companyId` | Session isolation |

---

## Removed (dead code)

The unused `seating_bays` and `seating_assignments` collections/models were removed. Seating occupancy is tracked directly on `employees.bayNumber` / `cabinId` with version history in `seating_versions` and `seating_seat_history`.

---

## Demo Login (default tenant)

When MongoDB is unavailable or seeded:

| Email | Password | Role |
|-------|----------|------|
| admin@colan.io | admin123 | admin |
| manager@colan.io | manager123 | manager |
| lead@colan.io | lead123 | lead |
| employee@colan.io | employee123 | employee |
