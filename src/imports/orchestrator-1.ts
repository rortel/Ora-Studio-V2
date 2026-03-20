import type { AgentInput, AgentOutput, AgentName } from './base-agent.ts';
import { BaseAgent } from './base-agent.ts';

interface RoutingResult {
  agent: AgentName;
  intent: string;
  edit_type: string;
  confidence: number;
}

// Weighted keyword signals for routing
const ROUTING_SIGNALS: { agent: AgentName; intent: string; edit_type: string; patterns: RegExp[]; weight: number }[] = [
  // HIGH CONFIDENCE — specific tool requests
  { agent: 'art-director', intent: 'visual_change', edit_type: 'visual', weight: 10, patterns: [/colou?r palette/i, /visual direction/i, /brand.*visual/i, /moodboard/i, /design system/i] },
  { agent: 'photographer', intent: 'image_gen', edit_type: 'visual', weight: 10, patterns: [/generate.*image/i, /create.*photo/i, /image.*brief/i, /visual.*for.*post/i, /ai.*image/i] },
  { agent: 'video-maker', intent: 'video_change', edit_type: 'format', weight: 10, patterns: [/video.*script/i, /storyboard/i, /reel.*script/i, /tiktok.*script/i, /short.*video/i] },
  { agent: 'email-specialist', intent: 'email_change', edit_type: 'format', weight: 10, patterns: [/email.*sequence/i, /newsletter/i, /subject.*line/i, /email.*campaign/i, /drip/i] },
  { agent: 'seo-strategist', intent: 'seo_optimization', edit_type: 'optimization', weight: 10, patterns: [/seo/i, /keyword.*strat/i, /meta.*desc/i, /search.*rank/i, /title.*tag/i] },
  { agent: 'campaign-multiplier', intent: 'cascade', edit_type: 'format', weight: 10, patterns: [/cascade/i, /multiply/i, /repurpose/i, /all.*platform/i, /every.*format/i, /shockwave/i] },

  // MEDIUM-HIGH — format/platform shifts
  { agent: 'art-director', intent: 'visual_change', edit_type: 'visual', weight: 7, patterns: [/colou?r/i, /font/i, /layout/i, /visual/i, /design/i, /logo/i, /image/i] },
  { agent: 'video-maker', intent: 'video_change', edit_type: 'format', weight: 7, patterns: [/video/i, /reel/i, /short/i, /motion/i, /animation/i] },
  { agent: 'email-specialist', intent: 'email_change', edit_type: 'format', weight: 7, patterns: [/email/i, /subject/i, /send/i, /inbox/i, /open.*rate/i] },
  { agent: 'social-optimizer', intent: 'platform_adapt', edit_type: 'format', weight: 7, patterns: [/adapt.*for.*linkedin/i, /instagram.*version/i, /twitter.*version/i, /platform.*specific/i] },

  // MEDIUM — strategic/creative redirects
  { agent: 'creative-director', intent: 'creative_redirect', edit_type: 'strategy', weight: 6, patterns: [/different.*angle/i, /different.*approach/i, /try.*something/i, /creative.*route/i, /concept/i, /another.*way/i, /direction/i, /not.*working/i, /start.*over/i, /scrap.*this/i] },
  { agent: 'strategic-planner', intent: 'strategy_query', edit_type: 'intelligence', weight: 6, patterns: [/strateg/i, /editorial.*calendar/i, /what.*should.*post/i, /content.*plan/i, /suggest.*topic/i, /this.*week/i, /competitive/i, /trending/i] },
  { agent: 'brand-analyst', intent: 'vault_query', edit_type: 'intelligence', weight: 6, patterns: [/vault/i, /brand.*identity/i, /brand.*dna/i, /scan/i, /analyz.*brand/i, /who.*are.*we/i] },
  { agent: 'audience-analyst', intent: 'audience_query', edit_type: 'intelligence', weight: 6, patterns: [/audience/i, /persona/i, /target/i, /who.*read/i, /demographic/i, /behavio/i] },
  { agent: 'hashtag-specialist', intent: 'hashtag_timing', edit_type: 'optimization', weight: 6, patterns: [/hashtag/i, /best.*time/i, /when.*post/i, /timing/i, /trending.*tag/i] },

  // MEDIUM — compliance/quality
  { agent: 'compliance-guard', intent: 'compliance_check', edit_type: 'validation', weight: 6, patterns: [/compliance/i, /score/i, /on[\s-]brand/i, /brand.*guide/i, /check.*this/i, /validate/i, /is.*this.*ok/i] },
  { agent: 'performance-analyst', intent: 'performance_query', edit_type: 'intelligence', weight: 6, patterns: [/performance/i, /analytics/i, /what.*worked/i, /engagement/i, /metrics/i, /a\/b.*test/i] },

  // LOW — tone/content edits (default to copywriter)
  { agent: 'copywriter', intent: 'tone_change', edit_type: 'tone', weight: 4, patterns: [/tone/i, /formal/i, /casual/i, /warm/i, /bold/i, /punchy/i, /softer/i, /corporate/i, /human/i, /friendly/i, /serious/i, /professional/i] },
  { agent: 'copywriter', intent: 'structure_change', edit_type: 'structure', weight: 4, patterns: [/shorter/i, /longer/i, /paragraph/i, /hook/i, /opening/i, /cta/i, /headline/i, /rewrite/i, /remove/i, /add.*section/i, /move.*up/i, /move.*down/i] },
  { agent: 'copywriter', intent: 'content_edit', edit_type: 'content', weight: 3, patterns: [/change/i, /edit/i, /fix/i, /update/i, /replace/i, /better/i, /improve/i] },

  // Platform mentions → social optimizer
  { agent: 'social-optimizer', intent: 'platform_adapt', edit_type: 'format', weight: 5, patterns: [/linkedin/i, /instagram/i, /twitter/i, /facebook/i, /tiktok/i] },
];

