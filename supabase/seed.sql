-- Seed categories for a Ghana e-commerce store

insert into public.categories (name, slug, sort_order) values
  ('Electronics',       'electronics',        1),
  ('Fashion',           'fashion',            2),
  ('Home & Living',     'home-living',        3),
  ('Health & Beauty',   'health-beauty',      4),
  ('Food & Groceries',  'food-groceries',     5),
  ('Sports & Outdoors', 'sports-outdoors',    6),
  ('Baby & Kids',       'baby-kids',          7),
  ('Phones & Tablets',  'phones-tablets',     8);

-- Sub-categories
with parent as (select id from public.categories where slug = 'electronics')
insert into public.categories (name, slug, parent_id, sort_order)
select name, slug, parent.id, sort_order from parent, (values
  ('TVs & Audio',    'tvs-audio',    1),
  ('Laptops',        'laptops',      2),
  ('Accessories',    'electronics-accessories', 3)
) as sub(name, slug, sort_order);

with parent as (select id from public.categories where slug = 'fashion')
insert into public.categories (name, slug, parent_id, sort_order)
select name, slug, parent.id, sort_order from parent, (values
  ('Men''s Clothing', 'mens-clothing', 1),
  ('Women''s Clothing','womens-clothing',2),
  ('Shoes',           'shoes',          3),
  ('Bags',            'bags',           4)
) as sub(name, slug, sort_order);

with parent as (select id from public.categories where slug = 'phones-tablets')
insert into public.categories (name, slug, parent_id, sort_order)
select name, slug, parent.id, sort_order from parent, (values
  ('Smartphones',  'smartphones',  1),
  ('Tablets',      'tablets',      2),
  ('Phone Cases',  'phone-cases',  3)
) as sub(name, slug, sort_order);
