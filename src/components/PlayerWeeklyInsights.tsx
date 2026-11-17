type Member={user_id:string;display_name:string;player_number:number|null;assigned_role:string|null;status:string};
type Assignment={id:string;player_id:string;drill_title:string;due_date:string;status:string;drill_description:string|null};
type Evaluation={id:string;player_id:string;score_date:string;created_at?:string;communication:number|null;coordination:number|null;decision_making:number|null;role_execution:number|null;map_awareness:number|null;total:number|null;improvement_target:string|null;notes:string|null};
type Props={members:Member[];assignments:Assignment[];evaluations:Evaluation[]};
const score=(e:Evaluation):number|null=>{
 const values=[e.communication,e.coordination,e.decision_making,e.role_execution,e.map_awareness];
 if(!values.every(v=>Number.isInteger(v)&&v!==null&&v>=0&&v<=10))return null;
 // Recompute from complete raw dimensions; never trust a stale or malformed cached total.
 return values.reduce<number>((sum,value)=>sum+(value??0),0);
};
const byNewest=(a:Evaluation,b:Evaluation)=>
 b.score_date.localeCompare(a.score_date)||
 (b.created_at??"").localeCompare(a.created_at??"")||
 b.id.localeCompare(a.id);

export default function PlayerWeeklyInsights({members,assignments,evaluations}:Props){
 const active=members.filter(m=>m.status==="active");
 const ordered=[...evaluations].sort(byNewest);
 const valid=ordered.filter(e=>score(e)!==null);
 const forPlayer=(id:string)=>valid.filter(e=>e.player_id===id);
 const latest=(id:string)=>forPlayer(id)[0];
 const previous=(id:string)=>forPlayer(id)[1];
 const avg=(id:string):number|null=>{
  const rows=forPlayer(id).slice(0,4).map(score).filter((v):v is number=>v!==null);
  return rows.length?Math.round(rows.reduce((sum,value)=>sum+value,0)/rows.length):null;
 };
 const playerAverages=active.map(m=>avg(m.user_id)).filter((value):value is number=>value!==null);
 const rosterAverage=playerAverages.length
  ? Math.round(playerAverages.reduce((sum,value)=>sum+value,0)/playerAverages.length)
  : null;
 const completed=assignments.filter(a=>a.status==="completed").length;
 const pending=assignments.filter(a=>a.status!=="completed").length;
 return <div className="pwi">
  <div className="pwi-hero"><div><span className="pwi-kicker">LEGACY SNAPSHOT · EVOLUTION ROADMAP</span><h2>Player development snapshot</h2><p>This is the existing read-only view, not the final Weekly Review or Player Trends experience.</p></div><div className="pwi-orb">E<span>VOL</span></div></div>
  <div className="pwi-kpis">
   <article><small>Legacy assignments complete</small><strong>{completed}<i>/{assignments.length}</i></strong><div className="pwi-track"><span style={{width:(assignments.length?completed/assignments.length*100:0)+"%"}}/></div></article>
   <article><small>Open legacy assignments</small><strong>{pending}</strong><span className="pwi-caption">Existing records only</span></article>
   <article><small>Valid evaluation records</small><strong>{valid.length}</strong><span className="pwi-caption">{evaluations.length-valid.length} incomplete / unscored excluded</span></article>
   <article><small>Active roster</small><strong>{active.length}</strong><span className="pwi-caption">Current team members</span></article>
  </div>
  <section className="pwi-panel">
   <header><div><span className="pwi-kicker">LEGACY REVIEW DATA</span><h3>Team snapshot</h3></div><span className="pwi-chip">READ ONLY</span></header>
   <div className="pwi-review-grid">
    <div className="pwi-review-stat"><strong>{rosterAverage===null?"—":rosterAverage}<small>/50</small></strong><span>Recent average · evaluated players only</span><small>{playerAverages.length}/{active.length} active players have valid observations</small></div>
    <div><b>{pending?pending+" legacy assignments remain open":"No open legacy assignments"}</b><p>Missing or incomplete evaluations are excluded from averages; they are never treated as zero. This summary uses each player's latest four valid records, not a published weekly review.</p></div>
   </div>
   <div className="pwi-focus">{active.slice(0,4).map(m=>{const e=latest(m.user_id);const value=e?score(e):null;return <div key={m.user_id}><span>{m.player_number?"P"+m.player_number:"—"}</span><b>{m.display_name}</b><small>{e?.improvement_target||"No improvement target saved"}</small><strong>{value===null?"Not enough data":value+"/50"}</strong></div>})}</div>
  </section>
  <section className="pwi-panel">
   <header><div><span className="pwi-kicker">LEGACY TASK PATH</span><h3>Existing assignments preserved</h3></div><span className="pwi-chip">NO NEW BATCHES</span></header>
   <p className="pwi-muted">The old assignment records remain visible and unchanged. Generic weekly batch creation is paused because it creates a second task system. A single reconciled development-task workflow belongs to Evolution Phase Six; no history is deleted in this phase.</p>
  </section>
  <section className="pwi-panel">
   <header><div><span className="pwi-kicker">LEGACY TREND PREVIEW</span><h3>Latest valid observations</h3></div><span className="pwi-chip">READ ONLY</span></header>
   <div className="pwi-trends">{active.map(m=>{const e=latest(m.user_id),p=previous(m.user_id),v=e?score(e):null,pv=p?score(p):null,delta=v!==null&&pv!==null?v-pv:null;return <article key={m.user_id}><div className="pwi-player"><span>P{m.player_number||"—"}</span><b>{m.display_name}</b><small>{m.assigned_role||"Role pending"}</small></div><div className="pwi-bars"><span style={{height:(v===null?0:Math.max(0,Math.min(100,v/50*100)))+"%"}} title={v===null?"No valid observation":"Latest "+v}/><span className="pwi-prev" style={{height:(pv===null?0:Math.max(0,Math.min(100,pv/50*100)))+"%"}} title={pv===null?"No previous valid observation":"Previous "+pv}/></div><strong>{v===null?"No data":v+"/50"}</strong><em className={delta===null?"":delta>=0?"up":"down"}>{delta===null?"—":(delta>0?"+":"")+delta}</em><small>{e?.score_date||"No valid observation"}</small></article>})}</div>
   <p className="pwi-legend"><span/> Latest valid record <span className="pwi-legend-prev"/> Previous valid record · 0–50 legacy five-dimension scale.</p>
   <p className="pwi-muted">Separate Weekly Review and Player Trends workflows, date filters, dimension-level trends, coverage and comparability are reserved for Evolution Phase Seven and Evolution Phase Eight.</p>
  </section>
 </div>;
}
