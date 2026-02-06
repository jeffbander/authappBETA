import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    mrn: v.string(),
    dateOfService: v.string(),
    patientType: v.union(v.literal("NEW"), v.literal("FOLLOWUP")),
    clinicalNotes: v.string(),
    insuranceInfo: v.string(),
    previousStudies: v.string(),
    createdBy: v.string(),
    selectedProvider: v.optional(v.string()),
    referralPdfStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const patientId = await ctx.db.insert("patients", {
      ...args,
      status: "PROCESSING",
      createdAt: Date.now(),
      archived: false,
    });
    return patientId;
  },
});

// Generate upload URL for PDF referral documents
export const generatePdfUploadUrl = mutation({
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

// Get URL for a stored PDF
export const getPdfUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});

export const updateWithResults = mutation({
  args: {
    patientId: v.id("patients"),
    status: v.union(
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
    supportingCriteria: v.optional(v.array(v.object({
      ruleName: v.string(),
      criterion: v.string(),
      clinicalEvidence: v.string(),
    }))),
    missingFields: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const { patientId, ...updates } = args;
    await ctx.db.patch(patientId, updates);
  },
});

export const list = query({
  args: {
    statusFilter: v.optional(v.string()),
    dateOfServiceFilter: v.optional(v.string()),
    providerFilter: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let patients;
    if (args.statusFilter) {
      patients = await ctx.db
        .query("patients")
        .filter((q) => q.eq(q.field("status"), args.statusFilter))
        .order("desc")
        .collect();
    } else {
      patients = await ctx.db
        .query("patients")
        .order("desc")
        .collect();
    }

    if (args.dateOfServiceFilter) {
      patients = patients.filter(
        (p) => p.dateOfService === args.dateOfServiceFilter
      );
    }

    if (args.providerFilter) {
      patients = patients.filter(
        (p) => p.selectedProvider === args.providerFilter
      );
    }

    return patients.filter((p) => !p.archived);
  },
});

export const get = query({
  args: { patientId: v.id("patients") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.patientId);
  },
});

export const archive = mutation({
  args: { patientId: v.id("patients") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.patientId, { archived: true });
  },
});

export const resetForReprocessing = mutation({
  args: {
    patientId: v.id("patients"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.patientId, {
      status: "PROCESSING",
      decision: undefined,
      recommendedStudy: undefined,
      rationale: undefined,
      denialReason: undefined,
      supportingCriteria: undefined,
      missingFields: undefined,
      // Clear qualification fields
      qualifiedViaSymptom: undefined,
      qualifyingSymptom: undefined,
      qualifyingRationale: undefined,
      originalDecision: undefined,
      secondRecommendedStudy: undefined,
      secondQualifyingSymptom: undefined,
      secondQualifyingRationale: undefined,
    });
  },
});

export const updatePdfUrl = mutation({
  args: {
    patientId: v.id("patients"),
    attestationPdfUrl: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.patientId, {
      attestationPdfUrl: args.attestationPdfUrl,
    });
  },
});

export const applyQualifyingSuggestion = mutation({
  args: {
    patientId: v.id("patients"),
    symptom: v.string(),
    studyType: v.union(
      v.literal("NUCLEAR"),
      v.literal("STRESS_ECHO"),
      v.literal("ECHO"),
      v.literal("VASCULAR")
    ),
    qualifyingRationale: v.string(),
    // Optional second study
    secondStudyType: v.optional(v.union(
      v.literal("NUCLEAR"),
      v.literal("STRESS_ECHO"),
      v.literal("ECHO"),
      v.literal("VASCULAR")
    )),
    secondSymptom: v.optional(v.string()),
    secondQualifyingRationale: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const patient = await ctx.db.get(args.patientId);
    if (!patient) throw new Error("Patient not found");

    await ctx.db.patch(args.patientId, {
      originalDecision: patient.decision || "DENIED",
      decision: "APPROVED_CLEAN",
      recommendedStudy: args.studyType,
      qualifiedViaSymptom: true,
      qualifyingSymptom: args.symptom,
      qualifyingRationale: args.qualifyingRationale,
      ...(args.secondStudyType ? {
        secondRecommendedStudy: args.secondStudyType,
        secondQualifyingSymptom: args.secondSymptom,
        secondQualifyingRationale: args.secondQualifyingRationale,
      } : {}),
    });
  },
});

export const addAddendum = mutation({
  args: {
    patientId: v.id("patients"),
    text: v.string(),
    addedBy: v.string(),
    addedByName: v.string(),
  },
  handler: async (ctx, args) => {
    const patient = await ctx.db.get(args.patientId);
    if (!patient) throw new Error("Patient not found");

    const newAddendum = {
      text: args.text,
      addedBy: args.addedBy,
      addedByName: args.addedByName,
      addedAt: Date.now(),
    };

    await ctx.db.patch(args.patientId, {
      addendums: [...(patient.addendums || []), newAddendum],
    });
  },
});
