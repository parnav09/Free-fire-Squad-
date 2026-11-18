import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const forward = await readFile(new URL("docs/evolution/staged-migrations/20261118070000_team_timezone_contract.sql", root), "utf8");
const rollback = await readFile(new URL("docs/evolution/staged-migrations/20261118070000_team_timezone_contract.rollback.sql", root), "utf8");

test("E Phase One.5-B: every team timezone write is guarded by a server-side validation trigger", () => {
  assert.match(forward, /CREATE OR REPLACE FUNCTION public\.validate_team_timezone\(\)/);
  assert.match(forward, /pg_catalog\.pg_timezone_names/);
  assert.match(forward, /BEFORE INSERT OR UPDATE OF timezone ON public\.teams/);
});

test("E Phase One.5-B: Daily Evaluation date is derived from the selected team's timezone", () => {
  assert.match(forward, /CREATE OR REPLACE FUNCTION public\.set_daily_score_team_local_date\(\)/);
  assert.match(forward, /BEFORE INSERT ON public\.daily_scores/);
  assert.match(forward, /now\(\) AT TIME ZONE v_timezone/);
  assert.match(forward, /SELECT t\.timezone[\s\S]*FROM public\.teams AS t[\s\S]*WHERE t\.id = NEW\.team_id/);
  assert.doesNotMatch(forward, /Asia\/Kolkata/);
});

test("E Phase One.5-B: new trigger functions remain SECURITY INVOKER and preserve anonymization trigger", () => {
  assert.doesNotMatch(forward, /SECURITY\s+DEFINER/i);
  assert.match(forward, /daily_scores_lock_date_anonymous/);
  assert.match(forward, /evaluator_id IS NULL/);
  assert.match(forward, /can_rate\(team_id, player_id\)/);
});

test("E Phase One.5-C: rollback restores the exact old policy date predicate and removes only new objects", () => {
  assert.match(rollback, /score_date = \(\(now\(\) AT TIME ZONE 'Asia\/Kolkata'::text\)\)::date/);
  assert.match(rollback, /DROP TRIGGER IF EXISTS trg_daily_scores_team_timezone_date/);
  assert.match(rollback, /DROP FUNCTION IF EXISTS public\.set_daily_score_team_local_date\(\)/);
  assert.match(rollback, /DROP TRIGGER IF EXISTS teams_validate_timezone/);
  assert.match(rollback, /DROP FUNCTION IF EXISTS public\.validate_team_timezone\(\)/);
});

test("E Phase One.5-C: migration does not rewrite historical evaluation rows", () => {
  assert.doesNotMatch(forward, /UPDATE\s+public\.daily_scores/i);
  assert.doesNotMatch(rollback, /UPDATE\s+public\.daily_scores/i);
});

test("E Phase One.5-E: staged SQL is not silently promoted into the active Supabase migration chain", async () => {
  const { access } = await import("node:fs/promises");
  await assert.rejects(access(new URL("../supabase/migrations/20261118070000_team_timezone_contract.sql", import.meta.url)));
});
