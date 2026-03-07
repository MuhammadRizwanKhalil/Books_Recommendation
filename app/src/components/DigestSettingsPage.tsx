/**
 * Email Digest Settings Page
 * Allows users to configure their personalized email digest.
 */

import { useState, useEffect } from 'react';
import { Mail, Send, Clock, History } from 'lucide-react';
import { emailDigestApi, type DigestPreferences } from '@/api/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/components/AuthProvider';
import { toast } from 'sonner';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function DigestSettingsPage() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<DigestPreferences | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      emailDigestApi.getPreferences().then(d => setPrefs(d.preferences)),
      emailDigestApi.history().then(d => setHistory(d.history)),
    ])
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  async function handleSave() {
    if (!prefs) return;
    setSaving(true);
    try {
      await emailDigestApi.updatePreferences(prefs);
      toast.success('Digest preferences saved!');
    } catch {
      toast.error('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  }

  async function handleSendTest() {
    setSending(true);
    try {
      const result = await emailDigestApi.sendTest();
      if (result.success) toast.success('Test digest sent to your email!');
      else toast.error(result.message || 'Failed to send test');
    } catch {
      toast.error('Failed to send test digest');
    } finally {
      setSending(false);
    }
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <Mail className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <h1 className="text-3xl font-bold mb-2">Email Digest Settings</h1>
        <p className="text-muted-foreground">Sign in to configure your personalized email digest.</p>
      </div>
    );
  }

  if (loading || !prefs) {
    return <div className="container mx-auto px-4 py-12 text-center text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Mail className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Email Digest</h1>
          <p className="text-sm text-muted-foreground">Get personalized book recommendations in your inbox.</p>
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" /> Schedule
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="digest-enabled">Enable email digest</Label>
            <Switch
              id="digest-enabled"
              checked={prefs.enabled}
              onCheckedChange={v => setPrefs({ ...prefs, enabled: v })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm">Frequency</Label>
              <Select
                value={prefs.frequency}
                onValueChange={v => setPrefs({ ...prefs, frequency: v as any })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {prefs.frequency === 'weekly' && (
              <div>
                <Label className="text-sm">Preferred Day</Label>
                <Select
                  value={String(prefs.preferredDay)}
                  onValueChange={v => setPrefs({ ...prefs, preferredDay: parseInt(v) })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DAYS.map((day, i) => (
                      <SelectItem key={i} value={String(i)}>{day}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div>
            <Label className="text-sm">Preferred Time (UTC)</Label>
            <Select
              value={String(prefs.preferredHour)}
              onValueChange={v => setPrefs({ ...prefs, preferredHour: parseInt(v) })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: 24 }, (_, h) => (
                  <SelectItem key={h} value={String(h)}>
                    {h.toString().padStart(2, '0')}:00 UTC
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Content Preferences</CardTitle>
          <CardDescription>Choose what to include in your digest.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { key: 'includeNewReleases', label: 'New Releases' },
            { key: 'includeTrending', label: 'Trending Books' },
            { key: 'includeFollowedAuthors', label: 'From Authors I Follow' },
            { key: 'includeReadingProgress', label: 'Reading Progress Summary' },
            { key: 'includeRecommendations', label: 'Personalized Recommendations' },
          ].map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between">
              <Label>{label}</Label>
              <Switch
                checked={(prefs as any)[key]}
                onCheckedChange={v => setPrefs({ ...prefs, [key]: v })}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex gap-3 mb-8">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Preferences'}
        </Button>
        <Button variant="outline" onClick={handleSendTest} disabled={sending}>
          <Send className="h-4 w-4 mr-2" />
          {sending ? 'Sending...' : 'Send Test Digest'}
        </Button>
      </div>

      {/* Digest History */}
      {history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <History className="h-5 w-5" /> Digest History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {history.map(h => (
                <div key={h.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <span className="text-sm">{new Date(h.sentAt).toLocaleDateString()}</span>
                    <span className="text-xs text-muted-foreground ml-2">{h.bookCount} books</span>
                  </div>
                  <Badge variant={h.status === 'sent' ? 'default' : 'destructive'}>{h.status}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
