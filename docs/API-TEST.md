# API Test Guide

Base URL (local dev): `http://localhost:3000`

Use a REST client (Postman, Insomnia, VS Code REST Client) or `curl`. After login, the `colan_token` cookie is set automatically — reuse it for authenticated requests.

---

## 1. Onboard new tenant (no auth)

```http
POST http://localhost:3000/api/companies/onboard
Content-Type: application/json

{
  "companyName": "Test Corp",
  "adminName": "Test Admin",
  "adminEmail": "testadmin@testcorp.com",
  "adminPassword": "testpass123"
}
```

---

## 2. Login (existing user)

```http
POST http://localhost:3000/api/auth/login
Content-Type: application/json

{
  "email": "admin@colan.io",
  "password": "admin123"
}
```

**Demo accounts**

| Email | Password | Role |
|-------|----------|------|
| admin@colan.io | admin123 | admin |
| manager@colan.io | manager123 | manager |
| lead@colan.io | lead123 | lead |
| employee@colan.io | employee123 | employee |

---

## 3. Session & workspace (auth required)

```http
GET http://localhost:3000/api/auth/me
Cookie: colan_token=<token>
```

```http
POST http://localhost:3000/api/auth/refresh
Cookie: colan_token=<token>
```

```http
GET http://localhost:3000/api/companies/me
Cookie: colan_token=<token>
```

---

## 4. Tenant-scoped — People & Employees

```http
GET http://localhost:3000/api/employees
Cookie: colan_token=<token>
```

```http
GET http://localhost:3000/api/people
Cookie: colan_token=<token>
```

```http
POST http://localhost:3000/api/people
Content-Type: application/json
Cookie: colan_token=<token>

{
  "employeeId": "COL-9010",
  "name": "New Person",
  "team": "React Team",
  "role": "Employee",
  "bayNumber": "",
  "imageUrl": ""
}
```

```http
GET http://localhost:3000/api/employees/{id}
Cookie: colan_token=<token>
```

---

## 5. Roles (tenant-scoped)

```http
GET http://localhost:3000/api/roles
Cookie: colan_token=<token>
```

```http
GET http://localhost:3000/api/permissions
Cookie: colan_token=<token>
```

---

## 6. Floor plans & seating (tenant-scoped)

```http
GET http://localhost:3000/api/floor-plans
Cookie: colan_token=<token>
```

```http
GET http://localhost:3000/api/floor-plans/chennai
Cookie: colan_token=<token>
```

```http
GET http://localhost:3000/api/floor-plans/chennai/occupancy
Cookie: colan_token=<token>
```

```http
GET http://localhost:3000/api/seating/versions?officeSlug=chennai
Cookie: colan_token=<token>
```

```http
GET http://localhost:3000/api/seating/seat-history?officeSlug=chennai&seatId=A1
Cookie: colan_token=<token>
```

```http
PATCH http://localhost:3000/api/employees
Content-Type: application/json
Cookie: colan_token=<token>

{
  "bayId": "A1",
  "employeeId": "<employee-mongo-id>",
  "officeSlug": "chennai"
}
```

---

## 7. App users (tenant-scoped)

```http
GET http://localhost:3000/api/app-users
Cookie: colan_token=<token>
```

---

## 8. Projects, teams, tasks (shared)

```http
GET http://localhost:3000/api/projects
Cookie: colan_token=<token>
```

```http
GET http://localhost:3000/api/teams
Cookie: colan_token=<token>
```

```http
GET http://localhost:3000/api/tasks
Cookie: colan_token=<token>
```

---

## 9. Utility

```http
GET http://localhost:3000/api/db-status
Cookie: colan_token=<token>
```

```http
POST http://localhost:3000/api/auth/logout
Cookie: colan_token=<token>
```

---

## curl quick test (PowerShell)

```powershell
# Login and save cookie
$body = '{"email":"admin@colan.io","password":"admin123"}'
$login = Invoke-WebRequest -Uri "http://localhost:3000/api/auth/login" -Method POST -Body $body -ContentType "application/json" -SessionVariable session

# Test employees
Invoke-RestMethod -Uri "http://localhost:3000/api/employees" -WebSession $session

# Test roles
Invoke-RestMethod -Uri "http://localhost:3000/api/roles" -WebSession $session

# Test workspace
Invoke-RestMethod -Uri "http://localhost:3000/api/companies/me" -WebSession $session
```

---

## Troubleshooting 403 after upgrade

If you see **403 on `/api/employees` or `/api/roles`** after the tenant update:

1. Hard refresh the page (calls `/api/auth/me` which upgrades the cookie), **or**
2. Log out and log back in, **or**
3. `POST /api/auth/refresh` to re-issue JWT with `companyId`

The app now resolves `companyId` from your account even on legacy cookies, but a refresh/login ensures the JWT is fully up to date.
