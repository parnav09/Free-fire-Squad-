#!/usr/bin/env bash
set -euo pipefail

: "${SUPABASE_DB_URL:?Set SUPABASE_DB_URL to the project's direct or session-pooler connection string in a secure environment}"
command -v supabase >/dev/null 2>&1 || {
  echo "Supabase CLI is required. Install it using the official Supabase CLI instructions." >&2
  exit 1
}

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="${1:-$ROOT/docs/evolution/baselines/current-remote-public-schema.sql}"
mkdir -p "$(dirname "$OUT")"

# Schema-only export. Do not add --data-only or --role-only.
supabase db dump --db-url "$SUPABASE_DB_URL" -f "$OUT"

if ! grep -Eq 'CREATE TABLE|CREATE TYPE|CREATE FUNCTION' "$OUT"; then
  echo "Schema export looks empty; refusing to report a baseline." >&2
  exit 1
fi

echo "Schema-only export written to $OUT"
echo "Review it for project-specific objects before committing. No production data is exported."
