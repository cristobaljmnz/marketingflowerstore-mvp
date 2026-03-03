"use client";

import { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import Link from "next/link";

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
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [ads, setAds] = useState<HistoricalAd[]>([]);
  const [filterTag, setFilterTag] = useState<FilterTag>("all");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expandedAd, setExpandedAd] = useState<HistoricalAd | null>(null);
  const [editTag, setEditTag] = useState<Tag | null>(null);
  const [isSavingTag, setIsSavingTag] = useState(false);

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

    // Ask Router Agent for a tag suggestion per file
    for (const p of newPending) {
      try {
        const res = await fetch("/api/agents/router", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userMessage: "", styleSelector: "auto" }),
        });
        const { style } = (await res.json()) as { style: Tag };
        setPending((prev) =>
          prev.map((f) => (f.id === p.id ? { ...f, tag: style } : f))
        );
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
      fd.append(
        "meta",
        JSON.stringify({ tag: p.tag, title: p.title || undefined })
      );
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

    if (errors.length > 0) {
      setUploadError(errors.join(" | "));
    }

    setPending((prev) => prev.filter((f) => f.tag === null || errors.some((e) => e.startsWith(f.file.name))));
    setIsUploading(false);
    loadAds(filterTag === "all" ? undefined : filterTag);
  }

  function openAd(ad: HistoricalAd) {
    setExpandedAd(ad);
    setEditTag(ad.tag);
  }

  async function saveTag() {
    if (!expandedAd || !editTag || editTag === expandedAd.tag) {
      setExpandedAd(null);
      return;
    }
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
  const filteredAds = ads;

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
            Library
          </span>
        </div>
        <nav style={{ display: "flex", gap: "1.5rem" }}>
          <Link href="/generate" style={{ fontSize: "0.72rem", color: "var(--faint)", textDecoration: "none" }}>Generate</Link>
          <Link href="/gallery" style={{ fontSize: "0.72rem", color: "var(--faint)", textDecoration: "none" }}>Gallery</Link>
        </nav>
      </header>

      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "2.5rem 2rem" }}>
        {/* ── Upload area ── */}
        <section style={{ marginBottom: "3rem" }}>
          <SectionLabel>Upload Historical Ads</SectionLabel>

          <div
            {...getRootProps()}
            style={{
              border: `1px dashed ${isDragActive ? "var(--copper)" : "var(--rim2)"}`,
              borderRadius: "6px",
              padding: "2rem",
              textAlign: "center",
              cursor: isUploading ? "default" : "pointer",
              background: isDragActive ? "var(--card)" : "transparent",
              transition: "all 0.15s",
              marginBottom: "1.5rem",
            }}
          >
            <input {...getInputProps()} />
            <div style={{ fontSize: "1.2rem", opacity: 0.25, marginBottom: "0.5rem" }}>⬆</div>
            <p style={{ fontSize: "0.8rem", color: "var(--faint)" }}>
              {isDragActive ? "Drop here" : "Drop images or click to browse — multiple allowed"}
            </p>
            <p style={{ fontSize: "0.7rem", color: "var(--ghost)", marginTop: "0.35rem" }}>
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
                    onTagChange={(tag) =>
                      setPending((prev) =>
                        prev.map((f) => (f.id === p.id ? { ...f, tag } : f))
                      )
                    }
                    onTitleChange={(title) =>
                      setPending((prev) =>
                        prev.map((f) => (f.id === p.id ? { ...f, title } : f))
                      )
                    }
                    onRemove={() => {
                      URL.revokeObjectURL(p.preview);
                      setPending((prev) => prev.filter((f) => f.id !== p.id));
                    }}
                  />
                ))}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                <button
                  onClick={handleUpload}
                  disabled={readyCount === 0 || isUploading}
                  style={{
                    padding: "0.7rem 1.5rem",
                    background: readyCount > 0 && !isUploading ? "var(--copper)" : "var(--card2)",
                    color: readyCount > 0 && !isUploading ? "var(--bg)" : "var(--ghost)",
                    border: "none",
                    borderRadius: "5px",
                    fontSize: "0.8rem",
                    fontWeight: 500,
                    cursor: readyCount > 0 && !isUploading ? "pointer" : "not-allowed",
                    fontFamily: "'DM Sans', sans-serif",
                    transition: "all 0.15s",
                  }}
                >
                  {isUploading ? "Uploading…" : `Upload ${readyCount} image${readyCount !== 1 ? "s" : ""}`}
                </button>
                {readyCount < pending.length && (
                  <span style={{ fontSize: "0.72rem", color: "var(--faint)" }}>
                    {pending.length - readyCount} image{pending.length - readyCount !== 1 ? "s" : ""} still need a tag
                  </span>
                )}
              </div>
              {uploadError && (
                <div style={{ marginTop: "0.75rem", padding: "0.75rem 1rem", background: "#1E1212", border: "1px solid #3A1E1E", borderRadius: "5px" }}>
                  <p style={{ fontSize: "0.75rem", color: "var(--err)", margin: 0 }}>
                    Upload error: {uploadError}
                  </p>
                </div>
              )}
            </div>
          )}
        </section>

        {/* ── Grid ── */}
        <section>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1.5rem",
            }}
          >
            <SectionLabel>
              Historical Ads{" "}
              {!isLoading && (
                <span style={{ color: "var(--ghost)", fontWeight: 400 }}>
                  ({ads.length})
                </span>
              )}
            </SectionLabel>

            {/* Filter tabs */}
            <div style={{ display: "flex", gap: "0.25rem" }}>
              {(["all", "studio", "street"] as FilterTag[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setFilterTag(t)}
                  style={{
                    padding: "0.35rem 0.875rem",
                    background: filterTag === t ? "var(--card2)" : "transparent",
                    border: `1px solid ${filterTag === t ? "var(--rim2)" : "transparent"}`,
                    borderRadius: "4px",
                    color: filterTag === t ? "var(--cream)" : "var(--faint)",
                    fontSize: "0.75rem",
                    cursor: "pointer",
                    fontFamily: "'DM Sans', sans-serif",
                    transition: "all 0.15s",
                  }}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                gap: "1rem",
              }}
            >
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="skeleton" style={{ aspectRatio: "1", borderRadius: "5px" }} />
              ))}
            </div>
          ) : loadError ? (
            <div style={{ padding: "2rem", background: "#1E1212", border: "1px solid #3A1E1E", borderRadius: "5px" }}>
              <p style={{ fontSize: "0.75rem", color: "var(--err)", margin: 0 }}>
                Error loading library: {loadError}
              </p>
            </div>
          ) : filteredAds.length === 0 ? (
            <div style={{ textAlign: "center", padding: "4rem", color: "var(--ghost)" }}>
              <p style={{ fontSize: "0.875rem" }}>No ads yet for this filter.</p>
              <p style={{ fontSize: "0.75rem", marginTop: "0.5rem" }}>Upload some images above to get started.</p>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                gap: "1rem",
              }}
            >
              {filteredAds.map((ad) => (
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
            background: "rgba(12,10,8,0.88)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "2rem",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--card)",
              border: "1px solid var(--rim2)",
              borderRadius: "8px",
              overflow: "hidden",
              maxWidth: "560px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            <img
              src={expandedAd.imageUrl}
              alt={expandedAd.title ?? "Historical ad"}
              style={{ width: "100%", display: "block", aspectRatio: "1", objectFit: "cover" }}
            />
            <div style={{ padding: "1.5rem" }}>
              <p className="display" style={{ fontSize: "1.3rem", fontWeight: 400, marginBottom: "1rem" }}>
                {expandedAd.title ?? "(untitled)"}
              </p>

              <p style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--faint)", marginBottom: "0.6rem" }}>
                Tag
              </p>
              <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem" }}>
                {(["studio", "street"] as Tag[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setEditTag(t)}
                    style={{
                      padding: "0.4rem 1rem",
                      borderRadius: "4px",
                      border: `1px solid ${editTag === t ? (t === "studio" ? "#C4845A" : "#688F6E") : "var(--rim)"}`,
                      background: editTag === t
                        ? t === "studio" ? "#2A1E14" : "#141E16"
                        : "transparent",
                      color: editTag === t
                        ? t === "studio" ? "#C4845A" : "#688F6E"
                        : "var(--faint)",
                      fontSize: "0.75rem",
                      fontFamily: "'DM Sans', sans-serif",
                      cursor: "pointer",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      fontWeight: 500,
                      transition: "all 0.15s",
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
                  style={{
                    padding: "0.6rem 1.25rem",
                    background: "var(--copper)",
                    color: "var(--bg)",
                    border: "none",
                    borderRadius: "4px",
                    fontSize: "0.8rem",
                    fontWeight: 500,
                    cursor: isSavingTag ? "wait" : "pointer",
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  {isSavingTag ? "Saving…" : "Save"}
                </button>
                <button
                  onClick={() => setExpandedAd(null)}
                  style={{
                    padding: "0.6rem 1.25rem",
                    background: "transparent",
                    color: "var(--faint)",
                    border: "1px solid var(--rim)",
                    borderRadius: "4px",
                    fontSize: "0.8rem",
                    cursor: "pointer",
                    fontFamily: "'DM Sans', sans-serif",
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
        fontSize: "0.65rem",
        textTransform: "uppercase",
        letterSpacing: "0.16em",
        color: "var(--faint)",
        marginBottom: "1rem",
        fontWeight: 500,
      }}
    >
      {children}
    </div>
  );
}

function PendingCard({
  item,
  onTagChange,
  onTitleChange,
  onRemove,
}: {
  item: PendingFile;
  onTagChange: (tag: "studio" | "street") => void;
  onTitleChange: (title: string) => void;
  onRemove: () => void;
}) {
  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--rim)",
        borderRadius: "5px",
        overflow: "hidden",
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
              background: "rgba(12,10,8,0.8)",
              borderRadius: "3px",
              padding: "0.2rem 0.4rem",
              fontSize: "0.6rem",
              color: "var(--copper)",
            }}
          >
            Tag required
          </div>
        )}
      </div>
      <div style={{ padding: "0.75rem" }}>
        <input
          placeholder="Title (optional)"
          value={item.title}
          onChange={(e) => onTitleChange(e.target.value)}
          style={{
            width: "100%",
            background: "transparent",
            border: "none",
            borderBottom: "1px solid var(--rim)",
            color: "var(--cream)",
            fontSize: "0.75rem",
            fontFamily: "'DM Sans', sans-serif",
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
              style={{
                flex: 1,
                padding: "0.3rem",
                borderRadius: "3px",
                border: `1px solid ${item.tag === t ? (t === "studio" ? "#C4845A" : "#688F6E") : "var(--rim)"}`,
                background: item.tag === t
                  ? t === "studio" ? "#2A1E14" : "#141E16"
                  : "transparent",
                color: item.tag === t
                  ? t === "studio" ? "#C4845A" : "#688F6E"
                  : "var(--ghost)",
                fontSize: "0.65rem",
                fontFamily: "'DM Sans', sans-serif",
                cursor: "pointer",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                fontWeight: 500,
                transition: "all 0.12s",
              }}
            >
              {t}
            </button>
          ))}
        </div>
        <button
          onClick={onRemove}
          style={{
            fontSize: "0.65rem",
            color: "var(--ghost)",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
          }}
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
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "var(--card)",
        borderRadius: "5px",
        overflow: "hidden",
        border: "1px solid var(--rim)",
        cursor: "pointer",
        transform: hovered ? "translateY(-2px)" : "none",
        boxShadow: hovered ? "0 6px 20px rgba(0,0,0,0.4)" : "none",
        transition: "transform 0.15s, box-shadow 0.15s",
      }}
    >
      <img
        src={ad.imageUrl}
        alt={ad.title ?? "Historical ad"}
        style={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block" }}
      />
      <div style={{ padding: "0.75rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "0.75rem", color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
            {ad.title ?? "(untitled)"}
          </span>
          <span
            style={{
              fontSize: "0.6rem",
              fontWeight: 500,
              padding: "0.15rem 0.4rem",
              borderRadius: "3px",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              flexShrink: 0,
              marginLeft: "0.5rem",
              background: ad.tag === "studio" ? "#2A1E14" : "#141E16",
              color: ad.tag === "studio" ? "#C4845A" : "#688F6E",
            }}
          >
            {ad.tag}
          </span>
        </div>
        <p style={{ fontSize: "0.65rem", color: "var(--ghost)", marginTop: "0.25rem" }}>
          {new Date(ad.uploadedAt).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
        </p>
      </div>
    </div>
  );
}
