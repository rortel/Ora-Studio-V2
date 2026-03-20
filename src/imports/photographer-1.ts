import { BaseAgent, type AgentInfo, type AgentInput, type AgentOutput, callLLM, parseJSON, generateImage, uploadToStorage } from './base-agent.ts';

export class PhotographerAgent extends BaseAgent {
  info: AgentInfo = {
    name: 'photographer', display_name: 'Photographer',
    role: 'AI image generation within brand visual codes',
    layer: 'creation', color: '#3B82F6',
    expertise: ['AI image generation', 'Photo direction', 'Platform adaptation', 'Imagen 3', 'Gemini'],
  };

  buildSystemPrompt(vault: any): string {
    const ps = vault?.visual?.photography_style || {};
    const vis = vault?.visual || {};
    return `You are ORA's Photographer — expert in AI image generation prompt engineering.

BRAND VISUAL CODES:
- Photo style: ${ps.description || '?'}
- Mood: ${ps.mood_keywords?.join(', ') || '?'}
- Avoid: ${ps.avoid_keywords?.join(', ') || '?'}
- Primary color: ${vis.colors?.primary || '?'}
- Secondary: ${vis.colors?.secondary || '?'}
- Accent: ${vis.colors?.accent || '?'}

YOUR JOB: Generate a precise image generation prompt optimized for Imagen 3 / Google AI.

OUTPUT (JSON only, no markdown):
{
  "prompt": "<detailed prompt: subject, composition, lighting, mood, brand colors woven in, style, camera angle — 50-150 words>",
  "negative_prompt": "<what to exclude: brand avoid keywords + generic exclusions>",
  "aspect_ratio": "<best ratio for the target platform: 1:1 | 3:4 | 4:3 | 9:16 | 16:9>",
  "alt_text": "<accessible description for screen readers>",
  "rationale": "<why this visual serves the brand>"
}

RULES:
- ALWAYS include brand color references in the prompt (e.g. "dominant ${vis.colors?.primary || 'brand'} tones")
- ALWAYS include mood keywords from the vault
- ALWAYS include avoid keywords as negative prompts
- Be SPECIFIC: "A confident woman in her 30s reviewing data on a tablet in a modern office, warm ${vis.colors?.primary || ''} accent lighting" not "business person working"
- NO text in images (AI-generated text looks bad)
- NO logos (never reliable)
- Prefer photography style over illustration unless specified`;
  }

  async run(input: AgentInput): Promise<AgentOutput> {
    const t = Date.now();
    try {
      // Step 1: Generate the prompt via LLM
      const sys = this.buildSystemPrompt(input.vault);
      const resp = await callLLM(sys, this.buildUserMessage(input));
      const parsed = parseJSON(resp);

      if (!parsed?.prompt) {
        return { success: true, agent: 'photographer', content: resp, structured_data: parsed, execution_time_ms: Date.now() - t };
      }

      // Step 2: Generate the actual image via Imagen 3 / Gemini
      try {
        const result = await generateImage(parsed.prompt, {
          negativePrompt: parsed.negative_prompt,
          aspectRatio: this.mapAspectRatio(parsed.aspect_ratio),
          count: 1,
        });

        if (result.images.length > 0) {
          const img = result.images[0];
          
          // Step 3: Upload to Supabase Storage
          const ext = img.mime_type.includes('png') ? 'png' : 'jpg';
          const filename = `generated/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
          
          let imageUrl: string | undefined;
          try {
            imageUrl = await uploadToStorage(img.base64, img.mime_type, filename);
          } catch (uploadErr: any) {
            // Storage upload failed — still return the base64
            console.error('Storage upload failed:', uploadErr.message);
          }

          return {
            success: true,
            agent: 'photographer',
            content: parsed.rationale || 'Image generated successfully.',
            structured_data: {
              ...parsed,
              generated: true,
              image_url: imageUrl,
              has_base64: true,
            },
            image_url: imageUrl,
            image_base64: img.base64,
            media: [{ type: 'image', url: imageUrl, base64: img.base64, mime_type: img.mime_type }],
            explanation: `Image generated${imageUrl ? ` and uploaded` : ''} — ${parsed.aspect_ratio} ratio. ${parsed.rationale || ''}`,
            execution_time_ms: Date.now() - t,
          };
        }
      } catch (genErr: any) {
        // Image generation failed — return the prompt as fallback
        console.error('Image generation failed:', genErr.message);
        return {
          success: true,
          agent: 'photographer',
          content: resp,
          structured_data: { ...parsed, generated: false, generation_error: genErr.message },
          explanation: `Image prompt ready but generation failed: ${genErr.message}. You can use this prompt in any AI image tool.`,
          execution_time_ms: Date.now() - t,
        };
      }

      return { success: true, agent: 'photographer', content: resp, structured_data: parsed, execution_time_ms: Date.now() - t };
    } catch (e: any) {
      return { success: false, agent: 'photographer', error: e.message, execution_time_ms: Date.now() - t };
    }
  }

  private mapAspectRatio(ratio: string): '1:1' | '3:4' | '4:3' | '9:16' | '16:9' {
    const map: Record<string, '1:1' | '3:4' | '4:3' | '9:16' | '16:9'> = {
      '1:1': '1:1', 'square': '1:1',
      '3:4': '3:4', '4:5': '3:4', 'portrait': '3:4',
      '4:3': '4:3', '5:4': '4:3',
      '9:16': '9:16', 'story': '9:16', 'reel': '9:16', 'vertical': '9:16',
      '16:9': '16:9', 'landscape': '16:9', 'wide': '16:9', 'cover': '16:9',
    };
    return map[ratio?.toLowerCase()] || '1:1';
  }
}
