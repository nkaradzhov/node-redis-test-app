/**
 * Redacts sensitive field values from an object recursively
 * @param obj - The object to redact fields from
 * @param fieldsToRedact - Array of field names to redact
 * @param redactionValue - Value to replace sensitive fields with (default: '[REDACTED]')
 * @returns A new object with specified fields redacted
 */
export function redactFields<T>(
  obj: T,
  fieldsToRedact = ["password", "username", "cert", "key", "ca", "passphrase"],
  redactionValue = "[REDACTED]"
): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) =>
      redactFields(item, fieldsToRedact, redactionValue)
    ) as T;
  }

  const result = {} as T;

  const fieldsToRedactLower = fieldsToRedact.map((field) =>
    field.toLowerCase()
  );

  for (const [key, value] of Object.entries(obj)) {
    if (fieldsToRedactLower.includes(key.toLowerCase())) {
      (result as any)[key] = redactionValue;
    } else if (typeof value === "object" && value !== null) {
      (result as any)[key] = redactFields(
        value,
        fieldsToRedact,
        redactionValue
      );
    } else {
      (result as any)[key] = value;
    }
  }

  return result;
}
