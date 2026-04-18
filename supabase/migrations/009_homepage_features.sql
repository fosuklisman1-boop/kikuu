-- supabase/migrations/009_homepage_features.sql

-- ─── Hero carousel banners ───────────────────────────────────────────────────
CREATE TABLE public.banners (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title      text NOT NULL,
  subtitle   text,
  image_url  text NOT NULL,
  cta_text   text,
  cta_link   text,
  sort_order int NOT NULL DEFAULT 0,
  active     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read active banners" ON public.banners
  FOR SELECT USING (active = true);
CREATE POLICY "Admins manage banners" ON public.banners
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

-- ─── Flash sales ─────────────────────────────────────────────────────────────
CREATE TABLE public.flash_sales (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title      text NOT NULL,
  starts_at  timestamptz NOT NULL,
  ends_at    timestamptz NOT NULL,
  active     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.flash_sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read active flash sales" ON public.flash_sales
  FOR SELECT USING (active = true);
CREATE POLICY "Admins manage flash sales" ON public.flash_sales
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

CREATE TABLE public.flash_sale_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flash_sale_id uuid NOT NULL REFERENCES public.flash_sales(id) ON DELETE CASCADE,
  product_id    uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  sale_price    numeric(10,2) NOT NULL,
  sort_order    int NOT NULL DEFAULT 0,
  UNIQUE(flash_sale_id, product_id)
);
ALTER TABLE public.flash_sale_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read flash sale items" ON public.flash_sale_items
  FOR SELECT USING (true);
CREATE POLICY "Admins manage flash sale items" ON public.flash_sale_items
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

-- ─── Brands ──────────────────────────────────────────────────────────────────
CREATE TABLE public.brands (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  slug       text NOT NULL UNIQUE,
  logo_url   text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  active     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read active brands" ON public.brands
  FOR SELECT USING (active = true);
CREATE POLICY "Admins manage brands" ON public.brands
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

ALTER TABLE public.products
  ADD COLUMN brand_id uuid REFERENCES public.brands(id) ON DELETE SET NULL;

-- ─── Trending searches ───────────────────────────────────────────────────────
CREATE TABLE public.trending_searches (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query      text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  active     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.trending_searches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read active trending searches" ON public.trending_searches
  FOR SELECT USING (active = true);
CREATE POLICY "Admins manage trending searches" ON public.trending_searches
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
