import { Pool } from "pg";
const globalDb = globalThis as unknown as {
  pool?: Pool;
  ready?: Promise<void>;
};
export const pool = (globalDb.pool ??= new Pool({
  connectionString: process.env.DATABASE_URL,
}));
export async function db() {
  globalDb.ready ??= (async () => {
    const c = await pool.connect();
    try {
      await c.query("BEGIN");
      await c.query("SELECT pg_advisory_xact_lock(748391)");
      await c.query(`
        CREATE TABLE IF NOT EXISTS projects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, description text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now());
        CREATE TABLE IF NOT EXISTS teams (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL);
        CREATE TABLE IF NOT EXISTS members (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, team_id uuid REFERENCES teams(id));
        CREATE TABLE IF NOT EXISTS tasks (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL REFERENCES projects(id), title text NOT NULL, description text NOT NULL DEFAULT '', status text NOT NULL DEFAULT 'To do' CHECK (status IN ('To do','In progress','Blocked','Completed','Dropped')), priority text NOT NULL DEFAULT 'Medium', member_id uuid REFERENCES members(id), team_id uuid REFERENCES teams(id), assigned_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
        CREATE TABLE IF NOT EXISTS modules (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE, name text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(id,project_id));
        ALTER TABLE tasks ADD COLUMN IF NOT EXISTS module_id uuid;
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='tasks_module_project_fk' AND conrelid='tasks'::regclass) THEN
            ALTER TABLE tasks ADD CONSTRAINT tasks_module_project_fk FOREIGN KEY(module_id,project_id) REFERENCES modules(id,project_id);
          END IF;
        END $$;
        CREATE INDEX IF NOT EXISTS tasks_module_idx ON tasks(module_id);
        CREATE INDEX IF NOT EXISTS modules_project_idx ON modules(project_id);
        CREATE TABLE IF NOT EXISTS my_days (task_id uuid REFERENCES tasks(id) ON DELETE CASCADE, day date NOT NULL, PRIMARY KEY(task_id, day));
        CREATE TABLE IF NOT EXISTS attachments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE, name text NOT NULL, content bytea NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
        CREATE TABLE IF NOT EXISTS events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE, kind text NOT NULL, message text NOT NULL, attachment_id uuid REFERENCES attachments(id), created_at timestamptz NOT NULL DEFAULT now());
        CREATE INDEX IF NOT EXISTS events_task_idx ON events(task_id, created_at);
        CREATE INDEX IF NOT EXISTS tasks_project_idx ON tasks(project_id);
      `);
      await c.query("COMMIT");
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      c.release();
    }
  })().catch((e) => {
    globalDb.ready = undefined;
    throw e;
  });
  await globalDb.ready;
  return pool;
}
