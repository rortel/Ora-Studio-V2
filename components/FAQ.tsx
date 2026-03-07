import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Plus, Minus } from "lucide-react";

const faqs = [
  {
    q: "What makes ORA different from ChatGPT or Claude directly?",
    a: "When you use ChatGPT, you only get GPT. When you use Claude, you only get Claude. ORA gives you every major model in one place — plus Arena to compare outputs, and Studio with Brand Vault when you need brand control. One account replaces multiple subscriptions.",
  },
  {
    q: "Can I use ORA without Brand Vault?",
    a: "Absolutely. The Free and Generate plans give you full access to all AI models and the Arena comparator. Brand Vault is a Studio feature — use it when you need brand consistency, skip it when you don't.",
  },
  {
    q: "How does Arena work?",
    a: "Write one prompt. Arena sends it to 2-4 models in parallel. You see all results side by side, pick the best, mix parts from different outputs, or refine. Text Arena costs 3-5 credits depending on the number of models.",
  },
  {
    q: "What happens when I run out of credits?",
    a: "You can buy credit packs anytime — they never expire. Unused monthly credits from Studio roll over indefinitely. No generation is lost, no data is deleted.",
  },
  {
    q: "What does one credit get you?",
    a: "Text (1 model): 1 credit. Arena comparison (3 models): 3 credits. Image: 4 credits. Audio: 4 credits. Code: 2 credits. Video (~10s): 100 credits. Simple, transparent.",
  },
  {
    q: "Do unused monthly credits roll over?",
    a: "Yes, always. Monthly credits and purchased credit packs roll over indefinitely. Nothing expires.",
  },
  {
    q: "Can I switch plans?",
    a: "Yes, upgrade or downgrade anytime. Changes take effect at the start of your next billing cycle. Your credits and Brand Vault data are always preserved.",
  },
  {
    q: "Is my content private?",
    a: "Yes. We don't train on your data. Content is processed in isolated environments. Full GDPR compliance. Enterprise offers dedicated infrastructure and SSO.",
  },
];

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="py-20 md:py-28">
      <div className="max-w-[720px] mx-auto px-6">
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
            FAQ
          </span>
          <h2
            className="text-foreground mb-4"
            style={{
              fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)',
              fontWeight: 500,
              letterSpacing: '-0.03em',
              lineHeight: 1.15,
            }}
          >
            Frequently asked questions
          </h2>
        </motion.div>

        <div>
          {faqs.map((faq, i) => {
            const isOpen = openIndex === i;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.04 }}
                className="border-b border-border"
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  className="w-full flex items-center justify-between py-5 text-left group cursor-pointer"
                >
                  <span className="text-foreground pr-4" style={{ fontSize: '15px', fontWeight: 450 }}>
                    {faq.q}
                  </span>
                  <span className="text-muted-foreground flex-shrink-0 group-hover:text-foreground transition-colors">
                    {isOpen ? <Minus size={16} /> : <Plus size={16} />}
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
                      <p className="pb-5 text-muted-foreground" style={{ fontSize: '14px', lineHeight: 1.65 }}>
                        {faq.a}
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
