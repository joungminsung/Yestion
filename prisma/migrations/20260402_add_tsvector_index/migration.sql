-- Add tsvector column to Page for full-text search
ALTER TABLE "Page" ADD COLUMN IF NOT EXISTS "search_vector" tsvector;

-- Populate existing rows
UPDATE "Page" SET "search_vector" = to_tsvector('simple', coalesce("title", ''));

-- Create GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS "Page_search_vector_idx" ON "Page" USING GIN ("search_vector");

-- Create trigger to auto-update search_vector on title change
CREATE OR REPLACE FUNCTION page_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW."search_vector" := to_tsvector('simple', coalesce(NEW."title", ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS page_search_vector_trigger ON "Page";
CREATE TRIGGER page_search_vector_trigger
  BEFORE INSERT OR UPDATE OF "title" ON "Page"
  FOR EACH ROW EXECUTE FUNCTION page_search_vector_update();

-- Also index Block content for content search
CREATE INDEX IF NOT EXISTS "Block_content_gin_idx"
  ON "Block" USING GIN (to_tsvector('simple', "content"::text));
