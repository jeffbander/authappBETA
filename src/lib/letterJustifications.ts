/**
 * Attestation Letter Justification Categories
 *
 * Maps each "needs letter" reason to provider-selectable justification options.
 * These are used when a case is BORDERLINE_NEEDS_LETTER to help providers
 * generate an attestation letter with specific clinical justifications.
 */

export type NeedsLetterReason =
  | "ASYMPTOMATIC_HIGH_RISK_SCREENING"
  | "REPEAT_NUCLEAR_WITHIN_2_YEARS"
  | "PREOP_LOW_RISK_SURGERY"
  | "VALVE_FOLLOWUP_NO_NEW_SYMPTOMS"
  | "ATHLETE_SCREENING_HCM_HISTORY"
  | "REPEAT_STRESS_ECHO_WITHIN_1_YEAR"
  | "STABLE_VALVE_FREQUENT_FOLLOWUP"
  | "STABLE_HF_REPEAT"
  | "ROUTINE_HTN_FOLLOWUP"
  | "ASYMPTOMATIC_CAROTID_SCREENING"
  | "MINOR_STENOSIS_FREQUENT_FOLLOWUP"
  | "VENOUS_INSUFFICIENCY_NO_ULCERATION";

export type StudyType = "NUCLEAR" | "STRESS_ECHO" | "ECHO" | "VASCULAR";

export interface JustificationCategory {
  reason: NeedsLetterReason;
  displayName: string;
  studyType: StudyType;
  justificationOptions: string[];
}

