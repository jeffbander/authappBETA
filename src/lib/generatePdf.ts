import jsPDF from "jspdf";

interface SupportingCriterion {
  ruleName: string;
  criterion: string;
  clinicalEvidence: string;
}

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
  supportingCriteria?: SupportingCriterion[];
  // Qualification flow fields
  qualifiedViaSymptom?: boolean;
  qualifyingRationale?: string;
  // Second qualified study
  secondRecommendedStudy?: string;
  secondQualifyingRationale?: string;
  // Physician addendums/clarifications
  addendums?: { text: string; addedByName: string; addedAt: number }[];
  // Attestation letter justification fields
  needsLetterReason?: string;
  letterJustifications?: string[];
  letterJustificationOther?: string;
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

  // Recommended Procedure
  const studyLabel = formatStudy(data.recommendedStudy) +
    (data.secondRecommendedStudy ? ` + ${formatStudy(data.secondRecommendedStudy)}` : "");
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 51, 102);
  doc.text(`Recommended Procedure: ${studyLabel}`, 20, y);
  doc.setTextColor(0, 0, 0);
  y += 10;

  // Supporting Criteria
  if (data.supportingCriteria && data.supportingCriteria.length > 0) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Supporting Criteria", 20, y);
    y += 8;

    doc.setFontSize(10);
    for (const sc of data.supportingCriteria) {
      if (y > 260) {
        doc.addPage();
        y = 20;
      }
      const bulletLine = `\u2022 ${sc.ruleName} \u2014 \u201C${sc.criterion}\u201D`;
      const bulletLines = doc.splitTextToSize(bulletLine, pageWidth - 48);
      doc.setFont("helvetica", "normal");
      doc.text(bulletLines, 24, y);
      y += bulletLines.length * 5;
      doc.setFont("helvetica", "italic");
      const evidenceLines = doc.splitTextToSize(`Evidence: ${sc.clinicalEvidence}`, pageWidth - 52);
      doc.text(evidenceLines, 28, y);
      y += evidenceLines.length * 5 + 4;
    }
    y += 4;
  }

  // Rationale section(s)
  if (data.qualifiedViaSymptom && data.qualifyingRationale) {
    // Combine original rationale with qualifying rationale(s) into single section
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Clinical Rationale", 20, y);
    y += 8;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");

    // Build combined rationale: original + addendums + qualifying rationale(s)
    let combinedRationale = integrateAddendums(data.rationale, data.addendums);
    combinedRationale += " " + data.qualifyingRationale;
    if (data.secondRecommendedStudy && data.secondQualifyingRationale) {
      combinedRationale += " " + data.secondQualifyingRationale;
    }

    const rationaleLines = doc.splitTextToSize(combinedRationale, pageWidth - 40);
    doc.text(rationaleLines, 20, y);
    y += rationaleLines.length * 5 + 4;

    // Add note about qualification
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(100, 100, 100);
    doc.text("* Study authorized based on physician-confirmed clinical findings", 20, y);
    doc.setTextColor(0, 0, 0);
    y += 10;
  } else {
    // Standard rationale display
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Clinical Rationale", 20, y);
    y += 8;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    // Integrate addendums into rationale text
    const fullRationale = integrateAddendums(data.rationale, data.addendums);
    const rationaleLines = doc.splitTextToSize(fullRationale, pageWidth - 40);
    doc.text(rationaleLines, 20, y);
    y += rationaleLines.length * 5 + 10;
  }

  // Medical Necessity Justification section (for BORDERLINE_NEEDS_LETTER cases)
  if (
    (data.decision === "BORDERLINE_NEEDS_LETTER" || data.decision === "APPROVED_NEEDS_LETTER") &&
    data.letterJustifications &&
    data.letterJustifications.length > 0
  ) {
    if (y > 230) {
      doc.addPage();
      y = 20;
    }

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 51, 102);
    doc.text("Medical Necessity Justification", 20, y);
    doc.setTextColor(0, 0, 0);
    y += 8;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");

    // Introductory statement
    const introText =
      "The ordering physician attests that this study is medically necessary for the following reasons:";
    const introLines = doc.splitTextToSize(introText, pageWidth - 40);
    doc.text(introLines, 20, y);
    y += introLines.length * 5 + 4;

    // List justifications as bullet points
    for (const justification of data.letterJustifications) {
      if (y > 260) {
        doc.addPage();
        y = 20;
      }
      const bulletText = `\u2022 ${justification}`;
      const bulletLines = doc.splitTextToSize(bulletText, pageWidth - 48);
      doc.text(bulletLines, 24, y);
      y += bulletLines.length * 5 + 2;
    }

    // Add "Other" justification if present
    if (data.letterJustificationOther) {
      if (y > 260) {
        doc.addPage();
        y = 20;
      }
      const otherText = `\u2022 ${data.letterJustificationOther}`;
      const otherLines = doc.splitTextToSize(otherText, pageWidth - 48);
      doc.text(otherLines, 24, y);
      y += otherLines.length * 5 + 2;
    }

    y += 6;
  }

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
  doc.text("CardioAuth", 20, y + 4);

  return doc;
}

