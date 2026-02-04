export type StudyType = "NUCLEAR" | "STRESS_ECHO" | "ECHO" | "VASCULAR";

export interface StudySuggestion {
  studyType: StudyType;
  studyName: string;
  symptoms: string[];
  diagnosisPatterns: RegExp[];
}

const SUGGESTIONS: StudySuggestion[] = [
  {
    studyType: "NUCLEAR",
    studyName: "Nuclear Stress Test",
    symptoms: [
      "worsening chest pain",
      "new SOB on exertion",
      "worsening DOE",
      "reduced exercise tolerance",
      "new fatigue with activity",
    ],
    diagnosisPatterns: [
      /cabg/i,
      /bypass/i,
      /diabetes.*cardiac/i,
      /\bdm\b.*risk/i,
      /diabetic.*heart/i,
    ],
  },
  {
    studyType: "STRESS_ECHO",
    studyName: "Stress Echocardiogram",
    symptoms: [
      "exertional chest pain",
      "exertional dyspnea",
      "syncope or pre-syncope with exertion",
      "worsening exercise tolerance",
      "new palpitations with activity",
    ],
    diagnosisPatterns: [
      /coronary/i,
      /\bcad\b/i,
      /\bmi\b/i,
      /myocardial infarction/i,
      /stent/i,
      /hypertrophic cardiomyopathy/i,
      /\bhcm\b/i,
      /\bhocm\b/i,
      /mitral regurgitation/i,
      /pulmonary hypertension/i,
      /lvot/i,
      /left ventricular outflow/i,
    ],
  },
  {
    studyType: "ECHO",
    studyName: "Echocardiogram",
    symptoms: [
      "worsening SOB",
      "new or worsening edema",
      "orthopnea",
      "PND",
      "worsening DOE",
      "new palpitations",
    ],
    diagnosisPatterns: [
      /hypertension/i,
      /\bhtn\b/i,
      /heart failure/i,
      /\bchf\b/i,
      /\bhfref\b/i,
      /\bhfpef\b/i,
      /cardiomyopathy/i,
      /valve/i,
      /valvular/i,
      /stenosis/i,
      /regurgitation/i,
      /murmur/i,
      /afib/i,
      /atrial fib/i,
      /arrhythmia/i,
      /aortic/i,
      /mitral/i,
      /tricuspid/i,
    ],
  },
  {
    studyType: "VASCULAR",
    studyName: "Vascular Study",
    symptoms: [
      "leg pain with walking",
      "claudication",
      "non-healing wound",
      "TIA symptoms",
      "new dizziness",
    ],
    diagnosisPatterns: [
      /\bpad\b/i,
      /peripheral.*artery/i,
      /peripheral.*vascular/i,
      /claudication/i,
      /carotid/i,
      /pvd/i,
    ],
  },
];

// Patterns indicating patient needs NUCLEAR instead of STRESS_ECHO
// (LBBB makes exercise stress unreliable, mobility issues prevent treadmill)
const NUCLEAR_UPGRADE_PATTERNS: RegExp[] = [
  /\blbbb\b/i,
  /left bundle branch block/i,
  /difficulty walking/i,
  /unable to walk/i,
  /cannot walk/i,
  /wheelchair/i,
  /\bcane\b/i,
  /\bwalker\b/i,
  /non-ambulatory/i,
  /limited mobility/i,
  /unable to exercise/i,
  /cannot exercise/i,
];

/**
 * Parse prior studies to extract study type and date
 * Expected formats: "Echo 2023-05-15", "Nuclear stress test (2022-01-01)", etc.
 */
function parsePriorStudy(studyStr: string): { type: StudyType | null; date: Date | null } {
  const studyLower = studyStr.toLowerCase();

  let type: StudyType | null = null;
  if (studyLower.includes("nuclear") || studyLower.includes("myocardial perfusion") || studyLower.includes("mpi")) {
    type = "NUCLEAR";
  } else if (studyLower.includes("stress echo")) {
    type = "STRESS_ECHO";
  } else if (studyLower.includes("echo") || studyLower.includes("echocardiogram") || studyLower.includes("tte") || studyLower.includes("tee")) {
    type = "ECHO";
  } else if (studyLower.includes("vascular") || studyLower.includes("carotid") || studyLower.includes("abi") || studyLower.includes("arterial")) {
    type = "VASCULAR";
  }

  // Try to extract date - look for common date patterns
  const datePatterns = [
    /(\d{4}[-/]\d{1,2}[-/]\d{1,2})/,  // YYYY-MM-DD or YYYY/MM/DD
    /(\d{1,2}[-/]\d{1,2}[-/]\d{4})/,  // MM-DD-YYYY or MM/DD/YYYY
    /(\d{1,2}[-/]\d{1,2}[-/]\d{2})/,  // MM-DD-YY or MM/DD/YY
  ];

  let date: Date | null = null;
  for (const pattern of datePatterns) {
    const match = studyStr.match(pattern);
    if (match) {
      const parsed = new Date(match[1]);
      if (!isNaN(parsed.getTime())) {
        date = parsed;
        break;
      }
    }
  }

  return { type, date };
}

