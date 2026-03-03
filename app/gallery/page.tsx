"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────

type Style = "studio" | "street";
type Intent = "promo" | "emotional";
type FilterStyle = "all" | Style;
type FilterIntent = "all" | Intent;

interface CampaignPlan {
  campaignTitle: string;
  creativeIntent: Intent;
  captionOptions: string[];
  hashtags: string[];
  deliverables: string[];
  metadata: { referenceIds: string[] };
}

interface GeneratedCampaign {
  id: string;
  productImageUrl: string;
  generatedImageUrls: string[];
  campaignPlan: CampaignPlan;
  style: Style;
  intent: Intent;
  captionOptions: string[];
  hashtags: string[];
  referenceIds: string[];
  createdAt: string;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function GalleryPage() {
  const [campaigns, setCampaigns] = useState<GeneratedCampaign[]>([]);
  const [filterStyle, setFilterStyle] = useState<FilterStyle>("all");
  const [filterIntent, setFilterIntent] = useState<FilterIntent>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [selected, setSelected] = useState<GeneratedCampaign | null>(null);

  useEffect(() => {
    loadCampaigns();
  }, [filterStyle, filterIntent]);

  async function loadCampaigns() {
    setIsLoading(true);
    const params = new URLSearchParams();
    if (filterStyle !== "all") params.set("style", filterStyle);
    if (filterIntent !== "all") params.set("intent", filterIntent);
    const res = await fetch(`/api/gallery?${params}`);
    const { campaigns: data } = (await res.json()) as { campaigns: GeneratedCampaign[] };
    setCampaigns(data ?? []);
    setIsLoading(false);
  }

  async function downloadImage(url: string, filename: string) {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      window.open(url, "_blank");
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      {/* ── Header ── */}
      <header
        style={{
          padding: "1.25rem 2rem",
          borderBottom: "1px solid var(--rim)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "var(--surface)",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: "1.5rem" }}>
          <Link href="/generate" className="display" style={{ fontSize: "1rem", fontWeight: 300, letterSpacing: "0.04em", color: "var(--cream)", textDecoration: "none" }}>
            flowerstore.ph
          </Link>
          <span style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.18em", color: "var(--copper)", fontWeight: 500 }}>
            Gallery
          </span>
        </div>
        <nav style={{ display: "flex", gap: "1.5rem" }}>
          <Link href="/generate" style={{ fontSize: "0.72rem", color: "var(--faint)", textDecoration: "none" }}>Generate</Link>
          <Link href="/library" style={{ fontSize: "0.72rem", color: "var(--faint)", textDecoration: "none" }}>Library</Link>
        </nav>
      </header>

      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "2.5rem 2rem" }}>
        {/* ── Filter bar ── */}
        <div
          style={{
            display: "flex",
            gap: "2rem",
            marginBottom: "2.5rem",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <FilterGroup
            label="Style"
            options={["all", "studio", "street"] as FilterStyle[]}
            value={filterStyle}
            onChange={(v) => setFilterStyle(v as FilterStyle)}
          />
          <FilterGroup
            label="Intent"
            options={["all", "promo", "emotional"] as FilterIntent[]}
            value={filterIntent}
            onChange={(v) => setFilterIntent(v as FilterIntent)}
          />
          {!isLoading && (
            <span style={{ fontSize: "0.72rem", color: "var(--ghost)", marginLeft: "auto" }}>
              {campaigns.length} campaign{campaigns.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* ── Grid ── */}
        {isLoading ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: "1.25rem",
            }}
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ aspectRatio: "1", borderRadius: "6px" }} />
            ))}
          </div>
        ) : campaigns.length === 0 ? (
          <div style={{ textAlign: "center", padding: "6rem 2rem" }}>
            <p className="display" style={{ fontSize: "1.5rem", fontWeight: 300, fontStyle: "italic", opacity: 0.25, marginBottom: "1rem" }}>
              No campaigns yet
            </p>
            <Link href="/generate" style={{ fontSize: "0.8rem", color: "var(--copper)", textDecoration: "none" }}>
              Generate your first campaign →
            </Link>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: "1.25rem",
            }}
          >
            {campaigns.map((c) => (
              <CampaignCard key={c.id} campaign={c} onClick={() => setSelected(c)} />
            ))}
          </div>
        )}
      </div>

      {/* ── Expanded modal ── */}
      {selected && (
        <div
          onClick={() => setSelected(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(12,10,8,0.9)",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            zIndex: 100,
            padding: "2rem",
            overflowY: "auto",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--card)",
              border: "1px solid var(--rim2)",
              borderRadius: "8px",
              overflow: "hidden",
              maxWidth: "700px",
              width: "100%",
              marginTop: "2rem",
              marginBottom: "2rem",
            }}
          >
            {/* Images */}
            {selected.generatedImageUrls.length > 0 && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(${Math.min(selected.generatedImageUrls.length, 3)}, 1fr)`,
                  gap: "1px",
                  background: "var(--rim)",
                }}
              >
                {selected.generatedImageUrls.map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt={`Generated ad ${i + 1}`}
                    style={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block" }}
                  />
                ))}
              </div>
            )}

            <div style={{ padding: "1.75rem" }}>
              {/* Title + badges */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", marginBottom: "1.5rem" }}>
                <h2 className="display" style={{ fontSize: "1.75rem", fontWeight: 400, lineHeight: 1.2, margin: 0 }}>
                  {selected.campaignPlan.campaignTitle}
                </h2>
                <div style={{ display: "flex", gap: "0.4rem", flexShrink: 0, marginTop: "0.3rem" }}>
                  <Badge type={selected.style} />
                  <Badge type={selected.intent} />
                </div>
              </div>

              {/* All captions */}
              <ModalSection label="Captions">
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {selected.captionOptions.map((c, i) => (
                    <div key={i} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                      <span style={{ fontSize: "0.65rem", color: "var(--ghost)", paddingTop: "0.3rem", flexShrink: 0 }}>
                        {i + 1}.
                      </span>
                      <p style={{ fontSize: "0.875rem", color: "var(--muted)", lineHeight: 1.65, margin: 0 }}>
                        {c}
                      </p>
                    </div>
                  ))}
                </div>
              </ModalSection>

              {/* Hashtags */}
              <ModalSection label="Hashtags">
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
                  {selected.hashtags.map((tag) => (
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
              </ModalSection>

              {/* Product image + references */}
              <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: "1.5rem", marginBottom: "1.5rem" }}>
                <div>
                  <ModalLabel>Product</ModalLabel>
                  <img
                    src={selected.productImageUrl}
                    alt="Product"
                    style={{ width: "80px", height: "80px", objectFit: "cover", borderRadius: "4px", border: "1px solid var(--rim)" }}
                  />
                </div>
                {selected.referenceIds.length > 0 && (
                  <div>
                    <ModalLabel>References</ModalLabel>
                    <p style={{ fontSize: "0.72rem", color: "var(--ghost)", lineHeight: 1.8 }}>
                      {selected.referenceIds.join(", ")}
                    </p>
                  </div>
                )}
              </div>

              {/* Date */}
              <p style={{ fontSize: "0.65rem", color: "var(--ghost)", marginBottom: "1.5rem" }}>
                Generated {new Date(selected.createdAt).toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" })}
              </p>

              {/* Actions */}
              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                {selected.generatedImageUrls.map((url, i) => (
                  <button
                    key={i}
                    onClick={() => downloadImage(url, `campaign-${selected.id}-${i + 1}.jpg`)}
                    style={{
                      padding: "0.6rem 1.1rem",
                      background: "var(--copper)",
                      color: "var(--bg)",
                      border: "none",
                      borderRadius: "4px",
                      fontSize: "0.78rem",
                      fontWeight: 500,
                      cursor: "pointer",
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    Download {selected.generatedImageUrls.length > 1 ? `Image ${i + 1}` : "Image"}
                  </button>
                ))}
                <button
                  onClick={() => setSelected(null)}
                  style={{
                    padding: "0.6rem 1.1rem",
                    background: "transparent",
                    color: "var(--faint)",
                    border: "1px solid var(--rim)",
                    borderRadius: "4px",
                    fontSize: "0.78rem",
                    cursor: "pointer",
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function FilterGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: T[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
      <span style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--faint)" }}>
        {label}
      </span>
      <div style={{ display: "flex", gap: "0.25rem" }}>
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            style={{
              padding: "0.3rem 0.75rem",
              background: value === opt ? "var(--card2)" : "transparent",
              border: `1px solid ${value === opt ? "var(--rim2)" : "transparent"}`,
              borderRadius: "4px",
              color: value === opt ? "var(--cream)" : "var(--faint)",
              fontSize: "0.75rem",
              cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif",
              transition: "all 0.15s",
            }}
          >
            {opt.charAt(0).toUpperCase() + opt.slice(1)}
          </button>
        ))}
      </div>
    </div>
  );
}

function CampaignCard({
  campaign,
  onClick,
}: {
  campaign: GeneratedCampaign;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const firstImage = campaign.generatedImageUrls[0];
  const caption = campaign.captionOptions[0] ?? "";

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "var(--card)",
        borderRadius: "6px",
        overflow: "hidden",
        border: "1px solid var(--rim)",
        cursor: "pointer",
        transform: hovered ? "translateY(-3px)" : "none",
        boxShadow: hovered ? "0 8px 24px rgba(0,0,0,0.5)" : "none",
        transition: "transform 0.18s, box-shadow 0.18s",
      }}
    >
      {firstImage && (
        <img
          src={firstImage}
          alt={campaign.campaignPlan.campaignTitle}
          style={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block" }}
        />
      )}
      <div style={{ padding: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem", marginBottom: "0.75rem" }}>
          <h3
            className="display"
            style={{
              fontSize: "1.1rem",
              fontWeight: 400,
              lineHeight: 1.3,
              margin: 0,
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            }}
          >
            {campaign.campaignPlan.campaignTitle}
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", flexShrink: 0 }}>
            <Badge type={campaign.style} />
            <Badge type={campaign.intent} />
          </div>
        </div>

        {caption && (
          <p
            style={{
              fontSize: "0.78rem",
              color: "var(--faint)",
              lineHeight: 1.5,
              margin: "0 0 0.75rem",
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            }}
          >
            {caption}
          </p>
        )}

        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
          {campaign.hashtags.slice(0, 4).map((tag) => (
            <span
              key={tag}
              style={{
                fontSize: "0.65rem",
                color: "var(--copper)",
                background: "var(--card2)",
                padding: "0.15rem 0.4rem",
                borderRadius: "3px",
              }}
            >
              {tag.startsWith("#") ? tag : `#${tag}`}
            </span>
          ))}
          {campaign.hashtags.length > 4 && (
            <span style={{ fontSize: "0.65rem", color: "var(--ghost)" }}>
              +{campaign.hashtags.length - 4}
            </span>
          )}
        </div>
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
        display: "inline-block",
        fontSize: "0.6rem",
        fontWeight: 500,
        padding: "0.15rem 0.45rem",
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

function ModalSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "1.5rem" }}>
      <ModalLabel>{label}</ModalLabel>
      {children}
    </div>
  );
}

function ModalLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--faint)", marginBottom: "0.6rem" }}>
      {children}
    </div>
  );
}
