import React, { useEffect, useMemo, useState } from "react";
import { emptyClaim } from "./data/seed.js";
import { demoWorkspace } from "./data/demo.js";
import { loadWorkspace, nowIso, saveWorkspace, uid } from "./lib/storage.js";
import EstimateComparison from "./components/EstimateComparison.jsx";
import PaymentLedger from "./components/PaymentLedger.jsx";
import WorkQueue from "./components/WorkQueue.jsx";
import EvidenceEngine from "./components/EvidenceEngine.jsx";
import CommunicationsHub from "./components/CommunicationsHub.jsx";
import AuthorityReleaseControl from "./components/AuthorityReleaseControl.jsx";
import AIClaimReviewCenter from "./components/AIClaimReviewCenter.jsx";
import ContentsValuationCenter from "./components/ContentsValuationCenter.jsx";
import ALEManagementCenter from "./components/ALEManagementCenter.jsx";
import SupplementsDisputeCenter from "./components/SupplementsDisputeCenter.jsx";
import MortgageLossDraftCenter from "./components/MortgageLossDraftCenter.jsx";
import PolicyEndorsementCenter from "./components/PolicyEndorsementCenter.jsx";

const modules = [
  ["overview", "Dashboard"],
  ["workqueue", "Work Queue"],
  ["intake", "Claim Intake"],
  ["coverage", "Coverage & Valuation"],
  ["policy", "Policy & Endorsements"],
  ["evidence", "Documents & Evidence"],
  ["contents", "Contents"],
  ["ale", "ALE / Loss of Use"],
  ["estimates", "Estimate Comparison"],
  ["payments", "Payment Ledger"],
  ["communications", "Communications"],
  ["supplements", "Supplements"],
  ["mortgage", "Mortgage"],
  ["agreements", "Agreements"],
  ["receipts", "Receipts & Depreciation"],
  ["package", "Claim Package"],
  ["approvals", "Approvals & Signatures"],
  ["recovery", "Recovery Follow-up"],
  ["ai", "AI Preparation"]
];

