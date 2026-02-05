'use client';

import React, { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import {
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
  Settings,
  Search,
  Box,
  Sparkles,
} from 'lucide-react';

interface ComponentLibraryProps {
  onAddComponent?: (componentType: string) => void;
}

interface ComponentDefinition {
  type: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: 'basic' | 'business' | 'layout' | 'advanced';
}

// Draggable component item
function DraggableComponent({ component }: { component: ComponentDefinition }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `library-${component.type}`,
    data: { componentType: component.type },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`
        flex items-start gap-3 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700
        rounded-lg cursor-grab active:cursor-grabbing hover:border-blue-400 dark:hover:border-blue-500
        hover:shadow-md transition-all duration-200 group
        ${isDragging ? 'shadow-xl ring-2 ring-blue-400' : ''}
      `}
    >
      <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-lg flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
        {component.icon}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
          {component.name}
        </h4>
        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mt-0.5">
          {component.description}
        </p>
      </div>
    </div>
  );
}

export default function ComponentLibrary({ onAddComponent }: ComponentLibraryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | 'basic' | 'business' | 'layout' | 'advanced'>('all');

  // All available components
  const components: ComponentDefinition[] = [
    // Basic Components
    {
      type: 'header',
      name: 'Header',
      description: 'Template header with title and branding',
      icon: <FileText className="w-5 h-5" />,
      category: 'basic',
    },
    {
      type: 'footer',
      name: 'Footer',
      description: 'Template footer with company info',
      icon: <FileText className="w-5 h-5" />,
      category: 'basic',
    },
    {
      type: 'logo',
      name: 'Logo',
      description: 'Company or brand logo',
      icon: <ImageIcon className="w-5 h-5" />,
      category: 'basic',
    },
    {
      type: 'text',
      name: 'Text Block',
      description: 'Rich text content area',
      icon: <Type className="w-5 h-5" />,
      category: 'basic',
    },
    {
      type: 'image',
      name: 'Image',
      description: 'Image or photo placeholder',
      icon: <ImageIcon className="w-5 h-5" />,
      category: 'basic',
    },

    // Business Components
    {
      type: 'customer_info',
      name: 'Customer Info',
      description: 'Customer name, email, phone, address',
      icon: <User className="w-5 h-5" />,
      category: 'business',
    },
    {
      type: 'company_info',
      name: 'Company Info',
      description: 'Your company details and contact',
      icon: <Building2 className="w-5 h-5" />,
      category: 'business',
    },
    {
      type: 'vendor_info',
      name: 'Vendor Info',
      description: 'Vendor/contractor company information',
      icon: <Building2 className="w-5 h-5" />,
      category: 'business',
    },
    {
      type: 'line_items',
      name: 'Line Items',
      description: 'Product/service line items table',
      icon: <Package className="w-5 h-5" />,
      category: 'business',
    },
    {
      type: 'totals',
      name: 'Totals',
      description: 'Subtotal, tax, discount, total',
      icon: <DollarSign className="w-5 h-5" />,
      category: 'business',
    },
    {
      type: 'payment_schedule',
      name: 'Payment Schedule',
      description: 'Payment milestones and dates',
      icon: <Calendar className="w-5 h-5" />,
      category: 'business',
    },
    {
      type: 'signature',
      name: 'Signature',
      description: 'Signature line with date',
      icon: <PenTool className="w-5 h-5" />,
      category: 'business',
    },
    {
      type: 'terms',
      name: 'Terms & Conditions',
      description: 'Legal terms and conditions',
      icon: <Shield className="w-5 h-5" />,
      category: 'business',
    },
    {
      type: 'warranty',
      name: 'Warranty',
      description: 'Warranty information and terms',
      icon: <Shield className="w-5 h-5" />,
      category: 'business',
    },

    // Layout Components
    {
      type: 'divider',
      name: 'Divider',
      description: 'Horizontal line separator',
      icon: <Minus className="w-5 h-5" />,
      category: 'layout',
    },
    {
      type: 'spacer',
      name: 'Spacer',
      description: 'Vertical spacing element',
      icon: <Space className="w-5 h-5" />,
      category: 'layout',
    },
    {
      type: 'address',
      name: 'Address',
      description: 'Formatted address block',
      icon: <MapPin className="w-5 h-5" />,
      category: 'layout',
    },

    // Advanced Components
    {
      type: 'table',
      name: 'Table',
      description: 'Custom data table',
      icon: <TableIcon className="w-5 h-5" />,
      category: 'advanced',
    },
    {
      type: 'chart',
      name: 'Chart',
      description: 'Visual data chart',
      icon: <BarChart className="w-5 h-5" />,
      category: 'advanced',
    },
    {
      type: 'barcode',
      name: 'Barcode',
      description: 'Linear barcode',
      icon: <QrCode className="w-5 h-5" />,
      category: 'advanced',
    },
    {
      type: 'qr_code',
      name: 'QR Code',
      description: '2D QR code',
      icon: <QrCode className="w-5 h-5" />,
      category: 'advanced',
    },
    {
      type: 'custom',
      name: 'Custom Component',
      description: 'Build your own component',
      icon: <Settings className="w-5 h-5" />,
      category: 'advanced',
    },
  ];

  // Filter components
  const filteredComponents = components.filter((component) => {
    const matchesSearch =
      component.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      component.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === 'all' || component.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  // Category tabs
  const categories = [
    { id: 'all', label: 'All', icon: <Box className="w-4 h-4" /> },
    { id: 'basic', label: 'Basic', icon: <FileText className="w-4 h-4" /> },
    { id: 'business', label: 'Business', icon: <Building2 className="w-4 h-4" /> },
    { id: 'layout', label: 'Layout', icon: <Minus className="w-4 h-4" /> },
    { id: 'advanced', label: 'Advanced', icon: <Sparkles className="w-4 h-4" /> },
  ];

  return (
    <div className="w-80 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-800">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
          Components
        </h2>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search components..."
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Category Tabs */}
        <div className="flex flex-wrap gap-1 mt-3">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setActiveCategory(category.id as any)}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                ${
                  activeCategory === category.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 border border-gray-200 dark:border-gray-700'
                }
              `}
            >
              {category.icon}
              <span>{category.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Component List */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredComponents.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Drag components to the canvas to add them
            </p>
            {filteredComponents.map((component) => (
              <DraggableComponent key={component.type} component={component} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Box className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No components found
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Try a different search or category
            </p>
          </div>
        )}
      </div>

      {/* Tip */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-blue-50 dark:bg-blue-900/20">
        <div className="flex items-start gap-2">
          <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-blue-900 dark:text-blue-100">
              Pro Tip
            </p>
            <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
              Drag components onto the canvas, then customize them in the properties panel
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
