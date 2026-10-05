import React, { useMemo, useState } from "react";
import { nowIso, uid } from "../lib/storage.js";

function money(v) {
  return Number(v || 0).toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function addFinding(list, type, severity, title, detail, sourceRefs = [], coverage = "General") {
  list.push({
    id: uid("ai-finding"),
    type,
    severity,
    title,
    detail,
    coverage,
    sourceRefs,
    createdAt: nowIso(),
    reviewStatus: "Needs human review",
    reviewer: "",
    reviewerNotes: ""
  });
}

function prepareFindings(claim) {
  const findings = [];
  const docs = claim.documents || [];
  const coverages = claim.coverages || [];
  const estimates = claim.estimateComparisons || [];
  const payments = claim.payments || [];
  const comms = claim.communications || [];
  const supplements = claim.supplements || [];
  const recovery = claim.recovery || [];

  if (claim.valuation === "Unreviewed" || !claim.valuationSource) {
    addFinding(findings, "Coverage", "High", "Policy valuation not fully reviewed",
      "The claim lacks a completed valuation review or cited policy provision. No coverage conclusion should be released until a human reviewer confirms the policy basis.",
      [], "General");
  }

  const policyDocs = docs.filter(d => d.category === "Policy / Declarations");
  if (!policyDocs.length) {
    addFinding(findings, "Evidence Gap", "High", "Policy source missing",
      "No policy/declarations evidence record is identified. Coverage analysis should remain provisional.",
      [], "General");
  }

  for (const c of coverages) {
    if (Number(c.requested || 0) > Number(c.limit || 0) && Number(c.limit || 0) > 0) {
      addFinding(findings, "Coverage", "High", c.key + " requested amount exceeds recorded limit",
        "Requested " + money(c.requested) + " exceeds recorded limit " + money(c.limit) + ". Verify limits, endorsements, additional coverages, and data entry.",
        [], c.key);
    }
    if (Number(c.received || 0) > Number(c.issued || 0) && Number(c.issued || 0) > 0) {
      addFinding(findings, "Accounting", "Normal", c.key + " received exceeds issued",
        "Recorded received amount exceeds recorded issued amount. Reconcile the coverage screen and payment ledger.",
        [], c.key);
    }
  }

  const unresolved = estimates.filter(e => e.status !== "Resolved");
  const variance = unresolved.reduce((sum, e) =>
    sum + (Number(e.quantity || 0) * Number(e.adpaUnitPrice || 0)) -
    (Number(e.carrierQuantity || 0) * Number(e.carrierUnitPrice || 0)), 0);

  if (unresolved.length) {
    addFinding(findings, "Estimate Variance", Math.abs(variance) >= 10000 ? "High" : "Normal",
      unresolved.length + " unresolved estimate line(s)",
      "Current unresolved ADPA-versus-carrier variance is " + money(variance) + ". Review quantities, unit prices, scope, sources, and status before relying on the total.",
      unresolved.map(e => e.source).filter(Boolean), "A/B/CODE");
  }

  const ledgerIssued = payments.filter(p => p.status !== "Void").reduce((s,p)=>s+Number(p.amount||0),0);
  const coverageIssued = coverages.reduce((s,c)=>s+Number(c.issued||0),0);
  if (Math.abs(ledgerIssued - coverageIssued) > 0.01) {
    addFinding(findings, "Accounting", "High", "Payment ledger does not reconcile",
      "Payment ledger total " + money(ledgerIssued) + " differs from coverage-issued total " + money(coverageIssued) + ".",
      payments.map(p => p.source).filter(Boolean), "General");
  }

  const overdueComms = comms.filter(c => c.status !== "Closed" && c.followUp && new Date(c.followUp + "T23:59:59").getTime() < Date.now());
  if (overdueComms.length) {
    addFinding(findings, "Follow-up", "High", overdueComms.length + " overdue communication follow-up(s)",
      "Carrier/client communication follow-up dates have passed. Review whether a reply, escalation, or status request is required.",
      overdueComms.map(c => c.id), "General");
  }

  const overduePromises = comms.filter(c => c.status !== "Closed" && c.promisedDate && !c.promiseSatisfied &&
    new Date(c.promisedDate + "T23:59:59").getTime() < Date.now());
  if (overduePromises.length) {
    addFinding(findings, "Carrier Commitment", "High", overduePromises.length + " overdue carrier commitment(s)",
      "A recorded promise for a response, decision, payment, estimate, inspection, or document has passed its promised date.",
      overduePromises.map(c => c.id), "General");
  }

  const openSupplements = supplements.filter(s => !s.carrierResponse);
  if (openSupplements.length) {
    addFinding(findings, "Supplement", "Normal", openSupplements.length + " supplement/dispute item(s) awaiting response",
      "Carrier response is not recorded for one or more supplement/dispute items.",
      openSupplements.map(s => s.id), "General");
  }

  const overdueRecovery = recovery.filter(r => r.status !== "Closed" && r.dueDate &&
    new Date(r.dueDate + "T23:59:59").getTime() < Date.now());
  if (overdueRecovery.length) {
    addFinding(findings, "Depreciation / Recovery", "High", overdueRecovery.length + " recovery item(s) overdue",
      "A depreciation or other recovery follow-up date has passed.",
      overdueRecovery.map(r => r.id), "General");
  }

  const codeCoverage = coverages.find(c => c.key === "CODE");
  const codeEvidence = docs.some(d => d.category === "Code / Permit");
  if (codeCoverage && Number(codeCoverage.requested || 0) > 0 && !codeEvidence) {
    addFinding(findings, "Evidence Gap", "High", "Code/ordinance request lacks code evidence",
      "A Code/Ordinance amount is requested but no code/permit evidence record is identified.",
      [], "CODE");
  }

  if (!findings.length) {
    addFinding(findings, "Readiness", "Low", "No major automated exceptions found",
      "The deterministic shadow review did not identify a major exception. This is not a coverage or settlement conclusion and still requires human review.",
      [], "General");
  }

  return findings;
}

function buildDraftSummary(claim, findings) {
  const requested = (claim.coverages || []).reduce((s,c)=>s+Number(c.requested||0),0);
  const received = (claim.coverages || []).reduce((s,c)=>s+Number(c.received||0),0);
  const high = findings.filter(f=>f.severity==="High").length;
  return [
    "Claim preparation summary — DRAFT / HUMAN REVIEW REQUIRED",
    "",
    "Insured: " + (claim.insured || "Not entered"),
    "Carrier: " + (claim.carrier || "Not entered"),
    "Claim #: " + (claim.claimNumber || "Not entered"),
    "Date of loss: " + (claim.dateOfLoss || "Not entered"),
    "Cause of loss: " + (claim.causeOfLoss || "Not entered"),
    "",
    "Recorded requested total: " + money(requested),
    "Recorded received total: " + money(received),
    "Evidence records: " + (claim.documents || []).length,
    "Open AI findings: " + findings.length + " (" + high + " high priority)",
    "",
    "This draft is generated from structured claim records only. It is not a coverage opinion, settlement authority, legal advice, or an autonomous public-adjuster decision."
  ].join("\n");
}

export default function AIClaimReviewCenter({ claim, onChange }) {
  const aiPrep = claim.aiPrep || { status:"Ready for shadow review", mode:"shadow", runs:[], notes:"" };
  const findings = claim.aiFindings || [];
  const [reviewer, setReviewer] = useState("");
  const [summaryDraft, setSummaryDraft] = useState("");

  const metrics = useMemo(() => ({
    high: findings.filter(f=>f.severity==="High" && f.reviewStatus!=="Resolved").length,
    pending: findings.filter(f=>f.reviewStatus==="Needs human review" || f.reviewStatus==="Unreviewed").length,
    accepted: findings.filter(f=>f.reviewStatus==="Accepted").length,
    resolved: findings.filter(f=>f.reviewStatus==="Resolved").length
  }), [findings]);

  function runShadowReview() {
    const newFindings = prepareFindings(claim);
    const run = {
      id: uid("ai-run"),
      runAt: nowIso(),
      mode: "shadow-deterministic",
      findingCount: newFindings.length,
      highPriorityCount: newFindings.filter(f=>f.severity==="High").length,
      source: "Structured claim record review",
      modelStatus: "External OpenAI API not connected"
    };
    const nextPrep = {
      ...aiPrep,
      status: "Shadow review completed",
      mode: "shadow",
      lastRun: run.runAt,
      runs: [...(aiPrep.runs || []), run]
    };
    onChange({ aiPrep: nextPrep, aiFindings: newFindings });
    setSummaryDraft(buildDraftSummary(claim, newFindings));
  }

  function patchFinding(id, changes) {
    onChange({
      aiFindings: findings.map(f => f.id === id ? { ...f, ...changes, reviewedAt: nowIso() } : f)
    });
  }

  function prepareSummary() {
    setSummaryDraft(buildDraftSummary(claim, findings));
  }

  function saveSummaryAsNote() {
    const nextPrep = {
      ...aiPrep,
      notes: summaryDraft,
      status: "Draft summary saved for human review"
    };
    onChange({ aiPrep: nextPrep });
  }

  return (
    <section>
      <h1>AI Claim Preparation & Review Center</h1>
      <p>Controlled shadow-mode claim preparation. The system may organize, compare, flag, and draft—but licensed judgment, negotiation, settlement, and external sending remain human-controlled.</p>

      <div className="release-banner blocked">
        <b>SHADOW MODE — NO AUTONOMOUS CLAIM DECISIONS</b>
        <span>External OpenAI API document analysis is not connected in this browser-only build.</span>
      </div>

      <div className="stats">
        <div className="stat"><small>AI mode</small><b>{aiPrep.mode || "shadow"}</b></div>
        <div className="stat"><small>High-priority exceptions</small><b>{metrics.high}</b></div>
        <div className="stat"><small>Needs human review</small><b>{metrics.pending}</b></div>
        <div className="stat"><small>Last run</small><b>{aiPrep.lastRun ? new Date(aiPrep.lastRun).toLocaleString() : "Never"}</b></div>
      </div>

      <div className="panel">
        <h2>Run controlled claim review</h2>
        <p>This review uses the structured records already stored in ADPA: coverage amounts, evidence metadata, estimates, payments, communications, supplements, and recovery items.</p>
        <button className="primary" type="button" onClick={runShadowReview}>Run shadow review</button>
      </div>

      <div className="panel">
        <h2>Human reviewer</h2>
        <label>Reviewer name<input value={reviewer} onChange={e=>setReviewer(e.target.value)} placeholder="Licensed PA or authorized reviewer"/></label>
      </div>

      <div className="ai-findings">
        {findings.length===0 && <p className="muted">No AI-prepared findings yet. Run the shadow review to create a review queue.</p>}
        {findings.map(f => (
          <div className={"ai-finding severity-" + f.severity.toLowerCase()} key={f.id}>
            <div className="work-item-head">
              <span className={f.severity==="High" ? "pill alert" : "pill secondary"}>{f.severity}</span>
              <span className="pill system">{f.type}</span>
              <span className="pill secondary">{f.coverage}</span>
            </div>
            <b>{f.title}</b>
            <p>{f.detail}</p>
            {f.sourceRefs?.length>0 && <small><b>Source refs:</b> {f.sourceRefs.join(", ")}</small>}
            <div className="grid compact">
              <label>Review status<select value={f.reviewStatus} onChange={e=>patchFinding(f.id,{reviewStatus:e.target.value,reviewer:reviewer||f.reviewer})}><option>Needs human review</option><option>Accepted</option><option>Rejected</option><option>Resolved</option></select></label>
              <label>Reviewer<input value={f.reviewer||""} onChange={e=>patchFinding(f.id,{reviewer:e.target.value})}/></label>
              <label className="wide">Reviewer notes<textarea value={f.reviewerNotes||""} onChange={e=>patchFinding(f.id,{reviewerNotes:e.target.value})}/></label>
            </div>
          </div>
        ))}
      </div>

      <div className="panel">
        <h2>Draft claim-preparation summary</h2>
        <div className="comm-actions">
          <button type="button" onClick={prepareSummary}>Prepare draft summary</button>
          <button type="button" onClick={saveSummaryAsNote} disabled={!summaryDraft.trim()}>Save draft for review</button>
        </div>
        <label className="wide">Draft<textarea value={summaryDraft} onChange={e=>setSummaryDraft(e.target.value)} placeholder="Generate a structured draft summary, then edit and review it here."/></label>
      </div>

      <div className="panel">
        <h2>AI run history</h2>
        <div className="records">
          {(aiPrep.runs || []).slice().reverse().map(r => (
            <div className="record" key={r.id}>
              <b>{new Date(r.runAt).toLocaleString()}</b>
              <span>{r.mode}</span>
              <small>{r.findingCount} findings · {r.highPriorityCount} high priority</small>
              <small>{r.modelStatus}</small>
            </div>
          ))}
        </div>
      </div>

      <p className="notice">Before production AI activation, ADPA still needs secure server-side API handling, source extraction with page-level citations, model-output logging, prompt/version controls, confidence thresholds, abstention rules, benchmark testing, and role/state authority enforcement.</p>
    </section>
  );
}
