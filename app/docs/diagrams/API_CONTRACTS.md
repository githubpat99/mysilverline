# Silverline – API Contracts

All endpoints belong to WordPress REST plugin (silverline-api.php).

Base: /wp-json/silverline/v1/

Auth:
- credentials: "include"
- X-WP-Nonce required for write endpoints
- Some read endpoints allow cookie fallback

---

## 1. GET /whoami

Purpose:
- Identify current logged-in user

Returns:
{
  ok: boolean,
  user?: {
    id: number,
    email: string
  }
}

No nonce required.
No write operations.

---

## 2. GET /profile

Purpose:
- Load ProfileV2

Returns:
{
  ok: true,
  profile: ProfileV2 | null
}

Behavior:
- If profile not found → profile: null
- Must NOT mutate DB

---

## 3. POST /profile

Purpose:
- Persist full ProfileV2

Semantics:
- Replace semantics (entire ProfileV2)
- Server normalizes data before write

Payload:
{
  profile: ProfileV2
}

Returns:
{
  ok: boolean,
  profile?: ProfileV2
}

Rules:
- Nonce required
- Logged-in user required
- Must not partially persist corrupted object

---

## 4. GET /positions

Purpose:
- Load positions for user

Returns:
{
  ok: true,
  positions: PositionDTO[]
}

---

## 5. POST /positions

Purpose:
- Replace all positions for user

Semantics:
- Full replace of positions
- Not partial update

Payload:
{
  positions: PositionDTO[]
}

Rules:
- Nonce required
- Logged-in user required
- Must validate instrument IDs

---

## Error Handling

- ok: false for logical failure
- HTTP status codes reflect auth/permission issues
- Frontend must handle saveError state

---

## Non-Functional Rules

- No endpoint may allow write without auth.
- No endpoint may bypass normalization.
- Money fields must be integers.
