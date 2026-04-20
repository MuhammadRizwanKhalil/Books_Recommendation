import { useEffect, useState } from 'react';
import { Check, Users } from 'lucide-react';
import { toast } from 'sonner';
import { charactersApi, type PendingCharacterResponse } from '@/api/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export function AdminCharacters() {
  const [pending, setPending] = useState<PendingCharacterResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  async function loadPending() {
    try {
      const response = await charactersApi.getPending();
      setPending(response);
    } catch {
      toast.error('Failed to load pending characters');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPending();
  }, []);

  async function handleApprove(id: string) {
    setProcessingId(id);
    try {
      await charactersApi.approve(id);
      setPending((prev) => prev.filter((item) => item.id !== id));
      toast.success('Character approved');
    } catch {
      toast.error('Failed to approve character');
    } finally {
      setProcessingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Character Moderation
          </h1>
          <p className="text-muted-foreground mt-1">
            Review community-submitted book characters and approve them for display.
          </p>
        </div>
        <Badge variant="secondary">{pending.length} pending</Badge>
      </div>

      {pending.length === 0 ? (
        <div className="rounded-lg border py-12 text-center text-muted-foreground">
          No pending characters to review.
        </div>
      ) : (
        <div className="space-y-3">
          {pending.map((item) => (
            <div key={item.id} className="rounded-lg border p-4 space-y-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold">{item.name}</h2>
                    <Badge variant="outline">{item.role}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Book: <span className="font-medium text-foreground">{item.bookTitle}</span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Submitted by {item.userName}{item.userEmail ? ` (${item.userEmail})` : ''}
                  </p>
                  {item.description && (
                    <p className="text-sm bg-muted/40 rounded-md p-3">{item.description}</p>
                  )}
                </div>

                <Button
                  size="sm"
                  className="gap-2 md:self-start"
                  disabled={processingId === item.id}
                  onClick={() => handleApprove(item.id)}
                >
                  <Check className="h-4 w-4" />
                  Approve
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
