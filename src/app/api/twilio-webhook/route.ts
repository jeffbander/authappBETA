import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import {
  parseYesNo,
  SURVEY_QUESTIONS,
  FOLLOW_UP_QUESTION,
  SURVEY_THANK_YOU_MESSAGE,
  SURVEY_OPT_OUT_MESSAGE,
  SURVEY_ALREADY_COMPLETE_MESSAGE,
  INVALID_REPLY_MESSAGE,
} from "@/lib/surveyQuestions";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

const MAX_INVALID_REPLIES = 2;

function twimlResponse(message: string): NextResponse {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(message)}</Message></Response>`;
  return new NextResponse(twiml, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function POST(req: NextRequest) {
  // Validate Twilio request signature
  const authToken = process.env.TWILIO_AUTH_TOKEN!;
  const twilioSignature = req.headers.get("x-twilio-signature") || "";

  // Parse form data from Twilio
  const formData = await req.formData();
  const params: Record<string, string> = {};
  formData.forEach((value, key) => {
    params[key] = value.toString();
  });

  // Build the full URL for signature validation
  const url = `${process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin}/api/twilio-webhook`;

  const isValid = twilio.validateRequest(
    authToken,
    twilioSignature,
    url,
    params
  );

  if (!isValid) {
    console.error("Invalid Twilio signature");
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const from = params.From; // Patient's phone number
  const body = params.Body || "";

  if (!from) {
    return twimlResponse("Error processing your message.");
  }

  // Look up active survey by phone number
  const survey = await convex.query(api.smsSurveys.getActiveSurveyByPhone, {
    phoneNumber: from,
  });

  if (!survey) {
    // Check if there's a completed survey
    const completed = await convex.query(
      api.smsSurveys.getCompletedSurveyByPhone,
      { phoneNumber: from }
    );
    if (completed) {
      return twimlResponse(SURVEY_ALREADY_COMPLETE_MESSAGE);
    }
    // No survey found — don't respond to unknown messages
    return new NextResponse("", { status: 200 });
  }

  // Parse the response
  const parsed = parseYesNo(body);

  // Handle STOP/opt-out
  if (parsed.type === "stop") {
    await convex.mutation(api.smsSurveys.optOutSurvey, {
      surveyId: survey._id,
    });
    return twimlResponse(SURVEY_OPT_OUT_MESSAGE);
  }

  // Handle invalid replies
  if (parsed.type === "invalid") {
    const newCount = await convex.mutation(
      api.smsSurveys.incrementInvalidReply,
      { surveyId: survey._id }
    );

    if (newCount >= MAX_INVALID_REPLIES) {
      // Skip this question after too many invalid replies
      const nextIndex = survey.currentQuestionIndex + 1;
      if (nextIndex >= SURVEY_QUESTIONS.length) {
        await convex.mutation(api.smsSurveys.completeSurvey, {
          surveyId: survey._id,
        });
        return twimlResponse(SURVEY_THANK_YOU_MESSAGE);
      }
      await convex.mutation(api.smsSurveys.advanceQuestion, {
        surveyId: survey._id,
        nextIndex,
        followUpPending: false,
      });
      const nextQ = SURVEY_QUESTIONS[nextIndex];
      return twimlResponse(
        `Q${nextIndex + 1}/${SURVEY_QUESTIONS.length}: ${nextQ.questionText} (YES/NO)`
      );
    }

    return twimlResponse(INVALID_REPLY_MESSAGE);
  }

  const isYes = parsed.type === "yes";
  const currentIndex = survey.currentQuestionIndex;
  const currentQuestion = SURVEY_QUESTIONS[currentIndex];

  // Are we waiting for a follow-up answer?
  if (survey.followUpPending) {
    // Record follow-up answer
    await convex.mutation(api.smsSurveys.recordAnswer, {
      surveyId: survey._id,
      questionIndex: currentIndex,
      response: body.trim(),
      answeredYes: isYes,
      isFollowUp: true,
    });

    // Move to next question
    const nextIndex = currentIndex + 1;
    if (nextIndex >= SURVEY_QUESTIONS.length) {
      await convex.mutation(api.smsSurveys.completeSurvey, {
        surveyId: survey._id,
      });
      await convex.mutation(api.smsSurveys.advanceQuestion, {
        surveyId: survey._id,
        nextIndex,
        followUpPending: false,
      });
      return twimlResponse(SURVEY_THANK_YOU_MESSAGE);
    }

    await convex.mutation(api.smsSurveys.advanceQuestion, {
      surveyId: survey._id,
      nextIndex,
      followUpPending: false,
    });

    const nextQ = SURVEY_QUESTIONS[nextIndex];
    return twimlResponse(
      `Q${nextIndex + 1}/${SURVEY_QUESTIONS.length}: ${nextQ.questionText} (YES/NO)`
    );
  }

  // Record primary answer
  await convex.mutation(api.smsSurveys.recordAnswer, {
    surveyId: survey._id,
    questionIndex: currentIndex,
    response: body.trim(),
    answeredYes: isYes,
    isFollowUp: false,
  });

  // If YES and question has follow-up, ask follow-up
  if (isYes && currentQuestion.hasFollowUp) {
    await convex.mutation(api.smsSurveys.advanceQuestion, {
      surveyId: survey._id,
      nextIndex: currentIndex, // Stay on same question for follow-up
      followUpPending: true,
    });
    return twimlResponse(FOLLOW_UP_QUESTION);
  }

  // Move to next question
  const nextIndex = currentIndex + 1;
  if (nextIndex >= SURVEY_QUESTIONS.length) {
    await convex.mutation(api.smsSurveys.completeSurvey, {
      surveyId: survey._id,
    });
    await convex.mutation(api.smsSurveys.advanceQuestion, {
      surveyId: survey._id,
      nextIndex,
      followUpPending: false,
    });
    return twimlResponse(SURVEY_THANK_YOU_MESSAGE);
  }

  await convex.mutation(api.smsSurveys.advanceQuestion, {
    surveyId: survey._id,
    nextIndex,
    followUpPending: false,
  });

  const nextQ = SURVEY_QUESTIONS[nextIndex];
  return twimlResponse(
    `Q${nextIndex + 1}/${SURVEY_QUESTIONS.length}: ${nextQ.questionText} (YES/NO)`
  );
}
