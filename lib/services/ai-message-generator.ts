import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface CampaignContext {
  campaignName: string;
  teamName: string;
  organizationName: string;
  description: string;
  goalAmount: number;
  currentAmount: number;
  playerName: string;
  playerPosition?: string;
  playerGrade?: string;
}

export interface MessageOptions {
  tone?: 'friendly' | 'professional' | 'enthusiastic' | 'heartfelt';
  length?: 'short' | 'medium' | 'long';
  includeStats?: boolean;
  includeCallToAction?: boolean;
  customInstructions?: string;
}

/**
 * Generate a personalized email message using AI
 */
export async function generateEmailMessage(
  context: CampaignContext,
  options: MessageOptions = {}
): Promise<{ subject: string; body: string }> {
  const {
    tone = 'friendly',
    length = 'medium',
    includeStats = true,
    includeCallToAction = true,
    customInstructions = ''
  } = options;

  const progress = ((context.currentAmount / context.goalAmount) * 100).toFixed(0);

  const prompt = `Generate a personalized fundraising email for the following campaign:

Campaign: ${context.campaignName}
Team: ${context.teamName}
Organization: ${context.organizationName}
Description: ${context.description}
Player: ${context.playerName}${context.playerPosition ? ` (${context.playerPosition})` : ''}${context.playerGrade ? ` - ${context.playerGrade}` : ''}

${includeStats ? `Fundraising Goal: $${context.goalAmount.toFixed(2)}
Current Amount: $${context.currentAmount.toFixed(2)} (${progress}% of goal)` : ''}

Requirements:
- Tone: ${tone}
- Length: ${length}
- ${includeCallToAction ? 'Include a clear call-to-action to donate' : 'No call-to-action needed'}
- Write from the perspective of ${context.playerName}
- Make it personal and authentic (like a kid would write it)
- Keep it age-appropriate and genuine
${customInstructions ? `- Additional instructions: ${customInstructions}` : ''}

Return the response in JSON format with "subject" and "body" fields.
The body should be plain text with line breaks for readability.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that generates authentic, heartfelt fundraising messages for youth sports and activities. Write messages that sound like they come from real kids, not marketing copy. Be genuine and personal.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.8,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('No content generated');
    }

    const result = JSON.parse(content);
    return {
      subject: result.subject || `Support ${context.playerName} - ${context.campaignName}`,
      body: result.body || 'Please support our fundraiser!'
    };
  } catch (error) {
    console.error('AI message generation error:', error);

    // Fallback message if AI fails
    return {
      subject: `Support ${context.playerName} - ${context.campaignName}`,
      body: `Hi!\n\nI'm ${context.playerName} and I'm raising money for ${context.campaignName}.\n\n${context.description}\n\n${includeStats ? `So far I've raised $${context.currentAmount.toFixed(2)} of my $${context.goalAmount.toFixed(2)} goal (${progress}%).` : ''}\n\n${includeCallToAction ? `Every donation helps and means so much to me and the team! Click the link below to support us.\n\nThank you! 🙏` : ''}`
    };
  }
}

/**
 * Generate a personalized SMS message using AI
 */
export async function generateSMSMessage(
  context: CampaignContext,
  options: MessageOptions = {}
): Promise<string> {
  const {
    tone = 'friendly',
    includeStats = false,
    customInstructions = ''
  } = options;

  const progress = ((context.currentAmount / context.goalAmount) * 100).toFixed(0);

  const prompt = `Generate a short SMS message (max 160 characters) for a fundraising campaign:

Campaign: ${context.campaignName}
Player: ${context.playerName}
${includeStats ? `Progress: $${context.currentAmount.toFixed(2)} of $${context.goalAmount.toFixed(2)} (${progress}%)` : ''}

Requirements:
- Tone: ${tone}
- Max 160 characters (SMS length)
- Include player name
- Personal and authentic
- Brief but engaging
${customInstructions ? `- ${customInstructions}` : ''}

Return only the SMS message text, no JSON.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that generates short, authentic SMS messages for youth fundraisers. Keep it brief and genuine.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 100,
      temperature: 0.8,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('No content generated');
    }

    // Trim to 160 characters if needed
    return content.trim().substring(0, 160);
  } catch (error) {
    console.error('AI SMS generation error:', error);

    // Fallback message
    return `Hi! It's ${context.playerName}. Please support my ${context.campaignName} fundraiser! Every donation helps! 🙏`;
  }
}

