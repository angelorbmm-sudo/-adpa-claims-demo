import React, { useMemo, useState } from "react";
import { nowIso, uid } from "../lib/storage.js";

const categories = [
  "Temporary Housing",
  "Hotel",
  "Rent",
  "Deposit / Fees",
  "Utilities",
  "Additional Food Expense",
  "Laundry",
  "Storage",
  "Pet Boarding",
  "Mileage / Transportation",
  "Furniture Rental",
  "Other"
];

const blankExpense = {
  category: "Temporary Housing",
  vendor: "",
  description: "",
  expenseDate: "",
  periodStart: "",
  periodEnd: "",
  amount: "",
  normalExpense: "",
  requested: "",
  approved: "",
  paid: "",
  receiptRef: "",
  reimbursementDueDate: "",
  status: "Submitted",
  notes: ""
};

const blankExtension = {
  requestedThrough: "",
  requestedDate: "",
  reason: "",
  amountRequested: "",
  status: "Draft",
  carrierResponse: "",
  responseDate: ""
};

function n(v){ return Number(v || 0); }
function money(v){ return n(v).toLocaleString(undefined,{style:"currency",currency:"USD"}); }
function daysBetween(a,b){
  if(!a||!b) return 0;
  return Math.max(0,Math.ceil((new Date(b)-new Date(a))/86400000));
}

