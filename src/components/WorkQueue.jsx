import React, { useMemo, useState } from "react";
import { nowIso, uid } from "../lib/storage.js";

const buckets = [
  "Intake / Evidence",
  "Coverage Review",
  "Estimating",
  "Contents",
  "ALE / Loss of Use",
  "Mortgage Loss Draft",
  "Accounting / Depreciation",
  "Carrier Follow-up",
  "Licensed PA / Client Approval"
];

const priorities = ["Critical", "High", "Normal", "Low"];

function isPast(date) {
  if (!date) return false;
  const end = new Date(date + "T23:59:59");
  return end.getTime() < Date.now();
}

function daysOld(iso) {
  if (!iso) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
}

function money(v) {
  return Number(v || 0).toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function paymentMismatch(claim) {
  const ledger = (claim.payments || []).filter(p => p.status !== "Void").reduce((s, p) => s + Number(p.amount || 0), 0);
  const coverage = (claim.coverages || []).reduce((s, c) => s + Number(c.issued || 0), 0);
  return Math.abs(ledger - coverage) > 0.01 ? ledger - coverage : 0;
}

function systemExceptions(claim) {
  const out = [];
  const add = (bucket, priority, title, reason, targetTab) => out.push({
    id: "system-" + claim.id + "-" + out.length,
    claimId: claim.id,
    bucket,
    priority,
    title,
    reason,
    targetTab,
    system: true,
    status: "Open"
  });

  if (!claim.carrier || !claim.claimNumber || !claim.dateOfLoss) {
    add("Intake / Evidence", "High", "Incomplete claim intake", "Carrier, claim number, or date of loss is missing.", "intake");
  }

  if (!claim.documents?.length) {
    add("Intake / Evidence", "Normal", "No evidence files recorded", "The claim has no evidence/document records yet.", "evidence");
  }

  if (claim.valuation === "Unreviewed" || !claim.valuationSource || !claim.valuationReviewer) {
    add("Coverage Review", "High", "Coverage / valuation review incomplete", "Valuation type, source provision, or reviewer is missing.", "coverage");
  }

  const policy = claim.policyAnalysis || {};
  const policyConflicts = (policy.conflicts || []).filter(x => x.status !== "Resolved");
  if (policyConflicts.length) {
    add("Coverage Review", "Critical", policyConflicts.length + " unresolved policy conflict(s)",
      "Declarations, endorsements, or provisions contain unresolved interpretation conflicts.", "policy");
  }

  const policyOpenProvisions = (policy.provisions || []).filter(x => x.status === "Needs review" || x.status === "Conflict");
  if (policyOpenProvisions.length) {
    add("Coverage Review", "High", policyOpenProvisions.length + " policy provision(s) need confirmation",
      "Material policy provisions have not been confirmed by a human reviewer.", "policy");
  }

  const policyOpenEndorsements = (policy.endorsements || []).filter(x => x.status !== "Reviewed");
  if (policyOpenEndorsements.length) {
    add("Coverage Review", "Normal", policyOpenEndorsements.length + " endorsement(s) need review",
      "One or more recorded endorsements have not been fully reviewed.", "policy");
  }

  if ((policy.declarations || []).length && policy.reviewStatus !== "Confirmed") {
    add("Coverage Review", "Normal", "Policy analysis not fully confirmed",
      "Policy/declarations data is present but reviewer confirmation is not complete.", "policy");
  }

  const unresolvedEstimate = (claim.estimateComparisons || []).filter(x => x.status !== "Resolved");
  if (unresolvedEstimate.length) {
    const variance = unresolvedEstimate.reduce((sum, r) =>
      sum + ((Number(r.quantity || 0) * Number(r.adpaUnitPrice || 0)) -
      (Number(r.carrierQuantity || 0) * Number(r.carrierUnitPrice || 0))), 0);
    add("Estimating", Math.abs(variance) >= 10000 ? "High" : "Normal",
      unresolvedEstimate.length + " estimate comparison line(s) unresolved",
      "Current unresolved variance: " + money(variance) + ".", "estimates");
  }

  const contents = claim.contents || [];
  const contentsNeedsReview = contents.filter(x => !x.status || x.status === "Needs review" || x.status === "Pending");
  if (contentsNeedsReview.length) {
    add("Contents", "Normal", contentsNeedsReview.length + " contents item(s) need review", "Contents records are not fully reviewed.", "contents");
  }

  const contentsMissingSource = contents.filter(x => Number(x.rcv || 0) > 0 && !x.replacementSource);
  if (contentsMissingSource.length) {
    add("Contents", "High", contentsMissingSource.length + " contents item(s) lack replacement support",
      "RCV is entered without a replacement source or pricing reference.", "contents");
  }

  const contentsVariance = contents.reduce((sum, x) => sum + ((Number(x.rcv || 0) * Number(x.quantity || 1)) - Number(x.carrierRcv || x.carrier || 0)), 0);
  if (Math.abs(contentsVariance) >= 5000) {
    add("Contents", "High", "Material contents valuation variance",
      "Current ADPA-versus-carrier contents RCV variance is " + money(contentsVariance) + ".", "contents");
  }

  const ale = claim.ale || {};
  const aleExpenses = ale.expenses || [];
  const aleOutstanding = aleExpenses.filter(x => x.status !== "Paid").reduce((s,x)=>s+Number(x.requested||x.amount||0)-Number(x.paid||0),0);
  const aleOverdue = aleExpenses.filter(x => x.reimbursementDueDate && isPast(x.reimbursementDueDate) && x.status !== "Paid");
  if (aleOverdue.length) {
    add("ALE / Loss of Use", "High", aleOverdue.length + " ALE reimbursement item(s) overdue",
      "One or more ALE reimbursement due dates have passed.", "ale");
  }
  if (aleOutstanding > 0) {
    add("ALE / Loss of Use", "Normal", "ALE reimbursement outstanding",
      "Current recorded ALE outstanding amount is " + money(aleOutstanding) + ".", "ale");
  }
  const dCoverage = (claim.coverages || []).find(c=>c.key==="D");
  const paidAle = aleExpenses.reduce((s,x)=>s+Number(x.paid||0),0);
  if (dCoverage && Number(dCoverage.limit||0)>0 && paidAle/Number(dCoverage.limit||1)>=0.8) {
    add("ALE / Loss of Use", "High", "ALE limit is approaching exhaustion",
      "Recorded ALE paid amount has reached at least 80% of the Coverage D limit.", "ale");
  }
  const openExtensions = (ale.extensions || []).filter(x=>x.status!=="Approved" && x.status!=="Closed");
  if (openExtensions.length) {
    add("ALE / Loss of Use", "Normal", openExtensions.length + " ALE extension request(s) open",
      "One or more ALE extension requests remain unresolved.", "ale");
  }

  const mismatch = paymentMismatch(claim);
  if (mismatch) {
    add("Accounting / Depreciation", "High", "Payment ledger does not reconcile",
      "Ledger vs coverage-issued difference is " + money(mismatch) + ".", "payments");
  }

  const openRecovery = (claim.recovery || []).filter(x => x.status !== "Closed");
  const overdueRecovery = openRecovery.filter(x => isPast(x.dueDate));
  if (overdueRecovery.length) {
    add("Accounting / Depreciation", "High", overdueRecovery.length + " recovery item(s) overdue",
      "Recoverable depreciation or other recovery follow-up date has passed.", "recovery");
  }

  const comms = claim.communications || [];
  const overdueComms = comms.filter(x => x.status !== "Closed" && x.followUp && isPast(x.followUp));
  if (overdueComms.length) {
    add("Carrier Follow-up", "High", overdueComms.length + " carrier follow-up(s) overdue",
      "A recorded communication follow-up date has passed.", "communications");
  }

  const promised = comms.filter(x => x.status !== "Closed" && x.promisedDate && isPast(x.promisedDate) && !x.promiseSatisfied);
  if (promised.length) {
    add("Carrier Follow-up", "High", promised.length + " carrier commitment(s) overdue",
      "A promised response, payment, estimate, inspection, or decision date has passed.", "communications");
  }

  const replyNeeded = comms.filter(x => x.status !== "Closed" && x.replyNeeded && !x.replyCompleted);
  if (replyNeeded.length) {
    add("Carrier Follow-up", "Normal", replyNeeded.length + " communication(s) need a reply",
      "One or more inbound communications are marked reply-needed.", "communications");
  }

  const escalations = comms.filter(x => x.status !== "Closed" && x.escalationStatus === "Escalate");
  if (escalations.length) {
    add("Carrier Follow-up", "High", escalations.length + " communication item(s) marked for escalation",
      "A communication has reached its escalation threshold.", "communications");
  }

  const supplements = claim.supplements || [];
  const openSupplements = supplements.filter(x => !["Resolved","Closed","Approved"].includes(x.status));
  if (openSupplements.length) {
    add("Carrier Follow-up", "Normal", openSupplements.length + " supplement/dispute item(s) open",
      "One or more supplement or dispute items remain unresolved.", "supplements");
  }

  const overdueSupplements = supplements.filter(x => x.responseDueDate && isPast(x.responseDueDate) && !["Resolved","Closed","Approved"].includes(x.status));
  if (overdueSupplements.length) {
    add("Carrier Follow-up", "High", overdueSupplements.length + " supplement response(s) overdue",
      "Carrier response due date has passed for one or more supplement/dispute items.", "supplements");
  }

  const supplementVariance = supplements.reduce((sum,x)=>sum + Math.max(0, Number(x.requested||0)-Number(x.approvedAmount||0)),0);
  if (supplementVariance >= 5000) {
    add("Estimating", "High", "Material unresolved supplement variance",
      "Unresolved supplement/dispute variance totals " + money(supplementVariance) + ".", "supplements");
  }

  const escalatedSupplements = supplements.filter(x => ["DOI","Appraisal","Counsel","Executive Review"].includes(x.escalationLevel) && !["Resolved","Closed"].includes(x.status));
  if (escalatedSupplements.length) {
    add("Carrier Follow-up", "High", escalatedSupplements.length + " dispute item(s) at elevated escalation",
      "One or more disputes are marked for DOI, appraisal, counsel, or executive review.", "supplements");
  }

  const mortgage = claim.mortgage || {};
  const mortgageDraws = mortgage.draws || [];
  const mortgageConditions = mortgage.conditions || [];
  const openDraws = mortgageDraws.filter(x => !["Released","Closed"].includes(x.status));
  const overdueDraws = openDraws.filter(x => x.dueDate && isPast(x.dueDate));
  if (overdueDraws.length) {
    add("Mortgage Loss Draft", "High", overdueDraws.length + " mortgage draw item(s) overdue",
      "A lender draw due/follow-up date has passed without release or closure.", "mortgage");
  }

  const incompleteMortgageConditions = mortgageConditions.filter(x => !["Complete","Waived"].includes(x.status));
  if (incompleteMortgageConditions.length) {
    add("Mortgage Loss Draft", "Normal", incompleteMortgageConditions.length + " lender condition(s) incomplete",
      "Mortgage loss-draft release conditions remain incomplete.", "mortgage");
  }

  const mortgageReleased = mortgageDraws.reduce((s,x)=>s+Number(x.releasedAmount||0),0) + Number(mortgage.initialRelease||0);
  if (Number(mortgage.heldBalance||0) > mortgageReleased && mortgage.endorsementStatus === "Complete") {
    add("Mortgage Loss Draft", "Normal", "Insurance proceeds remain held",
      "Recorded held funds exceed recorded released funds after endorsement completion.", "mortgage");
  }

  const inspectionRequired = openDraws.some(x => x.inspectionRequired || x.status === "Inspection Required");
  if (inspectionRequired && !(mortgage.inspections || []).length) {
    add("Mortgage Loss Draft", "High", "Inspection required for open draw",
      "An open mortgage draw requires an inspection, but no inspection record is present.", "mortgage");
  }

  const latestPackage = (claim.packages || []).at(-1);
  if (latestPackage) {
    const packageHash = latestPackage.snapshotHash;
    const operational = (claim.approvals || []).some(a => a.stage?.toLowerCase().includes("operational") && a.packageHash === packageHash && /approve/i.test(a.decision || ""));
    const licensed = (claim.approvals || []).some(a => a.stage?.toLowerCase().includes("licensed") && a.packageHash === packageHash && /approve/i.test(a.decision || ""));
    const client = (claim.approvals || []).some(a => a.stage?.toLowerCase().includes("client") && a.packageHash === packageHash && /approve|author/i.test(a.decision || ""));
    if (!operational) {
      add("Licensed PA / Client Approval", "High", "Operational approval missing", "Current claim package lacks matching operational approval.", "approvals");
    } else if (!licensed) {
      add("Licensed PA / Client Approval", "Critical", "Licensed PA approval missing", "Current claim package is not bound to an approved licensed-PA record.", "approvals");
    } else if (!client) {
      add("Licensed PA / Client Approval", "High", "Client authorization missing", "Current package lacks matching client authorization.", "approvals");
    }

    const blockedRelease = (claim.releaseRecords || []).some(r => r.packageHash === packageHash && r.status === "Blocked");
    if (blockedRelease) {
      add("Licensed PA / Client Approval", "Critical", "Release gate blocked",
        "A release attempt for the current package is blocked by authority controls.", "approvals");
    }
  }

  const pendingAi = (claim.aiFindings || []).filter(f => f.reviewStatus === "Needs human review" || f.reviewStatus === "Unreviewed");
  if (pendingAi.length) {
    add("Coverage Review", "Normal", pendingAi.length + " AI finding(s) need human review",
      "AI-prepared observations are not final until reviewed by an authorized human.", "ai");
  }

  const aiHigh = (claim.aiFindings || []).filter(f => f.severity === "High" && f.reviewStatus !== "Resolved");
  if (aiHigh.length) {
    add("Coverage Review", "High", aiHigh.length + " high-priority AI exception(s)",
      "High-priority claim-preparation exceptions require human review.", "ai");
  }

  const age = daysOld(claim.updatedAt);
  if (age !== null && age >= 7 && claim.representationStatus === "Active") {
    add("Carrier Follow-up", "Normal", "Claim has been quiet for " + age + " days",
      "No claim update has been saved in at least 7 days.", "overview");
  }

  return out;
}

export default function WorkQueue({ claims, selectedId, onOpenClaim, onUpdateClaim }) {
  const [bucket, setBucket] = useState("All");
  const [priority, setPriority] = useState("All");
  const [manual, setManual] = useState({
    claimId: selectedId || claims[0]?.id || "",
    bucket: "Carrier Follow-up",
    priority: "Normal",
    title: "",
    owner: "",
    dueDate: "",
    notes: ""
  });

  const items = useMemo(() => {
    const system = claims.flatMap(systemExceptions);
    const user = claims.flatMap(c => (c.workItems || []).map(x => ({ ...x, claimId: c.id, system: false })));
    return [...system, ...user].sort((a, b) => {
      const rank = { Critical: 0, High: 1, Normal: 2, Low: 3 };
      return (rank[a.priority] ?? 9) - (rank[b.priority] ?? 9);
    });
  }, [claims]);

  const visible = items.filter(x =>
    (bucket === "All" || x.bucket === bucket) &&
    (priority === "All" || x.priority === priority) &&
    x.status !== "Closed"
  );

  const counts = useMemo(() => ({
    critical: items.filter(x => x.status !== "Closed" && x.priority === "Critical").length,
    high: items.filter(x => x.status !== "Closed" && x.priority === "High").length,
    overdue: items.filter(x => x.status !== "Closed" && x.dueDate && isPast(x.dueDate)).length,
    total: items.filter(x => x.status !== "Closed").length
  }), [items]);

  function addManual(e) {
    e.preventDefault();
    if (!manual.claimId || !manual.title.trim()) return;
    const item = { ...manual, id: uid("work"), createdAt: nowIso(), status: "Open" };
    onUpdateClaim(manual.claimId, claim => ({ ...claim, workItems: [...(claim.workItems || []), item] }));
    setManual(m => ({ ...m, title: "", owner: "", dueDate: "", notes: "" }));
  }

  function closeManual(item) {
    onUpdateClaim(item.claimId, claim => ({
      ...claim,
      workItems: (claim.workItems || []).map(x => x.id === item.id ? { ...x, status: "Closed", closedAt: nowIso() } : x)
    }));
  }

  const claimName = id => claims.find(c => c.id === id)?.insured || "Unnamed Claim";

  return (
    <section>
      <h1>ADPA Work Queue & Exception Routing</h1>
      <p>This queue converts claim records into actionable review work. System exceptions are derived from current claim data; manual work items can be assigned separately.</p>

      <div className="stats">
        <div className="stat"><small>Open items</small><b>{counts.total}</b></div>
        <div className="stat"><small>Critical</small><b>{counts.critical}</b></div>
        <div className="stat"><small>High priority</small><b>{counts.high}</b></div>
        <div className="stat"><small>Overdue manual items</small><b>{counts.overdue}</b></div>
      </div>

      <div className="panel">
        <h2>Queue filters</h2>
        <div className="grid">
          <label>Bucket<select value={bucket} onChange={e => setBucket(e.target.value)}><option>All</option>{buckets.map(x => <option key={x}>{x}</option>)}</select></label>
          <label>Priority<select value={priority} onChange={e => setPriority(e.target.value)}><option>All</option>{priorities.map(x => <option key={x}>{x}</option>)}</select></label>
        </div>
      </div>

      <div className="work-queue">
        {visible.length === 0 && <p className="muted">No open work items match these filters.</p>}
        {visible.map(item => (
          <div className={"work-item priority-" + item.priority.toLowerCase()} key={item.id}>
            <div className="work-item-main">
              <div className="work-item-head">
                <span className="pill">{item.priority}</span>
                <span className="pill secondary">{item.bucket}</span>
                {item.system && <span className="pill system">System exception</span>}
              </div>
              <b>{item.title}</b>
              <span>{claimName(item.claimId)}</span>
              <small>{item.reason || item.notes || ""}</small>
              {item.owner && <small>Owner: {item.owner}</small>}
              {item.dueDate && <small>Due: {item.dueDate}{isPast(item.dueDate) ? " — OVERDUE" : ""}</small>}
            </div>
            <div className="work-item-actions">
              <button onClick={() => onOpenClaim(item.claimId, item.targetTab || "overview")}>Open claim</button>
              {!item.system && <button onClick={() => closeManual(item)}>Close</button>}
            </div>
          </div>
        ))}
      </div>

      <div className="panel">
        <h2>Add manual work item</h2>
        <form className="grid" onSubmit={addManual}>
          <label>Claim<select value={manual.claimId} onChange={e => setManual(m => ({...m, claimId:e.target.value}))}>{claims.map(c => <option value={c.id} key={c.id}>{c.insured || "Unnamed Claim"}</option>)}</select></label>
          <label>Bucket<select value={manual.bucket} onChange={e => setManual(m => ({...m, bucket:e.target.value}))}>{buckets.map(x => <option key={x}>{x}</option>)}</select></label>
          <label>Priority<select value={manual.priority} onChange={e => setManual(m => ({...m, priority:e.target.value}))}>{priorities.map(x => <option key={x}>{x}</option>)}</select></label>
          <label>Owner<input placeholder="Angelo, Nick, estimator..." value={manual.owner} onChange={e => setManual(m => ({...m, owner:e.target.value}))} /></label>
          <label>Task<input value={manual.title} onChange={e => setManual(m => ({...m, title:e.target.value}))} /></label>
          <label>Due date<input type="date" value={manual.dueDate} onChange={e => setManual(m => ({...m, dueDate:e.target.value}))} /></label>
          <label>Notes<textarea value={manual.notes} onChange={e => setManual(m => ({...m, notes:e.target.value}))} /></label>
          <div className="form-action"><button className="primary" type="submit">Add work item</button></div>
        </form>
      </div>

      <p className="notice">System exceptions are workflow prompts, not legal conclusions. Deadlines, coverage positions, settlement authority, licensing requirements, and client authorization still require appropriate source and human review.</p>
    </section>
  );
}
