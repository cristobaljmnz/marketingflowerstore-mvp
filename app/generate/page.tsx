"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useDropzone } from "react-dropzone";
import Link from "next/link";
import gsap from "gsap";

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

  const panelRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Entrance animation
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from("[data-enter]", {
        y: 22,
        opacity: 0,
        duration: 0.7,
        ease: "power3.out",
        stagger: 0.08,
      });
    }, panelRef);
    return () => ctx.revert();
  }, []);

  // Animate result cards when they appear
  useEffect(() => {
    if (!result) return;
    const ctx = gsap.context(() => {
      gsap.from("[data-card]", {
        y: 28,
        opacity: 0,
        duration: 0.65,
        ease: "power3.out",
        stagger: 0.15,
      });
    }, resultsRef);
    return () => ctx.revert();
  }, [result]);

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
      upsertStep("upload", "running");
      const fd = new FormData();
      fd.append("file", imageFile);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: fd });
      if (!uploadRes.ok) throw new Error("Image upload failed");
      const { imageUrl: productImageUrl } = (await uploadRes.json()) as { imageUrl: string };
      upsertStep("upload", "done");

      const pipelineRes = await fetch("/api/pipeline/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productImageUrl, userMessage, styleSelector }),
      });
      if (!pipelineRes.body) throw new Error("No response body");

      const reader = pipelineRes.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      type SSEEvent = {
        type: string;
        step?: string;
        status?: string;
        style?: string;
        data?: PipelineResult;
        error?: string;
      };

      function processChunk(chunk: string) {
        const parts = chunk.split("\n\n");
        const remaining = parts.pop() ?? "";
        for (const part of parts) {
          for (const line of part.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            let ev: SSEEvent;
            try { ev = JSON.parse(line.slice(6)); } catch { continue; }
            if (ev.type === "progress" && ev.step && ev.status) {
              upsertStep(ev.step, ev.status as StepRow["status"], ev.style);
            } else if (ev.type === "result" && ev.data) {
              finalResult = ev.data;
            } else if (ev.type === "error") {
              throw new Error(ev.error ?? "Pipeline error");
            }
          }
        }
        return remaining;
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) { if (buf.trim()) processChunk(buf + "\n\n"); break; }
        buf += decoder.decode(value, { stream: true });
        buf = processChunk(buf);
      }

      if (finalResult) {
        setResult(finalResult);
      } else {
        throw new Error("Pipeline ended without a result");
      }
    } catch (err) {
      setGenError(String(err));
      setSteps((prev) => prev.map((s) => (s.status === "running" ? { ...s, status: "error" } : s)));
    } finally {
      setIsGenerating(false);
    }
  }

  const canGenerate = !!imageFile && !!userMessage.trim() && !isGenerating;
  const showStepper = steps.length > 0 && !result;

  return (
    <div
      style={{
        height: "100dvh",
        display: "flex",
        flexDirection: "column",
        paddingTop: "var(--nav-offset)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "clamp(300px, 30vw, 420px) 1fr",
          overflow: "hidden",
        }}
      >
        {/* ── Left panel ── */}
        <aside
          ref={panelRef}
          style={{
            borderRight: "1px solid var(--rim)",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            padding: "2rem 1.75rem",
            gap: "1.5rem",
            background: "var(--surface)",
          }}
        >
          {/* Header */}
          <div data-enter>
            <h1
              className="display"
              style={{
                fontSize: "1.75rem",
                fontWeight: 400,
                fontStyle: "italic",
                color: "var(--cream)",
                margin: 0,
                lineHeight: 1.1,
              }}
            >
              Ad Generator
            </h1>
            <p
              style={{
                fontSize: "0.72rem",
                color: "var(--faint)",
                marginTop: "0.3rem",
                fontFamily: "'Outfit', sans-serif",
              }}
            >
              Upload a product, describe the campaign
            </p>
          </div>

          {/* Style selector */}
          <div data-enter>
            <FieldLabel>Creative Style</FieldLabel>
            <div
              style={{
                display: "flex",
                gap: "0.375rem",
              }}
            >
              {(["auto", "studio", "street"] as StyleSelector[]).map((s) => {
                const active = styleSelector === s;
                return (
                  <button
                    key={s}
                    onClick={() => setStyleSelector(s)}
                    disabled={isGenerating}
                    className="btn"
                    style={{
                      flex: 1,
                      padding: "0.6rem 0",
                      background: active ? "var(--brand)" : "var(--card)",
                      color: active ? "#fff" : "var(--faint)",
                      border: `1px solid ${active ? "var(--brand)" : "var(--rim2)"}`,
                      borderRadius: "var(--r-sm)",
                      fontSize: "0.78rem",
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                      fontWeight: active ? 600 : 400,
                      boxShadow: active ? "0 2px 10px rgba(226,83,73,0.22)" : "none",
                    }}
                  >
                    <span className="btn-slide" style={{ background: "var(--brand-l)" }} />
                    <span style={{ position: "relative", zIndex: 1 }}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </span>
                  </button>
                );
              })}
            </div>
            <p
              style={{
                fontSize: "0.7rem",
                color: "var(--ghost)",
                marginTop: "0.5rem",
                lineHeight: 1.5,
                fontFamily: "'Outfit', sans-serif",
              }}
            >
              {styleSelector === "auto" && "AI classifies your brief into the best style"}
              {styleSelector === "studio" && "Product-forward — prices, urgency, clean backgrounds"}
              {styleSelector === "street" && "Lifestyle — real people, candid, emotional, no CTAs"}
            </p>
          </div>

          {/* Dropzone */}
          <div data-enter>
            <FieldLabel>Product Image</FieldLabel>
            <div
              {...getRootProps()}
              style={{
                border: `2px ${imagePreview ? "solid" : "dashed"} ${
                  isDragActive ? "var(--brand)" : "var(--rim2)"
                }`,
                borderRadius: "var(--r-md)",
                cursor: isGenerating ? "default" : "pointer",
                overflow: "hidden",
                background: isDragActive ? "rgba(226,83,73,0.04)" : "var(--card)",
                transition: "border-color 0.2s, background 0.2s",
              }}
            >
              <input {...getInputProps()} />
              {imagePreview ? (
                <img
                  src={imagePreview}
                  alt="Product"
                  style={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block" }}
                />
              ) : (
                <div style={{ padding: "2.5rem 1rem", textAlign: "center" }}>
                  <div
                    style={{
                      width: "3rem",
                      height: "3rem",
                      borderRadius: "var(--r-sm)",
                      background: "var(--surface)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      margin: "0 auto 0.875rem",
                      fontSize: "1.2rem",
                    }}
                  >
                    ⬆
                  </div>
                  <p style={{ fontSize: "0.82rem", color: "var(--muted)", margin: 0 }}>
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
                onClick={() => { setImageFile(null); setImagePreview(null); }}
                style={{
                  marginTop: "0.4rem",
                  fontSize: "0.7rem",
                  color: "var(--ghost)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                }}
              >
                Remove image
              </button>
            )}
          </div>

          {/* Brief */}
          <div data-enter style={{ flex: 1 }}>
            <FieldLabel>Campaign Brief</FieldLabel>
            <textarea
              value={userMessage}
              onChange={(e) => setUserMessage(e.target.value)}
              disabled={isGenerating}
              placeholder="Describe the occasion, mood, audience, key message…"
              rows={6}
              style={{
                width: "100%",
                background: "var(--card)",
                border: "1px solid var(--rim2)",
                borderRadius: "var(--r-md)",
                color: "var(--cream)",
                padding: "1rem 1.125rem",
                fontSize: "0.875rem",
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                resize: "vertical",
                outline: "none",
                lineHeight: 1.65,
                transition: "border-color 0.2s",
              }}
              onFocus={(e) => (e.target.style.borderColor = "var(--brand)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--rim2)")}
            />
          </div>

          {/* Submit */}
          <button
            data-enter
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="btn"
            style={{
              width: "100%",
              padding: "0.9rem",
              background: canGenerate ? "var(--brand)" : "var(--card2)",
              color: canGenerate ? "#fff" : "var(--ghost)",
              borderRadius: "var(--r-md)",
              fontSize: "0.875rem",
              fontWeight: 600,
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              letterSpacing: "-0.01em",
              boxShadow: canGenerate ? "0 4px 18px rgba(226,83,73,0.28)" : "none",
              border: "none",
            }}
          >
            <span className="btn-slide" style={{ background: "var(--brand-l)" }} />
            <span style={{ position: "relative", zIndex: 1 }}>
              {isGenerating ? "Generating…" : "Generate Campaign"}
            </span>
          </button>
        </aside>

        {/* ── Right panel ── */}
        <section
          ref={resultsRef}
          style={{ overflowY: "auto", background: "var(--bg)", height: "100%" }}
        >
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
                userSelect: "none",
              }}
            >
              <span
                className="display"
                style={{
                  fontSize: "2.75rem",
                  fontWeight: 300,
                  fontStyle: "italic",
                  color: "var(--ghost)",
                }}
              >
                ready to generate
              </span>
              <p style={{ fontSize: "0.8rem", color: "var(--ghost)", fontFamily: "'Outfit', sans-serif" }}>
                Upload a product and describe your campaign
              </p>
            </div>
          )}

          {/* Stepper */}
          {showStepper && (
            <div className="fade-up" style={{ padding: "3rem 2.5rem" }}>
              <p
                style={{
                  fontSize: "0.65rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.16em",
                  color: "var(--faint)",
                  marginBottom: "2rem",
                  fontFamily: "'Outfit', sans-serif",
                }}
              >
                Running Pipeline
              </p>
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
              <div
                style={{
                  background: "#FFF5F5",
                  border: "1px solid rgba(192,68,68,0.2)",
                  borderRadius: "var(--r-md)",
                  padding: "1.5rem",
                  maxWidth: "520px",
                }}
              >
                <h2
                  style={{
                    fontSize: "0.75rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.14em",
                    color: "var(--err)",
                    marginBottom: "0.75rem",
                    fontFamily: "'Outfit', sans-serif",
                  }}
                >
                  Pipeline Error
                </h2>
                <p className="mono" style={{ fontSize: "0.78rem", color: "#8B4B4B", lineHeight: 1.6 }}>
                  {genError}
                </p>
              </div>
            </div>
          )}

          {/* Results */}
          {result && !isGenerating && (
            <div style={{ padding: "2.5rem" }}>
              <h2
                className="display"
                style={{
                  fontSize: "2rem",
                  fontWeight: 400,
                  fontStyle: "italic",
                  marginBottom: "2rem",
                  lineHeight: 1.2,
                  color: "var(--cream)",
                }}
              >
                {result.variants.length > 1 ? "Two Variants Generated" : "Campaign Ready"}
              </h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
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
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: "0.62rem",
        textTransform: "uppercase",
        letterSpacing: "0.15em",
        color: "var(--faint)",
        marginBottom: "0.6rem",
        fontFamily: "'Outfit', sans-serif",
        fontWeight: 500,
      }}
    >
      {children}
    </div>
  );
}

