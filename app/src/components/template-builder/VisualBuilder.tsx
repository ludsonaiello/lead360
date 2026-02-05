'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { DndContext, DragEndEvent, DragStartEvent, DragOverlay } from '@dnd-kit/core';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import BuilderToolbar from './BuilderToolbar';
import ComponentLibrary from './ComponentLibrary';
import BuilderCanvas from './BuilderCanvas';
import ComponentPropertiesPanel from './ComponentPropertiesPanel';
import VariablesPanel from './VariablesPanel';
import ThemeCustomizer from './ThemeCustomizer';
import {
  createVisualTemplate,
  updateBuilderTemplate,
  addComponentToTemplate,
  updateComponentInTemplate,
  removeComponentFromTemplate,
  reorderComponents,
  applyThemeToTemplate,
  exportVisualTemplateToCode,
  previewBuilderTemplate,
  testBuilderTemplatePdf,
  testBuilderTemplateEmail,
  getTemplateVersions,
} from '@/lib/api/template-builder';
import type {
  BuilderTemplate,
  VisualTemplateStructure,
  TemplateComponent,
  CreateVisualTemplateDto,
  UpdateBuilderTemplateDto,
  AddComponentDto,
} from '@/lib/types/quote-admin';
import { Eye, FileText, Mail, Clock, Settings as SettingsIcon, Download } from 'lucide-react';

interface VisualBuilderProps {
  templateId?: string; // If editing existing template
  initialTemplate?: BuilderTemplate;
}

// Default structure for new templates
const DEFAULT_STRUCTURE: VisualTemplateStructure = {
  version: '1.0',
  layout: {
    page_size: 'A4',
    orientation: 'portrait',
    margins: { top: 20, bottom: 20, left: 20, right: 20 },
    header_height: 80,
    footer_height: 60,
    sections: [
      {
        id: 'body',
        type: 'body',
        components: [],
      },
    ],
  },
  theme: {
    colors: {
      primary: '#3b82f6',
      secondary: '#8b5cf6',
      text: '#1f2937',
      background: '#ffffff',
      border: '#e5e7eb',
    },
    fonts: {
      heading: 'Inter',
      body: 'Inter',
      monospace: 'Courier New',
    },
    spacing: {
      unit: 4,
      scale: 1,
    },
  },
};

