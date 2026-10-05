import React, { useMemo, useState } from "react";
import { nowIso, uid } from "../lib/storage.js";

const blank = {
  direction: "Inbound",
  channel: "Email",
  party: "",
  subject: "",
  summary: "",
  receivedSentDate: "",
  replyNeeded: true,
  replyCompleted: false,
  followUp: "",
  promiseType: "None",
  promisedDate: "",
  promiseSatisfied: false,
  draftReply: "",
  approvalStatus: "Draft only",
  escalationStatus: "Normal",
  owner: "",
  status: "Open"
};

function isPast(date) {
  if (!date) return false;
  return new Date(date + "T23:59:59").getTime() < Date.now();
}

export default function CommunicationsHub({ claim, onChange }) {
  const [row, setRow] = useState(blank);
  const records = claim.communications || [];

  const metrics = useMemo(() => ({
    open: records.filter(x => x.status !== "Closed").length,
    replyNeeded: records.filter(x => x.status !== "Closed" && x.replyNeeded && !x.replyCompleted).length,
    overduePromises: records.filter(x => x.status !== "Closed" && x.promisedDate && isPast(x.promisedDate) && !x.promiseSatisfied).length,
    escalations: records.filter(x => x.status !== "Closed" && x.escalationStatus === "Escalate").length
  }), [records]);

  function add(e) {
    e.preventDefault();
    if (!row.summary.trim() && !row.subject.trim()) return;
    onChange([...records, { ...row, id: uid("communication"), createdAt: nowIso() }]);
    setRow(blank);
  }

  function patch(id, field, value) {
    onChange(records.map(r => r.id === id ? { ...r, [field]: value, updatedAt: nowIso() } : r));
  }

  function close(id) {
    patch(id, "status", "Closed");
  }

  return (
    <section>
      <h1>Communications & Deadline Hub</h1>
      <p>Track every carrier/client communication, promised action, response date, draft reply, and escalation decision in one claim timeline.</p>

      <div className="stats">
        <div className="stat"><small>Open communications</small><b>{metrics.open}</b></div>
        <div className="stat"><small>Replies needed</small><b>{metrics.replyNeeded}</b></div>
        <div className="stat"><small>Overdue commitments</small><b>{metrics.overduePromises}</b></div>
        <div className="stat"><small>Marked for escalation</small><b>{metrics.escalations}</b></div>
      </div>

      <div className="panel">
        <h2>Add communication</h2>
        <form className="grid" onSubmit={add}>
          <label>Direction<select value={row.direction} onChange={e => setRow(r=>({...r,direction:e.target.value}))}><option>Inbound</option><option>Outbound</option></select></label>
          <label>Channel<select value={row.channel} onChange={e => setRow(r=>({...r,channel:e.target.value}))}><option>Email</option><option>Phone</option><option>Voicemail</option><option>Letter</option><option>Portal</option><option>Text</option><option>In person</option></select></label>
          <label>Party<input placeholder="Adjuster, insured, attorney, contractor..." value={row.party} onChange={e => setRow(r=>({...r,party:e.target.value}))}/></label>
          <label>Owner<input placeholder="Angelo, Nick..." value={row.owner} onChange={e => setRow(r=>({...r,owner:e.target.value}))}/></label>
          <label>Subject<input value={row.subject} onChange={e => setRow(r=>({...r,subject:e.target.value}))}/></label>
          <label>Date<input type="date" value={row.receivedSentDate} onChange={e => setRow(r=>({...r,receivedSentDate:e.target.value}))}/></label>
          <label>Follow-up date<input type="date" value={row.followUp} onChange={e => setRow(r=>({...r,followUp:e.target.value}))}/></label>
          <label>Promise / commitment<select value={row.promiseType} onChange={e => setRow(r=>({...r,promiseType:e.target.value}))}><option>None</option><option>Response</option><option>Decision</option><option>Payment</option><option>Estimate</option><option>Inspection</option><option>Document</option><option>Other</option></select></label>
          <label>Promised date<input type="date" value={row.promisedDate} onChange={e => setRow(r=>({...r,promisedDate:e.target.value}))}/></label>
          <label>Escalation<select value={row.escalationStatus} onChange={e => setRow(r=>({...r,escalationStatus:e.target.value}))}><option>Normal</option><option>Watch</option><option>Escalate</option></select></label>
          <label className="checkbox-label"><input type="checkbox" checked={row.replyNeeded} onChange={e => setRow(r=>({...r,replyNeeded:e.target.checked}))}/>Reply needed</label>
          <label>Approval state<select value={row.approvalStatus} onChange={e => setRow(r=>({...r,approvalStatus:e.target.value}))}><option>Draft only</option><option>Staff reviewed</option><option>Licensed PA approved</option><option>Sent externally</option></select></label>
          <label className="wide">Summary<textarea value={row.summary} onChange={e => setRow(r=>({...r,summary:e.target.value}))}/></label>
          <label className="wide">Draft reply<textarea placeholder="Draft only until approved/sent through a connected delivery workflow." value={row.draftReply} onChange={e => setRow(r=>({...r,draftReply:e.target.value}))}/></label>
          <div className="form-action"><button className="primary" type="submit">Add communication</button></div>
        </form>
      </div>

      <div className="timeline">
        {records.length === 0 && <p className="muted">No communications recorded yet.</p>}
        {[...records].sort((a,b) => String(b.receivedSentDate||b.createdAt).localeCompare(String(a.receivedSentDate||a.createdAt))).map(r => {
          const promiseOverdue = r.promisedDate && isPast(r.promisedDate) && !r.promiseSatisfied && r.status !== "Closed";
          const followOverdue = r.followUp && isPast(r.followUp) && r.status !== "Closed";
          return (
            <div className="timeline-item" key={r.id}>
              <div className="timeline-head">
                <div>
                  <span className="pill">{r.direction}</span>
                  <span className="pill secondary">{r.channel}</span>
                  {r.escalationStatus === "Escalate" && <span className="pill alert">Escalate</span>}
                </div>
                <small>{r.receivedSentDate || r.createdAt}</small>
              </div>
              <b>{r.subject || "Communication"}</b>
              <span>{r.party || "Party not entered"}</span>
              <p>{r.summary}</p>
              {r.promiseType !== "None" && <small><b>Promise:</b> {r.promiseType} by {r.promisedDate || "date not set"}{promiseOverdue ? " — OVERDUE" : ""}</small>}
              {r.followUp && <small><b>Follow-up:</b> {r.followUp}{followOverdue ? " — OVERDUE" : ""}</small>}
              {r.owner && <small><b>Owner:</b> {r.owner}</small>}
              {r.draftReply && <div className="draft-box"><b>Draft reply</b><p>{r.draftReply}</p><small>{r.approvalStatus}</small></div>}
              <div className="comm-actions">
                {r.replyNeeded && !r.replyCompleted && <button type="button" onClick={() => patch(r.id,"replyCompleted",true)}>Mark reply completed</button>}
                {r.promiseType !== "None" && !r.promiseSatisfied && <button type="button" onClick={() => patch(r.id,"promiseSatisfied",true)}>Mark promise satisfied</button>}
                {r.escalationStatus !== "Escalate" && <button type="button" onClick={() => patch(r.id,"escalationStatus","Escalate")}>Escalate</button>}
                {r.status !== "Closed" && <button type="button" onClick={() => close(r.id)}>Close item</button>}
              </div>
            </div>
          );
        })}
      </div>

      <p className="notice">Drafts and approval status are tracked separately from actual sending. This module does not automatically email, text, settle, compromise, or make licensed decisions.</p>
    </section>
  );
}
