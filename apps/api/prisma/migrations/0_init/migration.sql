
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
  tags text[] NOT NULL DEFAULT '{}',
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
  parent_has_parent boolean;
  has_children boolean;
BEGIN
  IF NEW.parent_collection_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.parent_collection_id = NEW.id THEN
    RAISE EXCEPTION 'Collection cannot be parent of itself';
  END IF;

  -- Collections nest at most two levels (a collection and its sections), so the
  -- parent must be a top-level collection.
  SELECT parent_collection_id IS NOT NULL INTO parent_has_parent
  FROM collections
  WHERE id = NEW.parent_collection_id;
  IF parent_has_parent THEN
    RAISE EXCEPTION 'Collections nest at most two levels (a collection and its sections)';
  END IF;

  -- A collection that already has sections cannot itself become a section.
  SELECT EXISTS(SELECT 1 FROM collections WHERE parent_collection_id = NEW.id)
  INTO has_children;
  IF has_children THEN
    RAISE EXCEPTION 'A collection with sections cannot be nested under another collection';
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

-- Resources (each stores its own canonical URL; tags are a denormalized array)

CREATE TABLE IF NOT EXISTS resources (
  id uuid PRIMARY KEY DEFAULT public.app_uuid_v7(),
  collection_id uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  kind varchar(24) NOT NULL,
  url text,
  linked_collection_id uuid REFERENCES collections(id) ON DELETE CASCADE,
  title_override varchar(255),
  tags text[] NOT NULL DEFAULT '{}',
  position integer NOT NULL,
  version bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT resources_kind_check CHECK (kind IN ('external_link', 'collection_link')),
  CONSTRAINT resources_external_requirements_check CHECK (
    kind <> 'external_link' OR (url IS NOT NULL AND linked_collection_id IS NULL)
  ),
  CONSTRAINT resources_collection_link_requirements_check CHECK (
    kind <> 'collection_link' OR (linked_collection_id IS NOT NULL AND url IS NULL)
  ),
  CONSTRAINT resources_collection_position_unique UNIQUE (collection_id, position)
);

-- One copy of a given URL per collection (md5 keeps the index within btree size
-- limits for long URLs); canonicalization happens in the application.
CREATE UNIQUE INDEX IF NOT EXISTS uq_resources_collection_url
  ON resources (collection_id, md5(url))
  WHERE url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_resources_collection_updated_at
  ON resources (collection_id, updated_at DESC);

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

DROP TRIGGER IF EXISTS trg_set_updated_at_resources ON resources;
CREATE TRIGGER trg_set_updated_at_resources
BEFORE UPDATE ON resources
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
