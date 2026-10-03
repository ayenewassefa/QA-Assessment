# BUGS.md — Bug Reports

**Project:** Ella API (NestJS + PostgreSQL)  
**Tester:** Ayenew Assefa  
**Environment:** Local dev (`npm run start:dev`), Windows 10, PostgreSQL 16 in Docker  
**Date:** 2026-09-14

**Severity scale:** Critical · High · Medium · Low  
**Priority scale:** High (fix now) · Medium (next sprint) · Low (backlog)

---

## BUG-001: POST /users returns a fabricated user (`id: 0`) instead of the persisted entity

**Severity:** High  
**Priority:** High  
**Module:** Users  
**Endpoint:** `POST /users`  
**Related:** BUG-002

**Description:**
On any successful creation, the API returns a hardcoded response containing
`id: 0` and no persisted fields, instead of the user entity stored in the
database.

**Steps to Reproduce:**
1. Send `POST /users` with body:
   ```json
   { "name": "Alice", "email": "alice@example.com" }
   ```
2. Observe the response.

**Expected Result:**
- HTTP 201 Created
- Response body contains the persisted user with a real database-generated
  `id` (e.g., `1`), plus `createdAt` / `updatedAt` fields.

**Actual Result:**
```json
{
  "statusCode": 201,
  "message": "User created successfully",
  "data": {
    "name": "Alice",
    "email": "alice@example.com",
    "id": 0,
    "transactions": []
  }
}
```
- `id` is `0` (fabricated).
- `createdAt` / `updatedAt` are missing.

**Evidence:**
- Request: `POST /users` with `{"name":"Alice","email":"alice@example.com"}`
- Response: HTTP 201, body above (captured via Swagger UI on 2026-09-13)

---

## BUG-002: POST /users accepts duplicate email and returns 201 instead of 409 Conflict

**Severity:** Critical  
**Priority:** High  
**Module:** Users  
**Endpoint:** `POST /users`  
**Related:** BUG-001

**Description:**
Submitting a user with an email that already exists is silently accepted.
The API returns HTTP 201 with a fabricated body instead of rejecting the
request with HTTP 409 Conflict. No new record is persisted.

**Steps to Reproduce:**
1. Create a user with:
   ```json
   { "name": "Alice", "email": "alice@example.com" }
   ```
   → HTTP 201
2. Submit the same email again with a different name:
   ```json
   { "name": "Alice2", "email": "alice@example.com" }
   ```
3. Observe the response.

**Expected Result:**
- HTTP 409 Conflict with a clear message ("email already in use").
- No new user created.

**Actual Result:**
```json
{
  "statusCode": 201,
  "message": "User created successfully",
  "data": {
    "name": "Alice2",
    "email": "alice@example.com",
    "id": 0,
    "transactions": []
  }
}
```
- Duplicate email silently "succeeds".
- Client cannot distinguish this from a real registration.

**Evidence:**
- First request: `{"name":"Alice","email":"alice@example.com"}` → HTTP 201
- Second request: `{"name":"Alice2","email":"alice@example.com"}` → HTTP 201
  (expected 409)

---

## BUG-003: Creating a transaction increases product stock instead of decreasing it

**Severity:** Critical  
**Priority:** High  
**Module:** Transactions  
**Endpoint:** `POST /transactions`

**Description:**
Purchasing a product increases its stock. Each transaction should
decrement the product's `quantity` by the purchased amount, but the
current implementation adds to it. The stock counter drifts further from
reality with every sale.

**Steps to Reproduce:**
1. `POST /products` with:
   ```json
   { "name": "TestWidget-20260913b", "price": 9.99, "quantity": 10 }
   ```
   → returns product id 6, quantity 10.
2. `GET /products/6` → confirm quantity is 10.
3. `POST /transactions` with:
   ```json
   { "userId": 1, "productId": 6, "quantity": 3 }
   ```
   → 201, transaction recorded.
4. `GET /products/6` → observe the quantity.

**Expected Result:**
- After selling 3 units, product quantity should be `10 - 3 = 7`.
- Product status should remain `FOR_SALE` (still has stock).
- Once quantity reaches 0, status should become `OUT_OF_STOCK`.

**Actual Result:**
- Product quantity is `13` (10 + 3).
- `status` remains `FOR_SALE`.
- `OUT_OF_STOCK` can never be reached by buying.

**Evidence:**
- `POST /products` → created product 6 with `quantity: 10` (2026-09-13 10:45 UTC)
- `POST /transactions` with `{"userId":1,"productId":6,"quantity":3}` → 201
- `GET /products/6` → `quantity: 13`, `transactions: [{id:7, quantity:3}]`

---

## BUG-004: POST /products accepts negative price

