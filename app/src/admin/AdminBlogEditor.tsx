import { useEffect, useState, useCallback, useRef } from 'react';
import {
  ArrowLeft, Save, Eye, Upload, X, Globe, Link2, Tag, FileText,
  Image as ImageIcon, Search, AlertCircle, CheckCircle2,
  Loader2, Info, ExternalLink, Sparkles, MessageSquare, Star,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import { blogApi, type BlogPostResponse } from '@/api/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

// ── Types ───────────────────────────────────────────────────────────────────

interface BlogForm {
  title: string;
  content: string;
  excerpt: string;
  featuredImage: string;
  ogImage: string;
  canonicalUrl: string;
  focusKeyword: string;
  seoRobots: string;
  metaTitle: string;
  metaDescription: string;
  tags: string;
  category: string;
  customLinkLabel: string;
  customLinkUrl: string;
  adminNotes: string;
  allowComments: boolean;
  isFeatured: boolean;
  status: string;
}

interface ValidationErrors {
  [key: string]: string;
}

const emptyForm: BlogForm = {
  title: '', content: '', excerpt: '', featuredImage: '',
  ogImage: '', canonicalUrl: '', focusKeyword: '', seoRobots: 'index, follow',
  metaTitle: '', metaDescription: '', tags: '', category: '',
  customLinkLabel: '', customLinkUrl: '', adminNotes: '',
  allowComments: true, isFeatured: false, status: 'DRAFT',
};

const BLOG_CATEGORIES = [
  'Reading Lists', 'Book Reviews', 'Author Spotlights',
  'Literary News', 'Recommendations', 'How-To Guides',
  'Interviews', 'Industry Insights', 'Seasonal Picks', 'General',
];

// ── Helpers ─────────────────────────────────────────────────────────────────

function charCount(val: string, max: number) {
  const len = val.length;
  const color = len === 0 ? 'text-muted-foreground' : len > max ? 'text-destructive font-medium' : len > max * 0.9 ? 'text-yellow-600' : 'text-green-600';
  return <span className={`text-xs ${color}`}>{len}/{max}</span>;
}

function FieldHint({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help inline ml-1" />
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs">
          {children}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function computeSeoScore(form: BlogForm): number {
  let score = 0;
  if (form.metaTitle && form.metaTitle.length >= 20 && form.metaTitle.length <= 60) score += 2;
  else if (form.metaTitle) score += 1;
  if (form.metaDescription && form.metaDescription.length >= 70 && form.metaDescription.length <= 160) score += 2;
  else if (form.metaDescription) score += 1;
  if (form.focusKeyword) score += 1;
  if (form.focusKeyword && form.metaTitle?.toLowerCase().includes(form.focusKeyword.toLowerCase())) score += 1;
  if (form.focusKeyword && form.metaDescription?.toLowerCase().includes(form.focusKeyword.toLowerCase())) score += 1;
  if (form.featuredImage || form.ogImage) score += 1;
  if (form.canonicalUrl) score += 1;
  if (form.excerpt && form.excerpt.length >= 50) score += 1;
  return Math.min(10, score);
}

// ── Main Component ──────────────────────────────────────────────────────────

interface AdminBlogEditorProps {
  postSlug?: string; // If provided, we're editing; otherwise creating
}

export function AdminBlogEditor({ postSlug }: AdminBlogEditorProps) {
  const navigate = useNavigate();
  const [form, setForm] = useState<BlogForm>(emptyForm);
  const [originalForm, setOriginalForm] = useState<BlogForm>(emptyForm);
  const [loading, setLoading] = useState(!!postSlug);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [postId, setPostId] = useState<string | null>(null);
  const [postData, setPostData] = useState<BlogPostResponse | null>(null);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState('general');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isEditing = !!postSlug;

  // ── Load existing post ────────────────────────────────────────────────
  useEffect(() => {
    if (!postSlug) return;
    setLoading(true);
    blogApi.getBySlug(postSlug)
      .then((post) => {
        setPostId(post.id);
        setPostData(post);
        const loaded: BlogForm = {
          title: post.title || '',
          content: post.content || '',
          excerpt: post.excerpt || '',
          featuredImage: post.featuredImage || '',
          ogImage: post.ogImage || '',
          canonicalUrl: post.canonicalUrl || '',
          focusKeyword: post.focusKeyword || '',
          seoRobots: post.seoRobots || 'index, follow',
          metaTitle: post.metaTitle || '',
          metaDescription: post.metaDescription || '',
          tags: post.tags || '',
          category: post.category || '',
          customLinkLabel: post.customLinkLabel || '',
          customLinkUrl: post.customLinkUrl || '',
          adminNotes: post.adminNotes || '',
          allowComments: post.allowComments !== false,
          isFeatured: !!post.isFeatured,
          status: post.status || 'DRAFT',
        };
        setForm(loaded);
        setOriginalForm(loaded);
      })
      .catch(() => {
        toast.error('Failed to load blog post');
        navigate('/admin/blog');
      })
      .finally(() => setLoading(false));
  }, [postSlug, navigate]);

  const hasChanges = JSON.stringify(form) !== JSON.stringify(originalForm);

  // ── Validation ────────────────────────────────────────────────────────
  const validate = useCallback((): boolean => {
    const e: ValidationErrors = {};
    if (!form.title.trim()) e.title = 'Title is required';
    else if (form.title.length > 300) e.title = 'Max 300 characters';
    if (!form.content.trim()) e.content = 'Content is required';
    if (form.metaTitle && form.metaTitle.length > 70) e.metaTitle = 'Max 70 characters';
    if (form.metaDescription && form.metaDescription.length > 170) e.metaDescription = 'Max 170 characters';
    if (form.focusKeyword && form.focusKeyword.length > 100) e.focusKeyword = 'Max 100 characters';
    if (form.canonicalUrl && !/^https?:\/\//.test(form.canonicalUrl)) e.canonicalUrl = 'Must be a valid URL';
    if (form.customLinkUrl && !/^https?:\/\//.test(form.customLinkUrl)) e.customLinkUrl = 'Must be a valid URL';
    if (form.featuredImage && !/^(https?:\/\/|\/uploads\/)/.test(form.featuredImage)) e.featuredImage = 'Must be a valid URL or uploaded image';
    if (form.ogImage && !/^(https?:\/\/|\/uploads\/)/.test(form.ogImage)) e.ogImage = 'Must be a valid URL or uploaded image';
    setErrors(e);
    return Object.keys(e).length === 0;
  }, [form]);

  // ── Save ──────────────────────────────────────────────────────────────
  const save = useCallback(async (statusOverride?: string) => {
    if (!validate()) {
      toast.error('Please fix validation errors');
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        title: form.title.trim(),
        content: form.content,
        excerpt: form.excerpt || undefined,
        featuredImage: form.featuredImage || undefined,
        ogImage: form.ogImage || undefined,
        canonicalUrl: form.canonicalUrl || undefined,
        focusKeyword: form.focusKeyword || undefined,
        seoRobots: form.seoRobots,
        metaTitle: form.metaTitle || undefined,
        metaDescription: form.metaDescription || undefined,
        tags: form.tags || undefined,
        category: form.category || undefined,
        customLinkLabel: form.customLinkLabel || undefined,
        customLinkUrl: form.customLinkUrl || undefined,
        adminNotes: form.adminNotes || undefined,
        allowComments: form.allowComments,
        isFeatured: form.isFeatured,
        status: statusOverride || form.status,
      };

      let result: BlogPostResponse;
      if (isEditing && postId) {
        result = await blogApi.update(postId, payload);
        toast.success('Blog post updated');
      } else {
        result = await blogApi.create(payload);
        toast.success('Blog post created');
      }

      setOriginalForm({ ...form, status: statusOverride || form.status });
      if (!isEditing && result.slug) {
        navigate(`/admin/blog/edit/${result.slug}`, { replace: true });
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }, [form, validate, isEditing, postId, navigate]);

  // ── Image upload ──────────────────────────────────────────────────────
  const handleImageUpload = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image must be under 10 MB');
      return;
    }
    setUploading(true);
    try {
      const { url } = await blogApi.uploadImage(file);
      setForm(prev => ({ ...prev, featuredImage: url }));
      toast.success('Image uploaded');
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleImageUpload(file);
  }, [handleImageUpload]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImageUpload(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [handleImageUpload]);

  // ── Auto-generate SEO ─────────────────────────────────────────────────
  const autoGenerateSEO = useCallback(() => {
    const updates: Partial<BlogForm> = {};
    if (!form.metaTitle && form.title) {
      updates.metaTitle = `${form.title} | BookDiscovery Blog`.slice(0, 60);
    }
    if (!form.metaDescription && form.content) {
      const cleanContent = form.content.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
      updates.metaDescription = cleanContent.slice(0, 155) + (cleanContent.length > 155 ? '...' : '');
    }
    if (!form.excerpt && form.content) {
      const cleanContent = form.content.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
      updates.excerpt = cleanContent.slice(0, 250) + (cleanContent.length > 250 ? '...' : '');
    }
    if (Object.keys(updates).length > 0) {
      setForm(prev => ({ ...prev, ...updates }));
      toast.success('SEO fields auto-generated');
    } else {
      toast.info('All SEO fields already filled');
    }
  }, [form]);

  const set = useCallback((key: keyof BlogForm, value: any) => {
    setForm(prev => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors(prev => { const n = { ...prev }; delete n[key]; return n; });
  }, [errors]);

  const seoScore = computeSeoScore(form);

  // ── UI ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="text-muted-foreground">Loading post…</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* ── Fixed Header ─────────────────────────────────────────────── */}
      <div className="flex-none border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-6 py-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/admin/blog')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">
                {isEditing ? 'Edit Blog Post' : 'New Blog Post'}
              </h1>
              {postData && (
                <p className="text-xs text-muted-foreground">{postData.slug}</p>
              )}
            </div>
            {hasChanges && (
              <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                Unsaved changes
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isEditing && postData?.status === 'PUBLISHED' && (
              <Button variant="outline" size="sm" asChild>
                <a href={`/blog/${postData.slug}`} target="_blank" rel="noopener noreferrer">
                  <Eye className="h-4 w-4 mr-1" /> Preview
                </a>
              </Button>
            )}
            <Badge className={seoScore >= 7 ? 'bg-green-500' : seoScore >= 4 ? 'bg-yellow-500' : 'bg-red-500'}>
              SEO: {seoScore}/10
            </Badge>
          </div>
        </div>
      </div>

      {/* ── Scrollable Content ────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5 mb-6">
            <TabsTrigger value="general" className="gap-1.5 text-xs sm:text-sm">
              <FileText className="h-3.5 w-3.5 shrink-0" /> <span className="hidden sm:inline">General</span>
            </TabsTrigger>
            <TabsTrigger value="media" className="gap-1.5 text-xs sm:text-sm">
              <ImageIcon className="h-3.5 w-3.5 shrink-0" /> <span className="hidden sm:inline">Media</span>
            </TabsTrigger>
            <TabsTrigger value="links" className="gap-1.5 text-xs sm:text-sm">
              <Link2 className="h-3.5 w-3.5 shrink-0" /> <span className="hidden sm:inline">Links</span>
            </TabsTrigger>
            <TabsTrigger value="seo" className="gap-1.5 text-xs sm:text-sm">
              <Search className="h-3.5 w-3.5 shrink-0" /> <span className="hidden sm:inline">SEO</span>
            </TabsTrigger>
            <TabsTrigger value="advanced" className="gap-1.5 text-xs sm:text-sm">
              <Tag className="h-3.5 w-3.5 shrink-0" /> <span className="hidden sm:inline">Advanced</span>
            </TabsTrigger>
          </TabsList>

          {/* ━━ GENERAL TAB ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <TabsContent value="general" className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Post Content</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {/* Title */}
                <div className="space-y-2">
                  <Label htmlFor="title">
                    Title <span className="text-destructive">*</span>
                    <FieldHint>The main headline of your blog post. Keep it compelling and under 100 characters for best results.</FieldHint>
                  </Label>
                  <Input
                    id="title"
                    value={form.title}
                    onChange={(e) => set('title', e.target.value)}
                    placeholder="Enter a compelling title..."
                    className={errors.title ? 'border-destructive' : ''}
                  />
                  <div className="flex justify-between">
                    {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
                    {charCount(form.title, 100)}
                  </div>
                </div>

                {/* Excerpt */}
                <div className="space-y-2">
                  <Label htmlFor="excerpt">
                    Excerpt
                    <FieldHint>A short summary shown in blog listings and social shares. Ideally 100-250 characters.</FieldHint>
                  </Label>
                  <Textarea
                    id="excerpt"
                    rows={3}
                    value={form.excerpt}
                    onChange={(e) => set('excerpt', e.target.value)}
                    placeholder="Brief summary of the post..."
                  />
                  <div className="flex justify-end">{charCount(form.excerpt, 250)}</div>
                </div>

                {/* Content */}
                <div className="space-y-2">
                  <Label htmlFor="content">
                    Content <span className="text-destructive">*</span>
                    <FieldHint>The full blog post content. Supports HTML for rich formatting.</FieldHint>
                  </Label>
                  <Textarea
                    id="content"
                    rows={20}
                    value={form.content}
                    onChange={(e) => set('content', e.target.value)}
                    placeholder="Write your blog post content here... HTML is supported."
                    className={`font-mono text-sm ${errors.content ? 'border-destructive' : ''}`}
                  />
                  <div className="flex justify-between">
                    {errors.content && <p className="text-xs text-destructive">{errors.content}</p>}
                    <p className="text-xs text-muted-foreground">
                      ~{Math.ceil(form.content.replace(/<[^>]*>/g, '').split(/\s+/).filter(Boolean).length / 200)} min read
                      ({form.content.replace(/<[^>]*>/g, '').split(/\s+/).filter(Boolean).length} words)
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Post Settings</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Status */}
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={form.status} onValueChange={(v) => set('status', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DRAFT">Draft</SelectItem>
                        <SelectItem value="PUBLISHED">Published</SelectItem>
                        <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Category */}
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select value={form.category || 'none'} onValueChange={(v) => set('category', v === 'none' ? '' : v)}>
                      <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Category</SelectItem>
                        {BLOG_CATEGORIES.map(cat => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Tags */}
                <div className="space-y-2">
                  <Label htmlFor="tags">
                    Tags
                    <FieldHint>Comma-separated tags for categorisation and filtering (e.g. "fiction, bestseller, 2026")</FieldHint>
                  </Label>
                  <Input
                    id="tags"
                    value={form.tags}
                    onChange={(e) => set('tags', e.target.value)}
                    placeholder="fiction, bestseller, recommendations..."
                  />
                  {form.tags && (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {form.tags.split(',').filter(t => t.trim()).map((tag, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">{tag.trim()}</Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* Toggles row */}
                <div className="flex flex-wrap gap-6 pt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.allowComments}
                      onChange={(e) => set('allowComments', e.target.checked)}
                      className="rounded border-muted-foreground/40"
                    />
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Allow Comments</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.isFeatured}
                      onChange={(e) => set('isFeatured', e.target.checked)}
                      className="rounded border-muted-foreground/40"
                    />
                    <Star className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Featured Post</span>
                  </label>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ━━ MEDIA TAB ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <TabsContent value="media" className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Featured Image</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {/* URL input */}
                <div className="space-y-2">
                  <Label htmlFor="featuredImage">
                    Image URL
                    <FieldHint>Direct URL to the featured image, or upload below.</FieldHint>
                  </Label>
                  <Input
                    id="featuredImage"
                    value={form.featuredImage}
                    onChange={(e) => set('featuredImage', e.target.value)}
                    placeholder="https://..."
                    className={errors.featuredImage ? 'border-destructive' : ''}
                  />
                  {errors.featuredImage && <p className="text-xs text-destructive">{errors.featuredImage}</p>}
                </div>

                {/* Upload area */}
                <div
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    uploading ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
                  }`}
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileInput}
                  />
                  {uploading ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <p className="text-sm text-muted-foreground">Uploading & converting to WebP…</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="h-8 w-8 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        Drag & drop an image here, or{' '}
                        <button
                          type="button"
                          className="text-primary underline"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          browse
                        </button>
                      </p>
                      <p className="text-xs text-muted-foreground">Max 10 MB · Auto-converted to WebP · Max 1200×800</p>
                    </div>
                  )}
                </div>

                {/* Preview */}
                {form.featuredImage && (
                  <div className="relative group max-w-md">
                    <img
                      src={form.featuredImage.startsWith('/') ? `${window.location.origin}${form.featuredImage}` : form.featuredImage}
                      alt="Featured"
                      className="rounded-lg border w-full aspect-video object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7"
                      onClick={() => set('featuredImage', '')}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>OG Image (Social Share)</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="ogImage">
                    OG Image URL
                    <FieldHint>Image shown when the post is shared on social media. Falls back to featured image if empty.</FieldHint>
                  </Label>
                  <Input
                    id="ogImage"
                    value={form.ogImage}
                    onChange={(e) => set('ogImage', e.target.value)}
                    placeholder="https://... (leave empty to use featured image)"
                    className={errors.ogImage ? 'border-destructive' : ''}
                  />
                  {errors.ogImage && <p className="text-xs text-destructive">{errors.ogImage}</p>}
                </div>
                {form.ogImage && (
                  <div className="max-w-sm">
                    <img
                      src={form.ogImage.startsWith('/') ? `${window.location.origin}${form.ogImage}` : form.ogImage}
                      alt="OG Preview"
                      className="rounded-lg border w-full aspect-video object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ━━ LINKS TAB ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <TabsContent value="links" className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Custom Link</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Add a custom call-to-action link that will appear on the blog post page (e.g. affiliate link, resource, etc.)
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="customLinkLabel">Link Label</Label>
                    <Input
                      id="customLinkLabel"
                      value={form.customLinkLabel}
                      onChange={(e) => set('customLinkLabel', e.target.value)}
                      placeholder="e.g. View Resource, Get the Guide"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="customLinkUrl">Link URL</Label>
                    <Input
                      id="customLinkUrl"
                      value={form.customLinkUrl}
                      onChange={(e) => set('customLinkUrl', e.target.value)}
                      placeholder="https://..."
                      className={errors.customLinkUrl ? 'border-destructive' : ''}
                    />
                    {errors.customLinkUrl && <p className="text-xs text-destructive">{errors.customLinkUrl}</p>}
                  </div>
                </div>
                {form.customLinkLabel && form.customLinkUrl && (
                  <div className="pt-2">
                    <p className="text-xs text-muted-foreground mb-1">Preview:</p>
                    <Button variant="outline" size="sm" asChild>
                      <a href={form.customLinkUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3.5 w-3.5 mr-1" />
                        {form.customLinkLabel}
                      </a>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Canonical URL</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="canonicalUrl">
                    Canonical URL
                    <FieldHint>Set if this content originally appeared elsewhere. Helps avoid duplicate content penalties.</FieldHint>
                  </Label>
                  <Input
                    id="canonicalUrl"
                    value={form.canonicalUrl}
                    onChange={(e) => set('canonicalUrl', e.target.value)}
                    placeholder="https://... (leave empty for auto-generated)"
                    className={errors.canonicalUrl ? 'border-destructive' : ''}
                  />
                  {errors.canonicalUrl && <p className="text-xs text-destructive">{errors.canonicalUrl}</p>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ━━ SEO TAB ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <TabsContent value="seo" className="space-y-6">
            {/* SEO Score */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>SEO Score</span>
                  <Badge className={seoScore >= 7 ? 'bg-green-500' : seoScore >= 4 ? 'bg-yellow-500' : 'bg-red-500'}>
                    {seoScore >= 7 ? <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> : <AlertCircle className="h-3.5 w-3.5 mr-1" />}
                    {seoScore}/10
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="w-full bg-muted rounded-full h-2.5 mb-3">
                  <div
                    className={`h-2.5 rounded-full transition-all ${seoScore >= 7 ? 'bg-green-500' : seoScore >= 4 ? 'bg-yellow-500' : 'bg-red-500'}`}
                    style={{ width: `${seoScore * 10}%` }}
                  />
                </div>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li className={form.metaTitle && form.metaTitle.length >= 20 && form.metaTitle.length <= 60 ? 'text-green-600' : ''}>
                    {form.metaTitle && form.metaTitle.length >= 20 && form.metaTitle.length <= 60 ? '✓' : '○'} Meta title 20-60 characters
                  </li>
                  <li className={form.metaDescription && form.metaDescription.length >= 70 && form.metaDescription.length <= 160 ? 'text-green-600' : ''}>
                    {form.metaDescription && form.metaDescription.length >= 70 && form.metaDescription.length <= 160 ? '✓' : '○'} Meta description 70-160 characters
                  </li>
                  <li className={form.focusKeyword ? 'text-green-600' : ''}>
                    {form.focusKeyword ? '✓' : '○'} Focus keyword defined
                  </li>
                  <li className={form.focusKeyword && form.metaTitle?.toLowerCase().includes(form.focusKeyword.toLowerCase()) ? 'text-green-600' : ''}>
                    {form.focusKeyword && form.metaTitle?.toLowerCase().includes(form.focusKeyword.toLowerCase()) ? '✓' : '○'} Keyword in meta title
                  </li>
                  <li className={form.focusKeyword && form.metaDescription?.toLowerCase().includes(form.focusKeyword.toLowerCase()) ? 'text-green-600' : ''}>
                    {form.focusKeyword && form.metaDescription?.toLowerCase().includes(form.focusKeyword.toLowerCase()) ? '✓' : '○'} Keyword in meta description
                  </li>
                  <li className={form.featuredImage || form.ogImage ? 'text-green-600' : ''}>
                    {form.featuredImage || form.ogImage ? '✓' : '○'} Featured or OG image set
                  </li>
                  <li className={form.excerpt && form.excerpt.length >= 50 ? 'text-green-600' : ''}>
                    {form.excerpt && form.excerpt.length >= 50 ? '✓' : '○'} Excerpt ≥ 50 characters
                  </li>
                </ul>
                <Button variant="outline" size="sm" className="mt-4" onClick={autoGenerateSEO}>
                  <Sparkles className="h-3.5 w-3.5 mr-1" /> Auto-Generate SEO
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Meta Tags</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {/* Meta Title */}
                <div className="space-y-2">
                  <Label htmlFor="metaTitle">
                    Meta Title
                    <FieldHint>The &lt;title&gt; tag shown in search results. Ideal: 20-60 characters.</FieldHint>
                  </Label>
                  <Input
                    id="metaTitle"
                    value={form.metaTitle}
                    onChange={(e) => set('metaTitle', e.target.value)}
                    placeholder={form.title ? `${form.title} | BookDiscovery Blog` : 'Your Post Title | BookDiscovery Blog'}
                    className={errors.metaTitle ? 'border-destructive' : ''}
                  />
                  <div className="flex justify-between">
                    {errors.metaTitle && <p className="text-xs text-destructive">{errors.metaTitle}</p>}
                    {charCount(form.metaTitle, 60)}
                  </div>
                </div>

                {/* Meta Description */}
                <div className="space-y-2">
                  <Label htmlFor="metaDescription">
                    Meta Description
                    <FieldHint>Description shown under the title in search results. Ideal: 70-160 characters.</FieldHint>
                  </Label>
                  <Textarea
                    id="metaDescription"
                    rows={3}
                    value={form.metaDescription}
                    onChange={(e) => set('metaDescription', e.target.value)}
                    placeholder="A concise description for search engines..."
                    className={errors.metaDescription ? 'border-destructive' : ''}
                  />
                  <div className="flex justify-between">
                    {errors.metaDescription && <p className="text-xs text-destructive">{errors.metaDescription}</p>}
                    {charCount(form.metaDescription, 160)}
                  </div>
                </div>

                {/* Focus Keyword */}
                <div className="space-y-2">
                  <Label htmlFor="focusKeyword">
                    Focus Keyword
                    <FieldHint>The primary keyword you want this post to rank for.</FieldHint>
                  </Label>
                  <Input
                    id="focusKeyword"
                    value={form.focusKeyword}
                    onChange={(e) => set('focusKeyword', e.target.value)}
                    placeholder="e.g. best fiction books 2026"
                    className={errors.focusKeyword ? 'border-destructive' : ''}
                  />
                  {errors.focusKeyword && <p className="text-xs text-destructive">{errors.focusKeyword}</p>}
                </div>

                {/* Search Preview */}
                <Separator />
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                    <Globe className="h-3.5 w-3.5" /> Google Search Preview
                  </p>
                  <div className="bg-white dark:bg-zinc-900 rounded-lg border p-4 max-w-xl">
                    <p className="text-sm text-blue-700 dark:text-blue-400 font-medium truncate">
                      {form.metaTitle || form.title || 'Post Title'} | BookDiscovery Blog
                    </p>
                    <p className="text-xs text-green-700 dark:text-green-400 truncate mt-0.5">
                      {form.canonicalUrl || `bookdiscovery.com/blog/${form.title ? form.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : 'your-post'}`}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {form.metaDescription || form.excerpt || 'Add a meta description to improve search appearance...'}
                    </p>
                  </div>
                </div>

                {/* Robots */}
                <div className="space-y-2">
                  <Label>
                    Robots Directive
                    <FieldHint>Controls how search engines index and follow links on this page.</FieldHint>
                  </Label>
                  <Select value={form.seoRobots} onValueChange={(v) => set('seoRobots', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="index, follow">Index, Follow (default)</SelectItem>
                      <SelectItem value="noindex, follow">No Index, Follow</SelectItem>
                      <SelectItem value="index, nofollow">Index, No Follow</SelectItem>
                      <SelectItem value="noindex, nofollow">No Index, No Follow</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ━━ ADVANCED TAB ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <TabsContent value="advanced" className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Admin Notes</CardTitle></CardHeader>
              <CardContent>
                <Textarea
                  rows={5}
                  value={form.adminNotes}
                  onChange={(e) => set('adminNotes', e.target.value)}
                  placeholder="Internal notes (not visible to readers)..."
                />
              </CardContent>
            </Card>

            {isEditing && postData && (
              <Card>
                <CardHeader><CardTitle>Post Information</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Post ID</p>
                      <p className="font-mono text-xs">{postData.id}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Slug</p>
                      <p className="font-mono text-xs">{postData.slug}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Generated By</p>
                      <p>{postData.generatedBy || 'manual'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Status</p>
                      <Badge variant={postData.status === 'PUBLISHED' ? 'default' : 'secondary'}>
                        {postData.status}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Created</p>
                      <p>{postData.createdAt ? new Date(postData.createdAt).toLocaleString() : '—'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Last Updated</p>
                      <p>{postData.updatedAt ? new Date(postData.updatedAt).toLocaleString() : '—'}</p>
                    </div>
                    {postData.publishedAt && (
                      <div>
                        <p className="text-muted-foreground">Published</p>
                        <p>{new Date(postData.publishedAt).toLocaleString()}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Fixed Footer ─────────────────────────────────────────────── */}
      <div className="flex-none border-t bg-background px-6 py-3">
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={() => navigate('/admin/blog')}>Cancel</Button>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => save('DRAFT')}
              disabled={saving}
            >
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              Save Draft
            </Button>
            <Button
              onClick={() => save('PUBLISHED')}
              disabled={saving}
            >
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
              {isEditing ? 'Update & Publish' : 'Publish'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminBlogEditor;
