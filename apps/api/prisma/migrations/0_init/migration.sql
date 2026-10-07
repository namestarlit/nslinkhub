-- Initial schema (pre-deployment squash of all earlier migrations, 2026-10-07).
-- Generated from the migrated schema with pg_dump, so it keeps the hand-written
-- pieces Prisma's diff cannot express: app_uuid_v7(), set_updated_at triggers,
-- CHECK constraints and partial unique indexes. Later schema changes are new
-- migrations created with `prisma migrate dev --create-only` and reviewed.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

CREATE FUNCTION public.app_uuid_v7() RETURNS uuid
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

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE public.accounts (
    id uuid DEFAULT public.app_uuid_v7() NOT NULL,
    account_id text NOT NULL,
    provider_id text NOT NULL,
    user_id uuid NOT NULL,
    access_token text,
    refresh_token text,
    id_token text,
    access_token_expires_at timestamp with time zone,
    refresh_token_expires_at timestamp with time zone,
    scope text,
    password text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.admin_bootstrap (
    id integer NOT NULL,
    invitation_id uuid NOT NULL,
    claimed_by_id uuid,
    claimed_at timestamp(6) with time zone,
    CONSTRAINT admin_bootstrap_singleton CHECK ((id = 1))
);

CREATE TABLE public.admin_grants (
    user_id uuid NOT NULL,
    granted_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    invitation_id uuid NOT NULL
);

CREATE TABLE public.audit_records (
    id uuid DEFAULT public.app_uuid_v7() NOT NULL,
    hub_id uuid NOT NULL,
    actor_user_id uuid NOT NULL,
    collection_id uuid,
    target_user_id uuid,
    action character varying(48) NOT NULL,
    role character varying(16),
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT audit_action_check CHECK (((action)::text = ANY ((ARRAY['collection.published'::character varying, 'collection.unpublished'::character varying, 'collection.deleted'::character varying, 'collection.transferred_out'::character varying, 'collection.transferred_in'::character varying, 'share.granted'::character varying, 'share.revoked'::character varying, 'link.enabled'::character varying, 'link.rotated'::character varying, 'link.disabled'::character varying, 'hub.handle_changed'::character varying, 'hub.name_changed'::character varying, 'audit.read'::character varying])::text[]))),
    CONSTRAINT audit_role_check CHECK (((role IS NULL) OR ((role)::text = ANY ((ARRAY['reader'::character varying, 'editor'::character varying])::text[]))))
);

CREATE TABLE public.auth_audit (
    id uuid DEFAULT public.app_uuid_v7() NOT NULL,
    user_id uuid,
    action character varying(32) NOT NULL,
    outcome character varying(16) NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE public.capture_receipts (
    user_id uuid NOT NULL,
    operation_id uuid NOT NULL,
    collection_id uuid NOT NULL,
    fingerprint character varying(64) NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE public.collection_comments (
    id uuid DEFAULT public.app_uuid_v7() NOT NULL,
    collection_id uuid NOT NULL,
    author_user_id uuid,
    parent_id uuid,
    body text NOT NULL,
    state character varying(16) DEFAULT 'visible'::character varying NOT NULL,
    accepted boolean DEFAULT false NOT NULL,
    hidden_by_user_id uuid,
    version bigint DEFAULT 1 NOT NULL,
    edited_at timestamp(6) with time zone,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT collection_comments_accepted_reply_check CHECK (((NOT accepted) OR (parent_id IS NOT NULL))),
    CONSTRAINT collection_comments_body_check CHECK (((char_length(body) >= 1) AND (char_length(body) <= 2000))),
    CONSTRAINT collection_comments_state_check CHECK (((state)::text = ANY ((ARRAY['visible'::character varying, 'hidden'::character varying, 'deleted'::character varying])::text[]))),
    CONSTRAINT collection_comments_version_check CHECK ((version > 0))
);

CREATE TABLE public.collection_holds (
    collection_id uuid NOT NULL,
    active boolean DEFAULT true NOT NULL,
    reason character varying(32) NOT NULL,
    actor_user_id uuid NOT NULL,
    updated_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    CONSTRAINT collection_holds_version_check CHECK ((version > 0))
);

CREATE TABLE public.collection_saves (
    collection_id uuid NOT NULL,
    user_id uuid NOT NULL,
    saved_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.collection_shares (
    collection_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role character varying(16) NOT NULL,
    source character varying(16) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT collection_shares_role_check CHECK (((role)::text = ANY ((ARRAY['reader'::character varying, 'editor'::character varying])::text[]))),
    CONSTRAINT collection_shares_source_check CHECK (((source)::text = ANY ((ARRAY['direct'::character varying, 'link'::character varying])::text[])))
);

CREATE TABLE public.collections (
    id uuid DEFAULT public.app_uuid_v7() NOT NULL,
    hub_id uuid NOT NULL,
    slug character varying(120) NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    tags text[] DEFAULT '{}'::text[] NOT NULL,
    published boolean DEFAULT false NOT NULL,
    link_sharing_enabled boolean DEFAULT false NOT NULL,
    share_token_hash character varying(255),
    creator_user_id uuid,
    version bigint DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    comments_enabled boolean DEFAULT true NOT NULL,
    CONSTRAINT collections_link_sharing_requires_token_check CHECK (((NOT link_sharing_enabled) OR (share_token_hash IS NOT NULL)))
);

CREATE TABLE public.email_change_intents (
    user_id uuid NOT NULL,
    session_id uuid NOT NULL,
    current_email text NOT NULL,
    new_email text NOT NULL,
    phase character varying(16) NOT NULL,
    expires_at timestamp(6) with time zone NOT NULL,
    CONSTRAINT email_change_phase CHECK (((phase)::text = ANY ((ARRAY['current'::character varying, 'new'::character varying])::text[])))
);

CREATE TABLE public.email_outbox (
    id uuid DEFAULT public.app_uuid_v7() NOT NULL,
    challenge_key character varying(64) NOT NULL,
    recipient_key character varying(64) NOT NULL,
    payload text,
    state character varying(16) DEFAULT 'pending'::character varying NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    available_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    expires_at timestamp(6) with time zone NOT NULL,
    lease_until timestamp(6) with time zone,
    lease_token uuid,
    provider_id text,
    outcome character varying(24),
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT email_outbox_attempts CHECK ((attempts >= 0)),
    CONSTRAINT email_outbox_state CHECK (((state)::text = ANY ((ARRAY['pending'::character varying, 'sent'::character varying, 'failed'::character varying, 'expired'::character varying, 'cancelled'::character varying, 'suppressed'::character varying])::text[]))),
    CONSTRAINT email_outbox_terminal_payload CHECK ((((state)::text = 'pending'::text) OR (payload IS NULL)))
);

CREATE TABLE public.email_suppressions (
    recipient_key character varying(64) NOT NULL,
    reason character varying(24) NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE public.email_webhooks (
    id text NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE public.hubs (
    id uuid DEFAULT public.app_uuid_v7() NOT NULL,
    owner_user_id uuid NOT NULL,
    handle character varying(60) NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    first_capture_collection_id uuid,
    name character varying(255) DEFAULT 'My hub'::character varying NOT NULL,
    CONSTRAINT hubs_handle_format_check CHECK ((((char_length((handle)::text) >= 3) AND (char_length((handle)::text) <= 60)) AND ((handle)::text ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text))),
    CONSTRAINT hubs_name_nonempty CHECK ((length(btrim((name)::text)) > 0))
);

CREATE TABLE public.operator_audit (
    id uuid DEFAULT public.app_uuid_v7() NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    actor_kind character varying(16) NOT NULL,
    actor_user_id uuid,
    authority character varying(128),
    target_user_id uuid,
    collection_id uuid,
    action character varying(40) NOT NULL,
    reason character varying(32),
    outcome character varying(16) NOT NULL,
    before_state character varying(16),
    after_state character varying(16),
    request_id character varying(64),
    operation_id uuid,
    payload_hash character varying(64),
    result_version integer,
    invitation_id uuid,
    CONSTRAINT operator_audit_actor_check CHECK (((((actor_kind)::text = 'user'::text) AND (actor_user_id IS NOT NULL) AND (authority IS NULL)) OR (((actor_kind)::text = 'deployment'::text) AND (actor_user_id IS NULL) AND (authority IS NOT NULL)) OR (((actor_kind)::text = 'invitee'::text) AND (invitation_id IS NOT NULL) AND (authority IS NOT NULL))))
);

CREATE TABLE public.operator_grants (
    user_id uuid NOT NULL,
    granted_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    authority character varying(128) NOT NULL
);

CREATE TABLE public.request_budgets (
    key character varying(80) NOT NULL,
    count integer NOT NULL,
    expires_at timestamp(6) with time zone NOT NULL,
    CONSTRAINT request_budget_count_check CHECK ((count > 0))
);

CREATE TABLE public.resources (
    id uuid DEFAULT public.app_uuid_v7() NOT NULL,
    collection_id uuid NOT NULL,
    kind character varying(24) NOT NULL,
    url text,
    linked_collection_id uuid,
    title_override character varying(255),
    tags text[] DEFAULT '{}'::text[] NOT NULL,
    "position" integer NOT NULL,
    version bigint DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT resources_collection_link_requirements_check CHECK ((((kind)::text <> 'collection_link'::text) OR (url IS NULL))),
    CONSTRAINT resources_external_requirements_check CHECK ((((kind)::text <> 'external_link'::text) OR ((url IS NOT NULL) AND (linked_collection_id IS NULL)))),
    CONSTRAINT resources_heading_requirements_check CHECK ((((kind)::text <> 'heading'::text) OR ((url IS NULL) AND (linked_collection_id IS NULL) AND (title_override IS NOT NULL) AND (length(btrim((title_override)::text)) > 0)))),
    CONSTRAINT resources_kind_check CHECK (((kind)::text = ANY ((ARRAY['external_link'::character varying, 'collection_link'::character varying, 'heading'::character varying])::text[])))
);

CREATE TABLE public.service_invitations (
    id uuid DEFAULT public.app_uuid_v7() NOT NULL,
    role character varying(16) NOT NULL,
    email character varying(254) NOT NULL,
    invitee_user_id uuid,
    invited_by_id uuid,
    accepted_by_id uuid,
    state character varying(16) DEFAULT 'pending'::character varying NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    delivery_id uuid,
    expires_at timestamp(6) with time zone NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    token_hash character varying(64),
    CONSTRAINT service_invitation_inviter CHECK (((((role)::text = 'admin'::text) AND (invited_by_id IS NULL)) OR (((role)::text = 'operator'::text) AND (invited_by_id IS NOT NULL)))),
    CONSTRAINT service_invitation_role CHECK (((role)::text = ANY ((ARRAY['admin'::character varying, 'operator'::character varying])::text[]))),
    CONSTRAINT service_invitation_state CHECK (((state)::text = ANY ((ARRAY['pending'::character varying, 'verifying'::character varying, 'accepted'::character varying, 'declined'::character varying, 'cancelled'::character varying])::text[]))),
    CONSTRAINT service_invitation_version CHECK ((version > 0))
);

CREATE TABLE public.sessions (
    id uuid DEFAULT public.app_uuid_v7() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    token text NOT NULL,
    ip_address text,
    user_agent text,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    verified_at timestamp(6) with time zone
);

CREATE TABLE public.users (
    id uuid DEFAULT public.app_uuid_v7() NOT NULL,
    name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    email_verified boolean DEFAULT false NOT NULL,
    image text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    account_state character varying(16) DEFAULT 'active'::character varying NOT NULL,
    operations_version integer DEFAULT 1 NOT NULL,
    suspended_at timestamp(6) with time zone,
    suspension_reason character varying(32),
    show_name_on_hub boolean DEFAULT true NOT NULL,
    notifications_cleared_at timestamp(6) with time zone,
    notifications_seen_at timestamp(6) with time zone,
    CONSTRAINT users_account_state_check CHECK (((account_state)::text = ANY ((ARRAY['active'::character varying, 'suspended'::character varying])::text[]))),
    CONSTRAINT users_operations_version_check CHECK ((operations_version > 0))
);

CREATE TABLE public.verifications (
    id uuid DEFAULT public.app_uuid_v7() NOT NULL,
    identifier text NOT NULL,
    value text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.admin_bootstrap
    ADD CONSTRAINT admin_bootstrap_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.admin_grants
    ADD CONSTRAINT admin_grants_pkey PRIMARY KEY (user_id);

ALTER TABLE ONLY public.audit_records
    ADD CONSTRAINT audit_records_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.auth_audit
    ADD CONSTRAINT auth_audit_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.capture_receipts
    ADD CONSTRAINT capture_receipts_pkey PRIMARY KEY (user_id, operation_id);

ALTER TABLE ONLY public.collection_comments
    ADD CONSTRAINT collection_comments_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.collection_holds
    ADD CONSTRAINT collection_holds_pkey PRIMARY KEY (collection_id);

ALTER TABLE ONLY public.collection_saves
    ADD CONSTRAINT collection_saves_pkey PRIMARY KEY (collection_id, user_id);

ALTER TABLE ONLY public.collection_shares
    ADD CONSTRAINT collection_shares_pkey PRIMARY KEY (collection_id, user_id);

ALTER TABLE ONLY public.collections
    ADD CONSTRAINT collections_hub_slug_unique UNIQUE (hub_id, slug);

ALTER TABLE ONLY public.collections
    ADD CONSTRAINT collections_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.email_change_intents
    ADD CONSTRAINT email_change_intents_pkey PRIMARY KEY (user_id);

ALTER TABLE ONLY public.email_outbox
    ADD CONSTRAINT email_outbox_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.email_suppressions
    ADD CONSTRAINT email_suppressions_pkey PRIMARY KEY (recipient_key);

ALTER TABLE ONLY public.email_webhooks
    ADD CONSTRAINT email_webhooks_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.hubs
    ADD CONSTRAINT hubs_handle_key UNIQUE (handle);

ALTER TABLE ONLY public.hubs
    ADD CONSTRAINT hubs_owner_user_id_key UNIQUE (owner_user_id);

ALTER TABLE ONLY public.hubs
    ADD CONSTRAINT hubs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.operator_audit
    ADD CONSTRAINT operator_audit_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.operator_grants
    ADD CONSTRAINT operator_grants_pkey PRIMARY KEY (user_id);

ALTER TABLE ONLY public.request_budgets
    ADD CONSTRAINT request_budgets_pkey PRIMARY KEY (key);

ALTER TABLE ONLY public.resources
    ADD CONSTRAINT resources_collection_position_unique UNIQUE (collection_id, "position");

ALTER TABLE ONLY public.resources
    ADD CONSTRAINT resources_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.service_invitations
    ADD CONSTRAINT service_invitations_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.verifications
    ADD CONSTRAINT verifications_pkey PRIMARY KEY (id);

CREATE INDEX auth_audit_created_at_idx ON public.auth_audit USING btree (created_at);

CREATE UNIQUE INDEX collection_comments_one_answer ON public.collection_comments USING btree (parent_id) WHERE accepted;

CREATE INDEX email_change_intents_expires_at_idx ON public.email_change_intents USING btree (expires_at);

CREATE INDEX email_outbox_challenge_key_idx ON public.email_outbox USING btree (challenge_key);

CREATE INDEX email_outbox_expires_at_idx ON public.email_outbox USING btree (expires_at);

CREATE UNIQUE INDEX email_outbox_provider_id_key ON public.email_outbox USING btree (provider_id);

CREATE INDEX email_outbox_state_available_at_idx ON public.email_outbox USING btree (state, available_at);

CREATE INDEX idx_accounts_user_id ON public.accounts USING btree (user_id);

CREATE INDEX idx_audit_hub_created ON public.audit_records USING btree (hub_id, created_at DESC, id DESC);

CREATE INDEX idx_collection_comments_collection_created ON public.collection_comments USING btree (collection_id, created_at DESC);

CREATE INDEX idx_collection_comments_parent_created ON public.collection_comments USING btree (parent_id, created_at);

CREATE INDEX idx_collection_saves_user_id ON public.collection_saves USING btree (user_id);

CREATE INDEX idx_collection_shares_user_id ON public.collection_shares USING btree (user_id);

CREATE INDEX idx_collections_published_updated_at ON public.collections USING btree (published, updated_at DESC);

CREATE INDEX idx_request_budgets_expires ON public.request_budgets USING btree (expires_at);

CREATE INDEX idx_resources_collection_updated_at ON public.resources USING btree (collection_id, updated_at DESC);

CREATE INDEX idx_sessions_user_id ON public.sessions USING btree (user_id);

CREATE INDEX idx_verifications_identifier ON public.verifications USING btree (identifier);

CREATE UNIQUE INDEX operator_audit_actor_user_id_operation_id_key ON public.operator_audit USING btree (actor_user_id, operation_id);

CREATE UNIQUE INDEX operator_audit_authority_operation_id_key ON public.operator_audit USING btree (authority, operation_id);

CREATE INDEX operator_audit_collection_id_created_at_idx ON public.operator_audit USING btree (collection_id, created_at DESC);

CREATE INDEX operator_audit_created_at_id_idx ON public.operator_audit USING btree (created_at DESC, id DESC);

CREATE INDEX operator_audit_target_user_id_created_at_idx ON public.operator_audit USING btree (target_user_id, created_at DESC);

CREATE INDEX service_invitations_created_at_id_idx ON public.service_invitations USING btree (created_at DESC, id DESC);

CREATE INDEX service_invitations_email_state_idx ON public.service_invitations USING btree (email, state);

CREATE INDEX service_invitations_invited_by_id_state_idx ON public.service_invitations USING btree (invited_by_id, state);

CREATE UNIQUE INDEX service_invitations_pending_email ON public.service_invitations USING btree (email) WHERE ((state)::text = ANY ((ARRAY['pending'::character varying, 'verifying'::character varying])::text[]));

CREATE UNIQUE INDEX service_invitations_token_hash_key ON public.service_invitations USING btree (token_hash);

CREATE UNIQUE INDEX sessions_token_key ON public.sessions USING btree (token);

CREATE UNIQUE INDEX uq_resources_collection_url ON public.resources USING btree (collection_id, md5(url)) WHERE (url IS NOT NULL);

CREATE TRIGGER collection_comments_set_updated_at BEFORE UPDATE ON public.collection_comments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER collection_holds_set_updated_at BEFORE UPDATE ON public.collection_holds FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER service_invitations_set_updated_at BEFORE UPDATE ON public.service_invitations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_set_updated_at_collection_shares BEFORE UPDATE ON public.collection_shares FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_set_updated_at_collections BEFORE UPDATE ON public.collections FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_set_updated_at_hubs BEFORE UPDATE ON public.hubs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_set_updated_at_resources BEFORE UPDATE ON public.resources FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_set_updated_at_users BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.admin_grants
    ADD CONSTRAINT admin_grants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.collection_comments
    ADD CONSTRAINT collection_comments_author_user_id_fkey FOREIGN KEY (author_user_id) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.collection_comments
    ADD CONSTRAINT collection_comments_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES public.collections(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.collection_comments
    ADD CONSTRAINT collection_comments_hidden_by_user_id_fkey FOREIGN KEY (hidden_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.collection_comments
    ADD CONSTRAINT collection_comments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.collection_comments(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.collection_holds
    ADD CONSTRAINT collection_holds_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES public.collections(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.collection_saves
    ADD CONSTRAINT collection_saves_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES public.collections(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.collection_saves
    ADD CONSTRAINT collection_saves_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.collection_shares
    ADD CONSTRAINT collection_shares_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES public.collections(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.collection_shares
    ADD CONSTRAINT collection_shares_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.collections
    ADD CONSTRAINT collections_creator_user_id_fkey FOREIGN KEY (creator_user_id) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.collections
    ADD CONSTRAINT collections_hub_id_fkey FOREIGN KEY (hub_id) REFERENCES public.hubs(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.hubs
    ADD CONSTRAINT hubs_first_capture_collection_id_fkey FOREIGN KEY (first_capture_collection_id) REFERENCES public.collections(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.hubs
    ADD CONSTRAINT hubs_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.operator_grants
    ADD CONSTRAINT operator_grants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.resources
    ADD CONSTRAINT resources_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES public.collections(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.resources
    ADD CONSTRAINT resources_linked_collection_id_fkey FOREIGN KEY (linked_collection_id) REFERENCES public.collections(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
