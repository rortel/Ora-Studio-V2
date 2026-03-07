import { Hero } from "../components/Hero";
import { ProductShowcase } from "../components/ProductShowcase";
import { SocialProof } from "../components/SocialProof";
import { SupportedModels } from "../components/SupportedModels";
import { ArenaDemo } from "../components/ArenaDemo";
import { ThreeSteps } from "../components/ThreeSteps";
import { StudioSection } from "../components/StudioSection";
import { Pricing } from "../components/Pricing";
import { FAQ } from "../components/FAQ";
import { CTASection } from "../components/CTASection";

export function LandingPage() {
  return (
    <>
      <Hero />
      <ProductShowcase />
      <SocialProof />
      <SupportedModels />
      <ArenaDemo />
      <ThreeSteps />
      <StudioSection />
      <Pricing />
      <FAQ />
      <CTASection />
    </>
  );
}