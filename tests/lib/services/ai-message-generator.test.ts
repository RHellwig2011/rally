import {
  generateEmailMessage,
  generateSMSMessage,
  generateVideoScript,
  generateMessageVariations,
  improveMessage,
  CampaignContext,
} from '@/lib/services/ai-message-generator';

// Mock the openai module so no real API calls are made
jest.mock('openai', () => {
  const mockCreate = jest.fn();
  return jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  }));
});

import OpenAI from 'openai';

const getMockCreate = () =>
  (new (OpenAI as any)()).chat.completions.create as jest.Mock;

const makeCompletion = (content: string) => ({
  choices: [{ message: { content } }],
});

const context: CampaignContext = {
  campaignName: 'Soccer Fundraiser',
  teamName: 'City FC',
  organizationName: 'City Youth Sports',
  description: 'Help us buy new equipment',
  goalAmount: 1000,
  currentAmount: 400,
  playerName: 'Alex',
  playerPosition: 'Forward',
  playerGrade: '10',
};

beforeEach(() => {
  getMockCreate().mockReset();
});

// ─── generateEmailMessage ─────────────────────────────────────────────────────

describe('generateEmailMessage', () => {
  it('returns subject and body from AI response', async () => {
    getMockCreate().mockResolvedValueOnce(
      makeCompletion(JSON.stringify({ subject: 'AI Subject', body: 'AI Body' }))
    );
    const result = await generateEmailMessage(context);
    expect(result.subject).toBe('AI Subject');
    expect(result.body).toBe('AI Body');
  });

  it('falls back gracefully when OpenAI throws', async () => {
    getMockCreate().mockRejectedValueOnce(new Error('API down'));
    const result = await generateEmailMessage(context);
    expect(result.subject).toContain('Alex');
    expect(result.subject).toContain('Soccer Fundraiser');
    expect(result.body).toContain('Alex');
  });

  it('falls back when content is null', async () => {
    getMockCreate().mockResolvedValueOnce({ choices: [{ message: { content: null } }] });
    const result = await generateEmailMessage(context);
    expect(result.subject).toContain('Alex');
  });

  it('uses default subject when AI response missing subject field', async () => {
    getMockCreate().mockResolvedValueOnce(
      makeCompletion(JSON.stringify({ body: 'Just a body' }))
    );
    const result = await generateEmailMessage(context);
    expect(result.subject).toContain('Alex');
    expect(result.body).toBe('Just a body');
  });

  it('includes fundraising stats in prompt when includeStats=true', async () => {
    getMockCreate().mockResolvedValueOnce(
      makeCompletion(JSON.stringify({ subject: 'S', body: 'B' }))
    );
    await generateEmailMessage(context, { includeStats: true });
    const prompt = getMockCreate().mock.calls[0][0].messages[1].content;
    expect(prompt).toContain('$1000.00');
    expect(prompt).toContain('$400.00');
  });

  it('omits stats in prompt when includeStats=false', async () => {
    getMockCreate().mockResolvedValueOnce(
      makeCompletion(JSON.stringify({ subject: 'S', body: 'B' }))
    );
    await generateEmailMessage(context, { includeStats: false });
    const prompt = getMockCreate().mock.calls[0][0].messages[1].content;
    expect(prompt).not.toContain('$1000.00');
  });

  it('includes custom instructions in prompt', async () => {
    getMockCreate().mockResolvedValueOnce(
      makeCompletion(JSON.stringify({ subject: 'S', body: 'B' }))
    );
    await generateEmailMessage(context, { customInstructions: 'Keep it under 3 sentences' });
    const prompt = getMockCreate().mock.calls[0][0].messages[1].content;
    expect(prompt).toContain('Keep it under 3 sentences');
  });

  it('fallback body includes stats when includeStats=true (default)', async () => {
    getMockCreate().mockRejectedValueOnce(new Error('fail'));
    const result = await generateEmailMessage(context, { includeStats: true });
    expect(result.body).toContain('$400.00');
    expect(result.body).toContain('$1000.00');
  });

  it('fallback body omits stats when includeStats=false', async () => {
    getMockCreate().mockRejectedValueOnce(new Error('fail'));
    const result = await generateEmailMessage(context, { includeStats: false });
    expect(result.body).not.toContain('$400.00');
  });
});

// ─── generateSMSMessage ───────────────────────────────────────────────────────

