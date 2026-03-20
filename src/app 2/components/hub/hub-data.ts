import { ImageIcon, Code2, Film, Music, FileText } from "lucide-react";
import type {
  ContentType, AIModel, GeneratedItem, LibraryItem,
  GenerationPreview, ContentTypeOption,
} from "./hub-types";

export const aiModels: Record<ContentType, AIModel[]> = {
  image: [
    { id: "ora-vision", name: "ORA Vision", provider: "ORA", speed: "fast", quality: 5 },
    { id: "flux-pro", name: "Flux Pro", provider: "Black Forest", speed: "medium", quality: 5 },
    { id: "midjourney", name: "Midjourney v6", provider: "Midjourney", speed: "medium", quality: 5 },
    { id: "dall-e", name: "DALL-E 3", provider: "OpenAI", speed: "fast", quality: 4 },
  ],
  text: [
    { id: "ora-writer", name: "ORA Writer", provider: "ORA", speed: "fast", quality: 5 },
    { id: "gpt-4o", name: "GPT-4o", provider: "OpenAI", speed: "fast", quality: 5 },
    { id: "claude-sonnet", name: "Claude Sonnet", provider: "Anthropic", speed: "fast", quality: 5 },
    { id: "gemini-pro", name: "Gemini Pro", provider: "Google", speed: "fast", quality: 4 },
  ],
  code: [
    { id: "ora-code", name: "ORA Code", provider: "ORA", speed: "fast", quality: 5 },
    { id: "gpt-4o-code", name: "GPT-4o", provider: "OpenAI", speed: "fast", quality: 5 },
    { id: "claude-code", name: "Claude Sonnet", provider: "Anthropic", speed: "fast", quality: 5 },
    { id: "gemini-code", name: "Gemini Pro", provider: "Google", speed: "medium", quality: 4 },
  ],
  film: [
    { id: "ora-motion", name: "ORA Motion", provider: "ORA", speed: "medium", quality: 5 },
    { id: "runway-gen3", name: "Runway Gen-3", provider: "Runway", speed: "slow", quality: 5 },
    { id: "pika", name: "Pika 2.0", provider: "Pika", speed: "medium", quality: 4 },
    { id: "sora", name: "Sora", provider: "OpenAI", speed: "slow", quality: 5 },
  ],
  sound: [
    { id: "ora-audio", name: "ORA Audio", provider: "ORA", speed: "fast", quality: 5 },
    { id: "elevenlabs", name: "ElevenLabs", provider: "ElevenLabs", speed: "fast", quality: 5 },
    { id: "suno", name: "Suno v4", provider: "Suno", speed: "medium", quality: 4 },
    { id: "udio", name: "Udio", provider: "Udio", speed: "medium", quality: 4 },
  ],
};

export const contentTypes: ContentTypeOption[] = [
  { id: "image", label: "Image", icon: ImageIcon },
  { id: "text", label: "Text", icon: FileText },
  { id: "code", label: "Code", icon: Code2 },
  { id: "film", label: "Film", icon: Film },
  { id: "sound", label: "Sound", icon: Music },
];

const palettes = [
  ["#3b4fc4", "#6b7ec9", "#c4cbe0", "#e8ebf4"],
  ["#1a1a2e", "#4a5568", "#9ba8d4", "#f4f4f6"],
  ["#2d3a8c", "#5a6abf", "#8b9ad4", "#d4daf0"],
  ["#1e293b", "#334155", "#64748b", "#cbd5e1"],
];

