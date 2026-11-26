import { useState } from "react";
import "./PlacementPicker.css";

export default function PlacementPicker({value,disabled,onChange,onClear}:{value:number|null;disabled:boolean;onChange:(n:number)=>void;onClear?:()=>void}) {
 const [open,setOpen]=useState(false);
 const label=(n:number|null)=>n===null?"Not set":n===12?"12+ / Other":n+(n===1?"st":n===2?"nd":n===3?"rd":"th");
 return <div className={`scrims-placement-picker${open?" is-open":""}`}>
  <button type="button" className="scrims-placement-trigger" disabled={disabled} aria-haspopup="listbox" aria-expanded={open} onClick={()=>setOpen(v=>!v)}>
   <span>{label(value)}</span><span className="scrims-placement-chevron" aria-hidden="true">⌄</span>
  </button>
  {open&&!disabled&&<div className="scrims-placement-menu" role="listbox" aria-label="Placement">
   {[null,...Array.from({length:12},(_,j)=>j+1)].map(n=><button type="button" role="option" aria-selected={value===n} className={value===n?"is-selected":""} key={n===null?"unset":n} onClick={()=>{if(n===null)onClear?.();else onChange(n);setOpen(false)}}>{label(n)}{value===n&&<span className="scrims-placement-check">✓</span>}</button>)}
  </div>}
 </div>;
}
