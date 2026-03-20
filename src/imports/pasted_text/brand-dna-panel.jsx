/**
 * ORA Studio — src/components/brand-dna/BrandDNAPanel.jsx
 * UI complète pour l'analyse et la visualisation du Business DNA.
 * Compatible Figma Make / React.
 */

import { useState } from "react";
import { useBrandDNA } from "../../hooks/useBrandDNA";

// ─── Sous-composants ──────────────────────────────────────────────────────────

function ColorSwatch({ color, label }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 8,
          background: color,
          border: "1px solid rgba(255,255,255,0.15)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
        }}
        title={color}
      />
      <span style={{ fontSize: 10, color: "#9ca3af", fontFamily: "monospace" }}>{color}</span>
      <span style={{ fontSize: 10, color: "#6b7280" }}>{label}</span>
    </div>
  );
}

function TagList({ items = [], color = "#3b82f6" }) {
  if (!items?.length) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {items.map((item, i) => (
        <span
          key={i}
          style={{
            padding: "3px 10px",
            borderRadius: 999,
            background: `${color}22`,
            color,
            fontSize: 12,
            border: `1px solid ${color}44`,
          }}
        >
          {item}
        </span>
      ))}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function ConfidenceBadge({ score }) {
  const pct = Math.round((score ?? 0) * 100);
  const color = pct >= 85 ? "#10b981" : pct >= 65 ? "#f59e0b" : "#ef4444";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 6, background: "#1f2937", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 3, transition: "width 0.5s ease" }} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 600, color, minWidth: 36 }}>{pct}%</span>
    </div>
  );
}

// ─── Résultat DNA ─────────────────────────────────────────────────────────────

