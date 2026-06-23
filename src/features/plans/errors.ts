export type PlanErrorCode =
  | "INVALID_REQUEST"
  | "UPSTREAM_ERROR"
  | "INVALID_MODEL_OUTPUT"
  | "MISSING_CONFIGURATION";

export class PlanError extends Error {
  readonly code: PlanErrorCode;
  readonly status: number;

  constructor(code: PlanErrorCode, status: number, message: string) {
    super(message);
    this.name = "PlanError";
    this.code = code;
    this.status = status;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
