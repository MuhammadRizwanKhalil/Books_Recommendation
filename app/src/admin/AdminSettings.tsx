import { useEffect, useState, useCallback } from 'react';
import {
  Settings, Save, RefreshCw, Mail, Palette, Globe, Shield,
  Bell, Link2, Loader2, ChevronRight,
  Eye, EyeOff, TestTube, Lock, Copy, ExternalLink, Home,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { settingsApi } from '@/api/client';

// Category metadata
const CATEGORY_META: Record<string, { label: string; icon: React.ElementType; description: string }> = {
  general: { label: 'General', icon: Settings, description: 'Basic site configuration' },
  smtp: { label: 'Email / SMTP', icon: Mail, description: 'Email delivery settings' },
  branding: { label: 'Branding', icon: Palette, description: 'Logo, colors, and appearance' },
  social: { label: 'Social Links', icon: Globe, description: 'Social media profiles' },
  security: { label: 'Security', icon: Lock, description: 'Admin access and security settings' },
  legal: { label: 'Legal Pages', icon: Shield, description: 'Privacy, terms, and policies' },
  notifications: { label: 'Notifications', icon: Bell, description: 'Email notification preferences' },
  affiliate: { label: 'Affiliate', icon: Link2, description: 'Affiliate program settings' },
  homepage: { label: 'Homepage', icon: Home, description: 'Homepage section content and text' },
};

interface SettingItem {
  key: string;
  value: string;
  category: string;
  label: string;
  description: string;
  field_type: string;
  sort_order: number;
}

export function AdminSettings() {
  const [settings, setSettings] = useState<Record<string, SettingItem[]>>({});
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [activeCategory, setActiveCategory] = useState('general');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await settingsApi.getAdmin();
      setSettings(res.settings);
      // Initialize edited values from current
      const vals: Record<string, string> = {};
      for (const items of Object.values(res.settings)) {
        for (const item of items) {
          vals[item.key] = item.value;
        }
      }
      setEditedValues(vals);
    } catch (err: any) {
      // If no settings exist yet, try to seed
      console.error(err);
      toast.error('Failed to load settings. Try seeding defaults.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleChange = (key: string, value: string) => {
    setEditedValues(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await settingsApi.updateBulk(editedValues);
      toast.success('Settings saved successfully');
      load();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSeed = async () => {
    setSeeding(true);
    try {
      const res = await settingsApi.seed();
      toast.success(`${res.count} default settings seeded`);
      load();
    } catch (err: any) {
      toast.error('Failed to seed settings');
    } finally {
      setSeeding(false);
    }
  };

  const handleTestSmtp = async () => {
    setTestingSmtp(true);
    try {
      const res = await settingsApi.testSmtp();
      if (res.success) {
        toast.success('SMTP connection successful!');
      } else {
        toast.error(`SMTP test failed: ${res.error}`);
      }
    } catch (err: any) {
      toast.error('SMTP test failed');
    } finally {
      setTestingSmtp(false);
    }
  };

  // Show categories from both CATEGORY_META and actual data
  const categories = Array.from(new Set([...Object.keys(CATEGORY_META), ...Object.keys(settings)]));
  const hasChanges = Object.keys(editedValues).some(key => {
    const original = Object.values(settings).flat().find(s => s.key === key);
    return original && original.value !== editedValues[key];
  });

  const renderField = (item: SettingItem) => {
    const value = editedValues[item.key] ?? item.value;

    switch (item.field_type) {
      case 'boolean':
        return (
          <div className="flex items-center gap-3">
            <Switch
              checked={value === 'true'}
              onCheckedChange={(checked) => handleChange(item.key, String(checked))}
            />
            <span className="text-sm text-muted-foreground">
              {value === 'true' ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        );

      case 'password':
        return (
          <div className="relative">
            <Input
              type={showPasswords[item.key] ? 'text' : 'password'}
              value={value}
              onChange={(e) => handleChange(item.key, e.target.value)}
              placeholder={item.description}
            />
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1 h-7 w-7"
              onClick={() => setShowPasswords(prev => ({ ...prev, [item.key]: !prev[item.key] }))}
            >
              {showPasswords[item.key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        );

      case 'textarea':
        return (
          <Textarea
            value={value}
            onChange={(e) => handleChange(item.key, e.target.value)}
            placeholder={item.description}
            rows={3}
          />
        );

      case 'richtext':
        return (
          <Textarea
            value={value}
            onChange={(e) => handleChange(item.key, e.target.value)}
            placeholder={item.description}
            rows={10}
            className="font-mono text-xs"
          />
        );

      case 'color':
        return (
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={value || '#000000'}
              onChange={(e) => handleChange(item.key, e.target.value)}
              className="w-10 h-10 rounded border cursor-pointer"
              title={item.label}
            />
            <Input
              value={value}
              onChange={(e) => handleChange(item.key, e.target.value)}
              placeholder="#000000"
              className="w-32"
            />
          </div>
        );

      case 'number':
        return (
          <Input
            type="number"
            value={value}
            onChange={(e) => handleChange(item.key, e.target.value)}
            placeholder={item.description}
          />
        );

      case 'email':
        return (
          <Input
            type="email"
            value={value}
            onChange={(e) => handleChange(item.key, e.target.value)}
            placeholder={item.description}
          />
        );

      case 'url':
        return (
          <Input
            type="url"
            value={value}
            onChange={(e) => handleChange(item.key, e.target.value)}
            placeholder="https://..."
          />
        );

      default:
        return (
          <Input
            type="text"
            value={value}
            onChange={(e) => handleChange(item.key, e.target.value)}
            placeholder={item.description}
          />
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground text-sm">Manage your site configuration, branding, and policies</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleSeed} disabled={seeding}>
            {seeding ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Seed Defaults
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving || !hasChanges}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save Changes
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Sidebar navigation */}
        <div className="lg:col-span-3">
          <Card>
            <CardContent className="p-2">
              <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0">
                {categories.map((cat) => {
                  const meta = CATEGORY_META[cat];
                  const Icon = meta.icon;
                  const itemCount = settings[cat]?.length || 0;

                  return (
                    <button
                      key={cat}
                      className={`flex items-center gap-2 lg:gap-3 px-3 py-2 lg:py-2.5 rounded-md text-sm transition-colors whitespace-nowrap lg:w-full ${
                        activeCategory === cat
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-muted text-foreground'
                      }`}
                      onClick={() => setActiveCategory(cat)}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1 text-left">{meta.label}</span>
                      {itemCount > 0 && (
                        <Badge variant={activeCategory === cat ? 'outline' : 'secondary'} className="text-xs hidden lg:inline-flex">
                          {itemCount}
                        </Badge>
                      )}
                      <ChevronRight className="h-3 w-3 shrink-0 opacity-50 hidden lg:block" />
                    </button>
                  );
                })}
              </nav>
            </CardContent>
          </Card>
        </div>

        {/* Settings form */}
        <div className="lg:col-span-9">
          {loading ? (
            <Card>
              <CardContent className="p-8">
                <div className="flex flex-col items-center gap-4">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  <p className="text-muted-foreground">Loading settings...</p>
                  <Button onClick={handleSeed} variant="outline">
                    <RefreshCw className="h-4 w-4 mr-2" /> Seed Default Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {(() => {
                      const meta = CATEGORY_META[activeCategory];
                      const Icon = meta?.icon || Settings;
                      return <Icon className="h-5 w-5 text-primary" />;
                    })()}
                    <div>
                      <CardTitle>{CATEGORY_META[activeCategory]?.label || activeCategory}</CardTitle>
                      <CardDescription>{CATEGORY_META[activeCategory]?.description}</CardDescription>
                    </div>
                  </div>

                  {/* SMTP test button */}
                  {activeCategory === 'smtp' && (
                    <Button variant="outline" size="sm" onClick={handleTestSmtp} disabled={testingSmtp}>
                      {testingSmtp ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <TestTube className="h-4 w-4 mr-2" />
                      )}
                      Test Connection
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {/* Admin URL preview for security category */}
                {activeCategory === 'security' && editedValues['admin_url_slug'] && (
                  <div className="mb-6 rounded-lg border border-primary/20 bg-primary/5 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Lock className="h-4 w-4 text-primary" />
                      <span className="font-semibold text-sm">Your Secret Admin URL</span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">
                      Bookmark this URL to access the admin dashboard. No admin button is visible on the public site.
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 min-w-0 truncate rounded bg-background px-3 py-2 text-sm font-mono border select-all">
                        {`${window.location.origin}/${editedValues['admin_url_slug']}`}
                      </code>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(
                            `${window.location.origin}/${editedValues['admin_url_slug']}`
                          );
                          toast.success('Admin URL copied to clipboard');
                        }}
                      >
                        <Copy className="h-3.5 w-3.5 mr-1" />
                        Copy
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(`${window.location.origin}/${editedValues['admin_url_slug']}`, '_blank')}
                      >
                        <ExternalLink className="h-3.5 w-3.5 mr-1" />
                        Open
                      </Button>
                    </div>
                  </div>
                )}

                {(!settings[activeCategory] || settings[activeCategory].length === 0) ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No settings in this category yet.</p>
                    <Button onClick={handleSeed} variant="outline" className="mt-3">
                      <RefreshCw className="h-4 w-4 mr-2" /> Seed Defaults
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {settings[activeCategory].map((item, idx) => (
                      <div key={item.key}>
                        {idx > 0 && <Separator className="mb-6" />}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                          <div className="md:col-span-4">
                            <Label className="font-medium">{item.label}</Label>
                            <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
                            <p className="text-[10px] text-muted-foreground/50 mt-0.5 font-mono">{item.key}</p>
                          </div>
                          <div className="md:col-span-8">
                            {renderField(item)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