interface ReviewSummaryData {
  providerName: string;
  providerCredentials: string;
  approvedCount: number;
  heldCount: number;
  patients: {
    mrn: string;
    patientName: string;
    dateOfService: string;
    recommendedStudy: string;
    decision: string;
    reviewStatus: string;
    rationale: string;
  }[];
}

export function generateReviewSummaryPdf(data: ReviewSummaryData): jsPDF {
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
  doc.text("Doctor Review Summary", pageWidth / 2, y, { align: "center" });
  y += 5;

  // Divider
  doc.setDrawColor(0, 51, 102);
  doc.setLineWidth(0.5);
  doc.line(20, y, pageWidth - 20, y);
  y += 10;

  // Provider Info
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("Reviewing Physician", 20, y);
  y += 7;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(
    `${data.providerName}${data.providerCredentials ? `, ${data.providerCredentials}` : ""}`,
    20,
    y
  );
  y += 10;

  // Summary Stats
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Summary", 20, y);
  y += 7;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Total Patients: ${data.patients.length}`, 20, y);
  y += 5;
  doc.setTextColor(0, 128, 0);
  doc.text(`Approved: ${data.approvedCount}`, 20, y);
  y += 5;
  doc.setTextColor(200, 100, 0);
  doc.text(`Held: ${data.heldCount}`, 20, y);
  y += 5;
  doc.setTextColor(150, 150, 150);
  doc.text(
    `Pending: ${data.patients.length - data.approvedCount - data.heldCount}`,
    20,
    y
  );
  doc.setTextColor(0, 0, 0);
  y += 10;

  // Patient Table
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Patient Details", 20, y);
  y += 8;

  // Table header
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setFillColor(240, 240, 240);
  doc.rect(20, y - 4, pageWidth - 40, 7, "F");
  doc.text("MRN", 22, y);
  doc.text("Patient", 45, y);
  doc.text("DOS", 85, y);
  doc.text("Study", 110, y);
  doc.text("Decision", 145, y);
  doc.text("Review", 175, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  for (const p of data.patients) {
    if (y > 265) {
      doc.addPage();
      y = 20;
    }
    doc.text(p.mrn, 22, y);
    doc.text(p.patientName.substring(0, 18), 45, y);
    doc.text(p.dateOfService, 85, y);
    doc.text(p.recommendedStudy.substring(0, 16), 110, y);
    doc.text(formatDecision(p.decision).substring(0, 14), 145, y);
    doc.text(p.reviewStatus, 175, y);
    y += 5;

    // Truncated rationale
    if (p.rationale) {
      doc.setFontSize(7);
      doc.setTextColor(100, 100, 100);
      const truncated =
        p.rationale.length > 120
          ? p.rationale.substring(0, 120) + "..."
          : p.rationale;
      const rationaleLines = doc.splitTextToSize(truncated, pageWidth - 44);
      doc.text(rationaleLines, 22, y);
      y += rationaleLines.length * 4 + 2;
      doc.setFontSize(8);
      doc.setTextColor(0, 0, 0);
    }
  }

  y += 5;

  // Check if we need a new page for signature
  if (y > 250) {
    doc.addPage();
    y = 20;
  }

  // Signature block
  doc.setDrawColor(0, 0, 0);
  doc.line(20, y, 100, y);
  y += 5;
  doc.setFontSize(10);
  doc.text(
    `${data.providerName}${data.providerCredentials ? `, ${data.providerCredentials}` : ""}`,
    20,
    y
  );
  y += 8;

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 20, y);
  doc.text("CardioAuth", 20, y + 4);

  return doc;
}

function formatDecision(decision: string): string {
  switch (decision) {
    case "APPROVED_CLEAN":
      return "Approved";
    case "BORDERLINE_NEEDS_LETTER":
    case "APPROVED_NEEDS_LETTER": // Backwards compatibility
      return "Borderline - Attestation Letter Required";
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
    case "NONE":
      return "No Study Appropriate";
    default:
      return study;
  }
}

// Integrate addendums into rationale text using find & replace
function integrateAddendums(
  rationale: string,
  addendums?: { text: string; addedByName: string; addedAt: number }[]
): string {
  if (!addendums || addendums.length === 0) {
    return rationale;
  }

  let result = rationale;
  for (const addendum of addendums) {
    // Parse "Label: option" format
    const colonIndex = addendum.text.indexOf(':');
    if (colonIndex > 0) {
      const label = addendum.text.substring(0, colonIndex).trim();
      const option = addendum.text.substring(colonIndex + 1).trim();

      // Try to find and replace the label in the rationale (case-insensitive)
      const regex = new RegExp(`\\b${escapeRegExp(label)}\\b`, 'i');
      if (regex.test(result)) {
        result = result.replace(regex, `${option} ${label.toLowerCase()}`);
      } else {
        // Fallback: append as sentence
        result += ` The ${label.toLowerCase()} is ${option}.`;
      }
    }
  }

  return result;
}

// Helper to escape special regex characters
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface WorklistData {
  providerName: string;
  providerCredentials: string;
  dateOfService: string;
  approvedPatients: {
    patientName: string;
    mrn: string;
    recommendedStudy: string;
    rationale: string;
  }[];
  opportunityPatients: {
    patientName: string;
    mrn: string;
    suggestedStudy: string;
    diagnosis: string;
    suggestedSymptoms: string[];
  }[];
}

export function generateWorklistPdf(data: WorklistData): jsPDF {
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
  doc.text("Provider Worklist - Unscheduled Tests", pageWidth / 2, y, { align: "center" });
  y += 5;

  // Divider
  doc.setDrawColor(0, 51, 102);
  doc.setLineWidth(0.5);
  doc.line(20, y, pageWidth - 20, y);
  y += 10;

  // Provider & Date Info
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text(`${data.providerName}${data.providerCredentials ? `, ${data.providerCredentials}` : ""}`, 20, y);
  y += 6;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Date of Service: ${data.dateOfService}`, 20, y);
  y += 10;

  // Approved - Needs Scheduling Section
  if (data.approvedPatients.length > 0) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 100, 0);
    doc.text("APPROVED - NEEDS SCHEDULING", 20, y);
    doc.setTextColor(0, 0, 0);
    y += 2;
    doc.setDrawColor(0, 100, 0);
    doc.setLineWidth(0.3);
    doc.line(20, y, pageWidth - 20, y);
    y += 6;

    doc.setFontSize(10);
    for (let i = 0; i < data.approvedPatients.length; i++) {
      const patient = data.approvedPatients[i];

      if (y > 250) {
        doc.addPage();
        y = 20;
      }

      // Patient header
      doc.setFont("helvetica", "bold");
      doc.text(`${i + 1}. ${patient.patientName} (MRN: ${patient.mrn})`, 20, y);
      y += 5;

      // Test
      doc.setFont("helvetica", "normal");
      doc.text(`   Test: ${patient.recommendedStudy}`, 20, y);
      y += 5;

      // Rationale as bullet points
      if (patient.rationale) {
        const sentences = patient.rationale
          .split(/[.!?]+/)
          .map(s => s.trim())
          .filter(s => s.length > 0)
          .slice(0, 3); // Max 3 bullet points

        for (const sentence of sentences) {
          if (y > 270) {
            doc.addPage();
            y = 20;
          }
          const bulletText = `   \u2022 ${sentence}`;
          const lines = doc.splitTextToSize(bulletText, pageWidth - 45);
          doc.text(lines, 20, y);
          y += lines.length * 4 + 1;
        }
      }
      y += 4;
    }
    y += 6;
  }

  // Opportunities to Schedule Section
  if (data.opportunityPatients.length > 0) {
    if (y > 230) {
      doc.addPage();
      y = 20;
    }

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(102, 51, 153);
    doc.text("OPPORTUNITIES TO SCHEDULE", 20, y);
    doc.setTextColor(0, 0, 0);
    y += 2;
    doc.setDrawColor(102, 51, 153);
    doc.setLineWidth(0.3);
    doc.line(20, y, pageWidth - 20, y);
    y += 6;

    doc.setFontSize(10);
    const startNum = data.approvedPatients.length + 1;
    for (let i = 0; i < data.opportunityPatients.length; i++) {
      const patient = data.opportunityPatients[i];

      if (y > 250) {
        doc.addPage();
        y = 20;
      }

      // Patient header
      doc.setFont("helvetica", "bold");
      doc.text(`${startNum + i}. ${patient.patientName} (MRN: ${patient.mrn})`, 20, y);
      y += 5;

      // Suggested test
      doc.setFont("helvetica", "normal");
      doc.text(`   Suggested Test: ${patient.suggestedStudy}`, 20, y);
      y += 5;

      // Diagnosis
      doc.text(`   \u2022 Patient has ${patient.diagnosis}, could qualify with symptom confirmation`, 20, y);
      y += 5;

      // Qualifying symptoms
      if (patient.suggestedSymptoms.length > 0) {
        const symptomsText = `   \u2022 The test may be warranted if the patient has the following symptoms: ${patient.suggestedSymptoms.join(", ")}`;
        const lines = doc.splitTextToSize(symptomsText, pageWidth - 45);
        doc.text(lines, 20, y);
        y += lines.length * 4 + 1;
      }
      y += 4;
    }
  }

  // Footer
  y += 5;
  if (y > 270) {
    doc.addPage();
    y = 20;
  }
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 20, y);
  doc.text("CardioAuth", 20, y + 4);

  return doc;
}
