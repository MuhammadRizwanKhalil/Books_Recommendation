/**
 * This file previously contained hardcoded mock/dummy data (24 fake books,
 * 8 fake categories, 6 fake authors, 4 fake blog posts, 4 fake testimonials).
 *
 * All mock data has been removed. The application now relies entirely on the
 * backend API for real data. If the API is unavailable, the frontend will
 * show proper empty states rather than fake placeholder content.
 */

import type { Book, Category, BlogPost } from '@/types';

// ── Empty exports (kept for backward-compatibility with any remaining imports) ──

export const books: Book[] = [];
export const categories: Category[] = [];
export const blogPosts: BlogPost[] = [];
export const testimonials: { id: string; name: string; role: string; text: string; avatar: string; rating: number }[] = [];

export function getTrendingBooks(_limit: number = 6): Book[] { return []; }
export function getNewReleases(_limit: number = 6): Book[] { return []; }
export function getTopRated(_limit: number = 6): Book[] { return []; }
export function getRecommendations(_bookId: string, _limit: number = 6): Book[] { return []; }
export function searchBooks(_query: string, _filters?: any): Book[] { return []; }
export function getBooksByCategory(_categorySlug: string): Book[] { return []; }
export function getBookBySlug(_slug: string): Book | undefined { return undefined; }
export function getAllUniqueCategories(): string[] { return []; }
