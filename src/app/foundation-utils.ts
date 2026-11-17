/** Small, behavior-preserving helpers used by the application shell. */
export type Player = { id: string; name: string; role: string; status: string };

export const initialPlayers: Player[] = [
  { id: "P1", name: "Player 1", role: "Primary Rusher", status: "Active" },
  { id: "P2", name: "Player 2", role: "Secondary Rusher", status: "Active" },
  { id: "P3", name: "Player 3", role: "Third Rusher", status: "Active" },
  { id: "P4", name: "Player 4", role: "Sniper", status: "Active" },
];

/** Browser storage can be unavailable (private mode, quota, sandbox or policy). */
export function safeStorageGetItem(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeStorageSetItem(key: string, value: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function safeStorageRemoveItem(key: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export async function makeSquareTeamLogo(file: File, x: number, y: number): Promise<File> {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file for the team logo.");

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("The selected image could not be read."));
      img.src = objectUrl;
    });

    if (!image.naturalWidth || !image.naturalHeight) {
      throw new Error("The selected image has no usable dimensions.");
    }

    const cropX = Math.min(100, Math.max(0, Number.isFinite(x) ? x : 50)) / 100;
    const cropY = Math.min(100, Math.max(0, Number.isFinite(y) ? y : 50)) / 100;
    const side = Math.min(image.naturalWidth, image.naturalHeight);
    const sx = (image.naturalWidth - side) * cropX;
    const sy = (image.naturalHeight - side) * cropY;
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;

    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image crop is unavailable.");
    context.drawImage(image, sx, sy, side, side, 0, 0, 512, 512);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => result
          ? resolve(result)
          : reject(new Error("Could not crop image.")),
        "image/jpeg",
        0.88,
      );
    });

    return new File([blob], "team-logo.jpg", { type: "image/jpeg" });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function currentISOWeekKey(date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const weekday = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - weekday);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function isPlayerArray(value: unknown): value is Player[] {
  return Array.isArray(value) && value.every((item) =>
    item !== null
    && typeof item === "object"
    && typeof (item as Player).id === "string"
    && typeof (item as Player).name === "string"
    && typeof (item as Player).role === "string"
    && typeof (item as Player).status === "string",
  );
}

export function readPlayers(): Player[] {
  const raw = safeStorageGetItem("squad-os-roster");
  if (raw === null) return initialPlayers;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isPlayerArray(parsed) ? parsed : initialPlayers;
  } catch {
    return initialPlayers;
  }
}
