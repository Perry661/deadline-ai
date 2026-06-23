import { ZodError } from "zod";

import { PlanError } from "@/src/features/plans/errors";
import { generatePlan } from "@/src/features/plans/service";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return Response.json(
      {
        code: "MISSING_CONFIGURATION",
        message: "The planning service is not configured.",
      },
      { status: 500 },
    );
  }

  try {
    const plan = await generatePlan(await request.json(), {
      apiKey,
      signal: request.signal,
    });

    return Response.json({ plan });
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return Response.json(
        {
          code: "INVALID_REQUEST",
          message: "Check the task details.",
        },
        { status: 400 },
      );
    }

    if (error instanceof PlanError) {
      return Response.json(
        {
          code: error.code,
          message: error.message,
        },
        { status: error.status },
      );
    }

    return Response.json(
      {
        code: "UPSTREAM_ERROR",
        message: "Unable to generate a plan.",
      },
      { status: 502 },
    );
  }
}
