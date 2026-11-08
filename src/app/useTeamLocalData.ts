import { useEffect, useState } from "react";
import { currentISOWeekKey, initialPlayers, readPlayers, type Player } from "./foundation-utils";

type MatchRecord = Record<string, { placement: number; kills: number }>;
type NotesRecord = Record<string, string>;

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Owns the team-scoped local records and one-time legacy migration. */
export default function useTeamLocalData(teamId?: string) {
  const [players, setPlayers] = useState<Player[]>(readPlayers);
  const [week, setWeek] = useState(() => localStorage.getItem("squad-os-week") || currentISOWeekKey());
  const [day, setDay] = useState(() => Number(localStorage.getItem("squad-os-day") || 1));
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
    const migrateLegacy = localStorage.getItem("squad-os-legacy-local-migrated") !== "1";
    const readScoped = <T,>(key: string, fallback: T): T => readJson(prefix + key, fallback);

    setPlayers(readScoped("roster", migrateLegacy ? players : initialPlayers));
    setWeek(readScoped("week", migrateLegacy ? week : currentISOWeekKey()));
    setDay(readScoped("day", migrateLegacy ? day : 1));
    setMatches(readScoped("matches", migrateLegacy ? matches : {}));
    setDrillDone(readScoped("drills", migrateLegacy ? drillDone : {}));
    setNotes(readScoped("notes", migrateLegacy ? notes : {}));
    if (migrateLegacy) localStorage.setItem("squad-os-legacy-local-migrated", "1");
    setHydratedFor(teamId);
  }, [teamId]);

  useEffect(() => { if (teamId && hydratedFor === teamId) localStorage.setItem("squad-os:" + teamId + ":roster", JSON.stringify(players)); }, [players, teamId, hydratedFor]);
  useEffect(() => { if (teamId && hydratedFor === teamId) localStorage.setItem("squad-os:" + teamId + ":week", JSON.stringify(week)); }, [week, teamId, hydratedFor]);
  useEffect(() => { if (teamId && hydratedFor === teamId) localStorage.setItem("squad-os:" + teamId + ":day", JSON.stringify(day)); }, [day, teamId, hydratedFor]);
  useEffect(() => { if (teamId && hydratedFor === teamId) localStorage.setItem("squad-os:" + teamId + ":matches", JSON.stringify(matches)); }, [matches, teamId, hydratedFor]);
  useEffect(() => { if (teamId && hydratedFor === teamId) localStorage.setItem("squad-os:" + teamId + ":drills", JSON.stringify(drillDone)); }, [drillDone, teamId, hydratedFor]);
  useEffect(() => { if (teamId && hydratedFor === teamId) localStorage.setItem("squad-os:" + teamId + ":notes", JSON.stringify(notes)); }, [notes, teamId, hydratedFor]);

  return { players, setPlayers, week, setWeek, day, setDay, matches, setMatches, drillDone, setDrillDone, notes, setNotes, hydratedFor };
}
