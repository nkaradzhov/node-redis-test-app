/**
 * Standard error types used throughout the application
 */
export const ErrorType = {
  // Connection errors
  ConnectionError: "connection_error",
  
  // Timeout errors
  Timeout: "timeout",
  
  // Authentication errors
  AuthError: "auth_error",
  
  // Memory errors
  MemoryError: "memory_error",
  
  // Command errors
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