**Severity:** High  
**Priority:** Medium  
**Module:** Products  
**Endpoint:** `POST /products`

**Description:**
The API accepts and persists products with a negative price. Price should
be validated as ≥ 0.

**Steps to Reproduce:**
1. `POST /products` with:
   ```json
   { "name": "Negative price-20260913b", "price": -9.99, "quantity": 10 }
   ```
2. Observe the response.

**Expected Result:**
- HTTP 400 Bad Request with a validation error (e.g., `price must not be less than 0`).

**Actual Result:**
```json
{
  "statusCode": 201,
  "message": "Product created successfully",
  "data": {
    "id": 7,
    "name": "Negative price-20260913b",
    "price": "-9.99",
    "quantity": 10,
    "status": "FOR_SALE"
  }
}
```
Product is persisted with a negative price.

**Evidence:**
- Request: `POST /products` with `{"name":"Negative price-20260913b","price":-9.99,"quantity":10}`
- Response: HTTP 201, body above (2026-09-13 11:23 UTC)

---

## BUG-005: GET /products/{id} with a non-numeric id returns 500 with leaked database error

**Severity:** Medium  
**Priority:** Medium  
**Module:** Products (affects Users and Transactions too)  
**Endpoint:** `GET /products/{id}`

**Description:**
Passing a non-numeric value for the `:id` path parameter causes a 500
Internal Server Error and leaks the raw database driver message to the
client. This should be a 400 Bad Request with a generic message.

**Steps to Reproduce:**
1. `GET /products/abc`

**Expected Result:**
- HTTP 400 Bad Request
- Body: `{ "statusCode": 400, "message": "id must be a positive integer" }`
- No internal database details exposed.

**Actual Result:**
- HTTP 500 Internal Server Error
- Body:
```json
{
  "statusCode": 500,
  "message": "Error retrieving product",
  "error": "invalid input syntax for type integer: \"NaN\""
}
```

**Evidence:**
- Request URL: `http://localhost:4000/products/abc`
- Response: HTTP 500, body above (2026-09-13 11:24 UTC)

**Note:**
The same 500 + leaked error pattern was observed on `GET /users/abc` and
`GET /transactions/abc`, so this is systemic across all three modules.

---

## BUG-006: PUT /products/{id} overwrites price with the quantity value

**Severity:** High  
**Priority:** High  
**Module:** Products  
**Endpoint:** `PUT /products/{id}`  
**Related test case:** TC-PROD-011

**Description:**
When updating a product, the value submitted in `quantity` is written into
the `price` field. The submitted `price` is silently discarded.

**Steps to Reproduce:**
1. Ensure a product exists (e.g., id 3).
2. Send `PUT /products/3` with:
   ```json
   { "name": "TC-Prod-011", "price": 12.50, "quantity": 5 }
   ```
3. Observe the response.

**Expected Result:**
- HTTP 200
- Response shows `price: 12.50`, `quantity: 5`.

**Actual Result:**
```json
{
  "statusCode": 200,
  "message": "Product updated successfully",
  "data": {
    "id": 3,
    "name": "TC-Prod-011",
    "price": 5,
    "quantity": 5,
    "status": "FOR_SALE",
    "createdAt": "2026-09-10T08:40:00.007Z",
    "updatedAt": "2026-09-13T09:03:07.409Z"
  }
}
```
`price` is `5` (the quantity value), not the submitted `12.50`.

**Evidence:**
- Request: `PUT /products/3` with `{"name":"TC-Prod-011","price":12.50,"quantity":5}`
- Response: HTTP 200, `price: 5` (expected 12.50) — captured 2026-09-13 09:03 UTC

---

## BUG-007: POST /users accepts any non-empty string as email (no format validation)

**Severity:** Medium  
**Priority:** Medium  
**Module:** Users  
**Endpoint:** `POST /users`

**Description:**
The API accepts and persists user accounts with an email that is not a
valid email address. Any non-empty string is accepted.

**Steps to Reproduce:**
1. Send `POST /users` with:
   ```json
   { "name": "Bob", "email": "not-an-email" }
   ```
2. Observe the response.

**Expected Result:**
- HTTP 400 Bad Request with a validation error such as
  `email must be an email`.

**Actual Result:**
```json
{
  "statusCode": 201,
  "message": "User created successfully",
  "data": {
    "name": "Bob",
    "email": "not-an-email",
    "id": 0,
    "transactions": []
  }
}
```
The invalid email is stored in the database.

**Evidence:**
- Request: `POST /users` with `{"name":"Bob","email":"not-an-email"}`
- Response: HTTP 201, body above (captured 2026-09-14)

---

