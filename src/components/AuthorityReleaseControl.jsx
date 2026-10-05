import React, { useMemo, useState } from "react";
import { nowIso, uid } from "../lib/storage.js";

const approvalStages = [
  "Operational Review",
  "Licensed PA Approval",
  "Client Authorization"
];

const releaseTypes = [
  "Claim Package",
  "Carrier Communication",
  "Settlement Position",
  "Signature Packet"
];

function approvedFor(hash, approvals, stage) {
  return approvals.some(a =>
    a.packageHash === hash &&
    a.stage === stage &&
    /approve|author/i.test(a.decision || "") &&
    !a.revokedAt
  );
}

function signatureValid(hash, signatures) {
  return signatures.some(s =>
    s.packageHash === hash &&
    s.status !== "Revoked" &&
    (s.mode === "In-person witnessed" || s.mode === "Remote verified")
  );
}

export default function AuthorityReleaseControl({ claim, onChange }) {
  const approvals = claim.approvals || [];
  const signatures = claim.signatures || [];
  const releases = claim.releaseRecords || [];
  const latestPackage = (claim.packages || []).at(-1) || null;

  const [approval, setApproval] = useState({
    stage: "Operational Review",
    reviewer: "",
    decision: "Approved",
    notes: ""
  });

  const [signature, setSignature] = useState({
    mode: "In-person witnessed",
    signer: "",
    witness: "",
    noIdRequired: false,
    status: "Recorded"
  });

  const [releaseType, setReleaseType] = useState("Claim Package");
  const [releaseNotes, setReleaseNotes] = useState("");

  const packageHash = latestPackage?.snapshotHash || "";

  const gates = useMemo(() => {
    if (!latestPackage) return {
      package: false,
      operational: false,
      licensed: false,
      client: false,
      signature: false,
      current: false
    };

    const operational = approvedFor(packageHash, approvals, "Operational Review");
    const licensed = approvedFor(packageHash, approvals, "Licensed PA Approval");
    const client = approvedFor(packageHash, approvals, "Client Authorization");
    const signature = signatureValid(packageHash, signatures);

    return {
      package: true,
      operational,
      licensed,
      client,
      signature,
      current: latestPackage.status !== "Superseded"
    };
  }, [latestPackage, approvals, signatures, packageHash]);

  const releaseReady = gates.package && gates.current && gates.operational && gates.licensed && gates.client;

  function addApproval(e) {
    e.preventDefault();
    if (!packageHash || !approval.reviewer.trim()) return;
    const record = {
      ...approval,
      id: uid("approval"),
      packageHash,
      createdAt: nowIso(),
      source: "Authority & Release Control"
    };
    onChange({ approvals: [...approvals, record] });
    setApproval(a => ({ ...a, reviewer: "", notes: "" }));
  }

  function revokeApproval(id) {
    onChange({
      approvals: approvals.map(a => a.id === id ? { ...a, revokedAt: nowIso() } : a)
    });
  }

  function addSignature(e) {
    e.preventDefault();
    if (!packageHash || !signature.signer.trim()) return;
    const record = {
      ...signature,
      id: uid("signature"),
      packageHash,
      createdAt: nowIso()
    };
    onChange({ signatures: [...signatures, record] });
    setSignature(s => ({ ...s, signer: "", witness: "", noIdRequired: false }));
  }

  function attemptRelease() {
    const reasons = [];
    if (!latestPackage) reasons.push("No claim package exists.");
    if (latestPackage && !gates.current) reasons.push("The selected package is superseded.");
    if (!gates.operational) reasons.push("Operational approval missing.");
    if (!gates.licensed) reasons.push("Licensed PA approval missing.");
    if (!gates.client) reasons.push("Client authorization missing.");
    if (releaseType === "Signature Packet" && !gates.signature) reasons.push("No signature record is bound to this package.");

    const status = reasons.length ? "Blocked" : "Ready";
    const record = {
      id: uid("release"),
      releaseType,
      packageHash,
      attemptedAt: nowIso(),
      status,
      reasons,
      notes: releaseNotes,
      externalDeliveryStatus: "Not sent"
    };

    onChange({ releaseRecords: [...releases, record] });
    setReleaseNotes("");
  }

  return (
    <section>
      <h1>Authority & Release Control</h1>
      <p>This module separates operational review, licensed public-adjuster approval, client authorization, signature evidence, and actual external delivery.</p>

      <div className="release-gates">
        <Gate label="Current package" ok={gates.package && gates.current} />
        <Gate label="Operational approval" ok={gates.operational} />
        <Gate label="Licensed PA approval" ok={gates.licensed} />
        <Gate label="Client authorization" ok={gates.client} />
      </div>

      <div className={releaseReady ? "release-banner ready" : "release-banner blocked"}>
        <b>{releaseReady ? "Authority gates satisfied for current package" : "RELEASE BLOCKED"}</b>
        <span>{latestPackage ? "Package: " + latestPackage.name : "No package has been assembled."}</span>
        {packageHash && <code>{packageHash}</code>}
      </div>

      <div className="panel">
        <h2>Record approval</h2>
        <form className="grid" onSubmit={addApproval}>
          <label>Approval stage<select value={approval.stage} onChange={e => setApproval(a=>({...a,stage:e.target.value}))}>{approvalStages.map(x=><option key={x}>{x}</option>)}</select></label>
          <label>Reviewer / authorizing person<input value={approval.reviewer} onChange={e => setApproval(a=>({...a,reviewer:e.target.value}))}/></label>
          <label>Decision<select value={approval.decision} onChange={e => setApproval(a=>({...a,decision:e.target.value}))}><option>Approved</option><option>Rejected</option><option>Needs revision</option><option>Authorized</option></select></label>
          <label>Notes<input value={approval.notes} onChange={e => setApproval(a=>({...a,notes:e.target.value}))}/></label>
          <div className="form-action"><button className="primary" type="submit" disabled={!packageHash}>Record approval</button></div>
        </form>

        <div className="records">
          {approvals.filter(a=>a.packageHash===packageHash).map(a => (
            <div className="record" key={a.id}>
              <b>{a.stage}</b>
              <span>{a.reviewer} — {a.decision}</span>
              <small>{a.createdAt}</small>
              {a.revokedAt ? <span className="pill alert">Revoked</span> : <button type="button" onClick={()=>revokeApproval(a.id)}>Revoke approval</button>}
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <h2>Signature / witness record</h2>
        <form className="grid" onSubmit={addSignature}>
          <label>Mode<select value={signature.mode} onChange={e => setSignature(s=>({...s,mode:e.target.value}))}><option>In-person witnessed</option><option>Remote verified</option><option>Remote unverified</option></select></label>
          <label>Signer<input value={signature.signer} onChange={e => setSignature(s=>({...s,signer:e.target.value}))}/></label>
          <label>Witness / representative<input value={signature.witness} onChange={e => setSignature(s=>({...s,witness:e.target.value}))}/></label>
          <label className="checkbox-label"><input type="checkbox" checked={signature.noIdRequired} onChange={e => setSignature(s=>({...s,noIdRequired:e.target.checked}))}/>No ID required — in-person representative present</label>
          <div className="form-action"><button type="submit" disabled={!packageHash}>Record signature evidence</button></div>
        </form>
        <p className="notice">“No ID required” is an internal in-person workflow flag. It does not convert an unverified remote signature into verified identity and should not bypass provider or legal requirements.</p>
      </div>

      <div className="panel">
        <h2>Release gate test</h2>
        <div className="grid">
          <label>Release type<select value={releaseType} onChange={e=>setReleaseType(e.target.value)}>{releaseTypes.map(x=><option key={x}>{x}</option>)}</select></label>
          <label>Release notes<input value={releaseNotes} onChange={e=>setReleaseNotes(e.target.value)} placeholder="Purpose / intended recipient"/></label>
        </div>
        <button className="primary" type="button" onClick={attemptRelease}>Run release check</button>
        <p className="muted">A “Ready” result does not send anything. External delivery remains a separate connected action.</p>
      </div>

      <div className="records">
        {releases.slice().reverse().map(r => (
          <div className="record" key={r.id}>
            <div className="work-item-head">
              <span className={r.status==="Blocked" ? "pill alert" : "pill system"}>{r.status}</span>
              <span className="pill secondary">{r.releaseType}</span>
            </div>
            <b>{r.attemptedAt}</b>
            {r.reasons?.map((reason,i)=><small key={i}>{reason}</small>)}
            {r.notes && <span>{r.notes}</span>}
            <small>External delivery: {r.externalDeliveryStatus}</small>
          </div>
        ))}
      </div>

      <p className="notice">This control is a software release gate, not a legal opinion. State-specific public-adjuster authority, contract requirements, settlement authority, signatures, and client consent still require appropriate legal/compliance validation before production use.</p>
    </section>
  );
}

function Gate({ label, ok }) {
  return <div className={ok ? "gate ok" : "gate no"}><b>{ok ? "PASS" : "HOLD"}</b><span>{label}</span></div>;
}