function DNAResult({ dna, onRefresh }) {
  const colors = dna.visual_identity?.colors ?? {};

  return (
    <div style={{ animation: "fadeIn 0.3s ease" }}>
      {/* Header marque */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 28, padding: "16px 20px", background: "#111827", borderRadius: 12, border: "1px solid #1f2937" }}>
        {dna.logo_url && (
          <img src={dna.logo_url} alt="logo" style={{ width: 48, height: 48, borderRadius: 8, objectFit: "contain", background: "#fff", padding: 4 }} onError={(e) => e.target.style.display = "none"} />
        )}
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "#f9fafb", margin: 0 }}>{dna.brand_name}</h2>
            <span style={{ fontSize: 11, padding: "2px 8px", background: "#1f2937", color: "#9ca3af", borderRadius: 4 }}>{dna.brand_archetype}</span>
          </div>
          {dna.tagline && <p style={{ fontSize: 13, color: "#9ca3af", margin: "4px 0 0" }}>{dna.tagline}</p>}
          <p style={{ fontSize: 12, color: "#6b7280", margin: "4px 0 0" }}>{dna.industry} · {dna.company_size}</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 6 }}>Confiance</div>
          <ConfidenceBadge score={dna.confidence_score} />
          <div style={{ fontSize: 10, color: "#4b5563", marginTop: 4 }}>{dna.pages_crawled ?? 1} page(s)</div>
        </div>
      </div>

      {/* Couleurs */}
      <Section title="Identité Visuelle">
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 12 }}>
          {Object.entries(colors).map(([k, v]) => v && <ColorSwatch key={k} color={v} label={k} />)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div style={infoBox}><Label>Style</Label><Val>{dna.visual_identity?.style}</Val></div>
          <div style={infoBox}><Label>Imagerie</Label><Val>{dna.visual_identity?.imagery}</Val></div>
        </div>
      </Section>

      {/* Audience */}
      <Section title="Audience Cible">
        <div style={infoBox}>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            {dna.target_audience?.b2b && <span style={badge("#8b5cf6")}>B2B</span>}
            {dna.target_audience?.b2c && <span style={badge("#ec4899")}>B2C</span>}
            {dna.target_audience?.geographies?.map((g) => <span key={g} style={badge("#0ea5e9")}>{g}</span>)}
          </div>
          <Label>Audience principale</Label>
          <Val>{dna.target_audience?.primary}</Val>
          {dna.target_audience?.secondary && <><Label style={{ marginTop: 8 }}>Secondaire</Label><Val>{dna.target_audience.secondary}</Val></>}
        </div>
        {dna.target_audience?.personas?.length > 0 && (
          <div style={{ marginTop: 8 }}><TagList items={dna.target_audience.personas} color="#8b5cf6" /></div>
        )}
      </Section>

      {/* Ton de voix */}
      <Section title="Ton de Voix">
        <div style={infoBox}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
            <div><Label>Ton principal</Label><Val>{dna.tone_of_voice?.primary}</Val></div>
            <span style={badge("#f59e0b")}>{dna.tone_of_voice?.language_level}</span>
          </div>
          <Label>Style rédactionnel</Label>
          <Val>{dna.tone_of_voice?.writing_style}</Val>
        </div>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
          <div><span style={{ fontSize: 11, color: "#10b981", marginBottom: 4, display: "block" }}>✓ Adjectifs clés</span><TagList items={dna.tone_of_voice?.adjectives} color="#10b981" /></div>
          <div><span style={{ fontSize: 11, color: "#ef4444", marginBottom: 4, display: "block" }}>✗ À éviter</span><TagList items={dna.tone_of_voice?.avoid} color="#ef4444" /></div>
        </div>
      </Section>

      {/* Messaging */}
      <Section title="Messaging">
        <div style={{ ...infoBox, marginBottom: 8, borderLeft: "3px solid #3b82f6" }}>
          <Label>Proposition de valeur</Label>
          <p style={{ fontSize: 15, color: "#e5e7eb", fontWeight: 500, margin: 0 }}>{dna.messaging?.value_proposition}</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
          <div style={infoBox}>
            <Label>Messages clés</Label>
            {dna.messaging?.key_messages?.map((m, i) => <Val key={i}>· {m}</Val>)}
          </div>
          <div style={infoBox}>
            <Label>Preuves</Label>
            {dna.messaging?.proof_points?.map((p, i) => <Val key={i}>· {p}</Val>)}
          </div>
        </div>
        <TagList items={dna.messaging?.keywords} color="#3b82f6" />
      </Section>

      {/* Copy examples */}
      <Section title="Exemples de Copy">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div style={infoBox}>
            <span style={{ fontSize: 11, color: "#10b981", marginBottom: 6, display: "block" }}>✓ À dire</span>
            {dna.do_say?.map((s, i) => <Val key={i} style={{ fontStyle: "italic" }}>"{s}"</Val>)}
          </div>
          <div style={infoBox}>
            <span style={{ fontSize: 11, color: "#ef4444", marginBottom: 6, display: "block" }}>✗ À ne pas dire</span>
            {dna.dont_say?.map((s, i) => <Val key={i} style={{ fontStyle: "italic", color: "#6b7280", textDecoration: "line-through" }}>"{s}"</Val>)}
          </div>
        </div>
      </Section>

      {/* Canaux */}
      <Section title="Canaux Recommandés">
        <TagList items={dna.channels?.recommended} color="#f59e0b" />
        <div style={{ marginTop: 8 }}><TagList items={dna.channels?.content_types} color="#6b7280" /></div>
        {dna.channels?.posting_frequency && (
          <p style={{ fontSize: 12, color: "#6b7280", marginTop: 8 }}>📅 {dna.channels.posting_frequency}</p>
        )}
      </Section>

      {/* Personnalité */}
      <Section title="Personnalité & Positionnement">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div style={infoBox}><Label>Personnalité</Label><Val>{dna.brand_personality}</Val></div>
          <div style={infoBox}><Label>Positionnement</Label><Val>{dna.competitive_positioning}</Val></div>
        </div>
      </Section>

      {/* Footer */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, paddingTop: 16, borderTop: "1px solid #1f2937" }}>
        <span style={{ fontSize: 11, color: "#4b5563" }}>
          Analysé le {new Date(dna.analyzed_at).toLocaleDateString("fr-FR")} · {dna.source_url}
        </span>
        <button onClick={onRefresh} style={ghostBtn}>↺ Rafraîchir</button>
      </div>
    </div>
  );
}

// ─── Styles partagés ──────────────────────────────────────────────────────────

const infoBox = { background: "#111827", borderRadius: 8, padding: "12px 14px", border: "1px solid #1f2937" };
const Label = ({ children, style }) => <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 2, ...style }}>{children}</div>;
const Val = ({ children, style }) => <div style={{ fontSize: 13, color: "#d1d5db", lineHeight: 1.5, ...style }}>{children}</div>;
const badge = (color) => ({ padding: "2px 8px", borderRadius: 999, background: `${color}22`, color, fontSize: 11, border: `1px solid ${color}44` });
const ghostBtn = { background: "transparent", border: "1px solid #374151", color: "#9ca3af", padding: "6px 14px", borderRadius: 6, cursor: "pointer", fontSize: 12 };

