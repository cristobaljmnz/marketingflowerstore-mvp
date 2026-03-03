"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useDropzone } from "react-dropzone";
import gsap from "gsap";

// ── Types ─────────────────────────────────────────────────────────────────────

type Tag = "studio" | "street";
type FilterTag = "all" | Tag;

interface PendingFile {
  id: string;
  file: File;
  preview: string;
  tag: Tag | null;
  title: string;
}

interface HistoricalAd {
  id: string;
  imageUrl: string;
  tag: Tag;
  title?: string;
  description?: string;
  uploadedAt: string;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LibraryPage() {
  const [pending, setPending]         = useState<PendingFile[]>([]);
  const [ads, setAds]                 = useState<HistoricalAd[]>([]);
  const [filterTag, setFilterTag]     = useState<FilterTag>("all");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isLoading, setIsLoading]     = useState(true);
  const [loadError, setLoadError]     = useState<string | null>(null);
  const [expandedAd, setExpandedAd]   = useState<HistoricalAd | null>(null);
  const [editTag, setEditTag]         = useState<Tag | null>(null);
  const [isSavingTag, setIsSavingTag] = useState(false);

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

  // Grid animation when ads load
  useEffect(() => {
    if (isLoading || ads.length === 0) return;
    const ctx = gsap.context(() => {
      gsap.from("[data-ad-card]", {
        y: 20,
        opacity: 0,
        duration: 0.5,
        ease: "power3.out",
        stagger: 0.05,
      });
    }, gridRef);
    return () => ctx.revert();
  }, [ads, isLoading]);