export default function ALEManagementCenter({ claim, onChange }){
  const ale = claim.ale || { expenses:[], extensions:[] };
  const expenses = ale.expenses || [];
  const extensions = ale.extensions || [];
  const [expense,setExpense]=useState(blankExpense);
  const [extension,setExtension]=useState(blankExtension);
  const dCoverage=(claim.coverages||[]).find(c=>c.key==="D") || {};

  const totals=useMemo(()=>expenses.reduce((t,x)=>{
    const amount=n(x.amount);
    const normal=n(x.normalExpense);
    const requested=n(x.requested || Math.max(0,amount-normal));
    t.actual+=amount;
    t.normal+=normal;
    t.requested+=requested;
    t.approved+=n(x.approved);
    t.paid+=n(x.paid);
    return t;
  },{actual:0,normal:0,requested:0,approved:0,paid:0}),[expenses]);

  const outstanding=Math.max(0,totals.requested-totals.paid);
  const remainingLimit=Math.max(0,n(dCoverage.limit)-totals.paid);
  const monthsActive=ale.startDate ? Math.max(1, daysBetween(ale.startDate,new Date().toISOString().slice(0,10))/30.44) : 0;
  const burnRate=monthsActive ? totals.paid/monthsActive : 0;
  const monthsRemaining=burnRate>0 ? remainingLimit/burnRate : null;
  const exhaustionDate=monthsRemaining!==null ? new Date(Date.now()+monthsRemaining*30.44*86400000).toISOString().slice(0,10) : "";

  function patchAle(field,value){ onChange({ale:{...ale,[field]:value}}); }

  function addExpense(e){
    e.preventDefault();
    const requested=expense.requested!=="" ? n(expense.requested) : Math.max(0,n(expense.amount)-n(expense.normalExpense));
    const rec={...expense,id:uid("ale-expense"),createdAt:nowIso(),requested};
    onChange({ale:{...ale,expenses:[...expenses,rec]}});
    setExpense(blankExpense);
  }
  function patchExpense(id,field,value){
    onChange({ale:{...ale,expenses:expenses.map(x=>x.id===id?{...x,[field]:value,updatedAt:nowIso()}:x)}});
  }
  function removeExpense(id){ onChange({ale:{...ale,expenses:expenses.filter(x=>x.id!==id)}}); }

  function addExtension(e){
    e.preventDefault();
    const rec={...extension,id:uid("ale-extension"),createdAt:nowIso()};
    onChange({ale:{...ale,extensions:[...extensions,rec]}});
    setExtension(blankExtension);
  }
  function patchExtension(id,field,value){
    onChange({ale:{...ale,extensions:extensions.map(x=>x.id===id?{...x,[field]:value,updatedAt:nowIso()}:x)}});
  }

  const overdue=expenses.filter(x=>x.reimbursementDueDate && new Date(x.reimbursementDueDate+"T23:59:59")<new Date() && x.status!=="Paid");

  return <section>
    <h1>ALE / Loss-of-Use Management Center</h1>
    <p>Track Coverage D expenses, additional-cost calculations, reimbursement status, temporary housing duration, carrier extensions, and limit exhaustion risk.</p>

    <div className="stats">
      <div className="stat"><small>Coverage D limit</small><b>{money(dCoverage.limit)}</b></div>
      <div className="stat"><small>ALE requested</small><b>{money(totals.requested)}</b></div>
      <div className="stat"><small>ALE paid</small><b>{money(totals.paid)}</b></div>
      <div className="stat"><small>Outstanding</small><b>{money(outstanding)}</b></div>
    </div>

    <div className="panel">
      <h2>Loss-of-use period & planning</h2>
      <div className="grid">
        <label>ALE start date<input type="date" value={ale.startDate||""} onChange={e=>patchAle("startDate",e.target.value)}/></label>
        <label>Expected return-home date<input type="date" value={ale.expectedEndDate||""} onChange={e=>patchAle("expectedEndDate",e.target.value)}/></label>
        <label>Policy/time-limit end date<input type="date" value={ale.policyEndDate||""} onChange={e=>patchAle("policyEndDate",e.target.value)}/></label>
        <label>Normal monthly household expense<input type="number" step="0.01" value={ale.baselineMonthlyExpense||""} onChange={e=>patchAle("baselineMonthlyExpense",e.target.value)}/></label>
        <label>Carrier-approved monthly amount<input type="number" step="0.01" value={ale.carrierApprovedMonthly||""} onChange={e=>patchAle("carrierApprovedMonthly",e.target.value)}/></label>
        <label>Remaining limit<input disabled value={money(remainingLimit)}/></label>
        <label>Estimated monthly burn rate<input disabled value={money(burnRate)}/></label>
        <label>Projected exhaustion date<input disabled value={exhaustionDate||"Not enough data"}/></label>
      </div>
      {n(dCoverage.limit)>0 && totals.paid/n(dCoverage.limit)>=0.8 && <div className="release-banner blocked"><b>ALE LIMIT WARNING</b><span>Recorded ALE payments are at or above 80% of the Coverage D limit.</span></div>}
      {ale.policyEndDate && new Date(ale.policyEndDate)<new Date() && <div className="release-banner blocked"><b>TIME-LIMIT WARNING</b><span>The recorded Coverage D time-limit date has passed.</span></div>}
    </div>

    <div className="panel">
      <h2>Add ALE expense</h2>
      <form className="grid" onSubmit={addExpense}>
        <label>Category<select value={expense.category} onChange={e=>setExpense(x=>({...x,category:e.target.value}))}>{categories.map(c=><option key={c}>{c}</option>)}</select></label>
        <label>Vendor / provider<input value={expense.vendor} onChange={e=>setExpense(x=>({...x,vendor:e.target.value}))}/></label>
        <label>Description<input value={expense.description} onChange={e=>setExpense(x=>({...x,description:e.target.value}))}/></label>
        <label>Expense date<input type="date" value={expense.expenseDate} onChange={e=>setExpense(x=>({...x,expenseDate:e.target.value}))}/></label>
        <label>Period start<input type="date" value={expense.periodStart} onChange={e=>setExpense(x=>({...x,periodStart:e.target.value}))}/></label>
        <label>Period end<input type="date" value={expense.periodEnd} onChange={e=>setExpense(x=>({...x,periodEnd:e.target.value}))}/></label>
        <label>Actual expense<input type="number" step="0.01" value={expense.amount} onChange={e=>setExpense(x=>({...x,amount:e.target.value}))}/></label>
        <label>Normal/baseline expense<input type="number" step="0.01" value={expense.normalExpense} onChange={e=>setExpense(x=>({...x,normalExpense:e.target.value}))}/></label>
        <label>Amount requested<input type="number" step="0.01" placeholder="Auto = actual minus normal" value={expense.requested} onChange={e=>setExpense(x=>({...x,requested:e.target.value}))}/></label>
        <label>Carrier approved<input type="number" step="0.01" value={expense.approved} onChange={e=>setExpense(x=>({...x,approved:e.target.value}))}/></label>
        <label>Paid<input type="number" step="0.01" value={expense.paid} onChange={e=>setExpense(x=>({...x,paid:e.target.value}))}/></label>
        <label>Receipt / evidence reference<input value={expense.receiptRef} onChange={e=>setExpense(x=>({...x,receiptRef:e.target.value}))}/></label>
        <label>Reimbursement due date<input type="date" value={expense.reimbursementDueDate} onChange={e=>setExpense(x=>({...x,reimbursementDueDate:e.target.value}))}/></label>
        <label>Status<select value={expense.status} onChange={e=>setExpense(x=>({...x,status:e.target.value}))}><option>Draft</option><option>Submitted</option><option>Approved</option><option>Partially Paid</option><option>Paid</option><option>Disputed</option><option>Denied</option></select></label>
        <label className="wide">Notes<textarea value={expense.notes} onChange={e=>setExpense(x=>({...x,notes:e.target.value}))}/></label>
        <div className="form-action"><button className="primary" type="submit">Add ALE expense</button></div>
      </form>
    </div>

    <div className="table-wrap">
      <table className="ale-table">
        <thead><tr><th>Expense</th><th>Actual</th><th>Normal</th><th>Requested</th><th>Approved</th><th>Paid</th><th>Outstanding</th><th>Due</th><th>Status</th><th></th></tr></thead>
        <tbody>{expenses.map(x=>{
          const req=n(x.requested||Math.max(0,n(x.amount)-n(x.normalExpense)));
          const out=Math.max(0,req-n(x.paid));
          const isOver=x.reimbursementDueDate && new Date(x.reimbursementDueDate+"T23:59:59")<new Date() && x.status!=="Paid";
          return <tr key={x.id}>
            <td><b>{x.category}</b><br/><small>{x.vendor||x.description||""}</small></td>
            <td>{money(x.amount)}</td><td>{money(x.normalExpense)}</td><td>{money(req)}</td><td>{money(x.approved)}</td><td>{money(x.paid)}</td><td>{money(out)}</td>
            <td>{x.reimbursementDueDate}{isOver && <><br/><span className="pill alert">Overdue</span></>}</td>
            <td><select value={x.status||"Submitted"} onChange={e=>patchExpense(x.id,"status",e.target.value)}><option>Draft</option><option>Submitted</option><option>Approved</option><option>Partially Paid</option><option>Paid</option><option>Disputed</option><option>Denied</option></select></td>
            <td><button type="button" onClick={()=>removeExpense(x.id)}>Remove</button></td>
          </tr>;
        })}</tbody>
      </table>
    </div>

    <div className="panel">
      <h2>ALE extension requests</h2>
      <form className="grid" onSubmit={addExtension}>
        <label>Requested through date<input type="date" value={extension.requestedThrough} onChange={e=>setExtension(x=>({...x,requestedThrough:e.target.value}))}/></label>
        <label>Request date<input type="date" value={extension.requestedDate} onChange={e=>setExtension(x=>({...x,requestedDate:e.target.value}))}/></label>
        <label>Additional amount requested<input type="number" step="0.01" value={extension.amountRequested} onChange={e=>setExtension(x=>({...x,amountRequested:e.target.value}))}/></label>
        <label>Status<select value={extension.status} onChange={e=>setExtension(x=>({...x,status:e.target.value}))}><option>Draft</option><option>Submitted</option><option>Under Review</option><option>Approved</option><option>Denied</option><option>Closed</option></select></label>
        <label className="wide">Reason<textarea value={extension.reason} onChange={e=>setExtension(x=>({...x,reason:e.target.value}))}/></label>
        <div className="form-action"><button type="submit">Add extension request</button></div>
      </form>
      <div className="records">{extensions.map(x=><div className="record" key={x.id}>
        <b>Extension through {x.requestedThrough||"date not entered"}</b>
        <span>{money(x.amountRequested)} · {x.status}</span>
        <small>{x.reason}</small>
        <label>Carrier response<input value={x.carrierResponse||""} onChange={e=>patchExtension(x.id,"carrierResponse",e.target.value)}/></label>
        <label>Response date<input type="date" value={x.responseDate||""} onChange={e=>patchExtension(x.id,"responseDate",e.target.value)}/></label>
        <label>Status<select value={x.status} onChange={e=>patchExtension(x.id,"status",e.target.value)}><option>Draft</option><option>Submitted</option><option>Under Review</option><option>Approved</option><option>Denied</option><option>Closed</option></select></label>
      </div>)}</div>
    </div>

    <div className="panel">
      <h2>Draft reimbursement / extension request</h2>
      <DraftRequest claim={claim} ale={ale} totals={totals} outstanding={outstanding} overdue={overdue}/>
    </div>

    <label>Internal ALE notes<textarea value={ale.notes||""} onChange={e=>patchAle("notes",e.target.value)}/></label>
    <p className="notice">ALE eligibility is generally based on covered additional expenses actually incurred and applicable policy terms. Normal living expenses, reasonableness, duration, limits, receipts, mitigation of expense, and any extension remain subject to policy language and human review.</p>
  </section>;
}