export const JUSTIFICATION_CATEGORIES: JustificationCategory[] = [
  // Nuclear
  {
    reason: "ASYMPTOMATIC_HIGH_RISK_SCREENING",
    displayName: "Asymptomatic High-Risk Screening",
    studyType: "NUCLEAR",
    justificationOptions: [
      "Patient has long-standing diabetes (>10 years) with multiple microvascular complications",
      "Strong family history of premature CAD (first-degree relative before age 55 in men, 65 in women)",
      "Multiple cardiac risk factors warrant baseline ischemia evaluation despite absence of symptoms",
      "Patient's risk profile exceeds threshold for standard prevention; imaging will guide aggressive medical therapy",
      "Baseline study is needed to establish reference for future comparisons",
    ],
  },
  {
    reason: "REPEAT_NUCLEAR_WITHIN_2_YEARS",
    displayName: "Repeat Nuclear Study Within 2 Years",
    studyType: "NUCLEAR",
    justificationOptions: [
      "Patient reports subtle symptom changes that warrant early reassessment",
      "Recent medication changes require evaluation of treatment response",
      "Patient underwent revascularization since last study; follow-up imaging clinically indicated",
      "New cardiac risk factors have emerged since prior study",
      "Clinical suspicion of disease progression despite stable symptom report",
    ],
  },
  {
    reason: "PREOP_LOW_RISK_SURGERY",
    displayName: "Pre-operative Assessment for Low-Risk Surgery",
    studyType: "NUCLEAR",
    justificationOptions: [
      "Patient has intermediate clinical risk factors that elevate perioperative cardiac risk",
      "Functional capacity is poor or unknown, requiring objective assessment",
      "Surgery has elevated cardiac demand despite being categorized as low-risk",
      "Patient has history of coronary disease requiring reassessment before any surgical procedure",
      "Anesthesia team has requested cardiac clearance with objective testing",
    ],
  },
  // Stress Echo
  {
    reason: "VALVE_FOLLOWUP_NO_NEW_SYMPTOMS",
    displayName: "Valve Disease Follow-up Without New Symptoms",
    studyType: "STRESS_ECHO",
    justificationOptions: [
      "Valve disease is at borderline severity, requiring close surveillance for progression",
      "Patient has history of rapid valve deterioration, warranting more frequent monitoring",
      "Stress component needed to assess hemodynamic response that resting echo cannot capture",
      "Exercise tolerance assessment is critical for surgical timing decisions",
      "Patient approaching guideline thresholds for intervention; stress testing will inform decision",
    ],
  },
  {
    reason: "ATHLETE_SCREENING_HCM_HISTORY",
    displayName: "Athlete Screening with HCM Family History",
    studyType: "STRESS_ECHO",
    justificationOptions: [
      "First-degree relative died suddenly from HCM-related cause",
      "Family member has confirmed HCM diagnosis, patient is competitive athlete",
      "Resting echo was indeterminate; stress testing needed to assess dynamic obstruction",
      "Patient reports exertional symptoms during high-intensity training",
      "Clearance for competitive sports requires comprehensive cardiac evaluation",
    ],
  },
  {
    reason: "REPEAT_STRESS_ECHO_WITHIN_1_YEAR",
    displayName: "Repeat Stress Echo Within 1 Year",
    studyType: "STRESS_ECHO",
    justificationOptions: [
      "Prior study was technically limited; repeat is needed for adequate visualization",
      "Patient had intervening cardiac event or procedure requiring reassessment",
      "New medications affecting cardiac function warrant earlier follow-up",
      "Symptoms are progressing more rapidly than expected",
      "Clinical suspicion of worsening wall motion abnormalities",
    ],
  },
  // Echo
  {
    reason: "STABLE_VALVE_FREQUENT_FOLLOWUP",
    displayName: "Stable Valve Disease - Frequent Follow-up",
    studyType: "ECHO",
    justificationOptions: [
      "Valve is at moderate-to-severe level, nearing intervention threshold",
      "Patient has comorbidities that may accelerate valve deterioration",
      "Prior imaging showed interval change, warranting closer surveillance",
      "Patient is being considered for surgical intervention; timing requires current data",
      "Bicuspid aortic valve with aortopathy requires more frequent aortic root surveillance",
    ],
  },
  {
    reason: "STABLE_HF_REPEAT",
    displayName: "Stable Heart Failure - Repeat Echo",
    studyType: "ECHO",
    justificationOptions: [
      "Patient on guideline-directed medical therapy, reassessment needed to evaluate response",
      "LVEF was borderline; repeat is needed to confirm stability or recovery",
      "Patient being evaluated for device therapy (ICD/CRT), current EF needed",
      "Recent hospitalization for heart failure, post-discharge reassessment indicated",
      "Medication optimization completed, need to document improvement for prognosis",
    ],
  },
  {
    reason: "ROUTINE_HTN_FOLLOWUP",
    displayName: "Hypertension - Routine Follow-up",
    studyType: "ECHO",
    justificationOptions: [
      "Prior echo showed LVH; reassessment needed to evaluate regression with treatment",
      "Blood pressure has been difficult to control despite multiple agents",
      "New findings on physical exam (S4 gallop, displaced PMI) warrant imaging",
      "Patient has additional risk factors (diabetes, CKD) increasing LVH progression risk",
      "Evaluating for hypertensive heart disease progression",
    ],
  },
  // Vascular
  {
    reason: "ASYMPTOMATIC_CAROTID_SCREENING",
    displayName: "Asymptomatic Carotid Screening",
    studyType: "VASCULAR",
    justificationOptions: [
      "Patient has multiple cerebrovascular risk factors (diabetes, smoking, hyperlipidemia, HTN)",
      "Known coronary or peripheral artery disease increases likelihood of carotid disease",
      "Carotid bruit detected on physical examination",
      "Family history of stroke at young age",
      "Pre-operative screening before major cardiac or vascular surgery",
    ],
  },
  {
    reason: "MINOR_STENOSIS_FREQUENT_FOLLOWUP",
    displayName: "Minor Stenosis - Frequent Follow-up",
    studyType: "VASCULAR",
    justificationOptions: [
      "Prior study showed stenosis at upper end of <50% range (40-49%), closer surveillance warranted",
      "Patient has multiple progressive risk factors",
      "Contralateral carotid has significant disease, heightening vigilance on this side",
      "Patient reported transient neurologic symptoms, needs closer surveillance despite <50% stenosis",
      "Previous rapid progression documented, justifying shorter interval",
    ],
  },
  {
    reason: "VENOUS_INSUFFICIENCY_NO_ULCERATION",
    displayName: "Venous Insufficiency Without Ulceration",
    studyType: "VASCULAR",
    justificationOptions: [
      "Patient has significant lower extremity edema affecting quality of life",
      "Conservative measures (compression, elevation) have failed",
      "Evaluation needed to determine if patient is candidate for venous intervention",
      "Skin changes (hyperpigmentation, lipodermatosclerosis) suggest advanced disease",
      "Patient has occupational requirements that necessitate assessment",
    ],
  },
];

/**
 * Get justification options for a given needsLetterReason
 */
export function getJustificationsForReason(
  reason: NeedsLetterReason
): JustificationCategory | undefined {
  return JUSTIFICATION_CATEGORIES.find((c) => c.reason === reason);
}

/**
 * Detect the needsLetterReason based on AI's supportingCriteria
 * This is a fallback when the AI doesn't explicitly set needsLetterReason
 */
