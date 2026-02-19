import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  handler: async (ctx) => {
    const providers = await ctx.db.query("providers").collect();
    return Promise.all(
      providers.map(async (p) => ({
        ...p,
        signatureUrl: p.signatureStorageId
          ? await ctx.storage.getUrl(p.signatureStorageId)
          : null,
      }))
    );
  },
});

export const get = query({
  args: { providerId: v.id("providers") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.providerId);
  },
});

export const getByClerkUserId = query({
  args: { clerkUserId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("providers")
      .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", args.clerkUserId))
      .first();
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    credentials: v.string(),
    npi: v.string(),
    clerkUserId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("providers", {
      ...args,
    });
  },
});

export const update = mutation({
  args: {
    providerId: v.id("providers"),
    name: v.optional(v.string()),
    credentials: v.optional(v.string()),
    npi: v.optional(v.string()),
    clerkUserId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { providerId, ...updates } = args;
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined)
    );
    await ctx.db.patch(providerId, filteredUpdates);
  },
});

export const remove = mutation({
  args: { providerId: v.id("providers") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.providerId);
  },
});

export const saveSignature = mutation({
  args: {
    providerId: v.id("providers"),
    signatureStorageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.providerId, {
      signatureStorageId: args.signatureStorageId,
    });
  },
});

export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const getSignatureUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});

export const listWithSignatureUrls = query({
  handler: async (ctx) => {
    const providers = await ctx.db.query("providers").collect();
    const results = await Promise.all(
      providers.map(async (p) => ({
        name: p.name,
        credentials: p.credentials,
        signatureUrl: p.signatureStorageId
          ? await ctx.storage.getUrl(p.signatureStorageId)
          : null,
      }))
    );
    return results;
  },
});

// Seed Mount Sinai West Cardiology providers
export const seedProviders = mutation({
  handler: async (ctx) => {
    const providersToSeed = [
      { name: "Jeffrey Bander", credentials: "MD", npi: "TBD" },
      { name: "Nina Kukar", credentials: "MD", npi: "TBD" },
      { name: "Rony Shimony", credentials: "MD", npi: "TBD" },
      { name: "Nenad Trubelja", credentials: "MD", npi: "TBD" },
      { name: "Judith Z. Goldfinger", credentials: "MD", npi: "TBD" },
      { name: "Bette Kim", credentials: "MD", npi: "TBD" },
      { name: "Kiruthika Balasundaram", credentials: "MD", npi: "TBD" },
      { name: "Krysthel Engstrom", credentials: "MD", npi: "TBD" },
      { name: "Robert Kornberg", credentials: "MD", npi: "TBD" },
      { name: "Sooraj Shah", credentials: "MD", npi: "TBD" },
      { name: "Jared Leventhal", credentials: "MD", npi: "TBD" },
      { name: "Paul Leis", credentials: "DO", npi: "TBD" },
      { name: "Joshua Shatzkes", credentials: "MD", npi: "TBD" },
      { name: "Swaminatha Gurudevan", credentials: "MD", npi: "TBD" },
      { name: "Victoria Kazickas", credentials: "PA", npi: "TBD" },
      { name: "Carlo Mannina", credentials: "MD", npi: "TBD" },
      { name: "Susan Colpoys", credentials: "NP", npi: "TBD" },
      { name: "Vahid Namdarizandi", credentials: "MD", npi: "TBD" },
      { name: "Himanshu Sharma", credentials: "MD", npi: "TBD" },
      { name: "Robert Leber", credentials: "MD", npi: "TBD" },
      { name: "Sanjay Sivalokanathan", credentials: "MBBS", npi: "TBD" },
      { name: "Won Joon Koh", credentials: "MD", npi: "TBD" },
      { name: "Kristen Carter", credentials: "PA-C", npi: "TBD" },
      { name: "Omar Al Dhaybi", credentials: "MD", npi: "TBD" },
      { name: "Asaf Rabinovitz", credentials: "MD", npi: "TBD" },
      { name: "Matthew Tomey", credentials: "MD", npi: "TBD" },
      { name: "Anton Camaj", credentials: "MD", npi: "TBD" },
    ];

    const existingProviders = await ctx.db.query("providers").collect();
    const existingNames = new Set(existingProviders.map((p) => p.name));

    let added = 0;
    for (const provider of providersToSeed) {
      if (!existingNames.has(provider.name)) {
        await ctx.db.insert("providers", provider);
        added++;
      }
    }

    return { added, total: providersToSeed.length };
  },
});
