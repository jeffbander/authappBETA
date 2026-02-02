import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const listForReview = query({
  args: {
    providerFilter: v.optional(v.string()),
    statusFilter: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Fetch non-archived patients that are COMPLETE or NEEDS_REVIEW
    const patients = await ctx.db
      .query("patients")
      .order("desc")
      .collect();

    const eligible = patients.filter(
      (p) =>
        !p.archived &&
        (p.status === "COMPLETE" || p.status === "NEEDS_REVIEW") &&
        (!args.providerFilter || p.selectedProvider === args.providerFilter)
    );

    // Fetch all reviews for these patients
    const reviews = await ctx.db.query("reviews").collect();
    const reviewByPatientId = new Map(
      reviews.map((r) => [r.patientId.toString(), r])
    );

    // Apply status filter
    const withReviews = eligible
      .map((p) => {
        const review = reviewByPatientId.get(p._id.toString());
        return {
          ...p,
          review: review ?? null,
        };
      })
      .filter((p) => {
        if (!args.statusFilter || args.statusFilter === "ALL") return true;
        if (args.statusFilter === "PENDING") return !p.review;
        return p.review?.reviewStatus === args.statusFilter;
      });

    // Group by selectedProvider
    const grouped: Record<string, typeof withReviews> = {};
    for (const p of withReviews) {
      const provider = p.selectedProvider || "Unassigned";
      if (!grouped[provider]) grouped[provider] = [];
      grouped[provider].push(p);
    }

    return grouped;
  },
});

export const getByPatientId = query({
  args: { patientId: v.id("patients") },
  handler: async (ctx, args) => {
    const reviews = await ctx.db
      .query("reviews")
      .withIndex("by_patientId", (q) => q.eq("patientId", args.patientId))
      .collect();
    return reviews[0] ?? null;
  },
});

export const approve = mutation({
  args: {
    patientId: v.id("patients"),
    reviewerId: v.id("providers"),
    reviewerClerkUserId: v.string(),
    reviewerName: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check for existing review
    const existing = await ctx.db
      .query("reviews")
      .withIndex("by_patientId", (q) => q.eq("patientId", args.patientId))
      .first();

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        reviewStatus: "APPROVED",
        reviewerId: args.reviewerId,
        reviewerClerkUserId: args.reviewerClerkUserId,
        reviewerName: args.reviewerName,
        notes: args.notes,
        reviewedAt: now,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("reviews", {
        patientId: args.patientId,
        reviewStatus: "APPROVED",
        reviewerId: args.reviewerId,
        reviewerClerkUserId: args.reviewerClerkUserId,
        reviewerName: args.reviewerName,
        notes: args.notes,
        reviewedAt: now,
        createdAt: now,
      });
    }
  },
});

export const hold = mutation({
  args: {
    patientId: v.id("patients"),
    reviewerId: v.id("providers"),
    reviewerClerkUserId: v.string(),
    reviewerName: v.optional(v.string()),
    notes: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("reviews")
      .withIndex("by_patientId", (q) => q.eq("patientId", args.patientId))
      .first();

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        reviewStatus: "HELD",
        reviewerId: args.reviewerId,
        reviewerClerkUserId: args.reviewerClerkUserId,
        reviewerName: args.reviewerName,
        notes: args.notes,
        reviewedAt: now,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("reviews", {
        patientId: args.patientId,
        reviewStatus: "HELD",
        reviewerId: args.reviewerId,
        reviewerClerkUserId: args.reviewerClerkUserId,
        reviewerName: args.reviewerName,
        notes: args.notes,
        reviewedAt: now,
        createdAt: now,
      });
    }
  },
});
