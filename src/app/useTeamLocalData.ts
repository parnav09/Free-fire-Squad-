import { useEffect, useState } from "react";
import {
  currentISOWeekKey,
  initialPlayers,
  readPlayers,
  safeStorageGetItem,
  safeStorageSetItem,
  type Player,
} from "./foundation-utils";

type MatchRecord = Record<string, { placement: number; kills: number }>;
type NotesRecord = Record<string, string>;

function readJson<T>(key: string, fallback: T): T {
  const raw = safeStorageGetItem(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Owns team-scoped local records and performs a retry-safe one-time legacy migration. */
export default function useTeamLocalData(teamId?: string) {
  const [players, setPlayers] = useState<Player[]>(readPlayers);
  const [week, setWeek] = useState(() => safeStorageGetItem("squad-os-week") || currentISOWeekKey());
  const [day, setDay] = useState(() => {
    const value = Number(safeStorageGetItem("squad-os-day") || 1);
    return Number.isInteger(value) && value >= 1 && value <= 7 ? value : 1;
  });
  const [matches, setMatches] = useState<MatchRecord>(() => readJson("squad-os-matches", {}));
  const [drillDone, setDrillDone] = useState<Record<string, boolean>>(() => readJson("squad-os-drills", {}));
  const [notes, setNotes] = useState<NotesRecord>(() => readJson("squad-os-notes", {}));
  const [hydratedFor, setHydratedFor] = useState("");

  useEffect(() => {
    if (!teamId) {
      setHydratedFor("");
      return;
    }

    const prefix = "squad-os:" + teamId + ":";
    const migrateLegacy = safeStorageGetItem("squad-os-legacy-local-migrated") !== "1";
    let migrationComplete = true;

    const readScoped = <T,>(key: string, legacyValue: T, fallback: T): T => {
      const raw = safeStorageGetItem(prefix + key);
      if (raw !== null) {
        try {
          return JSON.parse(raw) as T;
        } catch {
          return fallback;
        }
      }

      const value = migrateLegacy ? legacyValue : fallback;
      if (migrateLegacy && !safeStorageSetItem(prefix + key, JSON.stringify(value))) {
        migrationComplete = false;
      }
      return value;
    };

    setPlayers(readScoped("roster", players, initialPlayers));
    setWeek(readScoped("week", week, currentISOWeekKey()));
    setDay(readScoped("day", day, 1));
    setMatches(readScoped("matches", matches, {}));
    setDrillDone(readScoped("drills", drillDone, {}));
    setNotes(readScoped("notes", notes, {}));

    if (migrateLegacy && migrationComplete) {
      safeStorageSetItem("squad-os-legacy-local-migrated", "1");
    }
    setHydratedFor(teamId);
  }, [teamId]);

  useEffect(() => {
    if (teamId && hydratedFor === teamId) safeStorageSetItem("squad-os:" + teamId + ":roster", JSON.stringify(players));
  }, [players, teamId, hydratedFor]);
  useEffect(() => {
    if (teamId && hydratedFor === teamId) safeStorageSetItem("squad-os:" + teamId + ":week", JSON.stringify(week));
  }, [week, teamId, hydratedFor]);
  useEffect(() => {
    if (teamId && hydratedFor === teamId) safeStorageSetItem("squad-os:" + teamId + ":day", JSON.stringify(day));
  }, [day, teamId, hydratedFor]);
  useEffect(() => {
    if (teamId && hydratedFor === teamId) safeStorageSetItem("squad-os:" + teamId + ":matches", JSON.stringify(matches));
  }, [matches, teamId, hydratedFor]);
  useEffect(() => {
    if (teamId && hydratedFor === teamId) safeStorageSetItem("squad-os:" + teamId + ":drills", JSON.stringify(drillDone));
  }, [drillDone, teamId, hydratedFor]);
  useEffect(() => {
    if (teamId && hydratedFor === teamId) safeStorageSetItem("squad-os:" + teamId + ":notes", JSON.stringify(notes));
  }, [notes, teamId, hydratedFor]);

  return {
    players, setPlayers, week, setWeek, day, setDay, matches, setMatches,
    drillDone, setDrillDone, notes, setNotes, hydratedFor,
  };
}
