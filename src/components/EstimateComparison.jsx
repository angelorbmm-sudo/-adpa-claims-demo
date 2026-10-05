import React, { useMemo, useState } from "react";
import { nowIso, uid } from "../lib/storage.js";

const blank = {
  room: "",
  trade: "",
  description: "",
  quantity: "",
  unit: "",
  adpaUnitPrice: "",
  carrierQuantity: "",
  carrierUnitPrice: "",
  coverage: "A",
  source: "",
  status: "Needs review"
};

function number(v) { return Number(v || 0); }
function money(v) {
  return number(v).toLocaleString(undefined, { style: "currency", currency: "USD" });
}

export default function EstimateComparison({ records, onChange }) {
  const [row, setRow] = useState(blank);

  const totals = useMemo(() => records.reduce((t, r) => {
    const adpa = number(r.quantity) * number(r.adpaUnitPrice);
    const carrier = number(r.carrierQuantity) * number(r.carrierUnitPrice);
    t.adpa += adpa;
    t.carrier += carrier;
    t.variance += adpa - carrier;
    return t;
  }, { adpa: 0, carrier: 0, variance: 0 }), [records]);

  function submit(e) {
    e.preventDefault();
    const record = {
      ...row,
      id: uid("estimate-line"),
      createdAt: nowIso()
    };
    onChange([...records, record]);
    setRow(blank);
  }

  function remove(id) {
    onChange(records.filter(r => r.id !== id));
  }

  return (
    <section>
      <h1>Carrier vs ADPA Estimate Comparison</h1>
      <p>Use this module for dwelling / structure estimate differences. Each variance should explain what differs and what source supports the ADPA position.</p>

      <div className="stats">
        <div className="stat"><small>ADPA supported total</small><b>{money(totals.adpa)}</b></div>
        <div className="stat"><small>Carrier total</small><b>{money(totals.carrier)}</b></div>
        <div className="stat"><small>Current variance</small><b>{money(totals.variance)}</b></div>
        <div className="stat"><small>Lines requiring review</small><b>{records.filter(r => r.status !== "Resolved").length}</b></div>
      </div>

      <form onSubmit={submit} className="grid">
        <label>Coverage<select value={row.coverage} onChange={e => setRow(r => ({...r, coverage:e.target.value}))}><option>A</option><option>B</option><option>CODE</option></select></label>
        <label>Room / area<input value={row.room} onChange={e => setRow(r => ({...r, room:e.target.value}))} /></label>
        <label>Trade<input placeholder="Drywall, paint, roofing..." value={row.trade} onChange={e => setRow(r => ({...r, trade:e.target.value}))} /></label>
        <label>Description<input value={row.description} onChange={e => setRow(r => ({...r, description:e.target.value}))} /></label>
        <label>ADPA quantity<input type="number" step="any" value={row.quantity} onChange={e => setRow(r => ({...r, quantity:e.target.value}))} /></label>
        <label>Unit<input placeholder="SF, LF, EA..." value={row.unit} onChange={e => setRow(r => ({...r, unit:e.target.value}))} /></label>
        <label>ADPA unit price<input type="number" step="0.01" value={row.adpaUnitPrice} onChange={e => setRow(r => ({...r, adpaUnitPrice:e.target.value}))} /></label>
        <label>Carrier quantity<input type="number" step="any" value={row.carrierQuantity} onChange={e => setRow(r => ({...r, carrierQuantity:e.target.value}))} /></label>
        <label>Carrier unit price<input type="number" step="0.01" value={row.carrierUnitPrice} onChange={e => setRow(r => ({...r, carrierUnitPrice:e.target.value}))} /></label>
        <label>Source / rationale<input placeholder="Estimate page, photo, code, contractor..." value={row.source} onChange={e => setRow(r => ({...r, source:e.target.value}))} /></label>
        <label>Review status<select value={row.status} onChange={e => setRow(r => ({...r, status:e.target.value}))}><option>Needs review</option><option>Supported</option><option>Disputed</option><option>Resolved</option></select></label>
        <div className="form-action"><button className="primary" type="submit">Add comparison line</button></div>
      </form>

      <div className="table-wrap">
        <table>
          <thead><tr><th>Coverage</th><th>Room / trade</th><th>Description</th><th>ADPA</th><th>Carrier</th><th>Variance</th><th>Source</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {records.map(r => {
              const adpa = number(r.quantity) * number(r.adpaUnitPrice);
              const carrier = number(r.carrierQuantity) * number(r.carrierUnitPrice);
              return <tr key={r.id}>
                <td>{r.coverage}</td>
                <td>{r.room}<br/><small>{r.trade}</small></td>
                <td>{r.description}</td>
                <td>{money(adpa)}</td>
                <td>{money(carrier)}</td>
                <td>{money(adpa-carrier)}</td>
                <td>{r.source}</td>
                <td>{r.status}</td>
                <td><button type="button" onClick={() => remove(r.id)}>Remove</button></td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
      <p className="notice">This comparison is a working analysis. It does not itself establish coverage, entitlement, code applicability, or settlement authority. Preserve estimate versions and supporting sources.</p>
    </section>
  );
}
