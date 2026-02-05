'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Grid3x3,
  List,
  Copy,
  Eye,
  Star,
  TrendingUp,
  ArrowLeft,
  Sparkles,
  Building2,
  Wrench,
  Home,
  Car,
  Palette,
  Code as CodeIcon,
  Heart,
  Briefcase,
  Scissors,
  Camera,
  Monitor,
  Package,
  Zap,
  Trees,
  Hammer,
  GraduationCap,
  UtensilsCrossed,
  Shirt,
  Plane,
  Dog,
} from 'lucide-react';
import {
  listPrebuiltTemplates,
  clonePrebuiltTemplate,
} from '@/lib/api/template-builder';
import type { BuilderTemplate, PrebuiltTemplateListParams } from '@/lib/types/quote-admin';
import toast from 'react-hot-toast';
import TemplatePreviewModal from '@/components/templates/TemplatePreviewModal';

export default function PrebuiltTemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<BuilderTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndustry, setSelectedIndustry] = useState<string>('all');
  const [cloningId, setCloningId] = useState<string | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    loadTemplates();
  }, [selectedIndustry]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const params: PrebuiltTemplateListParams = {
        page: 1,
        limit: 100,
      };
      if (selectedIndustry !== 'all') {
        params.industry = selectedIndustry;
      }
      const data = await listPrebuiltTemplates(params);
      setTemplates(data.data);
    } catch (error) {
      console.error('Failed to load templates:', error);
      toast.error('Failed to load pre-built templates');
      setTemplates([]); // Show empty state instead of mock data
    } finally {
      setLoading(false);
    }
  };

  // UI metadata for template types (icons, colors)
  const templateMetadata: Record<string, any> = {
    professional: { icon: Briefcase, color: 'blue' },
    construction: { icon: Hammer, color: 'orange' },
    technology: { icon: Monitor, color: 'purple' },
    landscaping: { icon: Trees, color: 'green' },
    automotive: { icon: Car, color: 'red' },
    'home-improvement': { icon: Home, color: 'yellow' },
    creative: { icon: Palette, color: 'pink' },
    healthcare: { icon: Heart, color: 'red' },
    plumbing: { icon: Wrench, color: 'blue' },
    photography: { icon: Camera, color: 'gray' },
    electrical: { icon: Zap, color: 'yellow' },
    events: { icon: Star, color: 'purple' },
    logistics: { icon: Package, color: 'brown' },
    education: { icon: GraduationCap, color: 'blue' },
    food: { icon: UtensilsCrossed, color: 'orange' },
    fashion: { icon: Shirt, color: 'pink' },
    travel: { icon: Plane, color: 'sky' },
    pets: { icon: Dog, color: 'green' },
    cleaning: { icon: Sparkles, color: 'cyan' },
  };

  // Fallback metadata for unknown types
  const defaultMetadata = { icon: Building2, color: 'blue' };

  // Calculate industry counts from actual templates
  const industryCounts = templates.reduce((acc: Record<string, number>, template) => {
    const industry = (template as any).industry || 'other';
    acc[industry] = (acc[industry] || 0) + 1;
    return acc;
  }, {});

  const industries = [
    { id: 'all', label: 'All Industries', count: templates.length },
    { id: 'professional', label: 'Professional Services', count: industryCounts.professional || 0 },
    { id: 'construction', label: 'Construction', count: industryCounts.construction || 0 },
    { id: 'technology', label: 'Technology', count: industryCounts.technology || 0 },
    { id: 'creative', label: 'Creative', count: industryCounts.creative || 0 },
    { id: 'healthcare', label: 'Healthcare', count: industryCounts.healthcare || 0 },
    { id: 'home-improvement', label: 'Home Improvement', count: industryCounts['home-improvement'] || 0 },
    { id: 'automotive', label: 'Automotive', count: industryCounts.automotive || 0 },
  ];

  // Filter templates from actual API data
  const filteredTemplates = templates.filter((template) => {
    const matchesSearch =
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (template.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      ((template as any).tags || []).some((tag: string) =>
        tag.toLowerCase().includes(searchQuery.toLowerCase())
      );
    const matchesIndustry =
      selectedIndustry === 'all' || (template as any).industry === selectedIndustry;
    return matchesSearch && matchesIndustry;
  });

  // Clone template
  const handleClone = async (templateId: string, templateName: string) => {
    const newName = prompt(`Enter name for cloned template:`, `${templateName} (Copy)`);
    if (!newName) return;

    try {
      setCloningId(templateId);
      await clonePrebuiltTemplate(templateId, { new_name: newName });
      toast.success('Template cloned successfully!');
      router.push('/admin/quotes/templates');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to clone template');
    } finally {
      setCloningId(null);
    }
  };

  // Get color classes
  const getColorClasses = (color: string) => {
    const colorMap: Record<string, string> = {
      blue: 'from-blue-500 to-cyan-500',
      purple: 'from-purple-500 to-pink-500',
      green: 'from-green-500 to-emerald-500',
      red: 'from-red-500 to-orange-500',
      yellow: 'from-yellow-500 to-orange-500',
      pink: 'from-pink-500 to-rose-500',
      indigo: 'from-indigo-500 to-purple-500',
      gray: 'from-gray-500 to-slate-500',
      orange: 'from-orange-500 to-red-500',
      cyan: 'from-cyan-500 to-blue-500',
      sky: 'from-sky-500 to-blue-500',
    };
    return colorMap[color] || colorMap.blue;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => router.push('/admin/quotes/templates')}
              className="flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm font-medium">Back</span>
            </button>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
              <Sparkles className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold mb-2">Pre-built Template Gallery</h1>
              <p className="text-blue-100 text-lg">
                20 industry-specific templates ready to clone and customize
              </p>
            </div>
          </div>

          {/* Search */}
          <div className="mt-6">
            <div className="relative max-w-2xl">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/60" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by industry, tags, or template name..."
                className="w-full pl-12 pr-4 py-3.5 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex gap-6">
          {/* Sidebar - Industries */}
          <div className="w-64 flex-shrink-0">
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 sticky top-24">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                Industries
              </h3>
              <div className="space-y-1">
                {industries.map((industry) => (
                  <button
                    key={industry.id}
                    onClick={() => setSelectedIndustry(industry.id)}
                    className={`
                      w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-all
                      ${
                        selectedIndustry === industry.id
                          ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                      }
                    `}
                  >
                    <span>{industry.label}</span>
                    <span
                      className={`
                      text-xs px-2 py-0.5 rounded-full
                      ${
                        selectedIndustry === industry.id
                          ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                      }
                    `}
                    >
                      {industry.count}
                    </span>
                  </button>
                ))}
              </div>

              {/* Stats */}
              <div className="mt-6 p-4 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    20
                  </span>
                </div>
                <p className="text-xs font-medium text-gray-900 dark:text-gray-100">
                  Pre-built Templates
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  Clone and customize instantly
                </p>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            {/* View Mode Toggle */}
            <div className="flex items-center justify-between mb-6">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Showing <span className="font-semibold">{filteredTemplates.length}</span> templates
              </p>
              <div className="flex items-center gap-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded ${
                    viewMode === 'grid'
                      ? 'bg-gray-100 dark:bg-gray-800 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                  }`}
                >
                  <Grid3x3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded ${
                    viewMode === 'list'
                      ? 'bg-gray-100 dark:bg-gray-800 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                  }`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Templates Grid/List */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <Sparkles className="w-12 h-12 text-gray-400 animate-pulse mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">Loading templates...</p>
                </div>
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-12 text-center">
                <Search className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  No templates found
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  Try adjusting your search or filters
                </p>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredTemplates.map((template) => {
                  const industry = (template as any).industry || 'other';
                  const metadata = templateMetadata[industry] || defaultMetadata;
                  const Icon = metadata.icon;
                  const color = metadata.color;
                  const isCloning = cloningId === template.id;
                  return (
                    <div
                      key={template.id}
                      className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden hover:shadow-xl hover:border-blue-300 dark:hover:border-blue-700 transition-all duration-300 group"
                    >
                      {/* Icon Header */}
                      <div
                        className={`h-40 bg-gradient-to-br ${getColorClasses(
                          color
                        )} flex items-center justify-center relative overflow-hidden`}
                      >
                        <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors"></div>
                        <Icon className="w-20 h-20 text-white relative z-10 group-hover:scale-110 transition-transform" />
                        <div className="absolute top-3 right-3">
                          <span className="bg-white/20 backdrop-blur-sm text-white text-xs font-medium px-2 py-1 rounded-full border border-white/30">
                            Pre-built
                          </span>
                        </div>
                      </div>

                      {/* Content */}
                      <div className="p-5">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                          {template.name}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                          {template.description}
                        </p>

                        {/* Tags */}
                        {((template as any).tags || []).length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-4">
                            {((template as any).tags || []).map((tag: string) => (
                              <span
                                key={tag}
                                className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-1 rounded"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleClone(template.id, template.name)}
                            disabled={isCloning}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Copy className="w-4 h-4" />
                            <span>{isCloning ? 'Cloning...' : 'Clone Template'}</span>
                          </button>
                          <button
                            onClick={() => setPreviewTemplate({ id: template.id, name: template.name })}
                            className="p-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            title="Preview"
                          >
                            <Eye className="w-4 h-4" />
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
                {filteredTemplates.map((template) => {
                  const industry = (template as any).industry || 'other';
                  const metadata = templateMetadata[industry] || defaultMetadata;
                  const Icon = metadata.icon;
                  const color = metadata.color;
                  const isCloning = cloningId === template.id;
                  return (
                    <div
                      key={template.id}
                      className="p-5 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        {/* Icon */}
                        <div
                          className={`w-20 h-20 bg-gradient-to-br ${getColorClasses(
                            color
                          )} rounded-xl flex items-center justify-center flex-shrink-0`}
                        >
                          <Icon className="w-10 h-10 text-white" />
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                              {template.name}
                            </h3>
                            <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full font-medium">
                              Pre-built
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                            {template.description}
                          </p>
                          {((template as any).tags || []).length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {((template as any).tags || []).map((tag: string) => (
                                <span
                                  key={tag}
                                  className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleClone(template.id, template.name)}
                            disabled={isCloning}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Copy className="w-4 h-4" />
                            <span>{isCloning ? 'Cloning...' : 'Clone'}</span>
                          </button>
                          <button
                            onClick={() => setPreviewTemplate({ id: template.id, name: template.name })}
                            className="p-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            title="Preview"
                          >
                            <Eye className="w-4 h-4" />
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

      {/* Preview Modal */}
      {previewTemplate && (
        <TemplatePreviewModal
          isOpen={true}
          onClose={() => setPreviewTemplate(null)}
          templateId={previewTemplate.id}
          templateName={previewTemplate.name}
        />
      )}
    </div>
  );
}
