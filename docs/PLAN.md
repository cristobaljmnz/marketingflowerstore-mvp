# EXECUTION PLAN — flowerstore.ph Agent-Driven Marketing Automation Prototype

---

## Overview

This plan builds a working prototype of an agent-driven marketing automation tool for **flowerstore.ph** in **Next.js + Tailwind CSS**, deployed on **Vercel**. The system generates Facebook and Instagram ad campaigns using real product images, ~50 historical ads as brand memory, and two strictly separated creative styles (Studio / Street).

The plan is ordered chronologically, with each phase depending on the previous. MVP scope and deferred upgrades are explicitly separated throughout.

---

## Phase 0 — Project Foundation

### 0.1 Initialize Repository

- Create a new **Next.js 14+** project using the App Router
- Install and configure **Tailwind CSS**
- Install core dependencies:
  - `zod` — schema validation for all agent inputs and outputs
  - `react-dropzone` — file upload in `/generate` and `/library`
  - `uuid` — generate record IDs
- Confirm the `frontend-design` skill is available at `.agents/skills/frontend-design/`
- Initialize a `skills-lock.json` entry (already present)

### 0.2 Establish Directory Structure

```
app/
  generate/         → /generate route
  library/          → /library route
  gallery/          → /gallery route
  api/
    upload/         → product image upload
    pipeline/
      generate/     → full pipeline orchestration
    agents/
      router/
      retrieval/
      creative-director/
      librarian/
    tools/
      image-generator/
    library/
      upload/
    gallery/

lib/
  llm/
    gemini.ts       → Gemini 3.1 Pro client wrapper
    nano-banana.ts  → Nano Banana Pro client wrapper
  storage/
    adapter.ts      → storage interface
    supabase.ts     → Supabase implementation (images + records)
  schema/
    historical-ad.ts
    campaign-plan.ts
    generated-campaign.ts
  pipeline/
    generate.ts     → orchestration function

components/         → shared UI components
public/             → static assets
docs/               → VISION.md, PLAN.md
```

### 0.3 Environment Variables

Define and document all required env vars. No defaults — fail loudly if missing.

| Variable | Purpose |
|---|---|
| `GEMINI_API_KEY` | Gemini 3.1 Pro — Router, Retrieval, Creative Director agents + Nano Banana Pro image generation |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key — safe for client-side reads |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key — server-side writes only |

### 0.4 Vercel Deployment

- Connect repository to Vercel project
- Set all env vars in the Vercel dashboard (not committed to repo)
- Confirm auto-deploy on push to `main`
- Confirm Supabase project is provisioned and reachable from Vercel

---

## Phase 1 — Data Models

Define all schemas up front. These schemas are the single source of truth for agent inputs, agent outputs, API contracts, and frontend types. Use **Zod** for runtime validation.

### 1.1 HistoricalAd

Represents one ad in the `/library`.

| Field | Type | Notes |
|---|---|---|
| `id` | `string` (UUID) | Generated on upload |
| `imageUrl` | `string` | Supabase Storage public URL |
| `tag` | `"studio" \| "street"` | Required; user-assigned or auto-suggested |
| `title` | `string` (optional) | Human-assigned label |
| `description` | `string` (optional) | Human-assigned notes |
| `uploadedAt` | ISO date string | Set at upload time |

### 1.2 CampaignPlan

Output of the Creative Director Agent. This is the contract between the planning layer and the execution layer.

| Field | Type | Notes |
|---|---|---|
| `style` | `"studio" \| "street"` | Final resolved style |
| `confidence` | `number` (0.0–1.0) | Inherited from Router Agent |
| `campaignTitle` | `string` | Human-readable campaign name |
| `creativeIntent` | `"promo" \| "emotional"` | Drives copy and image tone |
| `deliverables` | `string[]` | Descriptor per deliverable (e.g., "Feed post — product hero") |
| `imageBasePrompts` | `string[]` | One image generation prompt per deliverable |
| `textOverlays` | `Array<{ text, position, style }>` | Structured overlay specs (MVP: baked in; future: rendered separately) |
| `captionOptions` | `string[]` | 3 caption variants |
| `hashtags` | `string[]` | Relevant hashtags |
| `metadata` | `{ product, style, intent, date, referenceIds[] }` | Traceability |