  async function loadAds(tag?: Tag) {
    setIsLoading(true);
    setLoadError(null);
    try {
      const url = tag ? `/api/library?tag=${tag}` : "/api/library";
      const res = await fetch(url);
      const json = (await res.json()) as { ads?: HistoricalAd[]; error?: unknown };
      if (!res.ok || json.error) {
        setLoadError(`Error loading ads: ${JSON.stringify(json.error)}`);
        setAds([]);
      } else {
        setAds(json.ads ?? []);
      }
    } catch (err) {
      setLoadError(String(err));
      setAds([]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadAds(filterTag === "all" ? undefined : filterTag);
  }, [filterTag]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const newPending: PendingFile[] = acceptedFiles.map((file) => ({
      id: crypto.randomUUID(),
      file,
      preview: URL.createObjectURL(file),
      tag: null,
      title: "",
    }));
    setPending((prev) => [...prev, ...newPending]);

    for (const p of newPending) {
      try {
        const res = await fetch("/api/agents/router", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userMessage: "", styleSelector: "auto" }),
        });
        const { style } = (await res.json()) as { style: Tag };
        setPending((prev) => prev.map((f) => (f.id === p.id ? { ...f, tag: style } : f)));
      } catch {
        // leave tag null — user must pick manually
      }
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/jpeg": [], "image/png": [], "image/webp": [] },
    multiple: true,
    disabled: isUploading,
  });

  async function handleUpload() {
    const ready = pending.filter((f) => f.tag !== null);
    if (ready.length === 0) return;
    setIsUploading(true);
    setUploadError(null);
    const errors: string[] = [];
    for (const p of ready) {
      const fd = new FormData();
      fd.append("file", p.file);
      fd.append("meta", JSON.stringify({ tag: p.tag, title: p.title || undefined }));
      try {
        const res = await fetch("/api/library/upload", { method: "POST", body: fd });
        const json = await res.json() as { ad?: unknown; error?: unknown };
        if (!res.ok || json.error) {
          errors.push(`${p.file.name}: ${JSON.stringify(json.error)}`);
        } else {
          URL.revokeObjectURL(p.preview);
        }
      } catch (err) {
        errors.push(`${p.file.name}: ${String(err)}`);
      }
    }
    if (errors.length > 0) setUploadError(errors.join(" | "));
    setPending((prev) => prev.filter((f) => f.tag === null || errors.some((e) => e.startsWith(f.file.name))));
    setIsUploading(false);
    loadAds(filterTag === "all" ? undefined : filterTag);
  }

  function openAd(ad: HistoricalAd) {
    setExpandedAd(ad);
    setEditTag(ad.tag);
  }

  async function saveTag() {
    if (!expandedAd || !editTag || editTag === expandedAd.tag) { setExpandedAd(null); return; }
    setIsSavingTag(true);
    await fetch(`/api/library/${expandedAd.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tag: editTag }),
    });
    setIsSavingTag(false);
    setExpandedAd(null);
    loadAds(filterTag === "all" ? undefined : filterTag);
  }

  const readyCount = pending.filter((f) => f.tag !== null).length;

  return (
    <div ref={pageRef} style={{ minHeight: "100dvh", background: "var(--bg)", paddingTop: "var(--nav-offset)" }}>
      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "2.5rem 2rem 4rem" }}>

        {/* ── Page heading ── */}
        <div data-enter style={{ marginBottom: "2.5rem" }}>
          <h1
            className="display"
            style={{ fontSize: "2.5rem", fontWeight: 400, fontStyle: "italic", color: "var(--cream)", margin: 0, lineHeight: 1.1 }}
          >
            Ad Library
          </h1>
          <p style={{ fontSize: "0.78rem", color: "var(--faint)", marginTop: "0.4rem", fontFamily: "'Outfit', sans-serif" }}>
            Historical ads used as brand memory for AI generation
          </p>
        </div>

        {/* ── Upload area ── */}
        <section data-enter style={{ marginBottom: "3rem" }}>
          <SectionLabel>Upload Historical Ads</SectionLabel>

          <div
            {...getRootProps()}
            style={{
              border: `2px dashed ${isDragActive ? "var(--brand)" : "var(--rim2)"}`,
              borderRadius: "var(--r-md)",
              padding: "2.5rem",
              textAlign: "center",
              cursor: isUploading ? "default" : "pointer",
              background: isDragActive ? "rgba(226,83,73,0.04)" : "var(--card)",
              transition: "all 0.2s",
              marginBottom: "1.5rem",
              boxShadow: isDragActive ? "0 0 0 4px rgba(226,83,73,0.1)" : "none",
            }}
          >
            <input {...getInputProps()} />
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
            <p style={{ fontSize: "0.85rem", color: "var(--muted)", margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              {isDragActive ? "Drop here" : "Drop images or click to browse — multiple allowed"}
            </p>
            <p style={{ fontSize: "0.72rem", color: "var(--ghost)", marginTop: "0.375rem", fontFamily: "'Outfit', sans-serif" }}>
              JPG · PNG · WEBP
            </p>
          </div>

          {/* Pending uploads */}
          {pending.length > 0 && (
            <div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                  gap: "1rem",
                  marginBottom: "1.25rem",
                }}
              >
                {pending.map((p) => (
                  <PendingCard
                    key={p.id}
                    item={p}
                    onTagChange={(tag) => setPending((prev) => prev.map((f) => (f.id === p.id ? { ...f, tag } : f)))}
                    onTitleChange={(title) => setPending((prev) => prev.map((f) => (f.id === p.id ? { ...f, title } : f)))}
                    onRemove={() => { URL.revokeObjectURL(p.preview); setPending((prev) => prev.filter((f) => f.id !== p.id)); }}
                  />
                ))}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
                <button
                  onClick={handleUpload}
                  disabled={readyCount === 0 || isUploading}
                  className="btn"
                  style={{
                    padding: "0.7rem 1.5rem",
                    background: readyCount > 0 && !isUploading ? "var(--brand)" : "var(--card2)",
                    color: readyCount > 0 && !isUploading ? "#fff" : "var(--ghost)",
                    border: "none",
                    borderRadius: "var(--r-md)",
                    fontSize: "0.82rem",
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                    boxShadow: readyCount > 0 && !isUploading ? "0 2px 12px rgba(226,83,73,0.22)" : "none",
                  }}
                >
                  <span className="btn-slide" style={{ background: "var(--brand-l)" }} />
                  <span style={{ position: "relative", zIndex: 1 }}>
                    {isUploading ? "Uploading…" : `Upload ${readyCount} image${readyCount !== 1 ? "s" : ""}`}
                  </span>
                </button>
                {readyCount < pending.length && (
                  <span style={{ fontSize: "0.72rem", color: "var(--faint)", fontFamily: "'Outfit', sans-serif" }}>
                    {pending.length - readyCount} still need a tag
                  </span>
                )}
              </div>

              {uploadError && (
                <div
                  style={{
                    marginTop: "0.75rem",
                    padding: "0.875rem 1rem",
                    background: "#FFF5F5",
                    border: "1px solid rgba(192,68,68,0.2)",
                    borderRadius: "var(--r-sm)",
                  }}
                >
                  <p className="mono" style={{ fontSize: "0.75rem", color: "var(--err)", margin: 0 }}>
                    {uploadError}
                  </p>
                </div>
              )}
            </div>
          )}
        </section>

        {/* ── Grid section ── */}
        <section>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
            <SectionLabel>
              Historical Ads{" "}
              {!isLoading && (
                <span style={{ color: "var(--ghost)", fontWeight: 400 }}>({ads.length})</span>
              )}
            </SectionLabel>

            <FilterPills value={filterTag} onChange={setFilterTag} />
          </div>

          {isLoading ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "1rem" }}>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="skeleton" style={{ aspectRatio: "1" }} />
              ))}
            </div>
          ) : loadError ? (
            <div style={{ padding: "1.5rem", background: "#FFF5F5", border: "1px solid rgba(192,68,68,0.2)", borderRadius: "var(--r-md)" }}>
              <p className="mono" style={{ fontSize: "0.75rem", color: "var(--err)", margin: 0 }}>{loadError}</p>
            </div>
          ) : ads.length === 0 ? (
            <div style={{ textAlign: "center", padding: "5rem 2rem" }}>
              <p className="display" style={{ fontSize: "1.5rem", fontWeight: 300, fontStyle: "italic", color: "var(--ghost)", margin: 0 }}>
                No ads yet
              </p>
              <p style={{ fontSize: "0.78rem", color: "var(--ghost)", marginTop: "0.5rem", fontFamily: "'Outfit', sans-serif" }}>
                Upload some images above to get started.
              </p>
            </div>
          ) : (
            <div
              ref={gridRef}
              style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "1rem" }}
            >
              {ads.map((ad) => (
                <AdCard key={ad.id} ad={ad} onClick={() => openAd(ad)} />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* ── Expanded modal ── */}
      {expandedAd && (
        <div
          onClick={() => setExpandedAd(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(255,248,245,0.85)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 200,
            padding: "2rem",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--card)",
              border: "1px solid var(--rim2)",
              borderRadius: "var(--r-md)",
              overflow: "hidden",
              maxWidth: "520px",
              width: "100%",
              maxHeight: "90dvh",
              overflowY: "auto",
              boxShadow: "0 24px 80px rgba(226,83,73,0.1)",
            }}
          >
            <img
              src={expandedAd.imageUrl}
              alt={expandedAd.title ?? "Historical ad"}
              style={{ width: "100%", display: "block", aspectRatio: "1", objectFit: "cover" }}
            />
            <div style={{ padding: "1.75rem" }}>
              <p className="display" style={{ fontSize: "1.4rem", fontWeight: 400, fontStyle: "italic", marginBottom: "1.25rem", color: "var(--cream)" }}>
                {expandedAd.title ?? "(untitled)"}
              </p>

              <p style={{ fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--faint)", marginBottom: "0.6rem", fontFamily: "'Outfit', sans-serif" }}>
                Tag
              </p>
              <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.75rem" }}>
                {(["studio", "street"] as Tag[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setEditTag(t)}
                    className="btn"
                    style={{
                      padding: "0.5rem 1.25rem",
                      borderRadius: "var(--r-md)",
                      border: `1px solid ${editTag === t ? "var(--brand)" : "var(--rim2)"}`,
                      background: editTag === t ? "rgba(226,83,73,0.08)" : "transparent",
                      color: editTag === t ? "var(--brand)" : "var(--faint)",
                      fontSize: "0.78rem",
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                      fontWeight: editTag === t ? 600 : 400,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>

              <div style={{ display: "flex", gap: "0.75rem" }}>
                <button
                  onClick={saveTag}
                  disabled={isSavingTag}
                  className="btn"
                  style={{
                    padding: "0.65rem 1.375rem",
                    background: "var(--brand)",
                    color: "#fff",
                    border: "none",
                    borderRadius: "var(--r-md)",
                    fontSize: "0.82rem",
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                    fontWeight: 600,
                    boxShadow: "0 2px 12px rgba(226,83,73,0.25)",
                  }}
                >
                  <span className="btn-slide" style={{ background: "var(--brand-l)" }} />
                  <span style={{ position: "relative", zIndex: 1 }}>{isSavingTag ? "Saving…" : "Save"}</span>
                </button>
                <button
                  onClick={() => setExpandedAd(null)}
                  className="btn"
                  style={{
                    padding: "0.65rem 1.375rem",
                    background: "transparent",
                    color: "var(--faint)",
                    border: "1px solid var(--rim2)",
                    borderRadius: "var(--r-md)",
                    fontSize: "0.82rem",
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                  }}
                >
                  Cancel
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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: "0.62rem",
        textTransform: "uppercase",
        letterSpacing: "0.16em",
        color: "var(--faint)",
        marginBottom: "1rem",
        fontWeight: 600,
        fontFamily: "'Outfit', sans-serif",
      }}
    >
      {children}
    </div>
  );
}

function FilterPills({ value, onChange }: { value: FilterTag; onChange: (v: FilterTag) => void }) {
  return (
    <div style={{ display: "flex", gap: "0.25rem" }}>
      {(["all", "studio", "street"] as FilterTag[]).map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className="btn"
          style={{
            padding: "0.35rem 0.875rem",
            background: value === t ? "var(--brand)" : "var(--card)",
            border: `1px solid ${value === t ? "var(--brand)" : "var(--rim2)"}`,
            borderRadius: "var(--r-lg)",
            color: value === t ? "#fff" : "var(--faint)",
            fontSize: "0.75rem",
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontWeight: value === t ? 600 : 400,
          }}
        >
          <span className="btn-slide" style={{ background: "var(--brand-l)" }} />
          <span style={{ position: "relative", zIndex: 1 }}>{t.charAt(0).toUpperCase() + t.slice(1)}</span>
        </button>
      ))}
    </div>
  );
}

function PendingCard({
  item, onTagChange, onTitleChange, onRemove,
}: {
  item: PendingFile;
  onTagChange: (tag: Tag) => void;
  onTitleChange: (title: string) => void;
  onRemove: () => void;
}) {
  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--rim)",
        borderRadius: "var(--r-md)",
        overflow: "hidden",
        boxShadow: "0 2px 12px rgba(226,83,73,0.04)",
      }}
    >
      <div style={{ position: "relative" }}>
        <img
          src={item.preview}
          alt="Pending upload"
          style={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block" }}
        />
        {item.tag === null && (
          <div
            style={{
              position: "absolute",
              top: "0.5rem",
              right: "0.5rem",
              background: "var(--brand)",
              borderRadius: "var(--r-lg)",
              padding: "0.2rem 0.5rem",
              fontSize: "0.6rem",
              color: "#fff",
              fontFamily: "'Outfit', sans-serif",
              fontWeight: 600,
            }}
          >
            Tag required
          </div>
        )}
      </div>
      <div style={{ padding: "0.875rem" }}>
        <input
          placeholder="Title (optional)"
          value={item.title}
          onChange={(e) => onTitleChange(e.target.value)}
          style={{
            width: "100%",
            background: "transparent",
            border: "none",
            borderBottom: "1px solid var(--rim2)",
            color: "var(--cream)",
            fontSize: "0.75rem",
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            outline: "none",
            padding: "0.25rem 0",
            marginBottom: "0.75rem",
          }}
        />
        <div style={{ display: "flex", gap: "0.375rem", marginBottom: "0.75rem" }}>
          {(["studio", "street"] as const).map((t) => (
            <button
              key={t}
              onClick={() => onTagChange(t)}
              className="btn"
              style={{
                flex: 1,
                padding: "0.3rem",
                borderRadius: "var(--r-sm)",
                border: `1px solid ${item.tag === t ? "var(--brand)" : "var(--rim2)"}`,
                background: item.tag === t ? "rgba(226,83,73,0.08)" : "transparent",
                color: item.tag === t ? "var(--brand)" : "var(--ghost)",
                fontSize: "0.65rem",
                fontFamily: "'Outfit', sans-serif",
                fontWeight: item.tag === t ? 600 : 400,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              {t}
            </button>
          ))}
        </div>
        <button
          onClick={onRemove}
          style={{ fontSize: "0.65rem", color: "var(--ghost)", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          Remove
        </button>
      </div>
    </div>
  );
}

function AdCard({ ad, onClick }: { ad: HistoricalAd; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      data-ad-card
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "var(--card)",
        borderRadius: "var(--r-md)",
        overflow: "hidden",
        border: "1px solid var(--rim)",
        cursor: "pointer",
        transform: hovered ? "translateY(-4px) scale(1.01)" : "none",
        boxShadow: hovered ? "0 12px 36px rgba(226,83,73,0.10)" : "0 2px 10px rgba(226,83,73,0.04)",
        transition: "transform 0.22s cubic-bezier(0.25, 0.46, 0.45, 0.94), box-shadow 0.22s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
      }}
    >
      <img
        src={ad.imageUrl}
        alt={ad.title ?? "Historical ad"}
        style={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block" }}
      />
      <div style={{ padding: "0.875rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontSize: "0.75rem", color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            {ad.title ?? "(untitled)"}
          </span>
          <span
            style={{
              fontSize: "0.6rem",
              fontWeight: 600,
              padding: "0.15rem 0.5rem",
              borderRadius: "var(--r-lg)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              flexShrink: 0,
              fontFamily: "'Outfit', sans-serif",
              background: ad.tag === "studio" ? "rgba(226,83,73,0.08)" : "rgba(107,158,120,0.12)",
              color: ad.tag === "studio" ? "#C04040" : "#3D6B4A",
            }}
          >
            {ad.tag}
          </span>
        </div>
        <p style={{ fontSize: "0.65rem", color: "var(--ghost)", marginTop: "0.25rem", fontFamily: "'Outfit', sans-serif" }}>
          {new Date(ad.uploadedAt).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
        </p>
      </div>
    </div>
  );
}
