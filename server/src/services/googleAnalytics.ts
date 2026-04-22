import fs from 'node:fs';
import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';

const DEFAULT_DAYS = 30;

export interface GoogleAnalyticsDailyPoint {
  date: string;
  sessions: number;
  users: number;
  pageViews: number;
  bounceRate: number;
  avgSessionDuration: number;
  engagementRate: number;
}

export interface GoogleAnalyticsDashboardData {
  reporting: {
    dateRange: { start: string; end: string };
    dailyData: GoogleAnalyticsDailyPoint[];
    summary: {
      totalSessions: number;
      totalUsers: number;
      totalPageViews: number;
      avgBounceRate: number;
      avgSessionDuration: number;
      pagesPerSession: number;
      engagementRate: number;
    };
  };
  demographics: {
    countries: { country: string; users: number; percentage: number }[];
    devices: { device: string; sessions: number; percentage: number }[];
    browsers: { browser: string; sessions: number; percentage: number }[];
  };
  trafficSources: { source: string; sessions: number; percentage: number }[];
  topPages: { page: string; title: string; pageViews: number; avgTime: number }[];
  realtime: {
    activeUsers: number;
    topActivePages: { page: string; users: number }[];
  };
  isConfigured: boolean;
  dataSource: 'ga4' | 'unavailable';
  propertyId: string | null;
  measurementId: string;
  note?: string;
  queriedAt: string;
}

let cachedClient: BetaAnalyticsDataClient | null = null;

function clampDays(days: number): number {
  if (!Number.isFinite(days)) return DEFAULT_DAYS;
  return Math.min(90, Math.max(7, Math.round(days)));
}

function normalizePropertyId(raw: string | undefined): string | null {
  const value = String(raw || '').trim();
  if (!value) return null;
  if (/^properties\/\d+$/.test(value)) return value;
  if (/^\d+$/.test(value)) return `properties/${value}`;
  return null;
}

