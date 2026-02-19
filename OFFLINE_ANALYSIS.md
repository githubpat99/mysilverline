# Offline-First Architecture - Codebase Analysis

## Bestehende API-Endpoints

### Authentication
- `GET /wp-json/silverline/v1/whoami` - User info (kein Nonce erforderlich)
- `GET /wp-json/silverline/v1/nonce` - WordPress Nonce erstellen
- `GET /wp-json/silverline/v1/auth-token` - Auth Token für PWA (7 Tage gültig)
- `POST /wp-json/silverline/v1/logout` - Logout

### Profile V2
- `GET /wp-json/silverline/v1/profile-v2` - ProfileV2 laden
- `POST /wp-json/silverline/v1/profile-v2` - ProfileV2 speichern

### Positions
- `GET /wp-json/silverline/v1/positions` - Alle Positionen laden
- `POST /wp-json/silverline/v1/positions/replace` - Alle Positionen ersetzen
- `POST /wp-json/silverline/v1/position-targets/set` - Position Targets setzen

### Events
- `GET /wp-json/silverline/v1/profile-events` - Alle Events laden
- `POST /wp-json/silverline/v1/profile-events/replace` - Alle Events ersetzen

### Musterfall (Beispieldaten)
- `GET /wp-json/silverline/v1/musterfall` - Musterfall laden (ProfileV2 + Positions)

## MariaDB Tabellen

### `wp_sl_finance_basic`
Basis-Profildaten:
- `user_id` (INT, PRIMARY KEY)
- `forecast_horizon_years` (INT)
- `description` (TEXT, optional - für Musterfall)
- `updated_at` (DATETIME)
- Weitere Felder: Haushalt, Personen, Annuals, Meta

### `wp_sl_position`
Positionen (Assets & Debts):
- `id` (AUTO_INCREMENT PRIMARY KEY)
- `user_id` (INT)
- `instrument_id` (VARCHAR - stable client ID)
- `kind` (VARCHAR - "asset" oder "debt")
- `label` (VARCHAR)
- `bucket` (VARCHAR - "instant", "3m_3y", "gt_3y", "locked")
- `asset_type` / `debt_type` (VARCHAR)
- `value_chf` (DECIMAL)
- `annual_flow_chf` (DECIMAL, optional)
- `interest_rate_pct` (DECIMAL, optional für Debts)
- `amortization_json` (JSON, optional)
- `goal` (VARCHAR - "liq" oder "reinvest", für Assets)
- `source_account_key` (VARCHAR, optional)
- `target_account_key` (VARCHAR, optional)
- `note` (TEXT, optional)
- `is_system` (TINYINT - 1 für Liquidität/Schulden System-Konten)
- `created_at`, `updated_at` (DATETIME)

### `wp_sl_position_target`
Position-Ziel-Beziehungen (legacy, wird ersetzt durch account_keys):
- `id` (AUTO_INCREMENT PRIMARY KEY)
- `user_id` (INT)
- `from_instrument_id` (VARCHAR)
- `to_instrument_id` (VARCHAR)
- `created_at` (DATETIME)

### `wp_sl_profile_event`
Profile Events:
- `id` (AUTO_INCREMENT PRIMARY KEY)
- `user_id` (INT)
- `client_id` (VARCHAR - stable UI ID)
- `title` (VARCHAR)
- `start_date` (DATE)
- `end_date` (DATE, optional)
- `recurrence` (VARCHAR - "none", "yearly", "monthly")
- `active` (TINYINT - 0 oder 1)
- `meta_json` (JSON, optional)
- `created_at`, `updated_at` (DATETIME)

### `wp_sl_profile_event_line`
Event Lines (1:1 mit Event):
- `id` (AUTO_INCREMENT PRIMARY KEY)
- `event_id` (INT, FOREIGN KEY zu wp_sl_profile_event)
- `line_type` (VARCHAR - "income" oder "spending")
- `amount_chf` (INT)
- `indexation` (VARCHAR - "inflation", "fixed_real", "fixed_nominal", NULL)
- `category` (VARCHAR, optional)
- `destination` (VARCHAR - für income: "liquidity", "short", "long", "debt")
- `destination_account_key` (VARCHAR, optional - übersteuert destination)
- `funding_json` (JSON - für spending: fundingStrategy, fundingSources, etc.)
- `meta_json` (JSON, optional)

## TypeScript Data Types

### Core Types
- **ProfileV2**: household, instruments, annualsV2, events, meta
- **Instrument**: AssetInstrument | DebtInstrument
- **PositionDTO**: AssetDTO | DebtDTO (flache DTO-Version für API)
- **ProfileEvent**: id?, client_id, title, start_date, end_date?, recurrence, active, line
- **Household**: persons[], domicileCountry?
- **Person**: id, role, firstName?, birthDate, retireAtAge?

### Money Flow
- **AccountKey**: "asset:<id>" oder "debt:<id>"
- **Bucket**: "instant" | "3m_3y" | "gt_3y" | "locked"
- **Goal**: "liq" | "reinvest" (für Assets)
- **Amortization**: type ("direct" | "indirect"), amountAnnual, sourceInstrumentId

## Authentication Flow

### Cookie-basierte Auth (Standard)
1. User meldet sich über WordPress an
2. WordPress setzt Session Cookies (`LOGGED_IN_COOKIE`)
3. Frontend sendet Cookies mit `credentials: "include"`
4. Backend validiert Cookie und erstellt Nonce
5. Frontend sendet Nonce in Header `X-WP-Nonce` für schreibende Operationen

