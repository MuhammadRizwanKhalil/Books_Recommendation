/**
 * Webhooks Settings Page
 * Allows users to manage their outbound webhook endpoints.
 */

import { useState, useEffect } from 'react';
import { Webhook, Plus, Trash2, TestTube, Eye, EyeOff, Copy, ExternalLink } from 'lucide-react';
import { webhooksApi, type WebhookResponse, type WebhookDelivery } from '@/api/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAuth } from '@/components/AuthProvider';
import { toast } from 'sonner';

const AVAILABLE_EVENTS = [
  'book.created', 'book.updated', 'book.deleted',
  'review.created', 'review.approved',
  'author.created', 'author.updated',
  'list.created', 'list.updated',
  'progress.updated',
  'ping',
];

export function WebhooksPage() {
  const { user } = useAuth();
  const [webhooks, setWebhooks] = useState<WebhookResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newEvents, setNewEvents] = useState<string[]>(['book.created', 'review.created']);
  const [creating, setCreating] = useState(false);
  const [selectedWebhook, setSelectedWebhook] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [secret, setSecret] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadWebhooks();
  }, [user]);

  async function loadWebhooks() {
    setLoading(true);
    try {
      const data = await webhooksApi.list();
      setWebhooks(data.webhooks);
    } catch { }
    finally { setLoading(false); }
  }

  async function handleCreate() {
    if (!newName || !newUrl) { toast.error('Name and URL are required'); return; }
    setCreating(true);
    try {
      const result = await webhooksApi.create({ name: newName, url: newUrl, events: newEvents });
      toast.success('Webhook created!');
      setSecret(result.secret);
      setShowCreate(false);
      setNewName('');
      setNewUrl('');
      loadWebhooks();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create webhook');
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await webhooksApi.delete(id);
      toast.success('Webhook deleted');
      setWebhooks(webhooks.filter(w => w.id !== id));
    } catch {
      toast.error('Failed to delete');
    }
  }

  async function handleTest(id: string) {
    try {
      const result = await webhooksApi.test(id);
      if (result.success) toast.success(`Ping sent successfully (${result.durationMs}ms)`);
      else toast.error(`Ping failed: HTTP ${result.status}`);
    } catch {
      toast.error('Test failed');
    }
  }

  async function handleToggle(id: string, active: boolean) {
    try {
      await webhooksApi.update(id, { isActive: active });
      setWebhooks(webhooks.map(w => w.id === id ? { ...w, isActive: active } : w));
    } catch {
      toast.error('Failed to update');
    }
  }

  async function viewDeliveries(id: string) {
    setSelectedWebhook(id);
    try {
      const data = await webhooksApi.deliveries(id);
      setDeliveries(data.deliveries);
    } catch { }
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <Webhook className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <h1 className="text-3xl font-bold mb-2">Webhooks</h1>
        <p className="text-muted-foreground">Sign in to manage webhook integrations.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Webhook className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Webhooks</h1>
            <p className="text-sm text-muted-foreground">Receive real-time notifications when events happen.</p>
          </div>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> New Webhook</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Webhook</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Name</Label>
                <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="My Integration" />
              </div>
              <div>
                <Label>Endpoint URL</Label>
                <Input value={newUrl} onChange={e => setNewUrl(e.target.value)} placeholder="https://example.com/webhooks" />
              </div>
              <div>
                <Label className="mb-2 block">Events</Label>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_EVENTS.map(evt => (
                    <Badge
                      key={evt}
                      variant={newEvents.includes(evt) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => setNewEvents(
                        newEvents.includes(evt)
                          ? newEvents.filter(e => e !== evt)
                          : [...newEvents, evt]
                      )}
                    >
                      {evt}
                    </Badge>
                  ))}
                </div>
              </div>
              <Button onClick={handleCreate} disabled={creating} className="w-full">
                {creating ? 'Creating...' : 'Create Webhook'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Show secret after creation */}
      {secret && (
        <Card className="mb-6 border-yellow-400 bg-yellow-50 dark:bg-yellow-950">
          <CardContent className="pt-4">
            <p className="text-sm font-medium mb-2">Webhook Secret (save this now — it won't be shown again):</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-background p-2 rounded border overflow-x-auto">
                {showSecret ? secret : '•'.repeat(32)}
              </code>
              <Button size="icon" variant="ghost" onClick={() => setShowSecret(!showSecret)}>
                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button size="icon" variant="ghost" onClick={() => { navigator.clipboard.writeText(secret); toast.success('Copied!'); }}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <Button variant="link" size="sm" className="mt-2 p-0" onClick={() => setSecret(null)}>Dismiss</Button>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <p className="text-muted-foreground text-center py-8">Loading webhooks...</p>
      ) : webhooks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Webhook className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No webhooks configured yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {webhooks.map(wh => (
            <Card key={wh.id}>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{wh.name}</h3>
                    <Badge variant={wh.isActive ? 'default' : 'secondary'}>
                      {wh.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                    {wh.failureCount > 0 && (
                      <Badge variant="destructive">{wh.failureCount} failures</Badge>
                    )}
                  </div>
                  <Switch checked={wh.isActive} onCheckedChange={v => handleToggle(wh.id, v)} />
                </div>
                <p className="text-sm text-muted-foreground flex items-center gap-1 mb-2">
                  <ExternalLink className="h-3 w-3" /> {wh.url}
                </p>
                <div className="flex flex-wrap gap-1 mb-3">
                  {wh.events.map(e => <Badge key={e} variant="outline" className="text-xs">{e}</Badge>)}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleTest(wh.id)}>
                    <TestTube className="h-3 w-3 mr-1" /> Test
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => viewDeliveries(wh.id)}>
                    Deliveries
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => handleDelete(wh.id)}>
                    <Trash2 className="h-3 w-3 mr-1" /> Delete
                  </Button>
                </div>

                {/* Delivery log */}
                {selectedWebhook === wh.id && deliveries.length > 0 && (
                  <div className="mt-4 border-t pt-4">
                    <h4 className="text-sm font-medium mb-2">Recent Deliveries</h4>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {deliveries.map(d => (
                        <div key={d.id} className="flex items-center justify-between text-xs py-1">
                          <span>{d.eventType}</span>
                          <div className="flex items-center gap-2">
                            <Badge variant={d.status === 'success' ? 'default' : 'destructive'} className="text-xs">
                              {d.responseStatus || 'timeout'} · {d.durationMs}ms
                            </Badge>
                            <span className="text-muted-foreground">{new Date(d.createdAt).toLocaleString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
