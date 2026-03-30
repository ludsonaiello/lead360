/**
 * ReceiptUploadModal Component
 * Sprint 12 — Receipt upload with OCR processing, results display,
 * create entry from receipt, link to existing entry, retry OCR, manual entry.
 *
 * Multi-phase modal:
 *   Phase 1: Upload (drag-drop, file preview, optional fields)
 *   Phase 2: OCR Polling (progress, status indicator)
 *   Phase 3: OCR Results (extracted data, create/link entry)
 *   Phase 4: Failed OCR (retry, manual entry)
 *   Phase 5: Create Entry from Receipt form
 *   Phase 6: Link to Existing Entry
 */

'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Upload,
  Camera,
  FileText,
  X,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Link2,
  PenLine,
  Loader2,
  Eye,
  Clock,
  Info,
  Users,
  UserCircle,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { Modal, ModalActions } from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import type { SelectOption } from '@/components/ui/Select';
import { MoneyInput } from '@/components/ui/MoneyInput';
import { DatePicker } from '@/components/ui/DatePicker';
import { Textarea } from '@/components/ui/Textarea';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { CameraCaptureModal } from './CameraCaptureModal';

import { useRBAC } from '@/contexts/RBACContext';

import {
  uploadReceipt,
  deleteReceipt,
  getOcrStatus,
  getReceipt,
  createEntryFromReceipt,
  retryOcr,
  linkReceiptToEntry,
  getFinancialEntries,
  getFinancialCategories,
  getPaymentMethods,
  getSuppliers,
  createLineItem,
} from '@/lib/api/financial';
import { getAccessToken } from '@/lib/utils/token';
import { getProjects, getProjectTasks } from '@/lib/api/projects';
import { listUsers } from '@/lib/api/users';
import { getCrewMembers } from '@/lib/api/crew';
import { buildFileUrl } from '@/lib/api/files';

import type {
  Receipt,
  OcrStatusResponse,
  FinancialEntry,
  FinancialCategory,
  PaymentMethodRegistry,
  CreateEntryFromReceiptDto,
  CategoryType,
  PaymentMethodType,
} from '@/lib/types/financial';
import LineItemsSection, {
  type LocalLineItem,
  localItemToCreateDto,
} from '@/app/(dashboard)/projects/[id]/components/financial/LineItemsSection';
import type { Project, ProjectTask } from '@/lib/types/projects';
import type { MembershipItem } from '@/lib/types/users';
import type { CrewMember } from '@/lib/types/crew';

// ========== TYPES ==========

type PurchasedByMode = 'none' | 'team' | 'crew';

type ModalPhase =
  | 'upload'
  | 'polling'
  | 'ocr_complete'
  | 'ocr_failed'
  | 'ocr_not_processed'
  | 'create_entry'
  | 'link_entry';

interface ReceiptUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultProjectId?: string;
  defaultTaskId?: string;
  /** Custom upload function (e.g., task-scoped uploadTaskReceipt). When provided, project_id/task_id are NOT appended to FormData. */
  customUploadFn?: (formData: FormData) => Promise<Receipt>;
}

// ========== CONSTANTS ==========

const ACCEPTED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_FILE_SIZE_MB = 25;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const OCR_POLL_INTERVAL_MS = 3000;
const OCR_MAX_POLLS = 20;

const CAN_MANAGE_ROLES = ['Owner', 'Admin', 'Manager', 'Bookkeeper'];

const CATEGORY_TYPE_LABELS: Record<CategoryType, string> = {
  labor: 'Labor',
  material: 'Material',
  subcontractor: 'Subcontractor',
  equipment: 'Equipment',
  insurance: 'Insurance',
  fuel: 'Fuel',
  utilities: 'Utilities',
  office: 'Office',
  marketing: 'Marketing',
  taxes: 'Taxes',
  tools: 'Tools',
  other: 'Other',
};

const PAYMENT_METHOD_TYPE_OPTIONS: SelectOption[] = [
  { value: '', label: 'Select payment type...' },
  { value: 'cash', label: 'Cash' },
  { value: 'check', label: 'Check' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'venmo', label: 'Venmo' },
  { value: 'zelle', label: 'Zelle' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'debit_card', label: 'Debit Card' },
  { value: 'ACH', label: 'ACH' },
];

// ========== HELPERS ==========

