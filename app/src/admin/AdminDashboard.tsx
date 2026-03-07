import { useEffect, useState } from 'react';
import {
  BookOpen, Users, Star, Mail, Eye, MousePointerClick,
  TrendingUp, TrendingDown, BarChart3, FileText, UserPlus, RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { adminApi, analyticsApi } from '@/api/client';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar,
} from 'recharts';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export function AdminDashboard() {
  const [dashboard, setDashboard] = useState<any>(null);
  const [overview, setOverview] = useState<any>(null);
  const [pageViewChart, setPageViewChart] = useState<any[]>([]);
  const [topBooks, setTopBooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [recalcResult, setRecalcResult] = useState<string | null>(null);

  const handleRecalculateScores = async () => {
    setRecalculating(true);
    setRecalcResult(null);
    try {
      const result = await adminApi.recalculateScores();
      setRecalcResult(`Updated ${result.updated} books in ${result.duration}`);
    } catch (err) {
      setRecalcResult('Failed to recalculate scores');
      console.error(err);
    } finally {
      setRecalculating(false);
    }
  };

  useEffect(() => {
    async function load() {
      try {
        const [dash, ov, pv, tb] = await Promise.all([
          adminApi.dashboard(),
          analyticsApi.overview(),
          analyticsApi.pageViews(30),
          analyticsApi.topBooks(30),
        ]);
        setDashboard(dash);
        setOverview(ov);
        setPageViewChart(pv);
        setTopBooks(tb);
      } catch (err) {
        console.error('Failed to load dashboard:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i}><CardContent className="p-6"><div className="animate-pulse h-20 bg-muted rounded" /></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  const statCards = [
    { label: 'Total Books', value: overview?.totals?.books || 0, icon: BookOpen, color: 'text-blue-500' },
    { label: 'Total Users', value: overview?.totals?.users || 0, icon: Users, color: 'text-green-500' },
    { label: 'Total Reviews', value: overview?.totals?.reviews || 0, icon: Star, color: 'text-yellow-500' },
    { label: 'Subscribers', value: overview?.totals?.subscribers || 0, icon: Mail, color: 'text-purple-500' },
    {
      label: 'Page Views (30d)', value: overview?.pageViews?.last30Days || 0, icon: Eye, color: 'text-indigo-500',
      change: overview?.pageViews?.changePercent,
    },
    {
      label: 'Affiliate Clicks (30d)', value: overview?.affiliateClicks?.last30Days || 0, icon: MousePointerClick, color: 'text-orange-500',
      change: overview?.affiliateClicks?.changePercent,
    },
    {
      label: 'New Users (30d)', value: overview?.newUsers?.last30Days || 0, icon: UserPlus, color: 'text-teal-500',
      change: overview?.newUsers?.changePercent,
    },
    { label: 'Blog Posts', value: overview?.totals?.blogPosts || 0, icon: FileText, color: 'text-pink-500' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold">Dashboard</h1>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRecalculateScores}
            disabled={recalculating}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${recalculating ? 'animate-spin' : ''}`} />
            {recalculating ? 'Recalculating...' : 'Recalculate Scores'}
          </Button>
          {recalcResult && (
            <span className="text-sm text-muted-foreground">{recalcResult}</span>
          )}
          <Badge variant="outline" className="text-sm">
            <BarChart3 className="h-3 w-3 mr-1" />
            Live Data
          </Badge>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold mt-1">{stat.value.toLocaleString()}</p>
                  {stat.change !== undefined && (
                    <div className={`flex items-center text-xs mt-1 ${stat.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {stat.change >= 0 ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                      {Math.abs(stat.change)}% vs prev 30d
                    </div>
                  )}
                </div>
                <stat.icon className={`h-8 w-8 ${stat.color} opacity-80`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Page Views Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Page Views (Last 30 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={pageViewChart}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v: string) => v.slice(5)} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Area type="monotone" dataKey="views" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.15} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Books by Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Books by Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={dashboard?.booksByStatus || []}
                    dataKey="count"
                    nameKey="status"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {(dashboard?.booksByStatus || []).map((_: any, i: number) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Books & Recent Activity Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Viewed Books */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top Viewed Books (30d)</CardTitle>
          </CardHeader>
          <CardContent>
            {topBooks.length === 0 ? (
              <p className="text-muted-foreground text-sm">No data yet</p>
            ) : (
              <div className="h-64">
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
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {dashboard?.recentActivity?.reviews?.slice(0, 4).map((r: any) => (
              <div key={r.id} className="flex items-start gap-3 text-sm">
                <Star className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
                <div>
                  <p><span className="font-medium">{r.userName}</span> rated <span className="font-medium">{r.bookTitle}</span> — {r.rating}/5</p>
                  <p className="text-xs text-muted-foreground">{r.content}</p>
                </div>
              </div>
            ))}
            {dashboard?.recentActivity?.users?.slice(0, 3).map((u: any) => (
              <div key={u.id} className="flex items-start gap-3 text-sm">
                <UserPlus className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                <div>
                  <p><span className="font-medium">{u.name}</span> joined</p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Top Categories */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Top Categories</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {dashboard?.topCategories?.map((c: any) => (
              <Badge key={c.slug} variant="secondary" className="text-sm py-1 px-3">
                {c.name}
                <span className="ml-2 text-muted-foreground">{c.bookCount} books</span>
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
