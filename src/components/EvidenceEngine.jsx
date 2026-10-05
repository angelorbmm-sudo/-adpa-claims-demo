import React, { useMemo, useState } from "react";
import { nowIso, uid } from "../lib/storage.js";

const categories = [
  "Policy / Declarations",
  "Carrier Estimate",
  "ADPA / Contractor Estimate",
  "Photo / Video",
  "Receipt / Invoice",
  "Mitigation / Packout",
  "ALE",
  "Contents",
  "Mortgage / Loss Draft",
  "Correspondence",
  "Code / Permit",
  "Other"
];

const coverageOptions = ["General", "A", "B", "C", "D", "CODE"];

async function sha256(file) {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function inferCategory(file) {
  const name = file.name.toLowerCase();
  if (name.includes("policy") || name.includes("declaration") || name.includes("dec")) return "Policy / Declarations";
  if (name.includes("estimate") || name.endsWith(".esx")) return "Carrier Estimate";
  if (name.includes("receipt") || name.includes("invoice")) return "Receipt / Invoice";
  if (name.includes("ale") || name.includes("hotel") || name.includes("rent")) return "ALE";
  if (name.includes("mitigation") || name.includes("packout") || name.includes("storage")) return "Mitigation / Packout";
  if (name.includes("permit") || name.includes("code")) return "Code / Permit";
  if (file.type.startsWith("image/") || file.type.startsWith("video/")) return "Photo / Video";
  return "Other";
}

function evidenceGaps(claim) {
  const docs = claim.documents || [];
  const gaps = [];
  const has = category => docs.some(d => d.category === category);

  if (!has("Policy / Declarations")) gaps.push({ level: "High", text: "Policy / declarations not identified." });
  if (!has("Carrier Estimate") && claim.representationStatus === "Active") gaps.push({ level: "Normal", text: "Carrier estimate not identified." });
  if (!docs.some(d => d.category === "Photo / Video")) gaps.push({ level: "Normal", text: "No photo/video evidence identified." });
  if ((claim.contents || []).length && !docs.some(d => d.category === "Contents" || d.category === "Receipt / Invoice")) {
    gaps.push({ level: "Normal", text: "Contents records exist without linked contents/receipt evidence." });
  }
  if ((claim.receipts || []).length && !has("Receipt / Invoice")) gaps.push({ level: "High", text: "Depreciation/receipt records exist but no receipt/invoice evidence is identified." });
  if ((claim.supplements || []).some(s => String(s.coverage).toUpperCase() === "CODE") && !has("Code / Permit")) {
    gaps.push({ level: "High", text: "Code/ordinance issue exists without code or permit evidence." });
  }
  if ((claim.payments || []).length && !docs.some(d => d.category === "Correspondence" || d.category === "Other")) {
    gaps.push({ level: "Low", text: "Payment ledger exists; verify payment history/check support is uploaded." });
  }
  return gaps;
}

export default function EvidenceEngine({ claim, onChange }) {
  const [pending, setPending] = useState(false);
  const [category, setCategory] = useState("Other");
  const [coverage, setCoverage] = useState("General");
  const [source, setSource] = useState("");
  const [notes, setNotes] = useState("");

  const docs = claim.documents || [];
  const gaps = useMemo(() => evidenceGaps(claim), [claim]);
  const uniqueHashes = new Set(docs.map(d => d.sha256).filter(Boolean));
  const duplicateCount = docs.filter((d, i, arr) => d.sha256 && arr.findIndex(x => x.sha256 === d.sha256) !== i).length;
  const readyCount = docs.filter(d => d.processingStatus === "Ready for review").length;

  async function ingest(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setPending(true);
    const additions = [];
    try {
      for (const file of files) {
        let hash = "";
        let processingStatus = "Ready for review";
        let processingError = "";
        try {
          hash = await sha256(file);
          if (uniqueHashes.has(hash) || additions.some(x => x.sha256 === hash)) {
            processingStatus = "Duplicate detected";
          }
        } catch (err) {
          processingStatus = "Hash failed";
          processingError = String(err?.message || err);
        }

        additions.push({
          id: uid("evidence"),
          createdAt: nowIso(),
          name: file.name,
          size: file.size,
          type: file.type || "application/octet-stream",
          lastModified: file.lastModified || null,
          category: category === "Other" ? inferCategory(file) : category,
          coverage,
          source,
          notes,
          sha256: hash,
          processingStatus,
          processingError,
          storageStatus: "Local selection only — secure object storage pending"
        });
      }
      onChange([...docs, ...additions]);
    } finally {
      setPending(false);
    }
  }

  function patch(id, field, value) {
    onChange(docs.map(d => d.id === id ? { ...d, [field]: value } : d));
  }

  function remove(id) {
    onChange(docs.filter(d => d.id !== id));
  }

  return (
    <section>
      <h1>Evidence Processing & Claim Readiness</h1>
      <p>Every evidence item should preserve its source, coverage relationship, original-file fingerprint, review state, and purpose in the claim.</p>

      <div className="stats">
        <div className="stat"><small>Evidence records</small><b>{docs.length}</b></div>
        <div className="stat"><small>Ready for review</small><b>{readyCount}</b></div>
        <div className="stat"><small>Duplicate records</small><b>{duplicateCount}</b></div>
        <div className="stat"><small>Evidence gaps</small><b>{gaps.length}</b></div>
      </div>

      {gaps.length > 0 && (
        <div className="panel">
          <h2>Evidence gap prompts</h2>
          <div className="records">
            {gaps.map((gap, i) => <div className="record" key={i}><span className="pill secondary">{gap.level}</span><b>{gap.text}</b></div>)}
          </div>
        </div>
      )}

      <div className="panel">
        <h2>Upload defaults</h2>
        <div className="grid">
          <label>Category<select value={category} onChange={e => setCategory(e.target.value)}>{categories.map(x => <option key={x}>{x}</option>)}</select></label>
          <label>Coverage<select value={coverage} onChange={e => setCoverage(e.target.value)}>{coverageOptions.map(x => <option key={x}>{x}</option>)}</select></label>
          <label>Source / received from<input placeholder="Client, carrier, contractor, county..." value={source} onChange={e => setSource(e.target.value)} /></label>
          <label>Notes<input placeholder="What fact does this support?" value={notes} onChange={e => setNotes(e.target.value)} /></label>
        </div>
      </div>

      <label className="dropzone" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); ingest(e.dataTransfer.files); }}>
        <b>{pending ? "Processing file fingerprints..." : "Drag & drop photos, videos, PDFs, estimates, receipts, or other evidence"}</b>
        <span>or tap to choose files</span>
        <input type="file" multiple disabled={pending} onChange={e => ingest(e.target.files)} />
      </label>

      <p className="notice">This build computes a SHA-256 fingerprint in the browser for duplicate detection and integrity tracking. It still does not persist the original file bytes. Production must use private object storage, access controls, retention rules, malware scanning, and reliable upload/retry handling.</p>

      <div className="records">
        {docs.length === 0 && <p className="muted">No evidence records yet.</p>}
        {docs.map(d => (
          <div className="record evidence-record" key={d.id}>
            <div className="evidence-head">
              <div>
                <b>{d.name}</b>
                <small>{d.type || "Unknown type"} · {Number(d.size || 0).toLocaleString()} bytes</small>
              </div>
              <span className="pill secondary">{d.processingStatus || "Legacy record"}</span>
            </div>
            <div className="grid compact">
              <label>Category<select value={d.category || "Other"} onChange={e => patch(d.id, "category", e.target.value)}>{categories.map(x => <option key={x}>{x}</option>)}</select></label>
              <label>Coverage<select value={d.coverage || "General"} onChange={e => patch(d.id, "coverage", e.target.value)}>{coverageOptions.map(x => <option key={x}>{x}</option>)}</select></label>
              <label>Source<input value={d.source || ""} onChange={e => patch(d.id, "source", e.target.value)} /></label>
              <label>Review status<select value={d.reviewStatus || "Unreviewed"} onChange={e => patch(d.id, "reviewStatus", e.target.value)}><option>Unreviewed</option><option>Verified</option><option>Needs clarification</option><option>Rejected</option></select></label>
            </div>
            {d.sha256 && <code>SHA-256: {d.sha256}</code>}
            <small>{d.storageStatus || "Legacy evidence record"}</small>
            {d.processingError && <small>Processing error: {d.processingError}</small>}
            <div><button type="button" onClick={() => remove(d.id)}>Remove record</button></div>
          </div>
        ))}
      </div>
    </section>
  );
}
