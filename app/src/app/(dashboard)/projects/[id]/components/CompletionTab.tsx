/**
 * CompletionTab
 * Manages the project completion checklist: start from template,
 * track items, manage punch list, and finalize project.
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle2,
  Circle,
  Plus,
  AlertTriangle,
  ClipboardCheck,
  ListChecks,
  Wrench,
  ChevronDown,
  ChevronUp,
  Flag,
  Clock,
  MessageSquare,
  Loader2,
  PartyPopper,
  Asterisk,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Card from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Modal, ModalContent, ModalActions } from '@/components/ui/Modal';
import {
  getCompletionChecklist,
  startCompletionChecklist,
  completeChecklistItem,
  addManualChecklistItem,
  addPunchListItem,
  updatePunchListItem,
  completeProject,
  listChecklistTemplates,
} from '@/lib/api/projects';
import type {
  CompletionChecklist,
  CompletionChecklistItem,
  PunchListItem,
  ChecklistTemplate,
} from '@/lib/types/projects';

interface CompletionTabProps {
  projectId: string;
}

// ============================================================================
// Main Component
// ============================================================================

export default function CompletionTab({ projectId }: CompletionTabProps) {
  const [checklist, setChecklist] = useState<CompletionChecklist | null>(null);
  const [loading, setLoading] = useState(true);
  const [notStarted, setNotStarted] = useState(false);

  const fetchChecklist = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getCompletionChecklist(projectId);
      setChecklist(data);
      setNotStarted(false);
    } catch (err: unknown) {
      const error = err as { status?: number };
      if (error.status === 404) {
        setNotStarted(true);
      } else {
        toast.error('Failed to load completion checklist');
      }
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchChecklist();
  }, [fetchChecklist]);

  if (loading) {
    return <LoadingSpinner size="lg" centered />;
  }

  if (notStarted) {
    return <StartCompletionView projectId={projectId} onStarted={(c) => { setChecklist(c); setNotStarted(false); }} />;
  }

  if (!checklist) return null;

  return (
    <div className="space-y-6 mt-6">
      {/* Summary */}
      <CompletionSummary checklist={checklist} />

      {/* Checklist Items */}
      <ChecklistItemsSection
        projectId={projectId}
        checklist={checklist}
        onUpdate={setChecklist}
      />

      {/* Punch List */}
      <PunchListSection
        projectId={projectId}
        checklist={checklist}
        onUpdate={setChecklist}
      />

      {/* Complete Project */}
      <CompleteProjectSection
        projectId={projectId}
        checklist={checklist}
        onCompleted={fetchChecklist}
      />
    </div>
  );
}

// ============================================================================
// Start Completion View
// ============================================================================

function StartCompletionView({
  projectId,
  onStarted,
}: {
  projectId: string;
  onStarted: (c: CompletionChecklist) => void;
}) {
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    listChecklistTemplates()
      .then((res) => setTemplates(res.data))
      .catch(() => {})
      .finally(() => setLoadingTemplates(false));
  }, []);

  const handleStart = async () => {
    setStarting(true);
    try {
      const dto = selectedTemplateId ? { template_id: selectedTemplateId } : undefined;
      const data = await startCompletionChecklist(projectId, dto);
      toast.success('Completion checklist started');
      onStarted(data);
    } catch (err: unknown) {
      const error = err as { status?: number; message?: string };
      if (error.status === 409) {
        toast.error('A completion checklist already exists for this project');
      } else {
        toast.error(error.message || 'Failed to start checklist');
      }
    } finally {
      setStarting(false);
    }
  };

  const templateOptions = [
    { value: '', label: 'Empty checklist (no template)' },
    ...templates.map((t) => ({ value: t.id, label: t.name })),
  ];

  return (
    <Card className="p-8 sm:p-12 text-center mt-6">
      <div className="mx-auto w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center mb-4">
        <ClipboardCheck className="w-8 h-8 text-blue-500" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
        Start Completion Checklist
      </h3>
      <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
        Begin the project completion process. Optionally select a template to pre-populate checklist items.
      </p>

      <div className="max-w-sm mx-auto space-y-4">
        {loadingTemplates ? (
          <LoadingSpinner size="sm" />
        ) : (
          <Select
            label="Template"
            value={selectedTemplateId}
            onChange={(val) => setSelectedTemplateId(val)}
            options={templateOptions}
          />
        )}

        <Button
          onClick={handleStart}
          loading={starting}
          fullWidth
        >
          Start Checklist
        </Button>
      </div>
    </Card>
  );
}

// ============================================================================
// Completion Summary
// ============================================================================

