import { useEffect, useState, useCallback } from 'react';
import {
  Send, Plus, Trash2, Edit, Eye, Loader2, Mail,
  Users, CheckCircle, Clock, ChevronLeft,
  ChevronRight, TestTube,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { campaignsApi, type CampaignResponse } from '@/api/client';
import { sanitizeHtml } from '@/lib/utils';

type ViewMode = 'list' | 'create' | 'edit' | 'detail';

const STATUS_BADGES: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
  draft: { variant: 'secondary', label: 'Draft' },
  scheduled: { variant: 'outline', label: 'Scheduled' },
  sending: { variant: 'default', label: 'Sending...' },
  sent: { variant: 'default', label: 'Sent' },
  failed: { variant: 'destructive', label: 'Failed' },
  cancelled: { variant: 'secondary', label: 'Cancelled' },
};

export function AdminCampaigns() {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [campaigns, setCampaigns] = useState<CampaignResponse[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignResponse | null>(null);
  const [recipientStats, setRecipientStats] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const limit = 20;

  // Form state
  const [form, setForm] = useState({
    name: '',
    subject: '',
    preview_text: '',
    html_content: '',
    target_audience: 'all_subscribers',
  });

  const loadCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await campaignsApi.list(page);
      setCampaigns(res.campaigns);
      setTotal(res.pagination?.total || 0);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { loadCampaigns(); }, [loadCampaigns]);

  const resetForm = () => {
    setForm({ name: '', subject: '', preview_text: '', html_content: '', target_audience: 'all_subscribers' });
  };

  const handleCreate = async () => {
    if (!form.name || !form.subject) {
      toast.error('Name and subject are required');
      return;
    }
    try {
      await campaignsApi.create(form as any);
      toast.success('Campaign created');
      setViewMode('list');
      resetForm();
      loadCampaigns();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create');
    }
  };

  const handleUpdate = async () => {
    if (!selectedCampaign) return;
    try {
      await campaignsApi.update(selectedCampaign.id, form as any);
      toast.success('Campaign updated');
      setViewMode('list');
      resetForm();
      loadCampaigns();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this campaign? This cannot be undone.')) return;
    try {
      await campaignsApi.delete(id);
      toast.success('Campaign deleted');
      loadCampaigns();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete');
    }
  };

  const handleSend = async (id: string) => {
    if (!confirm('Send this campaign to all subscribers? This cannot be undone.')) return;
    setSending(true);
    try {
      const res = await campaignsApi.send(id);
      toast.success(`Sending to ${res.totalRecipients} subscribers`);
      loadCampaigns();
    } catch (err: any) {
      toast.error(err.message || 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  const handleSendTest = async (id: string) => {
    try {
      const res = await campaignsApi.sendTest(id);
      if (res.success) {
        toast.success(`Test email sent to ${res.email}`);
      } else {
        toast.error('Test email failed');
      }
    } catch (err: any) {
      toast.error(err.message || 'Test email failed');
    }
  };

  const openEdit = (c: CampaignResponse) => {
    setSelectedCampaign(c);
    setForm({
      name: c.name,
      subject: c.subject,
      preview_text: c.preview_text || '',
      html_content: c.html_content,
      target_audience: c.target_audience,
    });
    setViewMode('edit');
  };

  const openDetail = async (c: CampaignResponse) => {
    try {
      const res = await campaignsApi.get(c.id);
      setSelectedCampaign(res.campaign);
      setRecipientStats(res.recipientStats);
      setViewMode('detail');
    } catch {
      toast.error('Failed to load campaign details');
    }
  };

  const totalPages = Math.ceil(total / limit);

  // ── List View ───────────────────────────────────────────────────────────
  if (viewMode === 'list') {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Email Campaigns</h1>
            <p className="text-muted-foreground text-sm">Create, manage, and send email campaigns to subscribers</p>
          </div>
          <Button onClick={() => { resetForm(); setViewMode('create'); }}>
            <Plus className="h-4 w-4 mr-2" /> New Campaign
          </Button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Mail className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Campaigns</p>
                <p className="text-2xl font-bold">{total}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <CheckCircle className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Sent</p>
                <p className="text-2xl font-bold">{campaigns.filter(c => c.status === 'sent').length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Clock className="h-8 w-8 text-amber-500" />
              <div>
                <p className="text-sm text-muted-foreground">Drafts</p>
                <p className="text-2xl font-bold">{campaigns.filter(c => c.status === 'draft').length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Users className="h-8 w-8 text-purple-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Sent</p>
                <p className="text-2xl font-bold">{campaigns.reduce((sum, c) => sum + c.sent_count, 0)}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Campaigns table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Mail className="h-5 w-5" /> Campaigns
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="animate-pulse h-12 bg-muted rounded" />
                ))}
              </div>
            ) : campaigns.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Mail className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-lg font-medium">No campaigns yet</p>
                <p className="text-sm">Create your first email campaign to get started.</p>
                <Button className="mt-4" onClick={() => { resetForm(); setViewMode('create'); }}>
                  <Plus className="h-4 w-4 mr-2" /> Create Campaign
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div className="min-w-[700px] space-y-2 hidden sm:block">
                <div className="grid grid-cols-12 gap-3 text-xs font-medium text-muted-foreground px-3 py-2">
                  <div className="col-span-3">Name</div>
                  <div className="col-span-3">Subject</div>
                  <div className="col-span-1">Status</div>
                  <div className="col-span-1">Type</div>
                  <div className="col-span-1">Recipients</div>
                  <div className="col-span-1">Sent</div>
                  <div className="col-span-2 text-right">Actions</div>
                </div>
                <Separator />
                {campaigns.map((c) => {
                  const sb = STATUS_BADGES[c.status] || { variant: 'secondary' as const, label: c.status };
                  return (
                    <div key={c.id} className="grid grid-cols-12 gap-3 items-center px-3 py-3 hover:bg-muted/50 rounded-md">
                      <div className="col-span-3">
                        <p className="font-medium text-sm truncate">{c.name}</p>
                        <p className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</p>
                      </div>
                      <div className="col-span-3 text-sm truncate">{c.subject}</div>
                      <div className="col-span-1">
                        <Badge variant={sb.variant}>{sb.label}</Badge>
                      </div>
                      <div className="col-span-1">
                        <Badge variant="outline" className="text-xs">{c.campaign_type}</Badge>
                      </div>
                      <div className="col-span-1 text-sm">{c.total_recipients}</div>
                      <div className="col-span-1 text-sm">{c.sent_count}</div>
                      <div className="col-span-2 flex gap-1 justify-end">
                        <Button variant="ghost" size="icon" onClick={() => openDetail(c)} title="View">
                          <Eye className="h-4 w-4" />
                        </Button>
                        {c.status === 'draft' && (
                          <>
                            <Button variant="ghost" size="icon" onClick={() => openEdit(c)} title="Edit">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleSend(c.id)} disabled={sending} title="Send">
                              <Send className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {c.status !== 'sending' && (
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)} className="text-destructive" title="Delete">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

                {/* Mobile card layout */}
                <div className="sm:hidden space-y-3">
                  {campaigns.map((c) => {
                    const sb = STATUS_BADGES[c.status] || { variant: 'secondary' as const, label: c.status };
                    return (
                      <Card key={c.id} className="p-4">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{c.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{c.subject}</p>
                          </div>
                          <Badge variant={sb.variant} className="shrink-0">{sb.label}</Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mb-3">
                          <Badge variant="outline" className="text-xs">{c.campaign_type}</Badge>
                          <span>{c.total_recipients} recipients</span>
                          <span>{c.sent_count} sent</span>
                          <span>{new Date(c.created_at).toLocaleDateString()}</span>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openDetail(c)}>View</Button>
                          {c.status === 'draft' && (
                            <>
                              <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>Edit</Button>
                              <Button variant="ghost" size="sm" onClick={() => handleSend(c.id)} disabled={sending}>Send</Button>
                            </>
                          )}
                          {c.status !== 'sending' && (
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(c.id)} className="text-destructive ml-auto">Delete</Button>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <p className="text-sm text-muted-foreground">{total} campaigns total</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm py-1 px-2">{page} / {totalPages}</span>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Create / Edit View ──────────────────────────────────────────────────
  if (viewMode === 'create' || viewMode === 'edit') {
    const isEdit = viewMode === 'edit';
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="ghost" size="icon" onClick={() => { setViewMode('list'); resetForm(); }}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl sm:text-3xl font-bold">{isEdit ? 'Edit Campaign' : 'New Campaign'}</h1>
        </div>

        <Card>
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Campaign Name *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. January Newsletter"
                />
              </div>
              <div className="space-y-2">
                <Label>Target Audience</Label>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.target_audience}
                  onChange={(e) => setForm({ ...form, target_audience: e.target.value })}
                  title="Target Audience"
                >
                  <option value="all_subscribers">All Subscribers</option>
                  <option value="active_only">Active Only (last 90 days)</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Email Subject *</Label>
              <Input
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                placeholder="e.g. 📚 This Week's Top Book Picks"
              />
            </div>

            <div className="space-y-2">
              <Label>Preview Text</Label>
              <Input
                value={form.preview_text}
                onChange={(e) => setForm({ ...form, preview_text: e.target.value })}
                placeholder="Short text shown in email preview"
              />
            </div>

            <div className="space-y-2">
              <Label>Email Content (HTML)</Label>
              <p className="text-xs text-muted-foreground">
                Available variables: {'{{subscriber_name}}'}, {'{{subscriber_email}}'}, {'{{unsubscribe_url}}'}, {'{{site_url}}'}
              </p>
              <Textarea
                value={form.html_content}
                onChange={(e) => setForm({ ...form, html_content: e.target.value })}
                placeholder="<h2>Hello {{subscriber_name}}!</h2><p>Your email content here...</p>"
                rows={15}
                className="font-mono text-xs"
              />
            </div>

            <Separator />

            <div className="flex gap-3">
              <Button onClick={isEdit ? handleUpdate : handleCreate}>
                {isEdit ? <Save className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                {isEdit ? 'Update Campaign' : 'Create Campaign'}
              </Button>
              <Button variant="outline" onClick={() => { setViewMode('list'); resetForm(); }}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Detail View ────────────────────────────────────────────────────────
  if (viewMode === 'detail' && selectedCampaign) {
    const c = selectedCampaign;
    const sb = STATUS_BADGES[c.status] || { variant: 'secondary' as const, label: c.status };

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <Button variant="ghost" size="icon" className="self-start" onClick={() => setViewMode('list')}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold truncate">{c.name}</h1>
            <p className="text-muted-foreground">{c.subject}</p>
          </div>
          <Badge variant={sb.variant} className="text-sm">{sb.label}</Badge>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{c.total_recipients}</p>
              <p className="text-xs text-muted-foreground">Recipients</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{c.sent_count}</p>
              <p className="text-xs text-muted-foreground">Delivered</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-blue-600">{c.open_count}</p>
              <p className="text-xs text-muted-foreground">Opened</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-purple-600">{c.click_count}</p>
              <p className="text-xs text-muted-foreground">Clicked</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-red-600">{c.bounce_count}</p>
              <p className="text-xs text-muted-foreground">Bounced</p>
            </CardContent>
          </Card>
        </div>

        {/* Recipient breakdown */}
        {recipientStats.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Delivery Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {recipientStats.map((s: any) => (
                  <div key={s.status} className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md">
                    <span className="text-sm font-medium capitalize">{s.status}</span>
                    <Badge>{s.count}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Campaign details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Campaign Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Type:</span>{' '}
                <span className="font-medium">{c.campaign_type}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Audience:</span>{' '}
                <span className="font-medium">{c.target_audience}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Created:</span>{' '}
                <span className="font-medium">{new Date(c.created_at).toLocaleString()}</span>
              </div>
              {c.sent_at && (
                <div>
                  <span className="text-muted-foreground">Sent:</span>{' '}
                  <span className="font-medium">{new Date(c.sent_at).toLocaleString()}</span>
                </div>
              )}
            </div>

            <Separator />

            <div>
              <Label className="text-sm text-muted-foreground mb-2 block">Email Content Preview</Label>
              <div
                className="border rounded-md p-4 bg-white text-sm max-h-96 overflow-auto"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(c.html_content || '<p>No content</p>') }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-3">
          {c.status === 'draft' && (
            <>
              <Button onClick={() => openEdit(c)}>
                <Edit className="h-4 w-4 mr-2" /> Edit
              </Button>
              <Button variant="outline" onClick={() => handleSendTest(c.id)}>
                <TestTube className="h-4 w-4 mr-2" /> Send Test
              </Button>
              <Button onClick={() => handleSend(c.id)} disabled={sending}>
                {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                Send Campaign
              </Button>
            </>
          )}
          <Button variant="outline" onClick={() => setViewMode('list')}>
            <ChevronLeft className="h-4 w-4 mr-2" /> Back to List
          </Button>
        </div>
      </div>
    );
  }

  return null;
}

// Tiny Save icon used only in the form
function Save(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/>
      <path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/>
    </svg>
  );
}
