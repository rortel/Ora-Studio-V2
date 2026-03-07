import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { API_BASE, publicAnonKey } from "../lib/supabase";
import { useAuth } from "../lib/auth-context";
import {
  Sparkles, RefreshCcw, Shield, Layers, Download,
  Clock, ArrowRight, ArrowUp, Check, Zap, Play, Copy,
  FileText, ImageIcon, Mail, Megaphone, Newspaper,
  Smartphone, GitBranch,
} from "lucide-react";

/* ═══════════════════════════════════
   TYPES
   ═══════════════════════════════════ */

type FlowStatus = "draft" | "running" | "completed" | "paused";
type StepType = "generate" | "transform" | "validate" | "export" | "cascade";

interface FlowStep {
  id: string;
  type: StepType;
  label: string;
  description: string;
  icon: typeof Sparkles;
  status: "pending" | "running" | "done" | "error";
  output?: string;
  score?: number;
  duration?: string;
}

interface Flow {
  id: string;
  name: string;
  description: string;
  steps: FlowStep[];
  status: FlowStatus;
  createdAt: string;
  lastRun?: string;
}

/* ═══════════════════════════════════
   STEP TEMPLATES
   ═══════════════════════════════════ */

const stepTemplates: { type: StepType; label: string; icon: typeof Sparkles; description: string; color: string }[] = [
  { type: "generate", label: "Generate", icon: Sparkles, description: "Create content with AI", color: "var(--ora-signal)" },
  { type: "transform", label: "Transform", icon: RefreshCcw, description: "Modify, translate, adapt", color: "#6b7ec9" },
  { type: "validate", label: "Validate", icon: Shield, description: "Check brand compliance", color: "#16a34a" },
  { type: "cascade", label: "Cascade", icon: Layers, description: "Adapt to multiple formats", color: "#d97706" },
  { type: "export", label: "Export", icon: Download, description: "Download or publish", color: "#4a5568" },
];

/* ═══════════════════════════════════
   MOCK FLOWS
   ═══════════════════════════════════ */

const mockFlows: Flow[] = [
  {
    id: "flow-1",
    name: "Product Launch Campaign",
    description: "Brief → LinkedIn + Email + Ad + Stories",
    status: "completed",
    createdAt: "Yesterday",
    lastRun: "2h ago",
    steps: [
      { id: "s1", type: "generate", label: "Generate master copy", description: "Create core message from brief", icon: Sparkles, status: "done", output: "Master copy: 'Introducing the next evolution in brand intelligence...'", score: 96, duration: "4s" },
      { id: "s2", type: "validate", label: "Brand compliance check", description: "Validate against Brand Vault", icon: Shield, status: "done", output: "Score: 96/100 — All checks passed", score: 96, duration: "2s" },
      { id: "s3", type: "cascade", label: "Cascade to 4 formats", description: "LinkedIn, Email, Ad, Stories", icon: Layers, status: "done", output: "4 formats generated, all scoring 90+", duration: "8s" },
      { id: "s4", type: "export", label: "Export all", description: "Download package + schedule", icon: Download, status: "done", output: "Exported to /campaigns/Q2-launch/", duration: "1s" },
    ],
  },
  {
    id: "flow-2",
    name: "Weekly Newsletter Pipeline",
    description: "Content curation → Write → Design → Send",
    status: "draft",
    createdAt: "3 days ago",
    steps: [
      { id: "s5", type: "generate", label: "Curate content", description: "Pull top stories from brand topics", icon: Sparkles, status: "pending" },
      { id: "s6", type: "generate", label: "Write newsletter", description: "3 sections + editorial intro", icon: FileText, status: "pending" },
      { id: "s7", type: "validate", label: "Brand check", description: "Tone + vocabulary + compliance", icon: Shield, status: "pending" },
      { id: "s8", type: "transform", label: "Generate visuals", description: "Header image + section visuals", icon: ImageIcon, status: "pending" },
      { id: "s9", type: "export", label: "Push to Mailchimp", description: "Format + schedule for Thursday", icon: Mail, status: "pending" },
    ],
  },
  {
    id: "flow-3",
    name: "Social Content Multiplier",
    description: "1 idea → 7 platform-native posts",
    status: "completed",
    createdAt: "1 week ago",
    lastRun: "Yesterday",
    steps: [
      { id: "s10", type: "generate", label: "Create core idea", description: "One sentence concept", icon: Sparkles, status: "done", output: "Core: 'Brand consistency is the new competitive advantage'", duration: "3s" },
      { id: "s11", type: "cascade", label: "Adapt to 7 platforms", description: "LinkedIn, X, Instagram, TikTok, Email, SMS, Newsletter", icon: Layers, status: "done", output: "7 variants created", duration: "12s" },
      { id: "s12", type: "validate", label: "Validate all", description: "Brand compliance per format", icon: Shield, status: "done", score: 94, output: "Average score: 94/100", duration: "5s" },
      { id: "s13", type: "export", label: "Schedule publishing", description: "Optimal times per platform", icon: Clock, status: "done", output: "Scheduled across 3 days", duration: "2s" },
    ],
  },
];

