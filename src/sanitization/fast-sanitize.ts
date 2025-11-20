/**
 * Fast sanitization for PII
 * Uses regex-based pattern matching for <50ms performance requirement
 */

// Email: word characters, dots, plus, hyphens, percent, underscore @ domain . tld
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;

// Phone:
// - Optional country code (+1, +44)
// - Optional parentheses around area code
// - Separators: space, dot, hyphen
// - Minimum 7 digits, max 15
// Uses lookbehind (?<=^|\s|\b) to ensure we start at a boundary without consuming it
const PHONE_REGEX = /(?<=^|\s|\b)(?:\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g;

// IPv4: 4 groups of 1-3 digits separated by dots
// Uses boundaries to avoid matching version numbers like v1.2.3
const IP_REGEX = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g;

// File Paths: 
// - Unix/macOS absolute paths starting with /Users/ or /home/
// - Must contain at least one more path segment
// - Stops at whitespace
const PATH_REGEX = /(\/Users\/|\/home\/)[a-zA-Z0-9_-]+\/[^\s]*/g;

/**
 * Sanitizes email addresses in text
 */
export function sanitizeEmails(text: string): string {
  return text.replace(EMAIL_REGEX, '[REDACTED_EMAIL]');
}

/**
 * Sanitizes phone numbers in text
 */
export function sanitizePhones(text: string): string {
  return text.replace(PHONE_REGEX, '[REDACTED_PHONE]');
}

/**
 * Sanitizes IP addresses in text
 */
export function sanitizeIPs(text: string): string {
  return text.replace(IP_REGEX, '[REDACTED_IP]');
}

/**
 * Sanitizes file paths in text
 */
export function sanitizePaths(text: string): string {
  return text.replace(PATH_REGEX, '[REDACTED_PATH]');
}

/**
 * Comprehensive fast sanitization
 * Applies all rule-based sanitizers in sequence
 * @param text - Text to sanitize
 * @returns Sanitized text
 */
export function sanitize(text: string): string {
  let result = text;
  result = sanitizeEmails(result);
  result = sanitizePhones(result);
  result = sanitizeIPs(result);
  result = sanitizePaths(result);
  return result;
}

// Export alias for backward compatibility
export const fastSanitize = sanitize;
