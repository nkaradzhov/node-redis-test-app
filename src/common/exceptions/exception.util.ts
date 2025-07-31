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

  // TODO fix this
  // Individual connection errors
  if (errorName === "ConnectionTimeoutError") {
    return ErrorType.ConnectionTimeoutError;
  }

  if (errorName === "ClientClosedError") {
    return ErrorType.ClientClosedError;
  }

  if (errorName === "ClientOfflineError") {
    return ErrorType.ClientOfflineError;
  }

  if (errorName === "DisconnectsClientError") {
    return ErrorType.DisconnectsClientError;
  }

  if (errorName === "SocketClosedUnexpectedlyError") {
    return ErrorType.SocketClosedUnexpectedlyError;
  }

  if (errorName === "RootNodesUnavailableError") {
    return ErrorType.RootNodesUnavailableError;
  }

  if (errorName === "ReconnectStrategyError") {
    return ErrorType.ReconnectStrategyError;
  }

  if (errorName === "TimeoutDuringMaintanance") {
    return ErrorType.TimeoutDuringMaintenance;
  }

  // Individual timeout errors
  if (errorName === "TimeoutError") {
    return ErrorType.TimeoutError;
  }

  if (errorName === "SocketTimeoutError") {
    return ErrorType.SocketTimeoutError;
  }

  // Individual command errors
  if (errorName === "ErrorReply") {
    return ErrorType.ErrorReplyError;
  }

  if (errorName === "SimpleError") {
    return ErrorType.SimpleError;
  }

  if (errorName === "BlobError") {
    return ErrorType.BlobError;
  }

  if (errorName === "MultiErrorReply") {
    return ErrorType.MultiErrorReplyError;
  }

  if (errorName === "AbortError") {
    return ErrorType.AbortError;
  }

  if (errorName === "WatchError") {
    return ErrorType.WatchError;
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
