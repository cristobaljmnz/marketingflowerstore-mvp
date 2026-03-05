"use client";

import { useState, useEffect, useRef } from "react";
import gsap from "gsap";

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
  const [campaigns, setCampaigns]       = useState<GeneratedCampaign[]>([]);
  const [filterStyle, setFilterStyle]   = useState<FilterStyle>("all");
  const [filterIntent, setFilterIntent] = useState<FilterIntent>("all");
  const [isLoading, setIsLoading]       = useState(true);
  const [selected, setSelected]         = useState<GeneratedCampaign | null>(null);

  const pageRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Entrance animation
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from("[data-enter]", {
        y: 20,
        opacity: 0,
        duration: 0.7,
        ease: "power3.out",
        stagger: 0.08,
      });
    }, pageRef);
    return () => ctx.revert();
  }, []);

  // Grid animation
  useEffect(() => {
    if (isLoading || campaigns.length === 0) return;
    const ctx = gsap.context(() => {
      gsap.from("[data-campaign-card]", {
        y: 24,
        opacity: 0,
        duration: 0.55,
        ease: "power3.out",
        stagger: 0.1,
      });
    }, gridRef);
    return () => ctx.revert();
  }, [campaigns, isLoading]);

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

  return (
    <div ref={pageRef} style={{ minHeight: "100dvh", background: "var(--bg)", paddingTop: "var(--nav-offset)" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "2.5rem 2rem 4rem" }}>

        {/* ── Page heading ── */}
        <div data-enter style={{ marginBottom: "2.5rem" }}>
          <h1
            className="display"
            style={{ fontSize: "2.5rem", fontWeight: 400, fontStyle: "italic", color: "var(--cream)", margin: 0, lineHeight: 1.1 }}
          >
            Campaign Gallery
          </h1>
          <p style={{ fontSize: "0.78rem", color: "var(--faint)", marginTop: "0.4rem", fontFamily: "'Outfit', sans-serif" }}>
            All generated campaigns — browse, download, and reuse
          </p>
        </div>

        {/* ── Filter bar ── */}
        <div data-enter style={{ display: "flex", gap: "2rem", marginBottom: "2.5rem", alignItems: "center", flexWrap: "wrap" }}>
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
            <span style={{ fontSize: "0.72rem", color: "var(--ghost)", marginLeft: "auto", fontFamily: "'Outfit', sans-serif" }}>
              {campaigns.length} campaign{campaigns.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* ── Grid ── */}
        {isLoading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1.25rem" }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ aspectRatio: "4/5", borderRadius: "var(--r-md)" }} />
            ))}
          </div>
        ) : campaigns.length === 0 ? (
          <div style={{ textAlign: "center", padding: "6rem 2rem" }}>
            <p className="display" style={{ fontSize: "2rem", fontWeight: 300, fontStyle: "italic", color: "var(--ghost)", marginBottom: "1rem" }}>
              No campaigns yet
            </p>
            <a
              href="/generate"
              style={{
                fontSize: "0.82rem",
                color: "var(--brand)",
                textDecoration: "none",
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontWeight: 500,
              }}
            >
              Generate your first campaign →
            </a>
          </div>
        ) : (
          <div
            ref={gridRef}
            style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1.25rem" }}
          >
            {campaigns.map((c) => (
              <CampaignCard key={c.id} campaign={c} onClick={() => { setSelected(c); window.dispatchEvent(new Event("lightbox-open")); }} />
            ))}
          </div>
        )}
      </div>

      {/* ── Modal ── */}
      {selected && (
        <CampaignModal
          campaign={selected}
          onClose={() => { setSelected(null); window.dispatchEvent(new Event("lightbox-close")); }}
          onDeleted={() => { setSelected(null); window.dispatchEvent(new Event("lightbox-close")); loadCampaigns(); }}
        />
      )}
    </div>
  );
}

// ── Carousel ──────────────────────────────────────────────────────────────────

