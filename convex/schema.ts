import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  patients: defineTable({
    mrn: v.optional(v.string()),
    dateOfService: v.string(),
    patientType: v.union(v.literal("NEW"), v.literal("FOLLOWUP")),
    clinicalNotes: v.string(),
    insuranceInfo: v.string(),
    previousStudies: v.string(),
    status: v.union(
      v.literal("PROCESSING"),
      v.literal("COMPLETE"),
      v.literal("NEEDS_REVIEW")
    ),
    decision: v.optional(
      v.union(
        v.literal("APPROVED_CLEAN"),
        v.literal("BORDERLINE_NEEDS_LETTER"),
        v.literal("APPROVED_NEEDS_LETTER"), // Deprecated: kept for backwards compatibility with existing data
        v.literal("DENIED")
      )
    ),
    recommendedStudy: v.optional(
      v.union(
        v.literal("NUCLEAR"),
        v.literal("STRESS_ECHO"),
        v.literal("ECHO"),
        v.literal("VASCULAR"),
        v.literal("NONE")
      )
    ),
    rationale: v.optional(v.string()),
    denialReason: v.optional(v.string()),
    extractedPatientName: v.optional(v.string()),
    extractedDob: v.optional(v.string()),
    extractedPhysician: v.optional(v.string()),
    extractedMrn: v.optional(v.string()),
    extractedDiagnoses: v.optional(v.array(v.string())),
    extractedSymptoms: v.optional(v.array(v.string())),
    extractedPriorStudies: v.optional(v.array(v.string())),
    attestationPdfUrl: v.optional(v.string()),
    supportingCriteria: v.optional(v.array(v.object({
      ruleName: v.string(),
      criterion: v.string(),
      clinicalEvidence: v.string(),
    }))),
    missingFields: v.optional(v.array(v.string())),
    selectedProvider: v.optional(v.string()),
    // Qualification flow fields (for upgrading DENIED to approved via symptoms)
    qualifiedViaSymptom: v.optional(v.boolean()),
    qualifyingSymptom: v.optional(v.string()),
    qualifyingRationale: v.optional(v.string()),
    originalDecision: v.optional(v.string()),
    // Second qualified study (when 2 studies are warranted)
    secondRecommendedStudy: v.optional(
      v.union(
        v.literal("NUCLEAR"),
        v.literal("STRESS_ECHO"),
        v.literal("ECHO"),
        v.literal("VASCULAR")
      )
    ),
    secondQualifyingSymptom: v.optional(v.string()),
    secondQualifyingRationale: v.optional(v.string()),
    // PDF referral upload fields
    referralPdfStorageId: v.optional(v.id("_storage")),  // Convex storage ID for uploaded PDF
    // Physician addendums/clarifications
    addendums: v.optional(v.array(v.object({
      text: v.string(),
      addedBy: v.string(),
      addedByName: v.string(),
      addedAt: v.number(),
    }))),
    // Attestation letter justification fields (for BORDERLINE_NEEDS_LETTER cases)
    needsLetterReason: v.optional(
      v.union(
        // Nuclear reasons
        v.literal("ASYMPTOMATIC_HIGH_RISK_SCREENING"),
        v.literal("REPEAT_NUCLEAR_WITHIN_2_YEARS"),
        v.literal("PREOP_LOW_RISK_SURGERY"),
        // Stress Echo reasons
        v.literal("VALVE_FOLLOWUP_NO_NEW_SYMPTOMS"),
        v.literal("ATHLETE_SCREENING_HCM_HISTORY"),
        v.literal("REPEAT_STRESS_ECHO_WITHIN_1_YEAR"),
        // Echo reasons
        v.literal("STABLE_VALVE_FREQUENT_FOLLOWUP"),
        v.literal("STABLE_HF_REPEAT"),
        v.literal("ROUTINE_HTN_FOLLOWUP"),
        // Vascular reasons
        v.literal("ASYMPTOMATIC_CAROTID_SCREENING"),
        v.literal("MINOR_STENOSIS_FREQUENT_FOLLOWUP"),
        v.literal("VENOUS_INSUFFICIENCY_NO_ULCERATION")
      )
    ),
    letterJustifications: v.optional(v.array(v.string())),
    letterJustificationOther: v.optional(v.string()),
    letterJustificationsConfirmedAt: v.optional(v.number()),
    letterJustificationsConfirmedBy: v.optional(v.string()),
    smsSurveyId: v.optional(v.id("smsSurveys")),
    createdAt: v.number(),
    createdBy: v.string(),
    archived: v.boolean(),
  })
    .index("by_status", ["status"])
    .index("by_dateOfService", ["dateOfService"])
    .index("by_createdAt", ["createdAt"])
    .index("by_createdBy", ["createdBy"]),

  smsSurveys: defineTable({
    patientId: v.id("patients"),
    phoneNumber: v.string(),
    status: v.union(
      v.literal("PENDING"),
      v.literal("IN_PROGRESS"),
      v.literal("COMPLETED"),
      v.literal("EXPIRED"),
      v.literal("OPTED_OUT")
    ),
    currentQuestionIndex: v.number(),
    questions: v.array(
      v.object({
        questionId: v.string(),
        questionText: v.string(),
        medicalTerm: v.string(),
        response: v.optional(v.string()),
        answeredYes: v.optional(v.boolean()),
        answeredAt: v.optional(v.number()),
        followUpResponse: v.optional(v.string()),
        followUpAnsweredYes: v.optional(v.boolean()),
        followUpAnsweredAt: v.optional(v.number()),
      })
    ),
    followUpPending: v.boolean(),
    invalidReplyCount: v.number(),
    initiatedBy: v.string(),
    initiatedByName: v.string(),
    createdAt: v.number(),
    lastMessageAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_patientId", ["patientId"])
    .index("by_phoneNumber_status", ["phoneNumber", "status"])
    .index("by_status", ["status"]),

  providers: defineTable({
    name: v.string(),
    credentials: v.string(),
    npi: v.string(),
    signatureStorageId: v.optional(v.id("_storage")),
    clerkUserId: v.optional(v.string()),
  }).index("by_clerkUserId", ["clerkUserId"]),

  authorizationRules: defineTable({
    ruleName: v.string(),
    ruleContent: v.string(),
    updatedAt: v.number(),
    updatedBy: v.string(),
  }).index("by_ruleName", ["ruleName"]),

  reviews: defineTable({
    patientId: v.id("patients"),
    reviewStatus: v.union(
      v.literal("PENDING"),
      v.literal("APPROVED"),
      v.literal("HELD")
    ),
    reviewerId: v.optional(v.id("providers")),
    reviewerClerkUserId: v.optional(v.string()),
    reviewerName: v.optional(v.string()),
    notes: v.optional(v.string()),
    reviewedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_patientId", ["patientId"])
    .index("by_reviewerId", ["reviewerId"])
    .index("by_reviewStatus", ["reviewStatus"]),

  decisionFeedback: defineTable({
    patientId: v.id("patients"),
    reviewId: v.optional(v.id("reviews")),
    reviewerClerkUserId: v.string(),
    category: v.union(
      v.literal("DOCUMENTATION_ISSUE"),
      v.literal("CLINICAL_REASONING_ERROR"),
      v.literal("MISSING_CONTEXT"),
      v.literal("RULE_MISAPPLICATION"),
      v.literal("INSURANCE_RULE_UPDATE"),
      v.literal("OTHER")
    ),
    suggestedDecision: v.optional(v.string()),
    notes: v.string(),
    suggestedRuleUpdate: v.optional(v.string()),
    isTrainingExample: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_patientId", ["patientId"])
    .index("by_category", ["category"])
    .index("by_isTrainingExample", ["isTrainingExample"]),

  trainingExamples: defineTable({
    feedbackId: v.optional(v.id("decisionFeedback")),
    clinicalPatternSummary: v.string(),
    correctDecision: v.string(),
    rationale: v.string(),
    rulesCited: v.array(v.string()),
    isActive: v.boolean(),
    usageCount: v.number(),
    createdAt: v.number(),
    createdBy: v.string(),
  })
    .index("by_isActive", ["isActive"]),

  rulePerformance: defineTable({
    ruleName: v.string(),
    timesApplied: v.number(),
    timesAgreed: v.number(),
    timesDisagreed: v.number(),
    lastUpdated: v.number(),
  })
    .index("by_ruleName", ["ruleName"]),
});
