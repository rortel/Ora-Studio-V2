import { motion } from "motion/react";
import { Brain, PenTool, TrendingUp, Shield } from "lucide-react";

const agentGroups = [
  {
    category: "Intelligence",
    icon: Brain,
    color: "#3b4fc4",
    lightBg: "rgba(59,79,196,0.06)",
    agents: ["Brand Analyst", "Strategic Planner", "Audience Analyst"],
  },
  {
    category: "Creation",
    icon: PenTool,
    color: "#6b7ec9",
    lightBg: "rgba(107,126,201,0.06)",
    agents: [
      "Creative Director",
      "Copywriter",
      "Art Director",
      "Email Specialist",
      "Video Maker",
    ],
  },
  {
    category: "Optimization",
    icon: TrendingUp,
    color: "#4a5568",
    lightBg: "rgba(74,85,104,0.06)",
    agents: [
      "SEO Strategist",
      "Social Media Optimizer",
      "Campaign Multiplier",
    ],
  },
  {
    category: "Compliance",
    icon: Shield,
    color: "#1a1a2e",
    lightBg: "rgba(26,26,46,0.04)",
    agents: ["Compliance Guard", "Performance Analyst"],
  },
];

export function Agents() {
  return (
    <section
      id="agents"
      className="py-20 md:py-28"
      style={{
        background:
          "linear-gradient(180deg, var(--secondary) 0%, var(--background) 100%)",
      }}
    >
      <div className="max-w-[1200px] mx-auto px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-12"
        >
          <span
            className="inline-block mb-4 px-3 py-1 rounded-full"
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
            Your team
          </span>
          <h2
            className="text-foreground mb-4"
            style={{
              fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)",
              fontWeight: 500,
              letterSpacing: "-0.03em",
              lineHeight: 1.15,
            }}
          >
            15 agents.{" "}
            <span className="text-muted-foreground">One team.</span>
          </h2>
          <p
            className="text-muted-foreground max-w-[560px]"
            style={{ fontSize: "16px", lineHeight: 1.55 }}
          >
            Each agent is a specialist. Each one knows your brand. None of them
            deliver content below 90/100.
          </p>
        </motion.div>

        {/* 4 columns */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {agentGroups.map((group, gi) => {
            const Icon = group.icon;
            return (
              <motion.div
                key={group.category}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: gi * 0.08 }}
                className="bg-card border rounded-xl p-6 group hover:border-ora-signal/15 transition-all"
                style={{
                  borderColor: "var(--border)",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                }}
              >
                <div className="flex items-center gap-2.5 mb-5">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{
                      background: group.lightBg,
                    }}
                  >
                    <Icon size={14} style={{ color: group.color }} strokeWidth={1.5} />
                  </div>
                  <div>
                    <span
                      className="uppercase tracking-wider block"
                      style={{
                        fontSize: "10px",
                        fontWeight: 600,
                        letterSpacing: "0.08em",
                        color: group.color,
                      }}
                    >
                      {group.category}
                    </span>
                    <span
                      className="text-muted-foreground"
                      style={{ fontSize: "10px" }}
                    >
                      {group.agents.length} agents
                    </span>
                  </div>
                </div>
                <ul className="space-y-2.5">
                  {group.agents.map((agent) => (
                    <li key={agent} className="flex items-center gap-2.5">
                      <span
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ background: group.color, opacity: 0.35 }}
                      />
                      <span
                        className="text-foreground"
                        style={{ fontSize: "13px", fontWeight: 400 }}
                      >
                        {agent}
                      </span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
