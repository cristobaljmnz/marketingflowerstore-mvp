-- ============================================================
-- flowerstore.ph — Database Schema
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================


-- ------------------------------------------------------------
-- TABLES
-- ------------------------------------------------------------

CREATE TABLE historical_ads (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url    TEXT NOT NULL,
  tag          TEXT NOT NULL CHECK (tag IN ('studio', 'street')),
  title        TEXT,
  description  TEXT,
  uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE generated_campaigns (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_image_url     TEXT NOT NULL,
  generated_image_urls  TEXT[] NOT NULL DEFAULT '{}',
  campaign_plan         JSONB NOT NULL,
  style                 TEXT NOT NULL CHECK (style IN ('studio', 'street')),
  intent                TEXT NOT NULL CHECK (intent IN ('promo', 'emotional')),
  caption_options       TEXT[] NOT NULL DEFAULT '{}',
  hashtags              TEXT[] NOT NULL DEFAULT '{}',
  reference_ids         TEXT[] NOT NULL DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ------------------------------------------------------------
-- STORAGE BUCKETS
-- ------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('product-uploads',      'product-uploads',      true),
  ('historical-ads',       'historical-ads',        true),
  ('generated-campaigns',  'generated-campaigns',   true);


-- ------------------------------------------------------------
-- STORAGE POLICIES (public read, authenticated write)
-- ------------------------------------------------------------

-- product-uploads
CREATE POLICY "Public read product-uploads"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-uploads');

CREATE POLICY "Public insert product-uploads"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'product-uploads');

-- historical-ads
CREATE POLICY "Public read historical-ads"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'historical-ads');

CREATE POLICY "Public insert historical-ads"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'historical-ads');

-- generated-campaigns
CREATE POLICY "Public read generated-campaigns"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'generated-campaigns');

CREATE POLICY "Public insert generated-campaigns"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'generated-campaigns');