export function detectNeedsLetterReason(
  recommendedStudy: string | undefined,
  supportingCriteria:
    | { ruleName: string; criterion: string; clinicalEvidence: string }[]
    | undefined
): NeedsLetterReason | null {
  if (!recommendedStudy || !supportingCriteria || supportingCriteria.length === 0) {
    return null;
  }

  // Match criterion text to reason using patterns
  const criterionMappings: { pattern: RegExp; reason: NeedsLetterReason }[] = [
    // Nuclear
    {
      pattern: /asymptomatic.*screening.*high.?risk/i,
      reason: "ASYMPTOMATIC_HIGH_RISK_SCREENING",
    },
    {
      pattern: /repeat.*(nuclear|study).*within\s*2\s*years?.*without\s*(new\s*)?symptoms/i,
      reason: "REPEAT_NUCLEAR_WITHIN_2_YEARS",
    },
    {
      pattern: /pre.?op(erative)?.*low.?risk\s*surgery/i,
      reason: "PREOP_LOW_RISK_SURGERY",
    },
    // Stress Echo
    {
      pattern: /follow.?up.*(of\s*)?(known\s*)?valve.*without\s*(new\s*)?symptoms/i,
      reason: "VALVE_FOLLOWUP_NO_NEW_SYMPTOMS",
    },
    {
      pattern: /athlete.*screening.*family\s*history.*(of\s*)?hcm/i,
      reason: "ATHLETE_SCREENING_HCM_HISTORY",
    },
    {
      pattern: /repeat.*(stress\s*echo|within\s*1\s*year).*without\s*(clinical\s*)?change/i,
      reason: "REPEAT_STRESS_ECHO_WITHIN_1_YEAR",
    },
    // Echo
    {
      pattern: /(stable\s*)?valve.*more\s*frequent(ly)?\s*than\s*annual/i,
      reason: "STABLE_VALVE_FREQUENT_FOLLOWUP",
    },
    {
      pattern: /stable\s*(heart\s*failure|hf).*without\s*(clinical\s*)?change/i,
      reason: "STABLE_HF_REPEAT",
    },
    {
      pattern: /routine\s*follow.?up.*(of\s*)?(well.?controlled\s*)?hypertension/i,
      reason: "ROUTINE_HTN_FOLLOWUP",
    },
    // Vascular
    {
      pattern: /carotid\s*screening.*asymptomatic.*(with\s*)?(multiple\s*)?risk\s*factors/i,
      reason: "ASYMPTOMATIC_CAROTID_SCREENING",
    },
    {
      pattern: /(minor\s*)?stenosis.*<\s*50%.*more\s*than\s*annual/i,
      reason: "MINOR_STENOSIS_FREQUENT_FOLLOWUP",
    },
    {
      pattern: /venous\s*insufficiency.*without\s*(ulceration|severe)/i,
      reason: "VENOUS_INSUFFICIENCY_NO_ULCERATION",
    },
  ];

  // Check each criterion against all patterns
  for (const sc of supportingCriteria) {
    const textToSearch = `${sc.criterion} ${sc.clinicalEvidence}`;
    for (const mapping of criterionMappings) {
      if (mapping.pattern.test(textToSearch)) {
        return mapping.reason;
      }
    }
  }

  return null;
}

/**
 * Format reason for display in UI
 */
export function formatReasonDisplay(reason: NeedsLetterReason): string {
  const category = JUSTIFICATION_CATEGORIES.find((c) => c.reason === reason);
  return category?.displayName || reason;
}

/**
 * Get all possible needs letter reasons (useful for validation)
 */
export const ALL_NEEDS_LETTER_REASONS: NeedsLetterReason[] = [
  "ASYMPTOMATIC_HIGH_RISK_SCREENING",
  "REPEAT_NUCLEAR_WITHIN_2_YEARS",
  "PREOP_LOW_RISK_SURGERY",
  "VALVE_FOLLOWUP_NO_NEW_SYMPTOMS",
  "ATHLETE_SCREENING_HCM_HISTORY",
  "REPEAT_STRESS_ECHO_WITHIN_1_YEAR",
  "STABLE_VALVE_FREQUENT_FOLLOWUP",
  "STABLE_HF_REPEAT",
  "ROUTINE_HTN_FOLLOWUP",
  "ASYMPTOMATIC_CAROTID_SCREENING",
  "MINOR_STENOSIS_FREQUENT_FOLLOWUP",
  "VENOUS_INSUFFICIENCY_NO_ULCERATION",
];

/**
 * Get all justification options for a given study type.
 * Used as fallback when specific reason cannot be detected.
 */
export function getAllJustificationsForStudyType(
  studyType: string | undefined
): string[] {
  if (!studyType) return getAllJustifications();

  const matching = JUSTIFICATION_CATEGORIES.filter(
    (c) => c.studyType === studyType
  );
  if (matching.length === 0) return getAllJustifications();

  // Flatten all options from matching categories, deduplicated
  const allOptions = matching.flatMap((c) => c.justificationOptions);
  return Array.from(new Set(allOptions));
}

/**
 * Get all justification options across all categories (deduplicated).
 */
export function getAllJustifications(): string[] {
  return Array.from(
    new Set(JUSTIFICATION_CATEGORIES.flatMap((c) => c.justificationOptions))
  );
}