### Token-basierte Auth (PWA Mode)
1. User meldet sich an (Cookie-Auth)
2. Frontend holt Token via `GET /auth-token`
3. Token wird in IndexedDB gespeichert (via `authTokenStorage.ts`)
4. Token ist 7 Tage gültig
5. Bei Requests: Header `X-SL-Auth-Token: <token>`
6. Backend prüft Token in `wp_usermeta` (meta_key: `sl_auth_token`)
7. Token-Auth umgeht Nonce-Requirement

### Nonce Handling
- Nonce wird in `sessionStorage` gespeichert (Key: `sl_wp_nonce`)
- Nonce ist session-gebunden und wird bei jedem Request validiert
- Bei 403 "rest_cookie_invalid_nonce": Nonce wird neu geholt und Request wiederholt
- **WICHTIG**: Nonces dürfen NIE gecacht werden (immer `cache: "no-store"`)

## API Client Libraries

### `lib/profileApi.ts`
- Legacy FormState-basierte API (Finanz-Workflow Wizard)
- `whoAmI()`, `ensureNonce()`, `loadProfile()`, `saveProfile()`
- Nutzt `getApiHeaders()` für Nonce + Token

### `lib/profileApiV2.ts`
- ProfileV2-basierte API (neues Format)
- `whoAmI()`, `loadProfileV2()`, `saveProfileV2Safe()`
- Nonce-Retry-Logik eingebaut

### `lib/positionsApi.ts`
- `getPositions()` - GET /positions
- `savePositionsSafe()` - POST /positions/replace
- Nonce-Retry-Logik eingebaut

### `lib/musterfallApi.ts`
- `loadMusterfall()` - GET /musterfall
- Liefert ProfileV2 + Positions + can_edit Flag

### `lib/authTokenStorage.ts`
- Token in IndexedDB speichern/laden
- `getAuthToken()`, `setAuthToken()`, `clearAuthToken()`
- `restoreTokenFromIndexedDB()` - Lazy-Load beim Start

## Sync-Anforderungen für Offline-First

### Daten, die synchronisiert werden müssen:
1. **ProfileV2** (Household, Meta, Annuals)
2. **Positions** (Assets & Debts mit AccountKeys)
3. **Events** (ProfileEvents mit EventLines)

### Daten, die NICHT lokal gespeichert werden:
- WordPress User Info (whoami)
- Nonces (immer frisch holen)
- Auth Tokens (nur in IndexedDB, nicht in sync queue)

### Sync-Strategie: "Last Write Wins"
- Jeder Datensatz hat `updated_at` Timestamp
- Bei Konflikt: Neuerer Timestamp gewinnt
- Keine Merge-Logik, nur Replace-All (Backend unterstützt bereits Replace)

### Neue Endpoints für Offline-Sync:
1. `POST /sync/pull` - Alle Daten vom Server holen (mit Timestamps)
2. `POST /sync/push` - Lokale Änderungen zum Server senden
3. `POST /sync/resolve` - Konflikte auflösen (optional, für UI-gesteuerte Auflösung)

## Guest User System

### Anforderungen:
- Lokaler Guest User mit UUID in `localStorage`
- Guest-Daten NUR lokal (nicht synchronisiert)
- Bei Login: Option zum Übernehmen der Guest-Daten ins richtige Konto
- Guest Banner: "Sie arbeiten offline. Melden Sie sich an, um zu synchronisieren."

### Implementation:
```typescript
// localStorage Keys:
// - "sl_guest_uuid" - UUID des Guest Users
// - "sl_user_mode" - "guest" | "logged_in"
```

## IndexedDB Schema (Dexie.js)

### Tables:
1. **profiles** - ProfileV2 Daten
   - `userId` (string, primary key) - WordPress user_id oder "guest:<uuid>"
   - `household` (object)
   - `meta` (object)
   - `annualsV2` (object)
   - `updatedAt` (number) - Unix timestamp

2. **positions** - Position Daten
   - `id` (string, primary key) - "{userId}:{instrument_id}"
   - `userId` (string, indexed)
   - `instrument_id` (string)
   - `kind` (string)
   - `data` (object) - Vollständiges PositionDTO
   - `updatedAt` (number)

3. **events** - ProfileEvent Daten
   - `id` (string, primary key) - "{userId}:{client_id}"
   - `userId` (string, indexed)
   - `client_id` (string)
   - `data` (object) - Vollständiges ProfileEvent
   - `updatedAt` (number)

4. **syncQueue** - Pending Sync Operations
   - `id` (auto-increment)
   - `userId` (string, indexed)
   - `operation` (string) - "profile:update" | "positions:replace" | "events:replace"
   - `data` (object)
   - `createdAt` (number)
   - `synced` (boolean)

## Next Steps

1. ✅ Analyse abgeschlossen
2. **TODO**: IndexedDB Schema mit Dexie.js definieren
3. **TODO**: DataService Repository implementieren
4. **TODO**: AuthService erstellen
5. **TODO**: SyncService implementieren
6. **TODO**: Guest User System
7. **TODO**: UI Komponenten
8. **TODO**: WordPress Backend Endpoints erweitern
9. **TODO**: Testing & Dokumentation