function ImageCarousel({
  urls,
  aspectRatio = "1",
  compact = false,
  onImageClick,
}: {
  urls: string[];
  aspectRatio?: string;
  compact?: boolean;
  onImageClick?: (url: string) => void;
}) {
  const [idx, setIdx] = useState(0);
  const len = urls.length;
  if (len === 0) return null;

  const prev = () => setIdx((i) => (i - 1 + len) % len);
  const next = () => setIdx((i) => (i + 1) % len);

  async function download() {
    const url = urls[idx];
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `campaign-image-${idx + 1}.jpg`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      window.open(url, "_blank");
    }
  }

  return (
    <div style={{ position: "relative" }}>
      {/* Main image */}
      <div style={{ position: "relative", overflow: "hidden", borderRadius: compact ? "0" : "var(--r-md) var(--r-md) 0 0" }}>
        <img
          key={idx}
          src={urls[idx]}
          alt={`Image ${idx + 1}`}
          onClick={onImageClick ? (e) => { e.stopPropagation(); onImageClick(urls[idx]); } : undefined}
          style={{
            width: "100%",
            aspectRatio,
            objectFit: "cover",
            display: "block",
            animation: "fadeUp 0.25s ease both",
            cursor: onImageClick ? "zoom-in" : undefined,
          }}
        />

        {/* Prev / Next buttons */}
        {len > 1 && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); prev(); }}
              style={{
                position: "absolute",
                left: "0.625rem",
                top: "50%",
                transform: "translateY(-50%)",
                width: "2rem",
                height: "2rem",
                borderRadius: "50%",
                background: "rgba(255,248,245,0.85)",
                backdropFilter: "blur(8px)",
                border: "1px solid var(--rim2)",
                color: "var(--cream)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.75rem",
                fontWeight: 700,
                transition: "transform 0.18s cubic-bezier(0.25, 0.46, 0.45, 0.94), background 0.18s",
                zIndex: 2,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-50%) scale(1.1)"; e.currentTarget.style.background = "rgba(255,248,245,0.95)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(-50%) scale(1)"; e.currentTarget.style.background = "rgba(255,248,245,0.85)"; }}
            >
              ‹
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); next(); }}
              style={{
                position: "absolute",
                right: "0.625rem",
                top: "50%",
                transform: "translateY(-50%)",
                width: "2rem",
                height: "2rem",
                borderRadius: "50%",
                background: "rgba(255,248,245,0.85)",
                backdropFilter: "blur(8px)",
                border: "1px solid var(--rim2)",
                color: "var(--cream)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.75rem",
                fontWeight: 700,
                transition: "transform 0.18s cubic-bezier(0.25, 0.46, 0.45, 0.94), background 0.18s",
                zIndex: 2,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-50%) scale(1.1)"; e.currentTarget.style.background = "rgba(255,248,245,0.95)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(-50%) scale(1)"; e.currentTarget.style.background = "rgba(255,248,245,0.85)"; }}
            >
              ›
            </button>
          </>
        )}

        {/* Download button */}
        <button
          onClick={(e) => { e.stopPropagation(); download(); }}
          style={{
            position: "absolute",
            top: "0.625rem",
            right: "0.625rem",
            padding: "0.35rem 0.75rem",
            borderRadius: "var(--r-lg)",
            background: "rgba(255,248,245,0.85)",
            backdropFilter: "blur(8px)",
            border: "1px solid var(--rim2)",
            color: "var(--cream)",
            cursor: "pointer",
            fontSize: "0.65rem",
            fontWeight: 600,
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            display: "flex",
            alignItems: "center",
            gap: "0.3rem",
            transition: "transform 0.18s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
            zIndex: 2,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.05)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
        >
          ↓ Download
        </button>
      </div>

      {/* Dots */}
      {len > 1 && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "0.375rem",
            padding: "0.625rem 0 0.25rem",
            background: "var(--card)",
          }}
        >
          {Array.from({ length: len }).map((_, i) => (
            <button
              key={i}
              onClick={(e) => { e.stopPropagation(); setIdx(i); }}
              style={{
                width: i === idx ? "1.25rem" : "0.375rem",
                height: "0.375rem",
                borderRadius: "var(--r-lg)",
                background: i === idx ? "var(--brand)" : "var(--rim2)",
                border: "none",
                cursor: "pointer",
                padding: 0,
                transition: "width 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94), background 0.25s",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Campaign card ─────────────────────────────────────────────────────────────

function CampaignCard({ campaign, onClick }: { campaign: GeneratedCampaign; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  const caption = campaign.captionOptions[0] ?? "";

  return (
    <div
      data-campaign-card
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "var(--card)",
        borderRadius: "var(--r-md)",
        overflow: "hidden",
        border: "1px solid var(--rim)",
        cursor: "pointer",
        transform: hovered ? "translateY(-5px) scale(1.01)" : "none",
        boxShadow: hovered
          ? "0 16px 48px rgba(226,83,73,0.12)"
          : "0 2px 12px rgba(226,83,73,0.04)",
        transition: "transform 0.22s cubic-bezier(0.25, 0.46, 0.45, 0.94), box-shadow 0.22s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
      }}
    >
      {/* Carousel */}
      <ImageCarousel urls={campaign.generatedImageUrls} aspectRatio="1" />

      {/* Info */}
      <div style={{ padding: "1.125rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem", marginBottom: "0.75rem" }}>
          <h3
            className="display"
            style={{
              fontSize: "1.1rem",
              fontWeight: 400,
              fontStyle: "italic",
              lineHeight: 1.3,
              margin: 0,
              color: "var(--cream)",
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            }}
          >
            {campaign.campaignPlan.campaignTitle}
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", flexShrink: 0 }}>
            <Badge type={campaign.style} />
            <Badge type={campaign.intent} />
          </div>
        </div>

        {caption && (
          <p
            style={{
              fontSize: "0.78rem",
              color: "var(--faint)",
              lineHeight: 1.55,
              margin: "0 0 0.75rem",
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              fontFamily: "'Plus Jakarta Sans', sans-serif",
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
                color: "var(--brand)",
                background: "rgba(226,83,73,0.07)",
                padding: "0.15rem 0.5rem",
                borderRadius: "var(--r-lg)",
                fontFamily: "'Outfit', sans-serif",
              }}
            >
              {tag.startsWith("#") ? tag : `#${tag}`}
            </span>
          ))}
          {campaign.hashtags.length > 4 && (
            <span style={{ fontSize: "0.65rem", color: "var(--ghost)", fontFamily: "'Outfit', sans-serif" }}>
              +{campaign.hashtags.length - 4}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Campaign modal ────────────────────────────────────────────────────────────

function CampaignModal({ campaign, onClose, onDeleted }: { campaign: GeneratedCampaign; onClose: () => void; onDeleted: () => void }) {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const openLightbox = (url: string) => { setLightboxUrl(url); window.dispatchEvent(new Event("lightbox-open")); };
  const closeLightbox = () => { setLightboxUrl(null); window.dispatchEvent(new Event("lightbox-close")); };

  async function deleteCampaign() {
    setIsDeleting(true);
    await fetch(`/api/gallery/${campaign.id}`, { method: "DELETE" });
    setIsDeleting(false);
    onDeleted();
  }
  return (
    <>
      {lightboxUrl && <ImageLightbox url={lightboxUrl} onClose={closeLightbox} />}
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(255,248,245,0.85)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        zIndex: 200,
        padding: "2rem",
        overflowY: "auto",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--card)",
          border: "1px solid var(--rim2)",
          borderRadius: "var(--r-md)",
          overflow: "hidden",
          maxWidth: "720px",
          width: "100%",
          marginTop: "2rem",
          marginBottom: "2rem",
          boxShadow: "0 32px 100px rgba(226,83,73,0.10)",
          animation: "fadeUp 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94) both",
        }}
      >
        {/* Carousel in modal */}
        <ImageCarousel urls={campaign.generatedImageUrls} aspectRatio="1" onImageClick={openLightbox} />

        <div style={{ padding: "2rem" }}>
          {/* Title + badges */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", marginBottom: "1.5rem" }}>
            <h2
              className="display"
              style={{ fontSize: "2rem", fontWeight: 400, fontStyle: "italic", lineHeight: 1.2, margin: 0, color: "var(--cream)" }}
            >
              {campaign.campaignPlan.campaignTitle}
            </h2>
            <div style={{ display: "flex", gap: "0.375rem", flexShrink: 0, marginTop: "0.4rem" }}>
              <Badge type={campaign.style} />
              <Badge type={campaign.intent} />
            </div>
          </div>

          {/* Captions */}
          <ModalSection label="Captions">
            <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
              {campaign.captionOptions.map((c, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    gap: "0.875rem",
                    padding: "0.875rem 1rem",
                    background: "var(--surface)",
                    borderRadius: "var(--r-sm)",
                  }}
                >
                  <span style={{ fontSize: "0.65rem", color: "var(--ghost)", paddingTop: "0.25rem", flexShrink: 0, fontFamily: "'IBM Plex Mono', monospace" }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <p style={{ fontSize: "0.875rem", color: "var(--muted)", lineHeight: 1.65, margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                    {c}
                  </p>
                </div>
              ))}
            </div>
          </ModalSection>

          {/* Hashtags */}
          <ModalSection label="Hashtags">
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
              {campaign.hashtags.map((tag) => (
                <span
                  key={tag}
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--brand)",
                    background: "rgba(226,83,73,0.07)",
                    padding: "0.25rem 0.625rem",
                    borderRadius: "var(--r-lg)",
                    fontFamily: "'Outfit', sans-serif",
                  }}
                >
                  {tag.startsWith("#") ? tag : `#${tag}`}
                </span>
              ))}
            </div>
          </ModalSection>

          {/* Meta row */}
          <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: "1.5rem", marginBottom: "1.5rem" }}>
            <div>
              <ModalLabel>Product</ModalLabel>
              <img
                src={campaign.productImageUrl}
                alt="Product"
                style={{ width: "80px", height: "80px", objectFit: "cover", borderRadius: "var(--r-sm)", border: "1px solid var(--rim)" }}
              />
            </div>
            {campaign.referenceIds.length > 0 && (
              <div>
                <ModalLabel>References</ModalLabel>
                <p className="mono" style={{ fontSize: "0.7rem", color: "var(--ghost)", lineHeight: 1.8 }}>
                  {campaign.referenceIds.join(", ")}
                </p>
              </div>
            )}
          </div>

          {/* Date */}
          <p style={{ fontSize: "0.65rem", color: "var(--ghost)", marginBottom: "1.5rem", fontFamily: "'Outfit', sans-serif" }}>
            Generated {new Date(campaign.createdAt).toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" })}
          </p>

          {/* Close + Delete */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <button
              onClick={onClose}
              className="btn"
              style={{
                padding: "0.65rem 1.5rem",
                background: "transparent",
                color: "var(--faint)",
                border: "1px solid var(--rim2)",
                borderRadius: "var(--r-md)",
                fontSize: "0.82rem",
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                cursor: "pointer",
              }}
            >
              Close
            </button>

            {confirmDelete ? (
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <span style={{ fontSize: "0.72rem", color: "var(--faint)", fontFamily: "'Outfit', sans-serif" }}>
                  Delete this campaign?
                </span>
                <button
                  onClick={deleteCampaign}
                  disabled={isDeleting}
                  style={{
                    padding: "0.45rem 0.875rem",
                    background: "#C04040",
                    color: "#fff",
                    border: "none",
                    borderRadius: "var(--r-md)",
                    fontSize: "0.75rem",
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {isDeleting ? "Deleting…" : "Confirm"}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  style={{
                    padding: "0.45rem 0.875rem",
                    background: "transparent",
                    color: "var(--faint)",
                    border: "1px solid var(--rim2)",
                    borderRadius: "var(--r-md)",
                    fontSize: "0.75rem",
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                    cursor: "pointer",
                  }}
                >
                  No
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                style={{
                  padding: "0.45rem 0.875rem",
                  background: "transparent",
                  color: "#C04040",
                  border: "1px solid rgba(192,64,64,0.3)",
                  borderRadius: "var(--r-md)",
                  fontSize: "0.75rem",
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  cursor: "pointer",
                }}
              >
                Delete
              </button>
            )}
          </div>
        </div>
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

// ── Shared sub-components ─────────────────────────────────────────────────────

function FilterGroup<T extends string>({
  label, options, value, onChange,
}: {
  label: string;
  options: T[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
      <span style={{ fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--faint)", fontFamily: "'Outfit', sans-serif" }}>
        {label}
      </span>
      <div style={{ display: "flex", gap: "0.25rem" }}>
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className="btn"
            style={{
              padding: "0.35rem 0.875rem",
              background: value === opt ? "var(--brand)" : "var(--card)",
              border: `1px solid ${value === opt ? "var(--brand)" : "var(--rim2)"}`,
              borderRadius: "var(--r-lg)",
              color: value === opt ? "#fff" : "var(--faint)",
              fontSize: "0.75rem",
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontWeight: value === opt ? 600 : 400,
              boxShadow: value === opt ? "0 2px 10px rgba(226,83,73,0.2)" : "none",
            }}
          >
            <span className="btn-slide" style={{ background: "var(--brand-l)" }} />
            <span style={{ position: "relative", zIndex: 1 }}>
              {opt.charAt(0).toUpperCase() + opt.slice(1)}
            </span>
          </button>
        ))}
      </div>
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
        display: "inline-block",
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
    <div style={{ fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--faint)", marginBottom: "0.6rem", fontFamily: "'Outfit', sans-serif" }}>
      {children}
    </div>
  );
}
