/**
 * Files Page
 * Tenant file gallery - Owner, Admin, Bookkeeper only
 */

'use client';

import React, { useState, useRef } from 'react';
import { FileGallery, type FileGalleryRef } from '@/components/files/FileGallery';
import { FileUploader } from '@/components/files/FileUploader';
import { Modal, ModalContent } from '@/components/ui/Modal';
import type { FileCategory } from '@/lib/types/files';

export default function FilesPage() {
  const galleryRef = useRef<FileGalleryRef>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadCategory, setUploadCategory] = useState<FileCategory>('misc');

  const handleUploadClick = () => {
    setShowUploadModal(true);
  };

  const handleUploadComplete = async () => {
    setShowUploadModal(false);
    // Refresh gallery using ref
    await galleryRef.current?.refresh();
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Files</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Manage all your business files
        </p>
      </div>

      {/* Gallery */}
      <div className="flex-1 overflow-hidden">
        <FileGallery
          ref={galleryRef}
          showFilters={true}
          showBulkActions={true}
          showUploadButton={true}
          onUploadClick={handleUploadClick}
        />
      </div>

      {/* Upload Modal */}
      <Modal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        title="Upload File"
        size="lg"
      >
        <ModalContent>
          <div className="space-y-4">
            {/* Category Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                File Category
              </label>
              <select
                value={uploadCategory}
                onChange={(e) => setUploadCategory(e.target.value as FileCategory)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              >
                <option value="quote">Quote</option>
                <option value="invoice">Invoice</option>
                <option value="license">License</option>
                <option value="insurance">Insurance</option>
                <option value="logo">Logo</option>
                <option value="contract">Contract</option>
                <option value="receipt">Receipt</option>
                <option value="photo">Photo</option>
                <option value="report">Report</option>
                <option value="signature">Signature</option>
                <option value="misc">Miscellaneous</option>
              </select>
            </div>

            {/* File Uploader */}
            <FileUploader
              category={uploadCategory}
              onUploadComplete={handleUploadComplete}
              onCancel={() => setShowUploadModal(false)}
            />
          </div>
        </ModalContent>
      </Modal>
    </div>
  );
}
