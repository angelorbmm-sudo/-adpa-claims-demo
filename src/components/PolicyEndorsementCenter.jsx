import React, { useMemo, useState } from "react";
import { nowIso, uid } from "../lib/storage.js";

const declarationBlank={coverage:"A",label:"",limit:"",deductible:"",sublimit:"",page:"",sourceRef:"",notes:""};
const endorsementBlank={formNumber:"",title:"",effect:"Adds / Changes Coverage",coverage:"General",page:"",sourceRef:"",summary:"",status:"Needs review"};
const provisionBlank={type:"Valuation",coverage:"General",summary:"",page:"",sourceRef:"",deadlineDate:"",status:"Needs review"};
const conflictBlank={issue:"",sources:"",impact:"",status:"Open",resolution:""};

const provisionTypes=["Valuation","Deductible","Exclusion","Special Limit / Sublimit","ALE / Loss of Use","Ordinance / Law","Vacancy / Occupancy","Duties After Loss","Appraisal","Suit / Legal Action","Mortgage / Loss Payee","Replacement Requirement","Deadline / Time Limit","Other"];

function n(v){return Number(v||0);}
function money(v){return n(v).toLocaleString(undefined,{style:"currency",currency:"USD"});}
function isPast(d){return !!d&&new Date(d+"T23:59:59").getTime()<Date.now();}