export default function VisualBuilder({ templateId, initialTemplate }: VisualBuilderProps) {
  const router = useRouter();
  const [template, setTemplate] = useState<BuilderTemplate | null>(initialTemplate || null);
  const [structure, setStructure] = useState<VisualTemplateStructure>(
    initialTemplate?.visual_structure || DEFAULT_STRUCTURE
  );
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [viewMode, setViewMode] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [showThemeCustomizer, setShowThemeCustomizer] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showVersionHistoryModal, setShowVersionHistoryModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [leftPanelMode, setLeftPanelMode] = useState<'components' | 'variables'>('components');

  // History for undo/redo
  const [history, setHistory] = useState<VisualTemplateStructure[]>([structure]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Update history when structure changes
  const addToHistory = useCallback((newStructure: VisualTemplateStructure) => {
    setHistory((prev) => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(newStructure);
      return newHistory;
    });
    setHistoryIndex((prev) => prev + 1);
    setHasUnsavedChanges(true);
  }, [historyIndex]);

  // Undo/Redo
  const undo = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex((prev) => prev - 1);
      setStructure(history[historyIndex - 1]);
      setHasUnsavedChanges(true);
    }
  }, [historyIndex, history]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex((prev) => prev + 1);
      setStructure(history[historyIndex + 1]);
      setHasUnsavedChanges(true);
    }
  }, [historyIndex, history]);

  // Drag and drop handlers
  const handleDragStart = (event: DragStartEvent) => {
    // Could add visual feedback here
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || over.id !== 'canvas') return;

    const componentType = active.data.current?.componentType;
    if (!componentType) return;

    // Generate unique ID
    const componentId = `component-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create new component with default config
    const newComponent: TemplateComponent = {
      id: componentId,
      type: componentType,
      position: { x: 0, y: 0 },
      size: { width: '100%', height: 'auto' },
      style: {
        padding: { top: 10, right: 10, bottom: 10, left: 10 },
        margin: { top: 0, right: 0, bottom: 20, left: 0 },
        backgroundColor: 'transparent',
        border: { width: 0, color: '#e5e7eb', style: 'solid' },
        borderRadius: 0,
        boxShadow: 'none',
      },
      config: getDefaultConfig(componentType),
      content: {},
    };

    // Add to structure
    const newStructure = {
      ...structure,
      layout: {
        ...structure.layout,
        sections: structure.layout.sections.map((section) =>
          section.type === 'body'
            ? { ...section, components: [...section.components, newComponent] }
            : section
        ),
      },
    };

    setStructure(newStructure);
    addToHistory(newStructure);
    setSelectedComponentId(componentId);

    // If editing existing template, update on server
    if (templateId) {
      try {
        const dto: AddComponentDto = {
          section_id: 'body',
          component: newComponent,
        };
        await addComponentToTemplate(templateId, dto);
        toast.success('Component added');
      } catch (error) {
        toast.error('Failed to add component');
      }
    }
  };

  // Get default config for component type
  const getDefaultConfig = (type: string): any => {
    switch (type) {
      case 'header':
        return {
          title: '{{vendor.name}}',
          logo_url: '{{vendor.logo_url}}',
          subtitle: '{{vendor.tagline}}',
          text_align: 'left',
        };
      case 'customer_info':
      case 'company_info':
      case 'vendor_info':
        return {
          show_email: true,
          show_phone: true,
          show_address: true,
          layout: 'vertical',
          label: '',
        };
      case 'line_items':
      case 'table':
        return {
          title: 'Line Items',
          show_description: true,
          show_quantity: true,
          show_unit_price: true,
          show_line_total: true,
          striped: true,
          loop_config: {
            source_array: 'items',
            item_variable_name: 'item',
            show_index: false,
          },
        };
      case 'totals':
        return {
          title: 'Quote Summary',
          show_subtotal: true,
          show_tax: true,
          show_discount: true,
          highlight_total: true,
        };
      case 'text':
        return { text: 'Enter your text here...' };
      case 'image':
        return {
          image_url: '',
          alt_text: '',
          size: 'medium',
        };
      case 'spacer':
        return { height: 20 };
      case 'divider':
        return { thickness: 1, color: '#e5e7eb' };
      default:
        return {};
    }
  };

  // Component operations
  const updateComponent = useCallback(
    async (componentId: string, updates: Partial<TemplateComponent>) => {
      const newStructure = {
        ...structure,
        layout: {
          ...structure.layout,
          sections: structure.layout.sections.map((section) => ({
            ...section,
            components: section.components.map((comp) =>
              comp.id === componentId ? { ...comp, ...updates } : comp
            ),
          })),
        },
      };

      setStructure(newStructure);
      addToHistory(newStructure);

      // Update on server if editing
      if (templateId) {
        try {
          const component = getAllComponents(newStructure).find((c) => c.id === componentId);
          if (component) {
            await updateComponentInTemplate(templateId, componentId, { component });
          }
        } catch (error) {
          toast.error('Failed to update component');
        }
      }
    },
    [structure, templateId, addToHistory]
  );

  const deleteComponent = useCallback(async () => {
    if (!selectedComponentId) return;

    const newStructure = {
      ...structure,
      layout: {
        ...structure.layout,
        sections: structure.layout.sections.map((section) => ({
          ...section,
          components: section.components.filter((comp) => comp.id !== selectedComponentId),
        })),
      },
    };

    setStructure(newStructure);
    addToHistory(newStructure);
    setSelectedComponentId(null);

    // Delete on server if editing
    if (templateId) {
      try {
        await removeComponentFromTemplate(templateId, selectedComponentId);
        toast.success('Component removed');
      } catch (error) {
        toast.error('Failed to remove component');
      }
    }
  }, [selectedComponentId, structure, templateId, addToHistory]);

  const duplicateComponent = useCallback(() => {
    if (!selectedComponentId) return;

    const component = getAllComponents(structure).find((c) => c.id === selectedComponentId);
    if (!component) return;

    const newId = `component-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const duplicated = { ...component, id: newId };

    const newStructure = {
      ...structure,
      layout: {
        ...structure.layout,
        sections: structure.layout.sections.map((section) => {
          const index = section.components.findIndex((c) => c.id === selectedComponentId);
          if (index >= 0) {
            const newComponents = [...section.components];
            newComponents.splice(index + 1, 0, duplicated);
            return { ...section, components: newComponents };
          }
          return section;
        }),
      },
    };

    setStructure(newStructure);
    addToHistory(newStructure);
    setSelectedComponentId(newId);
    toast.success('Component duplicated');
  }, [selectedComponentId, structure, addToHistory]);

  const moveComponent = useCallback(
    (direction: 'up' | 'down') => {
      if (!selectedComponentId) return;

      const newStructure = {
        ...structure,
        layout: {
          ...structure.layout,
          sections: structure.layout.sections.map((section) => {
            const index = section.components.findIndex((c) => c.id === selectedComponentId);
            if (index < 0) return section;

            const newComponents = [...section.components];
            const targetIndex = direction === 'up' ? index - 1 : index + 1;

            if (targetIndex < 0 || targetIndex >= newComponents.length) return section;

            [newComponents[index], newComponents[targetIndex]] = [
              newComponents[targetIndex],
              newComponents[index],
            ];

            return { ...section, components: newComponents };
          }),
        },
      };

      setStructure(newStructure);
      addToHistory(newStructure);
    },
    [selectedComponentId, structure, addToHistory]
  );

  // Get all components
  const getAllComponents = (struct: VisualTemplateStructure): TemplateComponent[] => {
    const all: TemplateComponent[] = [];
    struct.layout.sections.forEach((section) => {
      all.push(...section.components);
    });
    return all;
  };

  const selectedComponent = selectedComponentId
    ? getAllComponents(structure).find((c) => c.id === selectedComponentId) || null
    : null;

  const components = getAllComponents(structure);
  const selectedIndex = selectedComponent
    ? components.findIndex((c) => c.id === selectedComponentId)
    : -1;

  // Save template
  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (templateId) {
        // Update existing
        const dto: UpdateBuilderTemplateDto = {
          visual_structure: structure,
        };
        const updated = await updateBuilderTemplate(templateId, dto);
        setTemplate(updated);
        setHasUnsavedChanges(false);
        toast.success('Template saved successfully');
      } else {
        // Create new
        const dto: CreateVisualTemplateDto = {
          name: 'New Visual Template',
          layout_preset: 'blank',
          theme: structure.theme,
        };
        const created = await createVisualTemplate(dto);
        setTemplate(created);
        setHasUnsavedChanges(false);
        router.push(`/admin/quotes/templates/builder/${created.id}`);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to save template');
    } finally {
      setIsSaving(false);
    }
  };

  // Apply theme
  const handleApplyTheme = async (theme: any) => {
    const newStructure = {
      ...structure,
      theme,
    };
    setStructure(newStructure);
    addToHistory(newStructure);

    if (templateId) {
      try {
        await applyThemeToTemplate(templateId, { theme });
        toast.success('Theme applied');
      } catch (error) {
        toast.error('Failed to apply theme');
      }
    }
  };

  // Export to code
  const handleExport = async () => {
    if (!templateId) {
      toast.error('Save the template first');
      return;
    }

    try {
      const result = await exportVisualTemplateToCode(templateId);
      toast.success('Template exported to code');
      // Could download or show the code
    } catch (error) {
      toast.error('Failed to export template');
    }
  };

  // Preview
  const handlePreview = async () => {
    if (!templateId) {
      toast.error('Save the template first');
      return;
    }

    try {
      const result = await previewBuilderTemplate(templateId, {
        sample_data: {
          customer_name: 'John Doe',
          company_name: 'Acme Corp',
        },
      });
      // Show preview in modal
      setShowPreviewModal(true);
      toast.success('Preview generated');
    } catch (error) {
      toast.error('Failed to generate preview');
    }
  };

  // Test PDF
  const handleTestPdf = async () => {
    if (!templateId) {
      toast.error('Save the template first');
      return;
    }

    try {
      const result = await testBuilderTemplatePdf(templateId, {
        sample_data: {},
      });
      window.open(result.pdf_url, '_blank');
      toast.success('PDF generated');
    } catch (error) {
      toast.error('Failed to generate PDF');
    }
  };

  // Test Email
  const handleTestEmail = async () => {
    if (!templateId) {
      toast.error('Save the template first');
      return;
    }

    const email = prompt('Enter email address for test:');
    if (!email) return;

    try {
      await testBuilderTemplateEmail(templateId, {
        recipient_email: email,
        sample_data: {},
      });
      toast.success(`Test email sent to ${email}`);
    } catch (error) {
      toast.error('Failed to send test email');
    }
  };

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="h-screen flex flex-col">
        {/* Toolbar */}
        <BuilderToolbar
          templateName={template?.name || 'New Visual Template'}
          isSaving={isSaving}
          hasUnsavedChanges={hasUnsavedChanges}
          canUndo={historyIndex > 0}
          canRedo={historyIndex < history.length - 1}
          onSave={handleSave}
          onPreview={handlePreview}
          onTestPdf={handleTestPdf}
          onTestEmail={handleTestEmail}
          onTheme={() => setShowThemeCustomizer(true)}
          onExport={handleExport}
          onVersionHistory={() => setShowVersionHistoryModal(true)}
          onSettings={() => setShowSettingsModal(true)}
          onUndo={undo}
          onRedo={redo}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel - Toggle between Components and Variables */}
          <div className="relative">
            {/* Panel Toggle */}
            <div className="absolute top-0 left-0 right-0 z-10 flex border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
              <button
                onClick={() => setLeftPanelMode('components')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  leftPanelMode === 'components'
                    ? 'bg-white dark:bg-gray-800 text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                Components
              </button>
              <button
                onClick={() => setLeftPanelMode('variables')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  leftPanelMode === 'variables'
                    ? 'bg-white dark:bg-gray-800 text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                Variables
              </button>
            </div>

            {/* Panel Content */}
            <div className="pt-12">
              {leftPanelMode === 'components' ? (
                <ComponentLibrary />
              ) : (
                <VariablesPanel
                  onInsertVariable={(variablePath) => {
                    // If a component is selected, try to insert the variable into it
                    if (selectedComponent && selectedComponent.config) {
                      // For text components, append to text
                      if (selectedComponent.type === 'text') {
                        const currentText = selectedComponent.config.text || '';
                        updateComponent(selectedComponentId!, {
                          config: {
                            ...selectedComponent.config,
                            text: currentText + `{{${variablePath}}}`,
                          },
                        });
                      }
                    }
                  }}
                />
              )}
            </div>
          </div>

          {/* Canvas */}
          <BuilderCanvas
            structure={structure}
            selectedComponentId={selectedComponentId}
            onComponentClick={setSelectedComponentId}
            viewMode={viewMode}
          />

          {/* Properties Panel */}
          <ComponentPropertiesPanel
            component={selectedComponent}
            onUpdate={(updates) => {
              if (selectedComponentId) {
                updateComponent(selectedComponentId, updates);
              }
            }}
            onDelete={deleteComponent}
            onDuplicate={duplicateComponent}
            onMoveUp={() => moveComponent('up')}
            onMoveDown={() => moveComponent('down')}
            canMoveUp={selectedIndex > 0}
            canMoveDown={selectedIndex >= 0 && selectedIndex < components.length - 1}
          />
        </div>
      </div>

      {/* Theme Customizer Modal */}
      <ThemeCustomizer
        isOpen={showThemeCustomizer}
        onClose={() => setShowThemeCustomizer(false)}
        theme={structure.theme}
        onApply={handleApplyTheme}
      />
    </DndContext>
  );
}
