import { ErrorType, type ErrorTypeValue } from "./error-types";

export class ApplicationException extends Error {
  public readonly originalName: string | undefined;
  public readonly type: ErrorTypeValue;

  constructor({
    type,
    message,
    originalName,
  }: {
    type: ErrorTypeValue;
    message: string;
    originalName?: string;
  }) {
    super(message);

    this.originalName = originalName ?? "Unknown";
    this.type = type;
  }
}

const classifyError = (error?: unknown): ErrorTypeValue => {
  if (!error) {
    return ErrorType.Unknown;
  }

  const errorName = error?.constructor?.name;

  // Connection errors
  const connectionErrors = [
    "ConnectionTimeoutError",
    "ClientClosedError",
    "ClientOfflineError",
    "DisconnectsClientError",
    "SocketClosedUnexpectedlyError",
    "RootNodesUnavailableError",
    "ReconnectStrategyError",
  ];

  if (connectionErrors.includes(errorName)) {
    return ErrorType.ConnectionError;
  }

  // Socket timeout errors
  if (errorName === "SocketTimeoutError") {
    return ErrorType.SocketTimeout;
  }

  // Command timeout errors  
  if (errorName === "TimeoutError") {
    return ErrorType.CommandTimeout;
  }

  // Socket timeout during maintenance errors
  if (errorName === "SocketTimeoutDuringMaintananceError") {
    return ErrorType.SocketTimeoutDuringMaintenance;
  }

  // Command timeout during maintenance errors
  if (errorName === "CommandTimeoutDuringMaintananceError") {
    return ErrorType.CommandTimeoutDuringMaintenance;
  }

  // Command errors
  const commandErrors = [
    "ErrorReply",
    "SimpleError",
    "BlobError",
    "MultiErrorReply",
    "AbortError",
    "WatchError",
  ];

  if (commandErrors.includes(errorName)) {
    return ErrorType.CommandError;
  }

  return ErrorType.Unknown;
};

export const parseError = (error: unknown): ApplicationException => {
  try {
    // isError is new
    if ((Error as any).isError(error)) {
      if (error instanceof AggregateError) {
        return new ApplicationException({
          type: classifyError(error.errors[0]),
          message: error.errors.map((e) => e.message).join(", "),
          originalName: error?.constructor?.name,
        });
      }

      return new ApplicationException({
        type: classifyError(error),
        message: (error as Error)?.message || (error as Error)?.name,
        originalName: error?.constructor?.name,
      });
    }
  } catch {
    return new ApplicationException({
      type: ErrorType.Unknown,
      message: "Failed to Parse Error",
      originalName: "Unknown",
    });
  }

  return new ApplicationException({
    type: ErrorType.Unknown,
    message: String(error),
    originalName: error?.constructor?.name,
  });
};
