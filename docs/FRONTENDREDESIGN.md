# FRONTEND UPGRADE DIRECTIVE

This document defines mandatory instructions to redesign and upgrade the frontend of the application.

This is not a redesign from scratch.
This is a structured modernization and refinement of the existing system.

Do NOT modify backend logic.
Do NOT change architecture.
Only update frontend structure, styling, layout, and interaction behavior.

---

# 1. CORE OBJECTIVE

Transform the current interface into a modern, premium, AI-grade internal tool interface.

The result must:
- Feel like a cutting-edge AI product
- Avoid generic “AI-generated” design patterns
- Be visually intentional
- Be fully responsive
- Be production-grade

This is not a website.
This is a digital instrument.

Every scroll must feel intentional.
Every animation must feel weighted and professional.

---

# 2. BRAND ALIGNMENT

## Color System

Update the entire color palette to match the palette used in:

## FlowerStore Color Palette (Mandatory)

Use the following semantic color tokens across the entire frontend.
Do not introduce additional primary brand colors.

| Semantic Name              | HEX Code  | Usage                                  |
|----------------------------|-----------|------------------------------------------|
| Brand Red / Accent         | #E25349   | CTA buttons, active nav, highlights      |
| Coral / Secondary Accent   | #F28C7A   | Hover states, secondary actions          |
| Off-White (Background)     | #FFF8F5   | Main backgrounds                         |
| Soft Pink (Surface)        | #F7E7E4   | Cards, panels, elevated surfaces         |
| Dark Text                  | #333333   | Primary text                             |
| Mid Gray                   | #6D6D6D   | Secondary text                           |

### Implementation Rules

- All primary CTA buttons must use **Brand Red / Accent**.
- Hover transitions should use **Coral / Secondary Accent** where appropriate.
- Backgrounds must use **Off-White** or **Soft Pink** only.
- Text hierarchy must strictly follow Dark Text and Mid Gray.
- No additional AI-style neon or purple/blue gradients are allowed.

Follow FlowerStore’s brand identity strictly.

---

# 3. LOGO INTEGRATION

The logo file is located at:

/images/logo.png

Implementation requirements:

- Place the logo in the top-left corner inside a rounded container.
- The container must follow the rounded-[2rem] to rounded-[3rem] system.
- To the right of the logo, display the title:

  FlowerStore InternalTools

- The logo container must visually integrate into the navbar.
- Ensure perfect vertical alignment.

---

# 4. NAVIGATION RESTRUCTURE

The three main views must be accessible from the top navigation:

- Generate
- Library
- Gallery

The navigation must follow the fixed design architecture:

## NAVBAR — “The Floating Island”

- Fixed, pill-shaped container
- Horizontally centered
- Rounded corners only (no sharp edges)

Morphing behavior:
- Transparent with light text at hero top
- Transitions to:
  bg-[background]/60
  backdrop-blur-xl
  subtle border
  primary-colored text
- Triggered using IntersectionObserver or ScrollTrigger

Must contain:
- Logo (image)
- Title text
- 3 nav links
- 1 CTA button (accent color)

---

# 5. RESPONSIVENESS (MANDATORY)

The app must be fully responsive.

Mobile behavior:
- Cards stack vertically
- Font sizes reduced proportionally
- Maintain rounded system
- Maintain premium spacing
- Avoid cramped layouts

No desktop-only layouts allowed.

---

# 6. DESIGN SYSTEM (NON-NEGOTIABLE)

These rules apply globally and must NEVER be removed.

## Visual Texture
- Implement global CSS noise overlay using inline SVG `<feTurbulence>` at 0.05 opacity.
- Use rounded-[2rem] to rounded-[3rem] radius for ALL containers.
- No sharp corners anywhere.

## Micro-Interactions
- All buttons:
  - Magnetic feel
  - scale(1.03) on hover
  - cubic-bezier(0.25, 0.46, 0.45, 0.94)
- Buttons must use overflow-hidden with sliding background span layer.
- Links must have translateY(-1px) lift on hover.

## Animation Lifecycle
- All animations must use gsap.context() inside useEffect.
- Cleanup must call ctx.revert().
- Entrance easing: power3.out
- Morph easing: power2.inOut
- Stagger:
  - 0.08 for text
  - 0.15 for cards

---

# 7. TYPOGRAPHY (NON-NEGOTIABLE)

Load via Google Fonts:

- Headings: Plus Jakarta Sans + Outfit (tight tracking)
- Drama accents: Cormorant Garamond Italic
- Data / technical content: IBM Plex Mono

Typography must feel intentional and structured.
No default Tailwind font stack allowed.

---

# 8. GALLERY FUNCTIONALITY UPGRADE

In the Gallery view:

Each campaign card must:

1. Display image carousel inside the card.
2. Include:
   - Previous button
   - Next button
3. Include a Download button per image.

Download behavior:
- Single click
- Immediately downloads the currently visible image

When clicking the card to expand:

- Carousel controls must remain functional
- Download button must remain available
- The same navigation system must work

At the bottom of each image container:

- Display navigation dots
- Highlight the active image
- Smooth transition between states

No default ugly carousel styles.
No generic UI patterns.
Controls must match the premium design system.

---

# 9. AESTHETIC DIRECTION

The UI must feel:

- Minimal but powerful
- Premium but restrained
- Clean but textured
- Modern but brand-aligned

Avoid:
- Overused AI gradients
- Excessive glow effects
- Overly futuristic clichés
- Generic glassmorphism

Subtle depth.
Subtle shadow.
Controlled contrast.

---

# 10. EXECUTION DIRECTIVE

Do not build a website.
Build a digital instrument.

Eradicate all generic AI patterns.
Every spacing, radius, transition, and hover must feel intentional.

The final result must look like:
- An internal AI tool built by a serious product team
- Fully responsive
- Brand coherent
- Production-ready