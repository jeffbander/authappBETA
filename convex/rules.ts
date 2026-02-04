import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const DEFAULT_RULES = [
  {
    ruleName: "Nuclear Stress Test",
    ruleContent: `Nuclear Stress Test (Myocardial Perfusion Imaging) Authorization Criteria:

APPROVED if ANY of the following:
- Chest pain or anginal equivalent with intermediate pre-test probability
- Known CAD with new or worsening symptoms
- Abnormal prior stress test or ECG
- Pre-operative cardiac risk assessment for intermediate-risk surgery
- New onset heart failure to evaluate ischemic etiology
- Diabetes with symptoms suggestive of CAD
- Peripheral arterial disease with cardiac symptoms
- Post-revascularization (PCI >2 years, CABG >5 years) with symptoms
- Known CAD or diabetes with cardiac risk factors AND no prior nuclear/ischemia evaluation (first-time ischemia assessment)

TIMING CONSIDERATIONS:
- No prior nuclear study + CAD/diabetes/ischemic risk factors = Nuclear STRONGLY indicated for baseline ischemia evaluation
- Prior nuclear >2 years ago + new/worsening symptoms = Repeat nuclear appropriate
- Prior nuclear <2 years ago + stable symptoms = Requires letter or may be premature
- When patient qualifies for both nuclear (ischemia evaluation) and echo (e.g., HF assessment), nuclear takes priority per study hierarchy

REQUIRES LETTER if:
- Asymptomatic screening in high-risk population (diabetes, strong family history)
- Repeat study within 2 years without new symptoms
- Pre-operative assessment for low-risk surgery

DENIED if:
- Routine screening in asymptomatic low-risk patients
- Study performed within 90 days without clinical change
- Patient unable to achieve adequate heart rate and pharmacologic stress contraindicated`,
  },
  {
    ruleName: "Stress Echocardiogram",
    ruleContent: `Stress Echocardiogram Authorization Criteria:

APPROVED if ANY of the following:
- Chest pain with intermediate pre-test probability (preferred over nuclear when available)
- Known CAD with new symptoms and need for valve assessment
- Valvular heart disease with exertional symptoms
- New onset dyspnea on exertion to evaluate cardiac cause
- Hypertrophic cardiomyopathy with exertional symptoms
- Pre-operative assessment for valve surgery candidates

REQUIRES LETTER if:
- Follow-up of known valve disease without new symptoms (if >1 year since last)
- Athlete screening with family history of HCM
- Repeat within 1 year without clinical change

DENIED if:
- Routine follow-up without symptoms or clinical change
- Study within 6 months without new findings
- Can be adequately assessed with standard echocardiogram`,
  },
  {
    ruleName: "Echocardiogram",
    ruleContent: `Echocardiogram (Transthoracic) Authorization Criteria:

APPROVED if ANY of the following:
- New cardiac murmur
- Heart failure symptoms (dyspnea, edema, orthopnea)
- Suspected pericardial disease
- Evaluation of known valve disease (annual or with symptom change)
- Assessment of LV function post-MI or with new cardiomyopathy
- New onset atrial fibrillation
- Hypertension with suspected LVH or end-organ damage
- Syncope with suspected cardiac etiology
- Chemotherapy cardiotoxicity monitoring (per protocol)
- Pre-operative for cardiac surgery

REQUIRES LETTER if:
- Follow-up of stable valve disease more frequently than annually
- Repeat for stable heart failure without clinical change
- Routine follow-up of well-controlled hypertension

DENIED if:
- Routine screening without symptoms or risk factors
- Repeat within 6 months without clinical change
- Chest pain already evaluated with stress testing`,
  },
  {
    ruleName: "Vascular Studies",
    ruleContent: `Vascular Studies (Carotid Duplex, Lower Extremity Arterial/Venous) Authorization Criteria:

APPROVED if ANY of the following:
- Carotid: TIA or stroke symptoms, carotid bruit, pre-operative for CEA/CAS
- Carotid: Follow-up of known stenosis >50% (annual)
- Lower extremity arterial: Claudication, non-healing wounds, ABI abnormal
- Lower extremity venous: Suspected DVT, chronic venous insufficiency with ulceration
- Aortic: Known aneurysm surveillance (per size-based protocol)
- Renal: Suspected renovascular hypertension, renal artery stenosis follow-up

REQUIRES LETTER if:
- Carotid screening in asymptomatic patients with multiple risk factors
- Follow-up of minor stenosis (<50%) more than annually
- Venous insufficiency evaluation without ulceration or severe symptoms

DENIED if:
- Routine screening without symptoms or significant risk factors
- Repeat within 6 months without clinical change
- Study not relevant to presenting complaint`,
  },
  {
    ruleName: "General Authorization Guidelines",
    ruleContent: `General Authorization Guidelines:

INSURANCE RULES:
- Medicare (traditional): Auto-approve all medically indicated studies
- Medicare Advantage: Treat as commercial insurance - apply full authorization rules
- Commercial insurance: Apply full authorization rules below

STUDY HIERARCHY (when multiple studies could apply):
- Nuclear Stress Test > Stress Echo > Echo > Vascular
- Recommend the highest-level appropriate study
- If a higher-level study is approved, lower-level studies are included

DOCUMENTATION REQUIREMENTS:
- All requests must include: patient demographics, clinical indication, relevant symptoms
- For repeat studies: document what changed since last study
- For pre-operative: specify surgery type and date

MISSING INFORMATION:
- If clinical information is insufficient to make a determination, mark as NEEDS_REVIEW
- Specify which fields are missing in the missingFields array
- Do not deny based solely on missing information`,
  },
];

export const list = query({
  handler: async (ctx) => {
    return await ctx.db.query("authorizationRules").collect();
  },
});

export const update = mutation({
  args: {
    ruleId: v.id("authorizationRules"),
    ruleContent: v.string(),
    updatedBy: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.ruleId, {
      ruleContent: args.ruleContent,
      updatedAt: Date.now(),
      updatedBy: args.updatedBy,
    });
  },
});

export const seed = mutation({
  handler: async (ctx) => {
    const existing = await ctx.db.query("authorizationRules").first();
    if (existing) return "already_seeded";

    for (const rule of DEFAULT_RULES) {
      await ctx.db.insert("authorizationRules", {
        ruleName: rule.ruleName,
        ruleContent: rule.ruleContent,
        updatedAt: Date.now(),
        updatedBy: "system",
      });
    }
    return "seeded";
  },
});
