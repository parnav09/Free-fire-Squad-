/** Small, behavior-preserving helpers used by the application shell. */
type Player = { id: string; name: string; role: string; status: string };
const initialPlayers: Player[] = [
  { id: "P1", name: "Player 1", role: "Primary Rusher", status: "Active" },
  { id: "P2", name: "Player 2", role: "Secondary Rusher", status: "Active" },
  { id: "P3", name: "Player 3", role: "Third Rusher", status: "Active" },
  { id: "P4", name: "Player 4", role: "Sniper", status: "Active" },
];

async function makeSquareTeamLogo(file: File, x: number, y: number): Promise<File> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => { const img = new Image(); img.onload=()=>resolve(img); img.onerror=reject; img.src=URL.createObjectURL(file); });
  const side=Math.min(image.naturalWidth,image.naturalHeight), sx=(image.naturalWidth-side)*(x/100), sy=(image.naturalHeight-side)*(y/100);
  const canvas=document.createElement("canvas");canvas.width=512;canvas.height=512;const ctx=canvas.getContext("2d");if(!ctx)throw new Error("Image crop is unavailable.");
  ctx.drawImage(image,sx,sy,side,side,0,0,512,512);URL.revokeObjectURL(image.src);
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error("Could not crop image.")),"image/jpeg",.88));
  return new File([blob],"team-logo.jpg",{type:"image/jpeg"});
}
function currentISOWeekKey(date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const weekday = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - weekday);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function readPlayers(): Player[] {
  try { const v = localStorage.getItem("squad-os-roster"); return v ? JSON.parse(v) : initialPlayers; }
  catch { return initialPlayers; }
}

