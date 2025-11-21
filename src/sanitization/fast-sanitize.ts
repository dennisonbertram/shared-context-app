import {
  ANTHROPIC_API_KEY_REGEX,
  AWS_ACCESS_KEY_REGEX,
  CREDIT_CARD_REGEX,
  EMAIL_REGEX,
  GITHUB_TOKEN_REGEX,
  IP_REGEX,
  JWT_REGEX,
  OPENAI_API_KEY_REGEX,
  PATH_REGEX,
  PHONE_REGEX,
  PII_PATTERNS,
  PiiPatternKey,
  SSH_PRIVATE_KEY_REGEX,
  SSN_REGEX
} from './patterns';

export interface SanitizedMatch {
  type: PiiPatternKey;
  original: string;
}

export interface SanitizationResult {
  sanitized: string;
  redactions: number;
  matches: SanitizedMatch[];
}

export function sanitizeEmails(text: string): string {
  return text.replace(EMAIL_REGEX, '[REDACTED_EMAIL]');
}

export function sanitizePhones(text: string): string {
  return text.replace(PHONE_REGEX, '[REDACTED_PHONE]');
}

export function sanitizeIPs(text: string): string {
  return text.replace(IP_REGEX, '[REDACTED_IP]');
}

export function sanitizePaths(text: string): string {
  return text.replace(PATH_REGEX, '[REDACTED_PATH]');
}

export function sanitizeOpenAiKeys(text: string): string {
  return text.replace(OPENAI_API_KEY_REGEX, '[REDACTED_API_KEY_OPENAI]');
}

export function sanitizeAnthropicKeys(text: string): string {
  return text.replace(ANTHROPIC_API_KEY_REGEX, '[REDACTED_API_KEY_ANTHROPIC]');
}

export function sanitizeAwsKeys(text: string): string {
  return text.replace(AWS_ACCESS_KEY_REGEX, '[REDACTED_AWS_ACCESS_KEY]');
}

export function sanitizeGithubTokens(text: string): string {
  return text.replace(GITHUB_TOKEN_REGEX, '[REDACTED_GITHUB_TOKEN]');
}

export function sanitizeJwt(text: string): string {
  return text.replace(JWT_REGEX, '[REDACTED_JWT]');
}

export function sanitizeSshKeys(text: string): string {
  return text.replace(SSH_PRIVATE_KEY_REGEX, '[REDACTED_SSH_KEY]');
}

export function sanitizeCreditCards(text: string): string {
  return text.replace(CREDIT_CARD_REGEX, '[REDACTED_CREDIT_CARD]');
}

export function sanitizeSsns(text: string): string {
  return text.replace(SSN_REGEX, '[REDACTED_SSN]');
}

export function comprehensiveSanitize(text: string): SanitizationResult {
  if (!text) {
    return { sanitized: text, redactions: 0, matches: [] };
  }

  let sanitized = text;
  let redactions = 0;
  const matches: SanitizedMatch[] = [];

  for (const [type, regex] of Object.entries(PII_PATTERNS) as Array<
    [PiiPatternKey, RegExp]
  >) {
    sanitized = sanitized.replace(regex, (match: string) => {
      redactions += 1;
      matches.push({ type, original: match });
      return `[REDACTED_${type}]`;
    });
  }

  return { sanitized, redactions, matches };
}

export function sanitize(text: string): string {
  return comprehensiveSanitize(text).sanitized;
}

export const fastSanitize = sanitize;

