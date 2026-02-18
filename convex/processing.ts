"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import Anthropic from "@anthropic-ai/sdk";

// Helper function to build the authorization prompt
function buildAuthorizationPrompt(
  patient: {
    mrn?: string;
    dateOfService: string;
    patientType: string;
    clinicalNotes: string;
    insuranceInfo: string;
    previousStudies: string;
  },
  rulesText: string,
  referenceCasesSection: string,
  hasPdf: boolean
): string {
  const pdfInstructions = hasPdf
    ? `\n\nNOTE: A referral PDF document has been provided. Extract all relevant clinical information from the PDF including:
- Patient name, DOB
- Insurance information (carrier, plan type - determine if Medicare/Medicare Advantage/Commercial)
- Referring physician
- All diagnoses listed
- Any symptoms or clinical findings mentioned
- Any prior cardiac studies mentioned
Use this extracted information in combination with any additional notes provided below.\n`
    : "";

  return `You are a cardiology study authorization AI assistant for MSW Heart Cardiology. Analyze the following patient information and determine authorization status based on the rules provided.${pdfInstructions}

## Authorization Rules
${rulesText}${referenceCasesSection}

## Patient Information
- MRN: ${patient.mrn || "(not provided - extract from notes if available)"}
- Date of Service: ${patient.dateOfService}
- Patient Type: ${patient.patientType}
- Clinical Notes: ${patient.clinicalNotes || "(See attached referral PDF)"}
- Insurance Information: ${patient.insuranceInfo || "(Extract from referral PDF if available)"}
- Previous Studies: ${patient.previousStudies || "(Extract from referral PDF if available)"}`;
}

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

    // Fetch active training examples for few-shot injection
    const trainingExamples = await ctx.runQuery(api.training.listActive);
    let referenceCasesSection = "";
    const usedExampleIds: string[] = [];
    if (trainingExamples.length > 0) {
      const examples = trainingExamples.slice(0, 5);
      usedExampleIds.push(...examples.map((e) => e._id));
      const casesText = examples
        .map(
          (e, i) =>
            `### Case ${i + 1}\n**Pattern:** ${e.clinicalPatternSummary}\n**Correct Decision:** ${e.correctDecision}\n**Rationale:** ${e.rationale}\n**Rules Applied:** ${e.rulesCited.join(", ")}`
        )
        .join("\n\n");
      referenceCasesSection = `\n\n## Reference Cases\nThe following are examples of correct authorization decisions based on MD review feedback. Use these as guidance for similar cases:\n\n${casesText}\n`;
    }

    // Check if patient has a PDF referral
    const hasPdf = !!patient.referralPdfStorageId;
    let pdfBase64: string | null = null;

    if (hasPdf && patient.referralPdfStorageId) {
      try {
        // Get PDF URL from storage
        const pdfUrl = await ctx.storage.getUrl(patient.referralPdfStorageId);
        if (pdfUrl) {
          // Fetch PDF bytes
          const pdfResponse = await fetch(pdfUrl);
          const pdfBuffer = await pdfResponse.arrayBuffer();
          // Convert to base64
          pdfBase64 = Buffer.from(pdfBuffer).toString("base64");
        }
      } catch (error) {
        console.error("Failed to fetch PDF:", error);
        // Continue without PDF if fetch fails
      }
    }

    const prompt = buildAuthorizationPrompt(
      patient,
      rulesText,
      referenceCasesSection,
      hasPdf && !!pdfBase64
    ) + `

## Instructions
Analyze the clinical information and return a JSON response with the following structure:

## Authorization Rules
${rulesText}${referenceCasesSection}

## Patient Information
- MRN: ${patient.mrn || "(not provided - extract from notes if available)"}
- Date of Service: ${patient.dateOfService}
- Patient Type: ${patient.patientType}
- Clinical Notes: ${patient.clinicalNotes}
- Insurance Information: ${patient.insuranceInfo}
- Previous Studies: ${patient.previousStudies}

## Instructions
Analyze the clinical information and return a JSON response with the following structure:
{
  "decision": "APPROVED_CLEAN" | "BORDERLINE_NEEDS_LETTER" | "DENIED",
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
  "extractedMrn": "Patient MRN (Medical Record Number) from notes" | null,
  "extractedDiagnoses": ["list", "of", "diagnoses"],
  "extractedSymptoms": ["list", "of", "symptoms"],
  "extractedPriorStudies": ["list", "of", "prior", "studies"],
  "missingFields": ["list of missing required fields"] | null,
  "needsReview": false,
  "needsLetterReason": "ASYMPTOMATIC_HIGH_RISK_SCREENING" | "REPEAT_NUCLEAR_WITHIN_2_YEARS" | "PREOP_LOW_RISK_SURGERY" | "VALVE_FOLLOWUP_NO_NEW_SYMPTOMS" | "ATHLETE_SCREENING_HCM_HISTORY" | "REPEAT_STRESS_ECHO_WITHIN_1_YEAR" | "STABLE_VALVE_FREQUENT_FOLLOWUP" | "STABLE_HF_REPEAT" | "ROUTINE_HTN_FOLLOWUP" | "ASYMPTOMATIC_CAROTID_SCREENING" | "MINOR_STENOSIS_FREQUENT_FOLLOWUP" | "VENOUS_INSUFFICIENCY_NO_ULCERATION" | null
}

Important rules:
1. If insurance is Medicare (traditional/original), the study is approved per Medicare coverage guidelines when the clinical documentation is sufficient to support the study. Medicare covers medically indicated studies, but the documentation must still meet clinical standards. If the notes are missing key symptom documentation (see rule 15 - "magic words"), set needsReview to true and recommend the provider strengthen the documentation before proceeding.
2. Medicare Advantage should be treated as commercial insurance.
3. Follow the study hierarchy: Nuclear > Stress Echo > Echo > Vascular. Use NONE if no cardiac study is clinically appropriate.
3a. BORDERLINE_NEEDS_LETTER REASON: When setting decision to "BORDERLINE_NEEDS_LETTER", you MUST also set needsLetterReason to identify which specific "REQUIRES LETTER" criterion triggered this decision. Valid values are:
   - For Nuclear: ASYMPTOMATIC_HIGH_RISK_SCREENING (asymptomatic screening in high-risk population), REPEAT_NUCLEAR_WITHIN_2_YEARS (repeat study within 2 years without new symptoms), PREOP_LOW_RISK_SURGERY (pre-operative assessment for low-risk surgery)
   - For Stress Echo: VALVE_FOLLOWUP_NO_NEW_SYMPTOMS (follow-up of valve disease without new symptoms), ATHLETE_SCREENING_HCM_HISTORY (athlete screening with HCM family history), REPEAT_STRESS_ECHO_WITHIN_1_YEAR (repeat within 1 year without clinical change)
   - For Echo: STABLE_VALVE_FREQUENT_FOLLOWUP (stable valve disease more frequently than annually), STABLE_HF_REPEAT (stable heart failure without clinical change), ROUTINE_HTN_FOLLOWUP (routine follow-up of well-controlled hypertension)
   - For Vascular: ASYMPTOMATIC_CAROTID_SCREENING (asymptomatic carotid screening with risk factors), MINOR_STENOSIS_FREQUENT_FOLLOWUP (minor stenosis follow-up more than annually), VENOUS_INSUFFICIENCY_NO_ULCERATION (venous insufficiency without ulceration)
   If the decision is NOT BORDERLINE_NEEDS_LETTER, set needsLetterReason to null.
4. If critical clinical information is missing, set needsReview to true and list missing fields. NOTE: "Study type" and "clinical indication" are NOT missing fields — YOU determine those based on the patient's diagnoses, symptoms, and clinical findings. Missing fields should be things like: symptom characterization, temporal status, prior study results, etc.
5. Reference the specific authorization rule and criterion text that supports the decision. Quote the exact criterion from the rules. Structure the rationale as: clinical finding → matching rule citation.
6. The "supportingCriteria" array must include every rule criterion that supports the decision. Each entry should cite the rule name, quote the exact criterion text, and describe the clinical evidence from the patient.
7. CITATION REQUIREMENT: Every factual claim in the rationale MUST include a direct quote from the clinical notes. Use the format: Per [date] note: "[exact quote from notes]". If a date is present in the notes near the quoted text, include it. If no date is available, use: Per clinical notes: "[exact quote]". Do NOT paraphrase or infer facts without citing the exact source text. If you cannot find a direct quote to support a claim, state that explicitly.
8. SYMPTOM STRICTNESS: Only claim "new or worsening symptoms" when the clinical notes EXPLICITLY describe symptoms as new in onset or worsening/changed compared to a prior state. Chronic or stable symptoms (e.g., "leg swelling since CABG in 2021") do NOT qualify as "new or worsening" unless the notes explicitly state they have changed or progressed. If you cannot find explicit evidence of new/worsening symptoms, try to justify the study under a different approved criterion instead. If no criterion can be confidently supported with cited evidence, set needsReview to true.
9. PROVIDER DOCUMENTATION GUIDANCE: When a patient's history suggests they may have new/worsening symptoms but the clinical notes do not explicitly document this, include a note in the rationale recommending that the provider document the new or worsening nature of the symptoms to strengthen the authorization case. For example: "The clinical notes do not explicitly describe these symptoms as new or worsening. If the patient's symptoms have changed, the provider should document this to strengthen the authorization."
10. DOCUMENTATION SUFFICIENCY CHECK: Before approving any study, evaluate whether the clinical notes contain adequate documentation. Check for the following elements (not all are required for every case, but assess which are relevant to the study YOU ARE RECOMMENDING and flag missing ones). NOTE: You determine the study type based on clinical findings and the hierarchy — do NOT flag "specific study type being requested" as missing since that is YOUR job to determine:
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
12. STUDY TYPE JUSTIFICATION: YOU must determine the appropriate study type — this is never provided in the input. The rationale must explain why the study type you are recommending is appropriate over alternatives. Address:
   - Why stress testing over a resting echocardiogram first? (Has a baseline resting study been done?)
   - Why this type of stress test over other options (stress echo vs nuclear vs CT coronary angiography)?
   - Can the patient exercise? (This determines treadmill vs pharmacologic stress protocol)
   - If a higher-level study is recommended, justify why a lower-level study would be insufficient.
   IMPORTANT: Never list "specific study type being requested" or "current clinical indication for imaging" as missing fields — you determine the study type and clinical indication based on the documented findings.
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
16. PROACTIVE STUDY RECOMMENDATION: Even if the clinical notes do not explicitly request a specific cardiac study, you MUST evaluate whether the patient qualifies for any study (nuclear stress test, stress echocardiogram, echocardiogram, or vascular study) based on their diagnoses, symptoms, risk factors, and cardiac history. If the clinical picture suggests a study is appropriate:
   - Recommend the most appropriate study per the study hierarchy and authorization rules.
   - Explain in the rationale why this patient may benefit from the study, citing their clinical findings.
   - If the documentation is insufficient to fully authorize the study but the patient likely qualifies, still recommend the study in the recommendedStudy field, set needsReview to true, and explain what additional documentation the provider should add to get the study authorized. Frame it as: "Based on the patient's [clinical findings], a [study type] may be clinically appropriate. To authorize this study, the provider should document: [specific missing elements]."
   - The goal is to help the provider identify studies their patients qualify for, not just rubber-stamp what was requested.
16a. PRIOR STUDY INVENTORY: Before determining the recommended study, you MUST explicitly inventory what cardiac studies the patient HAS and HAS NOT had based on the Previous Studies field and clinical notes:
   - List any prior nuclear/MPI studies with dates (or state "No prior nuclear stress test documented")
   - List any prior stress echos with dates (or state "No prior stress echo documented")
   - List any prior resting echos with dates (or state "No prior resting echo documented")
   - List any prior cardiac catheterizations with dates (or state "No prior cardiac catheterization documented")
   For patients who have NEVER had a particular study type that is now clinically indicated, this absence is significant and should factor into the recommendation. A patient with CAD or diabetes who has never had nuclear testing is a strong candidate for first-time ischemia evaluation.
16b. FIRST-TIME ISCHEMIA EVALUATION: For patients with known CAD, diabetes with cardiac risk factors, or other conditions indicating possible ischemic heart disease, you MUST explicitly assess whether they have ever had a prior nuclear stress test or equivalent ischemia evaluation:
   - If the patient has NEVER had a nuclear stress test (or myocardial perfusion imaging) and has indications for ischemia evaluation (CAD, diabetes with cardiac symptoms, multiple cardiac risk factors, etc.), this is a STRONG indication for nuclear testing — not just the absence of a contraindication.
   - The absence of prior nuclear testing in a patient with ischemic risk factors should be explicitly noted in the rationale as a positive indicator for nuclear study.
   - Do NOT default to echo for these patients simply because they also have heart failure or other echo indications — the study hierarchy (Nuclear > Echo) applies, and evaluating for ischemia takes diagnostic priority when both indications are present.
   - State explicitly in the rationale: "Patient has [never had / last had on DATE] a nuclear stress test. Given [CAD/diabetes/risk factors], ischemia evaluation with nuclear testing is indicated."
16c. STUDY HIERARCHY ENFORCEMENT: When a patient qualifies for multiple study types, you MUST:
   1. List ALL study types the patient qualifies for (e.g., "Patient qualifies for: Nuclear (CAD with diabetes), Echo (heart failure symptoms)")
   2. Apply the hierarchy strictly: Nuclear > Stress Echo > Echo > Vascular
   3. Recommend the HIGHEST-LEVEL study the patient qualifies for
   4. Explain why the higher-level study takes priority (e.g., "Nuclear is recommended over echo because evaluating ischemia in a patient with CAD and diabetes takes diagnostic priority. Ischemia evaluation has not been performed.")
   5. Note that lower-level studies may still be clinically appropriate and can be addressed separately, but the primary authorization recommendation should be the highest-level indicated study.
17. STRICT CRITERIA MATCHING — NO ROUNDING OR APPROXIMATION: When authorization rules specify numeric thresholds (e.g., ">50% stenosis", "within 2 years", "annual"), apply them EXACTLY as written. Do NOT round, approximate, or rationalize near-misses:
   - If a rule says ">50% stenosis" and the patient has 40-59% stenosis, the patient does NOT meet the >50% threshold. "Approaching 50%" or "moderate stenosis" is NOT equivalent to >50%. Do not approve under this criterion.
   - If a rule says "annual" surveillance, calculate the exact time since the last study. If it has been less than 12 months, the study is premature regardless of clinical rationale.
   - If a rule says "within 2 years" or ">5 years", calculate the exact time elapsed and apply the threshold literally.
17a. DATE CITATION IN RATIONALE: When timing criteria affect the authorization decision, you MUST explicitly cite the relevant dates in the rationale:
   - If a prior study is found, state: "Last [study type] [DATE], [X years/months] ago" — Example: "Last echo 3/15/2024, over 1 year ago — annual reassessment indicated"
   - If NO prior study is documented, state: "No documented [study type] found — study is clinically indicated" — Example: "No documented echocardiogram found — baseline assessment indicated"
   - This ensures decisions are transparent, auditable, and clearly reference the source data.
17b. SCHEDULED vs COMPLETED STUDY VALIDATION: When clinical notes mention a study was "scheduled", "ordered", "planned", or "pending" for a specific date, you MUST distinguish between scheduled and completed:
   - Compare the scheduled date to today's date (the Date of Service or current date).
   - If the scheduled date is in the PAST and there is NO subsequent documentation confirming the study was actually performed with results:
     - Do NOT count this as a completed prior study in extractedPriorStudies
     - Do NOT use it to deny or delay current authorization based on "recent study" timing rules
     - Note in rationale: "A [study type] was scheduled for [DATE] per [note date], but no completion record or results found — cannot assume study was performed"
   - If the scheduled date is in the FUTURE relative to today:
     - Note that the study is pending but not yet completed
     - This pending study does NOT affect current authorization timing rules
   - Only count a study as "completed" if there is explicit documentation of BOTH: (a) the study being performed/completed, AND (b) results or findings from that study
   - A note stating "echo scheduled for next month" or "stress test ordered" without subsequent results documentation is NOT evidence the study was done.
18. RESPECT PROVIDER'S OWN FOLLOW-UP PLAN: If the clinical notes document the provider's own follow-up timeline (e.g., "Follow up in 1 year August 2026"), and the current Date of Service is BEFORE that planned date, this is an early repeat study. Flag this discrepancy explicitly in the rationale. Unless there are NEW symptoms or clinical changes documented since the last study that justify early repeat imaging, the study should be flagged as premature. Set needsReview to true and note: "The provider's own notes indicate follow-up planned for [date]. The current request at [DOS] is [X months] early. No new symptoms or clinical changes are documented to justify early imaging."
19. STABLE DISEASE WITHOUT NEW FINDINGS: If prior studies show stable/unchanged findings over multiple time points (e.g., "No change from 2024, 2021"), and no new symptoms or clinical changes are documented, routine surveillance should follow standard intervals. Stable disease does NOT justify accelerated imaging schedules. Explicitly note the stability in the rationale and whether the timing is appropriate.
20. DUPLICATE/RECENT TESTING DENIAL: If the same or equivalent study was performed within 90 days and the results are already known, a repeat study is almost NEVER appropriate. Specifically:
   - Check the Previous Studies field AND the clinical notes for any mention of the same study type recently performed.
   - Calculate the exact number of days between the prior study and the Date of Service.
   - If the same study was done within 90 days, DENY unless there is a documented acute clinical change (e.g., new MI, acute decompensation, post-intervention reassessment) that specifically requires reimaging.
   - "New or worsening symptoms" alone do NOT justify repeating a test whose results are already known — the clinical question has already been answered.
   - State in the rationale: "A [study type] was performed on [date], [X days] ago, which showed [results]. Repeating this test will not provide new diagnostic information."
21. CLINICAL NEXT-STEP LOGIC: Evaluate whether the study you are recommending is the appropriate NEXT step in the diagnostic pathway, not just whether the patient meets criteria for that study in isolation:
   - POSITIVE STRESS TEST (ischemia demonstrated) → Next step is cardiac catheterization, NOT repeat stress testing. If a prior stress test already showed ischemia/reversible defects, approving another stress test is clinically inappropriate. DENY the repeat stress test and note that cardiac catheterization is the indicated next step.
   - ABNORMAL ECHO showing severe valve disease → Next step may be surgical evaluation or TEE, not repeat TTE.
   - Known multi-vessel CAD on cath → Stress testing adds no value; management decisions are based on cath findings.
   - If your analysis concludes a different study or intervention is more appropriate than what you initially considered, recommend the more appropriate one instead. You must NEVER contradict your own clinical reasoning — if the rationale says "the clinical focus should be on catheterization," then the decision CANNOT be to recommend a repeat stress test.
22. INTERNAL CONSISTENCY CHECK: Before finalizing the decision, review the entire rationale for self-contradictions. If the rationale identifies reasons the study may not be appropriate (e.g., "clinical focus should be on catheterization" or "premature repeat" or "documentation insufficient"), the decision MUST reflect those concerns. Do NOT approve a study while simultaneously noting it may be inappropriate. If there is ANY concern raised in the rationale, the decision should be NEEDS_REVIEW or DENIED, not APPROVED.
23. PRIOR STUDY RESULTS REQUIRED: When a prior study is cited to justify authorization (e.g., "prior carotid duplex" to support surveillance), the RESULTS of that prior study must be documented in the clinical notes. If a prior study is mentioned but its results are not provided, you CANNOT assume it supports the authorization. Specifically:
   - If criteria require a specific finding from a prior study (e.g., "stenosis >50%"), the actual percentage or result must be stated in the notes. "Prior carotid duplex performed on [date]" without results is INSUFFICIENT — you need to know what it showed.
   - Do NOT infer or assume prior study results. If the notes say a carotid duplex was done but don't state the stenosis percentage, you cannot claim the patient meets the ">50% stenosis" criterion.
   - Flag missing prior study results in missingFields and set needsReview to true. State: "Prior [study] from [date] is referenced but results are not documented. Cannot determine if [specific criterion] is met without knowing the results."
24. SYMPTOM-STUDY MATCH: The patient's symptoms must be clinically relevant to the study you are recommending. Do NOT recommend a study based on symptoms that are unrelated to what that study evaluates:
   - CAROTID studies: Requires carotid-relevant symptoms (TIA, stroke, amaurosis fugax, carotid bruit, dizziness/syncope with vascular etiology) OR documented stenosis requiring surveillance. Non-exertional chest pain and anxiety-related palpitations are NOT carotid indications.
   - LOWER EXTREMITY ARTERIAL studies: Requires arterial symptoms (claudication, non-healing wounds, abnormal ABI, rest pain). NOT indicated for chest pain or palpitations.
   - LOWER EXTREMITY VENOUS studies: For DVT/venous insufficiency — completely different from arterial disease. A prior venous study does NOT justify arterial surveillance and vice versa. Do not conflate venous and arterial studies.
   - CARDIAC studies (echo, stress): Requires cardiac symptoms (chest pain, dyspnea, syncope, etc.)
   - If you cannot find symptoms that match any study type, recommend NONE and explain why no cardiac study is indicated.
25. STUDY TYPE ACCURACY: Do not conflate different types of vascular studies. Venous studies (DVT screening, venous insufficiency) are fundamentally different from arterial studies (carotid duplex, lower extremity arterial). Citing a venous study as justification for arterial surveillance is clinically incorrect. Each study type must be evaluated against its own specific criteria.
26. QUALIFICATION GAP ANALYSIS: For EVERY case that does not strictly meet authorization criteria — whether flagged as NEEDS_REVIEW or DENIED — the rationale MUST include a clear "What is needed to qualify" section. This should be a specific, actionable list telling the provider exactly what documentation or clinical elements are missing. Format it as:
   "TO QUALIFY FOR [study type], the following must be documented:
   1. [Specific missing element] — e.g., 'Stenosis percentage from prior carotid duplex (currently not documented)'
   2. [Specific missing element] — e.g., 'Symptom onset described as new, recurrent, or worsening'
   3. [Specific missing element] — e.g., 'What resolves the symptoms (rest, nitroglycerin, etc.)'
   ..."
   This is NOT optional. Every non-approved case must tell the provider the exact path to getting the study authorized. The goal is to help the provider strengthen their documentation so the patient can get the study if it's truly needed. Be specific — don't say "more documentation needed," say exactly WHAT documentation.
27. PRIOR TEST REPEAT INTERVALS BASED ON RESULTS: Repeat testing intervals depend on what the prior study showed:
   A) NORMAL prior test + stable symptoms → minimum 12 months before repeat:
      - If a prior study of the same type was normal/negative and symptoms are described as stable, unchanged, or not worsened → DENY if less than 12 months (365 days) have elapsed since the prior study.
      - "Exercise tolerance is stable," "symptoms unchanged," "no new complaints" = stable symptoms = NO repeat justified.
      - Calculate exact days since the prior normal test. If <365 days with stable symptoms → DENY.
      - State in rationale: "Prior [study] on [date] ([X days] ago) was NORMAL. Symptoms are described as stable/unchanged. There is no clinical indication to repeat this study within 12 months of a normal result."
      - Exception: A new acute clinical event (MI, hospitalization, new arrhythmia, post-intervention, acute decompensation) justifies earlier repeat even after a normal test.
   B) ABNORMAL prior test with medical management → 6-12 month repeat may be appropriate:
      - If a prior study showed abnormal findings AND the patient was started on or adjusted medical management, a follow-up at 6-12 months may be warranted to assess treatment response.
      - Must document: (1) what the abnormality was, (2) what treatment was initiated or changed, and (3) what specific clinical question the repeat study will answer.
      - This is NOT automatic — still requires clinical justification beyond just "had an abnormal test."
28. ALTERNATIVE NON-CARDIAC DIAGNOSES: Before attributing symptoms to a cardiac etiology and approving a cardiac study, the AI must consider whether non-cardiac explanations are more likely given the full clinical picture. Common non-cardiac causes of symptoms that mimic cardiac disease:
   - Obesity / deconditioning → dyspnea on exertion, exercise intolerance, fatigue
   - Hypothyroidism → fatigue, exercise intolerance, weight gain
   - Anemia → dyspnea, fatigue, tachycardia
   - GERD → chest pain, chest discomfort (non-exertional)
   - Musculoskeletal → chest wall pain, positional pain
   - Anxiety / panic disorder → palpitations, chest tightness, dyspnea
   - Pulmonary disease (COPD, asthma) → dyspnea, exercise intolerance
   - Post-CVA deconditioning → exercise intolerance, fatigue
   If the patient has documented non-cardiac conditions that plausibly explain the reported symptoms AND prior cardiac testing was normal, the AI should flag that the symptoms are more likely non-cardiac in origin. Set needsReview to true and state: "Patient has [specific conditions] which may better explain the reported symptoms of [symptoms]. Prior cardiac testing on [date] was normal, making a new cardiac etiology less likely."
29. NONOBSTRUCTIVE CAD IS NOT AN INDICATION FOR REPEAT TESTING: "Nonobstructive CAD" (plaque without hemodynamically significant stenosis) found on prior imaging does NOT constitute a positive finding that warrants repeat stress testing. Nonobstructive CAD means:
   - No hemodynamically significant coronary disease was found
   - The prior test effectively ruled out obstructive disease causing ischemia
   - Repeating the study will show the same nonobstructive disease — no new diagnostic information
   - Appropriate management is medical therapy (statins, aspirin, lifestyle modification), NOT further cardiac imaging
   If "nonobstructive CAD" is cited as justification for a repeat study, DENY unless there is a new acute event (MI, acute coronary syndrome, new arrhythmia). State: "Nonobstructive CAD is a stable finding managed with medical therapy. It does not indicate ischemia and does not justify repeat stress testing. A repeat study will not provide new diagnostic information."
30. MEDICAL CONTRAINDICATION SCREENING: Before finalizing the study recommendation, you MUST screen for medical contraindications that require provider discretion. These are NOT automatic denials — they flag the case for provider review.

   NUCLEAR STRESS TEST CONTRAINDICATIONS (flag for review if detected):
   - Severe valvular disease (severe AS, severe MS, severe AR, severe MR)
   - Uncontrolled asthma or active bronchospasm (regadenoson/adenosine contraindicated)
   - Significant pericardial effusion
   - Pregnancy or suspected pregnancy
   - Heart failure with reduced ejection fraction (HFrEF, EF <40%, reduced LVEF — may affect interpretation and safety)

   STRESS ECHO CONTRAINDICATIONS (flag for review if detected):
   - Severe valvular disease
   - Heart failure with reduced ejection fraction (HFrEF, EF <40%, reduced LVEF)
   - Left bundle branch block (LBBB — causes septal wall motion abnormality, affects interpretation)
   - Pacemaker or paced rhythm (affects wall motion interpretation)
   - Mobility limitations requiring cane/walker (unable to achieve adequate exercise capacity for treadmill stress)
   - Pregnancy or suspected pregnancy

   When a contraindication is detected:
   1. Still recommend the clinically indicated study in recommendedStudy (do NOT change to NONE)
   2. Set needsReview to true
   3. In the rationale, include a clear warning: "Contraindication detected in chart: [condition]. Need review. This is a relative contraindication to [study type]."
   4. Explain the specific clinical concern (e.g., "LBBB causes baseline septal wall motion abnormality that may be misinterpreted as ischemia on stress echo")
   5. Do NOT auto-deny — the provider may determine the study is still appropriate given the full clinical context
31. ASYMPTOMATIC CARDIAC SURVEILLANCE: For patients with established cardiac history, routine surveillance imaging is appropriate even WITHOUT symptoms, provided sufficient time has passed since the last study. This is a recognized pathway for monitoring established cardiac disease.

   APPROVED (APPROVED_CLEAN, no letter required) if ALL of the following are met:
   a) Patient has documented cardiac history: CAD, prior MI, prior revascularization (CABG/PCI), heart failure, cardiomyopathy, or known low EF (<40%)
   b) Last equivalent study was >3 years ago OR no prior study of this type is documented
   c) Study type matches the surveillance need:
      - Nuclear/Stress Echo: For ischemia surveillance in patients with CAD, prior MI, or revascularization history
      - Echo: For LV function monitoring in heart failure, cardiomyopathy, or known low EF

   When approving under this criterion:
   - Decision: APPROVED_CLEAN
   - In rationale, state: "Routine surveillance indicated for [condition]. Last [study type] was [date/more than 3 years ago]. Per cardiology guidelines, asymptomatic surveillance every 3 years is appropriate for established cardiac disease."
   - Do NOT require symptoms for this pathway — asymptomatic patients qualify
   - Do NOT flag as BORDERLINE_NEEDS_LETTER — this is a clean approval pathway

   If last equivalent study was <3 years ago AND patient is asymptomatic:
   - This is premature surveillance without clinical indication
   - Decision: DENIED or BORDERLINE_NEEDS_LETTER
   - In rationale, explain: "Last [study type] was [date], [X years/months] ago. For asymptomatic surveillance of stable cardiac disease, repeat testing is appropriate every 3 years. Earlier repeat requires new or worsening symptoms."

   IMPORTANT: This rule creates an EXCEPTION to the symptom requirements in other rules. Patients with established cardiac history do NOT need to report symptoms to qualify for surveillance testing at 3-year intervals.
32. PROFESSIONAL PAYER-FACING LANGUAGE: The rationale text will appear in documents submitted to insurance companies. It MUST read as a professional clinical justification written by a medical office — never as output from an automated system. Follow ALL of these rules:
   PROHIBITED LANGUAGE — never use any of the following in the rationale:
   - "auto-approve", "auto-approval", "auto-deny", or any "auto-" prefix related to decisions
   - "per authorization rules", "authorization rules state", "per our rules", or any reference to internal rule mechanics
   - "study hierarchy", "hierarchy enforcement", or references to internal study ranking systems
   - "needsReview", "NEEDS_REVIEW", "APPROVED_CLEAN", "BORDERLINE_NEEDS_LETTER", or any internal status codes
   - "the AI", "AI assessment", "AI analysis", "automated system", or any reference to artificial intelligence or automated processing
   - "rule 1", "rule 15", "rule 16b", or any numbered rule references
   - "magic words", "documentation sufficiency check", "qualification gap analysis", or other internal process names
   - "training examples", "reference cases", or mentions of the system learning from prior cases
   - "insurance reviewer perspective" or language suggesting you are simulating a reviewer role
   REQUIRED LANGUAGE STYLE:
   - For Medicare patients: "As per Medicare coverage guidelines, this medically indicated study is approved" or "This study meets Medicare coverage criteria" or "Per Medicare guidelines, the requested study is covered when medically indicated."
   - For all patients: Frame everything in terms of clinical necessity, established medical guidelines, and standard of care — as a physician would write in a clinical justification letter.
   - Reference clinical guidelines by their proper medical names (e.g., "ACC/AHA appropriate use criteria", "standard cardiology practice guidelines") rather than internal rule names.
   - When citing criteria, present them as established medical standards, not as rules from an authorization system.
   - The rationale should sound like it was written by a cardiologist justifying a study to a peer reviewer — professional, clinical, and authoritative.
33. Return ONLY the JSON, no other text.`;

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    try {
      // Build message content - include PDF if available
      let messageContent: Anthropic.MessageParam["content"];

      if (pdfBase64) {
        // Include PDF document with the prompt
        messageContent = [
          {
            type: "document" as const,
            source: {
              type: "base64" as const,
              media_type: "application/pdf" as const,
              data: pdfBase64,
            },
          },
          {
            type: "text" as const,
            text: prompt,
          },
        ];
      } else {
        // Text-only prompt
        messageContent = prompt;
      }

      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 16000,
        thinking: {
          type: "enabled",
          budget_tokens: 10000,
        },
        messages: [{ role: "user", content: messageContent }],
      });

      const textBlock = response.content.find((block: any) => block.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        throw new Error("No text content in response");
      }

      let jsonText = (textBlock as any).text.trim();
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
        extractedMrn: result.extractedMrn || undefined,
        extractedDiagnoses: result.extractedDiagnoses || undefined,
        extractedSymptoms: result.extractedSymptoms || undefined,
        extractedPriorStudies: result.extractedPriorStudies || undefined,
        supportingCriteria: result.supportingCriteria || undefined,
        missingFields: result.missingFields || undefined,
        needsLetterReason: result.needsLetterReason || undefined,
      });

      // Increment usage counts for training examples used in this prompt
      if (usedExampleIds.length > 0) {
        await ctx.runMutation(api.training.incrementUsage, {
          exampleIds: usedExampleIds as any,
        });
      }
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
