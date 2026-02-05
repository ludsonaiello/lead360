/**
 * Quote Admin Reports Page
 * Generate and manage reports and exports
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Download, FileText, Calendar, Trash2 } from 'lucide-react';
import Card from '@/components/ui/Card';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Button from '@/components/ui/Button';
import { Tabs } from '@/components/ui/Tabs';
import { Modal, ModalContent, ModalActions } from '@/components/ui/Modal';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import Input from '@/components/ui/Input';
import { toast } from 'react-hot-toast';
import {
  generateAndDownloadReport,
  listReports,
  downloadReport,
  deleteReport,
  listScheduledReports,
  createScheduledReport,
  deleteScheduledReport,
} from '@/lib/api/quote-admin-reports';
import type { ReportJob, ScheduledReport } from '@/lib/types/quote-admin';

// Helper function to normalize date to start of day in UTC
const getStartOfDayUTC = (date: Date): string => {
  const normalized = new Date(date);
  normalized.setUTCHours(0, 0, 0, 0);
  return normalized.toISOString();
};

// Helper function to normalize date to end of day in UTC (but not future)
const getEndOfDayUTC = (date: Date): string => {
  const normalized = new Date(date);
  normalized.setUTCHours(23, 59, 59, 999);

  // Ensure we don't send a future date
  const now = new Date();
  if (normalized > now) {
    return now.toISOString();
  }

  return normalized.toISOString();
};

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState('generate');
  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState<ReportJob[]>([]);
  const [scheduledReports, setScheduledReports] = useState<ScheduledReport[]>([]);

  // Generate Report State
  const [reportType, setReportType] = useState<'tenant_performance' | 'revenue_analysis' | 'conversion_analysis'>('tenant_performance');
  const [format, setFormat] = useState<'csv' | 'xlsx' | 'pdf'>('xlsx');
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    to: new Date(),
  });
  const [progress, setProgress] = useState(0);
  const [generatingReport, setGeneratingReport] = useState(false);

  // Schedule Report State
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [scheduleName, setScheduleName] = useState('');
  const [scheduleFrequency, setScheduleFrequency] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [scheduleRecipients, setScheduleRecipients] = useState('');

  useEffect(() => {
    if (activeTab === 'recent') {
      loadReports();
    } else if (activeTab === 'scheduled') {
      loadScheduledReports();
    }
  }, [activeTab]);

  const loadReports = async () => {
    try {
      setLoading(true);
      const result = await listReports({ limit: 20 });
      setReports(result.reports || []); // Defensive: ensure array
    } catch (error: any) {
      toast.error(error.message || 'Failed to load reports');
      setReports([]); // Reset to empty array on error
    } finally {
      setLoading(false);
    }
  };

  const loadScheduledReports = async () => {
    try {
      setLoading(true);
      const result = await listScheduledReports(); // No parameters needed
      setScheduledReports(result.reports || []); // Defensive: ensure array (backend returns 'reports')
    } catch (error: any) {
      toast.error(error.message || 'Failed to load scheduled reports');
      setScheduledReports([]); // Reset to empty array on error
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    try {
      setGeneratingReport(true);
      setProgress(0);

      await generateAndDownloadReport(
        {
          report_type: reportType,
          date_from: getStartOfDayUTC(dateRange.from),
          date_to: getEndOfDayUTC(dateRange.to),
          format,
        },
        undefined,
        (job) => {
          setProgress(job.progress || 0);
        }
      );

      toast.success('Report downloaded successfully');
      setProgress(0);
    } catch (error: any) {
      toast.error(error.message || 'Failed to generate report');
    } finally {
      setGeneratingReport(false);
    }
  };

  const handleCreateSchedule = async () => {
    if (!scheduleName.trim() || !scheduleRecipients.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    const recipients = scheduleRecipients.split(',').map(e => e.trim()).filter(Boolean);

    try {
      setLoading(true);
      await createScheduledReport({
        name: scheduleName,
        report_type: reportType,
        schedule: scheduleFrequency,
        format,
        recipients,
        parameters: {
          date_from: 'relative:-30d',
          date_to: 'relative:now',
        },
      });
      toast.success('Scheduled report created');
      setScheduleModalOpen(false);
      setScheduleName('');
      setScheduleRecipients('');
      loadScheduledReports();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create scheduled report');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSchedule = async (scheduleId: string) => {
    try {
      await deleteScheduledReport(scheduleId);
      toast.success('Scheduled report deleted');
      loadScheduledReports();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete scheduled report');
    }
  };

  const tabs = [
    { id: 'generate', label: 'Generate Report', icon: FileText },
    { id: 'recent', label: 'Recent Reports', icon: Download },
    { id: 'scheduled', label: 'Scheduled Reports', icon: Calendar },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Reports & Exports</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Generate custom reports and manage scheduled exports
        </p>
      </div>

      {/* Tabs */}
      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* Generate Tab */}
      {activeTab === 'generate' && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Generate New Report
          </h3>
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Report Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Report Type
                </label>
                <select
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value as any)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value="tenant_performance">Tenant Performance</option>
                  <option value="revenue_analysis">Revenue Analysis</option>
                  <option value="conversion_analysis">Conversion Analysis</option>
                </select>
              </div>

              {/* Format */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Format
                </label>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value as any)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value="csv">CSV</option>
                  <option value="xlsx">Excel (XLSX)</option>
                  <option value="pdf">PDF</option>
                </select>
              </div>
            </div>

            {/* Date Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Date Range
              </label>
              <DateRangePicker
                startDate={dateRange.from}
                endDate={dateRange.to}
                onChange={(start, end) => {
                  if (start && end) {
                    setDateRange({ from: start, to: end });
                  }
                }}
              />
            </div>

            {/* Progress */}
            {generatingReport && (
              <div>
                <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
                  <span>Generating report...</span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <Button onClick={handleGenerateReport} loading={generatingReport} className="flex-1">
                <Download className="w-4 h-4" />
                Generate & Download
              </Button>
              <Button onClick={() => setScheduleModalOpen(true)} variant="secondary">
                <Calendar className="w-4 h-4" />
                Schedule Report
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Recent Reports Tab */}
      {activeTab === 'recent' && (
        <Card className="overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : !reports || reports.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600 dark:text-gray-400">No reports generated yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Report Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Created
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {reports.map((report) => (
                    <tr key={report.job_id}>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                        {report.report_type?.replace('_', ' ') || 'Unknown'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          report.status === 'completed'
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                            : report.status === 'failed'
                            ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                            : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                        }`}>
                          {report.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                        {report.created_at ? new Date(report.created_at).toLocaleString() : 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {report.status === 'completed' && report.download_url && (
                          <button
                            onClick={async () => {
                              try {
                                const blob = await downloadReport(report.job_id);
                                const url = window.URL.createObjectURL(blob);
                                const link = document.createElement('a');
                                link.href = url;
                                link.download = `report-${report.job_id}.${report.format || 'xlsx'}`;
                                link.click();
                                window.URL.revokeObjectURL(url);
                              } catch (error: any) {
                                toast.error('Download failed');
                              }
                            }}
                            className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Scheduled Reports Tab */}
      {activeTab === 'scheduled' && (
        <Card className="overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : !scheduledReports || scheduledReports.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600 dark:text-gray-400">No scheduled reports</p>
              <Button onClick={() => setScheduleModalOpen(true)} className="mt-4">
                Create Schedule
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Frequency
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Next Run
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {scheduledReports.map((schedule) => (
                    <tr key={schedule.id}>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                        {schedule.name}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                        {schedule.schedule}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                        {new Date(schedule.next_run_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleDeleteSchedule(schedule.id)}
                          className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Schedule Modal */}
      <Modal
        isOpen={scheduleModalOpen}
        onClose={() => setScheduleModalOpen(false)}
        title="Schedule Report"
      >
        <ModalContent>
          <div className="space-y-4">
            <Input
              label="Schedule Name"
              value={scheduleName}
              onChange={(e) => setScheduleName(e.target.value)}
              placeholder="Monthly Quote Summary"
              required
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Frequency
              </label>
              <select
                value={scheduleFrequency}
                onChange={(e) => setScheduleFrequency(e.target.value as any)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <Input
              label="Recipients (comma-separated emails)"
              value={scheduleRecipients}
              onChange={(e) => setScheduleRecipients(e.target.value)}
              placeholder="admin@example.com, manager@example.com"
              required
            />
          </div>
        </ModalContent>
        <ModalActions>
          <Button variant="secondary" onClick={() => setScheduleModalOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreateSchedule} loading={loading}>
            Create Schedule
          </Button>
        </ModalActions>
      </Modal>
    </div>
  );
}