### 1.3 GeneratedCampaign

Persisted record in the `/gallery`.

| Field | Type | Notes |
|---|---|---|
| `id` | `string` (UUID) | Generated on save |
| `productImageUrl` | `string` | Original product image |
| `generatedImageUrls` | `string[]` | One URL per deliverable |
| `campaignPlan` | `CampaignPlan` | Full plan object embedded |
| `style` | `"studio" \| "street"` | Denormalized for fast filtering |
| `intent` | `"promo" \| "emotional"` | Denormalized for fast filtering |
| `captionOptions` | `string[]` | Denormalized for display |
| `hashtags` | `string[]` | Denormalized for display |
| `referenceIds` | `string[]` | Historical ads referenced |
| `createdAt` | ISO date string | Set at save time |

---

## Phase 2 — Storage Layer

All storage goes through **Supabase** — one service for both images and structured records.

### 2.1 Image Storage — Supabase Storage

All images (product uploads, historical ads, generated images) are stored in Supabase Storage buckets.

Buckets:
- `product-uploads` — temporary product images uploaded at generation time
- `historical-ads` — images from the `/library`
- `generated-campaigns` — images produced by the Image Generator

Operations required:
- `uploadImage(bucket: string, file: File | Buffer, filename: string) → string` — returns public URL

### 2.2 Record Persistence — Supabase Database

All structured records (HistoricalAd, GeneratedCampaign) are stored in Supabase PostgreSQL tables.

Tables:
- `historical_ads` — columns matching the HistoricalAd model
- `generated_campaigns` — columns matching the GeneratedCampaign model; `campaign_plan` stored as JSONB

Operations required:
- `saveHistoricalAd(ad: HistoricalAd) → void`
- `getHistoricalAds(tag?: "studio" | "street") → HistoricalAd[]`
- `updateHistoricalAdTag(id: string, tag: "studio" | "street") → void`
- `saveGeneratedCampaign(campaign: GeneratedCampaign) → void`
- `getGeneratedCampaigns(filters?: { style?, intent? }) → GeneratedCampaign[]`

### 2.3 Storage Adapter Interface

Wrap all operations behind a storage interface defined in `lib/storage/adapter.ts`. This allows the Supabase implementation to be swapped without touching agent or route code.

---

## Phase 3 — LLM Client Wrappers

Build typed wrappers before implementing any agents. Agents must never call LLM APIs directly — they always go through these wrappers.

### 3.1 Gemini 3.1 Pro Client (`lib/llm/gemini.ts`)

- Accept: `{ system: string, user: string, schema?: ZodSchema }`
- When `schema` is provided: use Gemini structured output / function calling to return validated JSON
- When no `schema`: return plain text
- Apply exponential backoff (up to 3 retries) on rate limit or 5xx errors
- Log all inputs and outputs to `console.error` in development

### 3.2 Nano Banana Pro Client (`lib/llm/nano-banana.ts`)

- Nano Banana Pro is a Gemini model — uses the same `GEMINI_API_KEY`
- Accept: `{ prompt: string, referenceImageUrl?: string }`
- Return: `{ imageUrl: string }`
- This is a **tool**, not an agent — no system prompt, no reasoning
- Log prompt and returned URL in development

---

## Phase 4 — Agent API Routes

Each agent is an isolated `POST` route handler. Agents do not call other agents. The pipeline orchestrator (Phase 5) is responsible for sequencing.

Each route:
1. Parses and validates input with Zod
2. Calls the LLM wrapper
3. Validates the output with Zod
4. Returns structured JSON

