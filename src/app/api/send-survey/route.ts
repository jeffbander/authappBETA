import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import twilio from "twilio";
import {
  SURVEY_INTRO_MESSAGE,
  SURVEY_QUESTIONS,
  buildSurveyQuestions,
} from "@/lib/surveyQuestions";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

export async function POST(req: NextRequest) {
  // Require authentication
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { patientId: string; phoneNumber: string; userName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { patientId, phoneNumber, userName } = body;

  if (!patientId || !phoneNumber) {
    return NextResponse.json(
      { error: "Missing patientId or phoneNumber" },
      { status: 400 }
    );
  }

  // Basic phone number validation
  const cleanPhone = phoneNumber.replace(/[^\d+]/g, "");
  if (!/^\+?1?\d{10,15}$/.test(cleanPhone)) {
    return NextResponse.json(
      { error: "Invalid phone number format" },
      { status: 400 }
    );
  }

  // Ensure E.164 format
  const formattedPhone = cleanPhone.startsWith("+")
    ? cleanPhone
    : `+1${cleanPhone.replace(/^1/, "")}`;

  try {
    // Create survey in Convex
    const surveyId = await convex.mutation(api.smsSurveys.createSurvey, {
      patientId: patientId as any,
      phoneNumber: formattedPhone,
      questions: buildSurveyQuestions(),
      initiatedBy: userId,
      initiatedByName: userName || "Staff",
    });

    // Send intro message via Twilio
    await twilioClient.messages.create({
      body: SURVEY_INTRO_MESSAGE,
      from: process.env.TWILIO_PHONE_NUMBER!,
      to: formattedPhone,
    });

    // Send first question
    const firstQuestion = SURVEY_QUESTIONS[0];
    await twilioClient.messages.create({
      body: `Q1/10: ${firstQuestion.questionText} (YES/NO)`,
      from: process.env.TWILIO_PHONE_NUMBER!,
      to: formattedPhone,
    });

    // Mark survey as IN_PROGRESS
    await convex.mutation(api.smsSurveys.startSurvey, { surveyId });

    return NextResponse.json({ success: true, surveyId });
  } catch (error: any) {
    console.error("Send survey error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to send survey" },
      { status: 500 }
    );
  }
}
