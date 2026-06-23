import { describe, expect, it } from "vitest";

import { PlanError } from "./errors";

describe("PlanError", () => {
  it("uses the code, message, status constructor order", () => {
    const error = new PlanError(
      "INVALID_REQUEST",
      "Request validation failed.",
      400,
    );

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(PlanError);
    expect(error).toMatchObject({
      name: "PlanError",
      code: "INVALID_REQUEST",
      message: "Request validation failed.",
      status: 400,
    });
  });
});