function toNumber(value: string | null | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toPercent(value: number): number {
  const normalized = value <= 1 ? value * 100 : value;
  return Math.round(normalized * 10) / 10;
}

function round(value: number, decimals = 1): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function formatGaDate(raw: string): string {
  const value = String(raw || '').trim();
  if (/^\d{8}$/.test(value)) {
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  }
  return value;
}

function metric(row: any, index: number): number {
  return toNumber(row?.metricValues?.[index]?.value);
}

function dimension(row: any, index: number): string {
  return String(row?.dimensionValues?.[index]?.value || '').trim();
}

function dateDaysAgo(daysAgo: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

function buildZeroDailyData(days: number): GoogleAnalyticsDailyPoint[] {
  const result: GoogleAnalyticsDailyPoint[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    result.push({
      date: dateDaysAgo(i),
      sessions: 0,
      users: 0,
      pageViews: 0,
      bounceRate: 0,
      avgSessionDuration: 0,
      engagementRate: 0,
    });
  }
  return result;
}

function buildUnavailableResponse(days: number, note: string, propertyId: string | null): GoogleAnalyticsDashboardData {
  const dailyData = buildZeroDailyData(days);
  return {
    reporting: {
      dateRange: {
        start: dailyData[0]?.date || dateDaysAgo(days - 1),
        end: dailyData[dailyData.length - 1]?.date || dateDaysAgo(0),
      },
      dailyData,
      summary: {
        totalSessions: 0,
        totalUsers: 0,
        totalPageViews: 0,
        avgBounceRate: 0,
        avgSessionDuration: 0,
        pagesPerSession: 0,
        engagementRate: 0,
      },
    },
    demographics: {
      countries: [],
      devices: [],
      browsers: [],
    },
    trafficSources: [],
    topPages: [],
    realtime: {
      activeUsers: 0,
      topActivePages: [],
    },
    isConfigured: false,
    dataSource: 'unavailable',
    propertyId,
    measurementId: config.ga.measurementId,
    note,
    queriedAt: new Date().toISOString(),
  };
}

async function getClient(): Promise<BetaAnalyticsDataClient> {
  if (cachedClient) return cachedClient;

  const credentialsJson = String(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || process.env.GA_CREDENTIALS_JSON || '').trim();
  if (credentialsJson) {
    const parsed = JSON.parse(credentialsJson);
    cachedClient = new BetaAnalyticsDataClient({ credentials: parsed });
    return cachedClient;
  }

  const credentialsPath = String(config.ga.credentialsPath || '').trim();
  if (credentialsPath && fs.existsSync(credentialsPath)) {
    cachedClient = new BetaAnalyticsDataClient({ keyFilename: credentialsPath });
    return cachedClient;
  }

  throw new Error(
    'Google Analytics credentials missing. Set GOOGLE_APPLICATION_CREDENTIALS_JSON or provide GOOGLE_APPLICATION_CREDENTIALS with a mounted file path.',
  );
}

function toDailyData(reportRows: any[] | null | undefined, days: number): GoogleAnalyticsDailyPoint[] {
  const indexed = new Map<string, GoogleAnalyticsDailyPoint>();

  for (const row of reportRows || []) {
    const date = formatGaDate(dimension(row, 0));
    if (!date) continue;

    indexed.set(date, {
      date,
      sessions: Math.round(metric(row, 0)),
      users: Math.round(metric(row, 1)),
      pageViews: Math.round(metric(row, 2)),
      bounceRate: toPercent(metric(row, 3)),
      avgSessionDuration: Math.round(metric(row, 4)),
      engagementRate: toPercent(metric(row, 5)),
    });
  }

  const result: GoogleAnalyticsDailyPoint[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = dateDaysAgo(i);
    result.push(
      indexed.get(date) || {
        date,
        sessions: 0,
        users: 0,
        pageViews: 0,
        bounceRate: 0,
        avgSessionDuration: 0,
        engagementRate: 0,
      },
    );
  }

  return result;
}

function calculatePercentRows<T extends { count: number }>(rows: T[]): Array<T & { percentage: number }> {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  return rows.map((row) => ({
    ...row,
    percentage: total > 0 ? round((row.count / total) * 100, 1) : 0,
  }));
}

export async function getGoogleAnalyticsDashboard(days = DEFAULT_DAYS): Promise<GoogleAnalyticsDashboardData> {
  const clampedDays = clampDays(days);
  const propertyId = normalizePropertyId(config.ga.propertyId);

  if (!propertyId) {
    return buildUnavailableResponse(
      clampedDays,
      'GA_PROPERTY_ID is not configured. Add the numeric GA4 property id in environment settings.',
      null,
    );
  }

  let client: BetaAnalyticsDataClient;
  try {
    client = await getClient();
  } catch (err: any) {
    return buildUnavailableResponse(clampedDays, err?.message || 'Unable to initialize Google Analytics client.', propertyId);
  }

  try {
    const [dailyReportRes, summaryReportRes, trafficSourcesRes, devicesRes, countriesRes, browsersRes, topPagesRes, realtimeRes] =
      await Promise.all([
        client.runReport({
          property: propertyId,
          dateRanges: [{ startDate: `${clampedDays - 1}daysAgo`, endDate: 'today' }],
          dimensions: [{ name: 'date' }],
          metrics: [
            { name: 'sessions' },
            { name: 'totalUsers' },
            { name: 'screenPageViews' },
            { name: 'bounceRate' },
            { name: 'averageSessionDuration' },
            { name: 'engagementRate' },
          ],
        }),
        client.runReport({
          property: propertyId,
          dateRanges: [{ startDate: `${clampedDays - 1}daysAgo`, endDate: 'today' }],
          metrics: [
            { name: 'sessions' },
            { name: 'totalUsers' },
            { name: 'screenPageViews' },
            { name: 'bounceRate' },
            { name: 'averageSessionDuration' },
            { name: 'engagementRate' },
          ],
        }),
        client.runReport({
          property: propertyId,
          dateRanges: [{ startDate: `${clampedDays - 1}daysAgo`, endDate: 'today' }],
          dimensions: [{ name: 'sessionDefaultChannelGroup' }],
          metrics: [{ name: 'sessions' }],
          limit: 8,
        }),
        client.runReport({
          property: propertyId,
          dateRanges: [{ startDate: `${clampedDays - 1}daysAgo`, endDate: 'today' }],
          dimensions: [{ name: 'deviceCategory' }],
          metrics: [{ name: 'sessions' }],
          limit: 6,
        }),
        client.runReport({
          property: propertyId,
          dateRanges: [{ startDate: `${clampedDays - 1}daysAgo`, endDate: 'today' }],
          dimensions: [{ name: 'country' }],
          metrics: [{ name: 'totalUsers' }],
          limit: 8,
        }),
        client.runReport({
          property: propertyId,
          dateRanges: [{ startDate: `${clampedDays - 1}daysAgo`, endDate: 'today' }],
          dimensions: [{ name: 'browser' }],
          metrics: [{ name: 'sessions' }],
          limit: 6,
        }),
        client.runReport({
          property: propertyId,
          dateRanges: [{ startDate: `${clampedDays - 1}daysAgo`, endDate: 'today' }],
          dimensions: [{ name: 'pagePath' }, { name: 'pageTitle' }],
          metrics: [{ name: 'screenPageViews' }, { name: 'averageSessionDuration' }],
          limit: 12,
        }),
        client.runRealtimeReport({
          property: propertyId,
          metrics: [{ name: 'activeUsers' }],
        }),
      ]);

    const dailyData = toDailyData(dailyReportRes[0]?.rows, clampedDays);

    const summaryRow = summaryReportRes[0]?.rows?.[0];
    const totalSessions = Math.round(metric(summaryRow, 0));
    const totalUsers = Math.round(metric(summaryRow, 1));
    const totalPageViews = Math.round(metric(summaryRow, 2));
    const avgBounceRate = toPercent(metric(summaryRow, 3));
    const avgSessionDuration = Math.round(metric(summaryRow, 4));
    const engagementRate = toPercent(metric(summaryRow, 5));

    const trafficSources = calculatePercentRows(
      (trafficSourcesRes[0]?.rows || [])
        .map((row: any) => ({ source: dimension(row, 0) || 'Unknown', count: Math.round(metric(row, 0)) }))
        .sort((a: any, b: any) => b.count - a.count),
    ).map((row) => ({
      source: row.source,
      sessions: row.count,
      percentage: row.percentage,
    }));

    const devices = calculatePercentRows(
      (devicesRes[0]?.rows || [])
        .map((row: any) => ({ device: dimension(row, 0) || 'Unknown', count: Math.round(metric(row, 0)) }))
        .sort((a: any, b: any) => b.count - a.count),
    ).map((row) => ({
      device: row.device,
      sessions: row.count,
      percentage: row.percentage,
    }));

    const countries = calculatePercentRows(
      (countriesRes[0]?.rows || [])
        .map((row: any) => ({ country: dimension(row, 0) || 'Unknown', count: Math.round(metric(row, 0)) }))
        .sort((a: any, b: any) => b.count - a.count),
    ).map((row) => ({
      country: row.country,
      users: row.count,
      percentage: row.percentage,
    }));

    const browsers = calculatePercentRows(
      (browsersRes[0]?.rows || [])
        .map((row: any) => ({ browser: dimension(row, 0) || 'Unknown', count: Math.round(metric(row, 0)) }))
        .sort((a: any, b: any) => b.count - a.count),
    ).map((row) => ({
      browser: row.browser,
      sessions: row.count,
      percentage: row.percentage,
    }));

    const topPages = (topPagesRes[0]?.rows || [])
      .map((row: any) => ({
        page: dimension(row, 0) || '/',
        title: dimension(row, 1) || 'Untitled',
        pageViews: Math.round(metric(row, 0)),
        avgTime: Math.round(metric(row, 1)),
      }))
      .sort((a: any, b: any) => b.pageViews - a.pageViews)
      .slice(0, 10);

    const activeUsers = Math.round(metric(realtimeRes[0]?.rows?.[0], 0));

    let topActivePages: { page: string; users: number }[] = [];
    try {
      const [realtimePagesRes] = await client.runRealtimeReport({
        property: propertyId,
        dimensions: [{ name: 'unifiedScreenName' }],
        metrics: [{ name: 'activeUsers' }],
        limit: 5,
      });

      topActivePages = (realtimePagesRes?.rows || [])
        .map((row: any) => ({
          page: dimension(row, 0) || 'Unknown',
          users: Math.round(metric(row, 0)),
        }))
        .filter((row) => row.users > 0);
    } catch {
      topActivePages = [];
    }

    return {
      reporting: {
        dateRange: {
          start: dailyData[0]?.date || dateDaysAgo(clampedDays - 1),
          end: dailyData[dailyData.length - 1]?.date || dateDaysAgo(0),
        },
        dailyData,
        summary: {
          totalSessions,
          totalUsers,
          totalPageViews,
          avgBounceRate,
          avgSessionDuration,
          pagesPerSession: totalSessions > 0 ? round(totalPageViews / totalSessions, 2) : 0,
          engagementRate,
        },
      },
      demographics: {
        countries,
        devices,
        browsers,
      },
      trafficSources,
      topPages,
      realtime: {
        activeUsers,
        topActivePages,
      },
      isConfigured: true,
      dataSource: 'ga4',
      propertyId,
      measurementId: config.ga.measurementId,
      queriedAt: new Date().toISOString(),
      note: 'Direct GA4 data via Google Analytics Data API.',
    };
  } catch (err: any) {
    logger.error({ err: err?.message, propertyId }, 'Google Analytics Data API error');
    return buildUnavailableResponse(
      clampedDays,
      `Google Analytics request failed: ${err?.message || 'Unknown error'}`,
      propertyId,
    );
  }
}
