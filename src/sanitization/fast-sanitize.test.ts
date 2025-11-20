import { describe, it, expect } from 'vitest';
import { sanitize, sanitizeEmails } from './fast-sanitize';

describe('fast-sanitize', () => {
  describe('sanitizeEmails', () => {
    it('should redact basic email', () => {
      expect(sanitizeEmails('Contact: user@example.com')).toBe(
        'Contact: [REDACTED_EMAIL]'
      );
    });

    it('should redact multiple emails', () => {
      expect(sanitizeEmails('user1@ex.com and user2@ex.com')).toBe(
        '[REDACTED_EMAIL] and [REDACTED_EMAIL]'
      );
    });

    it('should not redact non-emails', () => {
      expect(sanitizeEmails('Not an email: test@')).toBe('Not an email: test@');
    });

    it('should handle email with subdomain', () => {
      expect(sanitizeEmails('Email: user@mail.example.com')).toBe(
        'Email: [REDACTED_EMAIL]'
      );
    });

    it('should handle email with plus sign', () => {
      expect(sanitizeEmails('Email: user+tag@example.com')).toBe(
        'Email: [REDACTED_EMAIL]'
      );
    });

    it('should handle email with numbers', () => {
      expect(sanitizeEmails('Email: user123@example456.com')).toBe(
        'Email: [REDACTED_EMAIL]'
      );
    });

    it('should handle empty string', () => {
      expect(sanitizeEmails('')).toBe('');
    });

    it('should handle text without emails', () => {
      expect(sanitizeEmails('This is just regular text')).toBe(
        'This is just regular text'
      );
    });

    it('should not redact partial email patterns', () => {
      expect(sanitizeEmails('test@')).toBe('test@');
      expect(sanitizeEmails('@example.com')).toBe('@example.com');
      expect(sanitizeEmails('user@')).toBe('user@');
    });

    it('should handle email at start of text', () => {
      expect(sanitizeEmails('user@example.com is my email')).toBe(
        '[REDACTED_EMAIL] is my email'
      );
    });

    it('should handle email at end of text', () => {
      expect(sanitizeEmails('My email is user@example.com')).toBe(
        'My email is [REDACTED_EMAIL]'
      );
    });
  });

  describe('sanitize (all types)', () => {
    it('should redact emails', () => {
      expect(sanitize('Email: user@example.com')).toBe('Email: [REDACTED_EMAIL]');
    });

    it('should redact IPv4 addresses', () => {
      expect(sanitize('Server: 192.168.1.1')).toBe('Server: [REDACTED_IP]');
      expect(sanitize('Public: 8.8.8.8')).toBe('Public: [REDACTED_IP]');
    });

    it('should NOT redact version numbers looking like IPs', () => {
      expect(sanitize('v1.2.3')).toBe('v1.2.3');
      expect(sanitize('version 10.0.1')).toBe('version 10.0.1');
    });

    it('should redact phone numbers', () => {
      // US formats
      expect(sanitize('Call 123-456-7890')).toBe('Call [REDACTED_PHONE]');
      expect(sanitize('Call (123) 456-7890')).toBe('Call [REDACTED_PHONE]');
      expect(sanitize('Call +1-123-456-7890')).toBe('Call [REDACTED_PHONE]');
    });

    it('should redact file paths', () => {
      // Unix absolute paths with username pattern
      expect(sanitize('Path: /Users/john/documents/secret.txt')).toBe(
        'Path: [REDACTED_PATH]'
      );
      expect(sanitize('Path: /home/alice/project/config.json')).toBe(
        'Path: [REDACTED_PATH]'
      );
    });

    it('should NOT redact system paths', () => {
      expect(sanitize('/usr/bin/node')).toBe('/usr/bin/node');
      expect(sanitize('/etc/hosts')).toBe('/etc/hosts');
    });

    it('should handle mixed PII', () => {
      const input = 'User john@example.com at 192.168.1.5 uploaded /Users/john/file.txt';
      const output = sanitize(input);
      expect(output).toContain('[REDACTED_EMAIL]');
      expect(output).toContain('[REDACTED_IP]');
      expect(output).toContain('[REDACTED_PATH]');
      expect(output).not.toContain('john@example.com');
      expect(output).not.toContain('192.168.1.5');
      expect(output).not.toContain('/Users/john/file.txt');
    });

    it('should sanitize in <50ms (mixed content)', () => {
      const text = 'user@example.com 192.168.1.1 /Users/me/file.txt '.repeat(50);
      const start = performance.now();
      sanitize(text);
      const duration = performance.now() - start;
      expect(duration).toBeLessThan(50);
    });
  });
});
