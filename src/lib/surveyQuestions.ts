export type StudyType = "NUCLEAR" | "STRESS_ECHO" | "ECHO" | "VASCULAR";

export interface SurveyQuestion {
  id: string;
  questionText: string;
  medicalTerm: string;
  studyTypes: StudyType[];
  hasFollowUp: boolean; // Whether YES triggers "Is this new or getting worse?"
}

// 10 deduplicated patient-friendly questions covering all 4 study types
export const SURVEY_QUESTIONS: SurveyQuestion[] = [
  {
    id: "chest_pain",
    questionText:
      "Have you had any chest pain or chest pressure recently?",
    medicalTerm: "Chest pain/angina",
    studyTypes: ["NUCLEAR", "STRESS_ECHO"],
    hasFollowUp: true,
  },
  {
    id: "sob_exertion",
    questionText:
      "Do you get short of breath when walking, climbing stairs, or doing activities?",
    medicalTerm: "Dyspnea on exertion",
    studyTypes: ["NUCLEAR", "STRESS_ECHO", "ECHO"],
    hasFollowUp: true,
  },
  {
    id: "exercise_tolerance",
    questionText:
      "Have you noticed you get tired more easily during physical activity than before?",
    medicalTerm: "Decreased exercise tolerance",
    studyTypes: ["NUCLEAR", "STRESS_ECHO"],
    hasFollowUp: true,
  },
  {
    id: "dizziness",
    questionText:
      "Have you felt dizzy, lightheaded, or like you might faint?",
    medicalTerm: "Dizziness/presyncope",
    studyTypes: ["STRESS_ECHO", "VASCULAR"],
    hasFollowUp: true,
  },
  {
    id: "palpitations",
    questionText:
      "Have you felt your heart racing, fluttering, or skipping beats?",
    medicalTerm: "Palpitations",
    studyTypes: ["STRESS_ECHO", "ECHO"],
    hasFollowUp: true,
  },
  {
    id: "edema",
    questionText:
      "Have you noticed new or worsening swelling in your legs, ankles, or feet?",
    medicalTerm: "Lower extremity edema",
    studyTypes: ["ECHO"],
    hasFollowUp: true,
  },
  {
    id: "orthopnea",
    questionText:
      "Do you have trouble breathing when lying flat, or wake up at night short of breath?",
    medicalTerm: "Orthopnea/PND",
    studyTypes: ["ECHO"],
    hasFollowUp: false,
  },
  {
    id: "leg_pain",
    questionText:
      "Do you get pain or cramping in your legs when you walk that gets better when you stop?",
    medicalTerm: "Claudication",
    studyTypes: ["VASCULAR"],
    hasFollowUp: false,
  },
  {
    id: "wound",
    questionText:
      "Do you have any wounds or sores on your legs or feet that are not healing?",
    medicalTerm: "Non-healing wounds",
    studyTypes: ["VASCULAR"],
    hasFollowUp: false,
  },
  {
    id: "tia",
    questionText:
      "Have you had any sudden weakness, numbness, vision changes, or trouble speaking?",
    medicalTerm: "TIA symptoms",
    studyTypes: ["VASCULAR"],
    hasFollowUp: false,
  },
];

// Follow-up question for YES answers on questions with hasFollowUp=true
export const FOLLOW_UP_QUESTION =
  "Is this new or getting worse recently? (YES/NO)";

export const SURVEY_INTRO_MESSAGE =
  "Hi! This is MSW Heart Cardiology. We'd like to ask you a few quick YES/NO questions about your symptoms before your upcoming visit. Your answers help us prepare for your appointment. Reply STOP at any time to opt out.";

export const SURVEY_THANK_YOU_MESSAGE =
  "Thank you for completing the symptom survey! Your responses will help your care team prepare for your visit. See you soon!";

export const SURVEY_OPT_OUT_MESSAGE =
  "You have been opted out of this survey. No further messages will be sent. If you have questions, please call our office.";

export const SURVEY_ALREADY_COMPLETE_MESSAGE =
  "Your survey is already complete. Thank you!";

export const INVALID_REPLY_MESSAGE =
  "Please reply YES or NO.";

export type ParsedResponse = {
  type: "yes" | "no" | "stop" | "invalid";
};

/**
 * Parse a patient's SMS reply into YES/NO/STOP/invalid.
 */
export function parseYesNo(text: string): ParsedResponse {
  const normalized = text.trim().toLowerCase();

  if (["yes", "y", "yeah", "yep", "yea", "si", "sure"].includes(normalized)) {
    return { type: "yes" };
  }
  if (["no", "n", "nope", "nah"].includes(normalized)) {
    return { type: "no" };
  }
  if (["stop", "quit", "cancel", "unsubscribe", "end"].includes(normalized)) {
    return { type: "stop" };
  }

  return { type: "invalid" };
}

/**
 * Build the initial question array from SURVEY_QUESTIONS for storage.
 */
export function buildSurveyQuestions() {
  return SURVEY_QUESTIONS.map((q) => ({
    questionId: q.id,
    questionText: q.questionText,
    medicalTerm: q.medicalTerm,
  }));
}

/**
 * Format completed survey data for the AI prompt.
 */
export function formatSurveyForPrompt(survey: {
  questions: Array<{
    questionId: string;
    medicalTerm: string;
    answeredYes?: boolean;
    followUpAnsweredYes?: boolean;
  }>;
  completedAt?: number;
}): string {
  const completedDate = survey.completedAt
    ? new Date(survey.completedAt).toISOString().split("T")[0]
    : "in progress";

  const positive: string[] = [];
  const negative: string[] = [];

  for (const q of survey.questions) {
    if (q.answeredYes === undefined) continue; // unanswered

    if (q.answeredYes) {
      const question = SURVEY_QUESTIONS.find((sq) => sq.id === q.questionId);
      const temporal =
        question?.hasFollowUp && q.followUpAnsweredYes !== undefined
          ? q.followUpAnsweredYes
            ? " (NEW/WORSENING)"
            : " (stable/chronic)"
          : "";
      positive.push(`${q.medicalTerm}${temporal}`);
    } else {
      negative.push(q.medicalTerm);
    }
  }

  const lines: string[] = [
    `Patient-Reported Symptom Survey (SMS, completed ${completedDate})`,
    `SOURCE: Patient self-reported via automated SMS survey BEFORE visit.`,
    "",
  ];

  if (positive.length > 0) {
    lines.push(`Positive: ${positive.join(", ")}`);
  }
  if (negative.length > 0) {
    lines.push(`Negative: ${negative.join(", ")}`);
  }
  if (positive.length === 0 && negative.length === 0) {
    lines.push("No responses recorded.");
  }

  return lines.join("\n");
}
