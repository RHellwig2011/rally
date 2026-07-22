'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useCsrfToken } from '@/hooks/useCsrfToken';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
// TODO: Install tabs component - temporarily commented out for Week 1 build
// import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Loader2,
  Mail,
  Phone,
  Send,
  Sparkles,
  Video,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Users
} from 'lucide-react';

interface Recipient {
  name: string;
  email: string;
  phone: string;
}

export default function PlayerOutreachPage() {
  const params = useParams();
  const router = useRouter();
  const { csrfToken } = useCsrfToken();
  const teamMemberId = params?.teamMemberId as string;

  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [campaignId, setCampaignId] = useState('');

  useEffect(() => {
    if (!teamMemberId) return;
    (async () => {
      try {
        const response = await fetch(`/api/team-members/${teamMemberId}/public`);
        const data = await response.json();
        if (data.campaign?.id) {
          setCampaignId(data.campaign.id);
        }
      } catch {
        // Message generation stays disabled without a campaign id
      }
    })();
  }, [teamMemberId]);

  // Message form
  const [messageType, setMessageType] = useState<'email' | 'sms' | 'both'>('email');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [videoUrl, setVideoUrl] = useState('');

  // Recipients
  const [recipients, setRecipients] = useState<Recipient[]>([
    { name: '', email: '', phone: '' }
  ]);

  // AI generation options
  const [tone, setTone] = useState<'friendly' | 'enthusiastic' | 'heartfelt'>('friendly');

  const addRecipient = () => {
    setRecipients([...recipients, { name: '', email: '', phone: '' }]);
  };

  const removeRecipient = (index: number) => {
    setRecipients(recipients.filter((_, i) => i !== index));
  };

  const updateRecipient = (index: number, field: keyof Recipient, value: string) => {
    const updated = [...recipients];
    updated[index][field] = value;
    setRecipients(updated);
  };

  const generateMessage = async (type: 'email' | 'sms') => {
    if (!campaignId) {
      setError('Campaign information is still loading. Please try again in a moment.');
      return;
    }

    setGenerating(true);
    setError('');

    try {
      const response = await fetch(`/api/campaigns/${campaignId}/generate-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({
          type,
          teamMemberId,
          tone,
          length: 'medium',
          includeStats: true,
          includeCallToAction: true,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate message');
      }

      const data = await response.json();

      if (type === 'email') {
        setSubject(data.message.subject);
        setMessage(data.message.body);
      } else {
        setMessage(data.message);
      }

    } catch (err) {
      setError('Failed to generate message. Please try writing it yourself!');
    } finally {
      setGenerating(false);
    }
  };

  const generateVideoScript = async () => {
    if (!campaignId) {
      setError('Campaign information is still loading. Please try again in a moment.');
      return;
    }

    setGenerating(true);
    setError('');

    try {
      const response = await fetch(`/api/campaigns/${campaignId}/generate-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({
          type: 'video',
          teamMemberId,
          videoDuration: 30,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate script');
      }

      const data = await response.json();
      alert(`Video Script (30 seconds):\n\n${data.script}\n\nNow record yourself saying this and upload the video!`);

    } catch (err) {
      setError('Failed to generate video script');
    } finally {
      setGenerating(false);
    }
  };

  const sendMessages = async () => {
    setSending(true);
    setError('');
    setSuccess(false);

    // Validate
    if (!message) {
      setError('Please write a message');
      setSending(false);
      return;
    }

    const validRecipients = recipients.filter(r => {
      if (messageType === 'email' || messageType === 'both') {
        if (!r.email) return false;
      }
      if (messageType === 'sms' || messageType === 'both') {
        if (!r.phone) return false;
      }
      return true;
    });

    if (validRecipients.length === 0) {
      setError('Please add at least one valid recipient');
      setSending(false);
      return;
    }

    try {
      const response = await fetch(`/api/team-members/${teamMemberId}/send-outreach`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({
          type: messageType,
          recipients: validRecipients,
          subject,
          message,
          videoUrl: videoUrl || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to send messages');
      }

      const data = await response.json();
      setSuccess(true);

      // Show summary
      const emailSent = data.summary.email.sent;
      const smsSent = data.summary.sms.sent;
      const total = emailSent + smsSent;

      alert(`Success! Sent ${total} messages:\n${emailSent > 0 ? `- ${emailSent} emails\n` : ''}${smsSent > 0 ? `- ${smsSent} SMS messages` : ''}`);

      // Reset form
      setMessage('');
      setSubject('');
      setVideoUrl('');
      setRecipients([{ name: '', email: '', phone: '' }]);

    } catch (err: any) {
      setError(err.message || 'Failed to send messages');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center justify-center gap-2">
            <Send className="h-8 w-8 text-primary-600" />
            Share Your Fundraiser
          </h1>
          <p className="text-lg text-muted-foreground">
            Send personalized messages to friends and family
          </p>
        </div>

        {success && (
          <Alert className="mb-6 bg-success-light border-success">
            <CheckCircle2 className="h-4 w-4 text-success" />
            <AlertDescription className="text-success-dark">
              Your messages were sent successfully! Keep sharing to reach your goal.
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Message Type Selection */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary-600" />
              Step 1: Choose How to Send
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Button
                variant={messageType === 'email' ? 'default' : 'outline'}
                onClick={() => setMessageType('email')}
                className="flex-1"
              >
                <Mail className="mr-2 h-4 w-4" />
                Email Only
              </Button>
              <Button
                variant={messageType === 'sms' ? 'default' : 'outline'}
                onClick={() => setMessageType('sms')}
                className="flex-1"
              >
                <Phone className="mr-2 h-4 w-4" />
                SMS Only
              </Button>
              <Button
                variant={messageType === 'both' ? 'default' : 'outline'}
                onClick={() => setMessageType('both')}
                className="flex-1"
              >
                <Send className="mr-2 h-4 w-4" />
                Both
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Message Composer */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-primary-600" />
                Step 2: Create Your Message
              </span>
              <div className="flex gap-2">
                <select
                  value={tone}
                  onChange={(e) => setTone(e.target.value as any)}
                  className="text-sm border rounded-md px-3 py-1"
                >
                  <option value="friendly">Friendly</option>
                  <option value="enthusiastic">Enthusiastic</option>
                  <option value="heartfelt">Heartfelt</option>
                </select>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => generateMessage(messageType === 'sms' ? 'sms' : 'email')}
                  disabled={generating}
                >
                  {generating ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating...</>
                  ) : (
                    <><Sparkles className="mr-2 h-4 w-4" />AI Generate</>
                  )}
                </Button>
              </div>
            </CardTitle>
            <CardDescription>
              Use AI to write your message or write it yourself
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(messageType === 'email' || messageType === 'both') && (
              <div>
                <Label htmlFor="subject">Email Subject</Label>
                <Input
                  id="subject"
                  placeholder="Please support my fundraiser!"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="mt-1"
                />
              </div>
            )}

            <div>
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                rows={messageType === 'sms' ? 4 : 8}
                placeholder="Hi {name}! I'm raising money for..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="mt-1"
                maxLength={messageType === 'sms' ? 160 : undefined}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Use {'{name}'} to personalize each message
                {messageType === 'sms' && ` • ${message.length}/160 characters`}
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label htmlFor="videoUrl">Add Video (Optional)</Label>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={generateVideoScript}
                  disabled={generating}
                >
                  <Video className="mr-2 h-4 w-4" />
                  Get Script
                </Button>
              </div>
              <Input
                id="videoUrl"
                type="url"
                placeholder="https://your-video-url.mp4"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Record a video message and paste the URL here (works in email & MMS)
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Recipients */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary-600" />
              Step 3: Add Recipients
            </CardTitle>
            <CardDescription>
              Add friends and family to send your message to
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {recipients.map((recipient, index) => (
              <div key={index} className="flex gap-3 items-start">
                <div className="flex-1 grid grid-cols-3 gap-2">
                  <Input
                    placeholder="Name"
                    value={recipient.name}
                    onChange={(e) => updateRecipient(index, 'name', e.target.value)}
                  />
                  <Input
                    type="email"
                    placeholder="Email"
                    value={recipient.email}
                    onChange={(e) => updateRecipient(index, 'email', e.target.value)}
                    disabled={messageType === 'sms'}
                  />
                  <Input
                    type="tel"
                    placeholder="Phone"
                    value={recipient.phone}
                    onChange={(e) => updateRecipient(index, 'phone', e.target.value)}
                    disabled={messageType === 'email'}
                  />
                </div>
                {recipients.length > 1 && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => removeRecipient(index)}
                  >
                    <Trash2 className="h-4 w-4 text-warning" />
                  </Button>
                )}
              </div>
            ))}

            <Button
              variant="outline"
              onClick={addRecipient}
              className="w-full"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Another Recipient
            </Button>
          </CardContent>
        </Card>

        {/* Send Button */}
        <Button
          onClick={sendMessages}
          disabled={sending}
          className="w-full bg-primary-600 hover:bg-primary-700 h-12 text-lg"
          size="lg"
        >
          {sending ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Send className="mr-2 h-5 w-5" />
              Send Messages
            </>
          )}
        </Button>

        <p className="text-center text-sm text-muted-foreground mt-4">
          Your fundraising link will be automatically included in each message
        </p>
      </div>
    </div>
  );
}