function DraftRequest({claim,ale,totals,outstanding,overdue}){
  const [draft,setDraft]=useState("");
  function generate(){
    setDraft([
      "Subject: ALE / Loss-of-Use Status and Reimbursement Request",
      "",
      "Claim: "+(claim.claimNumber||""),
      "Insured: "+(claim.insured||""),
      "",
      "Please review the current Additional Living Expense status. Recorded ALE requested totals "+money(totals.requested)+", with "+money(totals.paid)+" recorded as paid and "+money(outstanding)+" currently outstanding.",
      overdue.length ? "There are "+overdue.length+" reimbursement item(s) with recorded due dates that have passed." : "",
      ale.expectedEndDate ? "The current expected return-home date is "+ale.expectedEndDate+"." : "",
      ale.policyEndDate ? "The recorded policy/time-limit date is "+ale.policyEndDate+"." : "",
      "",
      "Please confirm the status of any outstanding reimbursement and advise whether additional documentation or an extension request is required.",
      "",
      "Draft for human review before sending."
    ].filter(Boolean).join("\n"));
  }
  return <><div className="comm-actions"><button type="button" onClick={generate}>Prepare draft</button></div><label className="wide">Draft<textarea value={draft} onChange={e=>setDraft(e.target.value)}/></label></>;
}
