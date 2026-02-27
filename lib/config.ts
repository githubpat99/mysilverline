export const SL_API_BASE =
  process.env.NEXT_PUBLIC_SL_API_BASE?.replace(/\/+$/, "") ?? "";

export const BASE_PATH =
  process.env.NODE_ENV === "production"
    ? "/app-static"
    : (process.env.NEXT_PUBLIC_BASE_PATH || "");

export const ANALYTICS_WEBSITE_ID =
  process.env.NEXT_PUBLIC_ANALYTICS_WEBSITE_ID?.trim() ?? "";

export const ANALYTICS_SCRIPT_URL =
  process.env.NEXT_PUBLIC_ANALYTICS_SCRIPT_URL?.trim() || "https://cloud.umami.is/script.js";

export const ANALYTICS_HOST_URL =
  process.env.NEXT_PUBLIC_ANALYTICS_HOST_URL?.trim() ?? "";

export const ANALYTICS_DASHBOARD_URL =
  process.env.NEXT_PUBLIC_ANALYTICS_DASHBOARD_URL?.trim() || "https://cloud.umami.is";

export const ANALYTICS_ENABLED = ANALYTICS_WEBSITE_ID.length > 0;
