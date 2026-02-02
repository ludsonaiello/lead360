'use client';

import { useState } from 'react';
import { Download, FileText, FileSpreadsheet, FileImage } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import ModalContent from '@/components/ui/ModalContent';
import ModalActions from '@/components/ui/ModalActions';
import Button from '@/components/ui/Button';
import SuccessModal from '@/components/ui/SuccessModal';
import { exportDashboard } from '@/lib/api/quotes-dashboard';
import type { ExportDashboardDto } from '@/lib/types/quotes';

interface ExportDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  dateFrom?: string;
  dateTo?: string;
}

type FormatType = 'csv' | 'xlsx' | 'pdf';

const sections = [
  { id: 'overview', label: 'Overview & KPIs', checked: true },
  { id: 'charts', label: 'All Charts', checked: true },
  { id: 'items', label: 'Top Items', checked: true },
];

export default function ExportDashboardModal({
  isOpen,
  onClose,
  dateFrom,
  dateTo,
}: ExportDashboardModalProps) {
  const [selectedFormat, setSelectedFormat] = useState<FormatType>('csv');
  const [selectedSections, setSelectedSections] = useState<string[]>([
    'overview',
    'charts',
    'items',
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successModalOpen, setSuccessModalOpen] = useState(false);

  const formats: Array<{ key: FormatType; label: string; icon: any }> = [
    { key: 'csv', label: 'CSV', icon: FileText },
    { key: 'xlsx', label: 'Excel (XLSX)', icon: FileSpreadsheet },
    { key: 'pdf', label: 'PDF', icon: FileImage },
  ];

  const handleSectionToggle = (sectionId: string) => {
    setSelectedSections((prev) => {
      if (prev.includes(sectionId)) {
        return prev.filter((id) => id !== sectionId);
      } else {
        return [...prev, sectionId];
      }
    });
  };

  const handleExport = async () => {
    if (selectedSections.length === 0) {
      setError('Please select at least one section to export');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const dto: ExportDashboardDto = {
        format: selectedFormat,
        date_from: dateFrom,
        date_to: dateTo,
        sections: selectedSections,
      };

      const response = await exportDashboard(dto);

      // Download the file
      window.open(response.download_url, '_blank');

      // Close export modal and show success
      onClose();
      setSuccessModalOpen(true);
    } catch (err: any) {
      console.error('Export error:', err);
      setError(err.response?.data?.message || 'Failed to export dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setError(null);
      onClose();
    }
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={handleClose} title="Export Dashboard">
      <ModalContent>
        <div className="space-y-6">
          {/* Format Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Export Format
            </label>
            <div className="grid grid-cols-3 gap-3">
              {formats.map((format) => {
                const Icon = format.icon;
                return (
                  <button
                    key={format.key}
                    onClick={() => setSelectedFormat(format.key)}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      selectedFormat === format.key
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <Icon
                      className={`w-8 h-8 mx-auto mb-2 ${
                        selectedFormat === format.key
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-gray-400'
                      }`}
                    />
                    <p
                      className={`text-sm font-medium ${
                        selectedFormat === format.key
                          ? 'text-blue-900 dark:text-blue-100'
                          : 'text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {format.label}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sections Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Include Sections
            </label>
            <div className="space-y-2">
              {sections.map((section) => (
                <label
                  key={section.id}
                  className="flex items-center p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedSections.includes(section.id)}
                    onChange={() => handleSectionToggle(section.id)}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  />
                  <span className="ml-3 text-sm text-gray-700 dark:text-gray-300">
                    {section.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Date Range Info */}
          {dateFrom && dateTo && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                <span className="font-medium">Date Range:</span>{' '}
                {new Date(dateFrom).toLocaleDateString()} -{' '}
                {new Date(dateTo).toLocaleDateString()}
              </p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}
        </div>
      </ModalContent>

      <ModalActions>
        <Button variant="secondary" onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleExport}
          loading={loading}
          disabled={selectedSections.length === 0}
        >
          {!loading && <Download className="w-4 h-4" />}
          {loading ? 'Exporting...' : 'Export Dashboard'}
        </Button>
      </ModalActions>
      </Modal>

      {/* Success Modal */}
      <SuccessModal
        isOpen={successModalOpen}
        onClose={() => setSuccessModalOpen(false)}
        title="Export Successful"
        message={`Dashboard has been successfully exported as ${selectedFormat.toUpperCase()}. The file should begin downloading automatically.`}
      />
    </>
  );
}
