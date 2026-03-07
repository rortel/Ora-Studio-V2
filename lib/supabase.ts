import { createClient } from "@supabase/supabase-js";
import { projectId, publicAnonKey } from "/utils/supabase/info";

export { publicAnonKey };

export const supabase = createClient(
  `https://${projectId}.supabase.co`,
  publicAnonKey,
);

export const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-cad57f79`;

/**
 * Build headers for API calls to our Edge Function.
 * Sends user JWT directly in Authorization (server decodes JWT locally, no hang risk).
 * Falls back to publicAnonKey if no user token is available.
 */
export function apiHeaders(userToken?: string | null, contentType = true): Record<string, string> {
  const h: Record<string, string> = {
    Authorization: `Bearer ${userToken || publicAnonKey}`,
  };
  if (contentType) h["Content-Type"] = "application/json";
  return h;
}