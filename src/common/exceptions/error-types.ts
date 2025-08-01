/**
 * Standard error types used throughout the application
 */
export const ErrorType = {
  // Connection errors
  ConnectionError: "connection_error",

  // Timeout errors
  CommandTimeout: "command_timeout",
  SocketTimeout: "socket_timeout",

  // Timeout during maintenance errors
  SocketTimeoutDuringMaintenance: "socket_timeout_during_maintenance",
  CommandTimeoutDuringMaintenance: "command_timeout_during_maintenance",

  // Command errors
  CommandError: "command_error",

  Unknown: "unknown",
} as const;

export type ErrorTypeValue = typeof ErrorType[keyof typeof ErrorType];