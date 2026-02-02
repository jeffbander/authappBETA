"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import Anthropic from "@anthropic-ai/sdk";

export const processPatient = action({
  args: {
    patientId: v.id("patients"),
  },
  handler: async (ctx, args) => {
    const patient = await ctx.runQuery(api.patients.get, {
      patientId: args.patientId,
    });

    if (!patient) {
      throw new Error("Patient not found");
    }

    const rules = await ctx.runQuery(api.rules.list);
    const rulesText = rules
      .map((r) => `## ${r.ruleName}\n${r.ruleContent}`)
      .join("\n\n");

    const prompt = `You are a cardiology study authorization AI assistant for MSW Heart Cardiology. Analyze the following patient information and determine authorization status based on the rules provided.

## Authorization Rules
${rulesText}

## Patient Information
- MRN: ${patient.mrn}
- Date of Service: ${patient.dateOfService}
- Patient Type: ${patient.patientType}
- Clinical Notes: ${patient.clinicalNotes}
- Insurance Information: ${patient.insuranceInfo}
- Previous Studies: ${patient.previousStudies}

## Instructions
Analyze the clinical information and return a JSON response with the following structure:
{
  "decision": "APPROVED_CLEAN" | "APPROVED_NEEDS_LETTER" | "DENIED",
  "recommendedStudy": "NUCLEAR" | "STRESS_ECHO" | "ECHO" | "VASCULAR" | "NONE",
  "rationale": "Detailed explanation with inline citations. Every claim must include a direct quote from the clinical notes in the format: Per [date] note: '[exact quote]'. If a claim cannot be supported by a direct quote, state that explicitly. If symptoms cannot be confirmed as new/worsening, recommend provider documentation.",
  "supportingCriteria": [
    {
      "ruleName": "Name of the authorization rule (e.g. Nuclear Stress Test)",
      "criterion": "Exact criterion text from the rule that supports this decision",
      "clinicalEvidence": "The specific clinical finding from the patient that matches this criterion"
    }
  ],
  "denialReason": "If denied, specific reason for denial" | null,
  "extractedPatientName": "Patient name from notes" | null,
  "extractedDob": "Patient DOB from notes" | null,
  "extractedPhysician": "Referring physician from notes" | null,
  "extractedDiagnoses": ["list", "of", "diagnoses"],
  "extractedSymptoms": ["list", "of", "symptoms"],
  "extractedPriorStudies": ["list", "of", "prior", "studies"],
  "missingFields": ["list of missing required fields"] | null,
  "needsReview": false
}

Important rules:
1. If insurance is Medicare (traditional/original), auto-approve ONLY when the clinical documentation is sufficient to support the study. Medicare auto-approval means insurance won't deny it, but the documentation must still meet clinical standards. If the notes are missing key symptom documentation (see rule 15 - "magic words"), set needsReview to true and recommend the provider strengthen the documentation before proceeding.
2. Medicare Advantage should be treated as commercial insurance.
3. Follow the study hierarchy: Nuclear > Stress Echo > Echo > Vascular. Use NONE if no cardiac study is clinically appropriate.
4. If critical clinical information is missing, set needsReview to true and list missing fields.
5. Reference the specific authorization rule and criterion text that supports the decision. Quote the exact criterion from the rules. Structure the rationale as: clinical finding → matching rule citation.
6. The "supportingCriteria" array must include every rule criterion that supports the decision. Each entry should cite the rule name, quote the exact criterion text, and describe the clinical evidence from the patient.
7. CITATION REQUIREMENT: Every factual claim in the rationale MUST include a direct quote from the clinical notes. Use the format: Per [date] note: "[exact quote from notes]". If a date is present in the notes near the quoted text, include it. If no date is available, use: Per clinical notes: "[exact quote]". Do NOT paraphrase or infer facts without citing the exact source text. If you cannot find a direct quote to support a claim, state that explicitly.
8. SYMPTOM STRICTNESS: Only claim "new or worsening symptoms" when the clinical notes EXPLICITLY describe symptoms as new in onset or worsening/changed compared to a prior state. Chronic or stable symptoms (e.g., "leg swelling since CABG in 2021") do NOT qualify as "new or worsening" unless the notes explicitly state they have changed or progressed. If you cannot find explicit evidence of new/worsening symptoms, try to justify the study under a different approved criterion instead. If no criterion can be confidently supported with cited evidence, set needsReview to true.
9. PROVIDER DOCUMENTATION GUIDANCE: When a patient's history suggests they may have new/worsening symptoms but the clinical notes do not explicitly document this, include a note in the rationale recommending that the provider document the new or worsening nature of the symptoms to strengthen the authorization case. For example: "The clinical notes do not explicitly describe these symptoms as new or worsening. If the patient's symptoms have changed, the provider should document this to strengthen the authorization."
10. DOCUMENTATION SUFFICIENCY CHECK: Before approving any study, evaluate whether the clinical notes contain adequate documentation. Check for the following elements (not all are required for every case, but assess which are relevant to the requested study and flag missing ones):
   - Cardiac risk factors (diabetes, smoking, family history, hyperlipidemia, hypertension, obesity)
   - Symptom characterization (quality, severity, duration, frequency, radiation, aggravating/relieving factors)
   - Vital signs (BP, HR, relevant measurements)
   - ECG findings (recent ECG results or explicit note of absence)
   - Functional assessment (exercise tolerance, walking distance, stair climbing ability, daily activity limitations)
   - Prior cardiac testing (previous echo, stress test, catheterization, CT — results and dates)
   - Medication history (current cardiac medications, failed conservative management)
   If key documentation relevant to the requested study is missing, set needsReview to true and list specific missing items in missingFields with recommendations for what the provider should document before resubmitting. Do NOT approve a study when the clinical documentation is insufficient to justify it — even if the clinical picture suggests the study might be appropriate.
11. PRE-TEST PROBABILITY RIGOR: You MUST classify chest pain symptoms using the standard Diamond-Forrester framework before determining pre-test probability. Do NOT rely on the physician's impression alone.
   STEP 1 — Classify the chest pain:
   - TYPICAL ANGINA requires ALL 3: (a) substernal chest discomfort, (b) provoked by exertion or emotional stress, (c) relieved by rest or nitroglycerin within minutes.
   - ATYPICAL ANGINA: meets only 2 of the 3 criteria above.
   - NON-ANGINAL CHEST PAIN: meets 0-1 of the 3 criteria. Symptoms that are "sometimes related to activity but also occur at rest" or have an inconsistent pattern are NON-ANGINAL, not atypical.
   STEP 2 — Estimate pre-test probability using age + gender + symptom type:
   - Male 50-59 with typical angina: ~70% (HIGH)
   - Male 50-59 with atypical angina: ~22% (INTERMEDIATE-LOW)
   - Male 50-59 with non-anginal pain: ~8% (LOW)
   - Female 50-59 with typical angina: ~37% (INTERMEDIATE)
   - Female 50-59 with atypical angina: ~12% (LOW)
   - Female 50-59 with non-anginal pain: ~3% (VERY LOW)
   (Adjust proportionally for other age ranges. Younger patients trend lower, older patients trend higher.)
   STEP 3 — State the classification explicitly in the rationale: "Symptoms classified as [typical/atypical/non-anginal] because [reasoning]. Pre-test probability estimated at [X%] ([LOW/INTERMEDIATE/HIGH]) for a [age]-year-old [male/female]."
   - LOW pre-test probability (<15%): Stress testing generally NOT indicated. Set needsReview to true.
   - INTERMEDIATE pre-test probability (15-65%): Stress testing appropriate.
   - HIGH pre-test probability (>65%): May proceed directly to catheterization; stress testing may still be reasonable.
   If the data to classify symptoms or determine pre-test probability is missing from the notes, flag this in missingFields and set needsReview to true. A physician's impression like "probably cardiac" or "rule out CAD" is NOT a pre-test probability calculation.
12. STUDY TYPE JUSTIFICATION: The rationale must explain why the recommended study type is appropriate over alternatives. Address:
   - Why stress testing over a resting echocardiogram first? (Has a baseline resting study been done?)
   - Why this type of stress test over other options (stress echo vs nuclear vs CT coronary angiography)?
   - Can the patient exercise? (This determines treadmill vs pharmacologic stress protocol)
   - If a higher-level study is recommended, justify why a lower-level study would be insufficient.
13. INSURANCE REVIEWER PERSPECTIVE: Evaluate the case as an insurance medical reviewer would. Ask yourself: would this documentation actually get approved by a commercial payer? If the answer is no due to documentation gaps, inadequate clinical justification, or missing standard-of-care steps, set needsReview to true and explain what additional documentation is needed — even if the study may be clinically appropriate. The goal is to ensure submissions are strong enough to withstand insurance scrutiny.
14. PRIOR STUDY TEMPORAL ANALYSIS: When Previous Studies are provided, you MUST:
   - Identify any prior studies of the same or related type (e.g., a prior echo when a stress echo is requested, a prior nuclear when a repeat nuclear is requested).
   - Calculate how old each relevant prior study is relative to the Date of Service.
   - Cross-reference whether the current symptoms are documented as NEW SINCE that prior study — not merely present. Symptoms that existed at the time of the prior study do not count as "new" unless the notes explicitly state they have changed or worsened since then.
   - Apply the time-based authorization rules accordingly (e.g., "Repeat study within 2 years without new symptoms" should trigger REQUIRES LETTER or DENIED if symptoms are not documented as new since the prior study).
   - If a prior study exists and the notes do not document what has changed since that study, flag this gap in the rationale and recommend the provider document what is different now compared to the prior study results.
15. REQUIRED SYMPTOM DOCUMENTATION ("MAGIC WORDS"): For any cardiac symptom being used to justify a study authorization, the clinical notes MUST document ALL THREE of the following. If any are missing, set needsReview to true and specify which elements the provider needs to add:
   (a) TEMPORAL STATUS: The symptom must be explicitly described as NEW, RECURRENT, or WORSENING. The word must be present or clearly implied (e.g., "progressive", "increasing", "new onset"). If the notes just describe a symptom without indicating it is new/recurrent/worsening, flag it.
   (b) RELATIONSHIP TO EXERTION: The notes must document whether the symptom occurs with exertion/activity. Vague language like "sometimes with activity" or "occasionally" is insufficient — it should clearly state the symptom is provoked by exertion.
   (c) WHAT RESOLVES IT: The notes must document what relieves the symptom — rest, nitroglycerin, cessation of activity, or other. If the notes do not state what resolves the symptom, this is a documentation gap that must be flagged.
   In the rationale, explicitly check each of these three elements and state whether they are present or missing. For example: "Temporal status: Present — 'progressive dyspnea'. Exertional relationship: Present — 'on exertion'. Resolution: MISSING — notes do not state what resolves the symptoms. Recommend provider document what relieves the symptoms."
   This applies regardless of insurance type — even Medicare patients need proper documentation.
16. Return ONLY the JSON, no other text.`;

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    try {
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      });

      const content = response.content[0];
      if (content.type !== "text") {
        throw new Error("Unexpected response type");
      }

      let jsonText = content.text.trim();
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonText = jsonMatch[0];
      }

      const result = JSON.parse(jsonText);

      const status = result.needsReview ? "NEEDS_REVIEW" : "COMPLETE";
      const decision = result.needsReview ? undefined : (result.decision || undefined);

      await ctx.runMutation(api.patients.updateWithResults, {
        patientId: args.patientId,
        status,
        decision,
        recommendedStudy: result.recommendedStudy || undefined,
        rationale: result.rationale,
        denialReason: result.denialReason || undefined,
        extractedPatientName: result.extractedPatientName || undefined,
        extractedDob: result.extractedDob || undefined,
        extractedPhysician: result.extractedPhysician || undefined,
        extractedDiagnoses: result.extractedDiagnoses || undefined,
        extractedSymptoms: result.extractedSymptoms || undefined,
        extractedPriorStudies: result.extractedPriorStudies || undefined,
        supportingCriteria: result.supportingCriteria || undefined,
        missingFields: result.missingFields || undefined,
      });
    } catch (error) {
      console.error("AI processing error:", error);
      await ctx.runMutation(api.patients.updateWithResults, {
        patientId: args.patientId,
        status: "NEEDS_REVIEW",
        rationale: `AI processing failed: ${error instanceof Error ? error.message : "Unknown error"}. Manual review required.`,
        missingFields: ["AI processing error - manual review needed"],
      });
    }
  },
});
