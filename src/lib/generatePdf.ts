import jsPDF from "jspdf";

interface PdfData {
  patientName: string;
  patientDob: string;
  mrn: string;
  dateOfService: string;
  physician: string;
  recommendedStudy: string;
  rationale: string;
  decision: string;
  signatureDataUrl?: string;
  providerName?: string;
  providerCredentials?: string;
}

export function generateAttestationPdf(data: PdfData): jsPDF {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  // Header
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 51, 102);
  doc.text("MSW Heart Cardiology", pageWidth / 2, y, { align: "center" });
  y += 8;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text("Cardiology Study Authorization Attestation", pageWidth / 2, y, {
    align: "center",
  });
  y += 5;

  // Divider
  doc.setDrawColor(0, 51, 102);
  doc.setLineWidth(0.5);
  doc.line(20, y, pageWidth - 20, y);
  y += 10;

  // Patient Information Section
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("Patient Information", 20, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");

  const patientInfo = [
    ["Patient Name:", data.patientName || "Not provided"],
    ["Date of Birth:", data.patientDob || "Not provided"],
    ["MRN:", data.mrn],
    ["Date of Service:", data.dateOfService],
    ["Referring Physician:", data.physician || "Not provided"],
  ];

  for (const [label, value] of patientInfo) {
    doc.setFont("helvetica", "bold");
    doc.text(label, 20, y);
    doc.setFont("helvetica", "normal");
    doc.text(value, 75, y);
    y += 6;
  }

  y += 5;

  // Authorization Decision
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Authorization Decision", 20, y);
  y += 8;

  doc.setFontSize(10);
  const decisionLabel = formatDecision(data.decision);
  const studyLabel = formatStudy(data.recommendedStudy);

  doc.setFont("helvetica", "bold");
  doc.text("Decision:", 20, y);
  doc.setFont("helvetica", "normal");

  // Color-code the decision
  if (data.decision === "APPROVED_CLEAN") {
    doc.setTextColor(0, 128, 0);
  } else if (data.decision === "APPROVED_NEEDS_LETTER") {
    doc.setTextColor(180, 140, 0);
  } else {
    doc.setTextColor(200, 0, 0);
  }
  doc.text(decisionLabel, 75, y);
  doc.setTextColor(0, 0, 0);
  y += 6;

  doc.setFont("helvetica", "bold");
  doc.text("Recommended Study:", 20, y);
  doc.setFont("helvetica", "normal");
  doc.text(studyLabel, 75, y);
  y += 10;

  // Rationale
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Clinical Rationale", 20, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const rationaleLines = doc.splitTextToSize(data.rationale, pageWidth - 40);
  doc.text(rationaleLines, 20, y);
  y += rationaleLines.length * 5 + 10;

  // Check if we need a new page for signature
  if (y > 240) {
    doc.addPage();
    y = 20;
  }

  // Attestation statement
  doc.setFontSize(10);
  doc.setFont("helvetica", "italic");
  const attestation =
    "I attest that the above clinical information has been reviewed and the authorization decision is based on established medical criteria and clinical guidelines.";
  const attestLines = doc.splitTextToSize(attestation, pageWidth - 40);
  doc.text(attestLines, 20, y);
  y += attestLines.length * 5 + 10;

  // Signature
  if (data.signatureDataUrl) {
    doc.addImage(data.signatureDataUrl, "PNG", 20, y, 60, 25);
    y += 28;
  }

  doc.setDrawColor(0, 0, 0);
  doc.line(20, y, 100, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  if (data.providerName) {
    doc.text(
      `${data.providerName}${data.providerCredentials ? `, ${data.providerCredentials}` : ""}`,
      20,
      y
    );
    y += 5;
  }

  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 20, y);
  doc.text("CardioAuth - AI-Assisted Authorization System", 20, y + 4);

  return doc;
}

function formatDecision(decision: string): string {
  switch (decision) {
    case "APPROVED_CLEAN":
      return "Approved";
    case "APPROVED_NEEDS_LETTER":
      return "Approved - Attestation Letter Required";
    case "DENIED":
      return "Denied";
    default:
      return decision;
  }
}

function formatStudy(study: string): string {
  switch (study) {
    case "NUCLEAR":
      return "Nuclear Stress Test";
    case "STRESS_ECHO":
      return "Stress Echocardiogram";
    case "ECHO":
      return "Echocardiogram";
    case "VASCULAR":
      return "Vascular Study";
    default:
      return study;
  }
}