/**
 * Check if a study of the given type was done within the last year
 */
function hasRecentStudy(
  priorStudies: string[],
  studyType: StudyType,
  referenceDate: Date
): boolean {
  const oneYearAgo = new Date(referenceDate);
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  for (const study of priorStudies) {
    const { type, date } = parsePriorStudy(study);
    if (type === studyType && date && date > oneYearAgo) {
      return true;
    }
  }
  return false;
}

/**
 * Check if any diagnosis matches the patterns for a suggestion
 */
function matchesDiagnoses(diagnoses: string[], patterns: RegExp[]): boolean {
  for (const diagnosis of diagnoses) {
    for (const pattern of patterns) {
      if (pattern.test(diagnosis)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Get the first matching diagnosis for display purposes
 */
function getMatchingDiagnosis(diagnoses: string[], patterns: RegExp[]): string | null {
  for (const diagnosis of diagnoses) {
    for (const pattern of patterns) {
      if (pattern.test(diagnosis)) {
        return diagnosis;
      }
    }
  }
  return null;
}

export interface EligibleSuggestion {
  suggestion: StudySuggestion;
  matchingDiagnosis: string;
}

/**
 * Get eligible study suggestions for a patient based on their diagnoses and prior studies.
 * Returns suggestions for studies that:
 * 1. Match the patient's diagnoses
 * 2. Haven't been done in the last year (or never done)
 */
export function getSuggestionsForPatient(
  diagnoses: string[],
  priorStudies: string[],
  dateOfService: string,
  additionalContext?: string[]
): EligibleSuggestion[] {
  if (!diagnoses || diagnoses.length === 0) {
    return [];
  }

  const referenceDate = new Date(dateOfService);
  if (isNaN(referenceDate.getTime())) {
    return [];
  }

  const eligibleSuggestions: EligibleSuggestion[] = [];

  for (const suggestion of SUGGESTIONS) {
    // Check if patient has matching diagnoses
    if (!matchesDiagnoses(diagnoses, suggestion.diagnosisPatterns)) {
      continue;
    }

    // Check if study was done recently (within last year)
    if (hasRecentStudy(priorStudies, suggestion.studyType, referenceDate)) {
      continue;
    }

    const matchingDiagnosis = getMatchingDiagnosis(diagnoses, suggestion.diagnosisPatterns);
    if (matchingDiagnosis) {
      eligibleSuggestions.push({
        suggestion,
        matchingDiagnosis,
      });
    }
  }

  // Upgrade STRESS_ECHO to NUCLEAR if patient has LBBB or mobility issues
  const allClinicalData = [...diagnoses, ...(additionalContext || [])];
  if (matchesDiagnoses(allClinicalData, NUCLEAR_UPGRADE_PATTERNS)) {
    const nuclearTemplate = SUGGESTIONS.find(s => s.studyType === "NUCLEAR");
    if (nuclearTemplate) {
      for (let i = 0; i < eligibleSuggestions.length; i++) {
        if (eligibleSuggestions[i].suggestion.studyType === "STRESS_ECHO") {
          eligibleSuggestions[i] = {
            suggestion: nuclearTemplate,
            matchingDiagnosis: eligibleSuggestions[i].matchingDiagnosis,
          };
        }
      }
    }
  }

  // Remove STRESS_ECHO if NUCLEAR is also present (can't combine same-tier studies)
  const hasNuclear = eligibleSuggestions.some(s => s.suggestion.studyType === "NUCLEAR");
  const filtered = hasNuclear
    ? eligibleSuggestions.filter(s => s.suggestion.studyType !== "STRESS_ECHO")
    : eligibleSuggestions;

  // Return max 2 suggestions (already in priority order: NUCLEAR > STRESS_ECHO > ECHO > VASCULAR)
  return filtered.slice(0, 2);
}

/**
 * Generate the qualifying rationale text
 */
export function generateQualifyingRationale(
  symptom: string,
  diagnosis: string,
  studyName: string
): string {
  return `Patient reports ${symptom}. Given history of ${diagnosis} and no ${studyName} in over 1 year, ${studyName} is clinically indicated for evaluation.`;
}