describe('generateSMSMessage', () => {
  it('returns trimmed message from AI', async () => {
    getMockCreate().mockResolvedValueOnce(makeCompletion('  Hi from Alex!  '));
    const result = await generateSMSMessage(context);
    expect(result).toBe('Hi from Alex!');
  });

  it('truncates response to 160 characters', async () => {
    const longMsg = 'A'.repeat(200);
    getMockCreate().mockResolvedValueOnce(makeCompletion(longMsg));
    const result = await generateSMSMessage(context);
    expect(result).toHaveLength(160);
  });

  it('falls back when OpenAI throws', async () => {
    getMockCreate().mockRejectedValueOnce(new Error('SMS API down'));
    const result = await generateSMSMessage(context);
    expect(result).toContain('Alex');
    expect(result).toContain('Soccer Fundraiser');
  });

  it('falls back when content is null', async () => {
    getMockCreate().mockResolvedValueOnce({ choices: [{ message: { content: null } }] });
    const result = await generateSMSMessage(context);
    expect(result).toContain('Alex');
  });
});

// ─── generateVideoScript ──────────────────────────────────────────────────────

describe('generateVideoScript', () => {
  it('returns script content from AI', async () => {
    getMockCreate().mockResolvedValueOnce(makeCompletion('[Look at camera]\nHi, I am Alex.'));
    const result = await generateVideoScript(context);
    expect(result).toContain('Alex');
  });

  it('falls back when OpenAI throws', async () => {
    getMockCreate().mockRejectedValueOnce(new Error('fail'));
    const result = await generateVideoScript(context);
    expect(result).toContain('Alex');
    expect(result).toContain('City FC');
  });

  it('uses default 30-second duration', async () => {
    getMockCreate().mockResolvedValueOnce(makeCompletion('script'));
    await generateVideoScript(context);
    const prompt = getMockCreate().mock.calls[0][0].messages[1].content;
    expect(prompt).toContain('30-second');
  });

  it('uses custom duration when provided', async () => {
    getMockCreate().mockResolvedValueOnce(makeCompletion('script'));
    await generateVideoScript(context, 60);
    const prompt = getMockCreate().mock.calls[0][0].messages[1].content;
    expect(prompt).toContain('60-second');
  });

  it('returns fallback text when content is null', async () => {
    getMockCreate().mockResolvedValueOnce({ choices: [{ message: { content: null } }] });
    const result = await generateVideoScript(context);
    expect(result).toBe('Hi! Please support my fundraiser. Thank you!');
  });
});

// ─── generateMessageVariations ────────────────────────────────────────────────

describe('generateMessageVariations', () => {
  it('returns up to 3 variations', async () => {
    getMockCreate().mockResolvedValue(
      makeCompletion(JSON.stringify({ subject: 'S', body: 'B' }))
    );
    const results = await generateMessageVariations(context, 3);
    expect(results).toHaveLength(3);
  });

  it('caps at 3 even when count > 3', async () => {
    getMockCreate().mockResolvedValue(
      makeCompletion(JSON.stringify({ subject: 'S', body: 'B' }))
    );
    const results = await generateMessageVariations(context, 10);
    expect(results).toHaveLength(3);
  });

  it('returns fewer variations when some fail', async () => {
    getMockCreate()
      .mockResolvedValueOnce(makeCompletion(JSON.stringify({ subject: 'S', body: 'B' })))
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce(makeCompletion(JSON.stringify({ subject: 'S2', body: 'B2' })));
    const results = await generateMessageVariations(context, 3);
    expect(results).toHaveLength(2);
  });

  it('returns empty array when all fail', async () => {
    getMockCreate().mockRejectedValue(new Error('all fail'));
    const results = await generateMessageVariations(context, 3);
    expect(results).toHaveLength(0);
  });
});

// ─── improveMessage ───────────────────────────────────────────────────────────

describe('improveMessage', () => {
  const original = 'Please help us with our fundraiser.';

  it('returns improved message from AI', async () => {
    getMockCreate().mockResolvedValueOnce(makeCompletion('Improved message text'));
    const result = await improveMessage(original, context, 'clarity');
    expect(result).toBe('Improved message text');
  });

  it('returns original message when AI throws', async () => {
    getMockCreate().mockRejectedValueOnce(new Error('fail'));
    const result = await improveMessage(original, context, 'emotion');
    expect(result).toBe(original);
  });

  it('returns original message when content is null', async () => {
    getMockCreate().mockResolvedValueOnce({ choices: [{ message: { content: null } }] });
    const result = await improveMessage(original, context, 'brevity');
    expect(result).toBe(original);
  });

  it('includes improvement focus in prompt', async () => {
    getMockCreate().mockResolvedValueOnce(makeCompletion('ok'));
    await improveMessage(original, context, 'engagement');
    const prompt = getMockCreate().mock.calls[0][0].messages[1].content;
    expect(prompt).toContain('engagement');
  });

  it('includes original message in prompt', async () => {
    getMockCreate().mockResolvedValueOnce(makeCompletion('ok'));
    await improveMessage(original, context, 'clarity');
    const prompt = getMockCreate().mock.calls[0][0].messages[1].content;
    expect(prompt).toContain(original);
  });
});