---

### 4.1 Router Agent — `POST /api/agents/router`

**Purpose:** Classify the user request into a creative style.

**Input:**
```
{
  userMessage: string,
  styleSelector: "auto" | "studio" | "street"
}
```

**Logic:**
- If `styleSelector` is `"studio"` or `"street"`: return immediately — no LLM call.
  - `{ style: styleSelector, confidence: 1.0 }`
- If `styleSelector` is `"auto"`: call Gemini 3.1 Pro.
  - System prompt: classify the request as `studio` (promotional intent — prices, urgency, product-focused) or `street` (lifestyle intent — emotional, relatable, no CTAs).
  - Parse and validate the JSON response.
  - If confidence < 0.65: mark as ambiguous.

**Output:**
```
{
  style: "studio" | "street",
  confidence: number,
  ambiguous: boolean
}
```

---

### 4.2 Retrieval Agent — `POST /api/agents/retrieval`

**Purpose:** Retrieve the 3–6 most relevant historical ads for the given style and request.

**Input:**
```
{
  style: "studio" | "street",
  userMessage: string,
  topK: number  // 3–6
}
```

**Logic:**
- Load all HistoricalAds from Supabase filtered by `style`.
- If the library has fewer than 3 ads for the selected style: return all available with a warning.
- Call Gemini 3.1 Pro:
  - Provide the user message.
  - Provide the list of historical ads as `[{ id, title, description }]`.
  - Instruction: select the `topK` most relevant based on theme, tone, seasonality, and visual patterns.
  - Return selected IDs and a one-sentence summary per ad.
- Validate the response: confirm all returned IDs exist in the loaded ads list.

**MVP note:** No vector embeddings. LLM semantic selection over plain-text metadata is sufficient for ~50 ads.

**Output:**
```
{
  retrievedAds: Array<{ id: string, summary: string }>
}
```

---

### 4.3 Creative Director Agent — `POST /api/agents/creative-director`

**Purpose:** Produce the full campaign plan. This is the most important agent.

**Input:**
```
{
  userMessage: string,
  productImageUrl: string,
  style: "studio" | "street",
  styleConfidence: number,
  retrievedAds: Array<{ id: string, summary: string }>,
  brandProfile: BrandProfile
}
```

**Brand Profile (hardcoded for MVP):**
- Name: flowerstore.ph
- Tone: warm, aspirational, Filipino-market-aware
- Studio rules — must: product-forward, graphic/pastel backgrounds, structured layouts, promotional messaging, prices, urgency, clean typography, no misspellings
- Studio rules — must not: real people, outdoor environments, lifestyle shots, emotional framing, organic aesthetic
- Street rules — must: real people, real urban environments, candid/unposed feel, natural light, conversational optional text, clean typography, no misspellings
- Street rules — must not: prices, discounts, CTAs, promotional language, studio backdrops, posed product shots

**Logic:**
- Call Gemini 3.1 Pro with a detailed system prompt that encodes:
  - All brand profile rules
  - The selected style exclusively — no blending permitted
  - The product image URL as the primary visual reference
  - The retrieved ad summaries as creative reference points
  - Output schema (CampaignPlan) with required fields
- Use structured output / function calling to force valid JSON
- Validate output against the CampaignPlan Zod schema
- On validation failure: retry up to 2 times with the error appended to the prompt
- On 3rd failure: return a 422 error with the raw output for debugging

**Output:** Full `CampaignPlan` JSON object (see Phase 1.2)

---

### 4.4 Image Generator Tool — `POST /api/tools/image-generator`

**Purpose:** Execute one image generation prompt. Not an agent.

**Input:**
```
{
  prompt: string,
  style: "studio" | "street",
  productImageUrl: string
}
```

**Logic:**
- Call Nano Banana Pro (Gemini model, same `GEMINI_API_KEY`) with the prompt
- Pass `productImageUrl` as a reference image where the API supports it
- Return the generated image URL

