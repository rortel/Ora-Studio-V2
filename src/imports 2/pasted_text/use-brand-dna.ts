/**
 * ORA Studio — src/hooks/useBrandDNA.js
 * Hook React pour analyser une URL et récupérer/stocker le Business DNA.
 */

import { useState, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase"; // ton client Supabase existant

const API_BASE = import.meta.env.VITE_API_URL ?? "";

async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Non authentifié");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.access_token}`,
  };
}

/**
 * @returns {{
 *   dna: object|null,
 *   loading: boolean,
 *   progress: string,
 *   error: string|null,
 *   analyze: (url: string, options?: { forceRefresh?: boolean, maxPages?: number }) => Promise<object>,
 *   fetch: (domain: string) => Promise<object|null>,
 *   reset: () => void,
 * }}
 */
export function useBrandDNA() {
  const [dna, setDna] = useState(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const reset = useCallback(() => {
    setDna(null);
    setError(null);
    setProgress("");
    setLoading(false);
  }, []);

  /**
   * Analyse une URL et retourne le Business DNA.
   */
  const analyze = useCallback(async (url, { forceRefresh = false, maxPages = 5 } = {}) => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    setError(null);
    setDna(null);

    try {
      setProgress("Connexion à Firecrawl...");
      const headers = await getAuthHeaders();

      setProgress(`Crawl du site en cours (jusqu'à ${maxPages} pages)...`);
      const res = await fetch(`${API_BASE}/api/brand-dna`, {
        method: "POST",
        headers,
        signal: abortRef.current.signal,
        body: JSON.stringify({ url, force_refresh: forceRefresh, max_pages: maxPages }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `Erreur ${res.status}` }));
        throw new Error(err.error ?? `Erreur ${res.status}`);
      }

      setProgress("Analyse Claude en cours...");
      const data = await res.json();

      if (!data.success || !data.dna) {
        throw new Error("Réponse invalide du serveur");
      }

      setDna(data.dna);
      setProgress(data.source === "cache" ? "DNA chargé depuis le cache ✓" : `DNA analysé (${data.dna.pages_crawled ?? 1} pages) ✓`);
      return data.dna;

    } catch (err) {
      if (err.name === "AbortError") return null;
      const message = err.message ?? "Erreur inconnue";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Récupère un DNA existant depuis le cache (pas de crawl).
   */
  const fetchExisting = useCallback(async (domain) => {
    setLoading(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const url = new URL(`${API_BASE}/api/brand-dna`);
      url.searchParams.set("domain", domain);

      const res = await fetch(url.toString(), { method: "GET", headers });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`Erreur ${res.status}`);

      const data = await res.json();
      if (data.dna) setDna(data.dna);
      return data.dna ?? null;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    dna,
    loading,
    progress,
    error,
    analyze,
    fetch: fetchExisting,
    reset,
  };
}
