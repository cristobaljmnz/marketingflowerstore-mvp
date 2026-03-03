"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────

type StyleSelector = "auto" | "studio" | "street";

interface StepRow {
  id: string;
  label: string;
  status: "pending" | "running" | "done" | "error";
}

interface CampaignVariant {
  style: "studio" | "street";
  campaignPlan: {
    campaignTitle: string;
    creativeIntent: "promo" | "emotional";
    captionOptions: string[];
    hashtags: string[];
    deliverables: string[];
  };
  generatedImageUrls: string[];
  savedId: string;
}

interface PipelineResult {
  variants: CampaignVariant[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STEP_LABELS: Record<string, string> = {
  upload: "Uploading image",
  router: "Routing style",
  retrieval: "Retrieving references",
  "creative-director": "Planning campaign",
  "image-generation": "Generating images",
  saving: "Saving to gallery",
};

function stepLabel(key: string, style?: string) {
  const base = STEP_LABELS[key] ?? key;
  return style ? `${base} — ${style}` : base;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function GeneratePage() {
  const [styleSelector, setStyleSelector] = useState<StyleSelector>("auto");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [userMessage, setUserMessage] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [steps, setSteps] = useState<StepRow[]>([]);
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const [captionIndices, setCaptionIndices] = useState<Record<number, number>>({});

  const onDrop = useCallback((accepted: File[]) => {
    const f = accepted[0];
    if (!f) return;
    setImageFile(f);
    setImagePreview(URL.createObjectURL(f));
    setResult(null);
    setGenError(null);
    setSteps([]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/jpeg": [], "image/png": [], "image/webp": [] },
    maxFiles: 1,
    disabled: isGenerating,
  });

  function upsertStep(key: string, status: StepRow["status"], style?: string) {
    const id = style ? `${key}-${style}` : key;
    const label = stepLabel(key, style);
    setSteps((prev) => {
      const exists = prev.find((s) => s.id === id);
      if (exists) return prev.map((s) => (s.id === id ? { ...s, status } : s));
      return [...prev, { id, label, status }];
    });
  }

  async function handleGenerate() {
    if (!imageFile || !userMessage.trim() || isGenerating) return;
    setIsGenerating(true);
    setResult(null);
    setGenError(null);
    setSteps([]);
    setCaptionIndices({});

    let finalResult: PipelineResult | null = null;

    try {
      // Upload image
      upsertStep("upload", "running");
      const fd = new FormData();
      fd.append("file", imageFile);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: fd });
      if (!uploadRes.ok) throw new Error("Image upload failed");
      const { imageUrl: productImageUrl } = (await uploadRes.json()) as { imageUrl: string };
      upsertStep("upload", "done");

      // Pipeline SSE
      const pipelineRes = await fetch("/api/pipeline/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productImageUrl, userMessage, styleSelector }),
      });
      if (!pipelineRes.body) throw new Error("No response body");

      const reader = pipelineRes.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";

        for (const part of parts) {
          for (const line of part.split("\n")) {
            if (!line.startsWith("data: ")) continue;

            let ev: {
              type: string;
              step?: string;
              status?: string;
              style?: string;
              data?: PipelineResult;
              error?: string;
            };
            try {
              ev = JSON.parse(line.slice(6));
            } catch {
              continue;
            }

            if (ev.type === "progress" && ev.step && ev.status) {
              upsertStep(ev.step, ev.status as StepRow["status"], ev.style);
            } else if (ev.type === "result" && ev.data) {
              finalResult = ev.data;
            } else if (ev.type === "error") {
              throw new Error(ev.error ?? "Pipeline error");
            }
          }
        }
      }

      if (finalResult) {
        setResult(finalResult);
      } else {
        throw new Error("Pipeline ended without a result");
      }
    } catch (err) {
      setGenError(String(err));
      setSteps((prev) =>
        prev.map((s) => (s.status === "running" ? { ...s, status: "error" } : s))
      );
    } finally {
      setIsGenerating(false);
    }
  }

