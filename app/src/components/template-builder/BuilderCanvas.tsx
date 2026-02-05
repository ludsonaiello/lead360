'use client';

import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Plus, Layout, FileX } from 'lucide-react';
import ComponentRenderer from './ComponentRenderer';
import type { TemplateComponent, VisualTemplateStructure } from '@/lib/types/quote-admin';

interface BuilderCanvasProps {
  structure: VisualTemplateStructure;
  selectedComponentId: string | null;
  onComponentClick: (componentId: string) => void;
  viewMode: 'desktop' | 'tablet' | 'mobile';
}

export default function BuilderCanvas({
  structure,
  selectedComponentId,
  onComponentClick,
  viewMode,
}: BuilderCanvasProps) {
  // Droppable area for the canvas
  const { setNodeRef, isOver } = useDroppable({
    id: 'canvas',
  });

  // Get canvas width based on view mode
  const getCanvasWidth = () => {
    switch (viewMode) {
      case 'mobile':
        return 375; // Mobile width
      case 'tablet':
        return 768; // Tablet width
      case 'desktop':
      default:
        return 1024; // Desktop width
    }
  };

  const canvasWidth = getCanvasWidth();

  // Get all components from sections
  const getAllComponents = (): TemplateComponent[] => {
    const allComponents: TemplateComponent[] = [];
    structure.layout.sections.forEach((section) => {
      allComponents.push(...section.components);
    });
    return allComponents;
  };

  const components = getAllComponents();
  const theme = structure.theme;

  // Page settings
  const layout = structure.layout;
  const pageSize = layout.page_size || 'A4';
  const orientation = layout.orientation || 'portrait';
  const margins = layout.margins || { top: 20, bottom: 20, left: 20, right: 20 };

  return (
    <div className="flex-1 bg-gray-100 dark:bg-gray-950 overflow-auto p-8">
      <div className="max-w-full mx-auto">
        {/* Page Info */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Layout className="w-5 h-5 text-gray-400" />
            <div className="text-sm">
              <span className="text-gray-600 dark:text-gray-400">Page Size:</span>
              <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">
                {pageSize} ({orientation})
              </span>
            </div>
            <div className="h-4 w-px bg-gray-300 dark:bg-gray-700"></div>
            <div className="text-sm">
              <span className="text-gray-600 dark:text-gray-400">View:</span>
              <span className="ml-2 font-medium text-gray-900 dark:text-gray-100 capitalize">
                {viewMode}
              </span>
            </div>
          </div>
        </div>

        {/* Canvas Paper */}
        <div
          ref={setNodeRef}
          className={`
            bg-white dark:bg-gray-900 shadow-2xl mx-auto transition-all duration-300
            ${isOver ? 'ring-4 ring-blue-400 ring-opacity-50' : ''}
          `}
          style={{
            width: `${canvasWidth}px`,
            minHeight: '842px', // A4 height in pixels at 72 DPI
            paddingTop: `${margins.top}px`,
            paddingRight: `${margins.right}px`,
            paddingBottom: `${margins.bottom}px`,
            paddingLeft: `${margins.left}px`,
          }}
        >
          {components.length === 0 ? (
            /* Empty State */
            <div className="flex flex-col items-center justify-center h-[700px] text-center px-8">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl flex items-center justify-center mb-6">
                <FileX className="w-10 h-10 text-blue-400 dark:text-blue-500" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Start Building Your Template
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md">
                Drag components from the library on the left to add them to your template.
                Customize each component using the properties panel on the right.
              </p>
              <div className="flex items-center gap-2 text-sm text-gray-400 dark:text-gray-500">
                <Plus className="w-4 h-4" />
                <span>Drag & Drop to Begin</span>
              </div>
            </div>
          ) : (
            /* Components */
            <div className="space-y-0">
              {components.map((component, index) => (
                <ComponentRenderer
                  key={component.id}
                  component={component}
                  isSelected={selectedComponentId === component.id}
                  onClick={() => onComponentClick(component.id)}
                  theme={theme}
                />
              ))}
            </div>
          )}

          {/* Drop Zone Indicator */}
          {isOver && (
            <div className="fixed inset-0 pointer-events-none flex items-center justify-center z-50">
              <div className="bg-blue-500 text-white px-6 py-3 rounded-lg shadow-xl flex items-center gap-2">
                <Plus className="w-5 h-5" />
                <span className="font-medium">Drop component here</span>
              </div>
            </div>
          )}
        </div>

        {/* Canvas Info */}
        <div className="mt-4 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {components.length} {components.length === 1 ? 'component' : 'components'} on canvas
          </p>
        </div>
      </div>
    </div>
  );
}