/**
 * Generate a video script for kids to record
 */
export async function generateVideoScript(
  context: CampaignContext,
  duration: number = 30 // seconds
): Promise<string> {
  const prompt = `Generate a short video script for a ${duration}-second fundraising video:

Campaign: ${context.campaignName}
Team: ${context.teamName}
Player: ${context.playerName}${context.playerPosition ? ` (${context.playerPosition})` : ''}
Description: ${context.description}
Goal: $${context.goalAmount.toFixed(2)}
Current: $${context.currentAmount.toFixed(2)}

Requirements:
- ${duration} seconds long (approximately ${Math.round(duration * 2.5)} words)
- Written for ${context.playerName} to read on camera
- Personal, authentic, and age-appropriate
- Include: who they are, what they're raising for, why it matters, and a call-to-action
- Conversational tone (like talking to a friend)
- Include stage directions in [brackets]

Format: Just the script with stage directions, no additional formatting.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that writes authentic video scripts for kids doing fundraising. Make it sound natural and conversational, not like a commercial.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.8,
    });

    const content = response.choices[0].message.content;
    return content || 'Hi! Please support my fundraiser. Thank you!';
  } catch (error) {
    console.error('AI video script generation error:', error);

    // Fallback script
    return `[Look at camera and smile]

Hi! I'm ${context.playerName} from ${context.teamName}.

[Speak enthusiastically]

We're raising money for ${context.campaignName}. ${context.description}

[Look sincere]

Your support would mean so much to me and the team. Every donation helps us reach our goal.

[Smile]

Thanks for watching, and I hope you'll consider supporting us!`;
  }
}

/**
 * Generate multiple message variations for A/B testing
 */
export async function generateMessageVariations(
  context: CampaignContext,
  count: number = 3
): Promise<Array<{ subject: string; body: string }>> {
  const tones: Array<MessageOptions['tone']> = ['friendly', 'enthusiastic', 'heartfelt'];
  const variations: Array<{ subject: string; body: string }> = [];

  for (let i = 0; i < Math.min(count, 3); i++) {
    try {
      const message = await generateEmailMessage(context, {
        tone: tones[i],
        length: 'medium',
        includeStats: true,
        includeCallToAction: true,
      });
      variations.push(message);
    } catch (error) {
      console.error(`Failed to generate variation ${i + 1}:`, error);
    }
  }

  return variations;
}

/**
 * Improve an existing message draft
 */
export async function improveMessage(
  originalMessage: string,
  context: CampaignContext,
  improvementFocus: 'clarity' | 'emotion' | 'brevity' | 'engagement'
): Promise<string> {
  const focusInstructions = {
    clarity: 'Make the message clearer and easier to understand',
    emotion: 'Make the message more emotionally compelling and heartfelt',
    brevity: 'Make the message more concise while keeping the key points',
    engagement: 'Make the message more engaging and likely to get a response'
  };

  const prompt = `Improve this fundraising message with focus on ${improvementFocus}:

Original message:
"${originalMessage}"

Context:
Campaign: ${context.campaignName}
Player: ${context.playerName}
Description: ${context.description}

Instructions:
- ${focusInstructions[improvementFocus]}
- Keep the authentic voice of a kid
- Maintain the personal connection
- Don't make it sound too polished or corporate

Return only the improved message text.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that improves fundraising messages while keeping them authentic and age-appropriate.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
    });

    const content = response.choices[0].message.content;
    return content || originalMessage;
  } catch (error) {
    console.error('Message improvement error:', error);
    return originalMessage;
  }
}
