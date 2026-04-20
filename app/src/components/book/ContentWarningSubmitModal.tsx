import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { contentWarningsApi, type ContentWarningTaxonomy } from '@/api/client';
import { toast } from 'sonner';

interface ContentWarningSubmitModalProps {
  bookId: string;
  onClose: () => void;
  onSubmitted: () => void;
}

const severityOptions = [
  { value: 'mild', label: 'Mild', desc: 'Brief or implied reference' },
  { value: 'moderate', label: 'Moderate', desc: 'Significant but not graphic' },
  { value: 'severe', label: 'Severe', desc: 'Graphic or detailed depiction' },
];

const categoryLabels: Record<string, string> = {
  violence: 'Violence',
  sexual: 'Sexual Content',
  mental_health: 'Mental Health',
  discrimination: 'Discrimination',
  death: 'Death & Grief',
  other: 'Other',
};

export function ContentWarningSubmitModal({ bookId, onClose, onSubmitted }: ContentWarningSubmitModalProps) {
  const [taxonomy, setTaxonomy] = useState<ContentWarningTaxonomy[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedWarningId, setSelectedWarningId] = useState('');
  const [severity, setSeverity] = useState('moderate');
  const [details, setDetails] = useState('');

  useEffect(() => {
    contentWarningsApi.getTaxonomy()
      .then(setTaxonomy)
      .catch(() => toast.error('Failed to load warning types'))
      .finally(() => setLoading(false));
  }, []);

  // Group by category
  const grouped = taxonomy.reduce<Record<string, ContentWarningTaxonomy[]>>((acc, w) => {
    (acc[w.category] ||= []).push(w);
    return acc;
  }, {});

  const handleSubmit = async () => {
    if (!selectedWarningId) {
      toast.error('Please select a warning type');
      return;
    }
    setSubmitting(true);
    try {
      await contentWarningsApi.submit(bookId, {
        warningId: selectedWarningId,
        severity,
        details: details.trim() || undefined,
      });
      toast.success('Content warning submitted for moderation');
      onSubmitted();
    } catch (err: any) {
      const msg = err?.body?.error || err?.message || 'Failed to submit warning';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-background rounded-xl shadow-xl mx-4 w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Report a content warning"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-bold">Report a Content Warning</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-5">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading warning types...</p>
          ) : (
            <>
              {/* Warning type selection */}
              <div>
                <label className="text-sm font-medium mb-2 block">Warning Type</label>
                <div className="space-y-3 max-h-60 overflow-y-auto border rounded-lg p-3">
                  {Object.entries(grouped).map(([category, items]) => (
                    <div key={category}>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                        {categoryLabels[category] || category}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {items.map(w => (
                          <button
                            key={w.id}
                            onClick={() => setSelectedWarningId(w.id)}
                            className={`text-xs rounded-full px-3 py-1 border transition-colors ${
                              selectedWarningId === w.id
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-muted hover:bg-muted/80 border-transparent'
                            }`}
                          >
                            {w.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Severity */}
              <div>
                <label className="text-sm font-medium mb-2 block">Severity</label>
                <div className="flex gap-2">
                  {severityOptions.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setSeverity(opt.value)}
                      className={`flex-1 rounded-lg border p-2 text-center transition-colors ${
                        severity === opt.value
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <p className="text-sm font-medium">{opt.label}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Details */}
              <div>
                <label htmlFor="cw-details" className="text-sm font-medium mb-2 block">
                  Details <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <textarea
                  id="cw-details"
                  value={details}
                  onChange={e => setDetails(e.target.value)}
                  maxLength={500}
                  rows={3}
                  placeholder="e.g., Chapter 5 contains a scene with..."
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <p className="text-[10px] text-muted-foreground mt-1 text-right">
                  {details.length}/500
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !selectedWarningId || loading}>
            {submitting ? 'Submitting...' : 'Submit for Review'}
          </Button>
        </div>
      </div>
    </div>
  );
}