## BUG-008: POST /products with quantity 0 keeps status FOR_SALE instead of OUT_OF_STOCK

**Severity:** High  
**Priority:** Medium  
**Module:** Products  
**Endpoint:** `POST /products`  
**Related test case:** TC-PROD-014

**Description:**
Creating a product with `quantity: 0` is accepted, but the product's
`status` remains `FOR_SALE`. A product with no stock should be marked
`OUT_OF_STOCK`. This means zero-stock products are exposed to clients as
available for purchase.

**Steps to Reproduce:**
1. Send `POST /products` with:
   ```json
   { "name": "TC-Prod-014-zero", "price": 5.00, "quantity": 0 }
   ```
2. Observe the response.

**Expected Result:**
- HTTP 201 Created
- Product stored with `quantity: 0` and `status: "OUT_OF_STOCK"`.

**Actual Result:**
```json
{
  "statusCode": 201,
  "message": "Product created successfully",
  "data": {
    "id": 14,
    "name": "TC-Prod-014-zero",
    "price": 5,
    "quantity": 0,
    "status": "FOR_SALE",
    "createdAt": "2026-09-14T06:39:31.381Z",
    "updatedAt": "2026-09-14T06:39:31.381Z"
  }
}
```
`status` is `FOR_SALE` even though `quantity` is `0`.

**Evidence:**
- Request: `POST /products` with `{"name":"TC-Prod-014-zero","price":5.00,"quantity":0}`
- Response: HTTP 201, `status: "FOR_SALE"` (expected `OUT_OF_STOCK`) — captured 2026-09-14

---

## BUG-009: POST /products accepts a 270-character name (no length limit)

**Severity:** Low  
**Priority:** Low  
**Module:** Products  
**Endpoint:** `POST /products`  
**Related test case:** TC-PROD-015

**Description:**
The API accepts product names far longer than any practical UI would
display. No maximum length is enforced, either by validation or by a
database constraint.

**Steps to Reproduce:**
1. Send `POST /products` with a `name` of ~270 characters:
   ```json
   { "name": "AAAA...(270 chars)", "price": 1.00, "quantity": 1 }
   ```
2. Observe the response.

**Expected Result:**
- HTTP 400 Bad Request with a message such as
  `name must be shorter than or equal to 255 characters`.

**Actual Result:**
```json
{
  "statusCode": 201,
  "message": "Product created successfully",
  "data": {
    "id": 15,
    "name": "AAAA...(270 chars)",
    "price": 1,
    "quantity": 1,
    "status": "FOR_SALE",
    "createdAt": "2026-09-14T06:42:17.135Z",
    "updatedAt": "2026-09-14T06:42:17.135Z"
  }
}
```

**Evidence:**
- Request: `POST /products` with a 270-character `name`
- Response: HTTP 201, name stored as-is — captured 2026-09-14

---

## Summary

| ID      | Severity | Priority | Module                  | One-liner                                                       |
|---------|----------|----------|-------------------------|-----------------------------------------------------------------|
| BUG-001 | High     | High     | Users                   | POST /users returns fabricated `id: 0`                          |
| BUG-002 | Critical | High     | Users                   | POST /users accepts duplicate email, returns 201 not 409        |
| BUG-003 | Critical | High     | Transactions            | POST /transactions increases stock instead of decreasing it     |
| BUG-004 | High     | Medium   | Products                | POST /products accepts negative price                           |
| BUG-005 | Medium   | Medium   | All (Products verified) | Non-numeric `:id` → 500 + leaked database error                 |
| BUG-006 | High     | High     | Products                | PUT /products/{id} overwrites price with quantity value         |
| BUG-007 | Medium   | Medium   | Users                   | POST /users accepts invalid email format                        |
| BUG-008 | High     | Medium   | Products                | quantity: 0 keeps status FOR_SALE instead of OUT_OF_STOCK       |
| BUG-009 | Low      | Low      | Products                | POST /products accepts a 270-character name                     |

### Severity vs. priority — quick reference

- **Severity** = how bad is the impact on the system?
  - **Critical** — silent data corruption or security risk
  - **High** — broken behaviour with clear user impact
  - **Medium** — real issue but limited scope
  - **Low** — cosmetic or edge case

- **Priority** = how soon should it be fixed?
  - **High** — fix now, blocks users or corrupts data
  - **Medium** — next sprint
  - **Low** — backlog

### Systemic patterns observed

- **Non-numeric path parameters** (`GET /users/abc`, `GET /products/abc`,
  `GET /transactions/abc`) all return 500 with a raw database error message
  instead of a clean 400. Documented as BUG-005.
- **Error handlers across services** return the raw error message directly
  in the response body. Any unexpected 5xx leaks driver or ORM internals.