**Output:**
```
{
  imageUrl: string
}
```

**MVP note:** Called once per `imageBasePrompt` in the CampaignPlan. Sequential calls; parallel execution is a post-MVP improvement.

---

### 4.5 Librarian Agent — `POST /api/agents/librarian`

**Purpose:** Persist a completed generation to the gallery.

**Input:**
```
{
  productImageUrl: string,
  generatedImageUrls: string[],
  campaignPlan: CampaignPlan
}
```

**Logic:**
- Assemble a `GeneratedCampaign` record from all inputs
- Assign a UUID and `createdAt` timestamp
- Persist to Supabase via the storage adapter
- Return the saved campaign ID

**Output:**
```
{
  savedId: string
}
```

---

## Phase 5 — Pipeline Orchestration

Define a single server-side pipeline function (`lib/pipeline/generate.ts`) that calls agents in sequence. This function is called by `POST /api/pipeline/generate`.

### 5.1 Pipeline Steps

1. **Upload product image** — upload to Supabase Storage, receive `productImageUrl`
2. **Router Agent** — POST to `/api/agents/router` with `userMessage` and `styleSelector`
   - Receive `style`, `confidence`, `ambiguous`
3. **Style fork check** — if `ambiguous: true` AND `styleSelector === "auto"`:
   - Fork: run steps 4–6 twice, once with `style = "studio"` and once with `style = "street"`
   - Return two sets of variants to the frontend
4. **Retrieval Agent** — POST to `/api/agents/retrieval` with `style` and `userMessage`
   - Receive `retrievedAds`
5. **Creative Director Agent** — POST to `/api/agents/creative-director` with all context
   - Receive `campaignPlan`
6. **Image Generator Tool** — for each `imageBasePrompt` in `campaignPlan.imageBasePrompts`:
   - POST to `/api/tools/image-generator`
   - Collect all `generatedImageUrls`
7. **Librarian Agent** — POST to `/api/agents/librarian` with full output
   - Receive `savedId`
8. **Return** the full result set to the frontend

### 5.2 Error Handling

- On any agent step failure: stop the pipeline, return a structured error `{ step, error }` to the frontend
- Do not silently swallow errors or continue with partial results
- Expose which step failed so the frontend can display a meaningful message
- Creative Director retry logic is handled inside its own route (Phase 4.3); the pipeline treats it as a single call

### 5.3 Progress Communication

- The pipeline endpoint uses **Server-Sent Events (SSE)** or **streaming response** to emit step-completion events
- Events: `{ step: "router" | "retrieval" | "creative-director" | "image-generation" | "saving", status: "running" | "done" | "error" }`
- The frontend `/generate` view consumes these events to update the progress indicator

---

## Phase 6 — Frontend Routes

Apply the `frontend-design` skill from `.agents/skills/frontend-design/` to all three routes. The skill governs visual direction, typography, motion, and layout. Do not use generic fonts (Inter, Roboto, Arial) or generic color schemes.

---

### 6.1 `/generate` — Ad Generation

**Layout:**
- Two-column layout (desktop): left column for inputs, right column for results
- Single column on mobile

**Input panel (left):**
- Style selector at the top: segmented control — `Auto | Studio | Street` — visually prominent, drives the entire pipeline
- Product image dropzone (react-dropzone): accepts JPG, PNG, WEBP
- Chat-like textarea: "Describe what you want to create..."
- Submit button

**Results panel (right):**
- Default state: empty with placeholder prompt
- Loading state: step-by-step progress indicator showing which agent is currently running (router → retrieval → creative plan → image generation → saving)
- Success state: one card per generated variant, each showing:
  - Generated image (full width)
  - Campaign title
  - Style badge (Studio / Street)
  - Intent badge (Promo / Emotional)
  - Selected caption (with toggle to see all 3 variants)
  - Hashtags
  - Link to view in `/gallery`
