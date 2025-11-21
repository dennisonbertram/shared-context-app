import { describe, it, expect } from 'vitest';
import {
  comprehensiveSanitize,
  sanitize,
  sanitizeEmails,
  SanitizationResult
} from './fast-sanitize';
import { PiiPatternKey } from './patterns';

const OPENAI_KEY_A = `sk-${'a'.repeat(48)}`;
const OPENAI_KEY_B = `sk-${'A1'.repeat(24)}`;
const ANTHROPIC_KEY_A = `sk-ant-${'a'.repeat(95)}`;
const ANTHROPIC_KEY_B = `sk-ant-${'Z1'.repeat(47)}Z`;
const AWS_KEY_A = 'AKIA1234567890ABCD12';
const AWS_KEY_B = 'AKIAABCDEFGHIJKLMNOP';
const GITHUB_TOKEN_A = `ghp_${'a'.repeat(36)}`;
const GITHUB_TOKEN_B = `ghp_${'A1'.repeat(18)}`;
const JWT_BASIC =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
const JWT_EDGE =
  'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpZCI6IjEyMyJ9.sigKxwRJSMeKKF2QT4fwpm';
const SSH_KEY_OPENSSH = `-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAB
-----END OPENSSH PRIVATE KEY-----`;
const SSH_KEY_RSA = `-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA
-----END RSA PRIVATE KEY-----`;

type PatternCase = {
  type: PiiPatternKey;
  basic: { input: string; expected: string };
  edge: { input: string; expected: string };
  falsePositive: string;
};

const CASES: PatternCase[] = [
  {
    type: 'EMAIL',
    basic: {
      input: 'Email user@example.com for support',
      expected: 'Email [REDACTED_EMAIL] for support'
    },
    edge: {
      input: 'Email user.name+tag@mail.example.co for updates',
      expected: 'Email [REDACTED_EMAIL] for updates'
    },
    falsePositive: 'Reach me at user@example'
  },
  {
    type: 'PHONE',
    basic: {
      input: 'Call me at 123-456-7890 tomorrow',
      expected: 'Call me at [REDACTED_PHONE] tomorrow'
    },
    edge: {
      input: 'Dial +44 123 456 7890 for UK office',
      expected: 'Dial [REDACTED_PHONE] for UK office'
    },
    falsePositive: 'Dial 123-4567 for short code'
  },
  {
    type: 'IP',
    basic: {
      input: 'Server 10.1.2.3 is internal',
      expected: 'Server [REDACTED_IP] is internal'
    },
    edge: {
      input: 'Public resolver is 8.8.8.8',
      expected: 'Public resolver is [REDACTED_IP]'
    },
    falsePositive: 'Version v1.2.3 deployed'
  },
  {
    type: 'PATH',
    basic: {
      input: 'Path /Users/jane/secret.txt leaked',
      expected: 'Path [REDACTED_PATH] leaked'
    },
    edge: {
      input: 'Config lives at /home/alice/project/config.json',
      expected: 'Config lives at [REDACTED_PATH]'
    },
    falsePositive: 'System path /usr/local/bin/node is fine'
  },
  {
    type: 'API_KEY_OPENAI',
    basic: {
      input: `Key ${OPENAI_KEY_A} should never leak`,
      expected: 'Key [REDACTED_API_KEY_OPENAI] should never leak'
    },
    edge: {
      input: `Rotation for ${OPENAI_KEY_B} scheduled`,
      expected: 'Rotation for [REDACTED_API_KEY_OPENAI] scheduled'
    },
    falsePositive: 'Example sk-12345 is incomplete'
  },
  {
    type: 'API_KEY_ANTHROPIC',
    basic: {
      input: `Key ${ANTHROPIC_KEY_A} must stay private`,
      expected: 'Key [REDACTED_API_KEY_ANTHROPIC] must stay private'
    },
    edge: {
      input: `Spare key ${ANTHROPIC_KEY_B} rotated`,
      expected: 'Spare key [REDACTED_API_KEY_ANTHROPIC] rotated'
    },
    falsePositive: 'Example sk-ant-123 is not valid'
  },
  {
    type: 'AWS_ACCESS_KEY',
    basic: {
      input: `AWS key ${AWS_KEY_A} leaked`,
      expected: 'AWS key [REDACTED_AWS_ACCESS_KEY] leaked'
    },
    edge: {
      input: `Staging uses ${AWS_KEY_B}`,
      expected: 'Staging uses [REDACTED_AWS_ACCESS_KEY]'
    },
    falsePositive: 'AKIA123 is not long enough'
  },
  {
    type: 'GITHUB_TOKEN',
    basic: {
      input: `Token ${GITHUB_TOKEN_A} committed accidentally`,
      expected: 'Token [REDACTED_GITHUB_TOKEN] committed accidentally'
    },
    edge: {
      input: `Backup token ${GITHUB_TOKEN_B} revoked`,
      expected: 'Backup token [REDACTED_GITHUB_TOKEN] revoked'
    },
    falsePositive: 'ghp_123 is clearly fake'
  },
  {
    type: 'JWT',
    basic: {
      input: `Auth ${JWT_BASIC} captured`,
      expected: 'Auth [REDACTED_JWT] captured'
    },
    edge: {
      input: `Alt token ${JWT_EDGE} debug`,
      expected: 'Alt token [REDACTED_JWT] debug'
    },
    falsePositive: 'eyJabc is not a full JWT'
  },
  {
    type: 'SSH_KEY',
    basic: {
      input: `Key material:\n${SSH_KEY_OPENSSH}`,
      expected: 'Key material:\n[REDACTED_SSH_KEY]'
    },
    edge: {
      input: `Legacy key:\n${SSH_KEY_RSA}`,
      expected: 'Legacy key:\n[REDACTED_SSH_KEY]'
    },
    falsePositive: '-----BEGIN PUBLIC KEY----- block is allowed'
  },
  {
    type: 'CREDIT_CARD',
    basic: {
      input: 'Card 4111 1111 1111 1111 charged',
      expected: 'Card [REDACTED_CREDIT_CARD] charged'
    },
    edge: {
      input: 'Fallback card 4000-1234-5678-9010 used',
      expected: 'Fallback card [REDACTED_CREDIT_CARD] used'
    },
    falsePositive: 'Card 4111-1111-1111 is truncated'
  },
  {
    type: 'SSN',
    basic: {
      input: 'SSN 123-45-6789 filed',
      expected: 'SSN [REDACTED_SSN] filed'
    },
    edge: {
      input: 'SSN 987-65-4321 confirmed',
      expected: 'SSN [REDACTED_SSN] confirmed'
    },
    falsePositive: 'SSN 123-45-678 is incomplete'
  }
];

