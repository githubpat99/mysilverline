/**
 * localStorage Keys für Offline-Mode.
 */
export const STORAGE_KEYS = {
  LOCAL_USER_ID: "sl_local_user_id",
  LINKED: "sl_linked",
  LAST_SYNC_AT: "sl_last_sync_at",
  LAST_SYNC_WP_UID: "sl_last_sync_wp_uid",
} as const;

export function uuidv4(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