- Error state: descriptive message showing which pipeline step failed

**Constraints:**
- No canvas overlay editor in MVP — text is baked into the generated image
- Product image upload must complete before the pipeline starts
- Style selector choice is locked during an active generation

---

### 6.2 `/library` — Historical Ad Management

**Layout:**
- Top: upload area (full width)
- Below: filterable grid of historical ads

**Upload flow:**
1. User selects one or more image files in the dropzone
2. For each selected image:
   - Call Router Agent with empty `userMessage` to get a suggested tag
   - Display the image thumbnail with a pre-filled tag suggestion (Studio / Street)
   - User can accept or override the tag
3. User confirms upload — images are sent to `POST /api/library/upload` with confirmed tags
4. Grid refreshes with new entries

**Grid:**
- Filter tabs: `All | Studio | Street`
- Each card: image thumbnail, tag badge (color-coded), title (if set), upload date
- Click on a card: expand to show full image, allow tag editing

**Constraints:**
- Tag is required before upload can be confirmed
- Bulk upload is supported (multiple files in one dropzone interaction)
- No deletion in MVP — only upload and tag management

---

### 6.3 `/gallery` — Generated Campaigns

**Layout:**
- Filter bar at the top
- Masonry or fixed-grid of campaign cards below

**Filter bar:**
- Style: `All | Studio | Street`
- Intent: `All | Promo | Emotional`
- Date: most recent first (default); no date range picker in MVP

**Campaign card:**
- Generated image (primary)
- Campaign title
- Style + intent badges
- One caption (truncated)
- Hashtag list (truncated)

**Expanded view (click or modal):**
- Full-size generated image
- All 3 caption variants
- Full hashtag list
- Referenced historical ad IDs
- Product image thumbnail
- Download button for the generated image

**Constraints:**
- Read-only in MVP — no editing or deletion
- Campaigns are ordered by `createdAt` descending
- Fetch from `GET /api/gallery` with optional query params for filters

---

## Phase 7 — Additional API Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/upload` | POST | Upload a product image to Supabase Storage; return public URL |
| `/api/library/upload` | POST | Upload historical ad image(s) with tags; persist HistoricalAd records to Supabase |
| `/api/library` | GET | Return all historical ads from Supabase; accepts `?tag=studio\|street` query param |
| `/api/pipeline/generate` | POST | Orchestrate full pipeline; stream progress events |
| `/api/gallery` | GET | Return all generated campaigns from Supabase; accepts `?style=&intent=` query params |

---

## Phase 8 — Post-MVP Upgrades (Architecturally Prepared)

These features are deferred. The MVP data models and agent outputs already include the fields they require. No architectural changes are needed when implementing them.

### 8.1 Canvas-Based Overlay Editor (`/generate`)

- After image generation, render the base image on an HTML5 `<canvas>`
- Consume `campaignPlan.textOverlays` (position, text, style) to place editable text layers
- Allow the user to drag, resize, and retype overlays
- Export the composited image as a PNG
- **Preparation done in MVP:** `textOverlays` is already in CampaignPlan; the MVP ignores it at render time

### 8.2 Deterministic Renderer

- A pure Canvas/HTML/CSS component: `render(imageUrl, textOverlays[]) → composited image`
- No AI involvement
- Replaces the MVP approach of baking text into the generation prompt
- **Preparation done in MVP:** Image Generator tool is called per prompt; swapping in a post-generation renderer requires no pipeline changes

### 8.3 Vector-Based Retrieval

- On historical ad upload: generate an embedding of the ad's metadata using Gemini embeddings API; store as a vector column in Supabase (pgvector)
- Replace LLM-based selection in the Retrieval Agent with cosine similarity over stored embeddings
- API contract is unchanged — the Retrieval Agent still returns `{ retrievedAds: [{ id, summary }] }`
- **Preparation done in MVP:** Retrieval Agent is isolated behind its own route; swapping the internal implementation requires no changes to callers

