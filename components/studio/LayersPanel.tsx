import { Eye, EyeOff, Lock, Unlock, GripVertical, Type, Image, Square, MousePointer } from "lucide-react";
import type { FormatType } from "./StudioCanvas";

export interface Layer {
  id: string;
  name: string;
  type: "text" | "image" | "shape" | "button" | "group";
  visible: boolean;
  locked: boolean;
  indent?: number;
}

const formatLayers: Record<FormatType, Layer[]> = {
  linkedin: [
    { id: "ln-engagement", name: "Engagement Bar", type: "shape", visible: true, locked: false },
    { id: "ln-image", name: "Post Image", type: "image", visible: true, locked: false },
    { id: "ln-body", name: "Post Body", type: "text", visible: true, locked: false },
    { id: "ln-header", name: "Profile Header", type: "group", visible: true, locked: true },
  ],
  email: [
    { id: "em-footer", name: "Footer", type: "text", visible: true, locked: false },
    { id: "em-cta", name: "CTA Button", type: "button", visible: true, locked: false },
    { id: "em-body", name: "Body Text", type: "text", visible: true, locked: false },
    { id: "em-headline", name: "Headline", type: "text", visible: true, locked: false },
    { id: "em-hero", name: "Hero Image", type: "image", visible: true, locked: false },
    { id: "em-header", name: "Header", type: "group", visible: true, locked: true },
  ],
  sms: [
    { id: "sms-msg2", name: "Message 2 — Link", type: "text", visible: true, locked: false },
    { id: "sms-msg1", name: "Message 1 — Body", type: "text", visible: true, locked: false },
    { id: "sms-header", name: "Contact Header", type: "group", visible: true, locked: true },
  ],
  ad: [
    { id: "ad-logo", name: "Logo", type: "image", visible: true, locked: false },
    { id: "ad-cta", name: "CTA Button", type: "button", visible: true, locked: false },
    { id: "ad-visual", name: "Pulse Visual", type: "image", visible: true, locked: false },
    { id: "ad-headline", name: "Headline", type: "text", visible: true, locked: false },
    { id: "ad-bg", name: "Background", type: "shape", visible: true, locked: true },
  ],
  landing: [
    { id: "lp-visual", name: "Hero Visual", type: "image", visible: true, locked: false },
    { id: "lp-cta", name: "CTA Button", type: "button", visible: true, locked: false },
    { id: "lp-sub", name: "Subtitle", type: "text", visible: true, locked: false },
    { id: "lp-hero", name: "Headline", type: "text", visible: true, locked: false },
    { id: "lp-nav", name: "Navigation", type: "group", visible: true, locked: true },
  ],
  stories: [
    { id: "st-cta", name: "Swipe Up CTA", type: "button", visible: true, locked: false },
    { id: "st-text", name: "Text Overlay", type: "text", visible: true, locked: false },
    { id: "st-visual", name: "Pulse Visual", type: "image", visible: true, locked: false },
    { id: "st-bg", name: "Background", type: "shape", visible: true, locked: true },
  ],
  newsletter: [
    { id: "nl-s3", name: "Section — Story", type: "group", visible: true, locked: false },
    { id: "nl-s2", name: "Section — Quick Bites", type: "group", visible: true, locked: false },
    { id: "nl-s1", name: "Section — Feature", type: "group", visible: true, locked: false },
    { id: "nl-header", name: "Newsletter Header", type: "group", visible: true, locked: true },
  ],
};

const typeIcons = {
  text: Type,
  image: Image,
  shape: Square,
  button: MousePointer,
  group: Square,
};

interface LayersPanelProps {
  format: FormatType;
  selectedId: string | null;
  onSelect: (id: string) => void;
  layerVisibility: Record<string, boolean>;
  onToggleVisibility: (id: string) => void;
}

export function LayersPanel({ format, selectedId, onSelect, layerVisibility, onToggleVisibility }: LayersPanelProps) {
  const layers = formatLayers[format] || [];

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2.5 flex items-center justify-between border-b" style={{ borderColor: "var(--border)" }}>
        <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--foreground)" }}>Layers</span>
        <span style={{ fontSize: "10px", color: "var(--muted-foreground)" }}>{layers.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {layers.map((layer) => {
          const isSelected = selectedId === layer.id;
          const isVisible = layerVisibility[layer.id] !== false;
          const TypeIcon = typeIcons[layer.type];

          return (
            <div
              key={layer.id}
              className={`flex items-center gap-1.5 px-2 py-1.5 mx-1 rounded-md cursor-pointer transition-colors group ${
                isSelected ? "bg-ora-signal-light" : "hover:bg-secondary/80"
              }`}
              onClick={() => onSelect(layer.id)}
            >
              {/* Drag handle */}
              <GripVertical size={10} className="text-muted-foreground/30 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab" />

              {/* Type icon */}
              <TypeIcon size={11} className={`flex-shrink-0 ${isSelected ? "text-ora-signal" : "text-muted-foreground"}`} />

              {/* Name */}
              <span
                className={`flex-1 truncate ${!isVisible ? "opacity-40" : ""}`}
                style={{
                  fontSize: "11px",
                  fontWeight: isSelected ? 500 : 400,
                  color: isSelected ? "var(--ora-signal)" : "var(--foreground)",
                }}
              >
                {layer.name}
              </span>

              {/* Visibility toggle */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleVisibility(layer.id);
                }}
                className="flex-shrink-0 text-muted-foreground/40 hover:text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                {isVisible ? <Eye size={11} /> : <EyeOff size={11} />}
              </button>

              {/* Lock indicator */}
              {layer.locked && (
                <Lock size={10} className="flex-shrink-0 text-muted-foreground/30" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { formatLayers };
