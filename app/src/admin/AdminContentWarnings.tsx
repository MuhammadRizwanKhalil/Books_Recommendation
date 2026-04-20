import { useState, useEffect } from 'react';
import { AlertTriangle, Check, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { contentWarningsApi, type PendingContentWarning } from '@/api/client';
import { toast } from 'sonner';

const severityColors: Record<string, string> = {
  mild: 'bg-yellow-100 text-yellow-800',
  moderate: 'bg-orange-100 text-orange-800',
  severe: 'bg-red-100 text-red-800',
};

export function AdminContentWarnings() {
  const [pending, setPending] = useState<PendingContentWarning[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchPending = async () => {
    try {
      const data = await contentWarningsApi.getPending();
      setPending(data);
    } catch {
      toast.error('Failed to load pending warnings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPending(); }, []);

  const handleApprove = async (id: string) => {
    setProcessing(id);
    try {
      await contentWarningsApi.approve(id);
      setPending(prev => prev.filter(p => p.id !== id));
      toast.success('Content warning approved');
    } catch {
      toast.error('Failed to approve');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (id: string) => {
    setProcessing(id);
    try {
      await contentWarningsApi.reject(id);
      setPending(prev => prev.filter(p => p.id !== id));
      toast.success('Content warning rejected');
    } catch {
      toast.error('Failed to reject');
    } finally {
      setProcessing(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-amber-500" />
            Content Warnings Moderation
          </h1>
          <p className="text-muted-foreground mt-1">
            Review and approve community-submitted content warnings
          </p>
        </div>
        <Badge variant="secondary" className="text-sm">
          {pending.length} pending
        </Badge>
      </div>

      {pending.length === 0 ? (
        <div className="text-center py-12 border rounded-lg">
          <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground">No pending content warnings to review</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pending.map(item => (
            <div key={item.id} className="border rounded-lg p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{item.warningName}</span>
                    <Badge variant="outline" className={`text-xs ${severityColors[item.severity] || ''}`}>
                      {item.severity}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {item.category}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Book: <span className="font-medium text-foreground">{item.bookTitle}</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Submitted by {item.userName} ({item.userEmail}) · {new Date(item.createdAt).toLocaleDateString()}
                  </p>
                  {item.details && (
                    <div className="mt-2">
                      <button
                        onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                        className="text-xs text-primary flex items-center gap-1"
                      >
                        Details
                        {expandedId === item.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </button>
                      {expandedId === item.id && (
                        <p className="text-sm text-muted-foreground mt-1 bg-muted/50 rounded p-2">
                          {item.details}
                        </p>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1 text-green-600 hover:text-green-700 hover:bg-green-50"
                    onClick={() => handleApprove(item.id)}
                    disabled={processing === item.id}
                  >
                    <Check className="h-4 w-4" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => handleReject(item.id)}
                    disabled={processing === item.id}
                  >
                    <X className="h-4 w-4" />
                    Reject
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
