import { useEffect, useState } from 'react';
import {
  Sparkles, Send, Loader2, Wand2,
  RefreshCw, Copy, ChevronLeft, Eye,
  Zap, Users, FileText,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { campaignsApi, adminApi } from '@/api/client';
import { sanitizeHtml } from '@/lib/utils';

type ViewMode = 'generate' | 'preview' | 'templates';

const PROMPT_SUGGESTIONS = [
  { label: '📚 New Releases', prompt: 'Share our latest new book releases and arrivals with subscribers' },
  { label: '⭐ Top Rated', prompt: 'Highlight our top rated and most popular books this month' },
  { label: '📖 Weekly Digest', prompt: 'Create a weekly reading digest with new books and top picks' },
  { label: '🎄 Holiday Guide', prompt: 'Holiday reading gift guide with top book recommendations' },
  { label: '🔥 Special Offers', prompt: 'Announce special book deals and exclusive offers for subscribers' },
  { label: '🌟 Community Picks', prompt: 'Share the most beloved books picked by our reading community' },
];

const TONE_OPTIONS = [
  { value: 'friendly', label: '😊 Friendly' },
  { value: 'professional', label: '💼 Professional' },
  { value: 'casual', label: '🎉 Casual' },
  { value: 'enthusiastic', label: '🤩 Enthusiastic' },
  { value: 'warm', label: '☕ Warm' },
];

export function AdminEmailMarketing() {
  const [viewMode, setViewMode] = useState<ViewMode>('generate');
  const [prompt, setPrompt] = useState('');
  const [tone, setTone] = useState('friendly');
  const [campaignType, setCampaignType] = useState('newsletter');
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);

  // Generated content
  const [generatedSubject, setGeneratedSubject] = useState('');
  const [generatedHtml, setGeneratedHtml] = useState('');
  const [campaignName, setCampaignName] = useState('');

  // Templates
  const [templates, setTemplates] = useState<any[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  // Stats
  const [subscriberCount, setSubscriberCount] = useState(0);

  useEffect(() => {
    // Load subscriber count
    adminApi.newsletter(1).then(res => {
      setSubscriberCount(res.pagination?.total || 0);
    }).catch(() => {});
  }, []);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error('Please enter a prompt');
      return;
    }

    setGenerating(true);
    try {
      const res = await campaignsApi.aiGenerate(prompt, campaignType, tone);
      setGeneratedSubject(res.subject);
      setGeneratedHtml(res.html_content);
      setCampaignName(`AI: ${prompt.slice(0, 50)}`);
      setViewMode('preview');
      toast.success('Email content generated!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate email');
    } finally {
      setGenerating(false);
    }
  };

  const handleCreateAndSend = async () => {
    if (!generatedSubject || !generatedHtml) {
      toast.error('No content to send');
      return;
    }

    setSending(true);
    try {
      // Create campaign
      const campaign = await campaignsApi.create({
        name: campaignName || `AI Campaign - ${new Date().toLocaleDateString()}`,
        subject: generatedSubject,
        html_content: generatedHtml,
        campaign_type: 'ai_generated',
        target_audience: 'all_subscribers',
      } as any);

      // Send it
      const res = await campaignsApi.send(campaign.id);
      toast.success(`Campaign created and sending to ${res.totalRecipients} subscribers!`);

      // Reset
      setViewMode('generate');
      setPrompt('');
      setGeneratedSubject('');
      setGeneratedHtml('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to send campaign');
    } finally {
      setSending(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!generatedSubject || !generatedHtml) {
      toast.error('No content to save');
      return;
    }

    try {
      await campaignsApi.create({
        name: campaignName || `AI Draft - ${new Date().toLocaleDateString()}`,
        subject: generatedSubject,
        html_content: generatedHtml,
        campaign_type: 'ai_generated',
        target_audience: 'all_subscribers',
      } as any);
      toast.success('Campaign saved as draft');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save draft');
    }
  };

  const handleSaveAsTemplate = async () => {
    if (!generatedSubject || !generatedHtml) return;
    try {
      await campaignsApi.createTemplate({
        name: campaignName || 'AI Generated Template',
        subject: generatedSubject,
        html_content: generatedHtml,
        template_type: 'ai_generated',
      });
      toast.success('Template saved');
    } catch (err: any) {
      toast.error('Failed to save template');
    }
  };

  const loadTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const res = await campaignsApi.templates();
      setTemplates(res.templates);
    } catch {
      toast.error('Failed to load templates');
    } finally {
      setLoadingTemplates(false);
    }
  };

  const useTemplate = (t: any) => {
    setGeneratedSubject(t.subject);
    setGeneratedHtml(t.html_content);
    setCampaignName(t.name);
    setViewMode('preview');
  };

  // ── Generate View ─────────────────────────────────────────────────────
  if (viewMode === 'generate') {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
              <Sparkles className="h-7 w-7 sm:h-8 sm:w-8 text-amber-500" />
              AI Email Marketing
            </h1>
            <p className="text-muted-foreground text-sm">Generate intelligent email campaigns with AI and send to your subscribers</p>
          </div>
          <Button variant="outline" onClick={() => { loadTemplates(); setViewMode('templates'); }}>
            <FileText className="h-4 w-4 mr-2" /> Templates
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Users className="h-8 w-8 text-purple-500" />
              <div>
                <p className="text-sm text-muted-foreground">Active Subscribers</p>
                <p className="text-2xl font-bold">{subscriberCount}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Zap className="h-8 w-8 text-amber-500" />
              <div>
                <p className="text-sm text-muted-foreground">AI Engine</p>
                <p className="text-2xl font-bold">Built-in</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Sparkles className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Smart Features</p>
                <p className="text-2xl font-bold">Book Data</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Prompt area */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-amber-500" /> Generate Email Content
            </CardTitle>
            <CardDescription>Describe what you want in your email campaign and AI will create it</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Quick prompts */}
            <div>
              <Label className="text-sm text-muted-foreground mb-2 block">Quick Prompts</Label>
              <div className="flex flex-wrap gap-2">
                {PROMPT_SUGGESTIONS.map((s) => (
                  <Button
                    key={s.label}
                    variant={prompt === s.prompt ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPrompt(s.prompt)}
                  >
                    {s.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Prompt input */}
            <div className="space-y-2">
              <Label>Your Prompt *</Label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe the email you want to send... e.g. 'Create a weekly newsletter featuring our top 5 new releases and encourage readers to explore our book recommendations'"
                rows={4}
              />
            </div>

            {/* Settings */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Campaign Type</Label>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={campaignType}
                  onChange={(e) => setCampaignType(e.target.value)}
                  title="Campaign Type"
                >
                  <option value="newsletter">Newsletter</option>
                  <option value="digest">Weekly Digest</option>
                  <option value="promotional">Promotional</option>
                  <option value="announcement">Announcement</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Tone</Label>
                <div className="flex flex-wrap gap-2">
                  {TONE_OPTIONS.map((t) => (
                    <Button
                      key={t.value}
                      variant={tone === t.value ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTone(t.value)}
                    >
                      {t.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            <Separator />

            <Button onClick={handleGenerate} disabled={generating || !prompt.trim()} size="lg" className="w-full">
              {generating ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Generating Email Content...
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5 mr-2" />
                  Generate Email with AI
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Preview View ──────────────────────────────────────────────────────
  if (viewMode === 'preview') {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <Button variant="ghost" size="icon" className="self-start" onClick={() => setViewMode('generate')}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
              <Eye className="h-6 w-6 sm:h-7 sm:w-7 text-blue-500" />
              Preview & Send
            </h1>
            <p className="text-muted-foreground text-sm">Review the AI-generated email and send to {subscriberCount} subscribers</p>
          </div>
        </div>

        {/* Edit fields */}
        <Card>
          <CardHeader>
            <CardTitle>Campaign Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Campaign Name</Label>
              <Input
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="Campaign name for internal reference"
              />
            </div>
            <div className="space-y-2">
              <Label>Email Subject</Label>
              <Input
                value={generatedSubject}
                onChange={(e) => setGeneratedSubject(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Content preview */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle>Email Content</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setViewMode('generate')}>
                  <RefreshCw className="h-4 w-4 mr-2" /> Regenerate
                </Button>
                <Button variant="outline" size="sm" onClick={handleSaveAsTemplate}>
                  <Copy className="h-4 w-4 mr-2" /> Save as Template
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* HTML Editor */}
            <Textarea
              value={generatedHtml}
              onChange={(e) => setGeneratedHtml(e.target.value)}
              rows={12}
              className="font-mono text-xs mb-4"
            />

            {/* Visual Preview */}
            <div className="border rounded-lg bg-white">
              <div className="bg-muted px-4 py-2 text-xs text-muted-foreground border-b flex items-center gap-2">
                <Eye className="h-3 w-3" /> Email Preview
              </div>
              <div
                className="p-6 text-sm"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(generatedHtml) }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Users className="h-4 w-4 shrink-0" />
                <span>This campaign will be sent to <strong className="text-foreground">{subscriberCount}</strong> active subscribers</span>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" size="sm" onClick={handleSaveDraft}>
                  <FileText className="h-4 w-4 mr-2" /> Save Draft
                </Button>
                <Button onClick={handleCreateAndSend} disabled={sending} size="lg">
                  {sending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" /> Create & Send Campaign
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Templates View ────────────────────────────────────────────────────
  if (viewMode === 'templates') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setViewMode('generate')}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl sm:text-3xl font-bold">Email Templates</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" /> Saved Templates
            </CardTitle>
            <CardDescription>Reuse previously generated or saved email templates</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingTemplates ? (
              <div className="text-center py-8">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
              </div>
            ) : templates.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No templates saved yet</p>
                <p className="text-sm">Generate an email and save it as a template to reuse later.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {templates.map((t: any) => (
                  <div key={t.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border rounded-lg hover:bg-muted/50">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{t.name}</p>
                      <p className="text-sm text-muted-foreground">{t.subject}</p>
                      <div className="flex gap-2 mt-1">
                        <Badge variant="outline">{t.template_type}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(t.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => useTemplate(t)}>
                        Use Template
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={async () => {
                          await campaignsApi.deleteTemplate(t.id);
                          loadTemplates();
                          toast.success('Template deleted');
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}
