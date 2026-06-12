# Secure Ticket Current State Report

**Report date:** June 12, 2026  
**Application version:** 0.1.0  
**Repository branch:** `main`

## Executive Summary

Secure Ticket is a functional full-stack ticketing application intended for
local development, learning, demonstration, and small internal workflows. It
supports persistent users and tickets, secure password storage, authenticated
sessions, role-based permissions, ticket lifecycle management, and basic user
administration.

The application is complete enough to operate as a basic local ticketing
system. It is not yet production-ready because it lacks deployment
configuration, email-based account recovery, advanced ticket collaboration,
durable audit records, frontend automated tests, and several operational
controls expected from a public or business-critical service.

## Product Capabilities

### Accounts and Authentication

- Users can create accounts with an email address and password.
- Passwords are hashed with Argon2 before being stored.
- Login creates a signed JSON Web Token (JWT).
- Protected requests validate both the JWT and the current database user.
- Users can change their password after confirming the current password.
- Invalid or stale sessions are cleared by the frontend.

### Roles and Permissions

The application has three roles:

| Role | Capabilities |
| --- | --- |
| `USER` | Register, log in, view tickets, create tickets, and change their password |
| `ANALYST` | All user capabilities plus update ticket status/assignment and delete tickets |
| `ADMIN` | All analyst capabilities plus list users and change other users' roles |

Administrators cannot change their own role through the administration panel,
which reduces the risk of accidentally removing their own access.

### Ticket Management

- Create tickets with a title, description, affected system, and severity.
- View a persistent ticket queue and detailed ticket information.
- Search by ticket ID, title, system, requester, or assignee.
- Filter tickets by status.
- Sort tickets by severity in the UI.
- Assign tickets to a team or analyst.
- Move tickets through `OPEN`, `IN_PROGRESS`, `RESOLVED`, and `CLOSED`.
- Delete tickets with a confirmation prompt.
- Display active, critical, unassigned, and resolved ticket metrics.

Tickets are linked to the database user who created them. All authenticated
users currently see the shared ticket queue; tickets are not private to their
creator.

## Technical Architecture

### Frontend

- React 18
- TypeScript
- Vite
- Browser `sessionStorage` for the JWT
- Responsive custom CSS
- Typed API client for authentication, users, and tickets

The frontend is located in `secure-ticket-ui`.

### Backend

- Node.js
- TypeScript
- Express
- Prisma ORM
- SQLite
- Argon2 password hashing
- JSON Web Tokens
- Pino structured logging
- Helmet security headers
- CORS
- Express rate limiting
- Jest and Supertest

The backend is located in `secure-ticket-api`.

### Data Model

The SQLite database contains:

- `User`: ID, unique email, password hash, role, and timestamps
- `Ticket`: ID, title, description, system, severity, status, creator,
  assignee text, and timestamps

The local development database is stored at:

```text
secure-ticket-api/prisma/dev.db
```

Database schema changes are tracked through Prisma migrations. The database
file itself is local and excluded from Git.

## API Surface

### Public

- `GET /health`
- `POST /auth/register`
- `POST /auth/login`

### Authenticated

- `GET /auth/me`
- `PATCH /auth/password`
- `GET /tickets`
- `POST /tickets`

### Analyst or Administrator

- `PATCH /tickets/:ticketId`
- `DELETE /tickets/:ticketId`

### Administrator

- `GET /admin/users`
- `PATCH /admin/users/:userId/role`

## Security State

Implemented controls:

- Argon2 password hashing
- JWT signature and expiration validation
- Database validation of authenticated users
- Role-based route authorization
- Security response headers through Helmet
- API rate limiting
- Centralized error responses
- Request IDs for tracing
- Structured application and audit logs
- Environment-based JWT secret

Security limitations:

- No email verification
- No password-reset flow
- No token revocation list or refresh-token rotation
- JWT is stored in browser `sessionStorage`
- No multi-factor authentication
- CORS is not restricted to a configured production origin
- Audit events are written to logs rather than a durable audit database
- No automated dependency or security scanning is configured

## Quality and Verification

Verified on June 12, 2026:

- API test suites: 5 passed
- API tests: 31 passed
- API TypeScript build: passed
- UI TypeScript and Vite build: passed
- Prisma schema validation: passed

The backend tests cover authentication, registration, password changes,
database-backed ticket CRUD, role enforcement, user administration, error
handling, and middleware behavior.

The frontend currently has no automated unit, component, or end-to-end test
suite.

## Local Operation

The project can be initialized with:

```bash
npm install
npm run install-all
cp secure-ticket-api/.env.example secure-ticket-api/.env
cp secure-ticket-ui/.env.example secure-ticket-ui/.env
npm --prefix secure-ticket-api run db:setup
npm run dev
```

Default local endpoints:

- UI: `http://localhost:5173`
- API: `http://localhost:3000`
- Health: `http://localhost:3000/health`

The seed process creates analyst and administrator demo accounts documented in
the project README.

## Current Limitations

- SQLite is appropriate for local and small single-instance use, but not the
  preferred database for a scaled multi-instance deployment.
- There is no email verification or password recovery.
- There is no account deletion or account disabling.
- Tickets have no comments, attachments, watchers, tags, due dates, SLA rules,
  or activity timeline.
- Assignees are free-form text rather than database user relationships.
- All users can view all tickets.
- There are no notifications or outbound email integrations.
- Reporting and service catalog modules are placeholders.
- Audit history is not displayed or stored as ticket activity records.
- The frontend has no automated tests.
- There is no container, cloud deployment, backup, or CI/CD configuration.

## Recommended Next Milestones

1. Add frontend component and end-to-end tests for registration, login, ticket
   creation, permissions, and administration.
2. Add ticket comments and a durable activity history.
3. Replace free-form assignment with database-backed user assignment.
4. Add account disabling, password reset, and email verification.
5. Add ticket ownership or team-based visibility rules if tickets should not be
   globally visible.
6. Move production deployments to PostgreSQL and define backup procedures.
7. Restrict CORS, improve session lifecycle controls, and add automated
   dependency/security checks.
8. Add deployment and CI configuration after choosing a hosting environment.

## Overall Assessment

Secure Ticket is currently a credible basic local ticketing system and a strong
full-stack project foundation. Its core workflows are functional and verified:
users can register, authenticate, create persistent tickets, and operate within
role-based permissions. The next stage is not basic CRUD implementation; it is
production hardening, richer collaboration features, and deployment
operations.
