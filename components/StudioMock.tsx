import { motion } from "motion/react";

const chatMessages = [
  {
    agent: "ORA",
    role: "Copywriter",
    score: 94,
    text: "Here's your LinkedIn post for the product launch. Compliance: 94/100. Tone is confident and clear — matches your Brand Vault formality score of 7/10.",
    isFirst: true,
  },
  {
    agent: null,
    role: "user",
    score: null,
    text: "The opening is too soft. Start with a bold statement.",
    isFirst: false,
  },
  {
    agent: "ORA",
    role: "Copywriter",
    score: 96,
    text: "Done. I've replaced the opening with a contrarian hook. Score went from 94 to 96 — the bolder tone better matches your vault.",
    isFirst: false,
  },
];

const quickActions = [
  "Shorten",
  "Align tone",
  "Add CTA",
  "Try a different angle",
];

export function StudioMock() {
  return (
    <section
      id="studio"
      className="py-20 md:py-28 relative"
      style={{
        background:
          "radial-gradient(ellipse 80% 50% at 50% 100%, rgba(59,79,196,0.04) 0%, transparent 60%)",
      }}
    >
      <div className="max-w-[1200px] mx-auto px-6">
        {/* Section header */}
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
            Live preview
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
            The conversation is the product
          </h2>
          <p
            className="text-muted-foreground max-w-[560px]"
            style={{ fontSize: "16px", lineHeight: 1.55 }}
          >
            Talk to your content like you would brief a senior creative team.
            ORA executes in 3-6 seconds.
          </p>
        </motion.div>

        {/* Studio frame */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="bg-card border rounded-2xl overflow-hidden"
          style={{
            borderColor: "rgba(59,79,196,0.12)",
            boxShadow:
              "0 1px 3px rgba(0,0,0,0.04), 0 12px 48px rgba(0,0,0,0.06), 0 0 0 1px rgba(59,79,196,0.04)",
          }}
        >
          {/* Title bar */}
          <div
            className="flex items-center justify-between px-5 py-3 border-b"
            style={{ borderColor: "var(--border)" }}
          >
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: "rgba(0,0,0,0.1)" }} />
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: "rgba(0,0,0,0.1)" }} />
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: "rgba(0,0,0,0.1)" }} />
              </div>
              <span
                className="text-muted-foreground ml-2"
                style={{ fontSize: "12px" }}
              >
                Acme Corp — LinkedIn Post
              </span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div
                  className="h-1.5 rounded-full bg-ora-signal"
                  style={{ width: "48px" }}
                />
                <span
                  className="text-ora-signal"
                  style={{ fontSize: "13px", fontWeight: 600 }}
                >
                  96/100
                </span>
              </div>
              <button
                className="border px-4 py-1.5 rounded-lg text-foreground hover:bg-secondary transition-colors"
                style={{
                  borderColor: "var(--border-strong)",
                  fontSize: "12px",
                  fontWeight: 500,
                }}
              >
                Approve
              </button>
            </div>
          </div>

          <div className="flex flex-col md:flex-row min-h-[460px]">
            {/* Left: Chat panel */}
            <div
              className="md:w-[50%] border-b md:border-b-0 md:border-r flex flex-col"
              style={{ borderColor: "var(--border)" }}
            >
              <div className="flex-1 p-6 space-y-5 overflow-y-auto">
                {chatMessages.map((msg, i) => {
                  if (msg.agent) {
                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 6 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.12 }}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <div
                            className="w-5 h-5 rounded-full flex items-center justify-center"
                            style={{
                              background: "var(--ora-signal)",
                            }}
                          >
                            <span style={{ fontSize: "8px", fontWeight: 700, color: "white" }}>O</span>
                          </div>
                          <span
                            className="text-foreground"
                            style={{
                              fontSize: "13px",
                              fontWeight: 600,
                            }}
                          >
                            {msg.agent}
                          </span>
                          <span
                            className="text-muted-foreground"
                            style={{ fontSize: "12px" }}
                          >
                            {msg.role}
                          </span>
                          {msg.score && (
                            <span
                              className="ml-auto px-2 py-0.5 rounded-full"
                              style={{
                                fontSize: "10px",
                                fontWeight: 600,
                                color: "var(--ora-signal)",
                                background: "var(--ora-signal-light)",
                              }}
                            >
                              {msg.score}/100
                            </span>
                          )}
                        </div>
                        <p
                          className="text-foreground/80 pl-7"
                          style={{ fontSize: "14px", lineHeight: 1.6 }}
                        >
                          {msg.text}
                        </p>
                      </motion.div>
                    );
                  }
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 6 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.12 }}
                      className="flex justify-end"
                    >
                      <div
                        className="text-white px-4 py-3 rounded-2xl rounded-br-md max-w-[80%]"
                        style={{
                          background: "linear-gradient(135deg, var(--ora-signal) 0%, #2a3ba8 100%)",
                          fontSize: "14px",
                          lineHeight: 1.5,
                        }}
                      >
                        {msg.text}
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Quick actions */}
              <div className="px-6 pb-5 flex flex-wrap gap-2">
                {quickActions.map((action) => (
                  <button
                    key={action}
                    className="border px-3.5 py-1.5 rounded-lg text-foreground hover:bg-secondary hover:border-ora-signal/20 transition-all"
                    style={{
                      borderColor: "var(--border)",
                      fontSize: "12px",
                      fontWeight: 400,
                    }}
                  >
                    {action}
                  </button>
                ))}
              </div>
            </div>

            {/* Right: LinkedIn Preview */}
            <div className="md:w-[50%] p-6 flex flex-col bg-secondary/20">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-5">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{
                      background: "var(--primary)",
                      color: "var(--primary-foreground)",
                      fontSize: "14px",
                      fontWeight: 600,
                    }}
                  >
                    A
                  </div>
                  <div>
                    <p
                      className="text-foreground"
                      style={{ fontSize: "14px", fontWeight: 600 }}
                    >
                      Acme Corp
                    </p>
                    <p
                      className="text-muted-foreground"
                      style={{ fontSize: "12px" }}
                    >
                      12,847 followers
                    </p>
                  </div>
                </div>

                <div className="space-y-3 mb-6">
                  <p
                    className="text-foreground"
                    style={{
                      fontSize: "15px",
                      fontWeight: 600,
                      lineHeight: 1.45,
                    }}
                  >
                    <span
                      className="px-1 rounded"
                      style={{
                        background:
                          "linear-gradient(135deg, rgba(59,79,196,0.12) 0%, rgba(59,79,196,0.06) 100%)",
                        borderBottom: "2px solid rgba(59,79,196,0.3)",
                      }}
                    >
                      Most analytics tools give you data. We give you decisions.
                    </span>
                  </p>
                  <p
                    className="text-foreground/80"
                    style={{ fontSize: "14px", lineHeight: 1.55 }}
                  >
                    We just shipped AI Analytics — and it doesn't just surface
                    numbers. It tells you what to do next.
                  </p>
                  <p
                    className="text-foreground/80"
                    style={{ fontSize: "14px", lineHeight: 1.55 }}
                  >
                    Real-time. Automated. Predictive.
                  </p>
                  <p
                    className="text-foreground"
                    style={{
                      fontSize: "14px",
                      fontWeight: 600,
                      lineHeight: 1.55,
                    }}
                  >
                    Start free. Link in bio.
                  </p>
                </div>

                {/* Metrics */}
                <div
                  className="grid grid-cols-3 gap-4 pt-5 border-t"
                  style={{ borderColor: "var(--border)" }}
                >
                  {[
                    { label: "Tone", value: "7.2", max: "10" },
                    { label: "Compliance", value: "96", max: "100" },
                    { label: "Read time", value: "25", max: "sec" },
                  ].map((m) => (
                    <div key={m.label} className="text-center">
                      <div className="flex items-baseline justify-center gap-0.5">
                        <span
                          className="text-foreground"
                          style={{
                            fontSize: "20px",
                            fontWeight: 600,
                            letterSpacing: "-0.02em",
                            lineHeight: 1.2,
                          }}
                        >
                          {m.value}
                        </span>
                        <span
                          className="text-muted-foreground"
                          style={{ fontSize: "11px" }}
                        >
                          /{m.max}
                        </span>
                      </div>
                      <p
                        className="text-muted-foreground mt-0.5"
                        style={{ fontSize: "10px", fontWeight: 500 }}
                      >
                        {m.label}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div
                className="pt-4 mt-4 border-t"
                style={{ borderColor: "var(--border)" }}
              >
                <p
                  className="text-muted-foreground text-right"
                  style={{ fontSize: "11px" }}
                >
                  Blue highlight = last edit
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
