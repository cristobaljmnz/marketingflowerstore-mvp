"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/generate", label: "Generate" },
  { href: "/library",  label: "Library"  },
  { href: "/gallery",  label: "Gallery"  },
] as const;

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      style={{
        position: "fixed",
        top: "0.875rem",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 1000,
        width: "min(960px, calc(100% - 2rem))",
        borderRadius: "var(--r-lg)",
        padding: "0.5rem 0.625rem 0.5rem 0.5rem",
        display: "flex",
        alignItems: "center",
        gap: "0.25rem",
        background: scrolled ? "rgba(255,248,245,0.82)" : "rgba(255,248,245,0)",
        backdropFilter: scrolled ? "blur(24px) saturate(180%)" : "none",
        WebkitBackdropFilter: scrolled ? "blur(24px) saturate(180%)" : "none",
        border: `1px solid ${scrolled ? "rgba(226,83,73,0.14)" : "transparent"}`,
        boxShadow: scrolled ? "0 4px 32px rgba(226,83,73,0.07), 0 1px 0 rgba(255,255,255,0.6) inset" : "none",
        transition: "all 0.38s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
      }}
    >
      {/* ── Logo + title ── */}
      <Link
        href="/generate"
        className="nav-link"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.625rem",
          textDecoration: "none",
          flexShrink: 0,
          padding: "0.25rem 0.5rem 0.25rem 0.25rem",
        }}
      >
        <div
          style={{
            width: "2.25rem",
            height: "2.25rem",
            borderRadius: "var(--r-sm)",
            overflow: "hidden",
            background: "var(--surface)",
            border: "1px solid var(--rim)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {logoError ? (
            <span style={{ fontSize: "1rem", lineHeight: 1 }}>🌸</span>
          ) : (
            <Image
              src="/images/logo.png"
              alt="FlowerStore logo"
              width={36}
              height={36}
              style={{ objectFit: "contain", width: "100%", height: "100%" }}
              onError={() => setLogoError(true)}
            />
          )}
        </div>

        <div style={{ lineHeight: 1.2 }}>
          <div
            style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontWeight: 700,
              fontSize: "0.8rem",
              color: "var(--cream)",
              letterSpacing: "-0.01em",
              whiteSpace: "nowrap",
            }}
          >
            FlowerStore
          </div>
          <div
            style={{
              fontFamily: "'Outfit', sans-serif",
              fontWeight: 400,
              fontSize: "0.65rem",
              color: "var(--brand)",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            InternalTools
          </div>
        </div>
      </Link>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* ── Nav links ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.125rem",
          flexWrap: "nowrap",
        }}
      >
        {NAV_LINKS.map(({ href, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className="nav-link"
              style={{
                padding: "0.45rem 0.875rem",
                borderRadius: "var(--r-md)",
                fontSize: "0.8rem",
                fontWeight: active ? 600 : 400,
                color: active ? "var(--brand)" : "var(--muted)",
                background: active ? "rgba(226,83,73,0.08)" : "transparent",
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}
            >
              {label}
            </Link>
          );
        })}

        {/* CTA button */}
        <Link
          href="/generate"
          className="btn"
          style={{
            marginLeft: "0.375rem",
            padding: "0.5rem 1.125rem",
            borderRadius: "var(--r-md)",
            background: "var(--brand)",
            color: "#fff",
            fontSize: "0.8rem",
            fontWeight: 600,
            textDecoration: "none",
            letterSpacing: "-0.01em",
            boxShadow: "0 2px 14px rgba(226,83,73,0.28)",
            fontFamily: "'Plus Jakarta Sans', sans-serif",
          }}
        >
          <span className="btn-slide" style={{ background: "var(--brand-l)" }} />
          <span style={{ position: "relative", zIndex: 1 }}>New Campaign</span>
        </Link>
      </div>
    </nav>
  );
}
