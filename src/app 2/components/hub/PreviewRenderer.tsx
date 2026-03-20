import React from "react";
import { Film } from "lucide-react";
import type { GenerationPreview } from "./hub-types";

export function PreviewRenderer({ preview, large = false }: { preview: GenerationPreview; large?: boolean }) {
  switch (preview.kind) {
    case "image":
      return (
        <div className="w-full h-full relative" style={{ background: preview.palette[3] }}>
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 200 150" preserveAspectRatio="xMidYMid slice">
            <rect width="200" height="150" fill={preview.palette[3]} />
            <circle cx="100" cy="75" r="40" fill={preview.palette[0]} opacity={0.15} />
            <circle cx="100" cy="75" r="25" fill={preview.palette[0]} opacity={0.2} />
            <circle cx="100" cy="75" r="12" fill={preview.palette[0]} opacity={0.3} />
            <circle cx="100" cy="75" r="4" fill={preview.palette[0]} />
            {[30, 50, 70].map((r, i) => (
              <circle key={i} cx="100" cy="75" r={r} fill="none" stroke={preview.palette[1]} strokeWidth="0.3" opacity={0.3 - i * 0.08} />
            ))}
            <line x1="60" y1="75" x2="140" y2="75" stroke={preview.palette[1]} strokeWidth="0.3" opacity={0.2} strokeDasharray="2 2" />
            <line x1="100" y1="35" x2="100" y2="115" stroke={preview.palette[1]} strokeWidth="0.3" opacity={0.2} strokeDasharray="2 2" />
          </svg>
          {!large && (
            <div className="absolute bottom-2 left-2">
              <span className="px-2 py-0.5 rounded bg-white/80 backdrop-blur-sm" style={{ fontSize: "9px", fontWeight: 500, color: preview.palette[0] }}>
                {preview.label}
              </span>
            </div>
          )}
        </div>
      );

    case "text":
      return (
        <div className="w-full h-full p-4 flex flex-col justify-center bg-card">
          <div className="space-y-1.5 mb-3">
            <div className="h-1 rounded-full bg-foreground/8" style={{ width: "100%" }} />
            <div className="h-1 rounded-full bg-foreground/8" style={{ width: "92%" }} />
            <div className="h-1 rounded-full bg-foreground/8" style={{ width: "88%" }} />
            <div className="h-1 rounded-full bg-foreground/6" style={{ width: "75%" }} />
          </div>
          <p className="text-foreground/70 line-clamp-3" style={{ fontSize: large ? "13px" : "10px", lineHeight: 1.5 }}>
            {preview.excerpt}
          </p>
          <div className="mt-auto pt-2">
            <span style={{ fontSize: "9px", color: "var(--muted-foreground)" }}>{preview.wordCount} words</span>
          </div>
        </div>
      );

    case "code":
      return (
        <div className="w-full h-full p-3 font-mono overflow-hidden" style={{ background: "#1a1a2e" }}>
          <div className="flex items-center gap-1 mb-2">
            <div className="w-1.5 h-1.5 rounded-full bg-red-400/50" />
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400/50" />
            <div className="w-1.5 h-1.5 rounded-full bg-green-400/50" />
            <span className="ml-2" style={{ fontSize: "8px", color: "rgba(255,255,255,0.3)" }}>{preview.language}</span>
          </div>
          <pre className="text-white/70 whitespace-pre-wrap" style={{ fontSize: large ? "11px" : "8px", lineHeight: 1.5 }}>
            {preview.snippet}
          </pre>
          <div className="mt-auto pt-1">
            <span style={{ fontSize: "8px", color: "rgba(255,255,255,0.25)" }}>{preview.lines} lines</span>
          </div>
        </div>
      );

    case "film":
      return (
        <div className="w-full h-full relative flex items-center justify-center" style={{ background: preview.frames[0] }}>
          <div className="absolute inset-0 flex">
            {preview.frames.map((color, i) => (
              <div key={i} className="flex-1 border-r border-white/10" style={{ background: color, opacity: 0.3 + i * 0.15 }} />
            ))}
          </div>
          <div className="relative z-10 w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
            <Film size={16} className="text-white/80" />
          </div>
          <div className="absolute bottom-2 right-2 z-10 px-2 py-0.5 rounded bg-black/40 backdrop-blur-sm">
            <span style={{ fontSize: "10px", fontWeight: 500, color: "white" }}>{preview.duration}</span>
          </div>
          <div className="absolute bottom-2 left-2 z-10 px-2 py-0.5 rounded bg-black/40 backdrop-blur-sm">
            <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.7)" }}>{preview.fps}fps</span>
          </div>
        </div>
      );

    case "sound":
      return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-card px-4">
          <div className="flex items-end gap-px w-full h-12 mb-2">
            {preview.waveform.map((h, i) => (
              <div key={i} className="flex-1 rounded-sm min-w-[2px]" style={{ height: h, background: "var(--ora-signal)", opacity: 0.3 + (h / 30) * 0.5 }} />
            ))}
          </div>
          <div className="flex items-center justify-between w-full">
            <span style={{ fontSize: "9px", color: "var(--muted-foreground)" }}>{preview.duration}</span>
            {preview.bpm && <span style={{ fontSize: "9px", color: "var(--muted-foreground)" }}>{preview.bpm} BPM</span>}
          </div>
        </div>
      );
  }
}
