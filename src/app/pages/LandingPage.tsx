import { Hero } from "../components/Hero";
import { SocialProof } from "../components/SocialProof";
import { ThreeSteps } from "../components/ThreeSteps";
import { StudioExperience } from "../components/StudioExperience";
import { Pricing } from "../components/Pricing";
import { FAQ } from "../components/FAQ";
import { CTASection } from "../components/CTASection";

/**
 * Landing — 4 screens:
 * 1. Hero (living output grid + ORA + CTA) + model marquee
 * 2. "One prompt, all models" aggregator diagram
 * 3. Studio campaign multi-format preview
 * 4. Pricing + FAQ + CTA
 */

export function LandingPage() {
  return (
    <>
      <Hero />
      <SocialProof />
      <ThreeSteps />
      <StudioExperience />
      <Pricing />
      <FAQ />
      <CTASection />
    </>
  );
}
