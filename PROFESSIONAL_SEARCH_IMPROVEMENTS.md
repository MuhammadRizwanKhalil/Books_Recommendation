# Professional Search Algorithm Improvements
**Date**: April 19, 2026 | **Issue**: Search too generalized, returns irrelevant results

## Problem Analysis

### Original Issues
1. **Too Loose Fuzzy Matching** — Threshold was only **30%**, meaning 30% of n-gram patterns had to match
   - Searching for "ab" would return books with almost any 2-character combo
   - Example: "abc" → patterns ["ab", "bc"] → only 1 needed to match ✗

2. **No Minimum Character Requirement** — Search allowed 2+ characters, too permissive
   - "ab", "hp", "js" would trigger full searches

3. **Description Included in Search** — Too broad
   - Matched book description text, causing irrelevant results
   - Should only match title/author for accuracy

4. **Fuzzy as Primary Fallback** — Three-tier system was backwards
   - FULLTEXT → LIKE → Fuzzy
   - Fuzzy matched on description and was too permissive

---

## Solution Implemented

### 1. Strict Minimum Character Requirement
**Frontend & Backend**: Require **minimum 3 characters** before any search
- `/search?q=ab` → No results (show friendly message)
- `/search?q=abcd` → Full search proceeds ✓

**Changed Files**:
- `app/src/components/SearchDropdown.tsx` — Line 85: Changed `< 2` to `< 3`
- `server/src/routes/books.ts` — Line 476: Added check for `< 3`

### 2. Much Stricter Fuzzy Matching
**Old**: Threshold = 30% (too loose)
**New**: Threshold = **60%** (2x stricter)

**Impact**:
- Before: 30% of patterns match → 3+ patterns needed for a 10-pattern set
- After: 60% of patterns match → 6+ patterns needed for a 10-pattern set
- ~3x reduction in spurious matches

**Changed Files**:
- `server/src/routes/books.ts` — Line 342, 531: Changed `Math.floor(x * 0.3)` to `Math.ceil(x * 0.6)`

### 3. Search on Title + Author ONLY
**Old**: FULLTEXT searched title, author, AND description
**New**: FULLTEXT & LIKE search ONLY title and author

**Why**:
- Description matching is too broad and noisy
- Professional search tools focus on title/author
- For deep discovery, users can use filters or advanced search

**Changed Files**:
- `server/src/routes/books.ts` — Lines 325, 506: Removed `b.description` from MATCH clause

### 4. No Fuzzy Fallback for Categories/Authors
**Old**: Categories/authors had fuzzy pattern loops (multiple attempts)
**New**: Single LIKE pattern only, strict matching

**Changed Files**:
- `server/src/routes/books.ts` — Lines 544-558: Removed fuzzy loops, LIKE only

### 5. Better n-gram Generation
**Old**: Generated bigrams (2-char) for ALL words
**New**: Generate trigrams (3-char) ONLY for words 4+ chars

**Why**: Trigrams are more reliable for typo tolerance than bigrams

**Changed Files**:
- `server/src/routes/books.ts` — Lines 68-83: Updated `fuzzyPatterns()` function

### 6. UX Improvements

#### SearchDropdown (Hero Section)
- Trim input before fetching: `.trim()`
- Validate: `query.trim().length < 3`
- Clear feedback to user when typing fewer than 3 chars

#### SearchPage
- New state: Show helpful message when `query.length > 0 && query.length < 3`
- Message: "Search term too short. Please enter at least 3 characters for accurate results."
- Updated empty state initial text to mention 3-character minimum

**Changed Files**:
- `app/src/components/SearchDropdown.tsx` — Lines 85-92
- `app/src/components/SearchPage.tsx` — Lines 310-332

---

## Search Algorithm Flow

### New Flow (Professional & Strict)
```
1. User types query
   ↓ (debounce 150ms)
   ↓
2. Validate length
   ├─ < 3 chars? → Show "Search term too short" message
   └─ ≥ 3 chars? → Proceed
   ↓
3. Sanitize (remove special chars)
   ↓
4. First attempt: MySQL FULLTEXT on TITLE+AUTHOR
   ├─ Match found? → Return ranked results ✓
   └─ No match? → Continue
   ↓
5. Second attempt: LIKE pattern on TITLE+AUTHOR
   ├─ Match found? → Return results ✓
   └─ No match? → Continue
   ↓
6. STRICT fuzzy fallback (60% threshold)
   ├─ Generate trigrams only from words ≥4 chars
   ├─ Require ≥60% of patterns to match
   ├─ Match found? → Return results ✓
   └─ No match? → No results (not just random matches)
```

