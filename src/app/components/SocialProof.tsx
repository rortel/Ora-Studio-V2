const models = [
  "GPT-5", "Claude 4.5", "Gemini 2.5", "Flux Pro 2", "DALL-E 3",
  "Luma Ray 2", "Photon 1", "Sora 2", "Mistral", "Kling 2.1",
  "DeepSeek V3", "Veo 3.1", "Seedream V4", "Leonardo AI", "Pika 2.0", "Runway Gen-3",
];

export function SocialProof() {
  const doubled = [...models, ...models];

  return (
    <section
      className="py-6 overflow-hidden"
      style={{ borderTop: "1px solid rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
    >
      <div className="relative">
        <div className="absolute left-0 top-0 bottom-0 w-24 z-10" style={{ background: "linear-gradient(90deg, #131211 0%, transparent 100%)" }} />
        <div className="absolute right-0 top-0 bottom-0 w-24 z-10" style={{ background: "linear-gradient(270deg, #131211 0%, transparent 100%)" }} />
        <div
          className="flex items-center gap-10 whitespace-nowrap"
          style={{ animation: "ora-marquee 60s linear infinite" }}
        >
          {doubled.map((name, i) => (
            <span
              key={`${name}-${i}`}
              style={{ fontSize: "13px", fontWeight: 400, color: "#5C5856", letterSpacing: "-0.01em" }}
            >
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
