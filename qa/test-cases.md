# Test Cases — Products Module

**Module under test:** Products  
**Tester:** Ayenew Assefa  
**Environment:** Local dev (`npm run start:dev`), Windows 10, PostgreSQL 16 in Docker  
**Date:** 2026-09-14  
**API base URL:** `http://localhost:4000`

**Priority scale:** High (run every build) · Medium (important) · Low (rare)

---

## Test case index

| ID          | Title                                  | Type     | Priority | Status | Bug ref |
|-------------|----------------------------------------|----------|----------|--------|---------|
| TC-PROD-001 | Create product with valid data         | Positive | High     | Pass   | —       |
| TC-PROD-002 | Create product with missing name       | Negative | High     | Pass   | —       |
| TC-PROD-003 | Create product with missing price      | Negative | High     | Pass   | —       |
| TC-PROD-004 | Create product with missing quantity   | Negative | High     | Pass   | —       |
| TC-PROD-005 | Create product with negative price     | Negative | High     | Fail   | BUG-004 |
| TC-PROD-006 | Create product with duplicate name     | Negative | High     | Pass   | —       |
| TC-PROD-007 | List all products                      | Positive | High     | Pass   | —       |
| TC-PROD-008 | Get product by valid id                | Positive | High     | Pass   | —       |
| TC-PROD-009 | Get product by non-existent id         | Negative | Medium   | Pass   | —       |
| TC-PROD-010 | Get product with non-numeric id        | Negative | Medium   | Fail   | BUG-005 |
| TC-PROD-011 | Update product with valid data         | Positive | High     | Fail   | BUG-006 |
| TC-PROD-012 | Update product with invalid id         | Negative | Medium   | Pass   | —       |
| TC-PROD-013 | Update product with negative price     | Negative | Medium   | Fail   | BUG-004, BUG-006 |
| TC-PROD-014 | Create product with quantity = 0       | Edge     | Medium   | Fail   | BUG-008 |
| TC-PROD-015 | Create product with very long name     | Edge     | Low      | Fail   | BUG-009 |
| TC-PROD-016 | Update product with missing fields     | Negative | Low      | Pass (design note) | — |

---

## TC-PROD-001 — Create product with valid data

**Type:** Positive  
**Priority:** High  
**Endpoint:** `POST /products`  
**Preconditions:** API and DB running.

**Steps:**
1. Send `POST /products` with:
   ```json
   { "name": "TC-Prod-001", "price": 9.99, "quantity": 10 }
   ```

**Expected Result:**
- HTTP 201 Created
- Body contains the persisted product with a real DB-generated `id`,
  the submitted values, `status: "FOR_SALE"`, and `createdAt` / `updatedAt`.

**Actual Result:**
```json
{
  "statusCode": 201,
  "message": "Product created successfully",
  "data": {
    "id": 13,
    "name": "TC-Prod-001",
    "price": 9.99,
    "quantity": 10,
    "status": "FOR_SALE",
    "createdAt": "2026-09-13T09:15:24.792Z",
    "updatedAt": "2026-09-13T09:15:24.792Z"
  }
}
```

**Status:** Pass

---

## TC-PROD-002 — Create product with missing name

**Type:** Negative  
**Priority:** High  
**Endpoint:** `POST /products`  
**Preconditions:** API and DB running.

**Steps:**
1. Send `POST /products` with valid JSON that omits the `name` field:
   ```json
   { "price": 1000, "quantity": 5 }
   ```

**Expected Result:**
- HTTP 400 Bad Request
- Validation error indicating `name` is required.

**Actual Result:**
```json
{
  "message": ["name must be a string"],
  "error": "Bad Request",
  "statusCode": 400
}
```

**Status:** Pass

---

## TC-PROD-003 — Create product with missing price

**Type:** Negative  
**Priority:** High  
**Endpoint:** `POST /products`  
**Preconditions:** API and DB running.

**Steps:**
1. Send `POST /products` with:
   ```json
   { "name": "TC-Prod-003", "quantity": 10 }
   ```

**Expected Result:**
- HTTP 400 Bad Request with a validation error for `price`.

**Actual Result:**
```json
{
  "message": ["price must be a number conforming to the specified constraints"],
  "error": "Bad Request",
  "statusCode": 400
}
```

**Status:** Pass

---

## TC-PROD-004 — Create product with missing quantity

**Type:** Negative  
**Priority:** High  
**Endpoint:** `POST /products`  
**Preconditions:** API and DB running.

**Steps:**
1. Send `POST /products` with:
   ```json
   { "name": "TC-Prod-004", "price": 9.99 }
   ```

**Expected Result:**
- HTTP 400 Bad Request with a validation error for `quantity`.

