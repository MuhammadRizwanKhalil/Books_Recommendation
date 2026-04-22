import { useEffect, useState } from 'react';
import {
  BarChart3, Globe, Users, Eye, TrendingUp, Clock, Monitor,
  Smartphone, Tablet, MousePointerClick,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { analyticsApi } from '@/api/client';
import type { AdminGoogleAnalyticsResponse } from '@/types';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

const COLORS = [
  'hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))',
  'hsl(var(--chart-4))', 'hsl(var(--chart-5))', '#6366f1', '#ec4899',
];

interface InternalPageView {
  date: string;
  views: number;
}

interface InternalTopBook {
  bookId: string;
  title: string;
  views: number;
}

interface InternalTopPage {
  pagePath: string;
  views: number;
}

interface AffiliateDaily {
  date: string;
  clicks: number;
}

interface AffiliateTopBook {
  bookId: string;
  title: string;
  clicks: number;
}

interface AffiliateReport {
  daily: AffiliateDaily[];
  topBooks: AffiliateTopBook[];
  summary: {
    totalClicks: number;
    estimatedConversions: number;
    estimatedRevenue: number;
  };
}

interface EventSummary {
  eventType: string;
  count: number;
}

function formatSeconds(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds || 0));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

export function AdminAnalytics() {
  const [gaData, setGaData] = useState<AdminGoogleAnalyticsResponse | null>(null);
  const [gaError, setGaError] = useState<string | null>(null);
  const [pageViews, setPageViews] = useState<InternalPageView[]>([]);
  const [topBooks, setTopBooks] = useState<InternalTopBook[]>([]);
  const [topPages, setTopPages] = useState<InternalTopPage[]>([]);
  const [affiliateReport, setAffiliateReport] = useState<AffiliateReport | null>(null);
  const [eventsSummary, setEventsSummary] = useState<EventSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const [ga, pv, tb, tp, ar, es] = await Promise.all([
          analyticsApi.googleAnalytics(30),
          analyticsApi.pageViews(30),
          analyticsApi.topBooks(30),
          analyticsApi.topPages(30),
          analyticsApi.affiliateReport(30),
          analyticsApi.eventsSummary(30),
        ]);

        if (!mounted) return;

        setGaData(ga as AdminGoogleAnalyticsResponse);
        setPageViews((pv as InternalPageView[]) || []);
        setTopBooks((tb as InternalTopBook[]) || []);
        setTopPages((tp as InternalTopPage[]) || []);
        setAffiliateReport((ar as AffiliateReport) || null);
        setEventsSummary((es as EventSummary[]) || []);
        setGaError(null);
      } catch (err: any) {
        if (!mounted) return;
        setGaError(err?.message || 'Failed to load analytics data.');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Analytics</h1>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i}><CardContent className="p-6"><div className="animate-pulse h-20 bg-muted rounded" /></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  const gaSummary = gaData?.reporting?.summary;
  const gaDateRange = gaData?.reporting?.dateRange;
  const gaSource = gaData?.dataSource === 'ga4' ? 'Live GA4 Data' : 'Configuration Required';
  const gaRefreshedAt = gaData?.queriedAt ? new Date(gaData.queriedAt).toLocaleString() : 'Unknown';

  const deviceIcon = (device: string) => {
    if (device.toLowerCase().includes('mobile')) return <Smartphone className="h-4 w-4" />;
    if (device.toLowerCase().includes('tablet')) return <Tablet className="h-4 w-4" />;
    return <Monitor className="h-4 w-4" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold">Analytics</h1>
        <Badge variant="outline" className="text-sm gap-1">
          <Globe className="h-3 w-3" /> Google Analytics + Internal
        </Badge>
      </div>

      <Tabs defaultValue="google">
        <TabsList className="inline-flex w-full max-w-md">
          <TabsTrigger value="google" className="flex-1">Analytics</TabsTrigger>
          <TabsTrigger value="internal" className="flex-1">Internal</TabsTrigger>
          <TabsTrigger value="affiliate" className="flex-1">Affiliate</TabsTrigger>
        </TabsList>

        {/* Google Analytics Tab */}
        <TabsContent value="google" className="space-y-6 mt-6">
          {gaError && (
            <Card>
              <CardContent className="p-6">
                <p className="text-sm text-red-600">{gaError}</p>
              </CardContent>
            </Card>
          )}

          {gaData && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <CardTitle className="text-lg">Google Analytics Data Source</CardTitle>
                  <Badge variant={gaData.dataSource === 'ga4' ? 'default' : 'secondary'}>{gaSource}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="text-muted-foreground">Measurement ID: {gaData.measurementId || 'Not set'}</p>
                <p className="text-muted-foreground">Property ID: {gaData.propertyId || 'Not configured'}</p>
                <p className="text-muted-foreground">Last refreshed: {gaRefreshedAt}</p>
                {gaData.note && <p className="text-xs text-muted-foreground">{gaData.note}</p>}
              </CardContent>
            </Card>
          )}

          {/* GA Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Sessions (30d)</p>
                    <p className="text-2xl font-bold mt-1">{(gaSummary?.totalSessions || 0).toLocaleString()}</p>
                  </div>
                  <BarChart3 className="h-8 w-8 text-blue-500 opacity-80" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Unique Users</p>
                    <p className="text-2xl font-bold mt-1">{(gaSummary?.totalUsers || 0).toLocaleString()}</p>
                  </div>
                  <Users className="h-8 w-8 text-green-500 opacity-80" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Page Views</p>
                    <p className="text-2xl font-bold mt-1">{(gaSummary?.totalPageViews || 0).toLocaleString()}</p>
                  </div>
                  <Eye className="h-8 w-8 text-purple-500 opacity-80" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Avg Session Duration</p>
                    <p className="text-2xl font-bold mt-1">{formatSeconds(gaSummary?.avgSessionDuration || 0)}</p>
                  </div>
                  <Clock className="h-8 w-8 text-orange-500 opacity-80" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Bounce Rate</p>
                    <p className="text-2xl font-bold mt-1">{(gaSummary?.avgBounceRate || 0).toFixed(1)}%</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-rose-500 opacity-80" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Engagement Rate</p>
                    <p className="text-2xl font-bold mt-1">{(gaSummary?.engagementRate || 0).toFixed(1)}%</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-emerald-500 opacity-80" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* GA Real-time */}
          {gaData?.realtime && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Realtime Snapshot</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-3 w-3 bg-green-500 rounded-full animate-pulse" />
                  <p className="text-sm text-muted-foreground">Active users right now:</p>
                  <p className="text-2xl font-bold">{gaData.realtime.activeUsers}</p>
                </div>

                <div>
                  <p className="text-sm font-medium mb-2">Top active screens/pages</p>
                  {gaData.realtime.topActivePages.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No realtime page breakdown returned by GA yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {gaData.realtime.topActivePages.map((item) => (
                        <div key={item.page} className="flex items-center justify-between text-sm">
                          <span className="font-mono text-xs truncate pr-3">{item.page}</span>
                          <span className="font-semibold">{item.users}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Sessions & Users Chart */}
          <Card>
            <CardHeader><CardTitle className="text-lg">Sessions & Users (30 Days)</CardTitle></CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={gaData?.reporting?.dailyData || []}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v: string) => v.slice(5)} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                    <Legend />
                    <Line type="monotone" dataKey="sessions" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="users" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="pageViews" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                <span>Pages per Session: {(gaSummary?.pagesPerSession || 0).toFixed(2)}</span>
                <span>
                  Date Range: {gaDateRange?.start || '-'} to {gaDateRange?.end || '-'}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Demographics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6">
            {/* Traffic Sources */}
            <Card>
              <CardHeader><CardTitle className="text-lg">Traffic Sources</CardTitle></CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={gaData?.trafficSources || []}
                        dataKey="sessions"
                        nameKey="source"
                        cx="50%" cy="50%"
                        outerRadius={80}
                        label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {(gaData?.trafficSources || []).map((_: any, i: number) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Devices */}
            <Card>
              <CardHeader><CardTitle className="text-lg">Devices</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-4 mt-2">
                  {(gaData?.demographics?.devices || []).map((d: any) => (
                    <div key={d.device} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {deviceIcon(d.device)}
                        <span className="text-sm">{d.device}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{d.sessions.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">{d.percentage}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Top Countries */}
            <Card>
              <CardHeader><CardTitle className="text-lg">Top Countries</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3 mt-2">
                  {(gaData?.demographics?.countries || []).slice(0, 6).map((c: any) => (
                    <div key={c.country} className="flex items-center justify-between">
                      <span className="text-sm">{c.country}</span>
                      <div className="text-right">
                        <p className="text-sm font-medium">{c.users.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">{c.percentage}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Browsers */}
            <Card>
              <CardHeader><CardTitle className="text-lg">Browsers</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3 mt-2">
                  {(gaData?.demographics?.browsers || []).map((browser) => (
                    <div key={browser.browser} className="flex items-center justify-between">
                      <span className="text-sm">{browser.browser}</span>
                      <div className="text-right">
                        <p className="text-sm font-medium">{browser.sessions.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">{browser.percentage}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Top GA Pages */}
          <Card>
            <CardHeader><CardTitle className="text-lg">Top Pages (GA)</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-3 pr-4">Path</th>
                      <th className="pb-3 pr-4">Title</th>
                      <th className="pb-3 pr-4">Views</th>
                      <th className="pb-3 pr-4">Avg Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(gaData?.topPages || []).map((p) => (
                      <tr key={p.page} className="border-b last:border-0">
                        <td className="py-2 pr-4 font-mono text-xs">{p.page}</td>
                        <td className="py-2 pr-4">{p.title}</td>
                        <td className="py-2 pr-4">{p.pageViews.toLocaleString()}</td>
                        <td className="py-2 pr-4">{formatSeconds(p.avgTime)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Internal Analytics Tab */}
        <TabsContent value="internal" className="space-y-6 mt-6">
          {/* Internal Page Views */}
          <Card>
            <CardHeader><CardTitle className="text-lg">Internal Page Views (30 Days)</CardTitle></CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={pageViews}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v: string) => v.slice(5)} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                    <Area type="monotone" dataKey="views" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.15} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Books */}
            <Card>
              <CardHeader><CardTitle className="text-lg">Top Viewed Books</CardTitle></CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topBooks.slice(0, 8)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="title" tick={{ fontSize: 10 }} width={100} />
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                      <Bar dataKey="views" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Events Summary */}
            <Card>
              <CardHeader><CardTitle className="text-lg">Events Summary</CardTitle></CardHeader>
              <CardContent>
                {eventsSummary.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No events tracked</p>
                ) : (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={eventsSummary}
                          dataKey="count"
                          nameKey="eventType"
                          cx="50%" cy="50%"
                          outerRadius={80}
                          label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          {eventsSummary.map((_: any, i: number) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Top Pages */}
          <Card>
            <CardHeader><CardTitle className="text-lg">Top Internal Pages</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-3 pr-4">Page</th>
                      <th className="pb-3">Views</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topPages.map((p: any) => (
                      <tr key={p.pagePath} className="border-b last:border-0">
                        <td className="py-2 pr-4 font-mono text-xs">{p.pagePath}</td>
                        <td className="py-2">{p.views.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Affiliate Tab */}
        <TabsContent value="affiliate" className="space-y-6 mt-6">
          {/* Affiliate Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Clicks (30d)</p>
                    <p className="text-2xl font-bold mt-1">{affiliateReport?.summary?.totalClicks || 0}</p>
                  </div>
                  <MousePointerClick className="h-8 w-8 text-orange-500 opacity-80" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Est. Conversions</p>
                    <p className="text-2xl font-bold mt-1">{affiliateReport?.summary?.estimatedConversions || 0}</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-green-500 opacity-80" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Est. Revenue</p>
                    <p className="text-2xl font-bold mt-1">${(affiliateReport?.summary?.estimatedRevenue || 0).toFixed(2)}</p>
                  </div>
                  <BarChart3 className="h-8 w-8 text-blue-500 opacity-80" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Daily Clicks Chart */}
          <Card>
            <CardHeader><CardTitle className="text-lg">Daily Affiliate Clicks</CardTitle></CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={affiliateReport?.daily || []}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v: string) => v.slice(5)} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                    <Bar dataKey="clicks" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Top Affiliate Books */}
          <Card>
            <CardHeader><CardTitle className="text-lg">Top Affiliate Books</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-3 pr-4">Book</th>
                      <th className="pb-3 pr-4">Clicks</th>
                      <th className="pb-3">Est. Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(affiliateReport?.topBooks || []).map((b: any) => (
                      <tr key={b.bookId} className="border-b last:border-0">
                        <td className="py-2 pr-4 font-medium">{b.title}</td>
                        <td className="py-2 pr-4">{b.clicks}</td>
                        <td className="py-2">${(b.clicks * 0.35).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