describe('sanitizeEmails (legacy helpers)', () => {
  it('should redact multiple formats', () => {
    expect(sanitizeEmails('Contact user@example.com')).toBe(
      'Contact [REDACTED_EMAIL]'
    );
    expect(sanitizeEmails('Reach user+test@mail.co')).toBe(
      'Reach [REDACTED_EMAIL]'
    );
  });

  it('should leave invalid email fragments intact', () => {
    expect(sanitizeEmails('user@')).toBe('user@');
    expect(sanitizeEmails('@example.com')).toBe('@example.com');
  });
});

describe('comprehensiveSanitize patterns', () => {
  for (const entry of CASES) {
    describe(`${entry.type}`, () => {
      it('redacts basic sample', () => {
        const result = comprehensiveSanitize(entry.basic.input);
        expect(result.sanitized).toBe(entry.basic.expected);
      });

      it('redacts edge sample', () => {
        const result = comprehensiveSanitize(entry.edge.input);
        expect(result.sanitized).toBe(entry.edge.expected);
      });

      it('avoids false positives', () => {
        const result = comprehensiveSanitize(entry.falsePositive);
        expect(result.sanitized).toBe(entry.falsePositive);
        expect(result.redactions).toBe(0);
      });
    });
  }

  it('counts redactions and records matches', () => {
    const payload = [
      'Contact user@example.com',
      'Call 123-456-7890',
      'IP 8.8.8.8',
      `Key ${OPENAI_KEY_A}`
    ].join(' | ');
    const result = comprehensiveSanitize(payload);
    expect(result.redactions).toBe(4);
    expect(result.matches).toHaveLength(4);
    expect(result.sanitized).not.toContain('user@example.com');
    expect(result.sanitized).not.toContain('123-456-7890');
    expect(result.sanitized).not.toContain('8.8.8.8');
    expect(result.sanitized).not.toContain(OPENAI_KEY_A);
  });

  it('sanitizes repeated mixed PII in under 50ms', () => {
    const chunk = [
      `Email user@example.com`,
      `Phone 555-123-4567`,
      `IP 192.168.0.1`,
      `Path /Users/alex/docs/secret.txt`,
      `OpenAI ${OPENAI_KEY_A}`,
      `Anthropic ${ANTHROPIC_KEY_A}`,
      `AWS ${AWS_KEY_A}`,
      `GitHub ${GITHUB_TOKEN_A}`,
      `JWT ${JWT_BASIC}`,
      `SSH\n${SSH_KEY_OPENSSH}`,
      `Card 4111 1111 1111 1111`,
      `SSN 123-45-6789`
    ].join(' ');
    const text = chunk.repeat(20); // ~12KB
    const start = performance.now();
    const result: SanitizationResult = comprehensiveSanitize(text);
    const duration = performance.now() - start;
    expect(result.redactions).toBeGreaterThan(0);
    expect(duration).toBeLessThan(50);
  });
});

describe('sanitize alias', () => {
  it('returns sanitized string from helper', () => {
    const input = `Email user@example.com and OpenAI ${OPENAI_KEY_A}`;
    const output = sanitize(input);
    expect(output).toContain('[REDACTED_EMAIL]');
    expect(output).toContain('[REDACTED_API_KEY_OPENAI]');
  });
});

