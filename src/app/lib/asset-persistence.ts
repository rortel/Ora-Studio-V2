/**
 * Asset Persistence — Re-hosts external CDN URLs to Supabase Storage
 * so assets remain accessible permanently. Also handles downloads.
 */

import { API_BASE, publicAnonKey } from "./supabase";

interface PersistResult {
  success: boolean;
  signedUrl?: string;
  storagePath?: string;
  error?: string;
}

/**
 * Persist an external asset URL to Supabase Storage.
 * Returns a permanent signed URL (7 days, refreshable).
 */
export async function persistAsset(
  url: string,
  type: "image" | "video" | "audio" | "text",
  assetId: string,
  authToken: string,
): Promise<PersistResult> {
  if (!url || !authToken) return { success: false, error: "Missing url or auth" };

  // Skip if already a Supabase Storage URL
  if (url.includes("supabase.co/storage")) return { success: true, signedUrl: url };

  try {
    const res = await fetch(`${API_BASE}/assets/persist`, {
      method: "POST",
      headers: { "Content-Type": "text/plain", Authorization: `Bearer ${publicAnonKey}` },
      body: JSON.stringify({ url, type, assetId, _token: authToken }),
    });
    const data = await res.json();
    return data;
  } catch (err: any) {
    console.error("[persistAsset] error:", err);
    return { success: false, error: err?.message || "Network error" };
  }
}

/**
 * Refresh a signed URL for a stored asset.
 */
export async function refreshAssetUrl(
  storagePath: string,
  authToken: string,
): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/assets/refresh-url`, {
      method: "POST",
      headers: { "Content-Type": "text/plain", Authorization: `Bearer ${publicAnonKey}` },
      body: JSON.stringify({ storagePath, _token: authToken }),
    });
    const data = await res.json();
    return data.success ? data.signedUrl : null;
  } catch {
    return null;
  }
}

/**
 * Download an asset (works for both Supabase and external URLs).
 */
export async function downloadAsset(
  url: string,
  filename: string,
  type: "image" | "video" | "audio" | "text" = "image",
) {
  const ext = type === "video" ? "mp4" : type === "audio" ? "mp3" : "png";
  const defaultFilename = filename || `ora-asset-${Date.now()}.${ext}`;

  // For Supabase URLs, do blob download
  if (url.includes("supabase.co")) {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = defaultFilename;
      a.click();
      URL.revokeObjectURL(a.href);
      return;
    } catch {
      // Fall through to window.open
    }
  }
  // External URL — open in new tab
  window.open(url, "_blank");
}

/**
 * Persist multiple assets in parallel after generation.
 * Returns a map of assetId → signedUrl.
 */
export async function persistAssets(
  assets: Array<{ url: string; type: "image" | "video" | "audio" | "text"; assetId: string }>,
  authToken: string,
): Promise<Record<string, string>> {
  const results: Record<string, string> = {};
  const promises = assets.map(async (a) => {
    const result = await persistAsset(a.url, a.type, a.assetId, authToken);
    if (result.success && result.signedUrl) {
      results[a.assetId] = result.signedUrl;
    }
  });
  await Promise.allSettled(promises);
  return results;
}
