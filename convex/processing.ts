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
  "recommendedStudy": "NUCLEAR" | "STRESS_ECHO" | "ECHO" | "VASCULAR",
  "rationale": "Detailed explanation of the authorization decision",
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
1. If insurance is Medicare (traditional/original), auto-approve unless clinically inappropriate.
2. Medicare Advantage should be treated as commercial insurance.
3. Follow the study hierarchy: Nuclear > Stress Echo > Echo > Vascular.
4. If critical clinical information is missing, set needsReview to true and list missing fields.
5. Reference the specific authorization rule and criterion text that supports the decision. Quote the exact criterion from the rules. Structure the rationale as: clinical finding → matching rule citation.
6. The "supportingCriteria" array must include every rule criterion that supports the decision. Each entry should cite the rule name, quote the exact criterion text, and describe the clinical evidence from the patient.
7. Return ONLY the JSON, no other text.`;

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
      const decision = result.needsReview ? undefined : result.decision;

      await ctx.runMutation(api.patients.updateWithResults, {
        patientId: args.patientId,
        status,
        decision,
        recommendedStudy: result.recommendedStudy,
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
