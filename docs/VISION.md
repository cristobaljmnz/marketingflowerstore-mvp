# VISION — flowerstore.ph Agent-Driven Marketing Automation Prototype

## Role

You are a **senior technical product planner and systems architect**.

Your task is to produce a **complete, explicit, step-by-step execution plan** to build the project described below successfully.

This is **not** an ideation task.  
This is **not** a high-level brainstorm.

You must return a **concrete implementation plan** that can be followed and executed without guesswork, using modern web tooling and LLM-based systems.

---

## Context & Goal

The goal is to build a **working prototype** of an **agent-driven marketing automation tool** for **flowerstore.ph**, focused on generating high-quality **Facebook and Instagram** ads.

The prototype is meant to:

- Demonstrate strong product thinking
- Demonstrate agentic system design
- Be realistic, production-inspired, and internally consistent
- Be executable using **Next.js + Tailwind**, deployed on **Vercel**
- Integrate LLMs (**Gemini 3.1 Pro**, **Nano Banana Pro**) in a controlled, modular way

This prototype will later be executed using **Antigravity + Gemini 3.1 Pro**, so **clarity and determinism are critical**.

---

## Core Product Vision

### Objective

Build an **agentified creative generation system** that generates social media ad campaigns for **flowerstore.ph** using:

- Real product images uploaded by the user
- ~50 historical ads used as **brand memory**
- Two **strictly separated creative styles**:
  - **Studio / Corporate**
  - **Street / Casual**

The system must **never mix styles** and must always operate within **one clear creative lane**.

---

## Frontend & Deployment

- Framework: **Next.js**
- Styling: **Tailwind CSS**
- Use the Anthropic frontend-design skill:  
  https://skills.sh/anthropics/skills/frontend-design
- Deployment: **Vercel**

### App Views

#### `/generate`
- Chat-like input to request ad generation
- Product image upload
- Style selector: **Auto | Studio | Street**
- Display generated variants
- (MVP) Text may be baked into image
- (Planned) Canvas-based overlay editor

#### `/library`
Store and manage ~50 historical ads
- Manual upload
- Tagging: **studio** or **street**
- Semi-automatic tag suggestion

#### `/gallery`
Generated campaigns store:
- image base
- overlays / copy
- metadata (style, intent, product, date, references)

---

## High-Level Pipeline (Mandatory)

1. **Product ingestion**
   - User uploads a product image
   - User provides a generation request (natural language)

2. **Routing**
   - Determine creative style (**studio** or **street**)
   - Determine intent (**promo** vs **emotional**)

3. **Retrieval**
   - Retrieve **3–6 historical campaigns**
   - Only from the **selected style**

4. **Creative planning**
   - Generate structured campaign plan:
     - image prompts
     - copy
     - overlays
     - metadata

5. **Image generation**
   - Generate image base
   - (MVP: text may be included)
   - (Future: image without text + reserved space)

6. **Rendering**
   - (Future) Apply text overlays via Canvas / HTML

7. **Persistence**
   - Save final outputs to `/gallery`

---

## Creative Modes (Strict)

### 1) Studio / Corporate — “Selling the offer”
Purpose: Promotional marketing creatives.

Key characteristics:
- Product-first composition
- Graphic / pastel backgrounds
- Structured layouts
- Promotional messaging (prices, discounts, urgency)
- No real-world environments
- Designed, polished e-commerce look
- Clean, legible typography
- No misspellings

### 2) Street / Casual — “Selling the feeling”
Purpose: Lifestyle, emotional, relatable content.

Key characteristics:
- Real people
- Real urban environments
- Candid, unposed feel
- Natural light
- Optional short conversational text
- No prices, discounts, CTAs
- Looks like organic Instagram content
- Clean, legible typography
- No misspellings

These styles must **never** be mixed.

---

## Style Selector (UI)

User can choose:
- **Auto**
- **Studio**
- **Street**

If Auto:
- The system must infer the correct style
- If ambiguous, it may generate **one variant per style**

---

## Style-Aware Memory & Retrieval

- All historical ads are tagged **studio** or **street**
- Retrieval is always restricted to the selected style
- This prevents creative averaging

---

## Agent-Driven Architecture (Core)

The system is designed as specialized agents, each with a single responsibility.

### Router Agent
Classifies user request into **studio** or **street**.

Outputs:
```json
{ "style": "...", "confidence": 0.0-1.0 }
```

## Retrieval Agent

Retrieves **3–6** relevant historical campaigns:

- **Same style only**
- Based on:
  - theme
  - tone
  - seasonality
  - visual patterns

Returns:

- Campaign **IDs**
- **Short summaries** per campaign

---

## Creative Director Agent (Most Important)

This agent:

- **Does NOT** generate images
- **Does NOT** render UI
- Decides **how the campaign should be built**

### Inputs
- `user_message`
- product info + product image
- style selector
- brand profile
- retrieved references

### Output
Outputs a **strict JSON campaign plan** including:

- final style
- confidence
- campaign title
- creative intent
- deliverables
- image base prompts
- text overlays
- caption options
- hashtags
- metadata

### Constraints (Must)
- Maintain **strict creative consistency**
- **Never mix** Studio and Street rules
- Treat the **product image** as the primary visual reference
- Ensure outputs are **brand-aligned** and **executable**

---

## Image Generator

Tool, not an agent.

- Executes prompts from Creative Director
- Model: **Nano Banana Pro**

---

## Renderer

Not AI.

- Canvas / HTML / CSS
- Deterministic
- Applies overlays and typography (**future phase**)

---

## Librarian Agent

Tags and persists generated campaigns:

- Ensures metadata consistency
- Saves outputs to `/gallery`

---

## What You Must Deliver

You must produce:

- A clear implementation roadmap, ordered chronologically
- Concrete phases (**MVP → upgrades**)
- Technical responsibilities per phase
- Data models needed (high level)
- API boundaries between agents
- Frontend responsibilities per route
- Explicit assumptions and tradeoffs
- Clear separation between:
  - what is required for MVP
  - what is deferred but architecturally prepared

**Do not skip steps.**  
**Do not remain abstract.**  
**Do not redesign the system.**

Your output should read like a battle-tested execution plan written by someone who fully understands agentic systems, LLM constraints, and real-world product delivery.

---

## Output Format

- Structured sections
- Bullet points where appropriate
- Clear sequencing
- No code unless necessary
- No marketing fluff

---

### Instruction
Produce the full execution plan as a single Markdown file named:

docs/PLAN.md

Requirements:
- Use clear headings and numbered phases.
- Include: MVP scope, post-MVP upgrades, data models (high level), agent/API boundaries, route-by-route frontend responsibilities, assumptions/tradeoffs.
- Be explicit and step-by-step.
- No code unless necessary.
- Do not redesign the system; follow VISION.md constraints.

## Final Reminder

This system must:

- Be coherent
- Be buildable
- Be defensible in a technical interview
- Reflect strong product and system thinking

Proceed.