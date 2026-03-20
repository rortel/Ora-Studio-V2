import type { LucideIcon } from "lucide-react";

export type ContentType = "image" | "code" | "film" | "sound" | "text";
export type HubTab = "generate" | "library" | "compare";

export interface AIModel {
  id: string;
  name: string;
  provider: string;
  speed: "fast" | "medium" | "slow";
  quality: number;
}

export interface GeneratedItem {
  id: string;
  type: ContentType;
  model: AIModel;
  prompt: string;
  timestamp: string;
  saved: boolean;
  selected: boolean;
  preview: GenerationPreview;
}

export interface LibraryItem extends GeneratedItem {
  folder?: string;
  tags: string[];
}

export type GenerationPreview =
  | { kind: "image"; palette: string[]; label: string }
  | { kind: "text"; excerpt: string; wordCount: number }
  | { kind: "code"; language: string; snippet: string; lines: number }
  | { kind: "film"; duration: string; frames: string[]; fps: number }
  | { kind: "sound"; waveform: number[]; duration: string; bpm?: number };

export interface ContentTypeOption {
  id: ContentType;
  label: string;
  icon: LucideIcon;
}