### 8.4 Parallel Image Generation

- Replace sequential Image Generator calls with `Promise.all`
- Straightforward change inside the pipeline orchestration function

### 8.5 Tag Suggestion with Vision Input

- Pass the uploaded image (not just `userMessage`) to the Router Agent during library upload
- Requires Gemini vision input support
- More accurate tag suggestions for abstract or ambiguous images

### 8.6 Authentication

- Add a single-user authentication layer (e.g., Vercel Edge Middleware + a hardcoded password or NextAuth)
- All API routes require authentication before going to production

---

## Explicit Assumptions & Tradeoffs

### Assumptions

1. **~50 historical ads** is small enough that LLM-based semantic retrieval (no vector embeddings) is fast and accurate enough for MVP. This breaks down above ~200 ads.
2. **Nano Banana Pro** is a Gemini model and uses the same `GEMINI_API_KEY` — no separate API credential needed.
3. **Supabase** free tier is sufficient for MVP-scale storage and database usage.
4. **Brand profile is hardcoded** for MVP. flowerstore.ph's creative rules are defined as constants in the Creative Director system prompt, not in a database. This is intentional — brand rules change rarely and keeping them in code ensures they are always applied.
5. **No authentication** is needed for the prototype. The tool is internal and single-tenant.
6. **Text baked into images** is acceptable for MVP. The Creative Director still outputs `textOverlays` in the CampaignPlan, which preserves the post-MVP rendering path.
7. **Gemini 3.1 Pro** supports structured JSON output via function calling or constrained generation, enabling reliable CampaignPlan validation.

### Tradeoffs

| Decision | Accepted Risk | Mitigation |
|---|---|---|
| LLM retrieval (no embeddings) | Inaccurate results beyond ~200 ads | Retrieval Agent is isolated; swap to pgvector without touching other code |
| Sequential image generation | Slower pipeline for multi-deliverable campaigns | `Promise.all` is a one-line change when needed |
| Supabase as sole storage provider | Single point of dependency | Free tier is generous; Supabase is production-grade and widely used |
| No auth on prototype | Any user with the URL can access the tool | Add middleware before sharing externally |
| No streaming agent responses | User waits for full step before seeing output | SSE progress events communicate step status; acceptable UX for a prototype |
| Hardcoded brand profile | Cannot update brand rules without a deploy | Acceptable for MVP; externalize to DB in production |

---

## Build Order (Chronological)

1. Initialize Next.js project, Tailwind CSS, dependencies ✓
2. Connect to Vercel; deploy; set env vars ✓
3. Create Supabase project; provision Storage buckets and DB tables; add env vars to Vercel
4. Define all Zod schemas (`lib/schema/`)
5. Implement storage adapter and Supabase implementation (`lib/storage/`)
6. Implement Gemini 3.1 Pro client wrapper (`lib/llm/gemini.ts`)
7. Implement Nano Banana Pro client wrapper (`lib/llm/nano-banana.ts`)
8. Implement Router Agent route — verify with manual POST test
9. Implement Retrieval Agent route — verify with manual POST test using mock library data
10. Implement Creative Director Agent route — verify CampaignPlan schema validation and retry logic
11. Implement Image Generator Tool route — verify with a test prompt
12. Implement Librarian Agent route — verify record persistence in Supabase
13. Implement pipeline orchestration function + `POST /api/pipeline/generate` with SSE progress
14. Build `/library` route (establishes upload and storage patterns used by `/generate`)
15. Build `/generate` route (wires full pipeline, shows progress and results)
16. Build `/gallery` route (read-only, simplest route)
17. Apply `frontend-design` skill for visual polish across all three routes
18. End-to-end test: upload a product image, generate a campaign, confirm it appears in `/gallery`
19. Deploy to Vercel; verify all env vars are set; verify Supabase connectivity in production
