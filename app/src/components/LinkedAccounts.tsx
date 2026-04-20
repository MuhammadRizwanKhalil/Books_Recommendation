import { useCallback, useEffect, useState } from 'react';
import { Link2, Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { authApi } from '@/api/client';
import { useAuth } from '@/components/AuthProvider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type SocialProvider = 'google' | 'apple';

type LinkedAccountsState = {
  google: boolean;
  apple: boolean;
  hasPassword: boolean;
};

function encodeMockToken(provider: SocialProvider, payload: Record<string, unknown>) {
  const json = JSON.stringify(payload);
  const encoded = window.btoa(unescape(encodeURIComponent(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  return `${provider}-mock:${encoded}`;
}

function isLocalHost() {
  return ['localhost', '127.0.0.1'].includes(window.location.hostname);
}

export function LinkedAccounts() {
  const { user } = useAuth();
  const [state, setState] = useState<LinkedAccountsState>({ google: false, apple: false, hasPassword: true });
  const [loadingProvider, setLoadingProvider] = useState<SocialProvider | null>(null);

  const loadLinkedAccounts = useCallback(async () => {
    try {
      const result = await authApi.getLinkedAccounts();
      setState(result);
    } catch {
      setState({ google: false, apple: false, hasPassword: true });
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    void loadLinkedAccounts();
  }, [loadLinkedAccounts, user]);

  if (!user) return null;

  const buildProfile = (provider: SocialProvider) => {
    const mockStore = (window as any).__BOOKTIMES_SOCIAL_LOGIN_MOCK__;
    if (mockStore === null) return null;
    if (mockStore?.[provider]) return mockStore[provider];
    if (!isLocalHost()) return null;

    return {
      sub: `${provider}-${user.id}`,
      email: user.email,
      name: user.name,
      picture: user.avatar,
    };
  };

  const handleLink = async (provider: SocialProvider) => {
    const profile = buildProfile(provider);
    if (!profile) {
      toast.error('Social linking is not available right now.');
      return;
    }

    try {
      setLoadingProvider(provider);
      const token = encodeMockToken(provider, profile);
      const result = await authApi.linkAccount(provider, token);
      setState(result);
      toast.success(`${provider === 'google' ? 'Google' : 'Apple'} linked successfully.`);
    } catch (err: any) {
      toast.error(err?.body?.error || `Failed to link ${provider}.`);
    } finally {
      setLoadingProvider(null);
    }
  };

  const handleUnlink = async (provider: SocialProvider) => {
    try {
      setLoadingProvider(provider);
      const result = await authApi.unlinkAccount(provider);
      setState(result);
      toast.success(`${provider === 'google' ? 'Google' : 'Apple'} unlinked.`);
    } catch (err: any) {
      toast.error(err?.body?.error || `Failed to unlink ${provider}.`);
    } finally {
      setLoadingProvider(null);
    }
  };

  return (
    <Card data-testid="linked-accounts-panel">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Link2 className="h-4 w-4" />
          Linked Accounts
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {(['google', 'apple'] as SocialProvider[]).map((provider) => {
          const linked = state[provider];
          const label = provider === 'google' ? 'Google' : 'Apple';
          const working = loadingProvider === provider;

          return (
            <div key={provider} className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{label}</p>
                  {linked ? <Badge variant="secondary">{label} linked</Badge> : <Badge variant="outline">Not linked</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">
                  {linked ? `Your ${label} account is linked for faster sign-in.` : `Link ${label} to sign in faster.`}
                </p>
              </div>

              {linked ? (
                <Button variant="outline" size="sm" onClick={() => void handleUnlink(provider)} disabled={working}>
                  {working ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Unlink
                </Button>
              ) : (
                <Button size="sm" onClick={() => void handleLink(provider)} disabled={working}>
                  {working ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Link {label}
                </Button>
              )}
            </div>
          );
        })}

        {!state.hasPassword ? (
          <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
            <div className="mb-1 flex items-center gap-2 font-medium text-foreground">
              <ShieldCheck className="h-4 w-4" />
              Password recommended
            </div>
            Set a password from your profile before unlinking your last social sign-in method.
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default LinkedAccounts;