export function generateMockPreviews(type: ContentType, prompt: string, models: AIModel[]): GeneratedItem[] {
  const ts = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return models.map((model, i) => {
    const id = `gen-${Date.now()}-${i}`;
    let preview: GenerationPreview;
    switch (type) {
      case "image":
        preview = { kind: "image", palette: palettes[i % 4], label: ["Geometric composition", "Abstract signal pattern", "Minimal gradient field", "Structured grid layout"][i % 4] };
        break;
      case "text":
        preview = {
          kind: "text",
          excerpt: [
            "In an era where brand consistency defines market leadership, the ability to maintain a unified voice across every touchpoint becomes not just an advantage — it becomes the standard.",
            "Your brand speaks in one voice. Whether it's a LinkedIn post or a billboard, the message adapts to the medium while the essence remains untouched. That's not automation — that's intelligence.",
            "The gap between strategy and execution has never been wider. Until now. With AI-driven content orchestration, every piece of communication carries the full weight of your brand identity.",
            "Brand amplification isn't about being louder. It's about being clearer. Every channel, every format, every word — calibrated to resonate with precision.",
          ][i % 4],
          wordCount: [142, 128, 156, 118][i % 4],
        };
        break;
      case "code":
        preview = {
          kind: "code", language: "TypeScript", lines: [7, 6, 7, 7][i % 4],
          snippet: [
            "export async function cascadeContent(\n  master: MasterBrief,\n  formats: Format[]\n): Promise<CascadeResult> {\n  const vault = await loadBrandVault();\n  return formats.map(f => adapt(master, f, vault));\n}",
            "const pipeline = createPipeline([\n  analyzeIntent(brief),\n  validateCompliance(vault),\n  generateVariants(formats),\n  scoreAndRank(criteria),\n]);",
            "interface BrandVault {\n  tone: ToneProfile;\n  vocabulary: ApprovedTerms;\n  visual: VisualIdentity;\n  compliance: ComplianceRules;\n  audience: AudienceSegment[];\n}",
            "async function orchestrate(input: string) {\n  const agents = await Agent.deploy(15);\n  const results = await Promise.all(\n    agents.map(a => a.process(input))\n  );\n  return merge(results);\n}",
          ][i % 4],
        };
        break;
      case "film":
        preview = { kind: "film", duration: ["0:15", "0:12", "0:18", "0:10"][i % 4], frames: palettes[i % 4], fps: 30 };
        break;
      case "sound":
        preview = {
          kind: "sound",
          waveform: Array.from({ length: 48 }, (_, j) => 8 + Math.sin(j * 0.4 + i) * 12 + Math.random() * 8),
          duration: ["0:32", "0:28", "0:45", "0:20"][i % 4],
          bpm: [120, 90, 140, 100][i % 4],
        };
        break;
    }
    return { id, type, model, prompt, timestamp: ts, saved: false, selected: false, preview };
  });
}

export const mockLibrary: LibraryItem[] = [
  { id: "lib-1", type: "image", model: aiModels.image[0], prompt: "Abstract brand pattern for Q2 campaign", timestamp: "Yesterday", saved: true, selected: false, tags: ["brand", "Q2"], preview: { kind: "image", palette: palettes[0], label: "Brand Pattern — Q2" } },
  { id: "lib-2", type: "text", model: aiModels.text[0], prompt: "LinkedIn announcement copy", timestamp: "Yesterday", saved: true, selected: false, tags: ["linkedin", "launch"], preview: { kind: "text", excerpt: "We're excited to announce a new chapter in brand intelligence. ORA Studio brings 15 AI agents together to ensure every word carries your brand's DNA.", wordCount: 234 } },
  { id: "lib-3", type: "code", model: aiModels.code[2], prompt: "API integration for content pipeline", timestamp: "2 days ago", saved: true, selected: false, tags: ["api", "integration"], preview: { kind: "code", language: "TypeScript", snippet: "const ora = new ORAClient({ apiKey });\nconst campaign = await ora.campaigns.create({\n  brief: \"Q2 product launch\",\n  formats: [\"email\", \"linkedin\", \"ad\"],\n});", lines: 5 } },
  { id: "lib-4", type: "film", model: aiModels.film[1], prompt: "15s product teaser for social", timestamp: "3 days ago", saved: true, selected: false, tags: ["social", "teaser"], preview: { kind: "film", duration: "0:15", frames: palettes[2], fps: 30 } },
  { id: "lib-5", type: "sound", model: aiModels.sound[0], prompt: "Ambient background for brand video", timestamp: "4 days ago", saved: true, selected: false, tags: ["ambient", "video"], preview: { kind: "sound", waveform: Array.from({ length: 48 }, (_, j) => 10 + Math.sin(j * 0.3) * 14 + Math.random() * 6), duration: "0:45", bpm: 90 } },
  { id: "lib-6", type: "image", model: aiModels.image[2], prompt: "Minimal visual for email header", timestamp: "5 days ago", saved: true, selected: false, tags: ["email", "header"], preview: { kind: "image", palette: palettes[3], label: "Email Header Visual" } },
];

export function getPlaceholder(type: ContentType): string {
  switch (type) {
    case "image": return "Describe the image you want to create...";
    case "text": return "Describe the text you need...";
    case "code": return "Describe what the code should do...";
    case "film": return "Describe the video you want to generate...";
    case "sound": return "Describe the sound or music you need...";
  }
}

export function getSuggestions(type: ContentType): string[] {
  switch (type) {
    case "image": return ["Brand pattern", "Abstract header", "Social visual", "Ad creative", "Icon set"];
    case "text": return ["LinkedIn post", "Email copy", "Ad headline", "Blog intro", "Tagline"];
    case "code": return ["API integration", "React component", "Data pipeline", "Auth flow", "Landing page"];
    case "film": return ["Product teaser", "Brand intro", "Story ad", "Explainer clip", "Logo reveal"];
    case "sound": return ["Background ambient", "Jingle", "Podcast intro", "Notification", "Voiceover"];
  }
}
