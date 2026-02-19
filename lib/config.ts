export const SL_API_BASE =
  process.env.NEXT_PUBLIC_SL_API_BASE?.replace(/\/+$/, "") ?? "";

export const BASE_PATH =
  process.env.NODE_ENV === "production"
    ? "/app-static"
    : (process.env.NEXT_PUBLIC_BASE_PATH || "");
