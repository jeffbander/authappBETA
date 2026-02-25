import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

// 1 week in milliseconds
export const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Internal mutation scheduled to run 1 week after patient creation.
 * Deletes the patient record, associated storage files (PDFs),
 * and related records (reviews, feedback, SMS surveys).
 */
export const deleteExpiredPatient = internalMutation({
  args: { patientId: v.id("patients") },
  handler: async (ctx, args) => {
    const patient = await ctx.db.get(args.patientId);
    if (!patient) return; // Already deleted

    // Delete uploaded referral PDF from storage
    if (patient.referralPdfStorageId) {
      await ctx.storage.delete(patient.referralPdfStorageId);
    }

    // Delete associated SMS surveys
    const surveys = await ctx.db
      .query("smsSurveys")
      .withIndex("by_patientId", (q) => q.eq("patientId", args.patientId))
      .collect();
    for (const survey of surveys) {
      await ctx.db.delete(survey._id);
    }

    // Delete associated reviews
    const reviews = await ctx.db
      .query("reviews")
      .withIndex("by_patientId", (q) => q.eq("patientId", args.patientId))
      .collect();
    for (const review of reviews) {
      await ctx.db.delete(review._id);
    }

    // Delete associated decision feedback
    const feedback = await ctx.db
      .query("decisionFeedback")
      .withIndex("by_patientId", (q) => q.eq("patientId", args.patientId))
      .collect();
    for (const fb of feedback) {
      await ctx.db.delete(fb._id);
    }

    // Delete the patient record itself
    await ctx.db.delete(args.patientId);
  },
});
