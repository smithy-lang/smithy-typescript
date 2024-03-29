import { SdkError } from "@smithy/types";

export const asSdkError = (error: unknown): SdkError => {
  if (error instanceof Error) return error;
  if (error instanceof Object) return Object.assign(new Error(), error);
  if (typeof error === "string") return new Error(error);
  return new Error(`AWS SDK error wrapper for ${error}`);
};
