import React, { useMemo, useState } from "react";
import { nowIso, uid } from "../lib/storage.js";

const blank = {
  room: "",
  category: "Furniture",
  item: "",
  brand: "",
  model: "",
  quantity: 1,
  ageYears: "",
  condition: "Good",
  replacementSource: "",
  sourceDate: "",
  unitRcv: "",
  depreciationType: "Percentage",
  depreciationPercent: "",
  depreciationAmount: "",
  carrierRcv: "",
  carrierAcv: "",
  carrierDisposition: "Unreviewed",
  lkqStatus: "Needs review",
  status: "Needs review",
  notes: ""
};

function n(v){ return Number(v || 0); }
function money(v){ return n(v).toLocaleString(undefined,{style:"currency",currency:"USD"}); }

function calc(item){
  const qty = Math.max(1,n(item.quantity)||1);
  const rcv = qty*n(item.unitRcv);
  let dep = item.depreciationType==="Amount" ? n(item.depreciationAmount) : rcv*(n(item.depreciationPercent)/100);
  dep = Math.max(0,Math.min(dep,rcv));
  return { rcv, dep, acv: rcv-dep };
}

export default function ContentsValuationCenter({ items, onChange }){
  const [row,setRow]=useState(blank);
  const [roomFilter,setRoomFilter]=useState("All");
  const [statusFilter,setStatusFilter]=useState("All");

  const totals=useMemo(()=>items.reduce((t,i)=>{
    const c=calc(i);
    t.rcv+=c.rcv; t.dep+=c.dep; t.acv+=c.acv;
    t.carrierRcv+=n(i.carrierRcv || i.carrier);
    t.carrierAcv+=n(i.carrierAcv);
    return t;
  },{rcv:0,dep:0,acv:0,carrierRcv:0,carrierAcv:0}),[items]);

  const rooms=[...new Set(items.map(i=>i.room).filter(Boolean))].sort();
  const visible=items.filter(i=>(roomFilter==="All"||i.room===roomFilter)&&(statusFilter==="All"||i.status===statusFilter));

  function add(e){
    e.preventDefault();
    if(!row.item.trim()) return;
    onChange([...items,{...row,id:uid("content"),createdAt:nowIso(),quantity:Math.max(1,n(row.quantity)||1)}]);
    setRow(blank);
  }

  function patch(id,field,value){ onChange(items.map(i=>i.id===id?{...i,[field]:value,updatedAt:nowIso()}:i)); }
  function remove(id){ onChange(items.filter(i=>i.id!==id)); }

  return <section>
    <h1>Contents Valuation & LKQ Review Center</h1>
    <p>Coverage C item-level valuation with replacement-cost support, depreciation, carrier comparison, and human LKQ review.</p>

    <div className="stats">
      <div className="stat"><small>ADPA RCV</small><b>{money(totals.rcv)}</b></div>
      <div className="stat"><small>ADPA depreciation</small><b>{money(totals.dep)}</b></div>
      <div className="stat"><small>ADPA ACV</small><b>{money(totals.acv)}</b></div>
      <div className="stat"><small>RCV variance vs carrier</small><b>{money(totals.rcv-totals.carrierRcv)}</b></div>
    </div>

    <div className="panel">
      <h2>Add contents item</h2>
      <form className="grid" onSubmit={add}>
        <label>Room<input value={row.room} onChange={e=>setRow(r=>({...r,room:e.target.value}))}/></label>
        <label>Category<select value={row.category} onChange={e=>setRow(r=>({...r,category:e.target.value}))}><option>Furniture</option><option>Electronics</option><option>Clothing</option><option>Kitchen</option><option>Appliance</option><option>Jewelry</option><option>Tools</option><option>Decor</option><option>Books / Media</option><option>Sporting Goods</option><option>Other</option></select></label>
        <label>Item<input value={row.item} onChange={e=>setRow(r=>({...r,item:e.target.value}))}/></label>
        <label>Brand<input value={row.brand} onChange={e=>setRow(r=>({...r,brand:e.target.value}))}/></label>
        <label>Model / description<input value={row.model} onChange={e=>setRow(r=>({...r,model:e.target.value}))}/></label>
        <label>Quantity<input type="number" min="1" value={row.quantity} onChange={e=>setRow(r=>({...r,quantity:e.target.value}))}/></label>
        <label>Age (years)<input type="number" step="0.1" value={row.ageYears} onChange={e=>setRow(r=>({...r,ageYears:e.target.value}))}/></label>
        <label>Condition<select value={row.condition} onChange={e=>setRow(r=>({...r,condition:e.target.value}))}><option>Excellent</option><option>Good</option><option>Fair</option><option>Poor</option></select></label>
        <label>Replacement source<input placeholder="Retailer / URL / quote reference" value={row.replacementSource} onChange={e=>setRow(r=>({...r,replacementSource:e.target.value}))}/></label>
        <label>Source date<input type="date" value={row.sourceDate} onChange={e=>setRow(r=>({...r,sourceDate:e.target.value}))}/></label>
        <label>Unit RCV<input type="number" step="0.01" value={row.unitRcv} onChange={e=>setRow(r=>({...r,unitRcv:e.target.value}))}/></label>
        <label>Depreciation type<select value={row.depreciationType} onChange={e=>setRow(r=>({...r,depreciationType:e.target.value}))}><option>Percentage</option><option>Amount</option></select></label>
        {row.depreciationType==="Percentage"
          ? <label>Depreciation %<input type="number" step="0.1" value={row.depreciationPercent} onChange={e=>setRow(r=>({...r,depreciationPercent:e.target.value}))}/></label>
          : <label>Depreciation amount<input type="number" step="0.01" value={row.depreciationAmount} onChange={e=>setRow(r=>({...r,depreciationAmount:e.target.value}))}/></label>}
        <label>Carrier RCV<input type="number" step="0.01" value={row.carrierRcv} onChange={e=>setRow(r=>({...r,carrierRcv:e.target.value}))}/></label>
        <label>Carrier ACV<input type="number" step="0.01" value={row.carrierAcv} onChange={e=>setRow(r=>({...r,carrierAcv:e.target.value}))}/></label>
        <label>Carrier disposition<select value={row.carrierDisposition} onChange={e=>setRow(r=>({...r,carrierDisposition:e.target.value}))}><option>Unreviewed</option><option>Accepted</option><option>Reduced</option><option>Denied</option><option>Cleanable</option><option>Repairable</option></select></label>
        <label>LKQ status<select value={row.lkqStatus} onChange={e=>setRow(r=>({...r,lkqStatus:e.target.value}))}><option>Needs review</option><option>Supported</option><option>Questionable</option><option>Alternate found</option></select></label>
        <label>Review status<select value={row.status} onChange={e=>setRow(r=>({...r,status:e.target.value}))}><option>Needs review</option><option>Supported</option><option>Disputed</option><option>Resolved</option></select></label>
        <label className="wide">Notes<textarea value={row.notes} onChange={e=>setRow(r=>({...r,notes:e.target.value}))}/></label>
        <div className="form-action"><button className="primary" type="submit">Add contents item</button></div>
      </form>
    </div>

    <div className="panel">
      <h2>Filters</h2>
      <div className="grid">
        <label>Room<select value={roomFilter} onChange={e=>setRoomFilter(e.target.value)}><option>All</option>{rooms.map(r=><option key={r}>{r}</option>)}</select></label>
        <label>Status<select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option>All</option><option>Needs review</option><option>Supported</option><option>Disputed</option><option>Resolved</option></select></label>
      </div>
    </div>

    <div className="table-wrap">
      <table className="contents-table">
        <thead><tr><th>Room / Item</th><th>Qty</th><th>Source</th><th>ADPA RCV</th><th>Dep.</th><th>ADPA ACV</th><th>Carrier RCV</th><th>Variance</th><th>LKQ</th><th>Status</th><th></th></tr></thead>
        <tbody>{visible.map(i=>{
          const c=calc(i); const variance=c.rcv-n(i.carrierRcv||i.carrier);
          return <tr key={i.id}>
            <td><b>{i.item}</b><br/><small>{i.room||"No room"} · {[i.brand,i.model].filter(Boolean).join(" ")}</small></td>
            <td>{i.quantity||1}</td>
            <td>{i.replacementSource||<span className="pill alert">Missing</span>}</td>
            <td>{money(c.rcv)}</td>
            <td>{money(c.dep)}</td>
            <td>{money(c.acv)}</td>
            <td>{money(i.carrierRcv||i.carrier)}</td>
            <td>{money(variance)}</td>
            <td><select value={i.lkqStatus||"Needs review"} onChange={e=>patch(i.id,"lkqStatus",e.target.value)}><option>Needs review</option><option>Supported</option><option>Questionable</option><option>Alternate found</option></select></td>
            <td><select value={i.status||"Needs review"} onChange={e=>patch(i.id,"status",e.target.value)}><option>Needs review</option><option>Supported</option><option>Disputed</option><option>Resolved</option></select></td>
            <td><button type="button" onClick={()=>remove(i.id)}>Remove</button></td>
          </tr>;
        })}</tbody>
      </table>
    </div>

    <div className="panel">
      <h2>Carrier comparison</h2>
      <div className="table-wrap"><table><thead><tr><th>Measure</th><th>ADPA</th><th>Carrier</th><th>Difference</th></tr></thead><tbody>
        <tr><td>RCV</td><td>{money(totals.rcv)}</td><td>{money(totals.carrierRcv)}</td><td>{money(totals.rcv-totals.carrierRcv)}</td></tr>
        <tr><td>ACV</td><td>{money(totals.acv)}</td><td>{money(totals.carrierAcv)}</td><td>{money(totals.acv-totals.carrierAcv)}</td></tr>
      </tbody></table></div>
    </div>

    <p className="notice">LKQ support should identify a reasonably comparable replacement item and source. Depreciation assumptions, special limits, matching, repairability/cleanability, condition, and policy valuation remain subject to policy language and human review.</p>
  </section>;
}
