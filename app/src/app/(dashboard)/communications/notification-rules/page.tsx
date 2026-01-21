/**
 * Notification Rules Page
 * Manage notification rules for automated notifications
 * Allows creating rules for different event types
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Bell, Mail, Users } from 'lucide-react';
import { getNotificationRules, deleteNotificationRule } from '@/lib/api/communication';
import type { NotificationRule } from '@/lib/types/communication';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { NotificationRuleModal } from '@/components/communication/NotificationRuleModal';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';

export default function NotificationRulesPage() {
  const [rules, setRules] = useState<NotificationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRule, setEditingRule] = useState<NotificationRule | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Fetch rules
  const fetchRules = async () => {
    try {
      setLoading(true);
      const data = await getNotificationRules();
      setRules(data);
    } catch (error) {
      console.error('Failed to fetch notification rules:', error);
      toast.error('Failed to load notification rules');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  // Delete rule
  const handleDelete = async (ruleId: string) => {
    try {
      await deleteNotificationRule(ruleId);
      toast.success('Notification rule deleted');
      fetchRules();
    } catch (error) {
      console.error('Failed to delete rule:', error);
      toast.error('Failed to delete notification rule');
    } finally {
      setDeleteConfirm(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Notification Rules
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Configure automated notifications for different events
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Rule
        </Button>
      </div>

      {/* Rules List */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <LoadingSpinner />
        </div>
      ) : rules.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
          <Bell className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" />
          <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
            No notification rules
          </h3>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Get started by creating your first notification rule
          </p>
          <Button onClick={() => setShowCreateModal(true)} className="mt-4">
            <Plus className="h-4 w-4 mr-2" />
            Create Rule
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rules.map((rule) => (
            <NotificationRuleCard
              key={rule.id}
              rule={rule}
              onEdit={() => setEditingRule(rule)}
              onDelete={() => setDeleteConfirm(rule.id)}
            />
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {(showCreateModal || editingRule) && (
        <NotificationRuleModal
          isOpen
          rule={editingRule || undefined}
          onClose={() => {
            setShowCreateModal(false);
            setEditingRule(null);
          }}
          onSuccess={() => {
            setShowCreateModal(false);
            setEditingRule(null);
            fetchRules();
          }}
        />
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <ConfirmModal
          isOpen
          onClose={() => setDeleteConfirm(null)}
          onConfirm={() => handleDelete(deleteConfirm)}
          title="Delete Notification Rule"
          message="Are you sure you want to delete this notification rule? Automated notifications for this event will stop."
          confirmText="Delete"
          variant="danger"
        />
      )}
    </div>
  );
}

// Notification Rule Card Component
function NotificationRuleCard({
  rule,
  onEdit,
  onDelete,
}: {
  rule: NotificationRule;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const recipientTypeLabels: Record<string, string> = {
    owner: 'Owner',
    assigned_user: 'Assigned User',
    specific_users: 'Specific Users',
    all_users: 'All Users',
  };

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            {rule.event_type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {recipientTypeLabels[rule.recipient_type]}
          </p>
        </div>
        {!rule.is_active && (
          <span className="ml-2 px-2 py-0.5 text-xs font-semibold rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
            Inactive
          </span>
        )}
      </div>

      {/* Notification Channels */}
      <div className="flex items-center gap-2 mb-3">
        {rule.notify_in_app && (
          <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium rounded">
            <Bell className="h-3 w-3" />
            In-App
          </div>
        )}
        {rule.notify_email && (
          <div className="flex items-center gap-1.5 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs font-medium rounded">
            <Mail className="h-3 w-3" />
            Email
          </div>
        )}
      </div>

      {/* Email Template */}
      {rule.notify_email && rule.email_template_key && (
        <div className="text-xs text-gray-600 dark:text-gray-400 mb-3">
          Template: <code className="font-mono">{rule.email_template_key}</code>
        </div>
      )}

      {/* Specific Users */}
      {rule.recipient_type === 'specific_users' && rule.specific_user_ids && (
        <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 mb-3">
          <Users className="h-3.5 w-3.5" />
          {rule.specific_user_ids.length} user{rule.specific_user_ids.length === 1 ? '' : 's'}
        </div>
      )}

      {/* Metadata */}
      <div className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        Created {format(new Date(rule.created_at), 'MMM d, yyyy')}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={onEdit}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
        >
          <Edit className="h-4 w-4" />
          Edit
        </button>
        <button
          onClick={onDelete}
          className="flex items-center justify-center p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
          title="Delete rule"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