// ─── Composant principal ──────────────────────────────────────────────────────

export default function BrandDNAPanel({ onDNAReady }) {
  const [url, setUrl] = useState("");
  const [maxPages, setMaxPages] = useState(5);
  const { dna, loading, progress, error, analyze, reset } = useBrandDNA();

  const handleAnalyze = async (forceRefresh = false) => {
    if (!url.trim()) return;
    try {
      const result = await analyze(url.trim(), { forceRefresh, maxPages });
      if (result && onDNAReady) onDNAReady(result);
    } catch {}
  };

  return (
    <div style={{ fontFamily: "Inter, system-ui, sans-serif", color: "#f9fafb", maxWidth: 720, margin: "0 auto" }}>
      {/* Input */}
      {!dna && (
        <div style={{ background: "#0f172a", borderRadius: 16, padding: 24, border: "1px solid #1e293b", marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 4px" }}>Business DNA</h2>
          <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 20px" }}>
            Analyse automatique de l'identité de marque depuis un site web.
          </p>

          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
              placeholder="https://votre-client.com"
              disabled={loading}
              style={{
                flex: 1, padding: "10px 14px", borderRadius: 8,
                background: "#1e293b", border: "1px solid #334155",
                color: "#f1f5f9", fontSize: 14, outline: "none",
              }}
            />
            <button
              onClick={() => handleAnalyze(false)}
              disabled={loading || !url.trim()}
              style={{
                padding: "10px 20px", borderRadius: 8, fontWeight: 600, fontSize: 14,
                background: loading || !url.trim() ? "#1e293b" : "#3b82f6",
                color: loading || !url.trim() ? "#475569" : "#fff",
                border: "none", cursor: loading || !url.trim() ? "default" : "pointer",
                transition: "all 0.2s",
              }}
            >
              {loading ? "Analyse..." : "Analyser →"}
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <label style={{ fontSize: 12, color: "#6b7280" }}>Pages max :</label>
            {[1, 3, 5, 10].map((n) => (
              <button
                key={n}
                onClick={() => setMaxPages(n)}
                style={{
                  padding: "3px 10px", borderRadius: 6, fontSize: 12, cursor: "pointer",
                  background: maxPages === n ? "#1d4ed8" : "#1e293b",
                  color: maxPages === n ? "#fff" : "#6b7280",
                  border: `1px solid ${maxPages === n ? "#3b82f6" : "#334155"}`,
                }}
              >
                {n}
              </button>
            ))}
            <span style={{ fontSize: 11, color: "#475569" }}>
              {maxPages === 1 ? "rapide" : maxPages <= 3 ? "équilibré" : "approfondi"}
            </span>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ background: "#0f172a", borderRadius: 12, padding: 20, border: "1px solid #1e293b", textAlign: "center" }}>
          <div style={{ fontSize: 24, marginBottom: 12, animation: "spin 1s linear infinite", display: "inline-block" }}>⟳</div>
          <p style={{ color: "#94a3b8", fontSize: 14, margin: 0 }}>{progress}</p>
        </div>
      )}

      {/* Erreur */}
      {error && (
        <div style={{ background: "#1c0a0a", borderRadius: 12, padding: 16, border: "1px solid #7f1d1d", marginBottom: 16 }}>
          <p style={{ color: "#fca5a5", fontSize: 14, margin: 0 }}>⚠ {error}</p>
          <button onClick={reset} style={{ ...ghostBtn, marginTop: 8 }}>Réessayer</button>
        </div>
      )}

      {/* Résultat */}
      {dna && !loading && (
        <div style={{ background: "#0f172a", borderRadius: 16, padding: 24, border: "1px solid #1e293b" }}>
          <DNAResult dna={dna} onRefresh={() => handleAnalyze(true)} />
          <button onClick={reset} style={{ ...ghostBtn, marginTop: 12, width: "100%" }}>
            + Analyser un autre site
          </button>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        input::placeholder { color: #475569; }
      `}</style>
    </div>
  );
}
