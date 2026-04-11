import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  ArrowLeft, Save, Eye, Upload, X, Globe, Link2, Tag, FileText,
  BookOpen, Image as ImageIcon, Search, AlertCircle, CheckCircle2,
  Loader2, Info, ExternalLink, Star, Plus, UserRound,
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
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { booksApi, categoriesApi, authorsApi, type BookResponse, type AuthorResponse } from '@/api/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

// â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface BookForm {
  title: string;
  subtitle: string;
  author: string;
  authorId: string;
  description: string;
  coverImage: string;
  publisher: string;
  publishedDate: string;
  pageCount: number;
  language: string;
  googleRating: number;
  ratingsCount: number;
  price: number;
  currency: string;
  amazonUrl: string;
  isbn10: string;
  isbn13: string;
  metaTitle: string;
  metaDescription: string;
  ogImage: string;
  canonicalUrl: string;
  focusKeyword: string;
  seoRobots: string;
  goodreadsUrl: string;
  customLinkLabel: string;
  customLinkUrl: string;
  adminNotes: string;
  status: string;
  categoryIds: string[];
}

interface ValidationErrors {
  [key: string]: string;
}

const emptyForm: BookForm = {
  title: '', subtitle: '', author: '', authorId: '', description: '', coverImage: '',
  publisher: '', publishedDate: '', pageCount: 0, language: 'en',
  googleRating: 0, ratingsCount: 0, price: 0, currency: 'USD',
  amazonUrl: '', isbn10: '', isbn13: '', metaTitle: '', metaDescription: '',
  ogImage: '', canonicalUrl: '', focusKeyword: '', seoRobots: 'index, follow',
  goodreadsUrl: '', customLinkLabel: '', customLinkUrl: '',
  adminNotes: '', status: 'DRAFT', categoryIds: [],
};

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€ Main Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface AdminBookEditorProps {
  bookSlug?: string; // If provided, we're editing; otherwise creating
}

