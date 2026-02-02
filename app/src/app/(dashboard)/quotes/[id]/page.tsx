/**
 * Quote Detail Page
 * Comprehensive quote view with tabs - Sprint 4 & 5: Fully integrated
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useRBAC } from '@/contexts/RBACContext';
import { Button } from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { Modal, ModalActions, ModalContent } from '@/components/ui/Modal';
import { Tabs, TabItem } from '@/components/ui/Tabs';
import { QuoteStatusBadge } from '@/components/quotes/QuoteStatusBadge';
import { GroupCard } from '@/components/quotes/GroupCard';
import { ItemsList } from '@/components/quotes/ItemsList';
import { GroupFormModal } from '@/components/quotes/GroupFormModal';
import { DeleteGroupModal } from '@/components/quotes/DeleteGroupModal';
import { AddFromLibraryModal } from '@/components/quotes/AddFromLibraryModal';
import { AddBundleModal } from '@/components/quotes/AddBundleModal';
import { MoveItemToGroupModal } from '@/components/quotes/MoveItemToGroupModal';
import { SortableList } from '@/components/ui/SortableList';
import { SortableItem } from '@/components/ui/SortableItem';
import { DiscountRulesSection } from '@/components/quotes/DiscountRulesSection';
import { ProfitabilityWidget } from '@/components/quotes/ProfitabilityWidget';
import { DrawScheduleSection } from '@/components/quotes/DrawScheduleSection';
// Sprint 4: Approval, Version, Change Order components
import { ApprovalActionsCard } from '@/components/quotes/ApprovalActionsCard';
import { ApprovalHistoryTimeline } from '@/components/quotes/ApprovalHistoryTimeline';
import { VersionTimelineCard } from '@/components/quotes/VersionTimelineCard';
import { ChangeOrderList } from '@/components/quotes/ChangeOrderList';
import { ChangeOrderHistoryTimeline } from '@/components/quotes/ChangeOrderHistoryTimeline';
// Sprint 5: Attachments, PDF, Email, Public Access components
import { AttachmentsSection } from '@/components/quotes/attachments/AttachmentsSection';
import { PDFActionsMenu } from '@/components/quotes/pdf/PDFActionsMenu';
import { SendQuoteModal } from '@/components/quotes/email/SendQuoteModal';
import { QuoteEmailHistory } from '@/components/quotes/email/QuoteEmailHistory';
import { PublicURLCard } from '@/components/quotes/public-access/PublicURLCard';
import { PublicURLModal } from '@/components/quotes/public-access/PublicURLModal';
import { ViewAnalyticsModal } from '@/components/quotes/public-access/ViewAnalyticsModal';
import { ViewHistoryTable } from '@/components/quotes/public-access/ViewHistoryTable';
import TagAssignment from '@/components/quotes/tags/TagAssignment';
import {
  getQuoteById,
  deleteQuote,
  cloneQuote,
  updateQuoteStatus,
  formatMoney,
  isQuoteEditable,
  isQuoteNearExpiration,
  isQuoteExpired,
} from '@/lib/api/quotes';
import {
  getQuoteItems,
  deleteQuoteItem,
  duplicateQuoteItem,
  moveItemToGroup,
  addItemFromLibrary,
  reorderItems,
} from '@/lib/api/quote-items';
import {
  getQuoteGroups,
  createQuoteGroup,
  updateQuoteGroup,
  deleteQuoteGroup,
  duplicateQuoteGroup,
  reorderGroups,
} from '@/lib/api/quote-groups';
// Sprint 4: Approval and version APIs
import { getApprovalStatus, submitForApproval, type ApprovalStatus } from '@/lib/api/quote-approvals';
import { getVersions, type QuoteVersion } from '@/lib/api/quote-versions';
// Sprint 5: Public access API
import { getPublicAccessStatus } from '@/lib/api/quote-public-access';
import { analyzeProfitability } from '@/lib/api/profitability';
import { getQuoteSettings, getApprovalThresholds } from '@/lib/api/quote-settings';
import { calculateQuoteFinancials } from '@/lib/utils/quote-calculations';
import type { PublicAccessUrl, SendQuoteResponse, ProfitabilityAnalysis, QuoteSettings } from '@/lib/types/quotes';
import {
  ArrowLeft,
  Edit,
  Copy,
  Trash2,
  Download,
  Send,
  AlertCircle,
  FileText,
  List,
  Paperclip,
  Mail,
  MessageSquare,
  User,
  Building2,
  MapPin,
  Calendar,
  DollarSign,
  ChevronDown,
  ChevronUp,
  Plus,
  Library,
  Package,
  Folder,
  Shield,
  History,
  FileEdit,
  Link as LinkIcon,
  Eye,
  CheckCircle2,
  RefreshCw,
  XCircle,
  Ban,
  ThumbsUp,
  PlayCircle,
  CheckCircle,
} from 'lucide-react';
import type { Quote, QuoteItem, QuoteGroup, QuoteStatus } from '@/lib/types/quotes';

export default function QuoteDetailPage() {
  const router = useRouter();
  const params = useParams();
  const quoteId = params.id as string;
  const { canPerform } = useRBAC();

  // State - Quote
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(() => {
    // Initialize from URL hash if present
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.replace('#', '');
      const validTabs = ['details', 'items', 'approvals', 'versions', 'change-orders', 'attachments', 'emails', 'notes'];
      return validTabs.includes(hash) ? hash : 'details';
    }
    return 'details';
  });
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [messageModalOpen, setMessageModalOpen] = useState(false);

  // State - Items & Groups
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [groups, setGroups] = useState<QuoteGroup[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [groupModalLoading, setGroupModalLoading] = useState(false);
  const [editingGroup, setEditingGroup] = useState<QuoteGroup | undefined>();
  const [deleteGroupModalOpen, setDeleteGroupModalOpen] = useState(false);
  const [deletingGroup, setDeletingGroup] = useState<QuoteGroup | null>(null);
  const [deleteGroupLoading, setDeleteGroupLoading] = useState(false);
  const [libraryModalOpen, setLibraryModalOpen] = useState(false);
  const [libraryModalLoading, setLibraryModalLoading] = useState(false);
  const [bundleModalOpen, setBundleModalOpen] = useState(false);
  const [moveItemModalOpen, setMoveItemModalOpen] = useState(false);
  const [movingItem, setMovingItem] = useState<QuoteItem | null>(null);
  const [moveItemLoading, setMoveItemLoading] = useState(false);
  const [deleteItemModalOpen, setDeleteItemModalOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState<QuoteItem | null>(null);
  const [deleteItemLoading, setDeleteItemLoading] = useState(false);

  // Collapsible sections
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const [jobsiteExpanded, setJobsiteExpanded] = useState(true);
  const [detailsExpanded, setDetailsExpanded] = useState(true);
  const [notesExpanded, setNotesExpanded] = useState(false);

  // Sprint 4: Approvals & Versions state
  const [approvalStatus, setApprovalStatus] = useState<ApprovalStatus | null>(null);
  const [versions, setVersions] = useState<QuoteVersion[]>([]);
  const [approvalsLoading, setApprovalsLoading] = useState(false);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [currentUserRole, setCurrentUserRole] = useState<string>('');

  // Sprint 5: Email, PDF, Public Access state
  const [showSendModal, setShowSendModal] = useState(false);
  const [publicAccessUrl, setPublicAccessUrl] = useState<PublicAccessUrl | null>(null);
  const [showGenerateUrlModal, setShowGenerateUrlModal] = useState(false);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [publicAccessLoading, setPublicAccessLoading] = useState(false);

  // Profitability analysis state
  const [profitabilityAnalysis, setProfitabilityAnalysis] = useState<ProfitabilityAnalysis | null>(null);
  const [profitabilityLoading, setProfitabilityLoading] = useState(false);

  // Quote settings state (for default values)
  const [quoteSettings, setQuoteSettings] = useState<QuoteSettings | null>(null);

  // Approval thresholds state
  const [approvalThresholds, setApprovalThresholds] = useState<any>(null);
  const [approvalThresholdsLoading, setApprovalThresholdsLoading] = useState(false);

  // Skip approval modal
  const [skipApprovalModalOpen, setSkipApprovalModalOpen] = useState(false);
  const [skipApprovalLoading, setSkipApprovalLoading] = useState(false);

  // Status update dropdown
  const [statusUpdateDropdownOpen, setStatusUpdateDropdownOpen] = useState(false);
  const [statusUpdateLoading, setStatusUpdateLoading] = useState(false);

  // Helper function to check if quote is editable
  const isQuoteEditable = (): boolean => {
    if (!quote) return false;
    // Editable statuses: draft, pending_approval, ready, email_failed
    // Locked statuses: sent, delivered, read, opened, downloaded, approved, denied, lost, started, concluded
    const editableStatuses: QuoteStatus[] = [
      'draft',
      'pending_approval',
      'ready',
      'email_failed',
    ];
    return editableStatuses.includes(quote.status);
  };

  // Helper function to check if approval is required for this quote
  const isApprovalRequired = (): boolean => {
    if (!quote || !approvalThresholds) return false;

    // If approval_thresholds is null, approval workflow is disabled
    if (approvalThresholds === null) return false;

    // Get threshold levels (could be array or object with approval_levels)
    const thresholdLevels = Array.isArray(approvalThresholds)
      ? approvalThresholds
      : approvalThresholds.approval_levels || [];

    // If no thresholds configured, no approval required
    if (thresholdLevels.length === 0) return false;

    // Check if quote total meets or exceeds minimum threshold
    const minThreshold = thresholdLevels[0]?.amount || 0;
    const quoteTotal = parseFloat(quote.total.toString());

    return quoteTotal >= minThreshold;
  };

  // Check if this is a change order (has parent_quote_id)
  const isChangeOrder = quote && quote.parent_quote_id != null;

  // Tabs configuration - hide "Change Orders" tab when viewing a change order
  const tabs: TabItem[] = [
    { id: 'details', label: 'Details', ...(FileText && { icon: FileText }) },
    { id: 'items', label: 'Items', ...(List && { icon: List }) },
    { id: 'approvals', label: 'Approvals', ...(Shield && { icon: Shield }) },
    { id: 'versions', label: 'Versions', ...(History && { icon: History }) },
    // Don't show "Change Orders" tab when viewing a change order (can't have nested change orders)
    ...(!isChangeOrder ? [{ id: 'change-orders', label: 'Change Orders', ...(FileEdit && { icon: FileEdit }) }] : []),
    { id: 'attachments', label: 'Attachments', ...(Paperclip && { icon: Paperclip }) },
    { id: 'emails', label: 'Emails', ...(Mail && { icon: Mail }) },
    { id: 'notes', label: 'Notes', ...(MessageSquare && { icon: MessageSquare }) },
  ];

  useEffect(() => {
    loadQuote();
    loadQuoteSettings();
    loadApprovalThresholds();
  }, [quoteId]);

  // Update URL hash when active tab changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.location.hash = activeTab;
    }
  }, [activeTab]);

  // Listen for hash changes (browser back/forward)
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      const validTabs = ['details', 'items', 'approvals', 'versions', 'change-orders', 'attachments', 'emails', 'notes'];
      if (validTabs.includes(hash) && hash !== activeTab) {
        setActiveTab(hash);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [activeTab]);

  // Close status update dropdown on ESC key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && statusUpdateDropdownOpen) {
        setStatusUpdateDropdownOpen(false);
      }
    };

    if (statusUpdateDropdownOpen) {
      window.addEventListener('keydown', handleEscape);
      return () => window.removeEventListener('keydown', handleEscape);
    }
  }, [statusUpdateDropdownOpen]);

  useEffect(() => {
    if ((activeTab === 'items' || activeTab === 'details') && quote) {
      loadItemsAndGroups();
    }
    if (activeTab === 'approvals' && quote) {
      loadApprovalStatus();
    }
    if (activeTab === 'versions' && quote) {
      loadVersions();
    }
    // Sprint 5: Load public access on details tab
    if (activeTab === 'details' && quote) {
      loadPublicAccessStatus();
    }
  }, [activeTab, quote]);

  // Sprint 5: Load public access status when quote loads (independent of activeTab)
  useEffect(() => {
    if (quote?.id) {
      loadPublicAccessStatus();
      loadProfitabilityAnalysis();
    }
  }, [quote?.id]);

  const loadQuote = async () => {
    try {
      setLoading(true);
      const data = await getQuoteById(quoteId);
      setQuote(data);
    } catch (err: any) {
      showError(err.message || 'Failed to load quote');
      setTimeout(() => router.push('/quotes'), 2000);
    } finally {
      setLoading(false);
    }
  };

  const loadQuoteSettings = async () => {
    try {
      const settings = await getQuoteSettings();
      setQuoteSettings(settings);
    } catch (err: any) {
      console.error('Failed to load quote settings:', err);
      // Don't show error - settings are optional for display
    }
  };

  const loadApprovalThresholds = async () => {
    try {
      setApprovalThresholdsLoading(true);
      const thresholds = await getApprovalThresholds();
      setApprovalThresholds(thresholds);
    } catch (err: any) {
      console.error('Failed to load approval thresholds:', err);
      // Don't show error - thresholds might not be configured
      setApprovalThresholds(null); // null = approval workflow disabled
    } finally {
      setApprovalThresholdsLoading(false);
    }
  };

  const loadItemsAndGroups = async () => {
    try {
      setItemsLoading(true);
      const [itemsData, groupsData] = await Promise.all([
        getQuoteItems(quoteId),
        getQuoteGroups(quoteId),
      ]);

      // Calculate items_count and total_cost for each group if backend doesn't provide them
      const groupsWithCalculations = groupsData.map(group => ({
        ...group,
        items_count: group.items_count ?? group.items.length,
        total_cost: group.total_cost ?? group.items.reduce((sum, item) => {
          const itemTotal = typeof item.total_cost === 'string'
            ? parseFloat(item.total_cost)
            : item.total_cost;
          return sum + (itemTotal || 0);
        }, 0),
      }));

      setItems(itemsData);
      setGroups(groupsWithCalculations);

      // Reload profitability analysis when items change
      loadProfitabilityAnalysis();
    } catch (err: any) {
      showError(err.message || 'Failed to load items and groups');
    } finally {
      setItemsLoading(false);
    }
  };

  // Sprint 4: Load approval status
  const loadApprovalStatus = async () => {
    try {
      setApprovalsLoading(true);
      const data = await getApprovalStatus(quoteId);
      setApprovalStatus(data);
      // TODO: Get current user ID and role from auth context
      setCurrentUserId('current-user-id');
      setCurrentUserRole('Manager');
    } catch (err: any) {
      console.error('Failed to load approval status:', err);
      // Don't show error for 404 - just means no approval workflow configured
      if (err.response?.status !== 404) {
        showError(err.message || 'Failed to load approval status');
      }
    } finally {
      setApprovalsLoading(false);
    }
  };

  // Sprint 4: Load version history
  const loadVersions = async () => {
    try {
      setVersionsLoading(true);
      const data = await getVersions(quoteId);
      setVersions(data);
    } catch (err: any) {
      console.error('Failed to load versions:', err);
      showError(err.message || 'Failed to load version history');
    } finally {
      setVersionsLoading(false);
    }
  };

  // Sprint 5: Load public access status
  const loadPublicAccessStatus = async () => {
    try {
      setPublicAccessLoading(true);
      const status = await getPublicAccessStatus(quoteId);

      // API returns { has_public_access: false } when no URL exists
      // OR returns { public_url, access_token, ... } when URL exists (without has_public_access field)
      if (status.public_url && status.access_token) {
        setPublicAccessUrl({
          public_url: status.public_url,
          access_token: status.access_token,
          has_password: status.has_password || false,
          password_hint: status.password_hint,
          created_at: status.created_at || new Date().toISOString(),
          expires_at: status.expires_at,
        });
      } else {
        setPublicAccessUrl(null);
      }
    } catch (err: any) {
      // Only reset on 404 (confirmed no URL exists)
      if (err.response?.status === 404 || err.status === 404) {
        setPublicAccessUrl(null);
      } else {
        // Network/server error - don't reset existing state
        console.error('Failed to load public access status:', err);
      }
    } finally {
      setPublicAccessLoading(false);
    }
  };

  // Load profitability analysis for detailed financial breakdown
  const loadProfitabilityAnalysis = async () => {
    try {
      setProfitabilityLoading(true);
      const data = await analyzeProfitability(quoteId);
      setProfitabilityAnalysis(data);
    } catch (err: any) {
      console.error('Failed to load profitability analysis:', err);
      // Don't show error - just won't display detailed breakdown
      setProfitabilityAnalysis(null);
    } finally {
      setProfitabilityLoading(false);
    }
  };

  const handleClone = async () => {
    if (!quote) return;
    try {
      const clonedQuote = await cloneQuote(quote.id);
      router.push(`/quotes/${clonedQuote.id}`);
    } catch (err: any) {
      showError(err.message || 'Failed to clone quote');
    }
  };

  const handleDelete = async () => {
    if (!quote) return;
    try {
      setDeleteLoading(true);
      await deleteQuote(quote.id);
      setDeleteModalOpen(false);
      router.push('/quotes');
    } catch (err: any) {
      showError(err.message || 'Failed to delete quote');
      setDeleteLoading(false);
    }
  };

  const handleSkipApprovalConfirm = async () => {
    if (!quote) return;
    try {
      setSkipApprovalLoading(true);
      await updateQuoteStatus(quote.id, 'ready', undefined);
      await loadQuote();
      setSkipApprovalModalOpen(false);
      showSuccess('Quote marked as ready');
    } catch (error: any) {
      showError(error.response?.data?.message || 'Failed to update status');
    } finally {
      setSkipApprovalLoading(false);
    }
  };

  // Get available status transitions based on current status
  const getAvailableStatusTransitions = (): { status: QuoteStatus; label: string; icon: any }[] => {
    if (!quote) return [];

    const currentStatus = quote.status;

    // Define transitions based on user requirements:
    // Ready -> Sent
    // Sent -> Read, Downloaded, Approved, Denied, Lost
    // Opened (Email Opened) -> Read, Downloaded, Approved, Denied, Lost
    // Read -> Downloaded, Approved, Denied, Lost
    // Downloaded -> Approved, Denied, Lost
    // Approved -> Started, Concluded
    // Started -> Concluded

    const transitions: { status: QuoteStatus; label: string; icon: any }[] = [];

    if (currentStatus === 'ready') {
      transitions.push({ status: 'sent', label: 'Mark as Sent', icon: Send });
    } else if (currentStatus === 'sent') {
      transitions.push({ status: 'read', label: 'Mark as Read', icon: Eye });
      transitions.push({ status: 'downloaded', label: 'Mark as Downloaded', icon: Download });
      transitions.push({ status: 'approved', label: 'Mark as Approved', icon: ThumbsUp });
      transitions.push({ status: 'denied', label: 'Mark as Denied', icon: XCircle });
      transitions.push({ status: 'lost', label: 'Mark as Lost', icon: Ban });
    } else if (currentStatus === 'opened') {
      // Email opened - customer can approve/deny by phone, or view/download quote
      transitions.push({ status: 'read', label: 'Mark as Read', icon: Eye });
      transitions.push({ status: 'downloaded', label: 'Mark as Downloaded', icon: Download });
      transitions.push({ status: 'approved', label: 'Mark as Approved', icon: ThumbsUp });
      transitions.push({ status: 'denied', label: 'Mark as Denied', icon: XCircle });
      transitions.push({ status: 'lost', label: 'Mark as Lost', icon: Ban });
    } else if (currentStatus === 'read') {
      transitions.push({ status: 'downloaded', label: 'Mark as Downloaded', icon: Download });
      transitions.push({ status: 'approved', label: 'Mark as Approved', icon: ThumbsUp });
      transitions.push({ status: 'denied', label: 'Mark as Denied', icon: XCircle });
      transitions.push({ status: 'lost', label: 'Mark as Lost', icon: Ban });
    } else if (currentStatus === 'downloaded') {
      transitions.push({ status: 'approved', label: 'Mark as Approved', icon: ThumbsUp });
      transitions.push({ status: 'denied', label: 'Mark as Denied', icon: XCircle });
      transitions.push({ status: 'lost', label: 'Mark as Lost', icon: Ban });
    } else if (currentStatus === 'approved') {
      transitions.push({ status: 'started', label: 'Mark as Started', icon: PlayCircle });
      transitions.push({ status: 'concluded', label: 'Mark as Concluded', icon: CheckCircle });
    } else if (currentStatus === 'started') {
      transitions.push({ status: 'concluded', label: 'Mark as Concluded', icon: CheckCircle });
    }

    return transitions;
  };

  const handleStatusUpdate = async (newStatus: QuoteStatus) => {
    if (!quote) return;
    try {
      setStatusUpdateLoading(true);
      await updateQuoteStatus(quote.id, newStatus, undefined);
      await loadQuote();
      setStatusUpdateDropdownOpen(false);
      showSuccess(`Quote status updated to ${newStatus}`);
    } catch (error: any) {
      showError(error.response?.data?.message || 'Failed to update status');
    } finally {
      setStatusUpdateLoading(false);
    }
  };

  // Group Handlers
  const handleCreateGroup = () => {
    setEditingGroup(undefined);
    setGroupModalOpen(true);
  };

  const handleEditGroup = (group: QuoteGroup) => {
    setEditingGroup(group);
    setGroupModalOpen(true);
  };

  const handleGroupSubmit = async (data: { name: string; description?: string }) => {
    try {
      setGroupModalLoading(true);
      if (editingGroup) {
        await updateQuoteGroup(quoteId, editingGroup.id, data);
      } else {
        await createQuoteGroup(quoteId, data);
      }
      await loadItemsAndGroups();
      await loadQuote(); // Refresh quote for updated totals
      setGroupModalOpen(false);
      showSuccess(editingGroup ? 'Group updated successfully' : 'Group created successfully');
    } catch (err: any) {
      showError(err.message || 'Failed to save group');
      throw err;
    } finally {
      setGroupModalLoading(false);
    }
  };

  const handleAddFromLibrary = async (libraryItemIds: string[]) => {
    try {
      setLibraryModalLoading(true);

      // Add each library item to the quote
      const promises = libraryItemIds.map((libraryItemId) =>
        addItemFromLibrary(quoteId, libraryItemId)
      );
      await Promise.all(promises);

      await loadItemsAndGroups();
      await loadQuote(); // Refresh quote for updated totals
      setLibraryModalOpen(false);
      showSuccess(
        `Successfully added ${libraryItemIds.length} ${
          libraryItemIds.length === 1 ? 'item' : 'items'
        } from library`
      );
    } catch (err: any) {
      showError(err.message || 'Failed to add items from library');
      throw err;
    } finally {
      setLibraryModalLoading(false);
    }
  };

  const handleBundleSuccess = async () => {
    // Reload items and quote after bundle is added
    await loadItemsAndGroups();
    await loadQuote(); // Refresh quote for updated totals
    setBundleModalOpen(false);
  };

  const handleDeleteGroupClick = (group: QuoteGroup) => {
    setDeletingGroup(group);
    setDeleteGroupModalOpen(true);
  };

  const handleDeleteGroupConfirm = async (keepItems: boolean) => {
    if (!deletingGroup) return;
    try {
      setDeleteGroupLoading(true);
      await deleteQuoteGroup(quoteId, deletingGroup.id, !keepItems);
      await loadItemsAndGroups();
      await loadQuote();
      setDeleteGroupModalOpen(false);
      setDeletingGroup(null);
      showSuccess('Group deleted successfully');
    } catch (err: any) {
      showError(err.message || 'Failed to delete group');
    } finally {
      setDeleteGroupLoading(false);
    }
  };

  const handleDuplicateGroup = async (group: QuoteGroup) => {
    try {
      await duplicateQuoteGroup(quoteId, group.id);
      await loadItemsAndGroups();
      await loadQuote();
      showSuccess('Group duplicated successfully');
    } catch (err: any) {
      showError(err.message || 'Failed to duplicate group');
    }
  };

  const handleReorderGroups = async (reorderedGroups: QuoteGroup[]) => {
    try {
      // Update local state optimistically
      setGroups(reorderedGroups);

      // Send reorder request to API
      await reorderGroups(quoteId, {
        groups: reorderedGroups.map((group, index) => ({
          group_id: group.id,
          order_index: index + 1,
        })),
      });

      // Refresh to get updated data
      await loadItemsAndGroups();
    } catch (err: any) {
      // Revert on error
      await loadItemsAndGroups();
      showError(err.message || 'Failed to reorder groups');
    }
  };

  // Item Handlers
  const handleEditItem = (item: QuoteItem) => {
    // Navigate to item edit page (to be built next)
    router.push(`/quotes/${quoteId}/items/${item.id}/edit`);
  };

  const handleDeleteItemClick = (item: QuoteItem) => {
    setDeletingItem(item);
    setDeleteItemModalOpen(true);
  };

  const handleDeleteItemConfirm = async () => {
    if (!deletingItem) return;
    try {
      setDeleteItemLoading(true);
      await deleteQuoteItem(quoteId, deletingItem.id);
      await loadItemsAndGroups();
      await loadQuote();
      setDeleteItemModalOpen(false);
      setDeletingItem(null);
      showSuccess('Item deleted successfully');
    } catch (err: any) {
      showError(err.message || 'Failed to delete item');
    } finally {
      setDeleteItemLoading(false);
    }
  };

  const handleDuplicateItem = async (item: QuoteItem) => {
    try {
      await duplicateQuoteItem(quoteId, item.id);
      await loadItemsAndGroups();
      await loadQuote();
      showSuccess('Item duplicated successfully');
    } catch (err: any) {
      showError(err.message || 'Failed to duplicate item');
    }
  };

  const handleMoveItem = (item: QuoteItem) => {
    setMovingItem(item);
    setMoveItemModalOpen(true);
  };

  const handleMoveItemConfirm = async (itemId: string, groupId: string | null) => {
    try {
      setMoveItemLoading(true);

      // Move to group or remove from group (both use same endpoint)
      await moveItemToGroup(quoteId, itemId, groupId);

      await loadItemsAndGroups();
      await loadQuote();
      setMoveItemModalOpen(false);
      setMovingItem(null);
      showSuccess(groupId ? 'Item moved to group successfully' : 'Item removed from group successfully');
    } catch (err: any) {
      showError(err.message || 'Failed to move item');
      throw err;
    } finally {
      setMoveItemLoading(false);
    }
  };

  const handleReorderItems = async (reorderedItems: QuoteItem[]) => {
    try {
      // Update local state optimistically
      setItems((prev) => {
        const itemsMap = new Map(reorderedItems.map((item, index) => [item.id, { ...item, order_index: index + 1 }]));
        return prev.map((item) => itemsMap.get(item.id) || item);
      });

      // Send reorder request to API
      await reorderItems(quoteId, {
        items: reorderedItems.map((item, index) => ({
          item_id: item.id,
          order_index: index + 1,
        })),
      });

      // Refresh to get updated data
      await loadItemsAndGroups();
    } catch (err: any) {
      // Revert on error
      await loadItemsAndGroups();
      showError(err.message || 'Failed to reorder items');
    }
  };

  const showError = (message: string) => {
    setErrorMessage(message);
    setSuccessMessage('');
    setMessageModalOpen(true);
  };

  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    setErrorMessage('');
    setMessageModalOpen(true);
  };

  const getPrimaryEmail = () => {
    const primaryEmail = quote?.lead?.emails?.find(e => e.is_primary);
    return primaryEmail?.email || quote?.lead?.emails?.[0]?.email || 'No email';
  };

  const getPrimaryPhone = () => {
    const primaryPhone = quote?.lead?.phones?.find(p => p.is_primary);
    return primaryPhone?.phone || quote?.lead?.phones?.[0]?.phone || 'No phone';
  };

  // Separate items into grouped and ungrouped
  const ungroupedItems = items.filter((item) => !item.quote_group_id);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  if (!quote) {
    return null;
  }

  const nearExpiration = isQuoteNearExpiration(quote.expires_at);
  const expired = isQuoteExpired(quote.expires_at);
  const editable = isQuoteEditable();

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <Link href={isChangeOrder ? `/quotes/${quote.parent_quote_id}` : '/quotes'}>
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="w-4 h-4" />
            {isChangeOrder ? 'Back to Quote' : 'Back to Quotes'}
          </Button>
        </Link>

        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-2">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 break-words">
                {quote.quote_number}
              </h1>
              <div className="flex items-center gap-2">
                <QuoteStatusBadge status={quote.status} className="w-fit" />

                {/* Status Update Dropdown - Show if there are available transitions */}
                {getAvailableStatusTransitions().length > 0 && (
                  <div className="relative">
                    <button
                      onClick={() => setStatusUpdateDropdownOpen(!statusUpdateDropdownOpen)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                      disabled={statusUpdateLoading}
                      title="Update Status"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <ChevronDown className="w-3 h-3" />
                    </button>

                    {statusUpdateDropdownOpen && (
                      <>
                        {/* Backdrop */}
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setStatusUpdateDropdownOpen(false)}
                        />

                        {/* Dropdown Menu */}
                        <div className="absolute left-0 top-full mt-1 z-20 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 min-w-[180px]">
                          <div className="py-1">
                            {getAvailableStatusTransitions().map((transition) => {
                              const Icon = transition.icon;
                              return (
                                <button
                                  key={transition.status}
                                  onClick={() => handleStatusUpdate(transition.status)}
                                  disabled={statusUpdateLoading}
                                  className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors disabled:opacity-50"
                                >
                                  <Icon className="w-4 h-4" />
                                  {transition.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
            <p className="text-base md:text-lg text-gray-600 dark:text-gray-400 mt-1 break-words">
              {quote.title}
            </p>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mt-1 break-words">
              Customer: {quote.lead?.first_name} {quote.lead?.last_name}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
              Created {new Date(quote.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {editable && (
          <Link href={`/quotes/${quote.id}/edit`}>
            <Button variant="secondary">
              <Edit className="w-4 h-4" />
              Edit
            </Button>
          </Link>
        )}

        <Button variant="secondary" onClick={handleClone}>
          <Copy className="w-4 h-4" />
          Clone
        </Button>

        <Button
          variant="danger"
          onClick={() => setDeleteModalOpen(true)}
        >
          <Trash2 className="w-4 h-4" />
          Delete
        </Button>

        {/* Sprint 5: PDF Actions - Only show if ready, sent, or approved */}
        {(quote.status === 'ready' || quote.status === 'approved' || quote.status === 'sent' || quote.status === 'delivered' || quote.status === 'read' || quote.status === 'opened' || quote.status === 'downloaded' || quote.status === 'started' || quote.status === 'concluded') && (
          <PDFActionsMenu quoteId={quote.id} quoteNumber={quote.quote_number} />
        )}

        {/* Sprint 5: Send Email - Can send/resend when ready, sent, delivered, read, opened, downloaded (but not approved, started, concluded, lost, denied) */}
        {(quote.status === 'ready' || quote.status === 'sent' || quote.status === 'delivered' || quote.status === 'read' || quote.status === 'opened' || quote.status === 'downloaded') && (
          <Button variant="primary" onClick={() => setShowSendModal(true)}>
            <Send className="w-4 h-4" />
            {quote.status === 'ready' ? 'Send Quote' : 'Resend Quote'}
          </Button>
        )}
      </div>

      {/* Sprint 6: Tag Assignment */}
      <div className="mb-6">
        <TagAssignment quoteId={quote.id} initialTags={[]} />
      </div>

      {/* Status Management Card - Show when actionable status changes needed (Internal Approval Workflow Only) */}
      {(quote.status === 'draft' || approvalStatus?.status === 'pending_approval') && (
        <Card className="mb-6 p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                {isChangeOrder ? 'Change Order Status & Actions' : 'Quote Status & Actions'}
              </h3>

              {quote.status === 'draft' && !approvalStatus && (
                <div className="space-y-2">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    This {isChangeOrder ? 'change order' : 'quote'} is in <strong>draft</strong> status.
                  </p>
                  {quote.total > 0 && !approvalThresholdsLoading && (
                    <div className="text-sm">
                      <p className="text-gray-900 dark:text-gray-100 font-medium">
                        Total: {formatMoney(quote.total)}
                      </p>
                      <p className="text-gray-600 dark:text-gray-400 mt-1">
                        {isApprovalRequired()
                          ? `This ${isChangeOrder ? 'change order' : 'quote'} requires approval before it can be sent to the customer.`
                          : `This ${isChangeOrder ? 'change order' : 'quote'} can be marked as ready to send directly (no approval required).`}
                      </p>
                    </div>
                  )}
                  {quote.total === 0 && (
                    <p className="text-gray-600 dark:text-gray-400">
                      Add items to this {isChangeOrder ? 'change order' : 'quote'} to continue.
                    </p>
                  )}
                  {approvalThresholdsLoading && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Checking approval requirements...
                    </p>
                  )}
                </div>
              )}

              {approvalStatus?.status === 'pending_approval' && (
                <div className="space-y-2">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    This {isChangeOrder ? 'change order' : 'quote'} is pending approval ({approvalStatus.progress.completed}/{approvalStatus.progress.total} levels approved)
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-blue-600 dark:bg-blue-400 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${approvalStatus.progress.percentage}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                      {approvalStatus.progress.percentage}%
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* Submit for Approval OR Mark as Ready - only if draft and has total */}
              {quote.status === 'draft' && !approvalStatus && quote.total > 0 && !approvalThresholdsLoading && (
                <>
                  {isApprovalRequired() ? (
                    // Approval IS required - show Submit for Approval button
                    <div className="flex flex-col gap-2">
                      <Button
                        variant="primary"
                        onClick={async () => {
                          try {
                            await submitForApproval(quote.id);
                            await loadApprovalStatus();
                            await loadQuote();
                          } catch (error: any) {
                            showError(error.response?.data?.message || 'Failed to submit for approval');
                          }
                        }}
                        className="whitespace-nowrap"
                      >
                        <Shield className="w-4 h-4" />
                        {isChangeOrder ? 'Submit Change Order for Approval' : 'Submit for Approval'}
                      </Button>
                    </div>
                  ) : (
                    // Approval is NOT required - show Mark as Ready button
                    <Button
                      variant="primary"
                      onClick={async () => {
                        try {
                          await updateQuoteStatus(quote.id, 'ready');
                          await loadQuote();
                          showSuccess('Quote marked as ready');
                        } catch (error: any) {
                          showError(error.response?.data?.message || 'Failed to mark quote as ready');
                        }
                      }}
                      className="whitespace-nowrap"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      {isChangeOrder ? 'Mark Change Order as Ready' : 'Mark as Ready'}
                    </Button>
                  )}
                </>
              )}

              {/* View Approvals Tab */}
              {approvalStatus && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveTab('approvals')}
                >
                  View Approvals
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Expiration Warning */}
      {expired && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
            <div>
              <p className="font-semibold text-red-900 dark:text-red-100">
                Quote Expired
              </p>
              <p className="text-sm text-red-700 dark:text-red-300">
                This quote expired on {quote.expires_at ? new Date(quote.expires_at).toLocaleDateString() : 'N/A'}
              </p>
            </div>
          </div>
        </div>
      )}

      {nearExpiration && !expired && (
        <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
            <div>
              <p className="font-semibold text-yellow-900 dark:text-yellow-100">
                Expiring Soon
              </p>
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                This quote expires on {quote.expires_at ? new Date(quote.expires_at).toLocaleDateString() : 'N/A'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Summary Card - Collapsible */}
      <Card className="mb-6">
        {/* Header - Always Visible */}
        <button
          onClick={() => setSummaryExpanded(!summaryExpanded)}
          className="w-full p-6 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          <div className="flex items-center gap-3">
            <DollarSign className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {isChangeOrder ? 'Change Order Summary' : 'Quote Summary'}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
              {formatMoney(quote.total)}
            </span>
            {summaryExpanded ? (
              <ChevronUp className="w-5 h-5 text-gray-500" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-500" />
            )}
          </div>
        </button>

        {/* Expandable Content */}
        {summaryExpanded && (
          <div className="px-6 pb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Customer Info */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Customer
                </h3>
                <div className="space-y-2 text-sm">
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    {quote.lead?.first_name || ''} {quote.lead?.last_name || ''}
                  </p>
                  <p className="text-gray-600 dark:text-gray-400">{getPrimaryEmail()}</p>
                  <p className="text-gray-600 dark:text-gray-400">{getPrimaryPhone()}</p>
                </div>
              </div>

              {/* Vendor Info */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  Vendor
                </h3>
                <div className="space-y-2 text-sm">
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    {quote.vendor?.name || 'Unknown'}
                  </p>
                  <p className="text-gray-600 dark:text-gray-400">{quote.vendor?.email || 'N/A'}</p>
                  <p className="text-gray-600 dark:text-gray-400">{quote.vendor?.phone || 'N/A'}</p>
                </div>
              </div>

              {/* Financial Summary */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Totals
                </h3>
                <div className="space-y-2 text-sm">
                  {(() => {
                    // Calculate financial summary with item-level custom values
                    const financials = calculateQuoteFinancials(quote, items, quoteSettings);

                    return (
                      <>
                        {/* Item Totals (Base Cost) */}
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Item Totals:</span>
                          <span className="font-medium text-gray-900 dark:text-gray-100">
                            {formatMoney(financials.itemTotals)}
                          </span>
                        </div>

                        {/* Profit */}
                        {financials.profitAmount > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400 pl-4">
                              Profit{!financials.hasMixedProfitRates && financials.uniformProfitPercent !== undefined ? ` (${financials.uniformProfitPercent}%)` : ''}:
                            </span>
                            <span className="font-medium text-gray-900 dark:text-gray-100">
                              {formatMoney(financials.profitAmount)}
                            </span>
                          </div>
                        )}

                        {/* Overhead */}
                        {financials.overheadAmount > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400 pl-4">
                              Overhead{!financials.hasMixedOverheadRates && financials.uniformOverheadPercent !== undefined ? ` (${financials.uniformOverheadPercent}%)` : ''}:
                            </span>
                            <span className="font-medium text-gray-900 dark:text-gray-100">
                              {formatMoney(financials.overheadAmount)}
                            </span>
                          </div>
                        )}

                        {/* Contingency */}
                        {financials.contingencyAmount > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400 pl-4">
                              Contingency{!financials.hasMixedContingencyRates && financials.uniformContingencyPercent !== undefined ? ` (${financials.uniformContingencyPercent}%)` : ''}:
                            </span>
                            <span className="font-medium text-gray-900 dark:text-gray-100">
                              {formatMoney(financials.contingencyAmount)}
                            </span>
                          </div>
                        )}

                        {/* Subtotal (from backend - after markup, before discount) */}
                        <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                          <span className="text-gray-600 dark:text-gray-400">Subtotal:</span>
                          <span className="font-medium text-gray-900 dark:text-gray-100">
                            {formatMoney(quote.subtotal)}
                          </span>
                        </div>

                        {/* Discount (from backend - applied before tax) */}
                        {quote.discount_amount > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">Discount:</span>
                            <span className="font-medium text-green-600 dark:text-green-400">
                              -{formatMoney(quote.discount_amount)}
                            </span>
                          </div>
                        )}

                        {/* Tax (from backend - applied after discount) */}
                        {quote.tax_amount > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">Tax:</span>
                            <span className="font-medium text-gray-900 dark:text-gray-100">
                              {formatMoney(quote.tax_amount)}
                            </span>
                          </div>
                        )}

                        {/* Total (from backend) */}
                        <div className="flex justify-between pt-2 border-t-2 border-gray-300 dark:border-gray-600">
                          <span className="font-semibold text-gray-900 dark:text-gray-100">Total:</span>
                          <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
                            {formatMoney(quote.total)}
                          </span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Dates */}
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <span className="text-gray-600 dark:text-gray-400">Created:</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {new Date(quote.created_at).toLocaleDateString()}
                  </span>
                </div>
                {quote.expires_at && (
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    <span className="text-gray-600 dark:text-gray-400">Expires:</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {new Date(quote.expires_at).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Project Totals Card - Only show for parent quotes with approved change orders */}
      {!isChangeOrder && quote.approved_change_orders_count && quote.approved_change_orders_count > 0 && (
        <Card className="mb-6 border-2 border-green-200 dark:border-green-800">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <FileEdit className="w-6 h-6 text-green-600 dark:text-green-400" />
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Project Totals (Including Approved Change Orders)
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {quote.approved_change_orders_count} approved change order{quote.approved_change_orders_count !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left: Breakdown */}
              <div className="space-y-3">
                <div className="flex justify-between items-center pb-3 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Original Quote:</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {formatMoney(quote.total)}
                  </span>
                </div>

                <div className="flex justify-between items-center text-green-600 dark:text-green-400">
                  <span className="text-sm">Approved Change Orders:</span>
                  <span className="font-medium">
                    +{formatMoney(quote.approved_change_orders_total || 0)}
                  </span>
                </div>

                <div className="flex justify-between items-center pt-3 border-t-2 border-green-600 dark:border-green-400">
                  <span className="text-base font-semibold text-gray-900 dark:text-gray-100">
                    Revised Project Total:
                  </span>
                  <span className="text-xl font-bold text-green-600 dark:text-green-400">
                    {formatMoney(quote.total_with_change_orders || quote.total)}
                  </span>
                </div>
              </div>

              {/* Right: Approved Change Orders List */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  Approved Change Orders
                </h3>
                <div className="space-y-2">
                  {quote.change_orders
                    ?.filter(co => co.status === 'approved')
                    .map(co => (
                      <Link
                        key={co.id}
                        href={`/quotes/${co.id}`}
                        className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 dark:text-gray-100 text-sm truncate">
                            {co.quote_number}
                          </p>
                          <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                            {co.title}
                          </p>
                        </div>
                        <span className="text-sm font-medium text-green-600 dark:text-green-400 ml-3">
                          +{formatMoney(co.total)}
                        </span>
                      </Link>
                    ))}
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Tabs */}
      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} className="mb-6" />

      {/* DETAILS TAB */}
      {activeTab === 'details' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Main Details */}
          <div className="lg:col-span-2 space-y-4">
            {/* Jobsite Address */}
            <Card>
              <button
                onClick={() => setJobsiteExpanded(!jobsiteExpanded)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  Jobsite Address
                </h3>
                {jobsiteExpanded ? (
                  <ChevronUp className="w-5 h-5 text-gray-500" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-500" />
                )}
              </button>
              {jobsiteExpanded && quote.jobsite_address && (
                <div className="px-4 pb-4 text-sm text-gray-700 dark:text-gray-300">
                  <p>{quote.jobsite_address.address_line1}</p>
                  {quote.jobsite_address.address_line2 && (
                    <p>{quote.jobsite_address.address_line2}</p>
                  )}
                  <p>
                    {quote.jobsite_address.city}, {quote.jobsite_address.state}{' '}
                    {quote.jobsite_address.zip_code}
                  </p>
                </div>
              )}
            </Card>

            {/* Quote Details */}
            <Card>
              <button
                onClick={() => setDetailsExpanded(!detailsExpanded)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  Quote Details
                </h3>
                {detailsExpanded ? (
                  <ChevronUp className="w-5 h-5 text-gray-500" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-500" />
                )}
              </button>
              {detailsExpanded && (
                <div className="px-4 pb-4 space-y-3 text-sm">
                  {quote.po_number && (
                    <div>
                      <span className="font-semibold text-gray-700 dark:text-gray-300">
                        PO Number:
                      </span>
                      <span className="ml-2 text-gray-900 dark:text-gray-100">
                        {quote.po_number}
                      </span>
                    </div>
                  )}
                  <div>
                    <span className="font-semibold text-gray-700 dark:text-gray-300">
                      Version:
                    </span>
                    <span className="ml-2 text-gray-900 dark:text-gray-100">
                      {quote.active_version_number}
                    </span>
                  </div>
                  {(quote.custom_profit_percent !== null && quote.custom_profit_percent !== undefined) || quoteSettings?.default_profit_margin !== undefined ? (
                    <div>
                      <span className="font-semibold text-gray-700 dark:text-gray-300">
                        Profit {quote.custom_profit_percent !== null && quote.custom_profit_percent !== undefined ? '(Custom)' : '(Default)'}:
                      </span>
                      <span className="ml-2 text-gray-900 dark:text-gray-100">
                        {quote.custom_profit_percent !== null && quote.custom_profit_percent !== undefined ? quote.custom_profit_percent : quoteSettings?.default_profit_margin}%
                      </span>
                    </div>
                  ) : null}
                  {(quote.custom_overhead_percent !== null && quote.custom_overhead_percent !== undefined) || quoteSettings?.default_overhead_rate !== undefined ? (
                    <div>
                      <span className="font-semibold text-gray-700 dark:text-gray-300">
                        Overhead {quote.custom_overhead_percent !== null && quote.custom_overhead_percent !== undefined ? '(Custom)' : '(Default)'}:
                      </span>
                      <span className="ml-2 text-gray-900 dark:text-gray-100">
                        {quote.custom_overhead_percent !== null && quote.custom_overhead_percent !== undefined ? quote.custom_overhead_percent : quoteSettings?.default_overhead_rate}%
                      </span>
                    </div>
                  ) : null}
                  {(quote.custom_contingency_percent !== null && quote.custom_contingency_percent !== undefined) || quoteSettings?.default_contingency_rate !== undefined ? (
                    <div>
                      <span className="font-semibold text-gray-700 dark:text-gray-300">
                        Contingency {quote.custom_contingency_percent !== null && quote.custom_contingency_percent !== undefined ? '(Custom)' : '(Default)'}:
                      </span>
                      <span className="ml-2 text-gray-900 dark:text-gray-100">
                        {quote.custom_contingency_percent !== null && quote.custom_contingency_percent !== undefined ? quote.custom_contingency_percent : quoteSettings?.default_contingency_rate}%
                      </span>
                    </div>
                  ) : null}
                  {(quote.custom_tax_rate !== null && quote.custom_tax_rate !== undefined) || quoteSettings?.sales_tax_rate !== undefined ? (
                    <div>
                      <span className="font-semibold text-gray-700 dark:text-gray-300">
                        Tax Rate {quote.custom_tax_rate !== null && quote.custom_tax_rate !== undefined ? '(Custom)' : '(Default)'}:
                      </span>
                      <span className="ml-2 text-gray-900 dark:text-gray-100">
                        {quote.custom_tax_rate !== null && quote.custom_tax_rate !== undefined ? quote.custom_tax_rate : quoteSettings?.sales_tax_rate}%
                      </span>
                    </div>
                  ) : null}
                  {quote.custom_terms && (
                    <div>
                      <span className="font-semibold text-gray-700 dark:text-gray-300">
                        Terms:
                      </span>
                      <span className="ml-2 text-gray-900 dark:text-gray-100">
                        {quote.custom_terms}
                      </span>
                    </div>
                  )}
                  {quote.custom_payment_instructions && (
                    <div>
                      <span className="font-semibold text-gray-700 dark:text-gray-300">
                        Payment Instructions:
                      </span>
                      <span className="ml-2 text-gray-900 dark:text-gray-100">
                        {quote.custom_payment_instructions}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </Card>

            {/* Private Notes */}
            {quote.private_notes && (
              <Card>
                <button
                  onClick={() => setNotesExpanded(!notesExpanded)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    Private Notes
                  </h3>
                  {notesExpanded ? (
                    <ChevronUp className="w-5 h-5 text-gray-500" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-500" />
                  )}
                </button>
                {notesExpanded && (
                  <div className="px-4 pb-4 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {quote.private_notes}
                  </div>
                )}
              </Card>
            )}

            {/* Sprint 3: Discount Rules */}
            <DiscountRulesSection
              quoteId={quote.id}
              onDiscountChanged={() => {
                loadQuote();
              }}
              readOnly={!isQuoteEditable()}
            />

            {/* Sprint 3: Draw Schedule */}
            <DrawScheduleSection
              quoteId={quote.id}
              quoteTotal={quote.total}
              readOnly={!isQuoteEditable()}
            />
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-4">
            {/* Sprint 3: Profitability Widget */}
            <ProfitabilityWidget
              quoteId={quote.id}
              quoteTotals={{
                subtotal: quote.subtotal,
                discount: quote.discount_amount,
                total: quote.total,
                cost: quote.subtotal * 0.7, // Replace with actual cost if available
              }}
              onRefresh={loadQuote}
            />

            {/* Sprint 5: Public URL Management - Available for ready, sent, delivered, read, opened, downloaded, approved, started, concluded, email_failed */}
            {(quote.status === 'ready' ||
              quote.status === 'sent' ||
              quote.status === 'delivered' ||
              quote.status === 'read' ||
              quote.status === 'opened' ||
              quote.status === 'downloaded' ||
              quote.status === 'approved' ||
              quote.status === 'started' ||
              quote.status === 'concluded' ||
              quote.status === 'email_failed') && (
              publicAccessUrl ? (
                <PublicURLCard
                  publicAccess={publicAccessUrl}
                  onViewAnalytics={() => setShowAnalyticsModal(true)}
                  onDeactivate={loadPublicAccessStatus}
                />
              ) : (
                <Card className="p-4">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                    <LinkIcon className="w-4 h-4" />
                    Public Quote Link
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    Generate a shareable link for customers to view this quote.
                  </p>
                  <Button
                    variant="secondary"
                    onClick={() => setShowGenerateUrlModal(true)}
                    className="w-full"
                    disabled={publicAccessLoading}
                  >
                    <LinkIcon className="w-4 h-4 mr-2" />
                    Generate Public Link
                  </Button>
                </Card>
              )
            )}

            <Card className="p-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                Quick Stats
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Items:</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {items.length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Groups:</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {groups.length}
                  </span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ITEMS TAB */}
      {activeTab === 'items' && (
        <div className="space-y-6">
          {/* Locked Message */}
          {!isQuoteEditable() && (
            <Card className="p-4 bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
                    {isChangeOrder ? 'Change Order is Locked' : 'Quote is Locked'}
                  </p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-1">
                    This {isChangeOrder ? 'change order' : 'quote'} has been sent and cannot be edited. Items are view-only.
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Action Buttons */}
          {isQuoteEditable() && (
            <div className="flex flex-wrap gap-3">
              <Link href={`/quotes/${quote.id}/items/new`}>
                <Button>
                  <Plus className="w-4 h-4" />
                  Add Item
                </Button>
              </Link>
              <Button variant="secondary" onClick={() => setLibraryModalOpen(true)}>
                <Library className="w-4 h-4" />
                Add from Library
              </Button>
              <Button variant="secondary" onClick={() => setBundleModalOpen(true)}>
                <Package className="w-4 h-4" />
                Add from Bundle
              </Button>
              <Button variant="secondary" onClick={handleCreateGroup}>
                <Folder className="w-4 h-4" />
                Create Group
              </Button>
            </div>
          )}

          {itemsLoading ? (
            <div className="animate-pulse space-y-4">
              <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
              <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </div>
          ) : (
            <>
              {/* Groups (Collapsible with Drag-and-Drop) */}
              {groups.length > 0 && (
                <SortableList
                  items={groups}
                  onReorder={handleReorderGroups}
                  getItemId={(group) => group.id}
                  disabled={!isQuoteEditable()}
                >
                  {(group) => (
                    <SortableItem key={group.id} id={group.id}>
                      <GroupCard
                        group={group}
                        quoteId={quoteId}
                        onEdit={handleEditGroup}
                        onDelete={handleDeleteGroupClick}
                        onDuplicate={handleDuplicateGroup}
                        onItemEdit={handleEditItem}
                        onItemDelete={handleDeleteItemClick}
                        onItemDuplicate={handleDuplicateItem}
                        onItemMove={handleMoveItem}
                        onItemReorder={handleReorderItems}
                        onItemUpdate={async () => {
                          await loadItemsAndGroups();
                          await loadQuote();
                        }}
                        readOnly={!isQuoteEditable()}
                      />
                    </SortableItem>
                  )}
                </SortableList>
              )}

              {/* Ungrouped Items */}
              {ungroupedItems.length > 0 && (
                <Card className="p-4">
                  <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-4">
                    Ungrouped Items
                  </h3>
                  <ItemsList
                    items={ungroupedItems}
                    quoteId={quoteId}
                    onEdit={handleEditItem}
                    onDelete={handleDeleteItemClick}
                    onDuplicate={handleDuplicateItem}
                    onMoveToGroup={handleMoveItem}
                    onReorder={handleReorderItems}
                    onItemUpdate={async () => {
                      await loadItemsAndGroups();
                      await loadQuote();
                    }}
                    showGroupActions={true}
                    readOnly={!isQuoteEditable()}
                  />
                </Card>
              )}

              {/* Empty State */}
              {groups.length === 0 && ungroupedItems.length === 0 && (
                <Card className="p-12">
                  <div className="text-center">
                    <List className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                    <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                      No Items Yet
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                      Add items to this {isChangeOrder ? 'change order' : 'quote'} to get started
                    </p>
                    <Link href={`/quotes/${quote.id}/items/new`}>
                      <Button>
                        <Plus className="w-4 h-4" />
                        Add First Item
                      </Button>
                    </Link>
                  </div>
                </Card>
              )}
            </>
          )}
        </div>
      )}

      {/* APPROVALS TAB - Sprint 4 */}
      {activeTab === 'approvals' && (
        <div className="space-y-6">
          {approvalsLoading ? (
            <div className="animate-pulse space-y-4">
              <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </div>
          ) : approvalStatus ? (
            <>
              <ApprovalActionsCard
                quoteId={quote.id}
                quoteNumber={quote.quote_number}
                quoteTitle={quote.title}
                quoteTotal={quote.total}
                approvalStatus={approvalStatus}
                currentUserId={currentUserId}
                currentUserRole={currentUserRole}
                onStatusUpdate={async () => {
                  await loadApprovalStatus();
                  await loadQuote();
                }}
              />

              {/* Approval History Timeline */}
              <ApprovalHistoryTimeline quoteId={quote.id} />
            </>
          ) : (
            <Card className="p-12">
              <div className="text-center">
                <Shield className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-600 mb-4" />
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                  No Approval Workflow
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  This quote does not require approval
                </p>
                <Link href="/settings/quotes/approvals">
                  <Button variant="secondary">
                    Configure Approval Thresholds
                  </Button>
                </Link>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* VERSIONS TAB - Sprint 4 */}
      {activeTab === 'versions' && (
        <div className="space-y-6">
          <VersionTimelineCard
            versions={versions}
            loading={versionsLoading}
            onRestore={async () => {
              await loadVersions();
              await loadQuote();
              await loadItemsAndGroups();
            }}
          />
        </div>
      )}

      {/* CHANGE ORDERS TAB - Sprint 4 */}
      {activeTab === 'change-orders' && (
        <div className="space-y-6">
          <ChangeOrderList
            quoteId={quote.id}
            quoteStatus={quote.status}
            canCreateChangeOrder={canPerform('quotes', 'create')}
            canApproveChangeOrder={canPerform('quotes', 'approve')}
            onChangeOrderCreated={async () => {
              await loadQuote();
            }}
            onChangeOrderApproved={async () => {
              await loadQuote();
              await loadItemsAndGroups();
              await loadVersions();
            }}
          />
          <ChangeOrderHistoryTimeline
            parentQuoteId={quote.id}
            parentQuoteNumber={quote.quote_number}
          />
        </div>
      )}

      {/* ATTACHMENTS TAB - Sprint 5 */}
      {activeTab === 'attachments' && (
        <div className="space-y-6">
          <AttachmentsSection quoteId={quote.id} readOnly={!isQuoteEditable()} />
        </div>
      )}

      {/* EMAILS TAB - Sprint 5 */}
      {activeTab === 'emails' && (
        <div className="space-y-6">
          {/* Email History */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                Email History
              </h3>
              {(quote.status === 'ready' || quote.status === 'sent' || quote.status === 'delivered' || quote.status === 'read' || quote.status === 'opened' || quote.status === 'downloaded') && (
                <Button variant="primary" onClick={() => setShowSendModal(true)}>
                  <Send className="w-4 h-4 mr-2" />
                  {quote.status === 'ready' ? 'Send Quote' : 'Resend Quote'}
                </Button>
              )}
            </div>
            <QuoteEmailHistory quoteId={quote.id} />
          </Card>

          {/* Public Access Analytics */}
          {publicAccessUrl && (
            <Card className="p-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                <Eye className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                Public Quote Views
              </h3>
              <ViewHistoryTable quoteId={quote.id} />
            </Card>
          )}
        </div>
      )}

      {/* NOTES TAB - Coming Soon */}
      {activeTab === 'notes' && (
        <Card className="p-12">
          <div className="text-center">
            <div className="mb-4">
              <MessageSquare className="w-16 h-16 mx-auto text-gray-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              Coming Soon
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Additional notes will be managed here (Sprint 6)
            </p>
          </div>
        </Card>
      )}

      {/* Group Form Modal */}
      <GroupFormModal
        isOpen={groupModalOpen}
        onClose={() => setGroupModalOpen(false)}
        onSubmit={handleGroupSubmit}
        group={editingGroup}
        loading={groupModalLoading}
      />

      {/* Delete Group Modal */}
      <DeleteGroupModal
        isOpen={deleteGroupModalOpen}
        onClose={() => setDeleteGroupModalOpen(false)}
        onConfirm={handleDeleteGroupConfirm}
        group={deletingGroup}
        loading={deleteGroupLoading}
      />

      {/* Add from Library Modal */}
      <AddFromLibraryModal
        isOpen={libraryModalOpen}
        onClose={() => setLibraryModalOpen(false)}
        onAddItems={handleAddFromLibrary}
        loading={libraryModalLoading}
      />

      {/* Add from Bundle Modal */}
      <AddBundleModal
        isOpen={bundleModalOpen}
        onClose={() => setBundleModalOpen(false)}
        quoteId={quoteId}
        onSuccess={handleBundleSuccess}
      />

      {/* Move Item to Group Modal */}
      <MoveItemToGroupModal
        isOpen={moveItemModalOpen}
        onClose={() => {
          setMoveItemModalOpen(false);
          setMovingItem(null);
        }}
        item={movingItem}
        groups={groups}
        onMove={handleMoveItemConfirm}
        loading={moveItemLoading}
      />

      {/* Delete Item Confirmation Modal */}
      <Modal
        isOpen={deleteItemModalOpen}
        onClose={() => !deleteItemLoading && setDeleteItemModalOpen(false)}
        title="Delete Item"
        size="md"
      >
        <ModalContent>
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-gray-900 dark:text-gray-100 font-medium mb-2">
                Are you sure you want to delete this item?
              </p>
              {deletingItem && (
                <>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Item: {deletingItem.title}
                  </p>
                  {deletingItem.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {deletingItem.description}
                    </p>
                  )}
                </>
              )}
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                This action cannot be undone.
              </p>
            </div>
          </div>
        </ModalContent>
        <ModalActions>
          <Button
            variant="ghost"
            onClick={() => setDeleteItemModalOpen(false)}
            disabled={deleteItemLoading}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleDeleteItemConfirm}
            loading={deleteItemLoading}
          >
            Delete Item
          </Button>
        </ModalActions>
      </Modal>

      {/* Delete Quote Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => !deleteLoading && setDeleteModalOpen(false)}
        title="Confirm Delete"
        size="md"
      >
        <ModalContent>
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-gray-900 dark:text-gray-100 font-medium mb-2">
                Are you sure you want to delete this quote?
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Quote: {quote?.quote_number} - {quote?.title}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                This action cannot be undone.
              </p>
            </div>
          </div>
        </ModalContent>
        <ModalActions>
          <Button
            variant="ghost"
            onClick={() => setDeleteModalOpen(false)}
            disabled={deleteLoading}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleDelete}
            loading={deleteLoading}
          >
            Delete Quote
          </Button>
        </ModalActions>
      </Modal>

      {/* Skip Approval Confirmation Modal */}
      <Modal
        isOpen={skipApprovalModalOpen}
        onClose={() => !skipApprovalLoading && setSkipApprovalModalOpen(false)}
        title={isChangeOrder ? "Skip Approval & Mark Change Order as Ready" : "Skip Approval & Mark as Ready"}
        size="md"
      >
        <ModalContent>
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-gray-900 dark:text-gray-100 font-medium mb-2">
                Mark this {isChangeOrder ? 'change order' : 'quote'} as ready without approval?
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {isChangeOrder ? 'Change Order' : 'Quote'}: {quote?.quote_number} - {quote?.title}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                Total: {quote && formatMoney(quote.total)}
              </p>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-3 font-medium">
                ⚠️ This will only work if approval workflow is not required for this {isChangeOrder ? 'change order' : 'quote'} amount.
              </p>
            </div>
          </div>
        </ModalContent>
        <ModalActions>
          <Button
            variant="ghost"
            onClick={() => setSkipApprovalModalOpen(false)}
            disabled={skipApprovalLoading}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSkipApprovalConfirm}
            loading={skipApprovalLoading}
          >
            <CheckCircle2 className="w-4 h-4" />
            {isChangeOrder ? 'Mark Change Order as Ready' : 'Mark as Ready'}
          </Button>
        </ModalActions>
      </Modal>

      {/* Success/Error Message Modal */}
      <Modal
        isOpen={messageModalOpen}
        onClose={() => setMessageModalOpen(false)}
        title={errorMessage ? 'Error' : 'Success'}
        size="sm"
      >
        <ModalContent>
          {errorMessage && (
            <p className="text-red-600 dark:text-red-400">{errorMessage}</p>
          )}
          {successMessage && (
            <p className="text-green-600 dark:text-green-400">{successMessage}</p>
          )}
        </ModalContent>
        <ModalActions>
          <Button onClick={() => setMessageModalOpen(false)}>Close</Button>
        </ModalActions>
      </Modal>

      {/* Sprint 5: Send Quote Modal */}
      <SendQuoteModal
        isOpen={showSendModal}
        onClose={() => setShowSendModal(false)}
        quoteId={quote.id}
        quoteNumber={quote.quote_number}
        quoteTitle={quote.title}
        quoteTotal={quote.total}
        customerEmail={getPrimaryEmail()}
        companyName={quote.vendor?.name}
        onSuccess={(response: SendQuoteResponse) => {
          // Update quote status to 'sent'
          loadQuote();
          setShowSendModal(false);
          showSuccess(`Quote sent successfully to ${getPrimaryEmail()}`);
        }}
      />

      {/* Sprint 5: Generate Public URL Modal */}
      <PublicURLModal
        isOpen={showGenerateUrlModal}
        onClose={() => setShowGenerateUrlModal(false)}
        quoteId={quote.id}
        onSuccess={(publicAccess: PublicAccessUrl) => {
          setPublicAccessUrl(publicAccess);
          setShowGenerateUrlModal(false);
          showSuccess('Public quote link generated successfully!');
        }}
      />

      {/* Sprint 5: View Analytics Modal */}
      {publicAccessUrl && (
        <ViewAnalyticsModal
          isOpen={showAnalyticsModal}
          onClose={() => setShowAnalyticsModal(false)}
          quoteId={quote.id}
        />
      )}
    </div>
  );
}
