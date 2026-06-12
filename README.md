# Secure Ticket

Secure Ticket is a full-stack incident ticketing application built as a local
operations lab.

## Applications

- `secure-ticket-api` - Node.js, TypeScript, Express, JWT authentication,
  structured logging, middleware, and Jest/Supertest tests.
- `secure-ticket-ui` - React, TypeScript, and Vite operations dashboard.

## Implemented Features

- Database-backed login and self-registration with Argon2 password hashing
- JWT sessions with current-user validation
- User, analyst, and administrator roles
- Password changes and administrator role management
- Protected ticket API routes
- Persistent SQLite storage through Prisma ORM
- Ticket list, detail view, search, and status filtering
- Ticket creation with system, severity, and description fields
- Ticket status and assignee updates
- Ticket deletion with confirmation
- Operational metrics for active, critical, unassigned, and resolved tickets
- API health status and request IDs for server log correlation
- Rate limiting, security headers, centralized errors, and structured logs

## Current Limitations

The application is a functional basic local ticketing system, not a
production-ready service.

- Email verification, password reset email, and account deletion are not
  implemented.
- Ticket comments, attachments, notifications, service catalog, reporting, and
  durable audit history are not implemented.
- The frontend does not currently have an automated test suite.

## Prerequisites

- Node.js
- npm

## Local Setup

Install dependencies:

```bash
npm install
npm run install-all
```

Create local environment files:

```bash
cp secure-ticket-api/.env.example secure-ticket-api/.env
cp secure-ticket-ui/.env.example secure-ticket-ui/.env
```

The example API configuration includes a development JWT secret and SQLite
`DATABASE_URL`. Replace secrets before using the application outside local
development.

Create the database, apply migrations, and seed the demo accounts:

```bash
npm --prefix secure-ticket-api run db:setup
```

Start the API and UI together:

```bash
npm run dev
```

- UI: `http://localhost:5173`
- API: `http://localhost:3000`
- Health check: `http://localhost:3000/health`

## Demo Login

Analyst:

```text
Email: analyst@aegiscore.example
Password: demo-password
```

Administrator:

```text
Email: admin@aegiscore.example
Password: admin-password
```

The analyst login is prefilled in local development. Seeded and registered
passwords are stored as Argon2 hashes in SQLite, not as plaintext.

New registrations receive the `USER` role. Users can create and view tickets.
Analysts and administrators can also update ticket status and assignment or
delete tickets. Administrators can assign roles from the account panel.

## Verification

Run the API tests:

```bash
npm --prefix secure-ticket-api test
```

Build both applications:

```bash
npm --prefix secure-ticket-api run build
npm --prefix secure-ticket-ui run build
```

Validate the Prisma schema:

```bash
npm --prefix secure-ticket-api run prisma:validate
```

Create a new development migration after changing the Prisma schema:

```bash
npm --prefix secure-ticket-api run prisma:migrate
```

## Documentation

- [File data flow](docs/file-data-flow.md)
- [Current application state report](docs/current-app-state.md)
