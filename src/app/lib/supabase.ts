import { createClient } from "@supabase/supabase-js";
import { projectId, publicAnonKey } from "../../../utils/supabase/info";

export { publicAnonKey, projectId };

export const supabase = createClient(
  `https://${projectId}.supabase.co`,
  publicAnonKey,
);

export const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-cad57f79`;

/**
 * Build URL with apikey query param (kept for backward compat + belt-and-suspenders).
 */
export function apiUrl(path: string): string {
  const fullUrl = `${API_BASE}${path}`;
  const sep = fullUrl.includes("?") ? "&" : "?";
  return `${fullUrl}${sep}apikey=${publicAnonKey}`;
}

/**
 * Standard headers: Authorization + text/plain content type.
 * text/plain avoids CORS preflight (application/json triggers OPTIONS which Supabase gateway blocks).
 * Server body-parser handles both application/json and text/plain identically.
 */
export function apiHeaders(contentType = true): Record<string, string> {
  const h: Record<string, string> = {
    Authorization: `Bearer ${publicAnonKey}`,
  };
  if (contentType) h["Content-Type"] = "text/plain";
  return h;
}

/**
 * CORS-safe headers — no Authorization, text/plain. Legacy fallback.
 */
export function apiHeadersSafe(contentType = true): Record<string, string> {
  const h: Record<string, string> = {};
  if (contentType) h["Content-Type"] = "text/plain";
  return h;
}