function money(v) {
  return Number(v || 0).toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function App() {
  const isDemo = import.meta.env.VITE_DEMO_MODE === "true";
  const [workspace, setWorkspace] = useState(() => loadWorkspace() || (isDemo ? demoWorkspace() : { claims: [], selectedId: null }));
  const [tab, setTab] = useState("overview");
  const [draft, setDraft] = useState(() => emptyClaim());

  const selected = useMemo(
    () => workspace.claims.find(c => c.id === workspace.selectedId) || null,
    [workspace]
  );

  useEffect(() => {
    saveWorkspace(workspace);
  }, [workspace]);

  useEffect(() => {
    if (selected) setDraft(structuredClone(selected));
    else setDraft(emptyClaim());
  }, [selected?.id, selected?.updatedAt]);

  function createClaim() {
    const claim = emptyClaim();
    claim.id = uid("claim");
    claim.insured = "New Claim";
    claim.updatedAt = nowIso();
    setWorkspace(w => ({ ...w, claims: [claim, ...w.claims], selectedId: claim.id }));
    setTab("intake");
  }

  function saveClaim(next = draft) {
    const saved = { ...next, updatedAt: nowIso() };
    setWorkspace(w => ({
      ...w,
      claims: w.claims.map(c => c.id === saved.id ? saved : c),
      selectedId: saved.id
    }));
    setDraft(saved);
  }

  function updateClaimById(claimId, updater) {
    setWorkspace(w => ({
      ...w,
      claims: w.claims.map(c => c.id === claimId ? { ...updater(c), updatedAt: nowIso() } : c)
    }));
  }

  function openClaim(claimId, targetTab = "overview") {
    setWorkspace(w => ({ ...w, selectedId: claimId }));
    setTab(targetTab);
  }

  function patch(field, value) {
    setDraft(d => ({ ...d, [field]: value }));
  }

  function patchCoverage(index, field, value) {
    setDraft(d => {
      const coverages = d.coverages.map((c, i) => i === index ? { ...c, [field]: Number(value || 0) } : c);
      return { ...d, coverages };
    });
  }

  function addRecord(field, record) {
    const next = { ...draft, [field]: [...draft[field], { id: uid(field), createdAt: nowIso(), ...record }] };
    saveClaim(next);
  }

  async function assemblePackage() {
    const snapshot = {
      claimId: draft.id,
      insured: draft.insured,
      property: draft.property,
      carrier: draft.carrier,
      claimNumber: draft.claimNumber,
      coverages: draft.coverages,
      valuation: draft.valuation,
      contents: draft.contents,
      supplements: draft.supplements,
      receipts: draft.receipts,
      recovery: draft.recovery,
      estimateComparisons: draft.estimateComparisons || [],
      payments: draft.payments || [],
      ale: draft.ale || {},
      mortgage: draft.mortgage || {},
      policyAnalysis: draft.policyAnalysis || {},
      documentManifest: draft.documents.map(({ id, name, category, size, createdAt }) => ({ id, name, category, size, createdAt })),
      assembledAt: nowIso()
    };
    const encoded = new TextEncoder().encode(JSON.stringify(snapshot));
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", encoded)))
      .map(b => b.toString(16).padStart(2, "0")).join("");
    addRecord("packages", {
      name: "Claim Package " + new Date().toLocaleString(),
      snapshotHash: hash,
      snapshot,
      status: "Draft"
    });
  }

  if (!selected) {
    return (
      <div className="app">
        {isDemo && <div className="demo-banner">ADPA DEMO — TEST DATA ONLY — DO NOT ENTER REAL CLIENT INFORMATION</div>}
        <header className="topbar"><div><strong>ADPA Claims</strong><span>{isDemo ? "Demo Playground" : "Private Working Workspace"}</span></div></header>
        <main className="empty">
          <h1>ADPA Claims Workspace</h1>
          <p>This recovered build keeps regulated decisions behind human and licensed approval gates.</p>
          <button onClick={createClaim}>Create first claim</button>
          {workspace.claims.length > 0 && (
            <div className="claim-list">
              {workspace.claims.map(c => <button key={c.id} onClick={() => openClaim(c.id)}>{c.insured || "Unnamed Claim"}</button>)}
            </div>
          )}
        </main>
      </div>
    );
  }

  const totalRequested = draft.coverages.reduce((s, c) => s + Number(c.requested || 0), 0);
  const totalReceived = draft.coverages.reduce((s, c) => s + Number(c.received || 0), 0);
  const ledgerPaid = (draft.payments || []).reduce((s, p) => s + Number(p.amount || 0), 0);

  return (
    <div className="app">
      {isDemo && <div className="demo-banner">ADPA DEMO — TEST DATA ONLY — DO NOT ENTER REAL CLIENT INFORMATION</div>}
      <header className="topbar">
        <div><strong>ADPA Claims</strong><span>{isDemo ? "Demo Playground" : "Private Working Workspace"}</span></div>
        <div className="actions">
          <select value={selected.id} onChange={e => openClaim(e.target.value)}>
            {workspace.claims.map(c => <option key={c.id} value={c.id}>{c.insured || "Unnamed Claim"}</option>)}
          </select>
          <button onClick={createClaim}>+ New claim</button>
          <button className="primary" onClick={() => saveClaim()}>Save claim</button>
        </div>
      </header>

      <div className="shell">
        <aside>
          <div className="claim-card">
            <b>{draft.insured || "Unnamed Claim"}</b>
            <small>{draft.carrier || "Carrier not entered"}</small>
            <small>{draft.claimNumber || "Claim # not entered"}</small>
          </div>
          <nav>{modules.map(([key, label]) => <button className={tab === key ? "active" : ""} key={key} onClick={() => setTab(key)}>{label}</button>)}</nav>
        </aside>

        <main>
          {tab === "overview" && (
            <section>
              <h1>Claim Dashboard</h1>
              <div className="stats">
                <Stat label="Requested" value={money(totalRequested)} />
                <Stat label="Received" value={money(totalReceived)} />
                <Stat label="Open follow-ups" value={(draft.recovery || []).filter(x => x.status !== "Closed").length} />
                <Stat label="Evidence files" value={(draft.documents || []).length} />
                <Stat label="Payment ledger total" value={money(ledgerPaid)} />
              </div>
              <Panel title="Next controls">
                <ul>
                  <li>Confirm policy / coverage source before relying on a coverage conclusion.</li>
                  <li>Licensed PA approval is separate from operational review.</li>
                  <li>Client authorization is required before settlement or compromise.</li>
                  <li>External sending remains disabled in this recovery build.</li>
                </ul>
              </Panel>
            </section>
          )}

          {tab === "workqueue" && (
            <WorkQueue
              claims={workspace.claims}
              selectedId={selected.id}
              onOpenClaim={openClaim}
              onUpdateClaim={updateClaimById}
            />
          )}

          {tab === "intake" && (
            <section>
              <h1>Claim Intake</h1>
              <div className="grid">
                <Field label="Insured" value={draft.insured} onChange={v => patch("insured", v)} />
                <Field label="Property" value={draft.property} onChange={v => patch("property", v)} />
                <Field label="Carrier" value={draft.carrier} onChange={v => patch("carrier", v)} />
                <Field label="Claim number" value={draft.claimNumber} onChange={v => patch("claimNumber", v)} />
                <Field type="date" label="Date of loss" value={draft.dateOfLoss} onChange={v => patch("dateOfLoss", v)} />
                <Field label="Cause of loss" value={draft.causeOfLoss} onChange={v => patch("causeOfLoss", v)} />
                <Field label="Mortgage servicer" value={draft.mortgageServicer} onChange={v => patch("mortgageServicer", v)} />
                <label>Representation status<select value={draft.representationStatus} onChange={e => patch("representationStatus", e.target.value)}><option>Pending</option><option>Active</option><option>Terminated</option></select></label>
              </div>
              <label>Internal notes<textarea value={draft.notes} onChange={e => patch("notes", e.target.value)} /></label>
            </section>
          )}

          {tab === "coverage" && (
            <section>
              <h1>Coverage & Policy Valuation</h1>
              <div className="table-wrap"><table><thead><tr><th>Coverage</th><th>Limit</th><th>Requested</th><th>Carrier</th><th>Issued</th><th>Received</th></tr></thead><tbody>
                {draft.coverages.map((c, i) => <tr key={c.key}><td><b>{c.key}</b> {c.name}</td>{["limit","requested","carrier","issued","received"].map(f => <td key={f}><input type="number" value={c[f]} onChange={e => patchCoverage(i, f, e.target.value)} /></td>)}</tr>)}
              </tbody></table></div>
              <div className="grid">
                <label>Policy valuation<select value={draft.valuation} onChange={e => patch("valuation", e.target.value)}><option>Unreviewed</option><option>RCV</option><option>ACV</option><option>Mixed</option><option>Actual Loss Sustained</option></select></label>
                <Field label="Source / policy provision" value={draft.valuationSource} onChange={v => patch("valuationSource", v)} />
                <Field label="Reviewer" value={draft.valuationReviewer} onChange={v => patch("valuationReviewer", v)} />
              </div>
              <p className="notice">Ordinance / Law is tracked separately and must be tied to policy language and applicable code support.</p>
            </section>
          )}

          {tab === "policy" && <PolicyEndorsementCenter claim={draft} onChange={policyAnalysis => saveClaim({ ...draft, policyAnalysis })} />}
          {tab === "evidence" && <EvidenceEngine claim={draft} onChange={documents => saveClaim({ ...draft, documents })} />}
          {tab === "estimates" && <EstimateComparison records={draft.estimateComparisons || []} onChange={records => saveClaim({ ...draft, estimateComparisons: records })} />}
          {tab === "payments" && <PaymentLedger payments={draft.payments || []} coverages={draft.coverages} onChange={payments => saveClaim({ ...draft, payments })} />}
          {tab === "contents" && <ContentsValuationCenter items={draft.contents || []} onChange={contents => saveClaim({ ...draft, contents })} />}
          {tab === "ale" && <ALEManagementCenter claim={draft} onChange={changes => saveClaim({ ...draft, ...changes })} />}
          {tab === "communications" && <CommunicationsHub claim={draft} onChange={communications => saveClaim({ ...draft, communications })} />}
          {tab === "supplements" && <SupplementsDisputeCenter claim={draft} onChange={supplements => saveClaim({ ...draft, supplements })} />}
          {tab === "mortgage" && <MortgageLossDraftCenter claim={draft} onChange={mortgage => saveClaim({ ...draft, mortgage })} />}
          {tab === "agreements" && <SimpleRecords title="Agreement Library & Packets" records={draft.agreements} fields={[["name","Document"],["version","Version"],["signer","Signer"],["status","Status"]]} onAdd={r => addRecord("agreements", r)} />}
          {tab === "receipts" && <SimpleRecords title="Receipts & Recoverable Depreciation" records={draft.receipts} fields={[["item","Item / invoice"],["replacementCost","Replacement cost"],["requested","Depreciation requested"],["approved","Approved"],["released","Released"]]} onAdd={r => addRecord("receipts", r)} />}

          {tab === "package" && (
            <section>
              <h1>Claim-Package Assembly</h1>
              <p>Creates an immutable-style snapshot record of the current claim data and SHA-256 hash for review binding.</p>
              <button className="primary" onClick={assemblePackage}>Assemble draft package</button>
              <RecordList records={draft.packages} render={r => <><b>{r.name}</b><span>Status: {r.status}</span><code>{r.snapshotHash}</code></>} />
            </section>
          )}

          {tab === "approvals" && (
            <AuthorityReleaseControl
              claim={draft}
              onChange={changes => saveClaim({ ...draft, ...changes })}
            />
          )}

          {tab === "recovery" && <SimpleRecords title="Recovery Follow-up & Depreciation Tracking" records={draft.recovery} fields={[["coverage","Coverage"],["amount","Outstanding amount"],["condition","Recovery condition / proof needed"],["dueDate","Follow-up date"],["status","Status"]]} onAdd={r => addRecord("recovery", r)} />}

          {tab === "ai" && (
            <AIClaimReviewCenter
              claim={draft}
              onChange={changes => saveClaim({ ...draft, ...changes })}
            />
          )}
        </main>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }) {
  return <label>{label}<input type={type} value={value || ""} onChange={e => onChange(e.target.value)} /></label>;
}

function Stat({ label, value }) {
  return <div className="stat"><small>{label}</small><b>{value}</b></div>;
}

function Panel({ title, children }) {
  return <div className="panel"><h2>{title}</h2>{children}</div>;
}

function RecordList({ records, render }) {
  if (!records?.length) return <p className="muted">No records yet.</p>;
  return <div className="records">{records.map(r => <div className="record" key={r.id}>{render(r)}</div>)}</div>;
}

function SimpleRecords({ title, records, fields, onAdd, embedded = false }) {
  const initial = Object.fromEntries(fields.map(([k]) => [k, ""]));
  const [row, setRow] = useState(initial);
  function submit(e) {
    e.preventDefault();
    onAdd(row);
    setRow(initial);
  }
  const content = (
    <>
      <h1>{title}</h1>
      <form className="grid" onSubmit={submit}>
        {fields.map(([key, label]) => <Field key={key} label={label} value={row[key]} onChange={v => setRow(r => ({ ...r, [key]: v }))} />)}
        <div className="form-action"><button type="submit">Add record</button></div>
      </form>
      <RecordList records={records} render={r => <>{fields.map(([key, label]) => <span key={key}><b>{label}:</b> {String(r[key] ?? "")}</span>)}</>} />
    </>
  );
  return embedded ? <div className="panel">{content}</div> : <section>{content}</section>;
}


export default App;
