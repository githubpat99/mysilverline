# Token-Auth für PWA (Credentials lokal halten)

Damit die Session beim PWA-Neustart erhalten bleibt, ergänzt du das Backend um Token-Auth.

## 1. PHP-Änderungen im Silverline Plugin

### 1.1 Route hinzufügen (in `rest_api_init`)

```php
register_rest_route('silverline/v1', '/auth-token', [
  'methods'  => 'GET',
  'callback' => 'sl_auth_token',
  'permission_callback' => 'sl_perm_logged_in_cookie_only',
]);
```

### 1.2 Token-Helpers einfügen (nach „Auth helpers“)

```php
define('SL_AUTH_TOKEN_META_KEY', 'sl_auth_token');
define('SL_AUTH_TOKEN_EXPIRY_META_KEY', 'sl_auth_token_expiry');
define('SL_AUTH_TOKEN_TTL_DAYS', 7);
define('SL_AUTH_TOKEN_HEADER', 'x-sl-auth-token');

function sl_get_token_from_request(WP_REST_Request $req) {
  $h = $req->get_header(SL_AUTH_TOKEN_HEADER);
  if (is_string($h) && trim($h) !== '') return trim($h);
  $auth = $req->get_header('authorization');
  if (is_string($auth) && preg_match('/^Bearer\s+(\S+)$/i', $auth, $m)) return trim($m[1]);
  return null;
}

function sl_validate_auth_token($token) {
  if (empty($token) || !is_string($token)) return 0;
  global $wpdb;
  $meta = $wpdb->get_results($wpdb->prepare(
    "SELECT user_id, meta_value FROM {$wpdb->usermeta} WHERE meta_key = %s AND meta_value = %s LIMIT 1",
    SL_AUTH_TOKEN_META_KEY,
    $token
  ), ARRAY_A);
  if (empty($meta)) return 0;
  $uid = (int)($meta[0]['user_id'] ?? 0);
  if ($uid <= 0) return 0;
  $expiry = get_user_meta($uid, SL_AUTH_TOKEN_EXPIRY_META_KEY, true);
  if (empty($expiry) || (int)$expiry < time()) return 0;
  return $uid;
}

function sl_ensure_current_user_from_cookie_or_token(WP_REST_Request $req) {
  if (is_user_logged_in()) return;
  $token = sl_get_token_from_request($req);
  if ($token) {
    $uid = sl_validate_auth_token($token);
    if ($uid) {
      wp_set_current_user($uid);
      return;
    }
  }
  if (empty($_COOKIE[LOGGED_IN_COOKIE])) return;
  $cookie  = wp_unslash($_COOKIE[LOGGED_IN_COOKIE]);
  $user_id = wp_validate_auth_cookie($cookie, 'logged_in');
  if ($user_id) wp_set_current_user($user_id);
}

function sl_create_auth_token($user_id) {
  $token = bin2hex(random_bytes(24));
  $expiry = time() + (SL_AUTH_TOKEN_TTL_DAYS * DAY_IN_SECONDS);
  update_user_meta($user_id, SL_AUTH_TOKEN_META_KEY, $token);
  update_user_meta($user_id, SL_AUTH_TOKEN_EXPIRY_META_KEY, $expiry);
  return ['token' => $token, 'expires_at' => $expiry, 'expires_in' => SL_AUTH_TOKEN_TTL_DAYS * DAY_IN_SECONDS];
}

function sl_auth_token(WP_REST_Request $req) {
  $uid = (int) get_current_user_id();
  if ($uid <= 0) return new WP_REST_Response(['ok' => false, 'error' => 'not_logged_in'], 401);
  $data = sl_create_auth_token($uid);
  return new WP_REST_Response(['ok' => true, 'token' => $data['token'], 'expires_in' => $data['expires_in']], 200);
}
```

### 1.3 Bestehende Funktionen anpassen

**Ersetze** `sl_ensure_current_user_from_cookie` durch Aufruf von `sl_ensure_current_user_from_cookie_or_token($req)` in:

- `sl_perm_logged_in_cookie_only`:
```php
function sl_perm_logged_in_cookie_only(WP_REST_Request $req) {
  if (get_current_user_id() === 0) sl_ensure_current_user_from_cookie_or_token($req);
  return (get_current_user_id() > 0);
}
```

- `sl_whoami`:
```php
if (get_current_user_id() === 0) sl_ensure_current_user_from_cookie_or_token($req);
```

- `sl_nonce`:
```php
if (get_current_user_id() === 0) sl_ensure_current_user_from_cookie_or_token($req);
```

## 2. Frontend (bereits umgesetzt)

- `lib/profileApi.ts` speichert Token nach erfolgreichem Login und sendet es bei allen API-Calls mit
- Token liegt in `localStorage` (`sl_auth_token`) und bleibt über App-Neustarts erhalten
