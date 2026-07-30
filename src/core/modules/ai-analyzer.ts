import OpenAI from 'openai';
import type { AiAnalysisResult } from '../engine/types';
import type { Settings } from '../../config/settings';

const SYSTEM_PROMPT = `You are a WordPress malware analyst. Classify the provided PHP code as:
- MALICIOUS (backdoor, spam, phishing, redirect, cryptominer, webshell, SEO spam, etc.)
- SUSPICIOUS (unusual but not definitively malicious — obfuscated, uses uncommon patterns)
- SAFE (legitimate WordPress code)

Return your analysis as JSON:
{
  "classification": "malicious" | "suspicious" | "safe",
  "reasoning": "explanation of why you classified it this way",
  "malwareType": "type of malware if malicious (e.g., webshell, spam, backdoor), null if safe",
  "removalInstructions": "how to remove it, null if safe"
}

Key indicators of malware:
- eval(), assert(), create_function() with user input ($_GET, $_POST, $_REQUEST)
- base64_decode(), gzinflate(), str_rot13() chains before eval/exec
- Writing files from php://input or remote URLs
- Obfuscated variable names, hex-encoded strings
- System/exec calls with dynamic arguments
- Hidden admin user creation
- wp_options manipulation to hide plugins`;

export class AiAnalyzer {
  constructor(private siteId: string, private scanId: string) {}

  async analyze(
    code: string,
    settings: Settings
  ): Promise<{ result: AiAnalysisResult; cost: number }> {
    if (!settings.aiEnabled || !settings.apiKeys.openrouter?.key) {
      return {
        result: { classification: 'suspicious', reasoning: 'AI analysis skipped (disabled or no API key)' },
        cost: 0,
      };
    }

    const client = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: settings.apiKeys.openrouter.key,
      defaultHeaders: {
        'HTTP-Referer': 'https://wp-security-hub.local',
        'X-Title': 'WP Security Hub',
      },
    });

    const truncatedCode = code.length > 8000 ? code.substring(0, 8000) + '\n... (truncated)' : code;

    const resp = await client.chat.completions.create({
      model: settings.aiModel,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Analyze this PHP code:\n\`\`\`php\n${truncatedCode}\n\`\`\`` },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 1000,
    });

    const content = resp.choices[0]?.message?.content || '{}';
    const analysis = JSON.parse(content) as AiAnalysisResult;

    return {
      result: analysis,
      cost: 0,
    };
  }
}