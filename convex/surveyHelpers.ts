// Survey question metadata used for formatting prompt output.
// Must stay in sync with src/lib/surveyQuestions.ts SURVEY_QUESTIONS.
const SURVEY_QUESTION_META: Record<
  string,
  { medicalTerm: string; hasFollowUp: boolean }
> = {
  chest_pain: { medicalTerm: "Chest pain/angina", hasFollowUp: true },
  sob_exertion: { medicalTerm: "Dyspnea on exertion", hasFollowUp: true },
  exercise_tolerance: { medicalTerm: "Decreased exercise tolerance", hasFollowUp: true },
  dizziness: { medicalTerm: "Dizziness/presyncope", hasFollowUp: true },
  palpitations: { medicalTerm: "Palpitations", hasFollowUp: true },
  edema: { medicalTerm: "Lower extremity edema", hasFollowUp: true },
  orthopnea: { medicalTerm: "Orthopnea/PND", hasFollowUp: false },
  leg_pain: { medicalTerm: "Claudication", hasFollowUp: false },
  wound: { medicalTerm: "Non-healing wounds", hasFollowUp: false },
  tia: { medicalTerm: "TIA symptoms", hasFollowUp: false },
};

/**
 * Format completed survey data for the AI authorization prompt.
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
    if (q.answeredYes === undefined) continue;

    if (q.answeredYes) {
      const meta = SURVEY_QUESTION_META[q.questionId];
      const temporal =
        meta?.hasFollowUp && q.followUpAnsweredYes !== undefined
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
