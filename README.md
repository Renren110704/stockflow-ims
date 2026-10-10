# StockFlow — Inventory Management System

Final project by **Albina, Baure, De Ocampo, Dula, Lachica**.

A full-stack (MERN) inventory system for tracking products, stock levels
across locations, transactions, purchase orders and reports.

## Features
- Email/password sign-up with OTP verification, Google sign-in, password reset
- Role-based access (admin / staff); admin-only user management
- Products with images, QR codes, CSV import/export and bulk category changes
- Categories, locations and per-location stock levels
- Stock-in / stock-out transactions with a full audit trail
- Purchase orders with receiving
- Dashboard, reports, printable tables and barcode/QR scanning
- Archive (soft delete), light/dark mode, optional daily low-stock email alerts

## Tech stack
**Frontend:** React 19, Vite, MUI, Tailwind CSS, React Router, Recharts, Axios
**Backend:** Node.js, Express, MongoDB (Mongoose), JWT, Helmet, express-rate-limit
**Services:** Brevo (email), Cloudinary (images), Google Identity

## Getting started
1. Install dependencies:
   ```bash
   npm install
   npm run server:install
   ```
2. Copy `.env.example` → `.env` and `server/.env.example` → `server/.env`,
   then fill in at least `MONGO_URI` and `JWT_SECRET`.
3. Run the backend and frontend (two terminals):
   ```bash
   npm run server:dev
   npm run dev
   ```
4. Register an account, then promote it to admin:
   ```bash
   cd server
   npm run seed:admin -- you@example.com
   ```

## Scripts
| Command | Description |
|---|---|
| `npm run dev` | Start the Vite dev server (http://localhost:5173) |
| `npm run build` | Production build of the frontend |
| `npm run lint` | Lint the frontend |
| `npm run server:dev` | Start the API with auto-reload (http://localhost:5000) |
| `npm run server:start` | Start the API |

`GET /api/health` reports whether the API and database are reachable.

## Project structure
```
src/      React app (pages, components, services, hooks, utils)
server/   Express API (routes, controllers, models, middleware, services)
```

## Testing
See [TESTING.md](TESTING.md) for the manual test checklist.