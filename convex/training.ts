import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    feedbackId: v.optional(v.id("decisionFeedback")),
    clinicalPatternSummary: v.string(),
    correctDecision: v.string(),
    rationale: v.string(),
    rulesCited: v.array(v.string()),
    createdBy: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("trainingExamples", {
      ...args,
      isActive: true,
      usageCount: 0,
      createdAt: Date.now(),
    });
  },
});

export const listActive = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("trainingExamples")
      .withIndex("by_isActive", (q) => q.eq("isActive", true))
      .collect();
  },
});

export const listAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("trainingExamples").order("desc").collect();
  },
});

export const toggleActive = mutation({
  args: {
    exampleId: v.id("trainingExamples"),
  },
  handler: async (ctx, args) => {
    const example = await ctx.db.get(args.exampleId);
    if (!example) throw new Error("Training example not found");
    await ctx.db.patch(args.exampleId, { isActive: !example.isActive });
  },
});

export const incrementUsage = mutation({
  args: {
    exampleIds: v.array(v.id("trainingExamples")),
  },
  handler: async (ctx, args) => {
    for (const id of args.exampleIds) {
      const example = await ctx.db.get(id);
      if (example) {
        await ctx.db.patch(id, { usageCount: example.usageCount + 1 });
      }
    }
  },
});
