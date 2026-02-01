import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  patients: defineTable({
    mrn: v.string(),
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
        v.literal("APPROVED_NEEDS_LETTER"),
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
    createdAt: v.number(),
    createdBy: v.string(),
    archived: v.boolean(),
  })
    .index("by_status", ["status"])
    .index("by_dateOfService", ["dateOfService"])
    .index("by_createdAt", ["createdAt"])
    .index("by_createdBy", ["createdBy"]),

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
});
