import { ErrorType, type ErrorTypeValue } from "./error-types";

export class ApplicationException extends Error {
  constructor(
    public readonly type: ErrorTypeValue,
    message: string
  ) {
    super(message);
  }
}

const classifyError = (error: Error): ErrorTypeValue => {
  const errorName = error.constructor.name;

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
  if ((Error as any).isError(error)) {
    return new ApplicationException(
      classifyError(error as Error),
      (error as Error).message
    );
  }

  return new ApplicationException(ErrorType.Unknown, String(error));
};
