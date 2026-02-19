<?php
/**
 * Silverline API – Sync-Endpoints für Offline-First
 *
 * Einbinden in silverline-api.php:
 *   add_action('rest_api_init', 'sl_register_sync_routes');
 *   add_action('init', 'sl_maybe_create_sync_tables');
 *
 * - POST /wp-json/silverline/v1/sync/link-user  { local_user_id }
 * - POST /wp-json/silverline/v1/sync/push      { profile?, positions? }
 * - GET  /wp-json/silverline/v1/sync/pull?since=timestamp
 */

function sl_maybe_create_sync_tables() {
  global $wpdb;
  $table = $wpdb->prefix . 'sl_user_mapping';
  if ($wpdb->get_var("SHOW TABLES LIKE '{$table}'") !== $table) {
    $wpdb->query("CREATE TABLE {$table} (
      wp_user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
      local_user_id VARCHAR(64) NOT NULL,
      updated_at DATETIME NOT NULL
    )");
  }
}

function sl_register_sync_routes() {
  register_rest_route('silverline/v1', '/sync/link-user', [
    'methods'  => 'POST',
    'callback' => 'sl_sync_link_user',
    'permission_callback' => 'sl_perm_logged_in_and_nonce',
  ]);

  register_rest_route('silverline/v1', '/sync/push', [
    'methods'  => 'POST',
    'callback' => 'sl_sync_push',
    'permission_callback' => 'sl_perm_logged_in_and_nonce',
  ]);

  register_rest_route('silverline/v1', '/sync/pull', [
    'methods'  => 'GET',
    'callback' => 'sl_sync_pull',
    'permission_callback' => 'sl_perm_logged_in_cookie_only',
  ]);
}

function sl_sync_link_user(WP_REST_Request $req) {
  global $wpdb;
  $body = json_decode($req->get_body(), true);
  $local_user_id = isset($body['local_user_id']) ? sanitize_text_field($body['local_user_id']) : '';

  if (strlen($local_user_id) < 10) {
    return new WP_REST_Response(['ok' => false, 'message' => 'invalid_local_user_id'], 400);
  }

  $uid = (int) get_current_user_id();
  $table = $wpdb->prefix . 'sl_user_mapping';

  $exists = $wpdb->get_var($wpdb->prepare(
    "SELECT 1 FROM {$table} WHERE wp_user_id = %d LIMIT 1",
    $uid
  ));

  if ($exists) {
    $wpdb->update($table, ['local_user_id' => $local_user_id, 'updated_at' => current_time('mysql', 1)], ['wp_user_id' => $uid], ['%s', '%s'], ['%d']);
  } else {
    $wpdb->insert($table, [
      'wp_user_id' => $uid,
      'local_user_id' => $local_user_id,
      'updated_at' => current_time('mysql', 1),
    ], ['%d', '%s', '%s']);
  }

  return new WP_REST_Response(['ok' => true], 200);
}

function sl_sync_push(WP_REST_Request $req) {
  $body = json_decode($req->get_body(), true) ?: [];

  if (isset($body['profile']) && is_array($body['profile'])) {
    $req_profile = new WP_REST_Request('POST');
    $req_profile->set_body(json_encode(['profile' => $body['profile']]));
    $r = sl_profile_v2_post($req_profile);
    if (is_wp_error($r) || ($r->get_status() !== 200 && $r->get_status() !== 201)) {
      return $r;
    }
  }

  if (isset($body['positions']) && is_array($body['positions'])) {
    $req_pos = new WP_REST_Request('POST');
    $req_pos->set_body(json_encode(['positions' => $body['positions']]));
    $r = sl_positions_replace_post($req_pos);
    if (is_wp_error($r) || ($r->get_status() !== 200 && $r->get_status() !== 201)) {
      return $r;
    }
  }

  return new WP_REST_Response(['ok' => true], 200);
}

function sl_sync_pull(WP_REST_Request $req) {
  global $wpdb;
  $uid = (int) get_current_user_id();

  $profile = sl_load_profile_for_uid($uid);
  $t_pos = $wpdb->prefix . 'sl_position';
  $positions = [];
  if (sl_table_exists($t_pos)) {
    sl_ensure_system_positions($uid, $t_pos);
    $positions = sl_positions_load_as_instruments_v3($uid, $t_pos);
    if (!empty($positions)) sl_positions_attach_targets($uid, $positions);
  }
  if (empty($positions)) {
    $positions = sl_get_default_system_positions();
  }

  return new WP_REST_Response([
    'ok' => true,
    'profile' => $profile,
    'positions' => $positions,
  ], 200);
}
