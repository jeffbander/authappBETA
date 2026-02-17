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
        v.literal("BORDERLINE_NEEDS_LETTER"),
        v.literal("APPROVED_NEEDS_LETTER"), // Deprecated: kept for backwards compatibility
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
      // Clear attestation letter justification fields
      needsLetterReason: undefined,
      letterJustifications: undefined,
      letterJustificationOther: undefined,
      letterJustificationsConfirmedAt: undefined,
      letterJustificationsConfirmedBy: undefined,
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
    missingFieldToRemove: v.optional(v.string()),
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

    // Remove the missing field if specified
    let updatedMissingFields = patient.missingFields;
    if (args.missingFieldToRemove && patient.missingFields) {
      updatedMissingFields = patient.missingFields.filter(
        f => f !== args.missingFieldToRemove
      );
    }

    await ctx.db.patch(args.patientId, {
      addendums: [...(patient.addendums || []), newAddendum],
      missingFields: updatedMissingFields,
    });
  },
});

export const saveLetterJustifications = mutation({
  args: {
    patientId: v.id("patients"),
    justifications: v.array(v.string()),
    otherText: v.optional(v.string()),
    confirmedBy: v.string(),
  },
  handler: async (ctx, args) => {
    const patient = await ctx.db.get(args.patientId);
    if (!patient) throw new Error("Patient not found");

    if (patient.decision !== "BORDERLINE_NEEDS_LETTER" && patient.decision !== "APPROVED_NEEDS_LETTER") {
      throw new Error("Justifications can only be saved for borderline/needs letter cases");
    }

    if (args.justifications.length === 0 && !args.otherText) {
      throw new Error("At least one justification must be selected");
    }

    await ctx.db.patch(args.patientId, {
      letterJustifications: args.justifications,
      letterJustificationOther: args.otherText || undefined,
      letterJustificationsConfirmedAt: Date.now(),
      letterJustificationsConfirmedBy: args.confirmedBy,
    });
  },
});
