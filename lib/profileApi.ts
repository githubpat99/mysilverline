import type { FormState } from "@/lib/types";

const API_PROFILE = "/wp-json/silverline/v1/profile";
const API_ME = "/wp-json/wp/v2/users/me?context=edit";

export type WhoAmI = {
  logged_in: boolean;
  user_id: number;
  name?: string | null;
  email?: string | null;
  roles?: string[];
};

function getNonce(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("sl_wp_nonce") || "";
}

export async function whoAmI(): Promise<WhoAmI> {
  const nonce = getNonce();

  const res = await fetch(API_ME, {
    credentials: "include",
    headers: nonce ? { "X-WP-Nonce": nonce } : {},
  });

  if (!res.ok) return { logged_in: false, user_id: 0 };

  const u = await res.json();
  return {
    logged_in: true,
    user_id: u?.id ?? 0,
    name: u?.name ?? null,
    email: u?.email ?? null,
    roles: Array.isArray(u?.roles) ? u.roles : [],
  };
}

export async function loadProfile(): Promise<FormState | null> {
  const nonce = getNonce();

  const res = await fetch(API_PROFILE, {
    credentials: "include",
    headers: nonce ? { "X-WP-Nonce": nonce } : {},
  });

  if (!res.ok) return null;

  const json = await res.json();
  if (!json?.ok || !json.form) return null;

  return json.form as FormState;
}

export async function saveProfile(form: FormState, completedStep = 0): Promise<boolean> {
  const nonce = getNonce();

  const res = await fetch(API_PROFILE, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(nonce ? { "X-WP-Nonce": nonce } : {}),
    },
    body: JSON.stringify({
      ...form,
      completed_step: completedStep,
    }),
  });

  return res.ok;
}
