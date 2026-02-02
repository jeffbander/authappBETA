import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const submitFeedback = mutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("decisionFeedback", {
      ...args,
      isTrainingExample: false,
      createdAt: Date.now(),
    });
  },
});

export const updateRulePerformance = mutation({
  args: {
    ruleNames: v.array(v.string()),
    agreed: v.boolean(),
  },
  handler: async (ctx, args) => {
    for (const ruleName of args.ruleNames) {
      const existing = await ctx.db
        .query("rulePerformance")
        .withIndex("by_ruleName", (q) => q.eq("ruleName", ruleName))
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, {
          timesApplied: existing.timesApplied + 1,
          timesAgreed: existing.timesAgreed + (args.agreed ? 1 : 0),
          timesDisagreed: existing.timesDisagreed + (args.agreed ? 0 : 1),
          lastUpdated: Date.now(),
        });
      } else {
        await ctx.db.insert("rulePerformance", {
          ruleName,
          timesApplied: 1,
          timesAgreed: args.agreed ? 1 : 0,
          timesDisagreed: args.agreed ? 0 : 1,
          lastUpdated: Date.now(),
        });
      }
    }
  },
});

export const listFeedback = query({
  args: {
    categoryFilter: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const feedback = await ctx.db.query("decisionFeedback").order("desc").collect();
    if (args.categoryFilter) {
      return feedback.filter((f) => f.category === args.categoryFilter);
    }
    return feedback;
  },
});

export const listRulePerformance = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("rulePerformance").collect();
  },
});

export const markAsTrainingExample = mutation({
  args: {
    feedbackId: v.id("decisionFeedback"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.feedbackId, {
      isTrainingExample: true,
    });
  },
});
