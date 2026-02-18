# Offline-First Architecture

## Überblick

Diese App unterstützt vollständige Offline-Funktionalität mit automatischer Synchronisation zum WordPress Backend.

### Features

- ✅ **Offline-First**: App funktioniert komplett offline
- ✅ **Gast-Modus**: Lokale Nutzung ohne Login
- ✅ **Auto-Sync**: Automatische Synchronisation bei Netzwerk-Verfügbarkeit
- ✅ **Conflict Resolution**: Last-Write-Wins Strategie
- ✅ **IndexedDB**: Lokale Persistierung aller Daten
- ✅ **PWA-Ready**: Installierbar als Progressive Web App

## Architektur

### Storage Layers

1. **IndexedDB** (via Dexie.js)
   - Primärer lokaler Speicher
   - Tables: `profile`, `positions`, `events`
   - Sync-Status Tracking für jede Entity

2. **localStorage**
   - Guest UUID (`sl_local_user_id`)
   - Linked Status (`sl_linked`)
   - Feature Flags

3. **WordPress Backend** (MariaDB)
   - Server-Side Source of Truth für eingeloggte User
   - REST API für Sync

### Services

#### AuthService (`lib/services/authService.ts`)
- Guest UUID Management
- Session Detection (whoami)
- Online/Offline Status
- Nonce-Handling

#### DataService (`lib/services/dataService.ts`)
- Repository Pattern
- Automatisches Routing: local ⟷ remote
- Entscheidet basierend auf Auth + Online-Status

#### SyncService (`lib/services/syncService.ts`)
- Bidirektionale Synchronisation
- Push: Lokale Änderungen → Server
- Pull: Server-Daten → Lokal
- Conflict Detection & Resolution

### React Components

#### `<GuestBanner />`
Zeigt Hinweis wenn User im Gast-Modus ist.

#### `<SyncButton />`
Manueller Sync-Trigger. Zeigt Anzahl ausstehender Änderungen.

#### `<SyncStatusBadge />`
Visueller Indicator:
- 🟢 Grün: Synchronisiert
- 🟡 Orange: Ausstehende Änderungen
- 🔴 Rot: Offline
- 🔵 Blau: Synchronisiert gerade

### React Hook

#### `useSync()`
```typescript
const {
  isOnline,           // Netzwerk-Status
  isAuthenticated,    // Login-Status
  stats,              // Sync-Stats (pendingChanges, lastSyncAt)
  isSyncing,          // Sync läuft gerade
  sync,               // Vollständiger Sync (push + pull)
  pullOnly,           // Nur Server → Lokal
  pushOnly,           // Nur Lokal → Server
  refreshStats,       // Stats neu laden
} = useSync();
```

## Entwicklung

### Environment Variables

```bash
# .env.local
NEXT_PUBLIC_OFFLINE_MODE=false  # true = Immer offline (für Testing)
NEXT_PUBLIC_SL_API_BASE=https://example.com/wp-json/silverline/v1
```

### Testing Offline Mode

1. **Browser DevTools**: Network Tab → "Offline" Preset
2. **Environment Variable**: `NEXT_PUBLIC_OFFLINE_MODE=true`
3. **Logout**: App wechselt automatisch zu lokalem Storage

### Datenfluss

#### Offline → Online (Erster Login)

1. User arbeitet offline als Gast
2. User meldet sich an
3. Option: "Lokale Daten übernehmen?"
   - Ja: Push lokale Daten zum Server
   - Nein: Pull Server-Daten (lokal überschreiben)

#### Online Sync

1. User macht Änderungen (automatisch in IndexedDB gespeichert)
2. Entities bekommen `sync_status: "modified"`
3. Manueller Sync-Trigger oder Auto-Sync:
   - Push: Modified Entities → Server
   - Pull: Server-Daten → Lokal
   - Conflict Resolution: Last-Write-Wins

#### Offline → Offline (Persistenz)

- Alle Änderungen nur in IndexedDB
- Keine Sync-Queue (wird bei nächstem Online-Sync abgearbeitet)
- Volle App-Funktionalität

## Deployment

### Frontend

```bash
npm run build    # Static Export
# Output: out/
```

### Backend

Keine Änderungen am WordPress Backend erforderlich! Die bestehenden REST Endpoints funktionieren:

- `GET /profile-v2` → Pull Profile
- `POST /profile-v2` → Push Profile
- `GET /positions` → Pull Positions
- `POST /positions/replace` → Push Positions

## Troubleshooting

### "Sync schlägt fehl"

1. Prüfe Online-Status
2. Prüfe Login (Session Cookie)
3. Browser Console: Netzwerk-Tab
4. WordPress Backend: PHP Error Logs

### "Daten verschwinden nach Reload"

1. Prüfe IndexedDB im Browser (DevTools → Application → IndexedDB)
2. Prüfe Console für Dexie-Errors
3. Hard-Reset: `await db.delete()` in Console

### "Conflict bei Sync"

- Aktuell: Last-Write-Wins automatisch
- Future: UI für manuelle Conflict Resolution

## Roadmap

### Geplant

- [ ] Optimistic UI Updates
- [ ] Background Sync (Service Worker)
- [ ] Conflict Resolution UI
- [ ] Auto-Sync Interval (alle 5min bei Online)
- [ ] Sync-History Log
- [ ] Export/Import lokaler Daten

### Optional

- [ ] Differential Sync (nur Deltas)
- [ ] Multi-Device Sync Indicator
- [ ] Server-Push Notifications
- [ ] Collaborative Editing (OT/CRDT)

## Lizenz

Siehe [../README.md](../README.md)