export class AgentOrchestrator {
  private agents: Map<AgentName, BaseAgent> = new Map();

  register(agent: BaseAgent) { this.agents.set(agent.info.name, agent); }

  async run(name: AgentName, input: AgentInput): Promise<AgentOutput> {
    const agent = this.agents.get(name);
    if (!agent) return { success: false, agent: name, error: `Agent not found: ${name}`, execution_time_ms: 0 };
    return agent.run(input);
  }

  async runParallel(names: AgentName[], inputs: AgentInput[]): Promise<AgentOutput[]> {
    return Promise.all(names.map((n, i) => this.run(n, inputs[i])));
  }

  // ── INTELLIGENT MULTI-SIGNAL ROUTING ──
  routeMessage(message: string): RoutingResult {
    // Score each possible agent
    const scores: Map<string, { agent: AgentName; intent: string; edit_type: string; score: number }> = new Map();

    for (const signal of ROUTING_SIGNALS) {
      for (const pattern of signal.patterns) {
        if (pattern.test(message)) {
          const key = `${signal.agent}-${signal.intent}`;
          const existing = scores.get(key);
          if (!existing || signal.weight > existing.score) {
            scores.set(key, { agent: signal.agent, intent: signal.intent, edit_type: signal.edit_type, score: signal.weight });
          } else {
            // Accumulate evidence but cap at 2x the base weight
            scores.set(key, { ...existing, score: Math.min(existing.score + 2, signal.weight * 2) });
          }
        }
      }
    }

    // Handle multi-signal conflicts
    if (scores.size === 0) {
      return { agent: 'copywriter', intent: 'content_edit', edit_type: 'content', confidence: 50 };
    }

    // Sort by score, pick highest
    const ranked = Array.from(scores.values()).sort((a, b) => b.score - a.score);
    const best = ranked[0];

    // Special cases: if "cascade" or "multiply" is detected alongside a platform, cascade wins
    const hasCascade = ranked.find(r => r.intent === 'cascade');
    if (hasCascade && hasCascade.score >= 6) {
      return { ...hasCascade, confidence: Math.min(hasCascade.score * 10, 95) };
    }

    // If creative redirect AND copywriter edit both score high, creative director wins (it's a bigger change)
    const hasCreative = ranked.find(r => r.agent === 'creative-director');
    const hasCopywriter = ranked.find(r => r.agent === 'copywriter');
    if (hasCreative && hasCopywriter && hasCreative.score >= hasCopywriter.score - 1) {
      return { ...hasCreative, confidence: Math.min(hasCreative.score * 10, 90) };
    }

    // If platform is mentioned AND the request is about adapting content, social optimizer wins over copywriter
    const hasSocial = ranked.find(r => r.agent === 'social-optimizer');
    if (hasSocial && hasCopywriter && /for\s+(linkedin|instagram|twitter|x\b)/i.test(message)) {
      return { ...hasSocial, confidence: Math.min(hasSocial.score * 10, 85) };
    }

    return {
      agent: best.agent,
      intent: best.intent,
      edit_type: best.edit_type,
      confidence: Math.min(best.score * 10, 95),
    };
  }

  // ── GENERATE + COMPLY pipeline ──
  async generateAndValidate(agentName: AgentName, input: AgentInput): Promise<{ generation: AgentOutput; compliance: AgentOutput }> {
    const generation = await this.run(agentName, input);
    if (!generation.success || !generation.content) {
      return {
        generation,
        compliance: { success: false, agent: 'compliance-guard', error: 'No content to validate', execution_time_ms: 0 },
      };
    }

    const compliance = await this.run('compliance-guard', {
      instruction: 'Validate this content',
      vault: input.vault,
      asset: { type: input.asset?.type || 'general', content: generation.content },
      context: input.context,
    });

    // If compliance score is below 80, try one auto-fix round
    if (compliance.compliance_score !== undefined && compliance.compliance_score < 80 && compliance.structured_data?.fixed_text) {
      const fixedCompliance = await this.run('compliance-guard', {
        instruction: 'Validate this auto-fixed content',
        vault: input.vault,
        asset: { type: input.asset?.type || 'general', content: compliance.structured_data.fixed_text },
        context: input.context,
      });
      if ((fixedCompliance.compliance_score || 0) > (compliance.compliance_score || 0)) {
        generation.content = compliance.structured_data.fixed_text;
        return { generation, compliance: fixedCompliance };
      }
    }

    return { generation, compliance };
  }

  getAgentInfo() { return Array.from(this.agents.values()).map(a => a.info); }
  healthCheck() { return { agents_registered: this.agents.size, agents: Array.from(this.agents.keys()) }; }
}

export const orchestrator = new AgentOrchestrator();
