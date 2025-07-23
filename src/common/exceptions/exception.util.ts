import { ErrorType, type ErrorTypeValue } from "./error-types";

export class ApplicationException extends Error {
  constructor(
    public readonly type: ErrorTypeValue,
    message: string
  ) {
    super(message);
  }
}

const classifyError = (error?: unknown): ErrorTypeValue => {
  if (!error) {
    return ErrorType.Unknown;
  }

  const errorName = error?.constructor?.name;

  // Connection-related errors
  if (
    errorName === "ConnectionTimeoutError" ||
    errorName === "ClientClosedError" ||
    errorName === "ClientOfflineError" ||
    errorName === "DisconnectsClientError" ||
    errorName === "SocketClosedUnexpectedlyError" ||
    errorName === "RootNodesUnavailableError" ||
    errorName === "ReconnectStrategyError"
  ) {
    return ErrorType.ConnectionError;
  }

  // Timeout errors
  if (errorName === "TimeoutError" || errorName === "SocketTimeoutError") {
    return ErrorType.Timeout;
  }

  // Command errors
  if (
    errorName === "ErrorReply" ||
    errorName === "SimpleError" ||
    errorName === "BlobError" ||
    errorName === "MultiErrorReply" ||
    errorName === "AbortError" ||
    errorName === "WatchError"
  ) {
    return ErrorType.CommandError;
  }

  return ErrorType.Unknown;
};

export const parseError = (error: unknown): ApplicationException => {
  try {
    // isError is new
    if ((Error as any).isError(error)) {
      if (error instanceof AggregateError) {
        return new ApplicationException(
          classifyError(error.errors[0]),
          error.errors.map((e) => e.message).join(", ")
        );
      }

      return new ApplicationException(
        classifyError(error),
        (error as Error)?.message || (error as Error)?.name
      );
    }
  } catch {
    return new ApplicationException(ErrorType.Unknown, "Failed to Parse Error");
  }

  return new ApplicationException(ErrorType.Unknown, String(error));
};
