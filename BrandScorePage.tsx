import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { API_BASE, publicAnonKey } from "../lib/supabase";
import { useAuth } from "../lib/auth-context";
import {
  Type, Palette, BookOpen, Users, Target, Shield,
  Globe, Search, Loader2, Clock, Check, ArrowRight,
  LogIn, History, AlertTriangle, RefreshCw,
} from "lucide-react";

const iconMap: Record<string, typeof Type> = {
  "Tone Consistency": Type,
  "Visual Identity": Palette,
  "Vocabulary": BookOpen,
  "Audience Alignment": Users,
  "Competitive Differentiation": Target,
  "Compliance & Legal": Shield,
};

interface ScanResults {
  overall: number;
  scraped?: boolean;
  wordCount?: number;
  pageTitle?: string;
  sections: Array<{
    iconKey: string;
    title: string;
    score: number;
    status: string;
    details: string;
    suggestions: string[];
  }>;
}

interface ScanRecord {
  url: string;
  userId?: string;
  results: ScanResults;
  scannedAt: string;
}

export function BrandScorePage() {
  const [url, setUrl] = useState("");
  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState<ScanResults | null>(null);
  const [scannedUrl, setScannedUrl] = useState("");
  const [history, setHistory] = useState<ScanRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [scanError, setScanError] = useState<string | null>(null);

  const { user, getAuthHeader, accessToken } = useAuth();
  const isAuthenticated = !!user;

  // Load scan history on mount / auth change
  useEffect(() => {
    fetchHistory();
  }, [accessToken]);

  const fetchHistory = async () => {
    try {
      const token = getAuthHeader();
      const headers: Record<string, string> = {
        Authorization: `Bearer ${publicAnonKey}`,
      };
      if (token) headers["X-User-Token"] = token;
      
      const res = await fetch(`${API_BASE}/brand-score/history`, { headers });
      const data = await res.json();
      if (data.history) {
        setHistory(data.history.sort((a: ScanRecord, b: ScanRecord) =>
          new Date(b.scannedAt).getTime() - new Date(a.scannedAt).getTime()
        ));
      }
    } catch (err) {
      console.error("Failed to load brand score history:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleScan = async () => {
    if (!url.trim()) return;
    const cleanUrl = url.trim();
    setScanning(true);
    setResults(null);
    setSaveStatus("idle");
    setScanError(null);
    setScannedUrl(cleanUrl);

    try {
      // Call server to scrape + analyze
      const res = await fetch(`${API_BASE}/brand-score`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAuthHeader()}` },
        body: JSON.stringify({ url: cleanUrl }),
      });
      const data = await res.json();

      if (data.success && data.results) {
        setScanning(false);
        setResults(data.results);
        setSaveStatus("saved");
        fetchHistory();
      } else {
        console.error("Scan error:", data.error);
        setScanning(false);
        setSaveStatus("error");
        setScanError(data.error);
      }
    } catch (err) {
      console.error("Scan request failed:", err);
      setScanning(false);
      setSaveStatus("error");
      setScanError("An unexpected error occurred. Please try again.");
    }
  };

  const loadFromHistory = (record: ScanRecord) => {
    setUrl(record.url);
    setScannedUrl(record.url);
    setResults(record.results);
    setSaveStatus("saved");
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "#16a34a";
    if (score >= 60) return "#f59e0b";
    return "var(--destructive)";
  };

  return (
    <div className="min-h-[calc(100vh-56px)]">
      {/* Hero */}
      <section className="pt-16 pb-10 md:pt-24 md:pb-16">
        <div className="max-w-[720px] mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <span
              className="inline-block px-3 py-1 rounded-full"
              style={{
                fontSize: "10px",
                fontWeight: 600,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--ora-signal)",
                background: "var(--ora-signal-light)",
                border: "1px solid rgba(59,79,196,0.1)",
              }}
            >
              Brand Score
            </span>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 }}
            className="mb-5"
            style={{
              fontSize: "clamp(2rem, 4vw, 3rem)",
              fontWeight: 500,
              letterSpacing: "-0.035em",
              lineHeight: 1.12,
            }}
          >
            How consistent is{" "}
            <span className="text-muted-foreground">your brand?</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            className="text-muted-foreground mb-10"
            style={{ fontSize: "16px", lineHeight: 1.55 }}
          >
            Drop your URL. ORA crawls your digital presence and scores your
            brand consistency across tone, visuals, vocabulary, and more.
          </motion.p>

          {/* Auth status */}
          {!isAuthenticated && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.15 }}
              className="flex items-center justify-center gap-2 mb-6"
            >
              <LogIn size={12} className="text-muted-foreground" />
              <span style={{ fontSize: "12px", color: "var(--muted-foreground)" }}>
                <Link to="/login" className="text-ora-signal hover:underline" style={{ fontWeight: 500 }}>
                  Sign in
                </Link>
                {" "}to save your scan history.
              </span>
            </motion.div>
          )}

          {/* Scanner input */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 }}
            className="flex items-center gap-3 max-w-[560px] mx-auto"
          >
            <div className="flex-1 relative">
              <Globe
                size={16}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://yourcompany.com"
                onKeyDown={(e) => e.key === "Enter" && handleScan()}
                className="w-full bg-card border border-border rounded-xl pl-11 pr-4 py-3.5 text-foreground placeholder:text-muted-foreground/50 focus:border-ora-signal focus:outline-none transition-colors"
                style={{ fontSize: "15px" }}
              />
            </div>
            <button
              onClick={handleScan}
              disabled={scanning || !url.trim()}
              className="flex items-center gap-2 px-6 py-3.5 rounded-xl text-white transition-all hover:opacity-90 disabled:opacity-50 cursor-pointer"
              style={{
                background:
                  "linear-gradient(135deg, var(--ora-signal) 0%, #2a3ba8 100%)",
                fontSize: "15px",
                fontWeight: 500,
                boxShadow: "0 2px 12px rgba(59,79,196,0.3)",
              }}
            >
              {scanning ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Scanning
                </>
              ) : (
                <>
                  <Search size={16} />
                  Scan
                </>
              )}
            </button>
          </motion.div>
        </div>
      </section>

      {/* Scan History (when no results shown) */}
      {!results && !scanning && history.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-[720px] mx-auto px-6 pb-16"
        >
          <div className="flex items-center gap-2 mb-4">
            <History size={14} style={{ color: "var(--muted-foreground)" }} />
            <span
              className="text-muted-foreground"
              style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}
            >
              Previous scans
            </span>
          </div>
          <div className="space-y-2">
            {history.slice(0, 5).map((record, i) => (
              <button
                key={record.url + i}
                onClick={() => loadFromHistory(record)}
                className="w-full flex items-center justify-between bg-card border border-border rounded-xl px-5 py-3.5 hover:border-border-strong transition-colors cursor-pointer text-left"
                style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Globe size={14} className="text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0">
                    <p
                      className="text-foreground truncate"
                      style={{ fontSize: "14px", fontWeight: 450 }}
                    >
                      {record.url}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Clock size={10} className="text-muted-foreground" />
                      <span
                        className="text-muted-foreground"
                        style={{ fontSize: "11px" }}
                      >
                        {new Date(record.scannedAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                </div>
                <span
                  className="flex-shrink-0 ml-4"
                  style={{
                    fontSize: "18px",
                    fontWeight: 600,
                    color: getScoreColor(record.results.overall),
                  }}
                >
                  {record.results.overall}
                </span>
              </button>
            ))}
          </div>
        </motion.section>
      )}

      {/* Loading history placeholder */}
      {!results && !scanning && loadingHistory && (
        <div className="max-w-[720px] mx-auto px-6 pb-16 text-center">
          <Loader2 size={16} className="animate-spin mx-auto text-muted-foreground" />
        </div>
      )}

      {/* Scan error */}
      {scanError && !scanning && !results && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-[720px] mx-auto px-6 pb-16"
        >
          <div className="bg-card border border-border rounded-xl p-8 text-center" style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{ background: "rgba(212,24,61,0.08)" }}>
              <AlertTriangle size={22} style={{ color: "var(--destructive)" }} />
            </div>
            <h3 className="text-foreground mb-2" style={{ fontSize: "16px", fontWeight: 500 }}>
              Scan failed
            </h3>
            <p className="text-muted-foreground mb-4" style={{ fontSize: "14px", lineHeight: 1.55 }}>
              {scanError}
            </p>
            <p className="text-muted-foreground/60 mb-6" style={{ fontSize: "12px", lineHeight: 1.5 }}>
              The site may be blocking automated access, or the scraping services may be temporarily unavailable. Try a different URL or retry in a few minutes.
            </p>
            <button
              onClick={() => { setScanError(null); setSaveStatus("idle"); }}
              className="inline-flex items-center gap-2 border border-border px-5 py-2.5 rounded-xl text-foreground hover:bg-secondary transition-colors cursor-pointer"
              style={{ fontSize: "14px", fontWeight: 500 }}
            >
              <RefreshCw size={14} />
              Try again
            </button>
          </div>
        </motion.div>
      )}

      {/* Scanning animation */}
      <AnimatePresence>
        {scanning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="max-w-[720px] mx-auto px-6 pb-16"
          >
            <div className="bg-card border border-border rounded-xl p-8 text-center">
              <div className="relative w-20 h-20 mx-auto mb-6">
                <svg
                  width={80}
                  height={80}
                  viewBox="0 0 80 80"
                  fill="none"
                  className="mx-auto"
                >
                  <circle
                    cx={40}
                    cy={40}
                    r={36}
                    stroke="var(--border)"
                    strokeWidth={2}
                  />
                  <motion.circle
                    cx={40}
                    cy={40}
                    r={36}
                    stroke="var(--ora-signal)"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeDasharray="226"
                    animate={{ strokeDashoffset: [226, 0] }}
                    transition={{ duration: 4, ease: "easeInOut" }}
                  />
                  <circle cx={40} cy={40} r={3} fill="var(--ora-signal)" />
                </svg>
              </div>
              <p
                className="text-foreground mb-2"
                style={{ fontSize: "16px", fontWeight: 500 }}
              >
                Crawling {scannedUrl}
              </p>
              <p
                className="text-muted-foreground"
                style={{ fontSize: "14px" }}
              >
                Scraping page content, then analyzing tone, visuals, vocabulary,
                audience alignment, competitors, and compliance...
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results */}
      <AnimatePresence>
        {results && !scanning && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-[1200px] mx-auto px-6 pb-20"
          >
            {/* Overall score */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="bg-card border border-border rounded-xl p-8 text-center mb-8"
              style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}
            >
              {/* Save status + scrape info */}
              <div className="flex items-center justify-center gap-4 mb-4">
                {saveStatus !== "idle" && (
                  <div className="flex items-center gap-1.5">
                    {saveStatus === "saving" && (
                      <>
                        <Loader2 size={11} className="animate-spin text-muted-foreground" />
                        <span style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>Saving...</span>
                      </>
                    )}
                    {saveStatus === "saved" && (
                      <>
                        <Check size={11} style={{ color: "#16a34a" }} strokeWidth={2.5} />
                        <span style={{ fontSize: "11px", color: "#16a34a" }}>Saved</span>
                      </>
                    )}
                    {saveStatus === "error" && (
                      <>
                        <AlertTriangle size={11} style={{ color: "#f59e0b" }} />
                        <span style={{ fontSize: "11px", color: "#f59e0b" }}>Could not save</span>
                      </>
                    )}
                  </div>
                )}
                {results.scraped && (
                  <span
                    className="px-2 py-0.5 rounded-full"
                    style={{ fontSize: "10px", fontWeight: 600, color: "var(--ora-signal)", background: "var(--ora-signal-light)" }}
                  >
                    {results.wordCount?.toLocaleString()} words scraped
                  </span>
                )}
              </div>

              <p
                className="text-muted-foreground mb-1"
                style={{ fontSize: "12px" }}
              >
                {results.pageTitle || scannedUrl}
              </p>
              <p
                className="text-muted-foreground mb-3"
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                }}
              >
                Overall Brand Score
              </p>
              <div className="relative w-32 h-32 mx-auto mb-4">
                <svg
                  width={128}
                  height={128}
                  viewBox="0 0 128 128"
                  fill="none"
                >
                  <circle
                    cx={64}
                    cy={64}
                    r={56}
                    stroke="var(--secondary)"
                    strokeWidth={6}
                  />
                  <motion.circle
                    cx={64}
                    cy={64}
                    r={56}
                    stroke={getScoreColor(results.overall)}
                    strokeWidth={6}
                    strokeLinecap="round"
                    strokeDasharray={352}
                    strokeDashoffset={352}
                    initial={{ strokeDashoffset: 352 }}
                    animate={{
                      strokeDashoffset:
                        352 - (352 * results.overall) / 100,
                    }}
                    transition={{ duration: 1.5, ease: "easeOut", delay: 0.3 }}
                    style={{
                      transform: "rotate(-90deg)",
                      transformOrigin: "center",
                    }}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span
                    style={{
                      fontSize: "36px",
                      fontWeight: 500,
                      letterSpacing: "-0.03em",
                      color: getScoreColor(results.overall),
                    }}
                  >
                    {results.overall}
                  </span>
                </div>
              </div>
              <p
                className="text-muted-foreground mb-6"
                style={{ fontSize: "15px" }}
              >
                {results.overall >= 80
                  ? "Strong brand consistency. Keep it up!"
                  : results.overall >= 60
                  ? "Your brand has room for improvement. Here's what to fix."
                  : "Significant inconsistencies detected. Immediate action recommended."}
              </p>
              <div className="flex items-center justify-center gap-3">
                <Link
                  to="/studio"
                  className="inline-flex items-center gap-2 text-white px-6 py-3 rounded-xl hover:opacity-90 transition-opacity"
                  style={{
                    background:
                      "linear-gradient(135deg, var(--ora-signal) 0%, #2a3ba8 100%)",
                    fontSize: "14px",
                    fontWeight: 500,
                    boxShadow: "0 2px 12px rgba(59,79,196,0.3)",
                  }}
                >
                  Fix with Studio
                  <ArrowRight size={14} />
                </Link>
                <button
                  onClick={() => {
                    setResults(null);
                    setUrl("");
                    setScannedUrl("");
                    setSaveStatus("idle");
                  }}
                  className="inline-flex items-center gap-2 border border-border px-6 py-3 rounded-xl text-foreground hover:bg-secondary transition-colors cursor-pointer"
                  style={{ fontSize: "14px", fontWeight: 500 }}
                >
                  <RefreshCw size={14} />
                  Scan another
                </button>
              </div>
            </motion.div>

            {/* Detail cards */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {results.sections.map((section, i) => {
                const Icon = iconMap[section.iconKey] || Shield;
                const sectionStatus = section.score >= 75 ? "good" : "warning";
                return (
                  <motion.div
                    key={section.title}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + i * 0.08 }}
                    className="bg-card border border-border rounded-xl p-5"
                    style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center"
                          style={{
                            background:
                              sectionStatus === "good"
                                ? "rgba(22,163,74,0.08)"
                                : "rgba(245,158,11,0.08)",
                          }}
                        >
                          <Icon
                            size={15}
                            style={{
                              color:
                                sectionStatus === "good"
                                  ? "#16a34a"
                                  : "#f59e0b",
                            }}
                          />
                        </div>
                        <span
                          className="text-foreground"
                          style={{ fontSize: "14px", fontWeight: 500 }}
                        >
                          {section.title}
                        </span>
                      </div>
                      <span
                        style={{
                          fontSize: "18px",
                          fontWeight: 600,
                          color: getScoreColor(section.score),
                        }}
                      >
                        {section.score}
                      </span>
                    </div>

                    <p
                      className="text-muted-foreground mb-4"
                      style={{ fontSize: "13px", lineHeight: 1.55 }}
                    >
                      {section.details}
                    </p>

                    <div className="space-y-2">
                      {section.suggestions.map((s) => (
                        <div key={s} className="flex items-start gap-2">
                          {sectionStatus === "good" ? (
                            <Check
                              size={11}
                              className="mt-0.5 flex-shrink-0"
                              style={{ color: "#16a34a" }}
                              strokeWidth={2.5}
                            />
                          ) : (
                            <AlertTriangle
                              size={11}
                              className="mt-0.5 flex-shrink-0"
                              style={{ color: "#f59e0b" }}
                            />
                          )}
                          <span
                            style={{
                              fontSize: "12px",
                              lineHeight: 1.5,
                              color: "var(--foreground)",
                            }}
                          >
                            {s}
                          </span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}