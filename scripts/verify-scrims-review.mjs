import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const migration = read("supabase/migrations/20261120190000_scrims_private_reviews_team_collaboration.sql");
const scrims = read("src/components/ScrimsSection.tsx");
const collaboration = read("src/components/ScrimTeamCollaboration.tsx");
const app = read("src/App.tsx");

assert.ok(migration.indexOf("insert into public.scrim_personal_reviews") < migration.indexOf("drop column personal_review"),
  "legacy private reviews must be copied before the shared column is dropped");
assert.match(migration, /alter table public\.scrim_records drop column personal_review/i);
assert.match(migration, /owners read own scrim personal reviews[\s\S]*?owner_id = \(select auth\.uid\(\)\)/i);
assert.match(migration, /team members add scrim review comments[\s\S]*?author_id = \(select auth\.uid\(\)\)/i);
assert.match(migration, /team leads create scrim review tasks[\s\S]*?membership_role in \('owner','coach'\)/i);
assert.match(migration, /team leads or assignees update scrim review tasks/i);
assert.match(migration, /assignee\.status = 'active'/i);

assert.match(scrims, /from\("scrim_records"\)\.select\("id,team_id,owner_id,scrim_date,match_count,matches,overall_rank,total_teams,created_at"\)/);
assert.match(scrims, /from\("scrim_personal_reviews"\)/);
assert.doesNotMatch(scrims, /from\("scrim_records"\)\.select\("\*"\)/);
assert.match(scrims, /This reflection is private to the record owner/);
assert.match(scrims, /Average match placement/);
assert.match(scrims, /ScrimTeamCollaboration/);

assert.match(collaboration, /scrim_team_review_comments/);
assert.match(collaboration, /scrim_review_tasks/);
assert.match(collaboration, /addComment/);
assert.match(collaboration, /addTask/);
assert.match(collaboration, /updateTaskStatus/);
assert.match(collaboration, /task\.assigned_to === userId/);

assert.match(app, /placement: number \| null/);
assert.match(app, /<option value="">Unscored<\/option>/);
assert.match(app, /match\.placement === null && match\.kills === 0/);
assert.match(app, /setSharedMatches\(previous =>/);
assert.match(app, /saveMatch\(key,"kills",raw===""\?0:/);

console.log("Scrims privacy, collaboration, analytics and Tournament edge-case contracts: PASS");

assert.equal(migration.split("do $$").length - 1, 3, "all migration DO blocks must use valid dollar delimiters");
assert.equal(migration.split("$$;").length - 1, 3, "all migration DO blocks must close their dollar delimiters");
assert.doesNotMatch(migration, /updated_at timestamptz not null default now\(\),\s*\);/, "trailing comma in table definition found");
