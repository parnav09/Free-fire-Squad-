import { useMemo, useState } from "react";
import "./PlayerEvaluationRubric.css";

type RatingKey = "coordination" | "communication" | "tradeSupport" | "decisionMaking" | "positioning" | "consistency";
type Ratings = Record<RatingKey, number>;
const dimensions: {key:RatingKey;label:string;hint:string}[] = [
 {key:"coordination",label:"Squad coordination",hint:"Moves, timings and actions align with teammates"},
 {key:"communication",label:"Communication",hint:"Calls are clear, timely, accurate and acknowledged"},
 {key:"tradeSupport",label:"Trade & backup",hint:"Maintains support distance and converts teammate contact"},
 {key:"decisionMaking",label:"Decision quality",hint:"Fight, reset, rotate and regroup decisions"},
 {key:"positioning",label:"Positioning",hint:"Angles, spacing, cover and zone awareness"},
 {key:"consistency",label:"Consistency",hint:"Repeats the standard across rounds and situations"},
];
const initial:Ratings={coordination:5,communication:5,tradeSupport:5,decisionMaking:5,positioning:5,consistency:5};
export type PlayerEvaluationDraft={ratings:Ratings;overall:number;strengths:string;improvement:string;nextAction:string};
export default function PlayerEvaluationRubric({playerName,onSave,onCancel,loading=false}:{playerName:string;onSave:(draft:PlayerEvaluationDraft)=>void;onCancel?:()=>void;loading?:boolean}){
 const [ratings,setRatings]=useState<Ratings>(initial);
 const [rated,setRated]=useState<Partial<Record<RatingKey,boolean>>>({});
 const [strengths,setStrengths]=useState("");const [improvement,setImprovement]=useState("");const [nextAction,setNextAction]=useState("");
 const overall=useMemo(()=>Math.round(Object.values(ratings).reduce((a,b)=>a+b,0)/dimensions.length),[ratings]);
 const complete=dimensions.every(d=>rated[d.key]===true);
 const set=(key:RatingKey,value:number)=>{setRatings(p=>({...p,[key]:Math.max(1,Math.min(10,value))}));setRated(p=>({...p,[key]:true}));};
 return <section className="eval-rubric-card" aria-label="Player performance evaluation">
  <header className="eval-rubric-head"><div><span className="eval-eyebrow">PLAYER REVIEW · 1–10</span><h3>{playerName}</h3><p>Score observed behavior—not the match result alone.</p></div><div className="eval-overall"><strong>{complete?overall:"—"}</strong><span>/10</span><small>AVERAGE</small></div></header>
  <p className="eval-disclaimer">Legacy training rubric. Every dimension must be explicitly selected; the initial slider position is not a saved rating. The canonical versioned rubric belongs to Evolution Phase Three.</p>
  <div className="eval-scale-note"><span>1 · Needs focus</span><span>5 · Developing</span><span>10 · Consistent</span></div>
  <div className="eval-dimensions">{dimensions.map(d=><div className="eval-dimension" key={d.key}><div className="eval-dimension-copy"><div><b>{d.label}</b><small>{d.hint}</small></div><output>{rated[d.key]?ratings[d.key]:"Not rated"}<span>{rated[d.key]?"/10":""}</span></output></div><input aria-label={d.label+" rating"} type="range" min="1" max="10" step="1" value={ratings[d.key]} onPointerDown={()=>set(d.key,ratings[d.key])} onChange={e=>set(d.key,Number(e.target.value))}/><div className="eval-ticks"><span>1</span><span>3</span><span>5</span><span>7</span><span>10</span></div></div>)}</div>
  <div className="eval-notes-grid"><label>Strength observed<textarea value={strengths} onChange={e=>setStrengths(e.target.value)} maxLength={600} placeholder="Specific behavior that worked…"/></label><label>Priority to improve<textarea value={improvement} onChange={e=>setImprovement(e.target.value)} maxLength={600} placeholder="One measurable weakness…"/></label></div>
  <label className="eval-next-action">Next practice action<input value={nextAction} onChange={e=>setNextAction(e.target.value)} maxLength={240} placeholder="A concrete drill or behavior to repeat"/></label>
  <footer className="eval-rubric-actions">{onCancel&&<button type="button" className="secondary-button" onClick={onCancel} disabled={loading}>Cancel</button>}<button type="button" className="primary-button" disabled={loading||!complete} onClick={()=>onSave({ratings,overall,strengths:strengths.trim(),improvement:improvement.trim(),nextAction:nextAction.trim()})}>{loading?"Saving review…":"Save player review"}</button></footer>
  <p className="eval-disclaimer">Ratings are coach observations. Keep evidence and context in review notes; a single score is not a permanent player label.</p>
 </section>;
}