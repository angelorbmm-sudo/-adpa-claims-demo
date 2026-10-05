import { emptyClaim } from "./seed.js";

function claim(id, insured, carrier, claimNumber, cause, requested, received) {
  const c = emptyClaim();
  c.id = id;
  c.insured = insured;
  c.property = "123 Demo Street, Sample City, CA";
  c.carrier = carrier;
  c.claimNumber = claimNumber;
  c.dateOfLoss = "2026-09-15";
  c.causeOfLoss = cause;
  c.representationStatus = "Active";
  c.valuation = "RCV";
  c.valuationSource = "Demo policy form HO-3";
  c.valuationReviewer = "Demo Reviewer";
  c.coverages = c.coverages.map(x => x.key === "A"
    ? { ...x, limit: 500000, requested, carrier: Math.round(requested * 0.72), issued: received, received }
    : x.key === "C"
      ? { ...x, limit: 250000, requested: 75000, carrier: 52000, issued: 45000, received: 45000 }
      : x);
  c.documents = [
    { id: id+"-doc1", name: "Demo Policy.pdf", category: "Policy / Declarations", size: 123456, createdAt: new Date().toISOString(), reviewStatus: "Verified" },
    { id: id+"-doc2", name: "Demo Carrier Estimate.pdf", category: "Carrier Estimate", size: 223456, createdAt: new Date().toISOString(), reviewStatus: "Verified" }
  ];
  c.contents = [
    { id:id+"-ct1", room:"Living Room", category:"Furniture", item:"Sectional Sofa", quantity:1, unitRcv:3200, depreciationType:"Percentage", depreciationPercent:20, carrierRcv:2100, replacementSource:"Demo retailer", status:"Needs review", lkqStatus:"Needs review" }
  ];
  c.ale = { ...c.ale, startDate:"2026-09-16", expectedEndDate:"2026-12-15", expenses:[
    { id:id+"-ale1", category:"Temporary Housing", vendor:"Sample Suites", description:"Demo monthly housing", expenseDate:"2026-10-01", amount:4200, normalExpense:1800, requested:2400, approved:2000, paid:2000, status:"Partially Paid", reimbursementDueDate:"2026-10-20" }
  ]};
  c.supplements = [
    { id:id+"-sup1", coverage:"A", issueType:"Scope", issue:"Demo kitchen cabinet scope variance", carrierReference:"Carrier estimate line 42", adpaPosition:"Demo position only", requested:12500, approvedAmount:5000, status:"Under Review", escalationLevel:"Normal", responseDueDate:"2026-10-20" }
  ];
  c.mortgage = { ...c.mortgage, servicer:"Sample Mortgage Co.", heldBalance:60000, initialRelease:15000, endorsementStatus:"Complete", draws:[
    { id:id+"-draw1", drawNumber:"1", requestedAmount:25000, releasedAmount:15000, requestDate:"2026-10-01", dueDate:"2026-10-25", completionPercent:40, inspectionRequired:true, status:"Partially Released" }
  ]};
  c.policyAnalysis = {
    declarations:[{id:id+"-dec1",coverage:"A",label:"Dwelling",limit:500000,deductible:2500,page:"2",sourceRef:"Demo declarations"}],
    endorsements:[{id:id+"-end1",formNumber:"DEMO-01",title:"Demo Ordinance Endorsement",effect:"Adds / Changes Coverage",coverage:"CODE",page:"12",sourceRef:"Demo endorsement",summary:"Demo only",status:"Needs review"}],
    provisions:[{id:id+"-prov1",type:"ALE / Loss of Use",coverage:"D",summary:"Demo actual loss sustained language",page:"18",sourceRef:"Demo policy",status:"Needs review"}],
    conflicts:[],
    reviewer:"",
    reviewStatus:"Unreviewed",
    reviewedAt:"",
    notes:""
  };
  c.updatedAt = new Date().toISOString();
  return c;
}

export function demoWorkspace() {
  const claims = [
    claim("demo-fire","Demo Fire Claim","Sample Mutual","DEMO-1001","Fire / smoke",220000,90000),
    claim("demo-water","Demo Water Claim","Example Insurance","DEMO-1002","Water damage",85000,30000),
    claim("demo-storm","Demo Storm Claim","Practice Casualty","DEMO-1003","Wind / tree impact",140000,50000)
  ];
  return { claims, selectedId: claims[0].id };
}