export function AdminBookEditor({ bookSlug }: AdminBookEditorProps) {
  const navigate = useNavigate();
  const [form, setForm] = useState<BookForm>(emptyForm);
  const [originalBook, setOriginalBook] = useState<BookResponse | null>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [authors, setAuthors] = useState<AuthorResponse[]>([]);
  const [authorSearch, setAuthorSearch] = useState('');
  const [authorPopoverOpen, setAuthorPopoverOpen] = useState(false);
  const [creatingAuthor, setCreatingAuthor] = useState(false);
  const [loading, setLoading] = useState(!!bookSlug);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isDirty, setIsDirty] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isEditing = !!bookSlug;

  // Load book data for editing
  useEffect(() => {
    if (!bookSlug) return;
    setLoading(true);

    // Load both book and categories in parallel so we can match categories
    Promise.all([
      booksApi.getBySlug(bookSlug),
      categoriesApi.list(),
    ])
      .then(([book, cats]) => {
        setOriginalBook(book);
        setCategories(cats);

        // Map the book's category names to category IDs
        const catIds = (book.categories || [])
          .map((catName: string) => {
            const found = cats.find((c: any) => c.name === catName || c.slug === catName);
            return found?.id;
          })
          .filter(Boolean) as string[];

        setForm({
          title: book.title || '',
          subtitle: book.subtitle || '',
          author: book.author || '',
          authorId: book.authorId || '',
          description: book.description || '',
          coverImage: book.coverImage || '',
          publisher: book.publisher || '',
          publishedDate: book.publishedDate || '',
          pageCount: book.pageCount || 0,
          language: book.language || 'en',
          googleRating: book.googleRating || 0,
          ratingsCount: book.ratingsCount || 0,
          price: book.price || 0,
          currency: book.currency || 'USD',
          amazonUrl: book.amazonUrl || '',
          isbn10: book.isbn10 || '',
          isbn13: book.isbn13 || '',
          metaTitle: book.metaTitle || '',
          metaDescription: book.metaDescription || '',
          ogImage: book.ogImage || '',
          canonicalUrl: book.canonicalUrl || '',
          focusKeyword: book.focusKeyword || '',
          seoRobots: book.seoRobots || 'index, follow',
          goodreadsUrl: book.goodreadsUrl || '',
          customLinkLabel: book.customLinkLabel || '',
          customLinkUrl: book.customLinkUrl || '',
          adminNotes: book.adminNotes || '',
          status: book.status || 'DRAFT',
          categoryIds: catIds,
        });

        // Set the author search text for display
        if (book.author) {
          setAuthorSearch(book.author);
        }
      })
      .catch((err) => {
        toast.error('Failed to load book');
        console.error(err);
      })
      .finally(() => setLoading(false));
  }, [bookSlug]);

  // Load categories (for new books â€” editing loads them above)
  useEffect(() => {
    if (bookSlug) return; // Already loaded in the edit flow above
    categoriesApi.list().then(setCategories).catch(console.error);
  }, [bookSlug]);

  // Load authors list
  useEffect(() => {
    authorsApi.list(undefined, 200).then(setAuthors).catch(console.error);
  }, []);

  const updateForm = useCallback((key: keyof BookForm, value: any) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setIsDirty(true);
    // Clear the error for this field
    setErrors(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  // â”€â”€ Validation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const validate = useCallback((): boolean => {
    const errs: ValidationErrors = {};

    if (!form.title.trim()) errs.title = 'Title is required';
    else if (form.title.length > 300) errs.title = 'Title must be under 300 characters';

    if (!form.author.trim()) errs.author = 'Author is required';

    if (form.metaTitle && form.metaTitle.length > 70)
      errs.metaTitle = 'Meta title should be under 70 characters for optimal SEO';

    if (form.metaDescription && form.metaDescription.length > 170)
      errs.metaDescription = 'Meta description should be under 170 characters';

    if (form.isbn10 && !/^\d{10}$/.test(form.isbn10))
      errs.isbn10 = 'ISBN-10 must be exactly 10 digits';

    if (form.isbn13 && !/^\d{13}$/.test(form.isbn13))
      errs.isbn13 = 'ISBN-13 must be exactly 13 digits';

    if (form.amazonUrl && !/^https?:\/\//.test(form.amazonUrl))
      errs.amazonUrl = 'Must be a valid URL starting with http:// or https://';

    if (form.goodreadsUrl && !/^https?:\/\//.test(form.goodreadsUrl))
      errs.goodreadsUrl = 'Must be a valid URL starting with http:// or https://';

    if (form.customLinkUrl && !/^https?:\/\//.test(form.customLinkUrl))
      errs.customLinkUrl = 'Must be a valid URL starting with http:// or https://';

    if (form.canonicalUrl && !/^https?:\/\//.test(form.canonicalUrl))
      errs.canonicalUrl = 'Must be a valid URL starting with http:// or https://';

    if (form.coverImage && !/^(https?:\/\/|\/uploads\/)/.test(form.coverImage))
      errs.coverImage = 'Must be a valid URL or uploaded file path';

    if (form.googleRating < 0 || form.googleRating > 5)
      errs.googleRating = 'Rating must be between 0 and 5';

    if (form.price < 0)
      errs.price = 'Price cannot be negative';

    if (form.publishedDate && !/^\d{4}(-\d{2}(-\d{2})?)?$/.test(form.publishedDate))
      errs.publishedDate = 'Use YYYY, YYYY-MM, or YYYY-MM-DD format';

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [form]);

  // â”€â”€ Cover Upload â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const handleCoverUpload = useCallback(async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File too large â€” max 5MB');
      return;
    }
    setUploading(true);
    try {
      const result = await booksApi.uploadCover(file);
      updateForm('coverImage', result.url);
      toast.success('Cover image uploaded');
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, [updateForm]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleCoverUpload(file);
    }
  }, [handleCoverUpload]);

  // â”€â”€ Save â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const handleSave = useCallback(async (publish = false) => {
    if (!validate()) {
      toast.error('Please fix the validation errors before saving');
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        title: form.title.trim(),
        subtitle: form.subtitle.trim() || undefined,
        author: form.author.trim(),
        authorId: form.authorId || undefined,
        description: form.description.trim() || undefined,
        coverImage: form.coverImage || undefined,
        publisher: form.publisher.trim() || undefined,
        publishedDate: form.publishedDate || undefined,
        pageCount: form.pageCount || undefined,
        language: form.language || 'en',
        googleRating: form.googleRating !== undefined && form.googleRating !== null && form.googleRating !== '' ? Number(form.googleRating) : undefined,
        ratingsCount: form.ratingsCount || undefined,
        price: form.price !== undefined && form.price !== null && form.price !== '' ? Number(form.price) : undefined,
        currency: form.currency || 'USD',
        amazonUrl: form.amazonUrl.trim() || undefined,
        isbn10: form.isbn10.trim() || undefined,
        isbn13: form.isbn13.trim() || undefined,
        metaTitle: form.metaTitle.trim() || undefined,
        metaDescription: form.metaDescription.trim() || undefined,
        ogImage: form.ogImage.trim() || undefined,
        canonicalUrl: form.canonicalUrl.trim() || undefined,
        focusKeyword: form.focusKeyword.trim() || undefined,
        seoRobots: form.seoRobots || 'index, follow',
        goodreadsUrl: form.goodreadsUrl.trim() || undefined,
        customLinkLabel: form.customLinkLabel.trim() || undefined,
        customLinkUrl: form.customLinkUrl.trim() || undefined,
        adminNotes: form.adminNotes.trim() || undefined,
        status: publish ? 'PUBLISHED' : form.status,
        categories: form.categoryIds.map(id => {
          const cat = categories.find(c => c.id === id);
          return cat?.name || cat?.slug || id;
        }),
      };

      if (isEditing && originalBook) {
        await booksApi.update(originalBook.id, payload);
        toast.success('Book updated successfully');
      } else {
        await booksApi.create(payload);
        toast.success('Book created successfully');
      }

      setIsDirty(false);
      navigate('/admin/books');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save book');
    } finally {
      setSaving(false);
    }
  }, [form, validate, isEditing, originalBook, categories, navigate]);

  // â”€â”€ Auto-generate SEO fields â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const autoGenerateSEO = useCallback(() => {
    const updates: Partial<BookForm> = {};

    if (!form.metaTitle && form.title) {
      const mt = form.author
        ? `${form.title} by ${form.author} | The Book Times`
        : `${form.title} | The Book Times`;
      updates.metaTitle = mt.slice(0, 70);
    }

    if (!form.metaDescription && form.description) {
      const desc = form.description.replace(/<[^>]*>/g, '').trim();
      updates.metaDescription = desc.slice(0, 160);
    } else if (!form.metaDescription && form.title) {
      updates.metaDescription = `Discover ${form.title} by ${form.author}. Read reviews, ratings, and find the best deals.`.slice(0, 160);
    }

    if (!form.focusKeyword && form.title) {
      updates.focusKeyword = form.title.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    }

    setForm(prev => ({ ...prev, ...updates }));
    setIsDirty(true);
    toast.success('SEO fields auto-generated');
  }, [form]);

  // â”€â”€ SEO Score â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const seoScore = (() => {
    let score = 0;
    const max = 10;
    if (form.metaTitle) score += 2;
    if (form.metaTitle && form.metaTitle.length >= 30 && form.metaTitle.length <= 60) score += 1;
    if (form.metaDescription) score += 2;
    if (form.metaDescription && form.metaDescription.length >= 120 && form.metaDescription.length <= 160) score += 1;
    if (form.focusKeyword) score += 1;
    if (form.description && form.description.length > 100) score += 1;
    if (form.coverImage) score += 1;
    if (form.ogImage || form.coverImage) score += 1;
    return { score, max, percent: Math.round((score / max) * 100) };
  })();

  // â”€â”€ Render helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  // â”€â”€ Author Search & Create â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const filteredAuthors = useMemo(() => {
    if (!authorSearch.trim()) return authors;
    const q = authorSearch.toLowerCase();
    return authors.filter(a => a.name.toLowerCase().includes(q));
  }, [authors, authorSearch]);

  const handleSelectAuthor = useCallback((author: AuthorResponse) => {
    updateForm('authorId', author.id);
    updateForm('author', author.name);
    setAuthorSearch(author.name);
    setAuthorPopoverOpen(false);
  }, [updateForm]);

  const handleCreateNewAuthor = useCallback(async () => {
    const name = authorSearch.trim();
    if (!name) return;
    setCreatingAuthor(true);
    try {
      const author = await authorsApi.findOrCreate(name);
      setAuthors(prev => [author, ...prev]);
      updateForm('authorId', author.id);
      updateForm('author', author.name);
      setAuthorSearch(author.name);
      setAuthorPopoverOpen(false);
      toast.success(`Author "${author.name}" created`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create author');
    } finally {
      setCreatingAuthor(false);
    }
  }, [authorSearch, updateForm]);

  function FieldError({ field }: { field: string }) {
    const err = errors[field];
    if (!err) return null;
    return (
      <p className="text-xs text-destructive mt-1 flex items-center gap-1">
        <AlertCircle className="h-3 w-3 shrink-0" /> {err}
      </p>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* â”€â”€ Fixed Header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="shrink-0 border-b bg-background/95 backdrop-blur-sm px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="icon" onClick={() => navigate('/admin/books')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-xl font-bold truncate">
                {isEditing ? `Edit: ${originalBook?.title || 'Book'}` : 'Add New Book'}
              </h1>
              {isEditing && originalBook && (
                <p className="text-xs text-muted-foreground">
                  Last updated: {new Date(originalBook.updatedAt).toLocaleDateString()} Â· Slug: {originalBook.slug}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isEditing && originalBook && (
              <Button variant="outline" size="sm" asChild>
                <a href={`/book/${originalBook.slug}`} target="_blank" rel="noopener noreferrer" className="gap-2">
                  <Eye className="h-4 w-4" /> Preview
                </a>
              </Button>
            )}
            {isDirty && (
              <Badge variant="outline" className="text-yellow-600 border-yellow-300">
                Unsaved changes
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* â”€â”€ Scrollable Content â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid grid-cols-5 w-full">
              <TabsTrigger value="general" className="gap-1.5 text-xs sm:text-sm">
                <BookOpen className="h-4 w-4 shrink-0" /> <span className="hidden sm:inline">General</span>
              </TabsTrigger>
              <TabsTrigger value="media" className="gap-1.5 text-xs sm:text-sm">
                <ImageIcon className="h-4 w-4 shrink-0" /> <span className="hidden sm:inline">Media</span>
              </TabsTrigger>
              <TabsTrigger value="links" className="gap-1.5 text-xs sm:text-sm">
                <Link2 className="h-4 w-4 shrink-0" /> <span className="hidden sm:inline">Links</span>
              </TabsTrigger>
              <TabsTrigger value="seo" className="gap-1.5 text-xs sm:text-sm">
                <Search className="h-4 w-4 shrink-0" /> <span className="hidden sm:inline">SEO</span>
              </TabsTrigger>
              <TabsTrigger value="advanced" className="gap-1.5 text-xs sm:text-sm">
                <Tag className="h-4 w-4 shrink-0" /> <span className="hidden sm:inline">Advanced</span>
              </TabsTrigger>
            </TabsList>

            {/* â”€â”€ TAB: General â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <TabsContent value="general" className="space-y-6 mt-6">
              {/* Basic Info */}
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BookOpen className="h-4 w-4" /> Basic Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="title">
                        Title <span className="text-destructive">*</span>
                        <FieldHint>The main title of the book as it appears on the cover</FieldHint>
                      </Label>
                      <Input
                        id="title"
                        value={form.title}
                        onChange={(e) => updateForm('title', e.target.value)}
                        placeholder="e.g. Atomic Habits"
                        className={errors.title ? 'border-destructive' : ''}
                      />
                      <FieldError field="title" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="author">
                        Author <span className="text-destructive">*</span>
                        <FieldHint>Select an existing author or type a name to create a new one</FieldHint>
                      </Label>
                      <Popover open={authorPopoverOpen} onOpenChange={setAuthorPopoverOpen}>
                        <PopoverTrigger asChild>
                          <div className="relative">
                            <UserRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              id="author"
                              value={authorSearch}
                              onChange={(e) => {
                                setAuthorSearch(e.target.value);
                                setAuthorPopoverOpen(true);
                              }}
                              onFocus={() => setAuthorPopoverOpen(true)}
                              placeholder="Search or type author name..."
                              className={`pl-9 ${errors.author ? 'border-destructive' : ''}`}
                              autoComplete="off"
                            />
                            {form.authorId && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateForm('authorId', '');
                                  updateForm('author', '');
                                  setAuthorSearch('');
                                }}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-[var(--radix-popover-trigger-width)] p-0"
                          align="start"
                          onOpenAutoFocus={(e) => e.preventDefault()}
                        >
                          <div className="max-h-60 overflow-y-auto">
                            {filteredAuthors.length === 0 && !authorSearch.trim() && (
                              <p className="text-sm text-muted-foreground p-3">No authors loaded</p>
                            )}
                            {filteredAuthors.map((a) => (
                              <button
                                key={a.id}
                                type="button"
                                className={`w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center justify-between ${form.authorId === a.id ? 'bg-accent font-medium' : ''}`}
                                onClick={() => handleSelectAuthor(a)}
                              >
                                <span>{a.name}</span>
                                {a.bookCount !== undefined && a.bookCount > 0 && (
                                  <span className="text-xs text-muted-foreground">{a.bookCount} books</span>
                                )}
                              </button>
                            ))}
                            {authorSearch.trim() && !filteredAuthors.some(a => a.name.toLowerCase() === authorSearch.trim().toLowerCase()) && (
                              <button
                                type="button"
                                className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center gap-2 text-primary border-t"
                                onClick={handleCreateNewAuthor}
                                disabled={creatingAuthor}
                              >
                                {creatingAuthor ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Plus className="h-3 w-3" />
                                )}
                                Create &ldquo;{authorSearch.trim()}&rdquo;
                              </button>
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                      <FieldError field="author" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="subtitle">Subtitle</Label>
                    <Input
                      id="subtitle"
                      value={form.subtitle}
                      onChange={(e) => updateForm('subtitle', e.target.value)}
                      placeholder="e.g. An Easy & Proven Way to Build Good Habits"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">
                      Description
                      <FieldHint>A detailed description/synopsis of the book. Good descriptions improve SEO.</FieldHint>
                    </Label>
                    <Textarea
                      id="description"
                      value={form.description}
                      onChange={(e) => updateForm('description', e.target.value)}
                      rows={6}
                      placeholder="Write a compelling book description..."
                    />
                    <div className="flex justify-between">
                      <p className="text-xs text-muted-foreground">
                        {form.description.length > 0 ? `${form.description.length} characters` : 'Recommended: 200-500 characters'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Publishing Details */}
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4" /> Publishing Details
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="publisher">Publisher</Label>
                      <Input
                        id="publisher"
                        value={form.publisher}
                        onChange={(e) => updateForm('publisher', e.target.value)}
                        placeholder="e.g. Penguin Random House"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="publishedDate">
                        Published Date
                        <FieldHint>YYYY, YYYY-MM, or YYYY-MM-DD format</FieldHint>
                      </Label>
                      <Input
                        id="publishedDate"
                        value={form.publishedDate}
                        onChange={(e) => updateForm('publishedDate', e.target.value)}
                        placeholder="2024-01-15"
                        className={errors.publishedDate ? 'border-destructive' : ''}
                      />
                      <FieldError field="publishedDate" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pageCount">Page Count</Label>
                      <Input
                        id="pageCount"
                        type="number"
                        min="0"
                        value={form.pageCount || ''}
                        onChange={(e) => updateForm('pageCount', parseInt(e.target.value) || 0)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="language">Language</Label>
                      <Select value={form.language} onValueChange={(v) => updateForm('language', v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="en">English</SelectItem>
                          <SelectItem value="es">Spanish</SelectItem>
                          <SelectItem value="fr">French</SelectItem>
                          <SelectItem value="de">German</SelectItem>
                          <SelectItem value="it">Italian</SelectItem>
                          <SelectItem value="pt">Portuguese</SelectItem>
                          <SelectItem value="ja">Japanese</SelectItem>
                          <SelectItem value="zh">Chinese</SelectItem>
                          <SelectItem value="ko">Korean</SelectItem>
                          <SelectItem value="ar">Arabic</SelectItem>
                          <SelectItem value="hi">Hindi</SelectItem>
                          <SelectItem value="ru">Russian</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="isbn10">
                        ISBN-10
                        <FieldHint>10-digit International Standard Book Number</FieldHint>
                      </Label>
                      <Input
                        id="isbn10"
                        value={form.isbn10}
                        onChange={(e) => updateForm('isbn10', e.target.value.replace(/\D/g, '').slice(0, 10))}
                        placeholder="0123456789"
                        maxLength={10}
                        className={errors.isbn10 ? 'border-destructive' : ''}
                      />
                      <FieldError field="isbn10" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="isbn13">
                        ISBN-13
                        <FieldHint>13-digit International Standard Book Number</FieldHint>
                      </Label>
                      <Input
                        id="isbn13"
                        value={form.isbn13}
                        onChange={(e) => updateForm('isbn13', e.target.value.replace(/\D/g, '').slice(0, 13))}
                        placeholder="9780123456789"
                        maxLength={13}
                        className={errors.isbn13 ? 'border-destructive' : ''}
                      />
                      <FieldError field="isbn13" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Rating & Status */}
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Star className="h-4 w-4" /> Rating & Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="googleRating">
                        Google Rating
                        <FieldHint>Rating from Google Books (0-5)</FieldHint>
                      </Label>
                      <Input
                        id="googleRating"
                        type="number"
                        step="0.1"
                        min="0"
                        max="5"
                        value={form.googleRating || ''}
                        onChange={(e) => updateForm('googleRating', parseFloat(e.target.value) || 0)}
                        className={errors.googleRating ? 'border-destructive' : ''}
                      />
                      <FieldError field="googleRating" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ratingsCount">Ratings Count</Label>
                      <Input
                        id="ratingsCount"
                        type="number"
                        min="0"
                        value={form.ratingsCount || ''}
                        onChange={(e) => updateForm('ratingsCount', parseInt(e.target.value) || 0)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="status">Status</Label>
                      <Select value={form.status} onValueChange={(v) => updateForm('status', v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PUBLISHED">Published</SelectItem>
                          <SelectItem value="DRAFT">Draft</SelectItem>
                          <SelectItem value="ARCHIVED">Archived</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Categories</Label>
                      <div className="flex flex-wrap gap-1.5 min-h-[40px] p-2 border rounded-md bg-background">
                        {categories.length === 0 && (
                          <span className="text-xs text-muted-foreground">No categories available</span>
                        )}
                        {categories.map((cat: any) => (
                          <Badge
                            key={cat.id}
                            variant={form.categoryIds.includes(cat.id) ? 'default' : 'outline'}
                            className="cursor-pointer text-xs"
                            onClick={() => {
                              updateForm('categoryIds',
                                form.categoryIds.includes(cat.id)
                                  ? form.categoryIds.filter((i) => i !== cat.id)
                                  : [...form.categoryIds, cat.id],
                              );
                            }}
                          >
                            {cat.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* â”€â”€ TAB: Media â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <TabsContent value="media" className="space-y-6 mt-6">
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ImageIcon className="h-4 w-4" /> Cover Image
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_200px] gap-6">
                    <div className="space-y-4">
                      {/* URL Input */}
                      <div className="space-y-2">
                        <Label htmlFor="coverImage">
                          Image URL
                          <FieldHint>Enter a URL or upload a file below</FieldHint>
                        </Label>
                        <Input
                          id="coverImage"
                          value={form.coverImage}
                          onChange={(e) => updateForm('coverImage', e.target.value)}
                          placeholder="https://... or upload below"
                          className={errors.coverImage ? 'border-destructive' : ''}
                        />
                        <FieldError field="coverImage" />
                      </div>

                      {/* Upload Area */}
                      <div
                        className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleCoverUpload(file);
                          }}
                        />
                        {uploading ? (
                          <div className="flex flex-col items-center gap-2">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <p className="text-sm text-muted-foreground">Uploading & optimizing...</p>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-2">
                            <Upload className="h-8 w-8 text-muted-foreground" />
                            <p className="text-sm font-medium">Click to upload or drag & drop</p>
                            <p className="text-xs text-muted-foreground">
                              JPEG, PNG, WebP, or GIF â€” Max 5MB
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Images are auto-converted to WebP and optimized
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Preview */}
                    <div className="space-y-2">
                      <Label>Preview</Label>
                      <div className="aspect-[2/3] rounded-lg border bg-muted overflow-hidden">
                        {form.coverImage ? (
                          <img
                            src={form.coverImage}
                            alt="Cover preview"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = '';
                              (e.target as HTMLImageElement).alt = 'Failed to load';
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                            <ImageIcon className="h-12 w-12" />
                          </div>
                        )}
                      </div>
                      {form.coverImage && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full gap-1.5 text-destructive"
                          onClick={() => updateForm('coverImage', '')}
                        >
                          <X className="h-3.5 w-3.5" /> Remove
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* OG Image */}
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Globe className="h-4 w-4" /> Social Sharing Image (OG Image)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Label htmlFor="ogImage">
                    OG Image URL
                    <FieldHint>Custom image for social media shares (1200x630 recommended). Falls back to cover image if empty.</FieldHint>
                  </Label>
                  <Input
                    id="ogImage"
                    value={form.ogImage}
                    onChange={(e) => updateForm('ogImage', e.target.value)}
                    placeholder="https://... (optional â€” defaults to cover image)"
                  />
                  {form.ogImage && (
                    <div className="mt-2 rounded-lg border overflow-hidden max-w-md">
                      <img src={form.ogImage} alt="OG preview" className="w-full h-auto" />
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* â”€â”€ TAB: Links â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <TabsContent value="links" className="space-y-6 mt-6">
              {/* Purchase Links */}
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ExternalLink className="h-4 w-4" /> Purchase & Affiliate Links
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="price">Price</Label>
                      <Input
                        id="price"
                        type="number"
                        step="0.01"
                        min="0"
                        value={form.price || ''}
                        onChange={(e) => updateForm('price', parseFloat(e.target.value) || 0)}
                        className={errors.price ? 'border-destructive' : ''}
                      />
                      <FieldError field="price" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="currency">Currency</Label>
                      <Select value={form.currency} onValueChange={(v) => updateForm('currency', v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="USD">USD ($)</SelectItem>
                          <SelectItem value="EUR">EUR (â‚¬)</SelectItem>
                          <SelectItem value="GBP">GBP (Â£)</SelectItem>
                          <SelectItem value="CAD">CAD (C$)</SelectItem>
                          <SelectItem value="AUD">AUD (A$)</SelectItem>
                          <SelectItem value="INR">INR (â‚¹)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label htmlFor="amazonUrl">
                      Amazon URL
                      <FieldHint>Your affiliate link to Amazon. Users can purchase through this link.</FieldHint>
                    </Label>
                    <Input
                      id="amazonUrl"
                      value={form.amazonUrl}
                      onChange={(e) => updateForm('amazonUrl', e.target.value)}
                      placeholder="https://www.amazon.com/dp/..."
                      className={errors.amazonUrl ? 'border-destructive' : ''}
                    />
                    <FieldError field="amazonUrl" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="goodreadsUrl">
                      Goodreads URL
                      <FieldHint>Link to the book's Goodreads page</FieldHint>
                    </Label>
                    <Input
                      id="goodreadsUrl"
                      value={form.goodreadsUrl}
                      onChange={(e) => updateForm('goodreadsUrl', e.target.value)}
                      placeholder="https://www.goodreads.com/book/show/..."
                      className={errors.goodreadsUrl ? 'border-destructive' : ''}
                    />
                    <FieldError field="goodreadsUrl" />
                  </div>
                </CardContent>
              </Card>

              {/* Custom Link */}
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Link2 className="h-4 w-4" /> Custom Link
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Add a custom link that will appear on the book's page (e.g., author's website, publisher page, etc.)
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="customLinkLabel">Link Label</Label>
                      <Input
                        id="customLinkLabel"
                        value={form.customLinkLabel}
                        onChange={(e) => updateForm('customLinkLabel', e.target.value)}
                        placeholder="e.g. Author's Website"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="customLinkUrl">Link URL</Label>
                      <Input
                        id="customLinkUrl"
                        value={form.customLinkUrl}
                        onChange={(e) => updateForm('customLinkUrl', e.target.value)}
                        placeholder="https://..."
                        className={errors.customLinkUrl ? 'border-destructive' : ''}
                      />
                      <FieldError field="customLinkUrl" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* â”€â”€ TAB: SEO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <TabsContent value="seo" className="space-y-6 mt-6">
              {/* SEO Score */}
              <Card className="border-primary/20">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold ${
                        seoScore.percent >= 80 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                        seoScore.percent >= 50 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                        'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      }`}>
                        {seoScore.score}/{seoScore.max}
                      </div>
                      <div>
                        <p className="font-medium">SEO Score</p>
                        <p className="text-xs text-muted-foreground">
                          {seoScore.percent >= 80 ? 'Great! Your SEO is well optimized' :
                           seoScore.percent >= 50 ? 'Good, but there\'s room for improvement' :
                           'Needs attention â€” fill in more SEO fields'}
                        </p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={autoGenerateSEO} className="gap-1.5 shrink-0">
                      <CheckCircle2 className="h-4 w-4" /> Auto-Generate
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Meta Tags */}
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Globe className="h-4 w-4" /> Meta Tags
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="metaTitle">
                        Meta Title
                        <FieldHint>The title shown in search results. Keep between 30-60 characters.</FieldHint>
                      </Label>
                      {charCount(form.metaTitle, 60)}
                    </div>
                    <Input
                      id="metaTitle"
                      value={form.metaTitle}
                      onChange={(e) => updateForm('metaTitle', e.target.value)}
                      placeholder="Custom title for search engines (auto-generated if empty)"
                      className={errors.metaTitle ? 'border-destructive' : ''}
                    />
                    <FieldError field="metaTitle" />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="metaDescription">
                        Meta Description
                        <FieldHint>The description snippet shown in search results. Ideal length: 120-160 characters.</FieldHint>
                      </Label>
                      {charCount(form.metaDescription, 160)}
                    </div>
                    <Textarea
                      id="metaDescription"
                      value={form.metaDescription}
                      onChange={(e) => updateForm('metaDescription', e.target.value)}
                      rows={3}
                      placeholder="Compelling description for search engine results..."
                      className={errors.metaDescription ? 'border-destructive' : ''}
                    />
                    <FieldError field="metaDescription" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="focusKeyword">
                      Focus Keyword
                      <FieldHint>The primary keyword/phrase this book page should rank for</FieldHint>
                    </Label>
                    <Input
                      id="focusKeyword"
                      value={form.focusKeyword}
                      onChange={(e) => updateForm('focusKeyword', e.target.value)}
                      placeholder="e.g. atomic habits book"
                    />
                  </div>

                  {/* Google Preview */}
                  <div className="space-y-2">
                    <Label>Google Search Preview</Label>
                    <div className="p-4 bg-white dark:bg-zinc-900 rounded-lg border space-y-1">
                      <p className="text-[#1a0dab] dark:text-blue-400 text-lg leading-snug truncate cursor-pointer hover:underline">
                        {form.metaTitle || (form.title ? `${form.title} by ${form.author} | The Book Times` : 'Page Title')}
                      </p>
                      <p className="text-[#006621] dark:text-green-400 text-sm truncate">
                        The Book Times.com/book/{originalBook?.slug || 'book-slug'}
                      </p>
                      <p className="text-[#545454] dark:text-zinc-400 text-sm line-clamp-2">
                        {form.metaDescription || form.description?.slice(0, 160) || 'Meta description will appear here...'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Advanced SEO */}
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Tag className="h-4 w-4" /> Advanced SEO
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="canonicalUrl">
                        Canonical URL
                        <FieldHint>Override the default canonical URL. Leave blank to use the auto-generated URL.</FieldHint>
                      </Label>
                      <Input
                        id="canonicalUrl"
                        value={form.canonicalUrl}
                        onChange={(e) => updateForm('canonicalUrl', e.target.value)}
                        placeholder="https://The Book Times.com/book/..."
                        className={errors.canonicalUrl ? 'border-destructive' : ''}
                      />
                      <FieldError field="canonicalUrl" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="seoRobots">
                        Robots Directive
                        <FieldHint>Controls how search engines index this page</FieldHint>
                      </Label>
                      <Select value={form.seoRobots} onValueChange={(v) => updateForm('seoRobots', v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="index, follow">Index, Follow (default)</SelectItem>
                          <SelectItem value="noindex, follow">NoIndex, Follow</SelectItem>
                          <SelectItem value="index, nofollow">Index, NoFollow</SelectItem>
                          <SelectItem value="noindex, nofollow">NoIndex, NoFollow</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* â”€â”€ TAB: Advanced â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <TabsContent value="advanced" className="space-y-6 mt-6">
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-base">Admin Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={form.adminNotes}
                    onChange={(e) => updateForm('adminNotes', e.target.value)}
                    rows={4}
                    placeholder="Internal notes about this book (not shown to users)..."
                  />
                </CardContent>
              </Card>

              {isEditing && originalBook && (
                <Card>
                  <CardHeader className="pb-4">
                    <CardTitle className="text-base">Book Metadata</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-y-3 text-sm">
                      <span className="text-muted-foreground">Book ID</span>
                      <span className="font-mono text-xs">{originalBook.id}</span>
                      <span className="text-muted-foreground">Slug</span>
                      <span className="font-mono text-xs">{originalBook.slug}</span>
                      <span className="text-muted-foreground">Google Books ID</span>
                      <span className="font-mono text-xs">{originalBook.googleBooksId || 'â€”'}</span>
                      <span className="text-muted-foreground">Computed Score</span>
                      <span>{originalBook.computedScore?.toFixed(1) || '0'}</span>
                      <span className="text-muted-foreground">Created</span>
                      <span>{new Date(originalBook.createdAt).toLocaleString()}</span>
                      <span className="text-muted-foreground">Updated</span>
                      <span>{new Date(originalBook.updatedAt).toLocaleString()}</span>
                      <span className="text-muted-foreground">Indexed</span>
                      <span>{new Date(originalBook.indexedAt).toLocaleString()}</span>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* â”€â”€ Fixed Footer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="shrink-0 border-t bg-background/95 backdrop-blur-sm px-6 py-3">
        <div className="flex items-center justify-between max-w-5xl mx-auto">
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate('/admin/books')}>
              Cancel
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => handleSave(false)}
              disabled={saving || !isDirty}
              className="gap-1.5"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isEditing ? 'Save Changes' : 'Save as Draft'}
            </Button>
            <Button
              onClick={() => handleSave(true)}
              disabled={saving}
              className="gap-1.5"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {isEditing ? 'Save & Publish' : 'Publish'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