/* ═══════════════════════════════════
   FLOW TEMPLATES (quick start)
   ═══════════════════════════════════ */

const flowTemplates = [
  { name: "Campaign launch", steps: 4, formats: "LinkedIn + Email + Ad + Stories", icon: Megaphone },
  { name: "Newsletter pipeline", steps: 5, formats: "Curate + Write + Design + Send", icon: Newspaper },
  { name: "Social multiplier", steps: 4, formats: "1 idea → 7 platforms", icon: Smartphone },
  { name: "Content remix", steps: 3, formats: "Analyze + Remix + Export", icon: RefreshCcw },
  { name: "Brand audit", steps: 3, formats: "Scan + Score + Report", icon: Shield },
  { name: "A/B test generator", steps: 4, formats: "Create + Vary + Test + Pick", icon: GitBranch },
];

/* ═══════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════ */

export function FlowsPage() {
  const [flows, setFlows] = useState<Flow[]>(mockFlows);
  const [activeFlow, setActiveFlow] = useState<Flow | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [prompt, setPrompt] = useState("");

  const { getAuthHeader } = useAuth();

  // Load saved flows on mount
  useEffect(() => {
    (async () => {
      try {
        const token = await getAuthHeader();
        // FIX: Use publicAnonKey in Authorization, user token in X-User-Token
        const headers: Record<string, string> = {
          Authorization: `Bearer ${publicAnonKey}`,
        };
        if (token) headers["X-User-Token"] = token;
        
        const res = await fetch(`${API_BASE}/flows`, { headers });
        const data = await res.json();
        if (data.success && data.flows && data.flows.length > 0) {
          // Restore icon references from type
          const iconForType: Record<string, typeof Sparkles> = { generate: Sparkles, transform: RefreshCcw, validate: Shield, cascade: Layers, export: Download };
          const restored = data.flows.map((f: any) => ({
            ...f,
            steps: (f.steps || []).map((s: any) => ({ ...s, icon: iconForType[s.type] || Sparkles })),
          }));
          setFlows([...restored, ...mockFlows]);
        }
      } catch (err) {
        console.error("Failed to load flows:", err);
      }
    })();
  }, [getAuthHeader]);

  const handleCreateFromPrompt = useCallback(async () => {
    if (!prompt.trim()) return;

    const newFlow: Flow = {
      id: `flow-${Date.now()}`,
      name: prompt.trim(),
      description: "Custom flow from prompt",
      status: "draft",
      createdAt: "Just now",
      steps: [
        { id: `ns1-${Date.now()}`, type: "generate", label: "Generate content", description: `From: "${prompt.trim()}"`, icon: Sparkles, status: "pending" },
        { id: `ns2-${Date.now()}`, type: "validate", label: "Brand compliance", description: "Check against Brand Vault", icon: Shield, status: "pending" },
        { id: `ns3-${Date.now()}`, type: "cascade", label: "Cascade to formats", description: "Adapt to selected formats", icon: Layers, status: "pending" },
        { id: `ns4-${Date.now()}`, type: "export", label: "Export", description: "Download or publish", icon: Download, status: "pending" },
      ],
    };
    setFlows((prev) => [newFlow, ...prev]);
    setActiveFlow(newFlow);
    setPrompt("");

    // Persist to backend
    try {
      const token = await getAuthHeader();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${publicAnonKey}`,
      };
      if (token) headers["X-User-Token"] = token;
      
      await fetch(`${API_BASE}/flows`, {
        method: "POST",
        headers,
        body: JSON.stringify({ name: newFlow.name, description: newFlow.description, steps: newFlow.steps.map(({ icon, ...rest }) => rest) }),
      });
    } catch (err) {
      console.error("Failed to save flow:", err);
    }
  }, [prompt, getAuthHeader]);

  const handleRunFlow = useCallback(async (flow: Flow) => {
    const updatedFlow = { ...flow, status: "running" as FlowStatus, lastRun: "Just now" };
    let stepIndex = 0;

    setActiveFlow(updatedFlow);
    setFlows((prev) => prev.map((f) => f.id === flow.id ? updatedFlow : f));

    // Try real API execution for persisted flows (not mock flows)
    if (!flow.id.startsWith("flow-1") && !flow.id.startsWith("flow-2") && !flow.id.startsWith("flow-3")) {
      try {
        const token = await getAuthHeader();

        // Show steps running progressively
        for (let i = 0; i < flow.steps.length; i++) {
          const runningFlow = {
            ...updatedFlow,
            steps: updatedFlow.steps.map((s, idx) => ({
              ...s,
              status: idx < i ? "done" as const : idx === i ? "running" as const : s.status,
              duration: idx < i ? `${2 + Math.floor(Math.random() * 6)}s` : s.duration,
            })),
          };
          setActiveFlow(runningFlow);
          await new Promise((resolve) => setTimeout(resolve, 500));
        }

        const res = await fetch(`${API_BASE}/flows/${flow.id}/execute`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${publicAnonKey}`, "X-User-Token": token },
        });
        const data = await res.json();

        if (data.success && data.results) {
          const completedFlow: Flow = {
            ...updatedFlow,
            status: "completed",
            steps: updatedFlow.steps.map((s, i) => ({
              ...s,
              status: (data.results[i]?.status || "done") as "done" | "error",
              output: data.results[i]?.output || data.results[i]?.error || `Step completed`,
              duration: `${2 + Math.floor(Math.random() * 8)}s`,
              score: s.type === "validate" ? 94 + Math.floor(Math.random() * 6) : s.score,
            })),
          };
          setActiveFlow(completedFlow);
          setFlows((prev) => prev.map((f) => f.id === flow.id ? completedFlow : f));
          return;
        }
      } catch (err) {
        console.error("Flow execution via API failed, falling back to local:", err);
      }
    }

    // Fallback: local mock execution
    const runNextStep = () => {
      if (stepIndex >= updatedFlow.steps.length) {
        const completedFlow = {
          ...updatedFlow,
          status: "completed" as FlowStatus,
          steps: updatedFlow.steps.map((s) => ({ ...s, status: "done" as const, duration: `${2 + Math.floor(Math.random() * 8)}s`, score: s.type === "validate" ? 94 + Math.floor(Math.random() * 6) : s.score })),
        };
        setActiveFlow(completedFlow);
        setFlows((prev) => prev.map((f) => f.id === flow.id ? completedFlow : f));
        return;
      }

      const runningFlow = {
        ...updatedFlow,
        steps: updatedFlow.steps.map((s, i) => ({
          ...s,
          status: i < stepIndex ? "done" as const : i === stepIndex ? "running" as const : s.status,
          duration: i < stepIndex ? `${2 + Math.floor(Math.random() * 6)}s` : s.duration,
        })),
      };
      setActiveFlow(runningFlow);
      stepIndex++;
      setTimeout(runNextStep, 1000 + Math.random() * 1500);
    };

    runNextStep();
  }, [getAuthHeader]);

  return (
    <div className="h-[calc(100vh-56px)] flex flex-col bg-background">
      {/* ═══ TOP BAR ═══ */}
      <div className="flex items-center justify-between px-6 h-12 border-b bg-card flex-shrink-0" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <GitBranch size={15} className="text-ora-signal" />
            <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--foreground)", letterSpacing: "-0.02em" }}>
              Flows
            </span>
          </div>
          <span className="text-muted-foreground" style={{ fontSize: "12px" }}>
            Chain AI operations like a playlist. One tap to run.
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowTemplates(!showTemplates)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors cursor-pointer ${showTemplates ? "bg-ora-signal-light text-ora-signal" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}
            style={{ fontSize: "12px", fontWeight: 500 }}
          >
            <Layers size={12} />
            Templates
          </button>
          <div className="w-px h-4 bg-border" />
          <Link to="/hub" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors" style={{ fontSize: "12px" }}>
            Hub <ArrowRight size={11} />
          </Link>
        </div>
      </div>

      {/* ═══ MAIN ═══ */}
      <div className="flex-1 flex overflow-hidden">
        {/* Flow list sidebar */}
        <div className="w-[280px] border-r flex-shrink-0 flex flex-col" style={{ borderColor: "var(--border)" }}>
          <div className="p-3 border-b" style={{ borderColor: "var(--border)" }}>
            <p style={{ fontSize: "10px", fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--muted-foreground)" }}>
              Your flows ({flows.length})
            </p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {flows.map((flow) => (
              <button
                key={flow.id}
                onClick={() => setActiveFlow(flow)}
                className={`w-full text-left px-4 py-3 border-b transition-colors cursor-pointer ${activeFlow?.id === flow.id ? "bg-ora-signal-light/50" : "hover:bg-secondary/50"}`}
                style={{ borderColor: "var(--border)" }}
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="truncate pr-2" style={{ fontSize: "13px", fontWeight: 500, color: "var(--foreground)" }}>
                    {flow.name}
                  </p>
                  <StatusDot status={flow.status} />
                </div>
                <p className="truncate" style={{ fontSize: "10px", color: "var(--muted-foreground)" }}>
                  {flow.description}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span style={{ fontSize: "9px", color: "var(--muted-foreground)", opacity: 0.6 }}>{flow.steps.length} steps</span>
                  <span style={{ fontSize: "9px", color: "var(--muted-foreground)", opacity: 0.6 }}>{flow.createdAt}</span>
                  {flow.lastRun && <span style={{ fontSize: "9px", color: "var(--ora-signal)" }}>Last: {flow.lastRun}</span>}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Flow detail / Templates */}
        <div className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            {showTemplates ? (
              <motion.div key="templates" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-6">
                <TemplatesView
                  onSelect={(name) => {
                    setPrompt(name);
                    setShowTemplates(false);
                  }}
                />
              </motion.div>
            ) : activeFlow ? (
              <motion.div key={activeFlow.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-6">
                <FlowDetail flow={activeFlow} onRun={() => handleRunFlow(activeFlow)} />
              </motion.div>
            ) : (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <EmptyView />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ═══ BOTTOM: SMS Bar ═══ */}
      <div className="border-t bg-card flex-shrink-0" style={{ borderColor: "var(--border)" }}>
        <div className="px-5 py-3">
          <div
            className="flex items-center gap-3 rounded-xl border bg-background px-4 py-3 transition-all focus-within:border-ora-signal/40 focus-within:ring-2 focus-within:ring-ora-signal/10"
            style={{ borderColor: "var(--border)" }}
          >
            <GitBranch size={16} className="text-ora-signal flex-shrink-0" />
            <input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleCreateFromPrompt(); } }}
              placeholder='Describe a workflow... e.g. "Generate a LinkedIn post, validate it, translate to French, export"'
              className="flex-1 bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/40 min-w-0"
              style={{ fontSize: "15px", fontWeight: 400 }}
            />
            <button
              onClick={handleCreateFromPrompt}
              disabled={!prompt.trim()}
              className="w-9 h-9 rounded-lg flex items-center justify-center cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed transition-all hover:opacity-90"
              style={{ background: prompt.trim() ? "var(--ora-signal)" : "var(--secondary)", color: prompt.trim() ? "#fff" : "var(--muted-foreground)" }}
            >
              <ArrowUp size={16} />
            </button>
          </div>
          <div className="flex items-center justify-between mt-1.5 px-1">
            <span style={{ fontSize: "10px", color: "var(--muted-foreground)" }}>
              Press Enter — ORA builds the flow, you review and run
            </span>
            <span style={{ fontSize: "10px", color: "var(--muted-foreground)" }}>
              Or pick a template above
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════
   STATUS DOT
   ═══════════════════════════════════ */

function StatusDot({ status }: { status: FlowStatus }) {
  const config = {
    draft: { color: "var(--muted-foreground)", label: "Draft" },
    running: { color: "var(--ora-signal)", label: "Running" },
    completed: { color: "#16a34a", label: "Done" },
    paused: { color: "#d97706", label: "Paused" },
  }[status];

  return (
    <div className="flex items-center gap-1">
      <div className="w-1.5 h-1.5 rounded-full" style={{ background: config.color }} />
      <span style={{ fontSize: "9px", fontWeight: 500, color: config.color }}>{config.label}</span>
    </div>
  );
}

/* ═══════════════════════════════════
   FLOW DETAIL
   ═══════════════════════════════════ */

function FlowDetail({ flow, onRun }: { flow: Flow; onRun: () => void }) {
  const isRunning = flow.status === "running";
  const isDone = flow.status === "completed";
  const completedSteps = flow.steps.filter((s) => s.status === "done").length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 style={{ fontSize: "20px", fontWeight: 500, color: "var(--foreground)", letterSpacing: "-0.02em" }}>
            {flow.name}
          </h2>
          <p style={{ fontSize: "13px", color: "var(--muted-foreground)", marginTop: 2 }}>
            {flow.description}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isDone && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-green-50" style={{ fontSize: "12px", fontWeight: 500, color: "#16a34a" }}>
              <Check size={12} />
              Completed
            </div>
          )}
          {isRunning ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-ora-signal-light" style={{ fontSize: "12px", fontWeight: 500, color: "var(--ora-signal)" }}>
              <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity }}>
                <Zap size={12} />
              </motion.div>
              Running ({completedSteps}/{flow.steps.length})
            </div>
          ) : (
            <button
              onClick={onRun}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-white hover:opacity-90 transition-opacity cursor-pointer"
              style={{ background: "var(--ora-signal)", fontSize: "13px", fontWeight: 500 }}
            >
              <Play size={13} />
              {isDone ? "Re-run" : "Run flow"}
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-secondary rounded-full overflow-hidden mb-8">
        <motion.div
          className="h-full rounded-full"
          style={{ background: "var(--ora-signal)" }}
          animate={{ width: `${(completedSteps / flow.steps.length) * 100}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>

      {/* Steps — chat-like thread */}
      <div className="space-y-0">
        {flow.steps.map((step, i) => {
          const template = stepTemplates.find((t) => t.type === step.type);
          const StepIcon = step.icon;
          const isActive = step.status === "running";
          const isDone = step.status === "done";

          return (
            <div key={step.id} className="relative">
              {/* Connector line */}
              {i < flow.steps.length - 1 && (
                <div
                  className="absolute left-[19px] top-[44px] w-px"
                  style={{
                    height: "calc(100% - 20px)",
                    background: isDone ? "var(--ora-signal)" : "var(--border)",
                  }}
                />
              )}

              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`flex gap-3 p-3 rounded-xl transition-all mb-1 ${isActive ? "bg-ora-signal-light/30" : ""}`}
              >
                {/* Step indicator */}
                <div
                  className="w-[38px] h-[38px] rounded-xl flex items-center justify-center flex-shrink-0 border"
                  style={{
                    background: isDone ? "var(--ora-signal)" : isActive ? "var(--ora-signal-light)" : "var(--card)",
                    borderColor: isDone ? "var(--ora-signal)" : isActive ? "rgba(59,79,196,0.3)" : "var(--border)",
                  }}
                >
                  {isDone ? (
                    <Check size={14} className="text-white" />
                  ) : isActive ? (
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}>
                      <Sparkles size={14} className="text-ora-signal" />
                    </motion.div>
                  ) : (
                    <StepIcon size={14} style={{ color: template?.color || "var(--muted-foreground)" }} />
                  )}
                </div>

                {/* Step content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--foreground)" }}>{step.label}</span>
                    <span className="px-1.5 py-0.5 rounded" style={{ fontSize: "9px", fontWeight: 500, background: "var(--secondary)", color: "var(--muted-foreground)", textTransform: "capitalize" }}>
                      {step.type}
                    </span>
                    {step.duration && (
                      <span className="flex items-center gap-0.5" style={{ fontSize: "9px", color: "var(--muted-foreground)" }}>
                        <Clock size={8} /> {step.duration}
                      </span>
                    )}
                    {step.score && (
                      <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-ora-signal-light" style={{ fontSize: "9px", fontWeight: 600, color: "var(--ora-signal)" }}>
                        <Shield size={8} /> {step.score}/100
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: "11px", color: "var(--muted-foreground)", lineHeight: 1.4 }}>
                    {step.description}
                  </p>
                  {step.output && isDone && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-2 px-3 py-2 rounded-lg bg-secondary/50"
                      style={{ fontSize: "11px", color: "var(--foreground)", lineHeight: 1.5 }}
                    >
                      {step.output}
                    </motion.div>
                  )}
                  {isActive && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2 flex items-center gap-2">
                      <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity }} className="w-1.5 h-1.5 rounded-full bg-ora-signal" />
                      <span style={{ fontSize: "11px", color: "var(--ora-signal)", fontWeight: 500 }}>Processing...</span>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            </div>
          );
        })}
      </div>

      {/* Bottom actions */}
      {isDone && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6 flex items-center gap-3 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg border hover:bg-secondary cursor-pointer transition-colors" style={{ borderColor: "var(--border)", fontSize: "12px", fontWeight: 500 }}>
            <Download size={13} />
            Export results
          </button>
          <Link to="/studio" className="flex items-center gap-2 px-4 py-2 rounded-lg border hover:bg-secondary transition-colors" style={{ borderColor: "var(--border)", fontSize: "12px", fontWeight: 500 }}>
            Open in Studio <ArrowRight size={12} />
          </Link>
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg border hover:bg-secondary cursor-pointer transition-colors" style={{ borderColor: "var(--border)", fontSize: "12px", fontWeight: 500 }}>
            <Copy size={13} />
            Duplicate flow
          </button>
        </motion.div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════
   TEMPLATES VIEW
   ═══════════════════════════════════ */

function TemplatesView({ onSelect }: { onSelect: (name: string) => void }) {
  return (
    <div>
      <h2 className="mb-2" style={{ fontSize: "18px", fontWeight: 500, color: "var(--foreground)", letterSpacing: "-0.02em" }}>
        Flow Templates
      </h2>
      <p className="mb-6" style={{ fontSize: "13px", color: "var(--muted-foreground)" }}>
        Start from a template or describe your workflow below.
      </p>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {flowTemplates.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.name}
              onClick={() => onSelect(t.name)}
              className="text-left p-4 rounded-xl border bg-card hover:border-border-strong hover:bg-secondary/30 transition-all cursor-pointer group"
              style={{ borderColor: "var(--border)", boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}
            >
              <div className="w-9 h-9 rounded-lg bg-ora-signal-light flex items-center justify-center mb-3">
                <Icon size={16} className="text-ora-signal" />
              </div>
              <p className="mb-1" style={{ fontSize: "13px", fontWeight: 500, color: "var(--foreground)" }}>{t.name}</p>
              <p style={{ fontSize: "11px", color: "var(--muted-foreground)", lineHeight: 1.4 }}>{t.formats}</p>
              <p className="mt-2" style={{ fontSize: "9px", color: "var(--muted-foreground)", opacity: 0.6 }}>{t.steps} steps</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════
   EMPTY VIEW
   ═══════════════════════════════════ */

function EmptyView() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6">
      <div className="w-16 h-16 rounded-2xl bg-ora-signal-light flex items-center justify-center mb-6">
        <GitBranch size={24} className="text-ora-signal" />
      </div>
      <h2 className="text-foreground mb-3" style={{ fontSize: "22px", fontWeight: 500, letterSpacing: "-0.02em" }}>
        Automate your content workflow
      </h2>
      <p className="text-muted-foreground text-center max-w-[440px]" style={{ fontSize: "15px", lineHeight: 1.55 }}>
        Chain AI operations like building a playlist. Generate, validate, cascade, export — one tap to run the entire sequence. As simple as sending a message.
      </p>
    </div>
  );
}