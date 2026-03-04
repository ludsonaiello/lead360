/**
 * Dashboard Page
 * Modern dashboard inspired by HousePro + Stripe - clean, data-dense, professional
 */

'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { Card, CardHeader, CardContent, CardFooter, StatCard } from '@/components/dashboard/Card';
import { Button } from '@/components/ui/Button';
import {
  Users, DollarSign, FileText, TrendingUp, ArrowRight, Calendar,
  Clock, CheckCircle, AlertCircle, Phone, Mail, MapPin,
  ArrowUpRight, ArrowDownRight, MoreVertical, Star, Activity
} from 'lucide-react';
import Link from 'next/link';
import { PendingApprovalsWidget } from '@/components/quotes/PendingApprovalsWidget';
import { CalendarDashboardWidget } from '@/components/calendar/CalendarDashboardWidget';
import { QuoteStatusBadge } from '@/components/quotes/QuoteStatusBadge';
import { getDashboardOverview, getRecentQuotes, formatMoney, formatPercentageChange, getCustomerName, getLocation, type DashboardOverview, type RecentQuote } from '@/lib/api/quotes-dashboard';

export default function DashboardPage() {
  const { user } = useAuth();
  const [quoteStats, setQuoteStats] = useState<DashboardOverview | null>(null);
  const [recentQuotes, setRecentQuotes] = useState<RecentQuote[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingQuotes, setLoadingQuotes] = useState(true);

  // Fetch quote dashboard stats
  useEffect(() => {
    const fetchQuoteStats = async () => {
      try {
        const data = await getDashboardOverview();
        setQuoteStats(data);
      } catch (error) {
        console.error('Failed to fetch quote statistics:', error);
      } finally {
        setLoadingStats(false);
      }
    };

    fetchQuoteStats();
  }, []);

  // Fetch recent quotes
  useEffect(() => {
    const fetchRecentQuotes = async () => {
      try {
        const data = await getRecentQuotes(5);
        setRecentQuotes(data);
      } catch (error) {
        console.error('Failed to fetch recent quotes:', error);
      } finally {
        setLoadingQuotes(false);
      }
    };

    fetchRecentQuotes();
  }, []);

  return (
    <div className="space-y-6">
      {/* Welcome Header with Quick Stats */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Welcome back, {user?.first_name}!
          </h1>
          <p className="mt-1 text-sm font-medium text-gray-600 dark:text-gray-400">
            Here's what's happening with your business today
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" size="sm">
            <Calendar className="w-4 h-4 mr-2" />
            Today
          </Button>
          <Button size="sm">
            + New Lead
          </Button>
        </div>
      </div>

      {/* Key Metrics - 4 column grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Quote Revenue"
          value={loadingStats ? '...' : quoteStats ? formatMoney(quoteStats.total_revenue) : '$0'}
          change={
            quoteStats
              ? {
                  value: `Last 30 days`,
                  trend: 'neutral' as const,
                }
              : undefined
          }
          icon={<DollarSign className="w-6 h-6" />}
        />
        <StatCard
          title="Total Quotes"
          value={loadingStats ? '...' : quoteStats ? quoteStats.total_quotes.toString() : '0'}
          change={
            quoteStats
              ? {
                  value: `${quoteStats.by_status.reduce((sum, s) => sum + s.count, 0)} total`,
                  trend: 'neutral' as const,
                }
              : undefined
          }
          icon={<FileText className="w-6 h-6" />}
        />
        <StatCard
          title="Avg Quote Value"
          value={loadingStats ? '...' : quoteStats ? formatMoney(quoteStats.avg_quote_value) : '$0'}
          change={
            quoteStats
              ? {
                  value: `${quoteStats.total_quotes} quotes`,
                  trend: 'neutral' as const,
                }
              : undefined
          }
          icon={<TrendingUp className="w-6 h-6" />}
        />
        <StatCard
          title="Conversion Rate"
          value={loadingStats ? '...' : quoteStats ? `${quoteStats.conversion_rate.toFixed(1)}%` : '0%'}
          change={
            quoteStats
              ? {
                  value: 'Last 30 days',
                  trend: 'neutral' as const,
                }
              : undefined
          }
          icon={<CheckCircle className="w-6 h-6" />}
        />
      </div>

      {/* Main Content - 2 column layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column - Recent Activity & Tasks (2/3 width) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Recent Quotes */}
          <Card>
            <CardHeader
              title="Recent Quotes"
              description="Latest quotes with customer and vendor details"
              action={
                <Link href="/quotes" className="text-sm font-bold text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300">
                  View all
                </Link>
              }
            />
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-900/50 border-b-2 border-gray-200 dark:border-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                        Quote
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                        Customer
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                        Location
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                        Value
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {loadingQuotes ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-brand-600"></div>
                            <span className="text-sm text-gray-600 dark:text-gray-400">Loading quotes...</span>
                          </div>
                        </td>
                      </tr>
                    ) : recentQuotes.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-600 dark:text-gray-400">
                          No quotes yet
                        </td>
                      </tr>
                    ) : (
                      recentQuotes.map((quote) => (
                        <tr key={quote.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <Link
                                href={`/quotes/${quote.id}`}
                                className="text-sm font-bold text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300"
                              >
                                {quote.quote_number}
                              </Link>
                              <div className="text-xs font-medium text-gray-600 dark:text-gray-400 truncate max-w-xs">
                                {quote.title}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {getCustomerName(quote)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-700 dark:text-gray-300">
                              {getLocation(quote)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-bold text-gray-900 dark:text-gray-100">
                              {formatMoney(quote.total)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <QuoteStatusBadge status={quote.status as any} />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <Link href={`/quotes/${quote.id}`}>
                              <button className="text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300">
                                <ArrowRight className="w-4 h-4" />
                              </button>
                            </Link>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Today's Schedule */}
          <Card>
            <CardHeader
              title="Today's Schedule"
              description={`${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`}
              action={
                <Button variant="ghost" size="sm">
                  <Calendar className="w-4 h-4 mr-2" />
                  View Calendar
                </Button>
              }
            />
            <CardContent>
              <div className="space-y-4">
                {[
                  { time: '09:00 AM', title: 'Client Meeting - Acme Corp', type: 'meeting', location: '123 Main St', duration: '1h' },
                  { time: '11:30 AM', title: 'HVAC Installation - Johnson Residence', type: 'job', location: '456 Oak Ave', duration: '3h' },
                  { time: '02:00 PM', title: 'Quote Follow-up - Sarah Davis', type: 'call', location: 'Phone Call', duration: '30m' },
                  { time: '04:00 PM', title: 'Team Standup Meeting', type: 'meeting', location: 'Office', duration: '30m' },
                ].map((event, index) => (
                  <div key={index} className="flex items-start gap-4 p-4 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-brand-500 dark:hover:border-brand-400 transition-all">
                    <div className="flex flex-col items-center gap-1 min-w-[70px]">
                      <Clock className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                      <span className="text-xs font-bold text-gray-900 dark:text-gray-100">{event.time}</span>
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-500">{event.duration}</span>
                    </div>
                    <div className={`flex-shrink-0 w-1 h-full rounded-full ${
                      event.type === 'meeting' ? 'bg-brand-500 dark:bg-brand-400' :
                      event.type === 'job' ? 'bg-success-500 dark:bg-success-400' :
                      'bg-warning-500 dark:bg-warning-400'
                    }`} />
                    <div className="flex-1">
                      <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">{event.title}</h4>
                      <div className="mt-1 flex items-center gap-1 text-xs font-medium text-gray-600 dark:text-gray-400">
                        <MapPin className="w-3 h-3" />
                        {event.location}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm">View</Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Stats & Insights (1/3 width) */}
        <div className="space-y-6">
          {/* Performance Overview */}
          <Card>
            <CardHeader title="This Month" description="Performance metrics" />
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Revenue Goal</span>
                  <span className="text-sm font-bold text-gray-900 dark:text-gray-100">$50,000</span>
                </div>
                <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-brand-500 to-brand-600 rounded-full" style={{ width: '90%' }} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-500">$45,231 completed</span>
                  <span className="text-xs font-bold text-success-600 dark:text-success-400">90%</span>
                </div>
              </div>

              <div className="pt-4 border-t-2 border-gray-200 dark:border-gray-700 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Leads Goal</span>
                  <span className="text-sm font-bold text-gray-900 dark:text-gray-100">300</span>
                </div>
                <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-success-500 to-success-600 rounded-full" style={{ width: '75%' }} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-500">225 leads generated</span>
                  <span className="text-xs font-bold text-success-600 dark:text-success-400">75%</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pending Approvals Widget - Sprint 4 */}
          <PendingApprovalsWidget autoRefreshInterval={30000} />

          {/* Calendar Dashboard Widget - Sprint 40 */}
          <CalendarDashboardWidget autoRefreshInterval={30000} />

          {/* Quick Actions */}
          <Card>
            <CardHeader title="Quick Actions" />
            <CardContent className="space-y-2">
              <Link
                href="/leads/new"
                className="flex items-center gap-3 p-3 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-brand-500 dark:hover:border-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/10 transition-all group"
              >
                <div className="p-2 rounded-lg bg-brand-50 dark:bg-brand-900/20 group-hover:bg-brand-100 dark:group-hover:bg-brand-900/30 transition-colors">
                  <Users className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-bold text-gray-900 dark:text-gray-100">Add New Lead</div>
                  <div className="text-xs font-medium text-gray-500 dark:text-gray-500">Create a new customer</div>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400 dark:text-gray-500 group-hover:text-brand-600 dark:group-hover:text-brand-400" />
              </Link>

              <Link
                href="/quotes/new"
                className="flex items-center gap-3 p-3 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-brand-500 dark:hover:border-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/10 transition-all group"
              >
                <div className="p-2 rounded-lg bg-brand-50 dark:bg-brand-900/20 group-hover:bg-brand-100 dark:group-hover:bg-brand-900/30 transition-colors">
                  <FileText className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-bold text-gray-900 dark:text-gray-100">Create Quote</div>
                  <div className="text-xs font-medium text-gray-500 dark:text-gray-500">Generate new estimate</div>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400 dark:text-gray-500 group-hover:text-brand-600 dark:group-hover:text-brand-400" />
              </Link>

              <Link
                href="/invoices/new"
                className="flex items-center gap-3 p-3 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-brand-500 dark:hover:border-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/10 transition-all group"
              >
                <div className="p-2 rounded-lg bg-brand-50 dark:bg-brand-900/20 group-hover:bg-brand-100 dark:group-hover:bg-brand-900/30 transition-colors">
                  <DollarSign className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-bold text-gray-900 dark:text-gray-100">New Invoice</div>
                  <div className="text-xs font-medium text-gray-500 dark:text-gray-500">Bill a customer</div>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400 dark:text-gray-500 group-hover:text-brand-600 dark:group-hover:text-brand-400" />
              </Link>
            </CardContent>
          </Card>

          {/* Top Customers */}
          <Card>
            <CardHeader
              title="Top Customers"
              description="Highest value this month"
              action={
                <Link href="/customers" className="text-xs font-bold text-brand-600 dark:text-brand-400">
                  View all
                </Link>
              }
            />
            <CardContent className="space-y-3">
              {[
                { name: 'Acme Corporation', value: '$12,450', jobs: 8 },
                { name: 'Johnson & Sons', value: '$8,920', jobs: 5 },
                { name: 'Smith Industries', value: '$6,730', jobs: 4 },
              ].map((customer, index) => (
                <div key={index} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center">
                    <span className="text-sm font-bold text-white">{customer.name.charAt(0)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">{customer.name}</div>
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-500">{customer.jobs} jobs completed</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-gray-900 dark:text-gray-100">{customer.value}</div>
                    <Star className="w-3 h-3 inline text-warning-500 dark:text-warning-400 fill-current" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