  const canGenerate = !!imageFile && !!userMessage.trim() && !isGenerating;
  const showStepper = steps.length > 0 && !result;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "400px 1fr",
        height: "100vh",
        overflow: "hidden",
      }}
    >
      {/* ── Left panel: inputs ── */}
      <aside
        style={{
          borderRight: "1px solid var(--rim)",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          padding: "2rem 1.75rem",
          gap: "1.75rem",
          background: "var(--surface)",
        }}
      >
        {/* Brand header */}
        <div>
          <h1
            className="display"
            style={{
              fontSize: "1.3rem",
              fontWeight: 300,
              letterSpacing: "0.04em",
              color: "var(--cream)",
              margin: 0,
            }}
          >
            flowerstore.ph
          </h1>
          <p
            style={{
              fontSize: "0.65rem",
              textTransform: "uppercase",
              letterSpacing: "0.18em",
              color: "var(--faint)",
              marginTop: "0.2rem",
            }}
          >
            Ad Generator
          </p>
        </div>

        {/* Style selector */}
        <div>
          <Label>Creative Style</Label>
          <div
            style={{
              display: "flex",
              border: "1px solid var(--rim)",
              borderRadius: "5px",
              overflow: "hidden",
            }}
          >
            {(["auto", "studio", "street"] as StyleSelector[]).map((s) => {
              const active = styleSelector === s;
              return (
                <button
                  key={s}
                  onClick={() => setStyleSelector(s)}
                  disabled={isGenerating}
                  style={{
                    flex: 1,
                    padding: "0.6rem 0",
                    background: active ? "var(--card2)" : "transparent",
                    border: "none",
                    borderBottom: `2px solid ${active ? "var(--copper)" : "transparent"}`,
                    color: active ? "var(--cream)" : "var(--faint)",
                    cursor: isGenerating ? "default" : "pointer",
                    fontSize: "0.8rem",
                    fontFamily: "'DM Sans', sans-serif",
                    fontWeight: active ? 500 : 400,
                    transition: "all 0.15s",
                  }}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              );
            })}
          </div>
          <p style={{ fontSize: "0.72rem", color: "var(--ghost)", marginTop: "0.5rem", lineHeight: 1.5 }}>
            {styleSelector === "auto" && "AI classifies your brief into the best style"}
            {styleSelector === "studio" && "Product-forward — prices, urgency, clean backgrounds"}
            {styleSelector === "street" && "Lifestyle — real people, candid, emotional, no CTAs"}
          </p>
        </div>

        {/* Dropzone */}
        <div>
          <Label>Product Image</Label>
          <div
            {...getRootProps()}
            style={{
              border: `1px ${imagePreview ? "solid" : "dashed"} ${
                isDragActive ? "var(--copper)" : "var(--rim)"
              }`,
              borderRadius: "5px",
              cursor: isGenerating ? "default" : "pointer",
              overflow: "hidden",
              background: isDragActive ? "var(--card)" : "transparent",
              transition: "border-color 0.15s, background 0.15s",
            }}
          >
            <input {...getInputProps()} />
            {imagePreview ? (
              <img
                src={imagePreview}
                alt="Product"
                style={{
                  width: "100%",
                  aspectRatio: "1",
                  objectFit: "cover",
                  display: "block",
                }}
              />
            ) : (
              <div style={{ padding: "2.5rem 1rem", textAlign: "center" }}>
                <div style={{ fontSize: "1.4rem", opacity: 0.2, marginBottom: "0.75rem" }}>⬆</div>
                <p style={{ fontSize: "0.8rem", color: "var(--faint)" }}>
                  {isDragActive ? "Drop it here" : "Drop a product image or click to browse"}
                </p>
                <p style={{ fontSize: "0.7rem", color: "var(--ghost)", marginTop: "0.35rem" }}>
                  JPG · PNG · WEBP
                </p>
              </div>
            )}
          </div>
          {imagePreview && !isGenerating && (
            <button
              onClick={() => {
                setImageFile(null);
                setImagePreview(null);
              }}
              style={{
                marginTop: "0.4rem",
                fontSize: "0.7rem",
                color: "var(--ghost)",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
              }}
            >
              Remove image
            </button>
          )}
        </div>

        {/* Brief */}
        <div style={{ flex: 1 }}>
          <Label>Campaign Brief</Label>
          <textarea
            value={userMessage}
            onChange={(e) => setUserMessage(e.target.value)}
            disabled={isGenerating}
            placeholder="Describe the occasion, mood, audience, key message…"
            rows={6}
            style={{
              width: "100%",
              background: "var(--bg)",
              border: "1px solid var(--rim)",
              borderRadius: "5px",
              color: "var(--cream)",
              padding: "0.875rem",
              fontSize: "0.875rem",
              fontFamily: "'DM Sans', sans-serif",
              resize: "vertical",
              outline: "none",
              lineHeight: 1.65,
            }}
          />
        </div>

        {/* Submit */}
        <button
          onClick={handleGenerate}
          disabled={!canGenerate}
          style={{
            width: "100%",
            padding: "0.875rem",
            background: canGenerate ? "var(--copper)" : "var(--card)",
            color: canGenerate ? "var(--bg)" : "var(--ghost)",
            border: "none",
            borderRadius: "5px",
            fontSize: "0.875rem",
            fontWeight: 500,
            cursor: canGenerate ? "pointer" : "not-allowed",
            fontFamily: "'DM Sans', sans-serif",
            letterSpacing: "0.02em",
            transition: "background 0.15s, color 0.15s",
          }}
        >
          {isGenerating ? "Generating…" : "Generate Campaign"}
        </button>

        {/* Nav */}
        <div
          style={{
            display: "flex",
            gap: "1.5rem",
            paddingTop: "0.75rem",
            borderTop: "1px solid var(--rim)",
          }}
        >
          <Link href="/library" style={{ fontSize: "0.72rem", color: "var(--faint)", textDecoration: "none" }}>
            Library
          </Link>
          <Link href="/gallery" style={{ fontSize: "0.72rem", color: "var(--faint)", textDecoration: "none" }}>
            Gallery
          </Link>
        </div>
      </aside>

      {/* ── Right panel: results ── */}
      <section style={{ overflowY: "auto", height: "100vh", background: "var(--bg)" }}>
        {/* Empty state */}
        {steps.length === 0 && !result && !genError && (
          <div
            style={{
              display: "flex",
              height: "100%",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "column",
              gap: "0.75rem",
              opacity: 0.18,
              userSelect: "none",
            }}
          >
            <span
              className="display"
              style={{ fontSize: "2.5rem", fontWeight: 300, fontStyle: "italic" }}
            >
              ready to generate
            </span>
            <p style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
              Upload a product and describe your campaign
            </p>
          </div>
        )}

        {/* Step progress */}
        {showStepper && (
          <div className="fade-up" style={{ padding: "3rem 2.5rem" }}>
            <h2
              className="display"
              style={{
                fontSize: "0.7rem",
                textTransform: "uppercase",
                letterSpacing: "0.18em",
                color: "var(--faint)",
                marginBottom: "2rem",
                fontFamily: "'DM Sans', sans-serif",
                fontWeight: 400,
              }}
            >
              Running Pipeline
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              {steps.map((step) => (
                <StepRowItem key={step.id} step={step} />
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {genError && !isGenerating && (
          <div className="fade-up" style={{ padding: "3rem 2.5rem" }}>
            <h2
              className="display"
              style={{ fontSize: "1.4rem", fontWeight: 400, color: "var(--err)", marginBottom: "1rem" }}
            >
              Pipeline Error
            </h2>
            <p
              style={{
                fontSize: "0.875rem",
                color: "#7A5A5A",
                lineHeight: 1.6,
                maxWidth: "480px",
                fontFamily: "monospace",
              }}
            >
              {genError}
            </p>
          </div>
        )}

        {/* Results */}
        {result && !isGenerating && (
          <div className="fade-up" style={{ padding: "2.5rem" }}>
            <h2
              className="display"
              style={{
                fontSize: "1.75rem",
                fontWeight: 300,
                marginBottom: "2rem",
                lineHeight: 1.2,
              }}
            >
              {result.variants.length > 1
                ? "Two Variants — Ambiguous Style"
                : "Campaign Generated"}
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "2.5rem" }}>
              {result.variants.map((v, i) => (
                <VariantCard
                  key={i}
                  variant={v}
                  captionIdx={captionIndices[i] ?? 0}
                  onCaptionNext={() =>
                    setCaptionIndices((prev) => ({
                      ...prev,
                      [i]: ((prev[i] ?? 0) + 1) % v.campaignPlan.captionOptions.length,
                    }))
                  }
                />
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: "0.65rem",
        textTransform: "uppercase",
        letterSpacing: "0.14em",
        color: "var(--faint)",
        marginBottom: "0.6rem",
      }}
    >
      {children}
    </div>
  );
}

function StepRowItem({ step }: { step: StepRow }) {
  const dotColor = {
    pending: "var(--rim2)",
    running: "var(--copper)",
    done: "var(--sage)",
    error: "var(--err)",
  }[step.status];

  const textColor = {
    pending: "var(--ghost)",
    running: "var(--cream)",
    done: "var(--faint)",
    error: "var(--err)",
  }[step.status];

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.875rem" }}>
      <div
        style={{
          width: "7px",
          height: "7px",
          borderRadius: "50%",
          flexShrink: 0,
          background: dotColor,
          animation: step.status === "running" ? "stepPulse 1.4s ease-in-out infinite" : "none",
        }}
      />
      <span style={{ fontSize: "0.875rem", color: textColor }}>{step.label}</span>
    </div>
  );
}

function VariantCard({
  variant,
  captionIdx,
  onCaptionNext,
}: {
  variant: CampaignVariant;
  captionIdx: number;
  onCaptionNext: () => void;
}) {
  const colCount = Math.min(variant.generatedImageUrls.length, 3);

  return (
    <div
      style={{
        background: "var(--card)",
        borderRadius: "6px",
        overflow: "hidden",
        border: "1px solid var(--rim)",
      }}
    >
      {/* Generated images */}
      {variant.generatedImageUrls.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${colCount}, 1fr)`,
            gap: "1px",
            background: "var(--rim)",
          }}
        >
          {variant.generatedImageUrls.map((url, j) => (
            <img
              key={j}
              src={url}
              alt={variant.campaignPlan.deliverables?.[j] ?? `Ad ${j + 1}`}
              style={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block" }}
            />
          ))}
        </div>
      )}

      <div style={{ padding: "1.5rem" }}>
        {/* Title + badges */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "1rem",
            marginBottom: "1.25rem",
          }}
        >
          <h3
            className="display"
            style={{ fontSize: "1.5rem", fontWeight: 400, lineHeight: 1.2, margin: 0 }}
          >
            {variant.campaignPlan.campaignTitle}
          </h3>
          <div style={{ display: "flex", gap: "0.4rem", flexShrink: 0, marginTop: "0.25rem" }}>
            <Badge type={variant.style} />
            <Badge type={variant.campaignPlan.creativeIntent} />
          </div>
        </div>

        {/* Caption */}
        <div style={{ marginBottom: "1.25rem" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "0.5rem",
            }}
          >
            <span
              style={{
                fontSize: "0.62rem",
                textTransform: "uppercase",
                letterSpacing: "0.14em",
                color: "var(--ghost)",
              }}
            >
              Caption {captionIdx + 1} / {variant.campaignPlan.captionOptions.length}
            </span>
            {variant.campaignPlan.captionOptions.length > 1 && (
              <button
                onClick={onCaptionNext}
                style={{
                  fontSize: "0.72rem",
                  color: "var(--copper)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                Next →
              </button>
            )}
          </div>
          <p style={{ fontSize: "0.875rem", color: "var(--muted)", lineHeight: 1.65, margin: 0 }}>
            {variant.campaignPlan.captionOptions[captionIdx]}
          </p>
        </div>

        {/* Hashtags */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem", marginBottom: "1.25rem" }}>
          {variant.campaignPlan.hashtags.slice(0, 10).map((tag) => (
            <span
              key={tag}
              style={{
                fontSize: "0.72rem",
                color: "var(--copper-l)",
                background: "var(--card2)",
                padding: "0.2rem 0.5rem",
                borderRadius: "3px",
              }}
            >
              {tag.startsWith("#") ? tag : `#${tag}`}
            </span>
          ))}
        </div>

        <Link
          href="/gallery"
          style={{
            fontSize: "0.72rem",
            color: "var(--ghost)",
            textDecoration: "none",
            borderBottom: "1px solid var(--rim)",
            paddingBottom: "1px",
          }}
        >
          View in gallery →
        </Link>
      </div>
    </div>
  );
}

function Badge({ type }: { type: string }) {
  const configs: Record<string, { bg: string; color: string }> = {
    studio:    { bg: "#2A1E14", color: "#C4845A" },
    street:    { bg: "#141E16", color: "#688F6E" },
    promo:     { bg: "#2A1E14", color: "#C4845A" },
    emotional: { bg: "#14181E", color: "#5A7E9E" },
  };
  const c = configs[type] ?? { bg: "var(--card2)", color: "var(--muted)" };
  return (
    <span
      style={{
        fontSize: "0.62rem",
        fontWeight: 500,
        padding: "0.2rem 0.5rem",
        borderRadius: "3px",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        background: c.bg,
        color: c.color,
      }}
    >
      {type}
    </span>
  );
}
