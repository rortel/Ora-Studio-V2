// ══════════════════════════════════════════════════════════════
// FRONTEND — src/lib/use-brand-dna.ts
// Remplace entièrement l'ancien fichier use-brand-dna.ts
// ══════════════════════════════════════════════════════════════

import { useState, useRef, useCallback } from "react";
import { API_BASE, publicAnonKey } from "./supabase";
import { useAuth } from "./auth-context";

// ── Types ──

export interface BrandDNA {
  brand_name: string;
  tagline?: string;
  industry?: string;
  source_url: string;
  domain: string;
  pages_crawled: number;
  word_count?: number;
  analyzed_at: string;
  og_image?: string;
  logo_url?: string;
  target_audience: {
    primary: string;
    secondary: string;
    personas: string[];
  };
  tone_of_voice: {
    primary: string;
    adjectives: string[];
    formality: number;
    confidence: number;
    warmth: number;
    humor: number;
    avoid: string[];
  };
  visual_identity: {
    colors: {
      primary?: string;
      secondary?: string;
      accent?: string;
    };
    typography?: string;
    style?: string;
  };
  messaging: {
    value_proposition: string;
    key_messages: string[];
    keywords: string[];
    cta_style?: string;
  };
  do_say: string[];
  dont_say: string[];
  differentiators: string[];
  competitive_positioning: string;
  brand_archetype?: string;
  products_services?: string[];
  compliance: {
    regulations?: string;
    has_privacy_policy: boolean;
    has_accessibility: boolean;
  };
  confidence_score?: number;
}

type DNAStatus = "idle" | "pending" | "crawling" | "analyzing" | "done" | "error";

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 120_000; // 2 minutes max

const STATUS_LABELS: Record<DNAStatus, string> = {
  idle: "",
  pending: "Initialisation...",
  crawling: `Crawling du site...`,
  analyzing: "Analyse IA en cours...",
  done: "Analyse terminée",
  error: "Erreur",
};

// ── Hook ──

export function useBrandDNA() {
  const [dna, setDna] = useState<BrandDNA | null>(null);
  const [status, setStatus] = useState<DNAStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>("");

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { accessToken, getAuthHeader } = useAuth();
  const tokenRef = useRef(accessToken);
  // keep ref in sync without effect
  tokenRef.current = accessToken;

  const loading = status === "pending" || status === "crawling" || status === "analyzing";

  const stopPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    pollRef.current = null;
    timeoutRef.current = null;
  }, []);

  const headers = useCallback((): Record<string, string> => {
    const token = tokenRef.current || getAuthHeader();
    const h: Record<string, string> = { "Content-Type": "application/json", Authorization: `Bearer ${publicAnonKey}` };
    if (token) h["X-User-Token"] = token;
    return h;
  }, [getAuthHeader]);

  const analyze = useCallback(async (
    url: string,
    opts: { forceRefresh?: boolean; maxPages?: number } = {}
  ): Promise<BrandDNA | null> => {
    stopPolling();
    setStatus("pending");
    setError(null);
    setProgress("Initialisation...");
    setDna(null);

    return new Promise<BrandDNA | null>((resolve) => {
      (async () => {
        try {
          // 1. Soumettre le job
          const res = await fetch(`${API_BASE}/vault/brand-dna`, {
            method: "POST",
            headers: headers(),
            body: JSON.stringify({
              url,
              maxPages: opts.maxPages ?? 3,
              forceRefresh: opts.forceRefresh ?? false,
            }),
          });

          const data = await res.json();

          if (!data.success) {
            setStatus("error");
            setError(data.error || "Échec du démarrage de l'analyse");
            resolve(null);
            return;
          }

          // Cache hit — résultat immédiat
          if (data.status === "done" && data.dna) {
            setDna(data.dna);
            setStatus("done");
            setProgress("Analyse terminée (cache)");
            resolve(data.dna);
            return;
          }

          const { jobId } = data;
          if (!jobId) {
            setStatus("error");
            setError("Pas de jobId retourné");
            resolve(null);
            return;
          }

          console.log(`[useBrandDNA] Job soumis: ${jobId}`);

          // 2. Polling
          const poll = async () => {
            try {
              const pollRes = await fetch(
                `${API_BASE}/vault/brand-dna/status?jobId=${encodeURIComponent(jobId)}`,
                { headers: headers() }
              );
              const pollData = await pollRes.json();

              if (!pollData.success) return; // continue polling

              const currentStatus = pollData.status as DNAStatus;
              setStatus(currentStatus);
              setProgress(STATUS_LABELS[currentStatus] || "");

              if (currentStatus === "done" && pollData.dna) {
                stopPolling();
                setDna(pollData.dna);
                resolve(pollData.dna);
              }

              if (currentStatus === "error") {
                stopPolling();
                setError(pollData.error || "Erreur pendant l'analyse");
                resolve(null);
              }
            } catch (e) {
              console.log(`[useBrandDNA] Poll exception:`, e);
              // Continue — peut être transitoire
            }
          };

          pollRef.current = setInterval(poll, POLL_INTERVAL_MS);

          // Timeout de sécurité
          timeoutRef.current = setTimeout(() => {
            stopPolling();
            setStatus("error");
            setError("L'analyse a pris trop longtemps. Essayez avec moins de pages ou uploadez vos brand guidelines.");
            resolve(null);
          }, POLL_TIMEOUT_MS);

        } catch (err) {
          setStatus("error");
          setError(`Erreur réseau: ${err}`);
          resolve(null);
        }
      })();
    });
  }, [headers, stopPolling]);

  const reset = useCallback(() => {
    stopPolling();
    setStatus("idle");
    setDna(null);
    setError(null);
    setProgress("");
  }, [stopPolling]);

  // Permet de setter le DNA directement (ex: depuis le cache au chargement)
  const setDnaExternal = useCallback((d: BrandDNA | null) => {
    setDna(d);
    if (d) setStatus("done");
  }, []);

  return {
    dna,
    status,
    loading,
    error,
    progress,
    statusLabel: STATUS_LABELS[status] || "",
    analyze,
    reset,
    setDna: setDnaExternal,
  };
}
