import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Plus, Minus } from "lucide-react";

const faqs = [
  { q: "What makes ORA different from ChatGPT or Midjourney?", a: "With ChatGPT you only get GPT. With Midjourney you only get Midjourney. ORA gives you 38+ models in one studio. Plus Arena to compare outputs side by side, Campaign Lab for multi-platform generation, and Brand Vault for automatic compliance." },
  { q: "Which AI models are supported?", a: "GPT-5, GPT-4o, Claude 4.5, Gemini 2.5, DeepSeek V3, Mistral, Flux Pro 2, DALL-E 3, Photon 1, Leonardo AI, Luma Ray 2, Sora 2, Kling 2.1, Veo 3.1, Seedream V4, and many more. New models added monthly." },
  { q: "How does Campaign Lab work?", a: "Write a brief. Choose your platforms. Campaign Lab generates images, videos, and copy adapted for each platform - all at once." },
  { q: "What does one credit get?", a: "Text: 1 credit. Image: 4 credits. Audio: 4 credits. Code: 2 credits. Video (~10s): 100 credits. Credits never expire." },
  { q: "Do unused credits roll over?", a: "Yes, always. Monthly credits and purchased packs roll over indefinitely." },
  { q: "Is my content private?", a: "Yes. We don't train on your data. Full GDPR compliance." },
];

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="py-20 md:py-28" style={{ background: "#1a1918" }}>
      <div className="max-w-[720px] mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-10"
        >
          <h2
            style={{
              fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)",
              fontWeight: 500,
              lineHeight: 1.1,
              letterSpacing: "-0.03em",
              color: "#E8E4DF",
            }}
          >
            FAQ
          </h2>
        </motion.div>

        <div>
          {faqs.map((f, i) => {
            const isOpen = open === i;
            return (
              <motion.div
                key={i}
                style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.04 }}
              >
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="w-full flex items-center justify-between py-5 text-left cursor-pointer"
                >
                  <span
                    style={{
                      fontSize: "15px",
                      fontWeight: 500,
                      color: "#E8E4DF",
                      paddingRight: "1rem",
                    }}
                  >
                    {f.q}
                  </span>
                  <span
                    className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
                    style={{
                      background: isOpen ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.04)",
                    }}
                  >
                    {isOpen ? (
                      <Minus size={12} style={{ color: "#E8E4DF" }} />
                    ) : (
                      <Plus size={12} style={{ color: "#5C5856" }} />
                    )}
                  </span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <p
                        className="pb-5"
                        style={{ fontSize: "14px", lineHeight: 1.65, color: "#9A9590" }}
                      >
                        {f.a}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