export default function PolicyEndorsementCenter({claim,onChange}){
  const p=claim.policyAnalysis||{declarations:[],endorsements:[],provisions:[],conflicts:[],reviewStatus:"Unreviewed"};
  const declarations=p.declarations||[], endorsements=p.endorsements||[], provisions=p.provisions||[], conflicts=p.conflicts||[];
  const [decl,setDecl]=useState(declarationBlank);
  const [endorsement,setEndorsement]=useState(endorsementBlank);
  const [provision,setProvision]=useState(provisionBlank);
  const [conflict,setConflict]=useState(conflictBlank);
  const [memo,setMemo]=useState("");

  const metrics=useMemo(()=>({
    declarations:declarations.length,
    endorsementsOpen:endorsements.filter(x=>x.status!=="Reviewed").length,
    provisionsOpen:provisions.filter(x=>x.status!=="Confirmed").length,
    conflictsOpen:conflicts.filter(x=>x.status!=="Resolved").length
  }),[declarations,endorsements,provisions,conflicts]);

  const patch=(field,value)=>onChange({...p,[field]:value});

  function addDecl(e){e.preventDefault();onChange({...p,declarations:[...declarations,{...decl,id:uid("policy-decl"),createdAt:nowIso()}]});setDecl(declarationBlank);}
  function addEndorsement(e){e.preventDefault();onChange({...p,endorsements:[...endorsements,{...endorsement,id:uid("policy-end"),createdAt:nowIso()}]});setEndorsement(endorsementBlank);}
  function addProvision(e){e.preventDefault();onChange({...p,provisions:[...provisions,{...provision,id:uid("policy-prov"),createdAt:nowIso()}]});setProvision(provisionBlank);}
  function addConflict(e){e.preventDefault();if(!conflict.issue.trim())return;onChange({...p,conflicts:[...conflicts,{...conflict,id:uid("policy-conflict"),createdAt:nowIso()}]});setConflict(conflictBlank);}

  function patchEndorsement(id,field,value){onChange({...p,endorsements:endorsements.map(x=>x.id===id?{...x,[field]:value}:x)});}
  function patchProvision(id,field,value){onChange({...p,provisions:provisions.map(x=>x.id===id?{...x,[field]:value}:x)});}
  function patchConflict(id,field,value){onChange({...p,conflicts:conflicts.map(x=>x.id===id?{...x,[field]:value}:x)});}

  function prepareMemo(){
    setMemo([
      "POLICY & ENDORSEMENT REVIEW MEMO — DRAFT",
      "",
      "Insured: "+(claim.insured||""),
      "Carrier: "+(claim.carrier||""),
      "Claim #: "+(claim.claimNumber||""),
      "",
      "Declarations recorded: "+declarations.length,
      "Endorsements recorded: "+endorsements.length,
      "Material provisions recorded: "+provisions.length,
      "Open conflicts: "+metrics.conflictsOpen,
      "",
      "Coverage summary:",
      ...declarations.map(x=>"- "+x.coverage+" "+(x.label||"")+": limit "+money(x.limit)+(x.deductible?" | deductible "+money(x.deductible):"")+(x.sublimit?" | sublimit "+money(x.sublimit):"")+(x.page?" | p. "+x.page:"")),
      "",
      "Key provisions:",
      ...provisions.map(x=>"- "+x.type+" ("+x.coverage+"): "+x.summary+(x.page?" [p. "+x.page+"]":"")),
      "",
      "Conflicts / unresolved issues:",
      ...(conflicts.length?conflicts.map(x=>"- "+x.issue+" — "+x.status):["- None recorded"]),
      "",
      "This memo is a structured working summary, not a final coverage opinion. Human review of the actual policy forms and endorsements is required."
    ].join("\n"));
  }

  return <section>
    <h1>Policy & Endorsement Analysis Center</h1>
    <p>Organize declarations, endorsements, exclusions, limits, valuation language, deadlines, duties after loss, mortgage clauses, and source citations before downstream claim decisions rely on them.</p>

    <div className="stats">
      <div className="stat"><small>Declarations</small><b>{metrics.declarations}</b></div>
      <div className="stat"><small>Endorsements needing review</small><b>{metrics.endorsementsOpen}</b></div>
      <div className="stat"><small>Provisions needing confirmation</small><b>{metrics.provisionsOpen}</b></div>
      <div className="stat"><small>Open policy conflicts</small><b>{metrics.conflictsOpen}</b></div>
    </div>

    <div className="panel"><h2>Declarations / limits</h2><form className="grid" onSubmit={addDecl}>
      <label>Coverage<select value={decl.coverage} onChange={e=>setDecl(x=>({...x,coverage:e.target.value}))}><option>A</option><option>B</option><option>C</option><option>D</option><option>CODE</option><option>Other</option></select></label>
      <label>Label<input value={decl.label} onChange={e=>setDecl(x=>({...x,label:e.target.value}))}/></label>
      <label>Limit<input type="number" value={decl.limit} onChange={e=>setDecl(x=>({...x,limit:e.target.value}))}/></label>
      <label>Deductible<input type="number" value={decl.deductible} onChange={e=>setDecl(x=>({...x,deductible:e.target.value}))}/></label>
      <label>Sublimit<input type="number" value={decl.sublimit} onChange={e=>setDecl(x=>({...x,sublimit:e.target.value}))}/></label>
      <label>Page / section<input value={decl.page} onChange={e=>setDecl(x=>({...x,page:e.target.value}))}/></label>
      <label>Source reference<input value={decl.sourceRef} onChange={e=>setDecl(x=>({...x,sourceRef:e.target.value}))}/></label>
      <label>Notes<input value={decl.notes} onChange={e=>setDecl(x=>({...x,notes:e.target.value}))}/></label>
      <div className="form-action"><button className="primary" type="submit">Add declaration entry</button></div>
    </form><div className="records">{declarations.map(x=><div className="record" key={x.id}><b>{x.coverage} {x.label}</b><span>Limit {money(x.limit)}{x.deductible?" · Deductible "+money(x.deductible):""}{x.sublimit?" · Sublimit "+money(x.sublimit):""}</span><small>{x.page?"Page "+x.page+" · ":""}{x.sourceRef}</small></div>)}</div></div>

    <div className="panel"><h2>Endorsements</h2><form className="grid" onSubmit={addEndorsement}>
      <label>Form number<input value={endorsement.formNumber} onChange={e=>setEndorsement(x=>({...x,formNumber:e.target.value}))}/></label>
      <label>Title<input value={endorsement.title} onChange={e=>setEndorsement(x=>({...x,title:e.target.value}))}/></label>
      <label>Coverage<select value={endorsement.coverage} onChange={e=>setEndorsement(x=>({...x,coverage:e.target.value}))}><option>General</option><option>A</option><option>B</option><option>C</option><option>D</option><option>CODE</option></select></label>
      <label>Effect<select value={endorsement.effect} onChange={e=>setEndorsement(x=>({...x,effect:e.target.value}))}><option>Adds / Changes Coverage</option><option>Restricts Coverage</option><option>Excludes Coverage</option><option>Changes Limit</option><option>Changes Deductible</option><option>Other</option></select></label>
      <label>Page<input value={endorsement.page} onChange={e=>setEndorsement(x=>({...x,page:e.target.value}))}/></label>
      <label>Source reference<input value={endorsement.sourceRef} onChange={e=>setEndorsement(x=>({...x,sourceRef:e.target.value}))}/></label>
      <label className="wide">Summary<textarea value={endorsement.summary} onChange={e=>setEndorsement(x=>({...x,summary:e.target.value}))}/></label>
      <div className="form-action"><button type="submit">Add endorsement</button></div>
    </form><div className="records">{endorsements.map(x=><div className="record" key={x.id}><b>{x.formNumber} {x.title}</b><span>{x.effect} · {x.coverage}</span><small>{x.summary}</small><label>Status<select value={x.status} onChange={e=>patchEndorsement(x.id,"status",e.target.value)}><option>Needs review</option><option>Reviewed</option><option>Conflict identified</option></select></label></div>)}</div></div>

    <div className="panel"><h2>Material policy provisions</h2><form className="grid" onSubmit={addProvision}>
      <label>Provision type<select value={provision.type} onChange={e=>setProvision(x=>({...x,type:e.target.value}))}>{provisionTypes.map(t=><option key={t}>{t}</option>)}</select></label>
      <label>Coverage<select value={provision.coverage} onChange={e=>setProvision(x=>({...x,coverage:e.target.value}))}><option>General</option><option>A</option><option>B</option><option>C</option><option>D</option><option>CODE</option></select></label>
      <label>Page / section<input value={provision.page} onChange={e=>setProvision(x=>({...x,page:e.target.value}))}/></label>
      <label>Source reference<input value={provision.sourceRef} onChange={e=>setProvision(x=>({...x,sourceRef:e.target.value}))}/></label>
      <label>Deadline / date<input type="date" value={provision.deadlineDate} onChange={e=>setProvision(x=>({...x,deadlineDate:e.target.value}))}/></label>
      <label className="wide">Summary<textarea value={provision.summary} onChange={e=>setProvision(x=>({...x,summary:e.target.value}))}/></label>
      <div className="form-action"><button type="submit">Add provision</button></div>
    </form><div className="records">{provisions.map(x=><div className="record" key={x.id}><div className="work-item-head"><span className="pill system">{x.type}</span><span className="pill secondary">{x.coverage}</span>{isPast(x.deadlineDate)&&x.status!=="Confirmed"&&<span className="pill alert">Date passed</span>}</div><b>{x.summary}</b><small>{x.page?"Page "+x.page+" · ":""}{x.sourceRef}</small><label>Status<select value={x.status} onChange={e=>patchProvision(x.id,"status",e.target.value)}><option>Needs review</option><option>Confirmed</option><option>Conflict</option><option>Not applicable</option></select></label></div>)}</div></div>

    <div className="panel"><h2>Policy conflicts / unresolved interpretation</h2><form className="grid" onSubmit={addConflict}>
      <label>Issue<input value={conflict.issue} onChange={e=>setConflict(x=>({...x,issue:e.target.value}))}/></label>
      <label>Conflicting sources<input value={conflict.sources} onChange={e=>setConflict(x=>({...x,sources:e.target.value}))}/></label>
      <label>Potential impact<input value={conflict.impact} onChange={e=>setConflict(x=>({...x,impact:e.target.value}))}/></label>
      <label>Status<select value={conflict.status} onChange={e=>setConflict(x=>({...x,status:e.target.value}))}><option>Open</option><option>Needs licensed review</option><option>Resolved</option></select></label>
      <div className="form-action"><button type="submit">Add conflict</button></div>
    </form><div className="records">{conflicts.map(x=><div className="record" key={x.id}><b>{x.issue}</b><span>{x.sources}</span><small>{x.impact}</small><label>Resolution<textarea value={x.resolution||""} onChange={e=>patchConflict(x.id,"resolution",e.target.value)}/></label><label>Status<select value={x.status} onChange={e=>patchConflict(x.id,"status",e.target.value)}><option>Open</option><option>Needs licensed review</option><option>Resolved</option></select></label></div>)}</div></div>

    <div className="panel"><h2>Reviewer confirmation</h2><div className="grid">
      <label>Reviewer<input value={p.reviewer||""} onChange={e=>patch("reviewer",e.target.value)}/></label>
      <label>Review status<select value={p.reviewStatus||"Unreviewed"} onChange={e=>patch("reviewStatus",e.target.value)}><option>Unreviewed</option><option>In review</option><option>Reviewed with open issues</option><option>Confirmed</option></select></label>
      <label>Reviewed date<input type="date" value={(p.reviewedAt||"").slice(0,10)} onChange={e=>patch("reviewedAt",e.target.value)}/></label>
    </div><label>Review notes<textarea value={p.notes||""} onChange={e=>patch("notes",e.target.value)}/></label></div>

    <div className="panel"><h2>Draft policy review memo</h2><button type="button" onClick={prepareMemo}>Prepare draft memo</button><label>Draft<textarea value={memo} onChange={e=>setMemo(e.target.value)}/></label></div>

    <p className="notice">This module organizes policy evidence and reviewer conclusions. It does not replace reading the controlling policy forms, endorsements, statutes, regulations, or obtaining legal advice when interpretation is disputed.</p>
  </section>;
}