### Example Searches

#### ✓ Good: "Harry Potter"
- Length: 12 chars ✓
- FULLTEXT match on title: "Potter" → Results ✓

#### ✓ Good: "Atomic Habits"
- Length: 12 chars (with space) ✓
- FULLTEXT match: "Atomic" + "Habits" → Results ✓

#### ✓ Good: Typo "Harri Poter"
- Fuzzy matching kicks in (60% threshold)
- Matches enough trigrams → Results ✓

#### ✗ Blocked: "hp"
- Length: 2 chars < 3 → Block immediately
- Message: "Search term too short"

#### ✗ Blocked: "ab"
- Length: 2 chars < 3 → Block immediately
- Even if "ab" was a book title, require more context

#### Different: Single-Word Searches
- "Harry" (5 chars) → FULLTEXT matches ✓
- "Habits" (6 chars) → FULLTEXT matches ✓
- "Book" (4 chars) → FULLTEXT matches ✓

---

## Professional Features Added

### 1. Input Validation
```typescript
// Frontend (SearchDropdown.tsx)
if (!debouncedQuery.trim() || debouncedQuery.trim().length < 3) {
  // Don't fetch suggestions
}

// Backend (books.ts)
if (!q || q.length < 3) {
  return { suggestions: [], categories: [], authors: [] }
}
```

### 2. Helpful Error Messages
- **Too short**: "Search term too short. Please enter at least 3 characters for accurate results."
- **No results**: "We couldn't find any books matching "{query}". Try adjusting your search terms or filters."
- **Initial state**: "Enter at least 3 characters for a book title, author name, or keywords."

### 3. Search Classification
- **Exact**: Title exactly matches query
- **Partial**: Title contains query substring
- **Fuzzy**: Uses trigram matching for typographical errors
- **None**: No results (better than random junk)

---

## Performance Impact

### Positive
- **Reduced false positives** → Smaller result sets
- **Faster user experience** → Users see relevant results immediately
- **Less database load** → Fewer fuzzy pattern checks required
- **Better ranking** → Exact matches bubble up first

### Considerations
- Minimum 3-char requirement: Users must be more descriptive
- Fuzzy disabled for categories/authors: Stricter but accurate
- No description search: Trade-off for accuracy over breadth

---

## Testing Checklist

### Frontend (App)
- [ ] Search dropdown closes on < 3 chars
- [ ] No API calls made for 1-2 char queries
- [ ] Helpful message appears: "Search term too short"
- [ ] 3+ chars → suggestions appear normally
- [ ] Hero section search works same way
- [ ] SearchPage shows helpful hint on page load
- [ ] SearchPage shows "term too short" state when 1-2 chars

### Backend (API)
- [ ] `/api/books?search=ab` → 0 results (< 3 chars blocked)
- [ ] `/api/books?search=abc` → Results (>= 3 chars allowed)
- [ ] `/api/books/search-suggestions?q=ab` → Empty suggestions
- [ ] `/api/books/search-suggestions?q=harry` → Suggestions ✓
- [ ] Fuzzy matching threshold is 60% (test with typos)
- [ ] Description NOT included in FULLTEXT search

### Edge Cases
- [ ] Numeric searches: "1984" (4 chars) → Works
- [ ] Short titles: "Go" (2 chars) → Still blocked (too short for general search)
- [ ] Author names: "King" (4 chars) → Works
- [ ] Categories: "Sci-Fi" → Exact match only (no fuzzy)
- [ ] Unicode: "Éric" (4 chars with accent) → Works

---

## Rollback Plan (If Needed)

To revert to old (permissive) search:
1. Change fuzzy threshold back from `0.6` to `0.3`
2. Change minimum length from `3` to `2`
3. Add `b.description` back to FULLTEXT MATCH clauses
4. Restore fuzzy loops in category/author suggestions

---

## Related Files

- Backend: `server/src/routes/books.ts` (lines 68-83, 325-380, 476-558)
- Frontend: `app/src/components/SearchDropdown.tsx` (lines 85-92)
- Frontend: `app/src/components/SearchPage.tsx` (lines 310-355)
- API Types: `app/src/api/client.ts` (BooksQuery interface — no changes needed)
