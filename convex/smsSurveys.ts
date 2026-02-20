import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const createSurvey = mutation({
  args: {
    patientId: v.id("patients"),
    phoneNumber: v.string(),
    questions: v.array(
      v.object({
        questionId: v.string(),
        questionText: v.string(),
        medicalTerm: v.string(),
      })
    ),
    initiatedBy: v.string(),
    initiatedByName: v.string(),
  },
  handler: async (ctx, args) => {
    // Check for existing active survey
    const existing = await ctx.db
      .query("smsSurveys")
      .withIndex("by_patientId", (q) => q.eq("patientId", args.patientId))
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "PENDING"),
          q.eq(q.field("status"), "IN_PROGRESS")
        )
      )
      .first();

    if (existing) {
      throw new Error("An active survey already exists for this patient.");
    }

    const now = Date.now();
    const surveyId = await ctx.db.insert("smsSurveys", {
      patientId: args.patientId,
      phoneNumber: args.phoneNumber,
      status: "PENDING",
      currentQuestionIndex: 0,
      questions: args.questions,
      followUpPending: false,
      invalidReplyCount: 0,
      initiatedBy: args.initiatedBy,
      initiatedByName: args.initiatedByName,
      createdAt: now,
      lastMessageAt: now,
    });

    // Link survey to patient
    await ctx.db.patch(args.patientId, { smsSurveyId: surveyId });

    return surveyId;
  },
});

export const startSurvey = mutation({
  args: {
    surveyId: v.id("smsSurveys"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.surveyId, {
      status: "IN_PROGRESS",
      lastMessageAt: Date.now(),
    });
  },
});

export const recordAnswer = mutation({
  args: {
    surveyId: v.id("smsSurveys"),
    questionIndex: v.number(),
    response: v.string(),
    answeredYes: v.boolean(),
    isFollowUp: v.boolean(),
  },
  handler: async (ctx, args) => {
    const survey = await ctx.db.get(args.surveyId);
    if (!survey) throw new Error("Survey not found");

    const questions = [...survey.questions];
    const q = { ...questions[args.questionIndex] };

    if (args.isFollowUp) {
      q.followUpResponse = args.response;
      q.followUpAnsweredYes = args.answeredYes;
      q.followUpAnsweredAt = Date.now();
    } else {
      q.response = args.response;
      q.answeredYes = args.answeredYes;
      q.answeredAt = Date.now();
    }

    questions[args.questionIndex] = q;

    await ctx.db.patch(args.surveyId, {
      questions,
      lastMessageAt: Date.now(),
      invalidReplyCount: 0, // Reset on valid reply
    });
  },
});

export const advanceQuestion = mutation({
  args: {
    surveyId: v.id("smsSurveys"),
    nextIndex: v.number(),
    followUpPending: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.surveyId, {
      currentQuestionIndex: args.nextIndex,
      followUpPending: args.followUpPending,
      lastMessageAt: Date.now(),
    });
  },
});

export const completeSurvey = mutation({
  args: {
    surveyId: v.id("smsSurveys"),
  },
  handler: async (ctx, args) => {
    const survey = await ctx.db.get(args.surveyId);
    if (!survey) throw new Error("Survey not found");

    await ctx.db.patch(args.surveyId, {
      status: "COMPLETED",
      completedAt: Date.now(),
      lastMessageAt: Date.now(),
    });
  },
});

export const optOutSurvey = mutation({
  args: {
    surveyId: v.id("smsSurveys"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.surveyId, {
      status: "OPTED_OUT",
      lastMessageAt: Date.now(),
    });
  },
});

export const incrementInvalidReply = mutation({
  args: {
    surveyId: v.id("smsSurveys"),
  },
  handler: async (ctx, args) => {
    const survey = await ctx.db.get(args.surveyId);
    if (!survey) throw new Error("Survey not found");

    const newCount = survey.invalidReplyCount + 1;
    await ctx.db.patch(args.surveyId, {
      invalidReplyCount: newCount,
      lastMessageAt: Date.now(),
    });
    return newCount;
  },
});

export const getByPatientId = query({
  args: {
    patientId: v.id("patients"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("smsSurveys")
      .withIndex("by_patientId", (q) => q.eq("patientId", args.patientId))
      .order("desc")
      .first();
  },
});

export const getActiveSurveyByPhone = query({
  args: {
    phoneNumber: v.string(),
  },
  handler: async (ctx, args) => {
    // Check IN_PROGRESS first
    const inProgress = await ctx.db
      .query("smsSurveys")
      .withIndex("by_phoneNumber_status", (q) =>
        q.eq("phoneNumber", args.phoneNumber).eq("status", "IN_PROGRESS")
      )
      .first();

    if (inProgress) return inProgress;

    // Also check PENDING (survey just sent, first reply)
    return await ctx.db
      .query("smsSurveys")
      .withIndex("by_phoneNumber_status", (q) =>
        q.eq("phoneNumber", args.phoneNumber).eq("status", "PENDING")
      )
      .first();
  },
});

export const getSurveyForPrompt = query({
  args: {
    surveyId: v.id("smsSurveys"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.surveyId);
  },
});

export const getCompletedSurveyByPhone = query({
  args: {
    phoneNumber: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("smsSurveys")
      .withIndex("by_phoneNumber_status", (q) =>
        q.eq("phoneNumber", args.phoneNumber).eq("status", "COMPLETED")
      )
      .first();
  },
});
