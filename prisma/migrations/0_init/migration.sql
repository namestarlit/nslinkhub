
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

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT public.app_uuid_v7(),
  name varchar(255) NOT NULL,
  username varchar(60) NOT NULL UNIQUE,
  display_username varchar(60),
  email varchar(255) NOT NULL UNIQUE,
  email_verified boolean NOT NULL DEFAULT false,
  image text,
  bio text,
  role varchar(16) NOT NULL DEFAULT 'user',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_role_check CHECK (role IN ('user', 'admin'))
);

-- better-auth tables (sessions, credential/oauth accounts, verifications).
CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT public.app_uuid_v7(),
  expires_at timestamptz NOT NULL,
  token text NOT NULL,
  ip_address text,
  user_agent text,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS accounts (
  id uuid PRIMARY KEY DEFAULT public.app_uuid_v7(),
  account_id text NOT NULL,
  provider_id text NOT NULL,
  user_id uuid NOT NULL,
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

CREATE TABLE IF NOT EXISTS verifications (
  id uuid PRIMARY KEY DEFAULT public.app_uuid_v7(),
  identifier text NOT NULL,
  value text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS sessions_token_key ON sessions (token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts (user_id);
CREATE INDEX IF NOT EXISTS idx_verifications_identifier ON verifications (identifier);

ALTER TABLE sessions ADD CONSTRAINT sessions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE accounts ADD CONSTRAINT accounts_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE NO ACTION;

CREATE TABLE IF NOT EXISTS repositories (
  id uuid PRIMARY KEY DEFAULT public.app_uuid_v7(),
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug varchar(120) NOT NULL,
  title varchar(255) NOT NULL,
  description text,
  visibility varchar(16) NOT NULL DEFAULT 'private',
  share_token_hash varchar(255),
  parent_repository_id uuid REFERENCES repositories(id) ON DELETE CASCADE,
  version bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT repositories_visibility_check CHECK (visibility IN ('public', 'unlisted', 'private')),
  CONSTRAINT repositories_unlisted_requires_share_token_check CHECK (
    visibility <> 'unlisted' OR share_token_hash IS NOT NULL
  ),
  CONSTRAINT repositories_owner_slug_unique UNIQUE (owner_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_repositories_visibility_updated_at
  ON repositories (visibility, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_repositories_parent_repository_id
  ON repositories (parent_repository_id);

CREATE OR REPLACE FUNCTION public.check_repository_hierarchy()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  has_cycle boolean;
  parent_depth int;
BEGIN
  IF NEW.parent_repository_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.parent_repository_id = NEW.id THEN
    RAISE EXCEPTION 'Repository cannot be parent of itself';
  END IF;

  WITH RECURSIVE ancestors AS (
    SELECT id, parent_repository_id, 1 AS depth
    FROM repositories
    WHERE id = NEW.parent_repository_id
    UNION ALL
    SELECT r.id, r.parent_repository_id, a.depth + 1
    FROM repositories r
    JOIN ancestors a ON r.id = a.parent_repository_id
    WHERE a.depth < 100
  )
  SELECT EXISTS(SELECT 1 FROM ancestors WHERE id = NEW.id), COALESCE(MAX(depth), 0)
  INTO has_cycle, parent_depth
  FROM ancestors;

  IF has_cycle THEN
    RAISE EXCEPTION 'Repository hierarchy cycle detected';
  END IF;

  IF parent_depth >= 8 THEN
    RAISE EXCEPTION 'Repository hierarchy exceeds maximum depth of 8';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_repository_hierarchy ON repositories;
CREATE TRIGGER trg_check_repository_hierarchy
BEFORE INSERT OR UPDATE OF parent_repository_id
ON repositories
FOR EACH ROW
EXECUTE FUNCTION public.check_repository_hierarchy();

CREATE TABLE IF NOT EXISTS links (
  id uuid PRIMARY KEY DEFAULT public.app_uuid_v7(),
  canonical_url text NOT NULL UNIQUE,
  url_hash varchar(64) NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS entries (
  id uuid PRIMARY KEY DEFAULT public.app_uuid_v7(),
  repository_id uuid NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  link_id uuid REFERENCES links(id),
  kind varchar(24) NOT NULL,
  linked_repository_id uuid REFERENCES repositories(id) ON DELETE CASCADE,
  title_override varchar(255),
  description text,
  note text,
  position integer NOT NULL,
  version bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT entries_kind_check CHECK (kind IN ('external_link', 'repository_link')),
  CONSTRAINT entries_external_requirements_check CHECK (
    kind <> 'external_link' OR (link_id IS NOT NULL AND linked_repository_id IS NULL)
  ),
  CONSTRAINT entries_repository_link_requirements_check CHECK (
    kind <> 'repository_link' OR (linked_repository_id IS NOT NULL AND link_id IS NULL)
  ),
  CONSTRAINT entries_repository_position_unique UNIQUE (repository_id, position)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_entries_repository_link
  ON entries (repository_id, link_id)
  WHERE link_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_entries_repository_updated_at
  ON entries (repository_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS tags (
  id uuid PRIMARY KEY DEFAULT public.app_uuid_v7(),
  name varchar(80) NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS repository_tags (
  repository_id uuid NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (repository_id, tag_id)
);

CREATE TABLE IF NOT EXISTS entry_tags (
  entry_id uuid NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (entry_id, tag_id)
);

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

DROP TRIGGER IF EXISTS trg_set_updated_at_repositories ON repositories;
CREATE TRIGGER trg_set_updated_at_repositories
BEFORE UPDATE ON repositories
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at_links ON links;
CREATE TRIGGER trg_set_updated_at_links
BEFORE UPDATE ON links
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at_entries ON entries;
CREATE TRIGGER trg_set_updated_at_entries
BEFORE UPDATE ON entries
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at_tags ON tags;
CREATE TRIGGER trg_set_updated_at_tags
BEFORE UPDATE ON tags
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();



CREATE TABLE IF NOT EXISTS export_jobs (
  id uuid PRIMARY KEY DEFAULT public.app_uuid_v7(),
  repository_id uuid NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS idx_export_jobs_repository_created_at
  ON export_jobs (repository_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_export_jobs_status_created_at
  ON export_jobs (status, created_at DESC);

DROP TRIGGER IF EXISTS trg_set_updated_at_export_jobs ON export_jobs;
CREATE TRIGGER trg_set_updated_at_export_jobs
BEFORE UPDATE ON export_jobs
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