function CompletionSummary({ checklist }: { checklist: CompletionChecklist }) {
  const totalItems = checklist.items.length;
  const completedItems = checklist.items.filter((i) => i.is_completed).length;
  const requiredItems = checklist.items.filter((i) => i.is_required);
  const completedRequired = requiredItems.filter((i) => i.is_completed).length;
  const totalPunch = checklist.punch_list.length;
  const resolvedPunch = checklist.punch_list.filter((p) => p.status === 'resolved').length;
  const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <Card className="p-4 text-center">
        <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
          {completedItems}/{totalItems}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Items Completed</p>
      </Card>
      <Card className="p-4 text-center">
        <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
          {completedRequired}/{requiredItems.length}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Required Done</p>
      </Card>
      <Card className="p-4 text-center">
        <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
          {resolvedPunch}/{totalPunch}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Punch Resolved</p>
      </Card>
      <Card className="p-4 text-center">
        <p className="text-2xl font-bold text-green-600 dark:text-green-400">{progress}%</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Overall Progress</p>
      </Card>
    </div>
  );
}

// ============================================================================
// Checklist Items Section
// ============================================================================

function ChecklistItemsSection({
  projectId,
  checklist,
  onUpdate,
}: {
  projectId: string;
  checklist: CompletionChecklist;
  onUpdate: (c: CompletionChecklist) => void;
}) {
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addTitle, setAddTitle] = useState('');
  const [addRequired, setAddRequired] = useState(true);
  const [adding, setAdding] = useState(false);
  const [completingItem, setCompletingItem] = useState<string | null>(null);
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({});

  const toggleExpand = (itemId: string) => {
    setExpandedItem((prev) => (prev === itemId ? null : itemId));
  };

  const handleCompleteItem = async (item: CompletionChecklistItem) => {
    if (item.is_completed) return;
    setCompletingItem(item.id);
    try {
      const noteText = (itemNotes[item.id] || '').trim() || undefined;
      const updated = await completeChecklistItem(projectId, item.id, noteText ? { notes: noteText } : undefined);
      onUpdate(updated);
      setItemNotes((prev) => { const next = { ...prev }; delete next[item.id]; return next; });
      setExpandedItem(null);
      toast.success(`"${item.title}" marked complete`);
    } catch {
      toast.error('Failed to complete item');
    } finally {
      setCompletingItem(null);
    }
  };

  const handleAddItem = async () => {
    if (!addTitle.trim()) return;
    setAdding(true);
    try {
      const maxOrder = checklist.items.reduce((max, i) => Math.max(max, i.order_index), -1);
      const updated = await addManualChecklistItem(projectId, {
        title: addTitle.trim(),
        is_required: addRequired,
        order_index: maxOrder + 1,
      });
      onUpdate(updated);
      setAddTitle('');
      setAddRequired(true);
      setShowAddForm(false);
      toast.success('Item added');
    } catch {
      toast.error('Failed to add item');
    } finally {
      setAdding(false);
    }
  };

  const sortedItems = [...checklist.items].sort((a, b) => a.order_index - b.order_index);

  return (
    <Card>
      <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <ListChecks className="w-5 h-5 text-blue-500" />
          Checklist Items
        </h3>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium"
        >
          <Plus className="w-4 h-4" />
          Add Item
        </button>
      </div>

      {/* Add item form */}
      {showAddForm && (
        <div className="px-5 py-4 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 space-y-3">
          <Input
            placeholder="Item title"
            value={addTitle}
            onChange={(e) => setAddTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
          />
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <input
                type="checkbox"
                checked={addRequired}
                onChange={(e) => setAddRequired(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Required for completion
            </label>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleAddItem} loading={adding} disabled={!addTitle.trim()}>
                Add
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Items list */}
      {sortedItems.length === 0 ? (
        <div className="px-5 py-8 text-center text-gray-400 dark:text-gray-500 text-sm">
          No checklist items. Add items manually or start from a template.
        </div>
      ) : (
        <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
          {sortedItems.map((item) => {
            const isExpanded = expandedItem === item.id;
            return (
              <div key={item.id} className="group">
                <div className="flex items-start gap-3 px-5 py-3.5">
                  {/* Checkbox / status */}
                  <button
                    onClick={() => !item.is_completed && toggleExpand(item.id)}
                    className="mt-0.5 flex-shrink-0"
                    disabled={item.is_completed}
                  >
                    {item.is_completed ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    ) : completingItem === item.id ? (
                      <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                    ) : (
                      <Circle className="w-5 h-5 text-gray-300 dark:text-gray-600 group-hover:text-blue-400 transition-colors" />
                    )}
                  </button>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-sm font-medium ${
                          item.is_completed
                            ? 'text-gray-400 dark:text-gray-500 line-through'
                            : 'text-gray-800 dark:text-gray-200'
                        }`}
                      >
                        {item.title}
                      </span>
                      {item.is_required && !item.is_completed && (
                        <Asterisk className="w-3 h-3 text-red-400 flex-shrink-0" />
                      )}
                    </div>

                    {item.is_completed && item.completed_at && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Completed {new Date(item.completed_at).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                        })}
                      </p>
                    )}

                    {item.notes && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
                        <MessageSquare className="w-3 h-3 flex-shrink-0" />
                        {item.notes}
                      </p>
                    )}
                  </div>

                  {/* Required badge */}
                  {item.is_required && (
                    <span className="text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-2 py-0.5 rounded-full hidden sm:inline">
                      Required
                    </span>
                  )}

                  {/* Expand toggle for uncompleted items */}
                  {!item.is_completed && (
                    <button
                      onClick={() => toggleExpand(item.id)}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  )}
                </div>

                {/* Expanded: completion form */}
                {isExpanded && !item.is_completed && (
                  <div className="px-5 pb-4 pl-14 space-y-3">
                    <Textarea
                      placeholder="Add notes (optional)"
                      value={itemNotes[item.id] || ''}
                      onChange={(e) => setItemNotes((prev) => ({ ...prev, [item.id]: e.target.value }))}
                      rows={2}
                      className="text-sm"
                    />
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        onClick={() => handleCompleteItem(item)}
                        loading={completingItem === item.id}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Mark Complete
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ============================================================================
// Punch List Section
// ============================================================================

function PunchListSection({
  projectId,
  checklist,
  onUpdate,
}: {
  projectId: string;
  checklist: CompletionChecklist;
  onUpdate: (c: CompletionChecklist) => void;
}) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [adding, setAdding] = useState(false);
  const [updatingItem, setUpdatingItem] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!title.trim()) return;
    setAdding(true);
    try {
      const updated = await addPunchListItem(projectId, {
        title: title.trim(),
        description: description.trim() || undefined,
      });
      onUpdate(updated);
      setTitle('');
      setDescription('');
      setShowAddForm(false);
      toast.success('Punch list item added');
    } catch {
      toast.error('Failed to add punch list item');
    } finally {
      setAdding(false);
    }
  };

  const handleStatusChange = async (item: PunchListItem, newStatus: PunchListItem['status']) => {
    setUpdatingItem(item.id);
    try {
      const updated = await updatePunchListItem(projectId, item.id, { status: newStatus });
      onUpdate(updated);
      toast.success(
        newStatus === 'resolved'
          ? `"${item.title}" resolved`
          : `Status updated to ${newStatus.replace('_', ' ')}`,
      );
    } catch {
      toast.error('Failed to update status');
    } finally {
      setUpdatingItem(null);
    }
  };

  const punchStatusConfig: Record<string, { label: string; variant: 'danger' | 'warning' | 'success' }> = {
    open: { label: 'Open', variant: 'danger' },
    in_progress: { label: 'In Progress', variant: 'warning' },
    resolved: { label: 'Resolved', variant: 'success' },
  };

  return (
    <Card>
      <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Wrench className="w-5 h-5 text-purple-500" />
          Punch List
        </h3>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium"
        >
          <Plus className="w-4 h-4" />
          Add Item
        </button>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="px-5 py-4 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 space-y-3">
          <Input
            placeholder="Deficiency title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Textarea
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setShowAddForm(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleAdd} loading={adding} disabled={!title.trim()}>
              Add
            </Button>
          </div>
        </div>
      )}

      {/* Punch list items */}
      {checklist.punch_list.length === 0 ? (
        <div className="px-5 py-8 text-center text-gray-400 dark:text-gray-500 text-sm">
          No punch list items. Add deficiencies that must be resolved before project completion.
        </div>
      ) : (
        <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
          {checklist.punch_list.map((item) => {
            const config = punchStatusConfig[item.status] || punchStatusConfig.open;
            const isUpdating = updatingItem === item.id;

            return (
              <div key={item.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Flag className={`w-4 h-4 flex-shrink-0 ${
                        item.status === 'resolved' ? 'text-green-500' : item.status === 'in_progress' ? 'text-amber-500' : 'text-red-500'
                      }`} />
                      <span className={`text-sm font-medium ${
                        item.status === 'resolved' ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-800 dark:text-gray-200'
                      }`}>
                        {item.title}
                      </span>
                    </div>
                    {item.description && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 ml-6">{item.description}</p>
                    )}
                    {item.assigned_to_crew && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 ml-6 mt-1">
                        Assigned: {item.assigned_to_crew.first_name} {item.assigned_to_crew.last_name}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant={config.variant}>{config.label}</Badge>

                    {item.status !== 'resolved' && (
                      <div className="flex gap-1">
                        {item.status === 'open' && (
                          <button
                            onClick={() => handleStatusChange(item, 'in_progress')}
                            disabled={isUpdating}
                            className="text-xs text-amber-600 dark:text-amber-400 hover:underline font-medium whitespace-nowrap"
                          >
                            {isUpdating ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Start'}
                          </button>
                        )}
                        <button
                          onClick={() => handleStatusChange(item, 'resolved')}
                          disabled={isUpdating}
                          className="text-xs text-green-600 dark:text-green-400 hover:underline font-medium whitespace-nowrap"
                        >
                          {isUpdating ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Resolve'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ============================================================================
// Complete Project Section
// ============================================================================

function CompleteProjectSection({
  projectId,
  checklist,
  onCompleted,
}: {
  projectId: string;
  checklist: CompletionChecklist;
  onCompleted: () => void;
}) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [completing, setCompleting] = useState(false);

  const incompleteRequired = checklist.items.filter((i) => i.is_required && !i.is_completed);
  const unresolvedPunch = checklist.punch_list.filter((p) => p.status !== 'resolved');
  const canComplete = incompleteRequired.length === 0 && unresolvedPunch.length === 0;

  const handleComplete = async () => {
    setCompleting(true);
    try {
      await completeProject(projectId);
      toast.success('Project marked as completed!');
      setShowConfirm(false);
      onCompleted();
    } catch (err: unknown) {
      const error = err as { status?: number; data?: { message?: string; incomplete_checklist_items?: { title: string }[]; unresolved_punch_list_items?: { title: string }[] } };
      if (error.status === 409 && error.data) {
        const items = error.data.incomplete_checklist_items || [];
        const punch = error.data.unresolved_punch_list_items || [];
        const msg = [
          error.data.message || 'Cannot complete project',
          items.length > 0 ? `\nIncomplete items: ${items.map((i) => i.title).join(', ')}` : '',
          punch.length > 0 ? `\nUnresolved punch list: ${punch.map((p) => p.title).join(', ')}` : '',
        ].join('');
        toast.error(msg, { duration: 6000 });
      } else {
        toast.error('Failed to complete project');
      }
    } finally {
      setCompleting(false);
    }
  };

  // Already completed
  if (checklist.completed_at) {
    return (
      <Card className="p-6 text-center border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20">
        <PartyPopper className="w-10 h-10 text-green-500 mx-auto mb-2" />
        <h3 className="text-lg font-semibold text-green-800 dark:text-green-300 mb-1">
          Checklist Completed
        </h3>
        <p className="text-sm text-green-600 dark:text-green-400">
          All required items were completed on{' '}
          {new Date(checklist.completed_at).toLocaleDateString('en-US', {
            month: 'long', day: 'numeric', year: 'numeric',
          })}
        </p>
      </Card>
    );
  }

  return (
    <>
      <Card className="p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
              Finalize Project Completion
            </h3>
            {!canComplete ? (
              <div className="space-y-1">
                {incompleteRequired.length > 0 && (
                  <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" />
                    {incompleteRequired.length} required item{incompleteRequired.length > 1 ? 's' : ''} incomplete
                  </p>
                )}
                {unresolvedPunch.length > 0 && (
                  <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" />
                    {unresolvedPunch.length} punch list item{unresolvedPunch.length > 1 ? 's' : ''} unresolved
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-green-600 dark:text-green-400">
                All requirements met. Ready to finalize.
              </p>
            )}
          </div>

          <Button
            onClick={() => setShowConfirm(true)}
            disabled={!canComplete}
            className={canComplete ? 'bg-green-600 hover:bg-green-700' : ''}
          >
            Complete Project
          </Button>
        </div>
      </Card>

      {/* Confirmation Modal */}
      {showConfirm && (
        <Modal isOpen={showConfirm} onClose={() => setShowConfirm(false)}>
          <ModalContent title="Confirm Project Completion">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              This will mark the project as <strong>completed</strong> and set the actual completion date. This action is significant and affects project status.
            </p>
            <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <p className="text-sm text-green-700 dark:text-green-300">
                <CheckCircle2 className="w-4 h-4 inline mr-1" />
                {checklist.items.filter((i) => i.is_completed).length}/{checklist.items.length} items completed
              </p>
              <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                <CheckCircle2 className="w-4 h-4 inline mr-1" />
                {checklist.punch_list.filter((p) => p.status === 'resolved').length}/{checklist.punch_list.length} punch list items resolved
              </p>
            </div>
          </ModalContent>
          <ModalActions>
            <Button variant="secondary" onClick={() => setShowConfirm(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleComplete}
              loading={completing}
              className="bg-green-600 hover:bg-green-700"
            >
              Confirm Completion
            </Button>
          </ModalActions>
        </Modal>
      )}
    </>
  );
}
