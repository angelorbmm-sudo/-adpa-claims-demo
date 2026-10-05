import React, { useMemo, useState } from "react";
import { nowIso, uid } from "../lib/storage.js";

const drawBlank={drawNumber:"",requestedAmount:"",releasedAmount:"",requestDate:"",dueDate:"",releaseDate:"",completionPercent:"",inspectionRequired:false,conditions:"",status:"Draft",notes:""};
const inspectionBlank={date:"",inspector:"",completionPercent:"",result:"Pending",reportRef:"",notes:""};
const conditionBlank={requirement:"",owner:"",dueDate:"",status:"Open",evidenceRef:"",notes:""};

function n(v){return Number(v||0);}
function money(v){return n(v).toLocaleString(undefined,{style:"currency",currency:"USD"});}
function isPast(d){return !!d&&new Date(d+"T23:59:59").getTime()<Date.now();}

export default function MortgageLossDraftCenter({claim,onChange}){
  const m=claim.mortgage||{};
  const draws=m.draws||[], inspections=m.inspections||[], conditions=m.conditions||[], documents=m.documents||[];
  const [draw,setDraw]=useState(drawBlank);
  const [inspection,setInspection]=useState(inspectionBlank);
  const [condition,setCondition]=useState(conditionBlank);
  const [doc,setDoc]=useState({type:"Contractor Estimate",name:"",reference:"",status:"Received"});
  const [letter,setLetter]=useState("");

  const stats=useMemo(()=>({
    requested:draws.reduce((s,x)=>s+n(x.requestedAmount||x.amount),0),
    released:draws.reduce((s,x)=>s+n(x.releasedAmount),0),
    open:draws.filter(x=>!["Released","Closed"].includes(x.status)).length,
    overdue:draws.filter(x=>x.dueDate&&isPast(x.dueDate)&&!["Released","Closed"].includes(x.status)).length
  }),[draws]);

  const totalReleased=n(m.initialRelease)+stats.released;
  const remaining=Math.max(0,n(m.heldBalance)-totalReleased);
  const patch=(field,value)=>onChange({...m,[field]:value});

  function addDraw(e){e.preventDefault();onChange({...m,draws:[...draws,{...draw,id:uid("mortgage-draw"),createdAt:nowIso()}]});setDraw(drawBlank);}
  function addInspection(e){e.preventDefault();onChange({...m,inspections:[...inspections,{...inspection,id:uid("mortgage-inspection"),createdAt:nowIso()}]});setInspection(inspectionBlank);}
  function addCondition(e){e.preventDefault();if(!condition.requirement.trim())return;onChange({...m,conditions:[...conditions,{...condition,id:uid("mortgage-condition"),createdAt:nowIso()}]});setCondition(conditionBlank);}
  function addDoc(e){e.preventDefault();if(!doc.name.trim())return;onChange({...m,documents:[...documents,{...doc,id:uid("mortgage-doc"),createdAt:nowIso()}]});setDoc({type:"Contractor Estimate",name:"",reference:"",status:"Received"});}
  function patchDraw(id,field,value){onChange({...m,draws:draws.map(x=>x.id===id?{...x,[field]:value}:x)});}
  function patchCondition(id,field,value){onChange({...m,conditions:conditions.map(x=>x.id===id?{...x,[field]:value}:x)});}

  function draftRequest(){
    setLetter([
      "Subject: Mortgage Loss Draft / Insurance Funds Release Request","",
      "Insured: "+(claim.insured||""),
      "Property: "+(claim.property||""),
      "Claim: "+(claim.claimNumber||""),
      "Servicer: "+(m.servicer||claim.mortgageServicer||""),"",
      "Recorded funds held: "+money(m.heldBalance),
      "Recorded total released: "+money(totalReleased),
      "Recorded remaining held: "+money(remaining),"",
      "Please confirm the current requirements for the next release of insurance proceeds, including any inspection, contractor, permit, lien-waiver, progress, or completion documentation still needed.","",
      "Draft for human review before sending."
    ].join("\n"));
  }

  return <section>
    <h1>Mortgage Loss Draft Center</h1>
    <p>Track lender-held insurance proceeds, endorsement status, draw requests, inspections, release conditions, supporting documents, and final reconciliation.</p>

    <div className="stats">
      <div className="stat"><small>Funds held</small><b>{money(m.heldBalance)}</b></div>
      <div className="stat"><small>Total released</small><b>{money(totalReleased)}</b></div>
      <div className="stat"><small>Remaining held</small><b>{money(remaining)}</b></div>
      <div className="stat"><small>Open / overdue draws</small><b>{stats.open} / {stats.overdue}</b></div>
    </div>

    <div className="panel"><h2>Servicer & insurance funds</h2><div className="grid">
      <label>Mortgage servicer<input value={m.servicer||claim.mortgageServicer||""} onChange={e=>patch("servicer",e.target.value)}/></label>
      <label>Account / reference<input value={m.accountReference||""} onChange={e=>patch("accountReference",e.target.value)}/></label>
      <label>Loss-draft contact<input value={m.contactName||""} onChange={e=>patch("contactName",e.target.value)}/></label>
      <label>Contact phone<input value={m.contactPhone||""} onChange={e=>patch("contactPhone",e.target.value)}/></label>
      <label>Contact email<input value={m.contactEmail||""} onChange={e=>patch("contactEmail",e.target.value)}/></label>
      <label>Portal / reference<input value={m.portal||""} onChange={e=>patch("portal",e.target.value)}/></label>
      <label>Insurance check amount<input type="number" value={m.claimCheckAmount||""} onChange={e=>patch("claimCheckAmount",e.target.value)}/></label>
      <label>Funds held by servicer<input type="number" value={m.heldBalance||""} onChange={e=>patch("heldBalance",e.target.value)}/></label>
      <label>Initial release<input type="number" value={m.initialRelease||""} onChange={e=>patch("initialRelease",e.target.value)}/></label>
      <label>Endorsement status<select value={m.endorsementStatus||"Not started"} onChange={e=>patch("endorsementStatus",e.target.value)}><option>Not started</option><option>Sent for endorsement</option><option>Received by servicer</option><option>In review</option><option>Complete</option><option>Issue / hold</option></select></label>
    </div><label>Servicer requirements<textarea value={m.requirements||""} onChange={e=>patch("requirements",e.target.value)}/></label></div>

    <div className="panel"><h2>Draw requests</h2><form className="grid" onSubmit={addDraw}>
      <label>Draw #<input value={draw.drawNumber} onChange={e=>setDraw(x=>({...x,drawNumber:e.target.value}))}/></label>
      <label>Requested amount<input type="number" value={draw.requestedAmount} onChange={e=>setDraw(x=>({...x,requestedAmount:e.target.value}))}/></label>
      <label>Released amount<input type="number" value={draw.releasedAmount} onChange={e=>setDraw(x=>({...x,releasedAmount:e.target.value}))}/></label>
      <label>Request date<input type="date" value={draw.requestDate} onChange={e=>setDraw(x=>({...x,requestDate:e.target.value}))}/></label>
      <label>Due / follow-up date<input type="date" value={draw.dueDate} onChange={e=>setDraw(x=>({...x,dueDate:e.target.value}))}/></label>
      <label>Completion %<input type="number" min="0" max="100" value={draw.completionPercent} onChange={e=>setDraw(x=>({...x,completionPercent:e.target.value}))}/></label>
      <label className="checkbox-label"><input type="checkbox" checked={draw.inspectionRequired} onChange={e=>setDraw(x=>({...x,inspectionRequired:e.target.checked}))}/>Inspection required</label>
      <label>Status<select value={draw.status} onChange={e=>setDraw(x=>({...x,status:e.target.value}))}><option>Draft</option><option>Submitted</option><option>Under Review</option><option>Inspection Required</option><option>Approved</option><option>Partially Released</option><option>Released</option><option>Closed</option></select></label>
      <label className="wide">Release conditions<textarea value={draw.conditions} onChange={e=>setDraw(x=>({...x,conditions:e.target.value}))}/></label>
      <div className="form-action"><button className="primary" type="submit">Add draw request</button></div>
    </form></div>

    <div className="table-wrap"><table className="mortgage-table"><thead><tr><th>Draw</th><th>Requested</th><th>Released</th><th>Progress</th><th>Due</th><th>Status</th></tr></thead><tbody>
      {draws.map(x=><tr key={x.id}><td>{x.drawNumber||"Draw"}</td><td>{money(x.requestedAmount||x.amount)}</td><td>{money(x.releasedAmount)}</td><td>{x.completionPercent||0}%</td><td>{x.dueDate}{isPast(x.dueDate)&&!["Released","Closed"].includes(x.status)?" — OVERDUE":""}</td><td><select value={x.status||"Draft"} onChange={e=>patchDraw(x.id,"status",e.target.value)}><option>Draft</option><option>Submitted</option><option>Under Review</option><option>Inspection Required</option><option>Approved</option><option>Partially Released</option><option>Released</option><option>Closed</option></select></td></tr>)}
    </tbody></table></div>

    <div className="panel"><h2>Inspections</h2><form className="grid" onSubmit={addInspection}>
      <label>Date<input type="date" value={inspection.date} onChange={e=>setInspection(x=>({...x,date:e.target.value}))}/></label>
      <label>Inspector<input value={inspection.inspector} onChange={e=>setInspection(x=>({...x,inspector:e.target.value}))}/></label>
      <label>Completion %<input type="number" value={inspection.completionPercent} onChange={e=>setInspection(x=>({...x,completionPercent:e.target.value}))}/></label>
      <label>Result<select value={inspection.result} onChange={e=>setInspection(x=>({...x,result:e.target.value}))}><option>Pending</option><option>Passed</option><option>Partial</option><option>Reinspection required</option></select></label>
      <label>Report / evidence ref<input value={inspection.reportRef} onChange={e=>setInspection(x=>({...x,reportRef:e.target.value}))}/></label>
      <div className="form-action"><button type="submit">Add inspection</button></div>
    </form><div className="records">{inspections.map(x=><div className="record" key={x.id}><b>{x.date||"Inspection"} · {x.completionPercent||0}%</b><span>{x.inspector||""} — {x.result}</span><small>{x.reportRef}</small></div>)}</div></div>

    <div className="panel"><h2>Contractor / lender documents</h2><form className="grid" onSubmit={addDoc}>
      <label>Type<select value={doc.type} onChange={e=>setDoc(x=>({...x,type:e.target.value}))}><option>Contractor Estimate</option><option>Signed Contract</option><option>W-9</option><option>Permit</option><option>Lien Waiver</option><option>Invoice</option><option>Progress Photos</option><option>Completion Certificate</option><option>Inspection Report</option><option>Other</option></select></label>
      <label>Name<input value={doc.name} onChange={e=>setDoc(x=>({...x,name:e.target.value}))}/></label>
      <label>Evidence ref<input value={doc.reference} onChange={e=>setDoc(x=>({...x,reference:e.target.value}))}/></label>
      <label>Status<select value={doc.status} onChange={e=>setDoc(x=>({...x,status:e.target.value}))}><option>Requested</option><option>Received</option><option>Submitted to lender</option><option>Accepted</option><option>Needs correction</option></select></label>
      <div className="form-action"><button type="submit">Add document record</button></div>
    </form><div className="records">{documents.map(x=><div className="record" key={x.id}><b>{x.type}: {x.name}</b><span>{x.status}</span><small>{x.reference}</small></div>)}</div></div>

    <div className="panel"><h2>Lender conditions</h2><form className="grid" onSubmit={addCondition}>
      <label>Requirement<input value={condition.requirement} onChange={e=>setCondition(x=>({...x,requirement:e.target.value}))}/></label>
      <label>Owner<input value={condition.owner} onChange={e=>setCondition(x=>({...x,owner:e.target.value}))}/></label>
      <label>Due date<input type="date" value={condition.dueDate} onChange={e=>setCondition(x=>({...x,dueDate:e.target.value}))}/></label>
      <label>Status<select value={condition.status} onChange={e=>setCondition(x=>({...x,status:e.target.value}))}><option>Open</option><option>In Progress</option><option>Complete</option><option>Waived</option><option>Blocked</option></select></label>
      <label>Evidence ref<input value={condition.evidenceRef} onChange={e=>setCondition(x=>({...x,evidenceRef:e.target.value}))}/></label>
      <div className="form-action"><button type="submit">Add condition</button></div>
    </form><div className="records">{conditions.map(x=><div className="record" key={x.id}><b>{x.requirement}</b><span>{x.owner||"Unassigned"} · {x.dueDate||"No due date"}</span><label>Status<select value={x.status} onChange={e=>patchCondition(x.id,"status",e.target.value)}><option>Open</option><option>In Progress</option><option>Complete</option><option>Waived</option><option>Blocked</option></select></label></div>)}</div></div>

    <div className="panel"><h2>Draft loss-draft request</h2><button type="button" onClick={draftRequest}>Prepare draft lender request</button><label>Draft<textarea value={letter} onChange={e=>setLetter(e.target.value)}/></label></div>
    <label>Internal loss-draft notes<textarea value={m.notes||""} onChange={e=>patch("notes",e.target.value)}/></label>
    <p className="notice">Servicer and investor requirements vary. This module tracks operational requirements and releases; it does not override lender, investor, contract, or legal requirements.</p>
  </section>;
}
