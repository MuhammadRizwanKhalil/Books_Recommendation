import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, BookOpen, Tag, User, ArrowRight, Loader2, Star } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { booksApi } from '@/api/client';
import { useDebounce } from '@/hooks/useBooks';
import { cn } from '@/lib/utils';

/** Highlights matching portions of text */
function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query || query.length < 2) return <>{text}</>;
  // Escape special regex characters
  const escaped = query.replace(/[.*+?^${}()|\\[\]]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="bg-primary/20 text-foreground rounded-sm px-0.5">{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

interface BookSuggestion {
  id: string;
  title: string;
  author: string;
  slug: string;
  coverImage: string;
  googleRating: number;
}

interface CategorySuggestion {
  id: string;
  name: string;
  slug: string;
  bookCount: number;
}

interface AuthorSuggestion {
  id: string;
  name: string;
  slug: string;
  imageUrl?: string;
  bookCount: number;
}

interface SearchDropdownProps {
  className?: string;
  onClose?: () => void;
  autoFocus?: boolean;
  /** Whether in mobile/full-screen mode */
  fullscreen?: boolean;
  /** Size variant – 'lg' gives a taller input for hero sections */
  size?: 'default' | 'lg';
}

export function SearchDropdown({ className, onClose, autoFocus = false, fullscreen = false, size = 'default' }: SearchDropdownProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [books, setBooks] = useState<BookSuggestion[]>([]);
  const [categories, setCategories] = useState<CategorySuggestion[]>([]);
  const [authors, setAuthors] = useState<AuthorSuggestion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const debouncedQuery = useDebounce(query, 150);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Total items for keyboard nav
  const totalItems = books.length + categories.length + authors.length + (query.trim() ? 1 : 0); // +1 for "View all results"

  // Fetch suggestions
  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) {
      setBooks([]);
      setCategories([]);
      setAuthors([]);
      setIsOpen(false);
      return;
    }

    setLoading(true);
    booksApi.searchSuggestions(debouncedQuery)
      .then((res) => {
        setBooks(res.suggestions);
        setCategories(res.categories);
        setAuthors(res.authors);
        setIsOpen(true);
        setSelectedIndex(-1);
      })
      .catch(() => {
        setBooks([]);
        setCategories([]);
        setAuthors([]);
      })
      .finally(() => setLoading(false));
  }, [debouncedQuery]);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const goToSearch = useCallback((searchQuery?: string) => {
    const q = searchQuery || query;
    if (q.trim()) {
      navigate(`/search?q=${encodeURIComponent(q.trim())}`);
    } else {
      navigate('/search');
    }
    setIsOpen(false);
    onClose?.();
  }, [query, navigate, onClose]);

  const goToBook = useCallback((slug: string) => {
    navigate(`/book/${slug}`);
    setIsOpen(false);
    onClose?.();
  }, [navigate, onClose]);

  const goToCategory = useCallback((slug: string) => {
    navigate(`/category/${slug}`);
    setIsOpen(false);
    onClose?.();
  }, [navigate, onClose]);

  const goToAuthor = useCallback((slug: string) => {
    navigate(`/author/${slug}`);
    setIsOpen(false);
    onClose?.();
  }, [navigate, onClose]);

  // Build flat item list for keyboard navigation
  const getItemAction = useCallback((index: number) => {
    let i = index;

    // Books
    if (i < books.length) {
      return () => goToBook(books[i].slug);
    }
    i -= books.length;

    // Categories
    if (i < categories.length) {
      return () => goToCategory(categories[i].slug);
    }
    i -= categories.length;

    // Authors
    if (i < authors.length) {
      return () => goToAuthor(authors[i].slug);
    }
    i -= authors.length;

    // View all results
    if (i === 0) {
      return () => goToSearch();
    }

    return null;
  }, [books, categories, authors, goToBook, goToCategory, goToAuthor, goToSearch]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      onClose?.();
      return;
    }

    if (e.key === 'Enter') {
      if (selectedIndex >= 0) {
        e.preventDefault();
        const action = getItemAction(selectedIndex);
        action?.();
      } else {
        goToSearch();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % totalItems);
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev <= 0 ? totalItems - 1 : prev - 1));
      return;
    }
  }, [selectedIndex, totalItems, getItemAction, goToSearch, onClose]);

  // Track current section + local index for rendering
  let itemCounter = 0;

  return (
    <div ref={dropdownRef} className={cn('relative', className)}>
      <div className="relative">
        <Search className={cn(
          'absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground',
          size === 'lg' ? 'h-5 w-5 left-4' : 'h-4 w-4'
        )} />
        <Input
          ref={inputRef}
          type="text"
          placeholder="Search books, authors, categories..."
          className={cn(
            size === 'lg'
              ? 'pl-12 pr-12 py-6 text-lg rounded-full shadow-lg border-2 focus:border-primary'
              : 'pl-9 pr-10',
            fullscreen ? 'text-lg py-5 rounded-2xl' : (size !== 'lg' ? 'rounded-lg' : '')
          )}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (query.length >= 2 && (books.length > 0 || categories.length > 0 || authors.length > 0)) setIsOpen(true); }}
          autoFocus={autoFocus}
        />
        {query && (
          <button
            aria-label="Clear search"
            onClick={() => { setQuery(''); setIsOpen(false); inputRef.current?.focus(); }}
            className="absolute right-3 top-1/2 -translate-y-1/2"
          >
            <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
          </button>
        )}
        {loading && (
          <Loader2 className="absolute right-9 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
        )}
      </div>

      {/* Dropdown */}
      {isOpen && (books.length > 0 || categories.length > 0 || authors.length > 0) && (
        <div className={cn(
          'absolute left-0 right-0 mt-2 bg-popover border rounded-xl shadow-xl z-50 overflow-hidden',
          fullscreen ? 'max-h-[70vh]' : 'max-h-[420px]'
        )}>
          <div className="overflow-y-auto max-h-[inherit]">
            {/* Book Suggestions */}
            {books.length > 0 && (
              <div className="p-2">
                <p className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Books</p>
                {books.map((book) => {
                  const globalIndex = itemCounter;
                  itemCounter++;
                  return (
                    <button
                      key={book.id}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors',
                        selectedIndex === globalIndex
                          ? 'bg-accent text-accent-foreground'
                          : 'hover:bg-accent/50'
                      )}
                      onClick={() => goToBook(book.slug)}
                      onMouseEnter={() => setSelectedIndex(globalIndex)}
                    >
                      {book.coverImage ? (
                        <img
                          src={book.coverImage}
                          alt=""
                          className="w-8 h-12 rounded object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-12 rounded bg-muted flex items-center justify-center flex-shrink-0">
                          <BookOpen className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate"><HighlightMatch text={book.title} query={query} /></p>
                        <p className="text-xs text-muted-foreground truncate"><HighlightMatch text={book.author} query={query} /></p>
                      </div>
                      {book.googleRating > 0 && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                          {book.googleRating}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Category Suggestions */}
            {categories.length > 0 && (
              <div className="p-2 border-t">
                <p className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Categories</p>
                {categories.map((cat) => {
                  const globalIndex = itemCounter;
                  itemCounter++;
                  return (
                    <button
                      key={cat.id}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors',
                        selectedIndex === globalIndex
                          ? 'bg-accent text-accent-foreground'
                          : 'hover:bg-accent/50'
                      )}
                      onClick={() => goToCategory(cat.slug)}
                      onMouseEnter={() => setSelectedIndex(globalIndex)}
                    >
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Tag className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium"><HighlightMatch text={cat.name} query={query} /></p>
                        <p className="text-xs text-muted-foreground">{cat.bookCount} books</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Author Suggestions */}
            {authors.length > 0 && (
              <div className="p-2 border-t">
                <p className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Authors</p>
                {authors.map((author) => {
                  const globalIndex = itemCounter;
                  itemCounter++;
                  return (
                    <button
                      key={author.name}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors',
                        selectedIndex === globalIndex
                          ? 'bg-accent text-accent-foreground'
                          : 'hover:bg-accent/50'
                      )}
                      onClick={() => goToAuthor(author.slug)}
                      onMouseEnter={() => setSelectedIndex(globalIndex)}
                    >
                      {author.imageUrl ? (
                        <img src={author.imageUrl} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
                          <User className="h-4 w-4 text-indigo-500" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium"><HighlightMatch text={author.name} query={query} /></p>
                        <p className="text-xs text-muted-foreground">{author.bookCount} {author.bookCount === 1 ? 'book' : 'books'}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* View All Results */}
            {query.trim() && (
              <div className="p-2 border-t">
                {(() => {
                  const globalIndex = itemCounter;
                  itemCounter++;
                  return (
                    <button
                      className={cn(
                        'w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left font-medium text-sm transition-colors',
                        selectedIndex === globalIndex
                          ? 'bg-accent text-accent-foreground'
                          : 'hover:bg-accent/50 text-primary'
                      )}
                      onClick={() => goToSearch()}
                      onMouseEnter={() => setSelectedIndex(globalIndex)}
                    >
                      <span>View all results for "{query}"</span>
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Keyboard hint */}
          <div className="px-3 py-2 border-t bg-muted/30 flex items-center gap-4 text-[11px] text-muted-foreground">
            <span><kbd className="px-1 py-0.5 rounded bg-muted border text-[10px]">↑↓</kbd> Navigate</span>
            <span><kbd className="px-1 py-0.5 rounded bg-muted border text-[10px]">Enter</kbd> Select</span>
            <span><kbd className="px-1 py-0.5 rounded bg-muted border text-[10px]">Esc</kbd> Close</span>
          </div>
        </div>
      )}

      {/* No results */}
      {isOpen && !loading && books.length === 0 && categories.length === 0 && authors.length === 0 && query.trim().length >= 2 && (
        <div className={cn(
          'absolute left-0 right-0 mt-2 bg-popover border rounded-xl shadow-xl z-50 p-6 text-center',
        )}>
          <Search className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-sm font-medium">No results for "{query}"</p>
          <p className="text-xs text-muted-foreground mt-1">Try a different spelling or broader search term</p>
          <button
            className="mt-3 text-xs text-primary hover:underline"
            onClick={() => goToSearch()}
          >
            Search full catalog →
          </button>
        </div>
      )}
    </div>
  );
}