function StepRowItem({ step }: { step: StepRow }) {
  const dotColor = {
    pending: "var(--rim2)",
    running: "var(--brand)",
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
      <span style={{ fontSize: "0.875rem", color: textColor, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        {step.label}
      </span>
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
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const colCount = Math.min(variant.generatedImageUrls.length, 3);

  return (
    <>
      {lightboxUrl && <ImageLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />}
      <div
        data-card
        style={{
          background: "var(--card)",
          borderRadius: "var(--r-md)",
          overflow: "hidden",
          border: "1px solid var(--rim)",
          boxShadow: "0 4px 24px rgba(226,83,73,0.05)",
        }}
      >
        {variant.generatedImageUrls.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${colCount}, 1fr)`,
              gap: "2px",
              background: "var(--rim)",
            }}
          >
            {variant.generatedImageUrls.map((url, j) => (
              <img
                key={j}
                src={url}
                alt={variant.campaignPlan.deliverables?.[j] ?? `Ad ${j + 1}`}
                onClick={() => setLightboxUrl(url)}
                style={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block", cursor: "zoom-in" }}
              />
            ))}
          </div>
        )}

      <div style={{ padding: "1.75rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", marginBottom: "1.25rem" }}>
          <h3
            className="display"
            style={{ fontSize: "1.5rem", fontWeight: 400, fontStyle: "italic", lineHeight: 1.2, margin: 0, color: "var(--cream)" }}
          >
            {variant.campaignPlan.campaignTitle}
          </h3>
          <div style={{ display: "flex", gap: "0.375rem", flexShrink: 0, marginTop: "0.25rem" }}>
            <Badge type={variant.style} />
            <Badge type={variant.campaignPlan.creativeIntent} />
          </div>
        </div>

        {/* Caption */}
        <div
          style={{
            background: "var(--surface)",
            borderRadius: "var(--r-sm)",
            padding: "1rem 1.125rem",
            marginBottom: "1.25rem",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--ghost)", fontFamily: "'Outfit', sans-serif" }}>
              Caption {captionIdx + 1} / {variant.campaignPlan.captionOptions.length}
            </span>
            {variant.campaignPlan.captionOptions.length > 1 && (
              <button
                onClick={onCaptionNext}
                className="nav-link"
                style={{ fontSize: "0.72rem", color: "var(--brand)", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "'Plus Jakarta Sans', sans-serif" }}
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
                color: "var(--brand)",
                background: "rgba(226,83,73,0.07)",
                padding: "0.2rem 0.6rem",
                borderRadius: "var(--r-lg)",
                fontFamily: "'Outfit', sans-serif",
              }}
            >
              {tag.startsWith("#") ? tag : `#${tag}`}
            </span>
          ))}
        </div>

        <Link
          href="/gallery"
          className="nav-link"
          style={{ fontSize: "0.72rem", color: "var(--faint)", textDecoration: "none" }}
        >
          View in gallery →
        </Link>
      </div>
    </div>
    </>
  );
}

function ImageLightbox({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.92)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 500,
        padding: "1.5rem",
        cursor: "zoom-out",
      }}
    >
      <img
        src={url}
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "100%",
          maxHeight: "100%",
          objectFit: "contain",
          borderRadius: "4px",
          boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
          cursor: "default",
        }}
      />
    </div>
  );
}

function Badge({ type }: { type: string }) {
  const configs: Record<string, { bg: string; color: string }> = {
    studio:    { bg: "rgba(226,83,73,0.08)",  color: "#C04040" },
    street:    { bg: "rgba(107,158,120,0.12)", color: "#3D6B4A" },
    promo:     { bg: "rgba(226,83,73,0.08)",  color: "#C04040" },
    emotional: { bg: "rgba(90,120,160,0.10)", color: "#3D5A80" },
  };
  const c = configs[type] ?? { bg: "var(--surface)", color: "var(--muted)" };
  return (
    <span
      style={{
        fontSize: "0.6rem",
        fontWeight: 600,
        padding: "0.2rem 0.6rem",
        borderRadius: "var(--r-lg)",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        background: c.bg,
        color: c.color,
        fontFamily: "'Outfit', sans-serif",
      }}
    >
      {type}
    </span>
  );
}
