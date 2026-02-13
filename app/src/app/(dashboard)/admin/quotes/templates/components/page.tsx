'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Grid3x3,
  List,
  Plus,
  Eye,
  Edit,
  Trash2,
  Settings,
  User,
  Building2,
  FileText,
  DollarSign,
  Package,
  Shield,
  PenTool,
  Calendar,
  CreditCard,
  Image as ImageIcon,
  Type,
  Minus,
  Space,
  Table as TableIcon,
  BarChart,
  QrCode,
  MapPin,
  Box,
  Sparkles,
  ArrowLeft,
} from 'lucide-react';
import { listComponents, deleteComponent } from '@/lib/api/template-builder';
import type { TemplateComponent, ComponentListParams } from '@/lib/types/quote-admin';
import toast from 'react-hot-toast';
import ComponentPreviewModal from '@/components/templates/ComponentPreviewModal';

export default function ComponentLibraryPage() {
  const router = useRouter();
  const [components, setComponents] = useState<TemplateComponent[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [previewComponent, setPreviewComponent] = useState<{ id: string; name: string } | null>(
    null
  );
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadComponents();
  }, [selectedCategory]);

  const loadComponents = async () => {
    try {
      setLoading(true);
      const params: ComponentListParams = {
        page: 1,
        limit: 100,
      };
      if (selectedCategory !== 'all') {
        params.component_type = selectedCategory as any;
      }
      const data = await listComponents(params);
      setComponents(data.data);
    } catch (error) {
      console.error('Failed to load components:', error);
      toast.error('Failed to load components');
    } finally {
      setLoading(false);
    }
  };

  // Component definitions with metadata
  const componentDefinitions = [
    {
      type: 'header',
      name: 'Header',
      description: 'Template header section with company branding',
      icon: FileText,
      category: 'basic',
      color: 'blue',
    },
    {
      type: 'footer',
      name: 'Footer',
      description: 'Template footer with company information',
      icon: FileText,
      category: 'basic',
      color: 'blue',
    },
    {
      type: 'customer_info',
      name: 'Customer Info',
      description: 'Customer details (name, email, phone, address)',
      icon: User,
      category: 'business',
      color: 'purple',
    },
    {
      type: 'company_info',
      name: 'Company Info',
      description: 'Your company details and contact information',
      icon: Building2,
      category: 'business',
      color: 'purple',
    },
    {
      type: 'line_items',
      name: 'Line Items Table',
      description: 'Product/service items with quantities and prices',
      icon: Package,
      category: 'business',
      color: 'purple',
    },
    {
      type: 'totals',
      name: 'Totals Summary',
      description: 'Subtotal, tax, discount, and grand total',
      icon: DollarSign,
      category: 'business',
      color: 'purple',
    },
    {
      type: 'payment_schedule',
      name: 'Payment Schedule',
      description: 'Payment milestones and due dates',
      icon: Calendar,
      category: 'business',
      color: 'purple',
    },
    {
      type: 'signature',
      name: 'Signature',
      description: 'Signature line with date',
      icon: PenTool,
      category: 'business',
      color: 'purple',
    },
    {
      type: 'terms',
      name: 'Terms & Conditions',
      description: 'Legal terms and conditions text',
      icon: Shield,
      category: 'business',
      color: 'purple',
    },
    {
      type: 'warranty',
      name: 'Warranty',
      description: 'Warranty information and coverage',
      icon: Shield,
      category: 'business',
      color: 'purple',
    },
    {
      type: 'logo',
      name: 'Logo',
      description: 'Company or brand logo image',
      icon: ImageIcon,
      category: 'basic',
      color: 'blue',
    },
    {
      type: 'image',
      name: 'Image',
      description: 'Generic image placeholder',
      icon: ImageIcon,
      category: 'basic',
      color: 'blue',
    },
    {
      type: 'text',
      name: 'Text Block',
      description: 'Rich text content area',
      icon: Type,
      category: 'basic',
      color: 'blue',
    },
    {
      type: 'divider',
      name: 'Divider',
      description: 'Horizontal line separator',
      icon: Minus,
      category: 'layout',
      color: 'gray',
    },
    {
      type: 'spacer',
      name: 'Spacer',
      description: 'Vertical spacing element',
      icon: Space,
      category: 'layout',
      color: 'gray',
    },
    {
      type: 'address',
      name: 'Address',
      description: 'Formatted address block',
      icon: MapPin,
      category: 'layout',
      color: 'gray',
    },
    {
      type: 'table',
      name: 'Custom Table',
      description: 'Customizable data table',
      icon: TableIcon,
      category: 'advanced',
      color: 'green',
    },
    {
      type: 'chart',
      name: 'Chart',
      description: 'Visual data chart',
      icon: BarChart,
      category: 'advanced',
      color: 'green',
    },
    {
      type: 'barcode',
      name: 'Barcode',
      description: 'Linear barcode generator',
      icon: QrCode,
      category: 'advanced',
      color: 'green',
    },
    {
      type: 'qr_code',
      name: 'QR Code',
      description: '2D QR code generator',
      icon: QrCode,
      category: 'advanced',
      color: 'green',
    },
    {
      type: 'custom',
      name: 'Custom Component',
      description: 'Build your own custom component',
      icon: Settings,
      category: 'advanced',
      color: 'green',
    },
  ];

  // Categories (using real API data - correct categories from backend)
  const categories = [
    { id: 'all', label: 'All Components', count: components.length },
    {
      id: 'layout',
      label: 'Layout',
      count: components.filter((c) => c.category === 'layout').length,
    },
    {
      id: 'content',
      label: 'Content',
      count: components.filter((c) => c.category === 'content').length,
    },
    {
      id: 'custom',
      label: 'Custom',
      count: components.filter((c) => c.category === 'custom').length,
    },
  ];

  // Join real API components with metadata for UI
  const componentsWithMetadata = components.map((comp) => {
    const metadata = componentDefinitions.find((def) => def.type === comp.component_type) || {
      icon: Box,
      color: 'blue',
    };
    return {
      ...comp,
      icon: metadata.icon,
      color: metadata.color,
    };
  });

  // Filter components from real API data
  const filteredComponents = componentsWithMetadata.filter((comp) => {
    const matchesSearch =
      comp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (comp.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (comp.tags || []).some((tag: string) => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedCategory === 'all' || comp.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Get color classes
  const getColorClasses = (color: string) => {
    switch (color) {
      case 'blue':
        return 'from-blue-500 to-cyan-500';
      case 'purple':
        return 'from-purple-500 to-pink-500';
      case 'gray':
        return 'from-gray-500 to-slate-500';
      case 'green':
        return 'from-green-500 to-emerald-500';
      default:
        return 'from-blue-500 to-cyan-500';
    }
  };

  // Preview component
  const handlePreview = (componentId: string, componentName: string) => {
    setPreviewComponent({ id: componentId, name: componentName });
  };

  // Delete component
  const handleDelete = async (componentId: string, componentName: string) => {
    if (!confirm(`Are you sure you want to delete "${componentName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setDeletingId(componentId);
      await deleteComponent(componentId);
      toast.success('Component deleted successfully');
      loadComponents(); // Reload the list
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete component');
    } finally {
      setDeletingId(null);
    }
  };

  // Edit component - navigate to edit page
  const handleEdit = (componentId: string) => {
    router.push(`/admin/quotes/templates/components/${componentId}/edit`);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/admin/quotes/templates')}
                className="flex items-center gap-2 px-3 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="text-sm font-medium">Back</span>
              </button>

              <div className="h-6 w-px bg-gray-300 dark:bg-gray-700"></div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                  <Box className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    Component Library
                  </h1>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Browse and manage template components
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() =>
                  toast('Custom components can be created in the Visual Template Builder', {
                    duration: 4000,
                  })
                }
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg font-medium transition-colors"
                title="Create custom components in the Visual Builder"
              >
                <Plus className="w-4 h-4" />
                <span>Create Custom</span>
              </button>
            </div>
          </div>

          {/* Search and View Toggle */}
          <div className="flex items-center gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search components..."
                className="w-full pl-11 pr-4 py-2.5 bg-gray-100 dark:bg-gray-800 border-0 rounded-lg text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* View Mode */}
            <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded ${
                  viewMode === 'grid'
                    ? 'bg-white dark:bg-gray-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                <Grid3x3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded ${
                  viewMode === 'list'
                    ? 'bg-white dark:bg-gray-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex gap-6">
          {/* Sidebar - Categories */}
          <div className="w-64 flex-shrink-0">
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 sticky top-24">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                Categories
              </h3>
              <div className="space-y-1">
                {categories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className={`
                      w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-all
                      ${
                        selectedCategory === category.id
                          ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                      }
                    `}
                  >
                    <span>{category.label}</span>
                    <span
                      className={`
                      text-xs px-2 py-0.5 rounded-full
                      ${
                        selectedCategory === category.id
                          ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                      }
                    `}
                    >
                      {category.count}
                    </span>
                  </button>
                ))}
              </div>

              {/* Info Box */}
              <div className="mt-6 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-blue-900 dark:text-blue-100 mb-1">
                      21 Pre-built Components
                    </p>
                    <p className="text-xs text-blue-700 dark:text-blue-300">
                      Ready to use in your visual templates. Drag and drop onto the canvas.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <Box className="w-12 h-12 text-gray-400 animate-pulse mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">Loading components...</p>
                </div>
              </div>
            ) : filteredComponents.length === 0 ? (
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-12 text-center">
                <Search className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  No components found
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  Try adjusting your search or filters
                </p>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredComponents.map((comp) => {
                  const Icon = comp.icon;
                  return (
                    <div
                      key={comp.id}
                      className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden hover:shadow-xl hover:border-blue-300 dark:hover:border-blue-700 transition-all duration-300 group"
                    >
                      {/* Icon Header */}
                      <div
                        className={`h-32 bg-gradient-to-br ${getColorClasses(
                          comp.color
                        )} flex items-center justify-center relative overflow-hidden`}
                      >
                        <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors"></div>
                        <Icon className="w-16 h-16 text-white relative z-10 group-hover:scale-110 transition-transform" />
                      </div>

                      {/* Content */}
                      <div className="p-5">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                          {comp.name}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                          {comp.description}
                        </p>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handlePreview(comp.id, comp.name)}
                            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
                            title="Preview"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEdit(comp.id)}
                            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(comp.id, comp.name)}
                            disabled={deletingId === comp.id}
                            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* List View */
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 divide-y divide-gray-200 dark:divide-gray-800">
                {filteredComponents.map((comp) => {
                  const Icon = comp.icon;
                  return (
                    <div
                      key={comp.id}
                      className="p-5 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        {/* Icon */}
                        <div
                          className={`w-16 h-16 bg-gradient-to-br ${getColorClasses(
                            comp.color
                          )} rounded-lg flex items-center justify-center flex-shrink-0`}
                        >
                          <Icon className="w-8 h-8 text-white" />
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">
                            {comp.name}
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {comp.description}
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handlePreview(comp.id, comp.name)}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
                            title="Preview"
                          >
                            <Eye className="w-4 h-4" />
                            <span>Preview</span>
                          </button>
                          <button
                            onClick={() => handleEdit(comp.id)}
                            className="p-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(comp.id, comp.name)}
                            disabled={deletingId === comp.id}
                            className="p-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Component Preview Modal */}
      {previewComponent && (
        <ComponentPreviewModal
          isOpen={true}
          onClose={() => setPreviewComponent(null)}
          componentId={previewComponent.id}
          componentName={previewComponent.name}
        />
      )}
    </div>
  );
}