function formatCurrency(value: number | string | null): string {
  if (value === null || value === undefined) return '$0.00';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(num);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatPaymentAccountLabel(pm: PaymentMethodRegistry): string {
  const parts: string[] = [];
  if (pm.bank_name) parts.push(pm.bank_name);
  if (pm.nickname) parts.push(pm.nickname);
  if (pm.last_four) parts.push(`···· ${pm.last_four}`);
  if (parts.length === 0) {
    return pm.type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return parts.join(' ');
}

// ========== COMPONENT ==========

export function ReceiptUploadModal({
  isOpen,
  onClose,
  onSuccess,
  defaultProjectId,
  defaultTaskId,
  customUploadFn,
}: ReceiptUploadModalProps) {
  const { hasRole } = useRBAC();
  const canManage = hasRole(CAN_MANAGE_ROLES);

  // ----- Modal phase -----
  const [phase, setPhase] = useState<ModalPhase>('upload');

  // ----- Upload phase state -----
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProjectId, setUploadProjectId] = useState(defaultProjectId || '');
  const [uploadTaskId, setUploadTaskId] = useState(defaultTaskId || '');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  // ----- Camera capture modal -----
  const [cameraModalOpen, setCameraModalOpen] = useState(false);

  // ----- Receipt data after upload -----
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const receiptRef = useRef<Receipt | null>(null);
  const committedRef = useRef(false);

  // ----- OCR polling state -----
  const [ocrStatus, setOcrStatus] = useState<OcrStatusResponse | null>(null);
  const [pollCount, setPollCount] = useState(0);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [pollTimedOut, setPollTimedOut] = useState(false);

  // ----- Create Entry form state -----
  const [entryProjectId, setEntryProjectId] = useState('');
  const [entryTaskId, setEntryTaskId] = useState('');
  const [entryCategoryId, setEntryCategoryId] = useState('');
  const [entryAmount, setEntryAmount] = useState(0);
  const [entryTaxAmount, setEntryTaxAmount] = useState(0);
  const [entryEntryType, setEntryEntryType] = useState<'expense' | 'income'>('expense');
  const [entryDate, setEntryDate] = useState('');
  const [entryVendor, setEntryVendor] = useState('');
  const [entrySupplierId, setEntrySupplierId] = useState('');
  const [entryPaymentMethod, setEntryPaymentMethod] = useState('');
  const [entryPaymentMethodRegistryId, setEntryPaymentMethodRegistryId] = useState('');
  const [entryNotes, setEntryNotes] = useState('');
  const [entryTime, setEntryTime] = useState('');
  const [entryDiscount, setEntryDiscount] = useState(0);
  const [entryPurchasedByMode, setEntryPurchasedByMode] = useState<PurchasedByMode>('none');
  const [entryPurchasedByUserId, setEntryPurchasedByUserId] = useState('');
  const [entryPurchasedByCrewId, setEntryPurchasedByCrewId] = useState('');
  const [entryErrors, setEntryErrors] = useState<Record<string, string>>({});
  const [creatingEntry, setCreatingEntry] = useState(false);
  const [entryLineItems, setEntryLineItems] = useState<LocalLineItem[]>([]);
  const [hasOcrItems, setHasOcrItems] = useState(false);

  // ----- Link Entry state -----
  const [linkEntries, setLinkEntries] = useState<FinancialEntry[]>([]);
  const [linkEntriesLoading, setLinkEntriesLoading] = useState(false);
  const [selectedLinkEntryId, setSelectedLinkEntryId] = useState('');
  const [linkSearchQuery, setLinkSearchQuery] = useState('');
  const [linking, setLinking] = useState(false);

  // ----- Reference data (loaded lazily) -----
  const [projects, setProjects] = useState<Project[]>([]);
  const [categories, setCategories] = useState<FinancialCategory[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodRegistry[]>([]);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [teamMembers, setTeamMembers] = useState<MembershipItem[]>([]);
  const [crewMembers, setCrewMembers] = useState<CrewMember[]>([]);
  const [refDataLoaded, setRefDataLoaded] = useState(false);

  // ===== RESET ALL STATE =====
  const resetAll = useCallback(() => {
    setPhase('upload');
    setSelectedFile(null);
    setFilePreview(null);
    setIsDragging(false);
    setCameraModalOpen(false);
    setUploading(false);
    setUploadProgress(0);
    setUploadProjectId(defaultProjectId || '');
    setUploadTaskId(defaultTaskId || '');
    setReceipt(null);
    setOcrStatus(null);
    setPollCount(0);
    setPollTimedOut(false);
    setEntryProjectId('');
    setEntryTaskId('');
    setEntryCategoryId('');
    setEntryAmount(0);
    setEntryTaxAmount(0);
    setEntryEntryType('expense');
    setEntryDate('');
    setEntryVendor('');
    setEntrySupplierId('');
    setEntryPaymentMethod('');
    setEntryPaymentMethodRegistryId('');
    setEntryNotes('');
    setEntryTime('');
    setEntryDiscount(0);
    setEntryPurchasedByMode('none');
    setEntryPurchasedByUserId('');
    setEntryPurchasedByCrewId('');
    setEntryErrors({});
    setCreatingEntry(false);
    setEntryLineItems([]);
    setHasOcrItems(false);
    committedRef.current = false;
    setLinkEntries([]);
    setLinkEntriesLoading(false);
    setSelectedLinkEntryId('');
    setLinkSearchQuery('');
    setLinking(false);
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  }, [defaultProjectId, defaultTaskId]);

  // Reset on open/close
  useEffect(() => {
    if (isOpen) {
      resetAll();
    } else {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    }
  }, [isOpen, resetAll]);

  // ===== KEEP RECEIPT REF IN SYNC =====
  useEffect(() => {
    receiptRef.current = receipt;
  }, [receipt]);

  // ===== ORPHAN RECEIPT CLEANUP HELPER =====
  const cleanupOrphanReceipt = useCallback(async (receiptId: string) => {
    try {
      await deleteReceipt(receiptId);
    } catch {
      // Silent — receipt may already be linked, deleted, or user lacks permission.
      // Backend cleanup cron catches anything missed.
    }
  }, []);

  // ===== WARN ON BROWSER CLOSE WITH UNCOMMITTED RECEIPT =====
  useEffect(() => {
    const hasUncommitted = receipt !== null && !committedRef.current;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    if (hasUncommitted) {
      window.addEventListener('beforeunload', handler);
    }
    return () => window.removeEventListener('beforeunload', handler);
  }, [receipt]);

  // ===== CLEANUP ON COMPONENT UNMOUNT =====
  useEffect(() => {
    return () => {
      const r = receiptRef.current;
      if (r && !committedRef.current) {
        const token = getAccessToken();
        if (token) {
          const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.lead360.app/api/v1';
          fetch(`${baseUrl}/financial/receipts/${r.id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
            keepalive: true,
          }).catch(() => {});
        }
      }
    };
  }, []);

  // ===== LOAD PROJECTS FOR UPLOAD =====
  useEffect(() => {
    if (!isOpen) return;
    getProjects({ limit: 200 })
      .then((res) => setProjects(res.data))
      .catch(() => setProjects([]));
  }, [isOpen]);

  // ===== LOAD TASKS FOR CREATE-ENTRY FORM =====
  const [entryTasks, setEntryTasks] = useState<ProjectTask[]>([]);
  const [entryTasksLoading, setEntryTasksLoading] = useState(false);

  useEffect(() => {
    if (!entryProjectId) {
      setEntryTasks([]);
      return;
    }
    setEntryTasksLoading(true);
    getProjectTasks(entryProjectId, { limit: 200 })
      .then((res) => setEntryTasks(res.data))
      .catch(() => setEntryTasks([]))
      .finally(() => setEntryTasksLoading(false));
  }, [entryProjectId]);

  // ===== LOAD REFERENCE DATA (lazy, for create-entry phase) =====
  const loadRefData = useCallback(async () => {
    if (refDataLoaded) return;
    try {
      const [cats, pms, sups, team, crew] = await Promise.all([
        getFinancialCategories().catch(() => [] as FinancialCategory[]),
        getPaymentMethods().catch(() => [] as PaymentMethodRegistry[]),
        getSuppliers({ limit: 100, is_active: true })
          .then((res) => res.data.map((s) => ({ id: s.id, name: s.name })))
          .catch(() => [] as { id: string; name: string }[]),
        listUsers({ limit: 100 }).then((res) => res.data).catch(() => [] as MembershipItem[]),
        getCrewMembers({ limit: 100, is_active: true }).then((res) => res.data).catch(() => [] as CrewMember[]),
      ]);
      setCategories(cats);
      setPaymentMethods(pms);
      setSuppliers(sups);
      setTeamMembers(team);
      setCrewMembers(crew);
      setRefDataLoaded(true);
    } catch {
      // Silently continue — fields will be empty
    }
  }, [refDataLoaded]);

  // ===== FILE VALIDATION =====
  const validateFile = (file: File): string | null => {
    if (!ACCEPTED_FILE_TYPES.includes(file.type)) {
      return 'Invalid file type. Accepted: JPG, PNG, WebP, PDF';
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return `File size must be under ${MAX_FILE_SIZE_MB} MB`;
    }
    return null;
  };

  // ===== FILE SELECTION =====
  const handleFileSelected = (file: File) => {
    const error = validateFile(file);
    if (error) {
      toast.error(error);
      return;
    }
    setSelectedFile(file);
    // Generate preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => setFilePreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelected(file);
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  // ===== DRAG & DROP =====
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current++;
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelected(file);
  };

  // ===== UPLOAD =====
  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setUploadProgress(0);

    // Simulate progress
    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + 10;
      });
    }, 200);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      // When customUploadFn is provided (task-scoped), skip project/task in FormData — they're in the URL
      if (!customUploadFn) {
        if (uploadProjectId) formData.append('project_id', uploadProjectId);
        if (uploadTaskId) formData.append('task_id', uploadTaskId);
      }

      const result = customUploadFn ? await customUploadFn(formData) : await uploadReceipt(formData);
      clearInterval(progressInterval);
      setUploadProgress(100);
      setUploading(false);
      setReceipt(result);
      toast.success('Receipt uploaded successfully');

      // Transition to polling phase
      startOcrPolling(result.id);
    } catch (err: unknown) {
      clearInterval(progressInterval);
      const error = err as { message?: string };
      toast.error(error.message || 'Failed to upload receipt');
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // ===== OCR POLLING =====
  const startOcrPolling = useCallback((receiptId: string) => {
    // Clean up any existing polling interval before starting a new one
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }

    setPhase('polling');
    setPollCount(0);
    setPollTimedOut(false);

    let count = 0;

    const poll = async () => {
      count++;
      setPollCount(count);

      try {
        const status = await getOcrStatus(receiptId);
        setOcrStatus(status);

        if (status.ocr_status === 'complete') {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
          // Fetch full receipt to get all AI-parsed OCR fields
          // (polling endpoint only returns vendor/amount/date)
          try {
            const fullReceipt = await getReceipt(receiptId);
            setReceipt(fullReceipt);
          } catch {
            // Non-critical — we still have ocrStatus basics
          }
          setPhase('ocr_complete');
          return;
        }

        if (status.ocr_status === 'failed') {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
          setPhase('ocr_failed');
          return;
        }

        if (status.ocr_status === 'not_processed') {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
          setPhase('ocr_not_processed');
          return;
        }

        // Still processing — check timeout
        if (count >= OCR_MAX_POLLS) {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
          setPollTimedOut(true);
          return;
        }
      } catch {
        // Silently continue polling on error
      }
    };

    // Initial poll
    poll();
    // Start interval
    pollTimerRef.current = setInterval(poll, OCR_POLL_INTERVAL_MS);
  }, []);

  // ===== UPLOAD NEW IMAGE (go back to upload phase) =====
  const handleUploadNewImage = () => {
    // Clean up the current receipt before allowing a new upload
    if (receipt && !committedRef.current) {
      cleanupOrphanReceipt(receipt.id);
    }
    setSelectedFile(null);
    setFilePreview(null);
    setUploading(false);
    setUploadProgress(0);
    setReceipt(null);
    setOcrStatus(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    setPhase('upload');
  };

  // ===== CAMERA CAPTURE HANDLER =====
  const handleCameraCapture = (file: File) => {
    handleFileSelected(file);
    setCameraModalOpen(false);
  };

  // ===== RETRY OCR =====
  const handleRetryOcr = async () => {
    if (!receipt) return;
    try {
      const updated = await retryOcr(receipt.id);
      setReceipt(updated);
      toast.success('OCR re-queued');
      startOcrPolling(receipt.id);
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error.message || 'Failed to retry OCR');
    }
  };

  // ===== OPEN CREATE ENTRY FORM =====
  const openCreateEntryForm = async () => {
    await loadRefData();

    // Pre-populate from full receipt OCR data (receipt is refreshed after OCR completes)
    const r = receipt;
    const projectId = r?.project_id || uploadProjectId || '';
    const taskId = r?.task_id || uploadTaskId || '';
    const vendor = r?.ocr_vendor || r?.vendor_name || '';
    const amount = r?.ocr_amount ?? r?.amount ?? 0;
    const date = r?.ocr_date
      ? r.ocr_date.split('T')[0]
      : r?.receipt_date
        ? r.receipt_date.split('T')[0]
        : todayISO();

    setEntryProjectId(projectId);
    setEntryTaskId(taskId);
    setEntryVendor(vendor);
    setEntryAmount(typeof amount === 'number' ? amount : parseFloat(String(amount)) || 0);
    setEntryDate(date);
    setEntryCategoryId('');
    setEntryEntryType(r?.ocr_entry_type === 'refund' ? 'income' : 'expense');
    setEntryTaxAmount(r?.ocr_tax ?? 0);
    setEntryDiscount(r?.ocr_discount ?? 0);
    setEntryTime(r?.ocr_time || '');
    setEntrySupplierId('');
    setEntryPaymentMethod('');
    setEntryPaymentMethodRegistryId('');
    setEntryPurchasedByMode('none');
    setEntryPurchasedByUserId('');
    setEntryPurchasedByCrewId('');
    setEntryNotes(r?.ocr_notes || '');
    setEntryErrors({});

    // Pre-populate line items from OCR if available
    if (r?.ocr_line_items && r.ocr_line_items.length > 0) {
      const items: LocalLineItem[] = r.ocr_line_items.map((item, index) => ({
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total: item.total,
        unit_of_measure: '',
        notes: '',
        order_index: index,
      }));
      setEntryLineItems(items);
      setHasOcrItems(true);
    } else {
      setEntryLineItems([]);
      setHasOcrItems(false);
    }

    setPhase('create_entry');
  };

  // ===== OPEN MANUAL ENTRY (no OCR data) =====
  const openManualEntry = async () => {
    await loadRefData();

    const projectId = receipt?.project_id || uploadProjectId || '';
    const taskId = receipt?.task_id || uploadTaskId || '';

    setEntryProjectId(projectId);
    setEntryTaskId(taskId);
    setEntryVendor(receipt?.vendor_name || '');
    setEntryAmount(receipt?.amount ?? 0);
    setEntryDate(receipt?.receipt_date ? receipt.receipt_date.split('T')[0] : todayISO());
    setEntryCategoryId('');
    setEntryEntryType('expense');
    setEntryTaxAmount(0);
    setEntryDiscount(0);
    setEntryTime('');
    setEntrySupplierId('');
    setEntryPaymentMethod('');
    setEntryPaymentMethodRegistryId('');
    setEntryPurchasedByMode('none');
    setEntryPurchasedByUserId('');
    setEntryPurchasedByCrewId('');
    setEntryNotes('');
    setEntryErrors({});
    setEntryLineItems([]);
    setHasOcrItems(false);
    setPhase('create_entry');
  };

  // ===== VALIDATE CREATE ENTRY =====
  const validateEntryForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!entryCategoryId) newErrors.category_id = 'Category is required';
    if (entryAmount <= 0 && !(ocrStatus?.ocr_amount && ocrStatus.ocr_amount > 0)) {
      newErrors.amount = 'Amount is required';
    }
    if (entryTaskId && !entryProjectId) newErrors.task_id = 'Project is required when task is selected';
    setEntryErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ===== SUBMIT CREATE ENTRY FROM RECEIPT =====
  const handleCreateEntry = async () => {
    if (!receipt) return;
    if (!validateEntryForm()) return;

    setCreatingEntry(true);
    try {
      const dto: CreateEntryFromReceiptDto = {
        category_id: entryCategoryId,
      };

      if (entryProjectId) dto.project_id = entryProjectId;
      if (entryTaskId) dto.task_id = entryTaskId;
      if (entryAmount > 0) dto.amount = entryAmount;
      if (entryTaxAmount > 0) dto.tax_amount = entryTaxAmount;
      if (entryDiscount > 0) dto.discount = entryDiscount;
      if (entryDate) dto.entry_date = entryDate;
      if (entryVendor.trim()) dto.vendor_name = entryVendor.trim();
      if (entrySupplierId) dto.supplier_id = entrySupplierId;
      if (entryTime) dto.entry_time = entryTime;
      if (entryPaymentMethod) dto.payment_method = entryPaymentMethod as PaymentMethodType;
      if (entryPaymentMethodRegistryId) dto.payment_method_registry_id = entryPaymentMethodRegistryId;
      if (entryPurchasedByUserId) dto.purchased_by_user_id = entryPurchasedByUserId;
      if (entryPurchasedByCrewId) dto.purchased_by_crew_member_id = entryPurchasedByCrewId;
      if (entryNotes.trim()) dto.notes = entryNotes.trim();

      const result = await createEntryFromReceipt(receipt.id, dto);
      // entry_type is auto-resolved by backend from ocr_entry_type
      // ('refund' → 'income', 'expense' → 'expense') — no PATCH needed

      // Save line items on the newly created entry
      const validItems = entryLineItems.filter(i => i.description && i.total > 0);
      if (validItems.length > 0 && result.entry?.id) {
        for (const item of validItems) {
          await createLineItem(result.entry.id, localItemToCreateDto(item));
        }
      }

      toast.success('Financial entry created from receipt');
      committedRef.current = true;
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error.message || 'Failed to create entry from receipt');
    } finally {
      setCreatingEntry(false);
    }
  };

  // ===== OPEN LINK ENTRY =====
  const openLinkEntry = async () => {
    setPhase('link_entry');
    setLinkEntriesLoading(true);
    setSelectedLinkEntryId('');
    setLinkSearchQuery('');

    try {
      const data = await getFinancialEntries({ limit: 100, sort_by: 'entry_date', sort_order: 'desc' });
      // Filter entries that don't already have a receipt
      setLinkEntries(data.data.filter((e) => !e.has_receipt));
    } catch {
      toast.error('Failed to load entries');
      setLinkEntries([]);
    } finally {
      setLinkEntriesLoading(false);
    }
  };

  // ===== SUBMIT LINK =====
  const handleLinkEntry = async () => {
    if (!receipt || !selectedLinkEntryId) return;

    setLinking(true);
    try {
      await linkReceiptToEntry(receipt.id, { financial_entry_id: selectedLinkEntryId });
      toast.success('Receipt linked to entry');
      committedRef.current = true;
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error.message || 'Failed to link receipt');
    } finally {
      setLinking(false);
    }
  };

  // ===== RECEIPT IMAGE URL =====
  const getReceiptImageUrl = (r: Receipt): string => {
    return buildFileUrl(r.file_url);
  };

  // ===== SELECT OPTIONS =====
  const projectOptions: SelectOption[] = [
    { value: '', label: 'Select project...' },
    ...projects.map((p) => ({ value: p.id, label: p.name })),
  ];

  const entryTaskOptions: SelectOption[] = [
    { value: '', label: entryTasksLoading ? 'Loading tasks...' : 'Select task...' },
    ...entryTasks.map((t) => ({ value: t.id, label: t.title })),
  ];

  const categoryOptions: SelectOption[] = [
    { value: '', label: 'Select category...' },
    ...categories
      .filter((c) => c.is_active)
      .map((c) => ({
        value: c.id,
        label: `${c.name} (${CATEGORY_TYPE_LABELS[c.type]})`,
      })),
  ];

  const supplierOptions: SelectOption[] = [
    { value: '', label: 'None' },
    ...suppliers.map((s) => ({ value: s.id, label: s.name })),
  ];

  const paymentMethodRegistryOptions: SelectOption[] = [
    { value: '', label: 'None' },
    ...paymentMethods
      .filter((pm) => pm.is_active)
      .map((pm) => ({ value: pm.id, label: formatPaymentAccountLabel(pm) })),
  ];

  // Filter link entries by search
  const filteredLinkEntries = linkSearchQuery.trim()
    ? linkEntries.filter((e) => {
        const q = linkSearchQuery.toLowerCase();
        return (
          (e.vendor_name && e.vendor_name.toLowerCase().includes(q)) ||
          (e.category_name && e.category_name.toLowerCase().includes(q)) ||
          (e.project_name && e.project_name.toLowerCase().includes(q)) ||
          (e.notes && e.notes.toLowerCase().includes(q)) ||
          formatCurrency(e.amount).includes(q)
        );
      })
    : linkEntries;

  // ===== MODAL CLOSE HANDLER =====
  const handleClose = () => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    // Clean up orphan receipt if uploaded but never committed
    if (receipt && !committedRef.current) {
      cleanupOrphanReceipt(receipt.id);
    }
    onClose();
  };

  // ===== MODAL TITLE =====
  const getTitle = (): string => {
    switch (phase) {
      case 'upload':
        return 'Upload Receipt';
      case 'polling':
        return 'Processing Receipt...';
      case 'ocr_complete':
        return 'Receipt Analyzed';
      case 'ocr_failed':
        return 'OCR Processing Failed';
      case 'ocr_not_processed':
        return 'OCR Not Available';
      case 'create_entry':
        return 'Create Entry from Receipt';
      case 'link_entry':
        return 'Link to Existing Entry';
      default:
        return 'Upload Receipt';
    }
  };

  // ==========================================
  // RENDER: UPLOAD PHASE
  // ==========================================
  const renderUploadPhase = () => (
    <div className="space-y-4">
      {/* Drag & Drop Zone / File Preview */}
      {!selectedFile ? (
        <div
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`
            border-2 border-dashed rounded-lg p-8 transition-all duration-200 cursor-pointer
            ${isDragging
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
              : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 bg-gray-50 dark:bg-gray-700/50'}
          `}
          role="button"
          tabIndex={0}
          aria-label="Drop receipt file here or click to browse"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
        >
          <div className="text-center">
            <Upload className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 mb-3" />
            <p className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">
              {isDragging ? 'Drop your receipt here' : 'Drop file here or click to browse'}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              JPG, PNG, WebP, or PDF up to {MAX_FILE_SIZE_MB} MB
            </p>
          </div>
        </div>
      ) : (
        <div className="border-2 border-gray-300 dark:border-gray-600 rounded-lg p-4 bg-white dark:bg-gray-700">
          {/* File Preview */}
          {filePreview ? (
            <div className="flex justify-center mb-3">
              <img
                src={filePreview}
                alt="Receipt preview"
                className="max-h-48 rounded-lg object-contain border border-gray-200 dark:border-gray-600"
              />
            </div>
          ) : (
            <div className="flex items-center gap-3 mb-3">
              <FileText className="w-10 h-10 text-red-500 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                  {selectedFile.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">PDF Document</p>
              </div>
            </div>
          )}
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {selectedFile.name} ({formatFileSize(selectedFile.size)})
            </div>
            <button
              type="button"
              onClick={handleRemoveFile}
              className="p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600"
              aria-label="Remove file"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        onChange={handleFileInputChange}
        className="hidden"
        aria-hidden="true"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        onChange={handleFileInputChange}
        className="hidden"
        aria-hidden="true"
      />

      {/* Take Photo button — opens camera viewfinder */}
      <Button
        variant="secondary"
        size="sm"
        fullWidth
        onClick={() => setCameraModalOpen(true)}
      >
        <Camera className="w-4 h-4" />
        Take Photo with Camera
      </Button>

      {/* Receipt quality instructions */}
      <div className="bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
        <p className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-2">
          Tips for best OCR results
        </p>
        <ul className="text-xs text-amber-700 dark:text-amber-300 space-y-1.5 list-disc list-inside">
          <li>Upload as <strong>JPG, PNG, or PDF</strong> (max {MAX_FILE_SIZE_MB} MB)</li>
          <li>Receipt must be <strong>clean, flat, and fully visible</strong> — no folds or shadows</li>
          <li>All key details must be readable: <strong>store name, date, items, subtotal, tax, and total</strong></li>
          <li>If taking a photo, fit the entire receipt inside the frame and hold steady</li>
          <li>Avoid glare, blurry images, or cropped edges</li>
        </ul>
      </div>

      {/* Upload progress */}
      {uploading && (
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
              <div
                className="bg-blue-600 dark:bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">
              {uploadProgress}%
            </span>
          </div>
          <p className="text-sm text-center text-gray-500 dark:text-gray-400">Uploading receipt...</p>
        </div>
      )}

      {/* Actions */}
      <ModalActions>
        <Button variant="secondary" onClick={handleClose} disabled={uploading}>
          Cancel
        </Button>
        <Button
          onClick={handleUpload}
          loading={uploading}
          disabled={!selectedFile || uploading}
        >
          <Upload className="w-4 h-4" />
          Upload Receipt
        </Button>
      </ModalActions>
    </div>
  );

  // ==========================================
  // RENDER: POLLING PHASE
  // ==========================================
  const renderPollingPhase = () => {
    const progressPercent = Math.min((pollCount / OCR_MAX_POLLS) * 100, 100);

    return (
      <div className="space-y-6 py-4">
        {/* Receipt Preview */}
        {receipt && renderReceiptPreview(receipt)}

        {/* Status */}
        {pollTimedOut ? (
          <div className="text-center space-y-3">
            <Clock className="w-10 h-10 mx-auto text-yellow-500" />
            <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Taking longer than expected
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              The OCR process is still running. You can wait, retry, or enter the information manually.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
              <Button variant="secondary" size="sm" onClick={handleRetryOcr}>
                <RefreshCw className="w-4 h-4" />
                Retry OCR
              </Button>
              <Button variant="secondary" size="sm" onClick={openManualEntry}>
                <PenLine className="w-4 h-4" />
                Enter Manually
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center space-y-4">
            <Loader2 className="w-10 h-10 mx-auto text-blue-500 animate-spin" />
            <div>
              <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
                Analyzing receipt with OCR...
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                This usually takes 5–15 seconds
              </p>
            </div>
            {/* Progress bar */}
            <div className="max-w-xs mx-auto">
              <div className="bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                <div
                  className="bg-blue-600 dark:bg-blue-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Processing...</p>
            </div>
          </div>
        )}

        <ModalActions>
          <Button variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
        </ModalActions>
      </div>
    );
  };

  // ==========================================
  // RENDER: OCR COMPLETE PHASE
  // ==========================================
  const renderOcrCompletePhase = () => {
    // Use full receipt data (refreshed after OCR) for display
    const r = receipt;
    const vendor = r?.ocr_vendor || ocrStatus?.ocr_vendor;
    const amount = r?.ocr_amount ?? ocrStatus?.ocr_amount;
    const date = r?.ocr_date || ocrStatus?.ocr_date;
    const tax = r?.ocr_tax;
    const discount = r?.ocr_discount;
    const subtotal = r?.ocr_subtotal;
    const time = r?.ocr_time;
    const entryType = r?.ocr_entry_type;
    const lineItems = r?.ocr_line_items;
    const notes = r?.ocr_notes;

    return (
      <div className="space-y-6 py-2">
        {/* Success banner */}
        <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
          <p className="text-sm font-medium text-green-800 dark:text-green-200">
            Receipt analyzed successfully
          </p>
        </div>

        {/* Receipt Preview */}
        {receipt && renderReceiptPreview(receipt)}

        {/* Extracted Data */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
            Extracted Data
          </h4>
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-2">
            {vendor && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Vendor</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">{vendor}</span>
              </div>
            )}
            {date && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Date</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {formatDate(date)}{time ? ` at ${time}` : ''}
                </span>
              </div>
            )}
            {entryType && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Type</span>
                <span className="font-medium text-gray-900 dark:text-gray-100 capitalize">
                  {entryType === 'refund' ? 'Refund (Income)' : 'Expense'}
                </span>
              </div>
            )}

            {/* Line items */}
            {lineItems && lineItems.length > 0 && (
              <div className="pt-2 mt-2 border-t border-gray-200 dark:border-gray-600 space-y-1">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Items</span>
                {lineItems.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span className="text-gray-700 dark:text-gray-300 truncate mr-2">
                      {item.quantity > 1 ? `${item.quantity}× ` : ''}{item.description}
                    </span>
                    <span className="font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
                      {formatCurrency(item.total)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Totals */}
            <div className="pt-2 mt-2 border-t border-gray-200 dark:border-gray-600 space-y-1">
              {subtotal != null && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Subtotal</span>
                  <span className="text-gray-900 dark:text-gray-100">{formatCurrency(subtotal)}</span>
                </div>
              )}
              {tax != null && tax > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Tax</span>
                  <span className="text-gray-900 dark:text-gray-100">{formatCurrency(tax)}</span>
                </div>
              )}
              {discount != null && discount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Discount</span>
                  <span className="text-green-600 dark:text-green-400">-{formatCurrency(discount)}</span>
                </div>
              )}
              {amount != null && (
                <div className="flex justify-between text-sm font-semibold">
                  <span className="text-gray-700 dark:text-gray-300">Total</span>
                  <span className="text-gray-900 dark:text-gray-100">{formatCurrency(amount)}</span>
                </div>
              )}
            </div>

            {/* Payment notes */}
            {notes && (
              <div className="pt-2 mt-2 border-t border-gray-200 dark:border-gray-600">
                <span className="text-xs text-gray-400 dark:text-gray-500">{notes}</span>
              </div>
            )}
          </div>
        </div>

        {/* Warning */}
        <div className="flex items-start gap-2.5 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-800 dark:text-red-200">
            Review the data carefully — OCR extraction may contain errors.
          </p>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          <Button fullWidth onClick={openCreateEntryForm}>
            <PenLine className="w-4 h-4" />
            Create Entry from Receipt
          </Button>
          {canManage && (
            <Button fullWidth variant="secondary" onClick={openLinkEntry}>
              <Link2 className="w-4 h-4" />
              Link to Existing Entry
            </Button>
          )}
        </div>

        <ModalActions>
          <Button variant="ghost" onClick={handleClose}>
            Close
          </Button>
        </ModalActions>
      </div>
    );
  };

  // ==========================================
  // RENDER: OCR FAILED PHASE
  // ==========================================
  const renderOcrFailedPhase = () => (
    <div className="space-y-6 py-2">
      {/* Error banner */}
      <div className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
        <p className="text-sm font-medium text-red-800 dark:text-red-200">
          Unable to extract data from this receipt
        </p>
      </div>

      {/* Receipt Preview */}
      {receipt && renderReceiptPreview(receipt)}

      <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
        You can retry the OCR analysis, upload a different image, or enter the information manually.
      </p>

      {/* Actions */}
      <div className="space-y-2">
        {canManage && (
          <Button fullWidth variant="secondary" onClick={handleRetryOcr}>
            <RefreshCw className="w-4 h-4" />
            Retry OCR
          </Button>
        )}
        <Button fullWidth variant="secondary" onClick={handleUploadNewImage}>
          <Upload className="w-4 h-4" />
          Upload New Image
        </Button>
        <Button fullWidth onClick={openManualEntry}>
          <PenLine className="w-4 h-4" />
          Enter Manually
        </Button>
      </div>

      <ModalActions>
        <Button variant="ghost" onClick={handleClose}>
          Close
        </Button>
      </ModalActions>
    </div>
  );

  // ==========================================
  // RENDER: OCR NOT PROCESSED PHASE
  // ==========================================
  const renderOcrNotProcessedPhase = () => (
    <div className="space-y-6 py-2">
      {/* Info banner */}
      <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
        <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
          OCR processing is not available for this receipt
        </p>
      </div>

      {/* Receipt Preview */}
      {receipt && renderReceiptPreview(receipt)}

      <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
        You can upload a different image, create an entry manually, or link this receipt to an existing entry.
      </p>

      {/* Actions */}
      <div className="space-y-2">
        <Button fullWidth variant="secondary" onClick={handleUploadNewImage}>
          <Upload className="w-4 h-4" />
          Upload New Image
        </Button>
        <Button fullWidth onClick={openManualEntry}>
          <PenLine className="w-4 h-4" />
          Enter Manually
        </Button>
        {canManage && (
          <Button fullWidth variant="secondary" onClick={openLinkEntry}>
            <Link2 className="w-4 h-4" />
            Link to Existing Entry
          </Button>
        )}
      </div>

      <ModalActions>
        <Button variant="ghost" onClick={handleClose}>
          Close
        </Button>
      </ModalActions>
    </div>
  );

  // ==========================================
  // RENDER: CREATE ENTRY FORM
  // ==========================================
  const renderCreateEntryForm = () => (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleCreateEntry();
      }}
      className="space-y-4"
    >
      {/* OCR pre-populated notice */}
      {receipt?.ocr_status === 'complete' ? (
        <div className="flex items-start gap-2.5 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-800 dark:text-red-200">
            Pre-populated from OCR — review carefully, data may contain errors.
          </p>
        </div>
      ) : null}

      {/* Project (optional — omit for business-level overhead expenses) */}
      <Select
        label="Project"
        options={projectOptions}
        value={entryProjectId}
        onChange={(v) => {
          setEntryProjectId(v);
          if (!v) setEntryTaskId('');
          if (entryErrors.project_id) {
            setEntryErrors((prev) => {
              const next = { ...prev };
              delete next.project_id;
              return next;
            });
          }
        }}
        searchable
        helperText="Optional — leave empty for overhead expenses like fuel or office supplies"
      />

      {/* Task (optional, conditional on project) */}
      <Select
        label="Task"
        options={entryTaskOptions}
        value={entryTaskId}
        onChange={(v) => {
          setEntryTaskId(v);
          if (entryErrors.task_id) {
            setEntryErrors((prev) => {
              const next = { ...prev };
              delete next.task_id;
              return next;
            });
          }
        }}
        searchable
        disabled={!entryProjectId || entryTasksLoading}
        placeholder={entryTasksLoading ? 'Loading...' : 'Select task...'}
        error={entryErrors.task_id}
      />

      {/* Category (REQUIRED) */}
      <Select
        label="Category"
        options={categoryOptions}
        value={entryCategoryId}
        onChange={(v) => {
          setEntryCategoryId(v);
          if (entryErrors.category_id) {
            setEntryErrors((prev) => {
              const next = { ...prev };
              delete next.category_id;
              return next;
            });
          }
        }}
        searchable
        required
        error={entryErrors.category_id}
      />

      {/* Entry Type */}
      <div>
        <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Entry Type
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setEntryEntryType('expense')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border-2 text-sm font-medium transition-colors ${
              entryEntryType === 'expense'
                ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
            }`}
          >
            <TrendingDown className="w-4 h-4" />
            Expense
          </button>
          <button
            type="button"
            onClick={() => setEntryEntryType('income')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border-2 text-sm font-medium transition-colors ${
              entryEntryType === 'income'
                ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            Income / Refund
          </button>
        </div>
      </div>

      {/* Line Items (before totals) */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
        {hasOcrItems && entryLineItems.length > 0 && (
          <div className="flex items-start gap-2.5 p-3 mb-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-blue-800 dark:text-blue-200">
              Product items were detected from the receipt. Please review and adjust as needed.
            </p>
          </div>
        )}
        <LineItemsSection
          items={entryLineItems}
          onChange={(newItems) => {
            setEntryLineItems(newItems);
            // Auto-sum: if total is empty/zero and items have value, update it
            const itemsTotal = newItems.reduce((sum, i) => sum + i.total, 0);
            if (entryAmount === 0 && itemsTotal > 0) {
              const computed = Math.round((itemsTotal + entryTaxAmount) * 100) / 100;
              setEntryAmount(computed);
            }
          }}
          disabled={creatingEntry}
        />
      </div>

      {/* Amount, Tax & Discount */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MoneyInput
          label="Amount (Total)"
          value={entryAmount}
          onChange={(v) => {
            setEntryAmount(v);
            if (entryErrors.amount) {
              setEntryErrors((prev) => {
                const next = { ...prev };
                delete next.amount;
                return next;
              });
            }
          }}
          required
          error={entryErrors.amount}
        />
        <MoneyInput
          label="Tax"
          value={entryTaxAmount}
          onChange={setEntryTaxAmount}
        />
        <MoneyInput
          label="Discount"
          value={entryDiscount}
          onChange={setEntryDiscount}
        />
      </div>

      {/* Date & Time */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <DatePicker
          label="Entry Date"
          value={entryDate}
          onChange={(e) => setEntryDate(e.target.value)}
          max={todayISO()}
        />
        <Input
          label="Time"
          value={entryTime}
          onChange={(e) => {
            const raw = e.target.value.replace(/[^0-9:]/g, '').substring(0, 5);
            setEntryTime(raw);
          }}
          placeholder="HH:MM"
          maxLength={5}
          leftIcon={<Clock className="w-5 h-5" />}
        />
      </div>

      {/* Vendor & Supplier */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Vendor Name"
          value={entryVendor}
          onChange={(e) => setEntryVendor(e.target.value)}
          placeholder="e.g., Home Depot"
          maxLength={200}
        />
        <Select
          label="Supplier"
          options={supplierOptions}
          value={entrySupplierId}
          onChange={setEntrySupplierId}
          searchable
        />
      </div>

      {/* Payment Method */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Select
          label="Payment Type"
          options={PAYMENT_METHOD_TYPE_OPTIONS}
          value={entryPaymentMethod}
          onChange={setEntryPaymentMethod}
        />
        <Select
          label="Payment Account"
          options={paymentMethodRegistryOptions}
          value={entryPaymentMethodRegistryId}
          onChange={setEntryPaymentMethodRegistryId}
          searchable
        />
      </div>

      {/* Purchased By */}
      <div>
        <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Purchased By <span className="text-xs font-normal text-gray-400 dark:text-gray-500">Optional</span>
        </label>
        <div className="flex flex-wrap gap-2 mb-3">
          {(['none', 'team', 'crew'] as PurchasedByMode[]).map((mode) => {
            const labels: Record<PurchasedByMode, { label: string; icon: React.ReactNode }> = {
              none: { label: 'None', icon: null },
              team: { label: 'Team Member', icon: <Users className="h-4 w-4" /> },
              crew: { label: 'Crew Member', icon: <UserCircle className="h-4 w-4" /> },
            };
            const info = labels[mode];
            const isSelected = entryPurchasedByMode === mode;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => {
                  setEntryPurchasedByMode(mode);
                  if (mode !== 'team') setEntryPurchasedByUserId('');
                  if (mode !== 'crew') setEntryPurchasedByCrewId('');
                }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                    : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                }`}
              >
                {info.icon}
                {info.label}
              </button>
            );
          })}
        </div>
        {entryPurchasedByMode === 'team' && (
          <Select
            label="Team Member"
            options={[
              { value: '', label: 'Select a team member...' },
              ...teamMembers
                .filter((m) => m.status === 'ACTIVE')
                .map((m) => ({
                  value: m.user_id,
                  label: `${m.first_name || ''} ${m.last_name || ''}`.trim() || m.email,
                })),
            ]}
            value={entryPurchasedByUserId}
            onChange={setEntryPurchasedByUserId}
            searchable
          />
        )}
        {entryPurchasedByMode === 'crew' && (
          <Select
            label="Crew Member"
            options={[
              { value: '', label: 'Select a crew member...' },
              ...crewMembers
                .filter((c) => c.is_active)
                .map((c) => ({
                  value: c.id,
                  label: `${c.first_name} ${c.last_name}`,
                })),
            ]}
            value={entryPurchasedByCrewId}
            onChange={setEntryPurchasedByCrewId}
            searchable
          />
        )}
      </div>

      {/* Notes */}
      <Textarea
        label="Notes"
        value={entryNotes}
        onChange={(e) => setEntryNotes(e.target.value)}
        placeholder="Additional notes..."
        maxLength={2000}
        rows={3}
      />

      {/* Actions */}
      <ModalActions>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            // Go back to the previous OCR result phase
            if (ocrStatus?.ocr_status === 'complete') {
              setPhase('ocr_complete');
            } else if (ocrStatus?.ocr_status === 'failed') {
              setPhase('ocr_failed');
            } else {
              setPhase('ocr_not_processed');
            }
          }}
        >
          Back
        </Button>
        <Button type="submit" loading={creatingEntry} disabled={creatingEntry}>
          Create Entry
        </Button>
      </ModalActions>
    </form>
  );

  // ==========================================
  // RENDER: LINK ENTRY
  // ==========================================
  const renderLinkEntry = () => (
    <div className="space-y-4">
      {/* Info notice */}
      <div className="flex items-start gap-2.5 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
        <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-amber-800 dark:text-amber-200">
          Linking a receipt to an existing entry is for tracking only — it does not change the entry&apos;s amount, category, or any other values.
        </p>
      </div>

      {/* Search */}
      <Input
        label="Search Entries"
        value={linkSearchQuery}
        onChange={(e) => setLinkSearchQuery(e.target.value)}
        placeholder="Search by vendor, category, project, or amount..."
      />

      {/* Entry list */}
      {linkEntriesLoading ? (
        <div className="py-8">
          <LoadingSpinner size="md" centered />
        </div>
      ) : filteredLinkEntries.length === 0 ? (
        <div className="py-8 text-center">
          <FileText className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {linkSearchQuery ? 'No entries match your search' : 'No unlinked entries available'}
          </p>
        </div>
      ) : (
        <div className="max-h-72 overflow-y-auto space-y-2 border border-gray-200 dark:border-gray-700 rounded-lg p-2">
          {filteredLinkEntries.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => setSelectedLinkEntryId(entry.id)}
              className={`
                w-full text-left p-3 rounded-lg border-2 transition-all duration-150
                ${selectedLinkEntryId === entry.id
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-700/50'}
              `}
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                    {entry.vendor_name || entry.category_name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {entry.project_name || 'No project'} · {formatDate(entry.entry_date)}
                  </p>
                </div>
                <div className="text-sm font-bold text-gray-900 dark:text-gray-100 flex-shrink-0 ml-3">
                  {formatCurrency(entry.amount)}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Actions */}
      <ModalActions>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            if (ocrStatus?.ocr_status === 'complete') {
              setPhase('ocr_complete');
            } else {
              setPhase('ocr_not_processed');
            }
          }}
        >
          Back
        </Button>
        <Button
          onClick={handleLinkEntry}
          loading={linking}
          disabled={!selectedLinkEntryId || linking}
        >
          <Link2 className="w-4 h-4" />
          Link Receipt
        </Button>
      </ModalActions>
    </div>
  );

  // ==========================================
  // SHARED: RECEIPT PREVIEW
  // ==========================================
  const renderReceiptPreview = (r: Receipt) => {
    const imageUrl = r.file_type === 'photo' ? getReceiptImageUrl(r) : null;

    return (
      <div className="flex justify-center">
        {imageUrl ? (
          <a
            href={imageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative inline-block"
            aria-label="View full-size receipt image"
          >
            <img
              src={imageUrl}
              alt={`Receipt: ${r.file_name}`}
              className="max-h-40 rounded-lg object-contain border border-gray-200 dark:border-gray-600 group-hover:opacity-90 transition-opacity"
            />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="bg-black/50 rounded-full p-2">
                <Eye className="w-5 h-5 text-white" />
              </div>
            </div>
          </a>
        ) : (
          <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <FileText className="w-10 h-10 text-red-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {r.file_name}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                PDF Document {r.file_size_bytes ? `· ${formatFileSize(r.file_size_bytes)}` : ''}
              </p>
              <a
                href={getReceiptImageUrl(r)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline mt-1 inline-block"
              >
                Open PDF
              </a>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ==========================================
  // MAIN RENDER
  // ==========================================
  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        title={getTitle()}
        size={phase === 'create_entry' ? 'xl' : 'lg'}
      >
        {phase === 'upload' && renderUploadPhase()}
        {phase === 'polling' && renderPollingPhase()}
        {phase === 'ocr_complete' && renderOcrCompletePhase()}
        {phase === 'ocr_failed' && renderOcrFailedPhase()}
        {phase === 'ocr_not_processed' && renderOcrNotProcessedPhase()}
        {phase === 'create_entry' && renderCreateEntryForm()}
        {phase === 'link_entry' && renderLinkEntry()}
      </Modal>

      {/* Camera Capture Modal */}
      <CameraCaptureModal
        isOpen={cameraModalOpen}
        onClose={() => setCameraModalOpen(false)}
        onCapture={handleCameraCapture}
      />
    </>
  );
}

export default ReceiptUploadModal;
