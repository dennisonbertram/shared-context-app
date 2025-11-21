/**
 * Canonical regex definitions for all fast PII sanitization patterns.
 * NOTE: These patterns are duplicated inside the Claude hook runtime
 *       for isolation and sub-100ms execution guarantees.
 */

export const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

export const PHONE_REGEX =
  /(?<=^|\s|\b)(?:\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g;

export const IP_REGEX = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g;

export const PATH_REGEX = /(\/Users\/|\/home\/)[a-zA-Z0-9_-]+\/[^\s]*/g;

export const OPENAI_API_KEY_REGEX = /sk-[a-zA-Z0-9]{48}/g;

export const ANTHROPIC_API_KEY_REGEX = /sk-ant-[a-zA-Z0-9-]{95}/g;

export const AWS_ACCESS_KEY_REGEX = /AKIA[0-9A-Z]{16}/g;

export const GITHUB_TOKEN_REGEX = /ghp_[a-zA-Z0-9]{36}/g;

export const JWT_REGEX =
  /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g;

export const SSH_PRIVATE_KEY_REGEX =
  /-----BEGIN (?:RSA|OPENSSH) PRIVATE KEY-----[\s\S]+?-----END (?:RSA|OPENSSH) PRIVATE KEY-----/g;

export const CREDIT_CARD_REGEX =
  /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g;

export const SSN_REGEX = /\b\d{3}-\d{2}-\d{4}\b/g;

export const PII_PATTERNS = {
  EMAIL: EMAIL_REGEX,
  PHONE: PHONE_REGEX,
  IP: IP_REGEX,
  PATH: PATH_REGEX,
  API_KEY_OPENAI: OPENAI_API_KEY_REGEX,
  API_KEY_ANTHROPIC: ANTHROPIC_API_KEY_REGEX,
  AWS_ACCESS_KEY: AWS_ACCESS_KEY_REGEX,
  GITHUB_TOKEN: GITHUB_TOKEN_REGEX,
  JWT: JWT_REGEX,
  SSH_KEY: SSH_PRIVATE_KEY_REGEX,
  CREDIT_CARD: CREDIT_CARD_REGEX,
  SSN: SSN_REGEX
} as const;

export type PiiPatternKey = keyof typeof PII_PATTERNS;