**Actual Result:**
```json
{
  "message": [
    "quantity must not be less than 0",
    "quantity must be a number conforming to the specified constraints"
  ],
  "error": "Bad Request",
  "statusCode": 400
}
```

**Status:** Pass

---

## TC-PROD-005 — Create product with negative price

**Type:** Negative  
**Priority:** High  
**Endpoint:** `POST /products`  
**Preconditions:** API and DB running.  
**Related bug:** BUG-004

**Steps:**
1. Send `POST /products` with:
   ```json
   { "name": "TC-Prod-005", "price": -5, "quantity": 10 }
   ```

**Expected Result:**
- HTTP 400 Bad Request, validation error: price must be ≥ 0.

**Actual Result:**
```json
{
  "statusCode": 201,
  "message": "Product created successfully",
  "data": {
    "id": 9,
    "name": "TC-Prod-005",
    "price": -5,
    "quantity": 10,
    "status": "FOR_SALE",
    "createdAt": "2026-09-13T08:53:03.738Z",
    "updatedAt": "2026-09-13T08:53:03.738Z"
  }
}
```

**Status:** Fail

---

## TC-PROD-006 — Create product with duplicate name

**Type:** Negative  
**Priority:** High  
**Endpoint:** `POST /products`  
**Preconditions:** Product with name `TC-Prod-001` exists.

**Steps:**
1. Send `POST /products` with:
   ```json
   { "name": "TC-Prod-001", "price": 1.00, "quantity": 1 }
   ```

**Expected Result:**
- HTTP 409 Conflict.

**Actual Result:**
```json
{
  "message": "Product name already exists",
  "error": "Conflict",
  "statusCode": 409
}
```

**Status:** Pass

---

## TC-PROD-007 — List all products

**Type:** Positive  
**Priority:** High  
**Endpoint:** `GET /products`  
**Preconditions:** API and DB running, at least one product exists.

**Steps:**
1. Send `GET /products`.

**Expected Result:**
- HTTP 200 with a `data` array of products.

**Actual Result:**
- HTTP 200, `data` array returned with multiple products
  (ids 1, 3, 4, 6, 7, 8, 9, 10, 13, 14, 15).

**Status:** Pass

---

## TC-PROD-008 — Get product by valid id

**Type:** Positive  
**Priority:** High  
**Endpoint:** `GET /products/{id}`  
**Preconditions:** Product with id `3` exists.

**Steps:**
1. Send `GET /products/3`.

**Expected Result:**
- HTTP 200 with the requested product as a single object.

**Actual Result:**
```json
{
  "statusCode": 200,
  "message": "Product retrieved successfully",
  "data": {
    "id": 3,
    "name": "Free",
    "price": "0",
    "quantity": 5,
    "status": "FOR_SALE",
    "transactions": [],
    "createdAt": "2026-09-10T08:40:00.007Z",
    "updatedAt": "2026-09-10T08:40:00.007Z"
  }
}
```

**Status:** Pass

---

## TC-PROD-009 — Get product by non-existent id

**Type:** Negative  
**Priority:** Medium  
**Endpoint:** `GET /products/{id}`  
**Preconditions:** API and DB running.

**Steps:**
1. Send `GET /products/999999`.

**Expected Result:**
- HTTP 404 Not Found.

**Actual Result:**
```json
{
  "message": "Product with ID 999999 not found",
  "error": "Not Found",
  "statusCode": 404
}
```

**Status:** Pass

---

## TC-PROD-010 — Get product with non-numeric id

**Type:** Edge case / Negative  
**Priority:** Medium  
**Endpoint:** `GET /products/{id}`  
**Preconditions:** API and DB running.  
**Related bug:** BUG-005

**Steps:**
1. Send `GET /products/abc`.

**Expected Result:**
- HTTP 400 Bad Request, generic message, no DB internals.

**Actual Result:**
```json
{
  "statusCode": 500,
  "message": "Error retrieving product",
  "error": "invalid input syntax for type integer: \"NaN\""
}
```

**Status:** Fail

---

## TC-PROD-011 — Update product with valid data

**Type:** Positive  
**Priority:** High  
**Endpoint:** `PUT /products/{id}`  
**Preconditions:** Product with id `3` exists.  
**Related bug:** BUG-006

**Steps:**
1. Send `PUT /products/3` with:
   ```json
   { "name": "TC-Prod-011", "price": 12.50, "quantity": 5 }
   ```

**Expected Result:**
- HTTP 200 with updated `name`, `price: 12.50`, `quantity: 5`.

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

**Status:** Fail

---

## TC-PROD-012 — Update product with invalid id

