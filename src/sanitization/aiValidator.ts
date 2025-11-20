import Anthropic from '@anthropic-ai/sdk';

export interface ValidationResult {
  isClean: boolean;
  issues: string[];
  rawResponse?: unknown;
}

const DEFAULT_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: 'email', pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/ },
  { name: 'phone', pattern: /(?<=^|\s|\b)(?:\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/ },
  { name: 'ip_address', pattern: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/ },
  { name: 'user_path', pattern: /(\/Users\/|\/home\/)[a-zA-Z0-9_-]+\/[^\s]*/ }
];

function heuristicValidation(text: string): ValidationResult {
  const issues = DEFAULT_PATTERNS.filter(({ pattern }) => pattern.test(text)).map(({ name }) => name);
  return { isClean: issues.length === 0, issues };
}

export async function validateSanitization(
  sanitizedText: string,
  options?: { client?: Anthropic }
): Promise<ValidationResult> {
  const trimmed = sanitizedText.trim();
  if (!trimmed) {
    return { isClean: true, issues: [] };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey && !options?.client) {
    return heuristicValidation(trimmed);
  }

  const client = options?.client ?? new Anthropic({ apiKey: apiKey! });
  const prompt = `You are a PII validation agent. Inspect the following SANITIZED text and indicate if any PII remains.

Text:
${trimmed}

Respond with valid JSON:
{
  "isClean": true | false,
  "issues": ["description of any PII that remains"]
}`;

  try {
    const response = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL ?? 'claude-3-5-sonnet-20241022',
      max_tokens: 1000,
      temperature: 0,
      messages: [{ role: 'user', content: prompt }]
    });

    const content = response.content?.[0];
    if (content?.type === 'text') {
      const parsed = JSON.parse(content.text);
      return {
        isClean: Boolean(parsed.isClean),
        issues: Array.isArray(parsed.issues) ? parsed.issues : [],
        rawResponse: response
      };
    }
  } catch (error) {
    return heuristicValidation(trimmed);
  }

  return heuristicValidation(trimmed);
}

