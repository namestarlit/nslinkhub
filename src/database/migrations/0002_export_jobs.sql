BEGIN;

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

COMMIT;