**Type:** Negative  
**Priority:** Medium  
**Endpoint:** `PUT /products/{id}`  
**Preconditions:** API and DB running.

**Steps:**
1. Send `PUT /products/999999` with a valid body.

**Expected Result:**
- HTTP 404 Not Found.

**Actual Result:**
```json
{
  "message": "Product with ID 999999 not found",
  "error": "Not Found",
  "statusCode": 404
}
```

**Status:** Pass

---

## TC-PROD-013 — Update product with negative price

**Type:** Negative  
**Priority:** Medium  
**Endpoint:** `PUT /products/{id}`  
**Preconditions:** Product with id `3` exists.  
**Related bugs:** BUG-004, BUG-006

**Steps:**
1. Send `PUT /products/3` with:
   ```json
   { "name": "TC-Prod-013", "price": -10, "quantity": 5 }
   ```

**Expected Result:**
- HTTP 400 Bad Request, validation error: price must be ≥ 0.

**Actual Result:**
```json
{
  "statusCode": 200,
  "message": "Product updated successfully",
  "data": {
    "id": 3,
    "name": "TC-Prod-013",
    "price": 5,
    "quantity": 5,
    "status": "FOR_SALE",
    "createdAt": "2026-09-10T08:40:00.007Z",
    "updatedAt": "2026-09-14T06:38:29.242Z"
  }
}
```
Two bugs visible here:
- The negative price was accepted (BUG-004 class — validation missing on PUT too).
- `price` shows `5` (the quantity value), not `-10` (BUG-006 — price
  overwritten by quantity).

**Status:** Fail

---

## TC-PROD-014 — Create product with quantity = 0

**Type:** Edge case  
**Priority:** Medium  
**Endpoint:** `POST /products`  
**Preconditions:** API and DB running.  
**Related bug:** BUG-008

**Steps:**
1. Send `POST /products` with:
   ```json
   { "name": "TC-Prod-014-zero", "price": 5.00, "quantity": 0 }
   ```

**Expected Result:**
- HTTP 201 Created
- Product created with `quantity: 0` and `status: "OUT_OF_STOCK"`.

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
The product is created with `quantity: 0` but `status: "FOR_SALE"` — it
should be `OUT_OF_STOCK`.

**Status:** Fail

---

## TC-PROD-015 — Create product with very long name (270+ chars)

**Type:** Edge case  
**Priority:** Low  
**Endpoint:** `POST /products`  
**Preconditions:** API and DB running.  
**Related bug:** BUG-009

**Steps:**
1. Send `POST /products` with a `name` of ~270 characters:
   ```json
   { "name": "AAAA...(270 chars)", "price": 1.00, "quantity": 1 }
   ```

**Expected Result:**
- HTTP 400 Bad Request (name exceeds maximum allowed length)
- OR a documented database-level limit that rejects the row.

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
A 270-character product name is accepted and stored with no length check.

**Status:** Fail

---

## TC-PROD-016 — Update product with missing fields

**Type:** Negative  
**Priority:** Low  
**Endpoint:** `PUT /products/{id}`  
**Preconditions:** Product with id `3` exists.

**Steps:**
1. Send `PUT /products/3` with only `price`:
   ```json
   { "price": 15.00 }
   ```

**Expected Result:**
- Depending on design intent:
  - If `PUT` is a full replace → HTTP 400 is acceptable behaviour.
  - If partial updates are desired → a `PATCH` endpoint should exist.

**Actual Result:**
```json
{
  "message": [
    "name must be a string",
    "quantity must not be less than 0",
    "quantity must be a number conforming to the specified constraints"
  ],
  "error": "Bad Request",
  "statusCode": 400
}
```
The API requires all fields for `PUT` and does not expose a `PATCH`
endpoint (`PATCH /products/3` → 404). This matches the implemented
contract; it is an API design choice, not a defect.

**Status:** Pass (design note)

---

## Summary

| Total | Pass | Fail | Blocked |
|-------|------|------|---------|
| 16    | 11   | 5    | 0       |

**Pass rate:** 11 / 16 = 68.75%

**Bugs found via these test cases:**
- BUG-004 — `POST /products` accepts negative price (also on `PUT`)
- BUG-005 — `GET /products/abc` returns 500 with leaked database error
- BUG-006 — `PUT /products/{id}` overwrites `price` with the `quantity` value
- BUG-008 — `POST /products` with `quantity: 0` keeps `status: FOR_SALE`
  instead of `OUT_OF_STOCK`
- BUG-009 — `POST /products` accepts a 270-character name with no length check

**Design note (not a bug):**
- `PUT` requires all fields and there is no `PATCH` endpoint. Matches the
  implemented contract.