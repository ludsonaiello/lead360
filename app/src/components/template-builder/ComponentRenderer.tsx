'use client';

import React from 'react';
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
} from 'lucide-react';
import type { TemplateComponent as ComponentType } from '@/lib/types/quote-admin';

interface ComponentRendererProps {
  component: ComponentType;
  isSelected?: boolean;
  onClick?: () => void;
  theme?: {
    colors?: {
      primary?: string;
      secondary?: string;
      text?: string;
      background?: string;
      border?: string;
    };
    fonts?: {
      heading?: string;
      body?: string;
    };
  };
}

/**
 * Renders a visual preview of a template component on the canvas
 * Shows a simplified preview of how the component will look in the final template
 */
export default function ComponentRenderer({
  component,
  isSelected = false,
  onClick,
  theme,
}: ComponentRendererProps) {
  const colors = theme?.colors || {};
  const fonts = theme?.fonts || {};

  // Get component icon and name
  const getComponentInfo = (type: string) => {
    const iconClass = "w-5 h-5";
    switch (type) {
      case 'header':
        return { icon: <FileText className={iconClass} />, name: 'Header' };
      case 'footer':
        return { icon: <FileText className={iconClass} />, name: 'Footer' };
      case 'customer_info':
        return { icon: <User className={iconClass} />, name: 'Customer Info' };
      case 'company_info':
        return { icon: <Building2 className={iconClass} />, name: 'Company Info' };
      case 'line_items':
        return { icon: <Package className={iconClass} />, name: 'Line Items' };
      case 'totals':
        return { icon: <DollarSign className={iconClass} />, name: 'Totals' };
      case 'terms':
        return { icon: <Shield className={iconClass} />, name: 'Terms & Conditions' };
      case 'signature':
        return { icon: <PenTool className={iconClass} />, name: 'Signature' };
      case 'payment_schedule':
        return { icon: <Calendar className={iconClass} />, name: 'Payment Schedule' };
      case 'warranty':
        return { icon: <Shield className={iconClass} />, name: 'Warranty' };
      case 'logo':
        return { icon: <ImageIcon className={iconClass} />, name: 'Logo' };
      case 'image':
        return { icon: <ImageIcon className={iconClass} />, name: 'Image' };
      case 'text':
        return { icon: <Type className={iconClass} />, name: 'Text Block' };
      case 'divider':
        return { icon: <Minus className={iconClass} />, name: 'Divider' };
      case 'spacer':
        return { icon: <Space className={iconClass} />, name: 'Spacer' };
      case 'table':
        return { icon: <TableIcon className={iconClass} />, name: 'Table' };
      case 'chart':
        return { icon: <BarChart className={iconClass} />, name: 'Chart' };
      case 'barcode':
        return { icon: <QrCode className={iconClass} />, name: 'Barcode' };
      case 'qr_code':
        return { icon: <QrCode className={iconClass} />, name: 'QR Code' };
      case 'address':
        return { icon: <MapPin className={iconClass} />, name: 'Address' };
      case 'custom':
        return { icon: <Settings className={iconClass} />, name: 'Custom Component' };
      default:
        return { icon: <FileText className={iconClass} />, name: component.type };
    }
  };

  const { icon, name } = getComponentInfo(component.type);

  // Component styling from config
  const style = component.style || {};
  const padding = style.padding || { top: 10, right: 10, bottom: 10, left: 10 };
  const margin = style.margin || { top: 0, right: 0, bottom: 20, left: 0 };
  const borderRadius = style.borderRadius || 0;
  const backgroundColor = style.backgroundColor || 'transparent';
  const border = style.border || { width: 0, color: '#e5e7eb', style: 'solid' };

  // Render preview content based on component type
  const renderPreviewContent = () => {
    const config = component.config || {};

    switch (component.type) {
      case 'header':
      case 'footer':
        return (
          <div className="space-y-2">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
            <div className="h-4 bg-gray-100 dark:bg-gray-600 rounded w-1/2"></div>
          </div>
        );

      case 'customer_info':
      case 'company_info':
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-gray-400" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded flex-1"></div>
            </div>
            {config.show_email && (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4"></div>
                <div className="h-3 bg-gray-100 dark:bg-gray-600 rounded w-2/3"></div>
              </div>
            )}
            {config.show_phone && (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4"></div>
                <div className="h-3 bg-gray-100 dark:bg-gray-600 rounded w-1/2"></div>
              </div>
            )}
            {config.show_address && (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4"></div>
                <div className="h-3 bg-gray-100 dark:bg-gray-600 rounded w-3/4"></div>
              </div>
            )}
          </div>
        );

      case 'line_items':
        return (
          <div className="space-y-1">
            <div className="grid grid-cols-4 gap-2 pb-2 border-b border-gray-300 dark:border-gray-600">
              <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded"></div>
              <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded"></div>
              <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded"></div>
              <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded"></div>
            </div>
            {[1, 2, 3].map((i) => (
              <div key={i} className="grid grid-cols-4 gap-2">
                <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded"></div>
                <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded"></div>
                <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded"></div>
                <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded"></div>
              </div>
            ))}
          </div>
        );

      case 'totals':
        return (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
            </div>
            <div className="flex justify-between items-center">
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-gray-300 dark:border-gray-600">
              <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-24"></div>
              <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-24"></div>
            </div>
          </div>
        );

      case 'terms':
      case 'warranty':
        return (
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
            <div className="h-3 bg-gray-100 dark:bg-gray-600 rounded w-full"></div>
            <div className="h-3 bg-gray-100 dark:bg-gray-600 rounded w-full"></div>
            <div className="h-3 bg-gray-100 dark:bg-gray-600 rounded w-4/5"></div>
          </div>
        );

      case 'signature':
        return (
          <div className="space-y-2">
            <div className="h-16 border-b-2 border-gray-300 dark:border-gray-600"></div>
            <div className="h-3 bg-gray-100 dark:bg-gray-600 rounded w-32"></div>
            <div className="h-3 bg-gray-100 dark:bg-gray-600 rounded w-24"></div>
          </div>
        );

      case 'payment_schedule':
        return (
          <div className="space-y-1">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex justify-between items-center">
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
              </div>
            ))}
          </div>
        );

      case 'logo':
      case 'image':
        return (
          <div className="flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-lg h-24">
            <ImageIcon className="w-12 h-12 text-gray-400" />
          </div>
        );

      case 'text':
        return (
          <div className="space-y-2">
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
          </div>
        );

      case 'divider':
        return (
          <div className="border-t-2 border-gray-300 dark:border-gray-600"></div>
        );

      case 'spacer':
        return (
          <div className="h-8 flex items-center justify-center text-gray-400 text-xs">
            {component.config?.height || 20}px spacer
          </div>
        );

      case 'table':
        return (
          <div className="space-y-1">
            <div className="grid grid-cols-3 gap-2 pb-1 border-b border-gray-300 dark:border-gray-600">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-3 bg-gray-300 dark:bg-gray-600 rounded"></div>
              ))}
            </div>
            {[1, 2].map((row) => (
              <div key={row} className="grid grid-cols-3 gap-2">
                {[1, 2, 3].map((col) => (
                  <div key={col} className="h-3 bg-gray-100 dark:bg-gray-700 rounded"></div>
                ))}
              </div>
            ))}
          </div>
        );

      case 'chart':
        return (
          <div className="flex items-end justify-around gap-1 h-24 bg-gray-50 dark:bg-gray-800 rounded p-2">
            {[60, 80, 40, 90, 50].map((height, i) => (
              <div
                key={i}
                className="bg-blue-400 dark:bg-blue-600 rounded-t w-full"
                style={{ height: `${height}%` }}
              ></div>
            ))}
          </div>
        );

      case 'barcode':
      case 'qr_code':
        return (
          <div className="flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded h-20">
            <QrCode className="w-16 h-16 text-gray-400" />
          </div>
        );

      case 'address':
        return (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-gray-400" />
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded flex-1"></div>
            </div>
            <div className="h-3 bg-gray-100 dark:bg-gray-600 rounded w-3/4 ml-6"></div>
            <div className="h-3 bg-gray-100 dark:bg-gray-600 rounded w-1/2 ml-6"></div>
          </div>
        );

      default:
        return (
          <div className="flex items-center justify-center py-8 text-gray-400 text-sm">
            Custom Component
          </div>
        );
    }
  };

  return (
    <div
      onClick={onClick}
      className={`
        relative rounded-lg transition-all duration-200 cursor-pointer
        ${isSelected ? 'ring-2 ring-blue-500 shadow-lg' : 'hover:ring-2 hover:ring-blue-300'}
      `}
      style={{
        backgroundColor,
        paddingTop: `${padding.top}px`,
        paddingRight: `${padding.right}px`,
        paddingBottom: `${padding.bottom}px`,
        paddingLeft: `${padding.left}px`,
        marginTop: `${margin.top}px`,
        marginRight: `${margin.right}px`,
        marginBottom: `${margin.bottom}px`,
        marginLeft: `${margin.left}px`,
        borderRadius: `${borderRadius}px`,
        border: border.width > 0 ? `${border.width}px ${border.style} ${border.color}` : 'none',
      }}
    >
      {/* Component Type Badge */}
      <div className="absolute -top-2 -left-2 flex items-center gap-1 bg-white dark:bg-gray-800 px-2 py-1 rounded shadow-md border border-gray-200 dark:border-gray-700 text-xs">
        {icon}
        <span className="font-medium text-gray-700 dark:text-gray-300">{name}</span>
      </div>

      {/* Component Preview */}
      <div className="mt-4">
        {renderPreviewContent()}
      </div>

      {/* Selection Indicator */}
      {isSelected && (
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-white dark:border-gray-900"></div>
      )}
    </div>
  );
}
