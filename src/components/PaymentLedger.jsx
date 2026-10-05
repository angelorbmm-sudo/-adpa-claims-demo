import React, { useMemo, useState } from "react";
import { nowIso, uid } from "../lib/storage.js";

const blank = {
  coverage: "A",
  paymentType: "Indemnity",
  amount: "",
  payee: "",
  issuedDate: "",
  receivedDate: "",
  depositedDate: "",
  checkNumber: "",
  allocation: "",
  source: "",
  status: "Issued"
};

function num(v) { return Number(v || 0); }
function money(v) { return num(v).toLocaleString(undefined, { style: "currency", currency: "USD" }); }

export default function PaymentLedger({ payments, coverages, onChange }) {
  const [row, setRow] = useState(blank);

  const summary = useMemo(() => {
    const byCoverage = {};
    for (const c of coverages || []) byCoverage[c.key] = { issued: 0, received: 0 };
    for (const p of payments) {
      if (!byCoverage[p.coverage]) byCoverage[p.coverage] = { issued: 0, received: 0 };
      byCoverage[p.coverage].issued += num(p.amount);
      if (p.receivedDate || p.status === "Received" || p.status === "Deposited") byCoverage[p.coverage].received += num(p.amount);
    }
    return byCoverage;
  }, [payments, coverages]);

  const total = payments.reduce((s,p) => s + num(p.amount), 0);
  const received = payments.filter(p => p.receivedDate || p.status === "Received" || p.status === "Deposited").reduce((s,p) => s + num(p.amount), 0);

  function submit(e) {
    e.preventDefault();
    onChange([...payments, { ...row, id: uid("payment"), createdAt: nowIso() }]);
    setRow(blank);
  }

  return (
    <section>
      <h1>Detailed Claim Payment Ledger</h1>
      <p>Track each check or electronic payment separately so advances, indemnity, service costs, depreciation, and mortgage-controlled funds are not double-counted.</p>

      <div className="stats">
        <div className="stat"><small>Total entered</small><b>{money(total)}</b></div>
        <div className="stat"><small>Received / deposited</small><b>{money(received)}</b></div>
        <div className="stat"><small>Entries</small><b>{payments.length}</b></div>
        <div className="stat"><small>Unreceived</small><b>{money(total-received)}</b></div>
      </div>

      <form className="grid" onSubmit={submit}>
        <label>Coverage<select value={row.coverage} onChange={e => setRow(r=>({...r,coverage:e.target.value}))}>{(coverages||[]).map(c=><option key={c.key}>{c.key}</option>)}</select></label>
        <label>Payment type<select value={row.paymentType} onChange={e => setRow(r=>({...r,paymentType:e.target.value}))}><option>Indemnity</option><option>Advance</option><option>Recoverable Depreciation</option><option>ALE</option><option>Mitigation</option><option>Packout / Storage</option><option>Mortgage Draw</option><option>Other</option></select></label>
        <label>Amount<input type="number" step="0.01" value={row.amount} onChange={e => setRow(r=>({...r,amount:e.target.value}))} /></label>
        <label>Payee<input value={row.payee} onChange={e => setRow(r=>({...r,payee:e.target.value}))} /></label>
        <label>Issued date<input type="date" value={row.issuedDate} onChange={e => setRow(r=>({...r,issuedDate:e.target.value}))} /></label>
        <label>Received date<input type="date" value={row.receivedDate} onChange={e => setRow(r=>({...r,receivedDate:e.target.value}))} /></label>
        <label>Deposited date<input type="date" value={row.depositedDate} onChange={e => setRow(r=>({...r,depositedDate:e.target.value}))} /></label>
        <label>Check / transaction #<input value={row.checkNumber} onChange={e => setRow(r=>({...r,checkNumber:e.target.value}))} /></label>
        <label>Allocation / explanation<input value={row.allocation} onChange={e => setRow(r=>({...r,allocation:e.target.value}))} /></label>
        <label>Supporting source<input placeholder="Carrier ledger, EOB, check image..." value={row.source} onChange={e => setRow(r=>({...r,source:e.target.value}))} /></label>
        <label>Status<select value={row.status} onChange={e => setRow(r=>({...r,status:e.target.value}))}><option>Issued</option><option>Received</option><option>Deposited</option><option>Void</option><option>Unknown</option></select></label>
        <div className="form-action"><button className="primary" type="submit">Add payment</button></div>
      </form>

      <div className="panel">
        <h2>Coverage reconciliation</h2>
        <div className="table-wrap"><table><thead><tr><th>Coverage</th><th>Ledger issued</th><th>Ledger received</th><th>Coverage screen issued</th><th>Coverage screen received</th><th>Difference</th></tr></thead><tbody>
          {(coverages||[]).map(c => {
            const s = summary[c.key] || {issued:0,received:0};
            return <tr key={c.key}><td>{c.key} — {c.name}</td><td>{money(s.issued)}</td><td>{money(s.received)}</td><td>{money(c.issued)}</td><td>{money(c.received)}</td><td>{money(s.received-num(c.received))}</td></tr>;
          })}
        </tbody></table></div>
      </div>

      <div className="table-wrap"><table><thead><tr><th>Coverage</th><th>Type</th><th>Amount</th><th>Payee</th><th>Issued</th><th>Received</th><th>Status</th><th>Allocation</th><th></th></tr></thead><tbody>
        {payments.map(p => <tr key={p.id}><td>{p.coverage}</td><td>{p.paymentType}</td><td>{money(p.amount)}</td><td>{p.payee}</td><td>{p.issuedDate}</td><td>{p.receivedDate}</td><td>{p.status}</td><td>{p.allocation}</td><td><button type="button" onClick={()=>onChange(payments.filter(x=>x.id!==p.id))}>Remove</button></td></tr>)}
      </tbody></table></div>
      <p className="notice">Ledger entries should be reconciled to carrier payment histories, check images, bank records, or other reliable support. Do not infer receipt solely from an issued amount.</p>
    </section>
  );
}
