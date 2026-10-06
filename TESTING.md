# Testing Checklist — Inventory Management System

Work through each section in order. Check items off as you confirm them.
Report anything that fails (unexpected status code, wrong message, UI
not updating, etc.) — for backend checks, note the endpoint, payload,
and what you got back instead.

---

## 1. Authentication

- [ ] Register a new account with valid data → 201, redirected to `/login`
- [ ] Register again with the **same email** → `409 Email is already registered`
- [ ] Register with a password under 8 characters → `422`, clear message
- [ ] Register with mismatched password/confirmPassword → `422 Passwords do not match`
- [ ] Register with an invalid email format (`notanemail`) → `422`
- [ ] Login with correct credentials → `200`, redirected to `/dashboard`
- [ ] Login with wrong password → `401 Invalid email or password`
- [ ] Login with an email that doesn't exist → same generic `401` message (not "user not found" — confirms no email enumeration)
- [ ] Refresh the page while logged in → stays logged in (session restored via `/api/auth/me`)
- [ ] Logout → redirected to `/login`, and `/dashboard` now redirects back to `/login`
- [ ] Hit any protected endpoint (e.g. `GET /api/products`) with **no token** → `401 Not authorized, no token`
- [ ] Hit a protected endpoint with a **malformed/garbage token** → `401 Not authorized, invalid token`
- [ ] Log in **11 times** with wrong credentials within 15 minutes → 11th attempt returns `429`

## 2. Authorization (role boundaries)

- [ ] Staff token → `GET /api/products` succeeds
- [ ] Staff token → `POST /api/products` → `403`
- [ ] Staff token → `PUT/DELETE /api/products/:id` → `403`
- [ ] Staff token → `GET /api/users` → `403`
- [ ] Staff token → `GET /api/users/<their own id>` → succeeds
- [ ] Staff token → `PUT /api/users/<their own id>` with `{"role":"admin"}` → `403 Only admins can change roles`
- [ ] Admin token → all of the above succeed
- [ ] As staff in the browser: Users nav item is hidden, and navigating to `/users` directly redirects away
- [ ] As staff: Add Product / Edit / Delete buttons are hidden on the Products page, but search/filter/sort/view still work

## 3. Products

- [ ] Create a product with all required fields → `201`, `status` correctly derived (`In Stock`/`Low Stock`/`Out of Stock`) from quantity vs. minimum stock level
- [ ] Create a product with a duplicate SKU → `409`
- [ ] Create a product with a non-existent category id → `422 Category does not exist`
- [ ] Create a product missing `name` → `422` with a clear message
- [ ] Create a product with negative `price` or `quantity` → `422`
- [ ] Edit a product's quantity down below its minimum stock level → `status` flips to `Low Stock` automatically
- [ ] Edit a product's quantity to `0` → `status` flips to `Out of Stock`
- [ ] Toggle a product to `Discontinued` in the edit form → status stays `Discontinued` even if quantity is healthy
- [ ] Delete a product → removed from the list, confirmation dialog appeared first

## 4. Inventory Transactions

- [ ] Record a `STOCK_IN` → product quantity increases by the exact amount, transaction appears in history
- [ ] Record a `STOCK_OUT` within available stock → quantity decreases correctly
- [ ] Record a `STOCK_OUT` for **more than available stock** → `409 Insufficient stock: only X unit(s) available`, and the product's quantity is confirmed **unchanged** afterward (check `GET /api/products/:id`)
- [ ] Transaction quantity of `0` or a negative number → `422`
- [ ] `GET /api/transactions` shows newest first, with product name/SKU and performer name populated (not raw ids)

## 5. Categories

- [ ] Create a category → appears in the list and in product-form dropdowns
- [ ] Create a category with a duplicate name → `409`
- [ ] Edit a category's name → reflected everywhere it's referenced
- [ ] Delete a category **with no products** assigned → deletes cleanly
- [ ] Delete a category **with products** assigned, no `reassignTo` → `409` with the correct product count in the message
- [ ] Delete with `?reassignTo=<id>` (or via the UI's reassign dialog) → products move to the new category, old category is deleted

## 6. Users (admin only)

- [ ] View the user list as admin → all users shown with correct roles
- [ ] Promote a staff user to admin → succeeds
- [ ] Demote an admin to staff **when 2+ admins exist** → succeeds
- [ ] Demote an admin to staff **when they're the only admin** → `409 Cannot change role: at least one admin account must remain`
- [ ] Delete a user **when they're the only admin** → `409 Cannot delete: at least one admin account must remain`
- [ ] Delete button is disabled on your own row in the UI

## 7. Dashboard

- [ ] All stat cards show correct numbers matching what's actually in the database
- [ ] Low Stock table lists the right products, sorted by lowest quantity first
- [ ] Recent Transactions table matches the last 10 transactions
- [ ] Inventory-by-category pie chart renders and matches actual category quantities
- [ ] Dashboard loads correctly for both admin and staff accounts

## 8. Search, Filter, Sort, Pagination

- [ ] Search by product name → filters correctly
- [ ] Search by SKU → filters correctly
- [ ] Search by category name → filters correctly (e.g. searching "Electronics" returns products in that category)
- [ ] Category + status filters combined → results satisfy both conditions
- [ ] Sort by price, ascending and descending → order is correct
- [ ] Sort by quantity → order is correct
- [ ] With more than 10 products, pagination controls appear and page through correctly
- [ ] Changing a filter resets back to page 1

## 9. UX States

- [ ] Every list page (Products, Categories, Transactions, Users) shows a **loading** skeleton briefly on load
- [ ] Disconnect the backend (stop `npm run dev` in `server/`) and reload a page → a clean **error** message appears, not a blank screen or console-only error
- [ ] An empty category list / empty product search result shows a friendly **empty state**, not a blank table

## 10. Security spot-checks

- [ ] Inspect response headers (Postman) on any request → security headers present (`X-Content-Type-Options`, etc.)
- [ ] Send `{"email": {"$ne": null}, "password": "x"}` to login → clean `422`, not a 500 or a successful login
- [ ] Confirm `.env` is **not** tracked by git (`git status` shouldn't show it if you've initialized a repo)
- [ ] Confirm no endpoint ever returns a `password` field, even for the logged-in user's own data

---

## Reporting results

For anything that doesn't match the expected behavior, tell me:
1. Which checklist item
2. What you did (exact request/action)
3. What you expected vs. what actually happened

I'll fix it before we move to documentation.
