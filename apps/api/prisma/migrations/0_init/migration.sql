
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.app_uuid_v7()
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  new_id uuid;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'uuidv7'
      AND n.nspname = 'pg_catalog'
  ) THEN
    EXECUTE 'SELECT pg_catalog.uuidv7()' INTO new_id;
  ELSE
    new_id := gen_random_uuid();
  END IF;

  RETURN new_id;
END;
$$;

-- Users (global identity; product columns + better-auth columns)

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT public.app_uuid_v7(),
  name varchar(255) NOT NULL,
  email varchar(255) NOT NULL UNIQUE,
  email_verified boolean NOT NULL DEFAULT false,
  image text,
  bio text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Hubs (one personal space per user; owner_user_id is the 1:1 ownership FK,
-- handle is the mutable public identity that aliases the immutable id)

CREATE TABLE IF NOT EXISTS hubs (
  id uuid PRIMARY KEY DEFAULT public.app_uuid_v7(),
  owner_user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  handle varchar(60) NOT NULL UNIQUE,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hubs_handle_format_check CHECK (
    char_length(handle) BETWEEN 3 AND 60 AND handle ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  )
);

-- Collections (hub-owned; publication booleans replace the visibility triad)

CREATE TABLE IF NOT EXISTS collections (
  id uuid PRIMARY KEY DEFAULT public.app_uuid_v7(),
  hub_id uuid NOT NULL REFERENCES hubs(id) ON DELETE CASCADE,
  slug varchar(120) NOT NULL,
  title varchar(255) NOT NULL,
  description text,
  published boolean NOT NULL DEFAULT false,
  link_sharing_enabled boolean NOT NULL DEFAULT false,
  share_token_hash varchar(255),
  parent_collection_id uuid REFERENCES collections(id) ON DELETE CASCADE,
  creator_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  version bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT collections_link_sharing_requires_token_check CHECK (
    NOT link_sharing_enabled OR share_token_hash IS NOT NULL
  ),
  CONSTRAINT collections_hub_slug_unique UNIQUE (hub_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_collections_published_updated_at
  ON collections (published, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_collections_parent_collection_id
  ON collections (parent_collection_id);

CREATE OR REPLACE FUNCTION public.check_collection_hierarchy()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  has_cycle boolean;
  parent_depth int;
BEGIN
  IF NEW.parent_collection_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.parent_collection_id = NEW.id THEN
    RAISE EXCEPTION 'Collection cannot be parent of itself';
  END IF;

  WITH RECURSIVE ancestors AS (
    SELECT id, parent_collection_id, 1 AS depth
    FROM collections
    WHERE id = NEW.parent_collection_id
    UNION ALL
    SELECT c.id, c.parent_collection_id, a.depth + 1
    FROM collections c
    JOIN ancestors a ON c.id = a.parent_collection_id
    WHERE a.depth < 100
  )
  SELECT EXISTS(SELECT 1 FROM ancestors WHERE id = NEW.id), COALESCE(MAX(depth), 0)
  INTO has_cycle, parent_depth
  FROM ancestors;

  IF has_cycle THEN
    RAISE EXCEPTION 'Collection hierarchy cycle detected';
  END IF;

  IF parent_depth >= 8 THEN
    RAISE EXCEPTION 'Collection hierarchy exceeds maximum depth of 8';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_collection_hierarchy ON collections;
CREATE TRIGGER trg_check_collection_hierarchy
BEFORE INSERT OR UPDATE OF parent_collection_id
ON collections
FOR EACH ROW
EXECUTE FUNCTION public.check_collection_hierarchy();

-- Per-collection access grants and social saves

CREATE TABLE IF NOT EXISTS collection_shares (
  collection_id uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role varchar(16) NOT NULL,
  source varchar(16) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (collection_id, user_id),
  CONSTRAINT collection_shares_role_check CHECK (role IN ('reader', 'editor')),
  CONSTRAINT collection_shares_source_check CHECK (source IN ('direct', 'link'))
);

CREATE INDEX IF NOT EXISTS idx_collection_shares_user_id
  ON collection_shares (user_id);

CREATE TABLE IF NOT EXISTS collection_saves (
  collection_id uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  saved_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (collection_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_collection_saves_user_id
  ON collection_saves (user_id);

-- Links (internal URL dedupe) and resources

CREATE TABLE IF NOT EXISTS links (
  id uuid PRIMARY KEY DEFAULT public.app_uuid_v7(),
  canonical_url text NOT NULL UNIQUE,
  url_hash varchar(64) NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS resources (
  id uuid PRIMARY KEY DEFAULT public.app_uuid_v7(),
  collection_id uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  link_id uuid REFERENCES links(id),
  kind varchar(24) NOT NULL,
  linked_collection_id uuid REFERENCES collections(id) ON DELETE CASCADE,
  title_override varchar(255),
  position integer NOT NULL,
  version bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT resources_kind_check CHECK (kind IN ('external_link', 'collection_link')),
  CONSTRAINT resources_external_requirements_check CHECK (
    kind <> 'external_link' OR (link_id IS NOT NULL AND linked_collection_id IS NULL)
  ),
  CONSTRAINT resources_collection_link_requirements_check CHECK (
    kind <> 'collection_link' OR (linked_collection_id IS NOT NULL AND link_id IS NULL)
  ),
  CONSTRAINT resources_collection_position_unique UNIQUE (collection_id, position)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_resources_collection_link
  ON resources (collection_id, link_id)
  WHERE link_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_resources_collection_updated_at
  ON resources (collection_id, updated_at DESC);

-- Tags

CREATE TABLE IF NOT EXISTS tags (
  id uuid PRIMARY KEY DEFAULT public.app_uuid_v7(),
  name varchar(80) NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS collection_tags (
  collection_id uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (collection_id, tag_id)
);

CREATE TABLE IF NOT EXISTS resource_tags (
  resource_id uuid NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (resource_id, tag_id)
);

-- Export jobs (hub + collection scoped)

CREATE TABLE IF NOT EXISTS export_jobs (
  id uuid PRIMARY KEY DEFAULT public.app_uuid_v7(),
  hub_id uuid NOT NULL REFERENCES hubs(id) ON DELETE CASCADE,
  collection_id uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  requested_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  format varchar(16) NOT NULL,
  status varchar(16) NOT NULL,
  output_ref text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT export_jobs_format_check CHECK (format IN ('pdf')),
  CONSTRAINT export_jobs_status_check CHECK (status IN ('queued', 'running', 'completed', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_export_jobs_collection_created_at
  ON export_jobs (collection_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_export_jobs_status_created_at
  ON export_jobs (status, created_at DESC);

-- updated_at triggers (product tables; better-auth tables use Prisma @updatedAt)

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_updated_at_users ON users;
CREATE TRIGGER trg_set_updated_at_users
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at_hubs ON hubs;
CREATE TRIGGER trg_set_updated_at_hubs
BEFORE UPDATE ON hubs
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at_collections ON collections;
CREATE TRIGGER trg_set_updated_at_collections
BEFORE UPDATE ON collections
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at_collection_shares ON collection_shares;
CREATE TRIGGER trg_set_updated_at_collection_shares
BEFORE UPDATE ON collection_shares
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at_links ON links;
CREATE TRIGGER trg_set_updated_at_links
BEFORE UPDATE ON links
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at_resources ON resources;
CREATE TRIGGER trg_set_updated_at_resources
BEFORE UPDATE ON resources
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at_tags ON tags;
CREATE TRIGGER trg_set_updated_at_tags
BEFORE UPDATE ON tags
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at_export_jobs ON export_jobs;
CREATE TRIGGER trg_set_updated_at_export_jobs
BEFORE UPDATE ON export_jobs
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- better-auth: sessions, credential/oauth accounts, verifications

CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT public.app_uuid_v7(),
  expires_at timestamptz NOT NULL,
  token text NOT NULL,
  ip_address text,
  user_agent text,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS sessions_token_key ON sessions (token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id);

CREATE TABLE IF NOT EXISTS accounts (
  id uuid PRIMARY KEY DEFAULT public.app_uuid_v7(),
  account_id text NOT NULL,
  provider_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access_token text,
  refresh_token text,
  id_token text,
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  scope text,
  password text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts (user_id);

CREATE TABLE IF NOT EXISTS verifications (
  id uuid PRIMARY KEY DEFAULT public.app_uuid_v7(),
  identifier text NOT NULL,
  value text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_verifications_identifier ON verifications (identifier);
