-- ============================================================================
-- Makuku Supermarket POS — Seed Data
-- Migration 004: Default branch, categories, tills
-- ============================================================================

-- Default branch
INSERT INTO branches (id, name, location) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Makuku Supermarket', 'Main Branch');

-- Default categories (common Kenyan supermarket categories)
INSERT INTO categories (name, description) VALUES
  ('Beverages', 'Soft drinks, juices, water, tea, coffee'),
  ('Dairy', 'Milk, yoghurt, cheese, butter'),
  ('Cereals & Grains', 'Rice, wheat flour, maize flour, pasta, oats'),
  ('Cooking Oil & Fats', 'Cooking oil, margarine, ghee'),
  ('Fresh Produce', 'Fruits, vegetables, herbs'),
  ('Meat & Poultry', 'Fresh meat, chicken, fish'),
  ('Bakery', 'Bread, cakes, pastries, biscuits'),
  ('Household', 'Cleaning supplies, detergents, toiletries'),
  ('Personal Care', 'Soap, shampoo, toothpaste, deodorant'),
  ('Snacks & Confectionery', 'Crisps, sweets, chocolate, nuts'),
  ('Baby Products', 'Baby food, diapers, formula'),
  ('Canned & Packaged', 'Canned beans, tomatoes, sardines, corned beef'),
  ('Condiments & Spices', 'Salt, sugar, spices, sauces, vinegar'),
  ('Frozen Foods', 'Frozen vegetables, ice cream, frozen meats'),
  ('Stationery', 'Exercise books, pens, pencils');

-- Default tills
INSERT INTO tills (branch_id, name) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Till 1'),
  ('a0000000-0000-0000-0000-000000000001', 'Till 2'),
  ('a0000000-0000-0000-0000-000000000001', 'Till 3');
