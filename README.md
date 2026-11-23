# TRAVORA — Travel Operations Platform

TRAVORA is a full-stack travel operations management platform for managing customers, trips, service bookings, service-category assignments and customer support.

## Technology

- React, TypeScript and Vite
- Node.js and Express
- PostgreSQL hosted on Neon
- Prisma ORM
- Zod request validation
- Role-based authentication and API authorization

## Capabilities

- Overview dashboard with trip counts, departures, service progress and booking attention
- Customer trip management and individual trip details
- Nine service categories: Flights, Stays, Activities, Transfers, Ferry, Visa, Tourist Tax, Arrival Card and Travel Insurance
- Service-wise agent assignment: an administrator assigns an entire category to an agent across all trips
- Admin, Agent and Customer/Viewer access levels enforced by backend queries and route authorization
- Customer portal restricted to the linked customer profile
- Customer Service requests, admin replies and request status tracking
- Search and filtering across trips and booking operations
- Seeded travel records with varied destinations, dates, service statuses and operational notes

## Database model

- `Customer`: customer profile and contact fields
- `Trip`: destination, start date, trip status and refund information
- `ServiceBooking`: an individual service item attached to a trip
- `User`: login identity, role and optional customer profile link
- `ServiceTypeAssignment`: one agent assigned to a service category
- `SupportRequest`: customer messages, related trip/service and administrator response

## Roles

- **ADMIN** — manages trips, bookings, team accounts, service-category assignments and customer requests
- **AGENT** — sees bookings for assigned service categories and can update those service records only
- **VIEWER** — sees only the trips and services belonging to their linked customer profile; cannot edit trip or booking data, but can contact customer service

## Setup with Neon (no Docker)

1. Create a new Neon project and database for TRAVORA. Use an empty database so it does not contain records from another workspace.
2. Copy the pooled connection string into `DATABASE_URL` and the direct connection string into `DIRECT_URL`.
3. Copy `backend/.env.example` to `backend/.env`. Fill the database URLs, generate a 48-byte `AUTH_SECRET`, and set the initial admin name, email and password.
4. From the project root run:

```bash
npm install
npm run db:generate
npm run db:deploy
npm run db:seed
npm run admin:create
npm run dev
```

5. Open `http://localhost:5173`. The API health endpoint is `http://localhost:4000/api/health`.

Run `npm run db:seed` only when preparing the initial dataset. The seed uses stable IDs and upserts records; it does not delete existing customer or trip records. After creating live customer accounts or editing these records, do not rerun the seed unless you intend to refresh the seeded records.

