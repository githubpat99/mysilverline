export const SL_API_BASE =
  process.env.NEXT_PUBLIC_SL_API_BASE?.replace(/\/+$/, "") ?? "";

export const BASE_PATH =
  process.env.NEXT_PUBLIC_BASE_PATH ?? "/app-static";
