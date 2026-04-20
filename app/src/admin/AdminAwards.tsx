import { useMemo, useState } from 'react';
import { Plus, Trophy, Tag, BookOpen, Send } from 'lucide-react';
import { toast } from 'sonner';
import { adminApi, booksApi, choiceAwardsApi } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function AdminAwards() {
  const defaultYear = new Date().getFullYear();

  const [year, setYear] = useState(defaultYear);
  const [nominationStart, setNominationStart] = useState(`${defaultYear}-09-01`);
  const [nominationEnd, setNominationEnd] = useState(`${defaultYear}-10-01`);
  const [votingStart, setVotingStart] = useState(`${defaultYear}-10-02`);
  const [votingEnd, setVotingEnd] = useState(`${defaultYear}-11-15`);
  const [isActive, setIsActive] = useState(true);

  const [awardId, setAwardId] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [displayOrder, setDisplayOrder] = useState(0);
  const [categoryId, setCategoryId] = useState('');
  const [bookQuery, setBookQuery] = useState('');
  const [bookId, setBookId] = useState('');
  const [bookSuggestions, setBookSuggestions] = useState<any[]>([]);

  const [loadingBooks, setLoadingBooks] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const canCreateAward = useMemo(
    () => nominationStart && nominationEnd && votingStart && votingEnd,
    [nominationStart, nominationEnd, votingStart, votingEnd],
  );

  async function createAwardYear() {
    try {
      const res = await adminApi.createAwardYear({
        year,
        nominationStart,
        nominationEnd,
        votingStart,
        votingEnd,
        isActive,
      });
      setAwardId(res.award.id);
      toast.success('Award year created');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create award year');
    }
  }

  async function createCategory() {
    if (!awardId || !categoryName.trim()) {
      toast.error('Award ID and category name are required');
      return;
    }
    try {
      const res = await adminApi.createAwardCategory(awardId, {
        name: categoryName.trim(),
        displayOrder,
      });
      setCategoryId(res.category.id);
      setCategoryName('');
      toast.success('Category created');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create category');
    }
  }

  async function searchBooks(q: string) {
    setBookQuery(q);
    if (q.trim().length < 2) {
      setBookSuggestions([]);
      return;
    }
    setLoadingBooks(true);
    try {
      const result = await booksApi.search({ query: q.trim(), limit: 8 });
      setBookSuggestions(result.books || []);
    } catch {
      setBookSuggestions([]);
    } finally {
      setLoadingBooks(false);
    }
  }

  async function addNominee() {
    if (!categoryId || !bookId) {
      toast.error('Category ID and Book ID are required');
      return;
    }
    try {
      await adminApi.createAwardNominee(categoryId, { bookId, isOfficial: true });
      setBookId('');
      setBookQuery('');
      setBookSuggestions([]);
      toast.success('Nominee added');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to add nominee');
    }
  }

  async function publishResults() {
    if (!awardId) {
      toast.error('Award ID is required');
      return;
    }
    try {
      setPublishing(true);
      await adminApi.publishAwardResults(awardId);
      toast.success('Results published');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to publish results');
    } finally {
      setPublishing(false);
    }
  }

  async function previewAwardsPage() {
    try {
      await choiceAwardsApi.getByYear(year);
      toast.success(`Public awards page for ${year} is available`);
    } catch (err: any) {
      toast.error(err?.message || 'Public awards page not available');
    }
  }

  return (
    <div className="space-y-6" data-testid="admin-awards-page">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl sm:text-3xl font-bold">Annual Choice Awards</h1>
        <Button variant="outline" onClick={() => void previewAwardsPage()}>
          <Trophy className="h-4 w-4 mr-2" /> Preview Public Page
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Create Award Year</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1"><Label htmlFor="award-year">Year</Label><Input id="award-year" type="number" value={year} onChange={(e) => setYear(Number(e.target.value || defaultYear))} /></div>
          <div className="space-y-1"><Label htmlFor="award-active">Active (1/0)</Label><Input id="award-active" value={isActive ? '1' : '0'} onChange={(e) => setIsActive(e.target.value === '1')} /></div>
          <div className="space-y-1"><Label htmlFor="nom-start">Nomination Start</Label><Input id="nom-start" type="date" value={nominationStart} onChange={(e) => setNominationStart(e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="nom-end">Nomination End</Label><Input id="nom-end" type="date" value={nominationEnd} onChange={(e) => setNominationEnd(e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="vote-start">Voting Start</Label><Input id="vote-start" type="date" value={votingStart} onChange={(e) => setVotingStart(e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="vote-end">Voting End</Label><Input id="vote-end" type="date" value={votingEnd} onChange={(e) => setVotingEnd(e.target.value)} /></div>
          <div className="sm:col-span-2">
            <Button onClick={() => void createAwardYear()} disabled={!canCreateAward} data-testid="admin-awards-create-year">
              <Plus className="h-4 w-4 mr-2" /> Create Award Year
            </Button>
          </div>
          {awardId && <p className="sm:col-span-2 text-sm text-muted-foreground">Award ID: {awardId}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Create Category</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1"><Label htmlFor="cat-award-id">Award ID</Label><Input id="cat-award-id" value={awardId} onChange={(e) => setAwardId(e.target.value)} /></div>
            <div className="space-y-1"><Label htmlFor="cat-name">Category Name</Label><Input id="cat-name" value={categoryName} onChange={(e) => setCategoryName(e.target.value)} placeholder="Best Fiction" /></div>
            <div className="space-y-1"><Label htmlFor="cat-order">Display Order</Label><Input id="cat-order" type="number" value={displayOrder} onChange={(e) => setDisplayOrder(Number(e.target.value || 0))} /></div>
          </div>
          <Button onClick={() => void createCategory()} data-testid="admin-awards-create-category">
            <Tag className="h-4 w-4 mr-2" /> Add Category
          </Button>
          {categoryId && <p className="text-sm text-muted-foreground">Category ID: {categoryId}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Add Nominee</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1"><Label htmlFor="nominee-category">Category ID</Label><Input id="nominee-category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} /></div>
            <div className="space-y-1"><Label htmlFor="nominee-book-id">Book ID</Label><Input id="nominee-book-id" value={bookId} onChange={(e) => setBookId(e.target.value)} /></div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="nominee-search">Search Book</Label>
            <Input id="nominee-search" value={bookQuery} onChange={(e) => void searchBooks(e.target.value)} placeholder="Search by title" />
            {loadingBooks && <p className="text-xs text-muted-foreground">Searching...</p>}
            {bookSuggestions.length > 0 && (
              <div className="border rounded-lg p-2 space-y-2 max-h-52 overflow-auto" data-testid="admin-awards-book-search-results">
                {bookSuggestions.map((book) => (
                  <button
                    type="button"
                    key={book.id}
                    className="w-full text-left rounded-md px-2 py-1.5 hover:bg-muted text-sm"
                    onClick={() => setBookId(book.id)}
                  >
                    {book.title} <span className="text-muted-foreground">by {book.author}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <Button onClick={() => void addNominee()} data-testid="admin-awards-add-nominee">
            <BookOpen className="h-4 w-4 mr-2" /> Add Nominee
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Publish Results</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">This will mark winners by highest vote count in each category and set results as published.</p>
          <Button onClick={() => void publishResults()} disabled={publishing} data-testid="admin-awards-publish-results">
            <Send className="h-4 w-4 mr-2" /> {publishing ? 'Publishing...' : 'Publish Results'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
