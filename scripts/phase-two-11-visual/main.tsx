import React from "react";
import ReactDOM from "react-dom/client";
import CanonicalSessionsWorkspace from "../../src/components/CanonicalSessionsWorkspace";
import "../../src/styles/tokens.css";
import "../../src/styles.css";
import "../../src/styles/foundation.css";

type Fixture = Record<string, any[]>;
const now = new Date().toISOString();
const sessionId = "11111111-1111-4111-8111-111111111111";
const trainingId = "22222222-2222-4222-8222-222222222222";
const matchId = "33333333-3333-4333-8333-333333333333";
const rosterIds = ["44444444-4444-4444-8444-444444444441","44444444-4444-4444-8444-444444444442","44444444-4444-4444-8444-444444444443","44444444-4444-4444-8444-444444444444"];
const fixtures: Fixture = {
  canonical_sessions: [
    {id:sessionId,team_id:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",session_type:"scrim",title:"Weekly Scrim · Week 47",session_date:"2026-11-20",scheduled_at:now,season_label:"Winter 2026",lifecycle_status:"in_progress",lifecycle_version:2,archived_at:null,created_at:now,created_by:"owner-user"},
    {id:trainingId,team_id:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",session_type:"training",title:"Team coordination review",session_date:"2026-11-19",scheduled_at:null,season_label:"Winter 2026",lifecycle_status:"draft",lifecycle_version:0,archived_at:null,created_at:now,created_by:"owner-user"}
  ],
  canonical_session_sources:[{team_id:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",canonical_session_id:sessionId,source_system:"scrim",source_record_id:"scrim-01"}],
  canonical_session_matches:[{id:matchId,team_id:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",canonical_session_id:sessionId,match_sequence:1,source_system:"scrim",map_name:"Bermuda",mode:"Battle Royale",round_label:"Round 1"}],
  canonical_session_rosters:[{id:"55555555-5555-4555-8555-555555555555",team_id:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",canonical_session_id:sessionId}],
  canonical_session_roster_members:rosterIds.map((id,i)=>({id:"66666666-6666-4666-8666-66666666666"+i,team_id:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",canonical_session_id:sessionId,canonical_session_roster_id:"55555555-5555-4555-8555-555555555555",membership_id_snapshot:id,player_user_id:"player-"+i,display_name_snapshot:["Oscar","Ravi","Aman","Neel"][i],player_number_snapshot:i+1,membership_role_snapshot:i===0?"owner":"player",selection_status:"confirmed"})),
  canonical_team_role_definitions:[{id:"77777777-7777-4777-8777-777777777771",team_id:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",role_key:"primary-rusher",role_name:"Primary Rusher",is_current:true,is_active:true},{id:"77777777-7777-4777-8777-777777777772",team_id:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",role_key:"sniper",role_name:"Sniper",is_current:true,is_active:true}],
  canonical_session_lifecycle_events:[{id:"88888888-8888-4888-8888-888888888881",team_id:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",canonical_session_id:sessionId,lifecycle_version:1,event_kind:"transition",previous_status:"draft",new_status:"scheduled",reason:"Fixture",changed_at:now},{id:"88888888-8888-4888-8888-888888888882",team_id:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",canonical_session_id:sessionId,lifecycle_version:2,event_kind:"transition",previous_status:"scheduled",new_status:"in_progress",reason:"Fixture",changed_at:now}],
  canonical_session_result_submissions:[],
  canonical_session_results:[{id:"99999999-9999-4999-8999-999999999991",team_id:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",canonical_session_id:sessionId,canonical_session_match_id:matchId,status:"draft",current_version_no:1,updated_at:now}],
  canonical_session_match_participants:rosterIds.slice(0,2).map((id,i)=>({id:"aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee"+i,team_id:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",canonical_session_id:sessionId,canonical_session_match_id:matchId,roster_member_id:"66666666-6666-4666-8666-66666666666"+i,player_user_id:"player-"+i,participation_status:"participated"})),
  canonical_session_match_roles:[],
  canonical_session_substitutions:[],
  canonical_session_result_versions:[{id:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",result_id:"99999999-9999-4999-8999-999999999991",team_id:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",version_no:1,version_kind:"draft",result_source:"coach_report",source_reference:"coach-review-47",raw_submitted_values:{placement:2,kills:8},recorded_at:now,recorded_by:"owner-user"}],
  canonical_session_result_events:[{id:"cccccccc-cccc-4ccc-8ccc-ccccccccccc1",result_id:"99999999-9999-4999-8999-999999999991",team_id:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",version_no:1,event_kind:"draft_saved",previous_status:"draft",new_status:"draft",reason:null,changed_at:now,changed_by:"owner-user"}]
};
const calls: Array<{name:string;args:any}> = [];
const filterRows=(table:string,filters:Array<[string,unknown]>,inFilters:Array<[string,unknown[]]>)=>{
  let rows=fixtures[table]||[];
  for(const [key,value] of filters) rows=rows.filter(row=>row[key]===value);
  for(const [key,values] of inFilters) rows=rows.filter(row=>values.includes(row[key]));
  return rows;
};
const fakeClient={
  from(table:string){
    const filters:Array<[string,unknown]>=[];
    const inFilters:Array<[string,unknown[]]>=[];
    let range:[number,number]=[0,999];
    const query:any={
      select(){return query;},eq(key:string,value:unknown){filters.push([key,value]);return query;},
      in(key:string,values:unknown[]){inFilters.push([key,values]);return query;},
      order(){return query;},limit(){return query;},range(from:number,to:number){range=[from,to];return query;},update(){return query;},
      then(resolve:any,reject:any){return Promise.resolve({data:filterRows(table,filters,inFilters).slice(range[0],range[1]+1),error:null}).then(resolve,reject);},
      single(){return Promise.resolve({data:filterRows(table,filters,inFilters)[0]||null,error:null});},
      maybeSingle(){return Promise.resolve({data:filterRows(table,filters,inFilters)[0]||null,error:null});}
    };
    return query;
  },
  async rpc(name:string,args:any){
    calls.push({name,args});
    if(name==="create_canonical_session"){
      const created={id:"dddddddd-dddd-4ddd-8ddd-dddddddddddd",team_id:args.p_team_id,session_type:"training",title:args.p_title,session_date:args.p_session_date,scheduled_at:args.p_scheduled_at,season_label:args.p_season_label,lifecycle_status:"draft",lifecycle_version:0,archived_at:null,created_at:now,created_by:"owner-user"};
      fixtures.canonical_sessions.unshift(created);
      return {data:created,error:null};
    }
    return {data:null,error:null};
  }
};
Object.defineProperty(window,"__qaCalls",{value:calls});
const params=new URLSearchParams(location.search);
const role=params.get("role")||"owner";
const members=rosterIds.map((id,i)=>({id,user_id:"player-"+i,display_name:["Oscar","Ravi","Aman","Neel"][i],player_number:i+1,assigned_role:["Primary Rusher","Secondary Rusher","Third Rusher","Sniper"][i],membership_role:i===0?"owner":"player",status:"active"}));
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <CanonicalSessionsWorkspace client={fakeClient as any} teamId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" userId="owner-user" membershipRole={role} members={members}/>
  </React.StrictMode>
);
