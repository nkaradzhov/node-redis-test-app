/**
 * Standard error types used throughout the application
 */
export const ErrorType = {
  // Individual connection errors
  ConnectionTimeoutError: "connection_timeout_error",
  ClientClosedError: "client_closed_error",
  ClientOfflineError: "client_offline_error",
  DisconnectsClientError: "disconnects_client_error",
  SocketClosedUnexpectedlyError: "socket_closed_unexpectedly_error",
  RootNodesUnavailableError: "root_nodes_unavailable_error",
  ReconnectStrategyError: "reconnect_strategy_error",
  
  // Generic connection error (fallback)
  ConnectionError: "connection_error",

  // Individual timeout errors
  TimeoutError: "timeout_error",
  SocketTimeoutError: "socket_timeout_error",
  TimeoutDuringMaintenance: "timeout_during_maintenance",
  
  // Generic timeout error (fallback)
  Timeout: "timeout",

  // Authentication errors
  AuthError: "auth_error",

  // Memory errors
  MemoryError: "memory_error",

  // Command errors - individual types
  ErrorReplyError: "error_reply_error",
  SimpleError: "simple_error", 
  BlobError: "blob_error",
  MultiErrorReplyError: "multi_error_reply_error",
  AbortError: "abort_error",
  WatchError: "watch_error",
  
  // Generic command error (fallback)
  CommandError: "command_error",

  // Cluster errors
  ClusterError: "cluster_error",

  // Application errors
  ConfigError: "config_error",
  ValidationError: "validation_error",

  // Generic errors
  RuntimeError: "runtime_error",
  Unknown: "unknown",
} as const;

export type ErrorTypeValue = typeof ErrorType[keyof typeof ErrorType];