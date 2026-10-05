import React, { useMemo, useState } from "react";
import { nowIso, uid } from "../lib/storage.js";

const blank = {
  coverage: "A",
  issueType: "Scope",
  issue: "",
  carrierReference: "",
  adpaPosition: "",
  requested: "",
  approvedAmount: "",
  revisedAmount: "",
  supportRefs: "",
  policyCodeSupport: "",
  submittedDate: "",
  responseDueDate: "",
  carrierResponse: "",
  responseDate: "",
  status: "Draft",
  escalationLevel: "Normal",
  followUpDate: "",
  notes: "",
  revisions: []
};

function n(v){ return Number(v || 0); }
function money(v){ return n(v).toLocaleString(undefined,{style:"currency",currency:"USD"}); }
function isPast(date){ return !!date && new Date(date+"T23:59:59").getTime() < Date.now(); }

export default function SupplementsDisputeCenter({ claim, onChange }){
  const records=claim.supplements || [];
  const [row,setRow]=useState(blank);
  const [draft,setDraft]=useState("");
  const [filter,setFilter]=useState("All");

  const totals=useMemo(()=>records.reduce((t,x)=>{
    t.requested+=n(x.requested);
    t.approved+=n(x.approvedAmount);
    t.revised+=n(x.revisedAmount);
    t.outstanding+=Math.max(0,n(x.requested)-n(x.approvedAmount));
    return t;
  },{requested:0,approved:0,revised:0,outstanding:0}),[records]);

  const open=records.filter(x=>!["Resolved","Closed","Approved"].includes(x.status));
  const overdue=open.filter(x=>isPast(x.responseDueDate));
  const escalated=open.filter(x=>["DOI","Appraisal","Counsel","Executive Review"].includes(x.escalationLevel));
  const visible=records.filter(x=>filter==="All" || x.status===filter);

  function add(e){
    e.preventDefault();
    if(!row.issue.trim()) return;
    onChange([...records,{...row,id:uid("supplement"),createdAt:nowIso(),revisions:[]}]);
    setRow(blank);
  }

  function patch(id,field,value){
    onChange(records.map(x=>x.id===id?{...x,[field]:value,updatedAt:nowIso()}:x));
  }

  function addRevision(id){
    const target=records.find(x=>x.id===id);
    if(!target) return;
    const revision={
      id:uid("supp-revision"),
      createdAt:nowIso(),
      requested:n(target.requested),
      approvedAmount:n(target.approvedAmount),
      revisedAmount:n(target.revisedAmount),
      carrierResponse:target.carrierResponse||"",
      status:target.status,
      notes:target.notes||""
    };
    onChange(records.map(x=>x.id===id?{...x,revisions:[...(x.revisions||[]),revision]}:x));
  }

  function remove(id){ onChange(records.filter(x=>x.id!==id)); }

  function prepareDraft(record,type){
    const subject=type==="dispute" ? "Response to Carrier Position / Disputed Claim Item" : "Supplement Request";
    setDraft([
      "Subject: "+subject,
      "",
      "Claim: "+(claim.claimNumber||""),
      "Insured: "+(claim.insured||""),
      "Coverage: "+(record.coverage||""),
      "",
      "Issue: "+(record.issue||""),
      record.carrierReference ? "Carrier reference: "+record.carrierReference : "",
      "",
      "ADPA position:",
      record.adpaPosition||"[Insert supported position]",
      "",
      "Amount requested: "+money(record.requested),
      record.approvedAmount ? "Carrier approved to date: "+money(record.approvedAmount) : "",
      "Current unresolved amount: "+money(Math.max(0,n(record.requested)-n(record.approvedAmount))),
      "",
      record.supportRefs ? "Supporting evidence: "+record.supportRefs : "",
      record.policyCodeSupport ? "Policy / code support: "+record.policyCodeSupport : "",
      "",
      "Please review the attached/supporting documentation and provide your written position regarding this item.",
      "",
      "Draft for human and licensed-PA review before sending."
    ].filter(Boolean).join("\n"));
  }

  return <section>
    <h1>Supplements & Dispute Management Center</h1>
    <p>Manage claim supplements, disputed scope/value issues, carrier responses, revision history, escalation level, and follow-up in one workflow.</p>

    <div className="stats">
      <div className="stat"><small>Total requested</small><b>{money(totals.requested)}</b></div>
      <div className="stat"><small>Total approved</small><b>{money(totals.approved)}</b></div>
      <div className="stat"><small>Outstanding variance</small><b>{money(totals.outstanding)}</b></div>
      <div className="stat"><small>Open / overdue</small><b>{open.length} / {overdue.length}</b></div>
    </div>

    {escalated.length>0 && <div className="release-banner blocked"><b>ESCALATED DISPUTES</b><span>{escalated.length} open item(s) are marked for DOI, appraisal, counsel, or executive review.</span></div>}

    <div className="panel">
      <h2>Add supplement / dispute</h2>
      <form className="grid" onSubmit={add}>
        <label>Coverage<select value={row.coverage} onChange={e=>setRow(r=>({...r,coverage:e.target.value}))}><option>A</option><option>B</option><option>C</option><option>D</option><option>CODE</option><option>General</option></select></label>
        <label>Issue type<select value={row.issueType} onChange={e=>setRow(r=>({...r,issueType:e.target.value}))}><option>Scope</option><option>Quantity</option><option>Unit Price</option><option>Contents Value</option><option>Depreciation</option><option>ALE</option><option>Code / Ordinance</option><option>Coverage Position</option><option>Payment</option><option>Other</option></select></label>
        <label>Issue<input value={row.issue} onChange={e=>setRow(r=>({...r,issue:e.target.value}))}/></label>
        <label>Carrier estimate / position reference<input value={row.carrierReference} onChange={e=>setRow(r=>({...r,carrierReference:e.target.value}))}/></label>
        <label className="wide">ADPA position<textarea value={row.adpaPosition} onChange={e=>setRow(r=>({...r,adpaPosition:e.target.value}))}/></label>
        <label>Requested amount<input type="number" step="0.01" value={row.requested} onChange={e=>setRow(r=>({...r,requested:e.target.value}))}/></label>
        <label>Approved amount<input type="number" step="0.01" value={row.approvedAmount} onChange={e=>setRow(r=>({...r,approvedAmount:e.target.value}))}/></label>
        <label>Revised amount<input type="number" step="0.01" value={row.revisedAmount} onChange={e=>setRow(r=>({...r,revisedAmount:e.target.value}))}/></label>
        <label>Supporting evidence refs<input placeholder="Photos, estimate lines, receipt IDs..." value={row.supportRefs} onChange={e=>setRow(r=>({...r,supportRefs:e.target.value}))}/></label>
        <label>Policy / code support<input value={row.policyCodeSupport} onChange={e=>setRow(r=>({...r,policyCodeSupport:e.target.value}))}/></label>
        <label>Submitted date<input type="date" value={row.submittedDate} onChange={e=>setRow(r=>({...r,submittedDate:e.target.value}))}/></label>
        <label>Carrier response due<input type="date" value={row.responseDueDate} onChange={e=>setRow(r=>({...r,responseDueDate:e.target.value}))}/></label>
        <label>Follow-up date<input type="date" value={row.followUpDate} onChange={e=>setRow(r=>({...r,followUpDate:e.target.value}))}/></label>
        <label>Status<select value={row.status} onChange={e=>setRow(r=>({...r,status:e.target.value}))}><option>Draft</option><option>Submitted</option><option>Under Review</option><option>Partially Approved</option><option>Approved</option><option>Denied</option><option>Disputed</option><option>Resolved</option><option>Closed</option></select></label>
        <label>Escalation<select value={row.escalationLevel} onChange={e=>setRow(r=>({...r,escalationLevel:e.target.value}))}><option>Normal</option><option>Supervisor Review</option><option>Executive Review</option><option>DOI</option><option>Appraisal</option><option>Counsel</option></select></label>
        <label className="wide">Notes<textarea value={row.notes} onChange={e=>setRow(r=>({...r,notes:e.target.value}))}/></label>
        <div className="form-action"><button className="primary" type="submit">Add dispute item</button></div>
      </form>
    </div>

    <div className="panel">
      <h2>Filter</h2>
      <label>Status<select value={filter} onChange={e=>setFilter(e.target.value)}><option>All</option><option>Draft</option><option>Submitted</option><option>Under Review</option><option>Partially Approved</option><option>Approved</option><option>Denied</option><option>Disputed</option><option>Resolved</option><option>Closed</option></select></label>
    </div>

    <div className="records">
      {visible.length===0 && <p className="muted">No supplement/dispute records match this filter.</p>}
      {visible.map(x=>{
        const unresolved=Math.max(0,n(x.requested)-n(x.approvedAmount));
        const overdueFlag=isPast(x.responseDueDate) && !["Resolved","Closed","Approved"].includes(x.status);
        return <div className="record dispute-record" key={x.id}>
          <div className="work-item-head">
            <span className="pill">{x.coverage}</span>
            <span className="pill secondary">{x.issueType}</span>
            {overdueFlag && <span className="pill alert">Response overdue</span>}
            {["DOI","Appraisal","Counsel","Executive Review"].includes(x.escalationLevel) && <span className="pill alert">{x.escalationLevel}</span>}
          </div>
          <b>{x.issue}</b>
          <span>{x.adpaPosition}</span>
          <div className="dispute-money">
            <span><small>Requested</small><b>{money(x.requested)}</b></span>
            <span><small>Approved</small><b>{money(x.approvedAmount)}</b></span>
            <span><small>Unresolved</small><b>{money(unresolved)}</b></span>
          </div>
          {x.supportRefs && <small><b>Evidence:</b> {x.supportRefs}</small>}
          {x.policyCodeSupport && <small><b>Policy/code:</b> {x.policyCodeSupport}</small>}
          <div className="grid compact">
            <label>Carrier response<textarea value={x.carrierResponse||""} onChange={e=>patch(x.id,"carrierResponse",e.target.value)}/></label>
            <label>Response date<input type="date" value={x.responseDate||""} onChange={e=>patch(x.id,"responseDate",e.target.value)}/></label>
            <label>Status<select value={x.status} onChange={e=>patch(x.id,"status",e.target.value)}><option>Draft</option><option>Submitted</option><option>Under Review</option><option>Partially Approved</option><option>Approved</option><option>Denied</option><option>Disputed</option><option>Resolved</option><option>Closed</option></select></label>
            <label>Escalation<select value={x.escalationLevel} onChange={e=>patch(x.id,"escalationLevel",e.target.value)}><option>Normal</option><option>Supervisor Review</option><option>Executive Review</option><option>DOI</option><option>Appraisal</option><option>Counsel</option></select></label>
          </div>
          <div className="comm-actions">
            <button type="button" onClick={()=>addRevision(x.id)}>Save revision snapshot</button>
            <button type="button" onClick={()=>prepareDraft(x,"supplement")}>Draft supplement letter</button>
            <button type="button" onClick={()=>prepareDraft(x,"dispute")}>Draft dispute response</button>
            <button type="button" onClick={()=>remove(x.id)}>Remove</button>
          </div>
          {(x.revisions||[]).length>0 && <details><summary>Revision history ({x.revisions.length})</summary><div className="records">{x.revisions.slice().reverse().map(r=><div className="record" key={r.id}><small>{r.createdAt}</small><span>Requested {money(r.requested)} · Approved {money(r.approvedAmount)} · Status {r.status}</span><small>{r.notes}</small></div>)}</div></details>}
        </div>;
      })}
    </div>

    <div className="panel">
      <h2>Draft supplement / dispute letter</h2>
      <label className="wide">Draft<textarea value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Choose a dispute item above, then prepare a draft letter."/></label>
      <p className="muted">Draft only. It must pass the appropriate ADPA review/authority controls before external delivery.</p>
    </div>

    <p className="notice">Escalation labels are workflow flags, not automatic legal recommendations. DOI complaints, appraisal, counsel referral, coverage positions, settlement positions, and other regulated or legal actions require human review and applicable authority.</p>
  </section>;
}
