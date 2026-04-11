/**
 * Seed script â€” reads static data from the frontend and populates the MySQL database.
 * Run with: npm run seed
 *
 * âš ï¸  This drops ALL tables and recreates them â€” NEVER run in production!
 */
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { config } from './config.js';
import { dbGet, dbAll, dbRun, initPool, initDatabase, closePool } from './database.js';

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// â”€â”€ Categories â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const categories = [
  { id: '1', name: 'Fiction', slug: 'fiction', description: 'Explore imaginary worlds and compelling narratives', imageUrl: 'https://images.unsplash.com/photo-1474932430478-367dbb6832c1?w=400&h=300&fit=crop', bookCount: 0 },
  { id: '2', name: 'Business', slug: 'business', description: 'Learn from industry leaders and entrepreneurs', imageUrl: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=400&h=300&fit=crop', bookCount: 0 },
  { id: '3', name: 'Technology', slug: 'technology', description: 'Stay ahead with the latest tech insights', imageUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&h=300&fit=crop', bookCount: 0 },
  { id: '4', name: 'Self-Help', slug: 'self-help', description: 'Transform your life with proven strategies', imageUrl: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=400&h=300&fit=crop', bookCount: 0 },
  { id: '5', name: 'Science', slug: 'science', description: 'Discover the wonders of scientific exploration', imageUrl: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=400&h=300&fit=crop', bookCount: 0 },
  { id: '6', name: 'History', slug: 'history', description: 'Journey through time and civilizations', imageUrl: 'https://images.unsplash.com/photo-1461360370896-922624d12aa1?w=400&h=300&fit=crop', bookCount: 0 },
  { id: '7', name: 'Psychology', slug: 'psychology', description: 'Understand the human mind and behavior', imageUrl: 'https://images.unsplash.com/photo-1507925921958-8a62f3d1a50d?w=400&h=300&fit=crop', bookCount: 0 },
  { id: '8', name: 'Biography', slug: 'biography', description: 'Real stories of extraordinary people', imageUrl: 'https://images.unsplash.com/photo-1529473814998-077b4fec6770?w=400&h=300&fit=crop', bookCount: 0 },
];

// Category name â†’ id lookup
const catNameToId: Record<string, string> = {};
for (const c of categories) catNameToId[c.name] = c.id;

// â”€â”€ Books â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const books = [
  { id: '1', googleBooksId: 'gb1', isbn10: '0735211299', isbn13: '9780735211292', slug: 'atomic-habits-james-clear', title: 'Atomic Habits', subtitle: 'An Easy & Proven Way to Build Good Habits & Break Bad Ones', author: 'James Clear', description: 'No matter your goals, Atomic Habits offers a proven framework for improving--every day. James Clear, one of the world\'s leading experts on habit formation, reveals practical strategies that will teach you exactly how to form good habits, break bad ones, and master the tiny behaviors that lead to remarkable results.', coverImage: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400&h=600&fit=crop', publisher: 'Avery', publishedDate: '2018-10-16', pageCount: 320, language: 'en', categories: ['Self-Help', 'Business'], googleRating: 4.8, ratingsCount: 87542, computedScore: 92.5, price: 16.99, currency: 'USD', amazonUrl: 'https://www.amazon.com/dp/0735211299?tag=thebooktimes-20', status: 'PUBLISHED' },
  { id: '2', googleBooksId: 'gb2', isbn10: '0062457713', isbn13: '9780062457714', slug: 'the-subtle-art-of-not-giving-a-fck', title: 'The Subtle Art of Not Giving a F*ck', subtitle: 'A Counterintuitive Approach to Living a Good Life', author: 'Mark Manson', description: 'In this generation-defining self-help guide, a superstar blogger cuts through the crap to show us how to stop trying to be "positive" all the time so that we can truly become better, happier people.', coverImage: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=400&h=600&fit=crop', publisher: 'Harper', publishedDate: '2016-09-13', pageCount: 224, language: 'en', categories: ['Self-Help', 'Psychology'], googleRating: 4.6, ratingsCount: 65432, computedScore: 88.3, price: 14.99, currency: 'USD', amazonUrl: 'https://www.amazon.com/dp/0062457713?tag=thebooktimes-20', status: 'PUBLISHED' },
  { id: '3', googleBooksId: 'gb3', isbn10: '1612680194', isbn13: '9781612680194', slug: 'rich-dad-poor-dad-robert-kiyosaki', title: 'Rich Dad Poor Dad', subtitle: 'What the Rich Teach Their Kids About Money That the Poor and Middle Class Do Not!', author: 'Robert T. Kiyosaki', description: 'Rich Dad Poor Dad is Robert\'s story of growing up with two dads â€” his real father and the father of his best friend, his rich dad â€” and the ways in which both men shaped his thoughts about money and investing.', coverImage: 'https://images.unsplash.com/photo-1592496431122-2349e0fbc666?w=400&h=600&fit=crop', publisher: 'Plata Publishing', publishedDate: '1997-04-01', pageCount: 336, language: 'en', categories: ['Business', 'Self-Help'], googleRating: 4.7, ratingsCount: 54321, computedScore: 90.1, price: 12.99, currency: 'USD', amazonUrl: 'https://www.amazon.com/dp/1612680194?tag=thebooktimes-20', status: 'PUBLISHED' },
  { id: '4', googleBooksId: 'gb4', isbn10: '0062316117', isbn13: '9780062316110', slug: 'sapiens-yuval-noah-harari', title: 'Sapiens', subtitle: 'A Brief History of Humankind', author: 'Yuval Noah Harari', description: 'From a renowned historian comes a groundbreaking narrative of humanity\'s creation and evolutionâ€”a #1 international bestsellerâ€”that explores the ways in which biology and history have defined us.', coverImage: 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?w=400&h=600&fit=crop', publisher: 'Harper', publishedDate: '2015-02-10', pageCount: 464, language: 'en', categories: ['History', 'Science'], googleRating: 4.7, ratingsCount: 78901, computedScore: 91.2, price: 18.99, currency: 'USD', amazonUrl: 'https://www.amazon.com/dp/0062316117?tag=thebooktimes-20', status: 'PUBLISHED' },
  { id: '5', googleBooksId: 'gb5', isbn10: '1455586692', isbn13: '9781455586691', slug: 'deep-work-cal-newport', title: 'Deep Work', subtitle: 'Rules for Focused Success in a Distracted World', author: 'Cal Newport', description: 'Deep work is the ability to focus without distraction on a cognitively demanding task. Cal Newport flips the narrative on impact in a connected age.', coverImage: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=400&h=600&fit=crop', publisher: 'Grand Central Publishing', publishedDate: '2016-01-05', pageCount: 296, language: 'en', categories: ['Self-Help', 'Business', 'Technology'], googleRating: 4.6, ratingsCount: 34567, computedScore: 87.8, price: 15.99, currency: 'USD', amazonUrl: 'https://www.amazon.com/dp/1455586692?tag=thebooktimes-20', status: 'PUBLISHED' },
  { id: '6', googleBooksId: 'gb6', isbn10: '0525538585', isbn13: '9780525538585', slug: 'thinking-fast-and-slow-daniel-kahneman', title: 'Thinking, Fast and Slow', subtitle: null, author: 'Daniel Kahneman', description: 'In the international bestseller, Thinking, Fast and Slow, Daniel Kahneman, the renowned psychologist and winner of the Nobel Prize in Economics, takes us on a groundbreaking tour of the mind.', coverImage: 'https://images.unsplash.com/photo-1509021436665-8f07dbf5bf1d?w=400&h=600&fit=crop', publisher: 'Farrar, Straus and Giroux', publishedDate: '2011-10-25', pageCount: 499, language: 'en', categories: ['Psychology', 'Science', 'Business'], googleRating: 4.5, ratingsCount: 42345, computedScore: 86.5, price: 17.99, currency: 'USD', amazonUrl: 'https://www.amazon.com/dp/0374533555?tag=thebooktimes-20', status: 'PUBLISHED' },
  { id: '7', googleBooksId: 'gb7', isbn10: '0439708184', isbn13: '9780439708180', slug: 'harry-potter-sorcerers-stone', title: "Harry Potter and the Sorcerer's Stone", subtitle: null, author: 'J.K. Rowling', description: 'Harry Potter has no idea how famous he is. Rescued from the outrageous neglect of his aunt and uncle, a young boy with a great destiny proves his worth while attending Hogwarts School of Witchcraft and Wizardry.', coverImage: 'https://images.unsplash.com/photo-1618666012174-83b441c0bc76?w=400&h=600&fit=crop', publisher: 'Scholastic', publishedDate: '1997-06-26', pageCount: 309, language: 'en', categories: ['Fiction'], googleRating: 4.8, ratingsCount: 120456, computedScore: 94.1, price: 12.99, currency: 'USD', amazonUrl: 'https://www.amazon.com/dp/0439708184?tag=thebooktimes-20', status: 'PUBLISHED' },
  { id: '8', googleBooksId: 'gb8', isbn10: '0307465357', isbn13: '9780307465351', slug: 'the-lean-startup-eric-ries', title: 'The Lean Startup', subtitle: 'How Constant Innovation Creates Radically Successful Businesses', author: 'Eric Ries', description: 'Eric Ries defines a startup as an organization dedicated to creating something new under conditions of extreme uncertainty. This is a principled approach to new product development.', coverImage: 'https://images.unsplash.com/photo-1553729459-afe8f2e2ed65?w=400&h=600&fit=crop', publisher: 'Currency', publishedDate: '2011-09-13', pageCount: 336, language: 'en', categories: ['Business', 'Technology'], googleRating: 4.5, ratingsCount: 28765, computedScore: 85.2, price: 15.99, currency: 'USD', amazonUrl: 'https://www.amazon.com/dp/0307887898?tag=thebooktimes-20', status: 'PUBLISHED' },
  { id: '9', googleBooksId: 'gb9', isbn10: '0062457896', isbn13: '9780062457899', slug: 'homo-deus-yuval-noah-harari', title: 'Homo Deus', subtitle: 'A Brief History of Tomorrow', author: 'Yuval Noah Harari', description: 'Yuval Noah Harari, author of the critically-acclaimed New York Times bestseller and international phenomenon Sapiens, returns with an equally original, compelling, and provocative book.', coverImage: 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=400&h=600&fit=crop', publisher: 'Harper', publishedDate: '2017-02-21', pageCount: 464, language: 'en', categories: ['Science', 'History'], googleRating: 4.4, ratingsCount: 34567, computedScore: 84.3, price: 16.99, currency: 'USD', amazonUrl: 'https://www.amazon.com/dp/0062464310?tag=thebooktimes-20', status: 'PUBLISHED' },
  { id: '10', googleBooksId: 'gb10', isbn10: '0143127551', isbn13: '9780143127550', slug: 'the-power-of-habit-charles-duhigg', title: 'The Power of Habit', subtitle: 'Why We Do What We Do in Life and Business', author: 'Charles Duhigg', description: 'In The Power of Habit, award-winning business reporter Charles Duhigg takes us to the thrilling edge of scientific discoveries that explain why habits exist and how they can be changed.', coverImage: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=400&h=600&fit=crop', publisher: 'Random House', publishedDate: '2012-02-28', pageCount: 371, language: 'en', categories: ['Psychology', 'Self-Help'], googleRating: 4.5, ratingsCount: 45678, computedScore: 86.7, price: 14.99, currency: 'USD', amazonUrl: 'https://www.amazon.com/dp/081298160X?tag=thebooktimes-20', status: 'PUBLISHED' },
  { id: '11', googleBooksId: 'gb11', isbn10: '0062315007', isbn13: '9780062315007', slug: 'the-alchemist-paulo-coelho', title: 'The Alchemist', subtitle: null, author: 'Paulo Coelho', description: 'Paulo Coelho\'s masterwork tells the mystical story of Santiago, an Andalusian shepherd boy who yearns to travel in search of a worldly treasure.', coverImage: 'https://images.unsplash.com/photo-1531988042231-d39a9cc12a9a?w=400&h=600&fit=crop', publisher: 'HarperOne', publishedDate: '1988-01-01', pageCount: 197, language: 'en', categories: ['Fiction', 'Self-Help'], googleRating: 4.6, ratingsCount: 98765, computedScore: 89.1, price: 11.99, currency: 'USD', amazonUrl: 'https://www.amazon.com/dp/0062315005?tag=thebooktimes-20', status: 'PUBLISHED' },
  { id: '12', googleBooksId: 'gb12', isbn10: '1591847818', isbn13: '9781591847816', slug: 'zero-to-one-peter-thiel', title: 'Zero to One', subtitle: 'Notes on Startups, or How to Build the Future', author: 'Peter Thiel', description: 'The great secret of our time is that there are still uncharted frontiers to explore and new inventions to create. Peter Thiel shows how we can find singular ways to create truly new things.', coverImage: 'https://images.unsplash.com/photo-1543286386-2e659306cd6c?w=400&h=600&fit=crop', publisher: 'Currency', publishedDate: '2014-09-16', pageCount: 224, language: 'en', categories: ['Business', 'Technology'], googleRating: 4.5, ratingsCount: 23456, computedScore: 85.8, price: 15.99, currency: 'USD', amazonUrl: 'https://www.amazon.com/dp/0804139296?tag=thebooktimes-20', status: 'PUBLISHED' },
  { id: '13', googleBooksId: 'gb13', isbn10: '0544272994', isbn13: '9780544272996', slug: 'educated-tara-westover', title: 'Educated', subtitle: 'A Memoir', author: 'Tara Westover', description: 'An unforgettable memoir about a young girl who, kept out of school, leaves her survivalist family and goes on to earn a PhD from Cambridge University.', coverImage: 'https://images.unsplash.com/photo-1575936123452-b67c3203c357?w=400&h=600&fit=crop', publisher: 'Random House', publishedDate: '2018-02-20', pageCount: 334, language: 'en', categories: ['Biography', 'Self-Help'], googleRating: 4.7, ratingsCount: 56789, computedScore: 90.5, price: 14.99, currency: 'USD', amazonUrl: 'https://www.amazon.com/dp/0399590501?tag=thebooktimes-20', status: 'PUBLISHED' },
  { id: '14', googleBooksId: 'gb14', isbn10: '0142437204', isbn13: '9780142437209', slug: 'dune-frank-herbert', title: 'Dune', subtitle: null, author: 'Frank Herbert', description: 'Set on the desert planet Arrakis, Dune is the story of the boy Paul Atreides, heir to a noble family tasked with ruling an inhospitable world. A stunning blend of adventure and mysticism, environmentalism and politics.', coverImage: 'https://images.unsplash.com/photo-1621351183012-e2f9972dd9bf?w=400&h=600&fit=crop', publisher: 'Ace', publishedDate: '1965-08-01', pageCount: 688, language: 'en', categories: ['Fiction', 'Science'], googleRating: 4.7, ratingsCount: 67890, computedScore: 91.0, price: 13.99, currency: 'USD', amazonUrl: 'https://www.amazon.com/dp/0441013597?tag=thebooktimes-20', status: 'PUBLISHED' },
  { id: '15', googleBooksId: 'gb15', isbn10: '0399590528', isbn13: '9780399590528', slug: 'becoming-michelle-obama', title: 'Becoming', subtitle: null, author: 'Michelle Obama', description: 'In her memoir, a work of deep reflection and mesmerizing storytelling, Michelle Obama invites readers into her world, chronicling the experiences that have shaped her.', coverImage: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&h=600&fit=crop', publisher: 'Crown', publishedDate: '2018-11-13', pageCount: 448, language: 'en', categories: ['Biography', 'History'], googleRating: 4.8, ratingsCount: 89012, computedScore: 93.2, price: 19.99, currency: 'USD', amazonUrl: 'https://www.amazon.com/dp/1524763136?tag=thebooktimes-20', status: 'PUBLISHED' },
  { id: '16', googleBooksId: 'gb16', isbn10: '0060555661', isbn13: '9780060555665', slug: 'good-to-great-jim-collins', title: 'Good to Great', subtitle: 'Why Some Companies Make the Leap and Others Don\'t', author: 'Jim Collins', description: 'Built to Last, the defining management study of the nineties, showed how great companies triumph over time. Jim Collins asks: Can a good company become a great company?', coverImage: 'https://images.unsplash.com/photo-1550399105-c4db5fb85c18?w=400&h=600&fit=crop', publisher: 'HarperBusiness', publishedDate: '2001-10-16', pageCount: 320, language: 'en', categories: ['Business'], googleRating: 4.5, ratingsCount: 34567, computedScore: 86.3, price: 16.99, currency: 'USD', amazonUrl: 'https://www.amazon.com/dp/0066620996?tag=thebooktimes-20', status: 'PUBLISHED' },
  { id: '17', googleBooksId: 'gb17', isbn10: '0525559477', isbn13: '9780525559474', slug: 'digital-minimalism-cal-newport', title: 'Digital Minimalism', subtitle: 'Choosing a Focused Life in a Noisy World', author: 'Cal Newport', description: 'Cal Newport makes a case for a more intentional approach to technology use, one that values quality over convenience.', coverImage: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=400&h=600&fit=crop', publisher: 'Portfolio', publishedDate: '2019-02-05', pageCount: 304, language: 'en', categories: ['Technology', 'Self-Help'], googleRating: 4.3, ratingsCount: 18932, computedScore: 82.1, price: 14.99, currency: 'USD', amazonUrl: 'https://www.amazon.com/dp/0525536515?tag=thebooktimes-20', status: 'PUBLISHED' },
  { id: '18', googleBooksId: 'gb18', isbn10: '0061120081', isbn13: '9780061120084', slug: 'to-kill-a-mockingbird-harper-lee', title: 'To Kill a Mockingbird', subtitle: null, author: 'Harper Lee', description: 'The unforgettable novel of a childhood in a sleepy Southern town and the crisis of conscience that rocked it. A classic of modern American literature.', coverImage: 'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?w=400&h=600&fit=crop', publisher: 'Harper Perennial', publishedDate: '1960-07-11', pageCount: 336, language: 'en', categories: ['Fiction', 'History'], googleRating: 4.8, ratingsCount: 145678, computedScore: 95.0, price: 9.99, currency: 'USD', amazonUrl: 'https://www.amazon.com/dp/0060935464?tag=thebooktimes-20', status: 'PUBLISHED' },
  { id: '19', googleBooksId: 'gb19', isbn10: '0671027034', isbn13: '9780671027032', slug: 'how-to-win-friends-dale-carnegie', title: 'How to Win Friends and Influence People', subtitle: null, author: 'Dale Carnegie', description: 'Dale Carnegie\'s rock-solid, time-tested advice has carried countless people up the ladder of success in their business and personal lives.', coverImage: 'https://images.unsplash.com/photo-1506880018603-83d5b814b5a6?w=400&h=600&fit=crop', publisher: 'Simon & Schuster', publishedDate: '1936-10-01', pageCount: 288, language: 'en', categories: ['Self-Help', 'Business', 'Psychology'], googleRating: 4.7, ratingsCount: 78901, computedScore: 90.8, price: 12.99, currency: 'USD', amazonUrl: 'https://www.amazon.com/dp/0671027034?tag=thebooktimes-20', status: 'PUBLISHED' },
  { id: '20', googleBooksId: 'gb20', isbn10: '1501111108', isbn13: '9781501111105', slug: 'the-innovators-walter-isaacson', title: 'The Innovators', subtitle: 'How a Group of Hackers, Geniuses, and Geeks Created the Digital Revolution', author: 'Walter Isaacson', description: 'Walter Isaacson tells the stories of the people who created the computer and the Internet, building on the ideas of previous innovators.', coverImage: 'https://images.unsplash.com/photo-1487058792275-0ad4aaf24ca7?w=400&h=600&fit=crop', publisher: 'Simon & Schuster', publishedDate: '2014-10-07', pageCount: 560, language: 'en', categories: ['Technology', 'History', 'Biography'], googleRating: 4.5, ratingsCount: 23456, computedScore: 85.5, price: 17.99, currency: 'USD', amazonUrl: 'https://www.amazon.com/dp/1476708703?tag=thebooktimes-20', status: 'PUBLISHED' },
  { id: '21', googleBooksId: 'gb21', isbn10: '0316769487', isbn13: '9780316769488', slug: 'the-catcher-in-the-rye-jd-salinger', title: 'The Catcher in the Rye', subtitle: null, author: 'J.D. Salinger', description: 'The hero-narrator of The Catcher in the Rye is an ancient child of sixteen, a native New Yorker named Holden Caulfield. Through circumstances largely of his own making, Holden has just been expelled from his fourth school.', coverImage: 'https://images.unsplash.com/photo-1541963463532-d68292c34b19?w=400&h=600&fit=crop', publisher: 'Little, Brown', publishedDate: '1951-07-16', pageCount: 277, language: 'en', categories: ['Fiction'], googleRating: 4.3, ratingsCount: 89012, computedScore: 83.6, price: 10.99, currency: 'USD', amazonUrl: 'https://www.amazon.com/dp/0316769487?tag=thebooktimes-20', status: 'PUBLISHED' },
  { id: '22', googleBooksId: 'gb22', isbn10: '039592720X', isbn13: '9780395927205', slug: '1984-george-orwell', title: '1984', subtitle: null, author: 'George Orwell', description: 'Among the seminal texts of the 20th century, Nineteen Eighty-Four is a rare work that grows more haunting as its dystopian purgatory becomes more real.', coverImage: 'https://images.unsplash.com/photo-1585521551046-4c3eab8f4e06?w=400&h=600&fit=crop', publisher: 'Signet Classic', publishedDate: '1949-06-08', pageCount: 328, language: 'en', categories: ['Fiction', 'Science'], googleRating: 4.7, ratingsCount: 156789, computedScore: 93.8, price: 9.99, currency: 'USD', amazonUrl: 'https://www.amazon.com/dp/0451524934?tag=thebooktimes-20', status: 'PUBLISHED' },
  { id: '23', googleBooksId: 'gb23', isbn10: '043965548X', isbn13: '9780439655484', slug: 'harry-potter-and-the-chamber-of-secrets', title: 'Harry Potter and the Chamber of Secrets', subtitle: null, author: 'J.K. Rowling', description: 'The Dursleys were so mean and hideous that summer that all Harry Potter wanted was to get back to the Hogwarts School for Witchcraft and Wizardry. But just as he\'s packing his bags, Harry receives a warning from a strange, impish creature.', coverImage: 'https://images.unsplash.com/photo-1535666669445-e8ac05d1f637?w=400&h=600&fit=crop', publisher: 'Scholastic', publishedDate: '1998-07-02', pageCount: 341, language: 'en', categories: ['Fiction'], googleRating: 4.7, ratingsCount: 95000, computedScore: 92.0, price: 12.99, currency: 'USD', amazonUrl: 'https://www.amazon.com/dp/0439064872?tag=thebooktimes-20', status: 'PUBLISHED' },
  { id: '24', googleBooksId: 'gb24', isbn10: '0062457744', isbn13: '9780062457745', slug: 'outliers-malcolm-gladwell', title: 'Outliers', subtitle: 'The Story of Success', author: 'Malcolm Gladwell', description: 'In this stunning new book, Malcolm Gladwell takes us on an intellectual journey through the world of outliers â€” the best and the brightest, the most famous and the most successful.', coverImage: 'https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=400&h=600&fit=crop', publisher: 'Little, Brown', publishedDate: '2008-11-18', pageCount: 336, language: 'en', categories: ['Psychology', 'Business', 'Science'], googleRating: 4.4, ratingsCount: 45678, computedScore: 84.9, price: 14.99, currency: 'USD', amazonUrl: 'https://www.amazon.com/dp/0316017930?tag=thebooktimes-20', status: 'PUBLISHED' },
];

// â”€â”€ Authors â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Extract unique authors and create records in the authors table

const authorBios: Record<string, string> = {
  'James Clear': 'James Clear is an author, speaker, and expert on habits and decision making. His work has appeared in the New York Times, Time, and the Wall Street Journal.',
  'Mark Manson': 'Mark Manson is a #1 New York Times bestselling author and blogger known for his brutally honest and practical approach to self-improvement.',
  'Robert T. Kiyosaki': 'Robert Kiyosaki is an entrepreneur, educator, and investor best known for Rich Dad Poor Dad, the #1 personal finance book of all time.',
  'Yuval Noah Harari': 'Yuval Noah Harari is an Israeli historian and professor at the Hebrew University of Jerusalem. He is the author of the international bestsellers Sapiens and Homo Deus.',
  'Cal Newport': 'Cal Newport is a computer science professor at Georgetown University and a New York Times bestselling author of books on technology and productivity.',
  'Daniel Kahneman': 'Daniel Kahneman is a Nobel Prize-winning psychologist and economist known for his groundbreaking work on judgment, decision-making, and behavioral economics.',
  'J.K. Rowling': 'J.K. Rowling is the beloved author of the Harry Potter series, one of the most successful literary franchises in history.',
  'Eric Ries': 'Eric Ries is an entrepreneur, blogger, and author of The Lean Startup. He is a frequent speaker at business events and advises startups and venture capital firms.',
  'Charles Duhigg': 'Charles Duhigg is a Pulitzer Prize-winning journalist and author who has written extensively about the science of habit formation and productivity.',
  'Paulo Coelho': 'Paulo Coelho is a Brazilian lyricist and novelist, best known for his novel The Alchemist. He has sold over 350 million copies of his works worldwide.',
  'Peter Thiel': 'Peter Thiel is an entrepreneur, venture capitalist, and co-founder of PayPal and Palantir Technologies. He is a contrarian thinker on startups and innovation.',
  'Tara Westover': 'Tara Westover is an American author and historian. Her memoir Educated chronicles her journey from growing up in a survivalist family to earning a PhD from Cambridge.',
  'Frank Herbert': 'Frank Herbert was an American science fiction author best known for Dune, widely regarded as the greatest science fiction novel ever written.',
  'Michelle Obama': 'Michelle Obama is an American attorney and author who served as the First Lady of the United States from 2009 to 2017.',
  'Jim Collins': 'Jim Collins is a researcher, author, and speaker on the subject of business management and company sustainability. He has authored several bestselling books.',
  'Harper Lee': 'Harper Lee was an American novelist best known for her 1960 novel To Kill a Mockingbird, which won the Pulitzer Prize.',
  'Dale Carnegie': 'Dale Carnegie was an American writer and lecturer, and the developer of courses in self-improvement, salesmanship, and interpersonal skills.',
  'Walter Isaacson': 'Walter Isaacson is a Professor of History at Tulane University and a bestselling biographer who has written about Steve Jobs, Einstein, and Benjamin Franklin.',
  'J.D. Salinger': 'J.D. Salinger was an American writer known for his novel The Catcher in the Rye, a classic coming-of-age story.',
  'George Orwell': 'George Orwell was an English novelist, essayist, and critic famous for his novels Animal Farm and Nineteen Eighty-Four.',
  'Malcolm Gladwell': 'Malcolm Gladwell is a Canadian journalist, author, and speaker known for his unique ability to find unexpected connections in data and present them in compelling narratives.',
};

// â”€â”€ Blog Posts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const blogPosts = [
  {
    id: 'blog-1',
    title: '10 Must-Read Books for Personal Growth in 2025',
    slug: '10-must-read-books-personal-growth-2025',
    content: 'Looking to transform your life this year? These 10 carefully selected books cover everything from habit formation to mindset shifts. Starting with Atomic Habits by James Clear, which provides a revolutionary framework for building better habits...\n\nThe list continues with Rich Dad Poor Dad by Robert T. Kiyosaki, offering financial wisdom that challenges conventional thinking about money and investing. Deep Work by Cal Newport shows how to thrive in a distracted world by cultivating the ability to focus intensely.\n\nOther notable mentions include The Subtle Art of Not Giving a F*ck by Mark Manson, which takes a refreshingly honest approach to self-improvement, and Educated by Tara Westover, a memoir that demonstrates the transformative power of learning.\n\nThinking, Fast and Slow by Daniel Kahneman rounds out our psychology picks, while Zero to One by Peter Thiel inspires entrepreneurial thinking. The Power of Habit by Charles Duhigg explains the science behind our daily patterns.\n\nFinally, How to Win Friends and Influence People by Dale Carnegie remains timeless in its advice for building meaningful relationships, and Digital Minimalism by Cal Newport offers a much-needed framework for our attention-economy age.',
    excerpt: 'Discover the top 10 books that will transform your personal and professional life this year.',
    featuredImage: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=800&h=400&fit=crop',
    status: 'PUBLISHED',
    publishedAt: '2025-01-15',
    featuredBookIds: ['1', '3', '5'],
  },
  {
    id: 'blog-2',
    title: 'The Science of Reading: How Books Change Your Brain',
    slug: 'science-of-reading-how-books-change-brain',
    content: 'Recent neuroscience research reveals fascinating insights about how reading physically changes our brain structure. Studies using MRI scans have shown that reading activates multiple brain regions simultaneously...\n\nWhen we read fiction, our brains simulate the experiences of characters, strengthening neural pathways associated with empathy and social cognition. This phenomenon, known as "narrative transportation," literally changes how we perceive and interact with the real world.\n\nNon-fiction reading, particularly books like Thinking, Fast and Slow, engages analytical centers in the prefrontal cortex, building cognitive flexibility and critical thinking skills. Regular readers show a 32% slower rate of cognitive decline compared to non-readers.\n\nThe concept of "deep reading" â€” the kind encouraged by Cal Newport in Deep Work â€” creates a state of flow that strengthens attention networks. This is increasingly rare and valuable in our age of digital distraction.\n\nSapiens by Yuval Noah Harari exemplifies how narrative non-fiction can reshape our understanding of entire concepts. Readers report lasting shifts in worldview after engaging with such ambitious works.',
    excerpt: 'New research shows reading literally rewires your neural pathways. Here is what science tells us.',
    featuredImage: 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=800&h=400&fit=crop',
    status: 'PUBLISHED',
    publishedAt: '2025-02-01',
    featuredBookIds: ['6', '5', '4'],
  },
  {
    id: 'blog-3',
    title: 'Building a Reading Habit: Tips from Atomic Habits',
    slug: 'building-reading-habit-atomic-habits-tips',
    content: 'Applying James Clear\'s four laws of behavior change to build a lasting reading habit can transform how much you read. The framework from Atomic Habits is surprisingly effective for bookworms...\n\nFirst Law â€” Make It Obvious: Place books in visible locations around your home. Keep a book on your nightstand, coffee table, and desk. Create "reading cues" that trigger the habit.\n\nSecond Law â€” Make It Attractive: Pair reading with something you enjoy. Read in your favorite chair with a cup of tea, or join a book club to add a social element.\n\nThird Law â€” Make It Easy: Start with just two pages per day. The "Two-Minute Rule" suggests reducing any habit to its simplest form. Once you start, momentum takes over.\n\nFourth Law â€” Make It Satisfying: Track your reading progress. Use a reading journal or app like Goodreads to log completed books. Our recommendation engine can help you find your next great read.\n\nAs Charles Duhigg explains in The Power of Habit, the key is establishing a "habit loop" â€” cue, routine, reward. Once reading becomes automatic, you\'ll find yourself naturally reaching for a book instead of your phone.',
    excerpt: 'Use the proven framework from Atomic Habits to build a consistent reading routine.',
    featuredImage: 'https://images.unsplash.com/photo-1506880018603-83d5b814b5a6?w=800&h=400&fit=crop',
    status: 'PUBLISHED',
    publishedAt: '2025-02-15',
    featuredBookIds: ['1', '10'],
  },
  {
    id: 'blog-4',
    title: 'From Fiction to Finance: Diverse Reading for a Well-Rounded Mind',
    slug: 'fiction-to-finance-diverse-reading',
    content: 'Why reading across genres is the key to developing a well-rounded perspective. Research shows that readers who explore diverse genres demonstrate higher creativity and problem-solving abilities...\n\nFiction develops empathy and emotional intelligence. Books like The Alchemist teach us about the human condition through metaphor, while Harry Potter demonstrates the power of imagination and moral courage.\n\nBusiness and finance books like Rich Dad Poor Dad and Zero to One provide practical frameworks for understanding money and innovation. These analytical reads complement the creative thinking fostered by fiction.\n\nScience and history books like Sapiens and Homo Deus give us the big-picture perspective, helping us understand where humanity has been and where it\'s going. These works challenge our assumptions about progress.\n\nBiographies like Becoming by Michelle Obama and Educated by Tara Westover ground abstract concepts in real human experience. They remind us that behind every theory is a person with a story.\n\nThe ideal reading diet includes roughly 40% non-fiction (split between self-improvement, business, and science) and 60% fiction and narrative non-fiction. This balance keeps your analytical and creative brain in partnership.',
    excerpt: 'Why reading across genres makes you smarter, more creative, and more successful.',
    featuredImage: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=800&h=400&fit=crop',
    status: 'PUBLISHED',
    publishedAt: '2025-03-01',
    featuredBookIds: ['11', '7', '3'],
  },
];

// â”€â”€ Sample Users â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const sampleUsers = [
  { id: 'user-001', email: 'alice@example.com', name: 'Alice Johnson', password: 'password123' },
  { id: 'user-002', email: 'bob@example.com', name: 'Bob Smith', password: 'password123' },
  { id: 'user-003', email: 'carol@example.com', name: 'Carol Williams', password: 'password123' },
  { id: 'user-004', email: 'david@example.com', name: 'David Brown', password: 'password123' },
  { id: 'user-005', email: 'emma@example.com', name: 'Emma Davis', password: 'password123' },
];

// â”€â”€ Sample Reviews â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const sampleReviews = [
  { bookId: '1', userId: 'user-001', userName: 'Alice Johnson', rating: 5, title: 'Life-changing book!', content: 'Atomic Habits completely transformed how I approach personal development. The 1% better every day concept is so powerful and practical. Clear\'s writing is accessible and engaging.' },
  { bookId: '1', userId: 'user-002', userName: 'Bob Smith', rating: 4, title: 'Excellent framework', content: 'Great practical advice on building habits. The four laws of behavior change are easy to understand and apply. Slightly repetitive in places but overall fantastic.' },
  { bookId: '4', userId: 'user-003', userName: 'Carol Williams', rating: 5, title: 'Mind-blowing perspective', content: 'Sapiens gave me a completely new way of looking at human history. Harari connects dots across millennia in ways I never expected. Essential reading for anyone curious about our species.' },
  { bookId: '7', userId: 'user-004', userName: 'David Brown', rating: 5, title: 'Magical experience', content: 'Even as an adult, Harry Potter captivated me from page one. The world-building is incredible, and the themes of friendship and courage resonate at any age.' },
  { bookId: '3', userId: 'user-005', userName: 'Emma Davis', rating: 4, title: 'Changed my financial mindset', content: 'Rich Dad Poor Dad opened my eyes to financial literacy. While some advice is dated, the core principles about assets vs liabilities and passive income are invaluable.' },
  { bookId: '5', userId: 'user-001', userName: 'Alice Johnson', rating: 5, title: 'Essential for knowledge workers', content: 'Deep Work is the antidote to our distracted culture. Cal Newport makes a compelling case for focused work and provides practical rituals to achieve it.' },
  { bookId: '6', userId: 'user-002', userName: 'Bob Smith', rating: 4, title: 'Dense but rewarding', content: 'Thinking, Fast and Slow is not an easy read, but it rewards careful attention. Kahneman\'s insights into cognitive biases have made me a better decision-maker.' },
  { bookId: '11', userId: 'user-003', userName: 'Carol Williams', rating: 5, title: 'Beautiful and inspiring', content: 'The Alchemist is a beautiful fable about following your dreams. Coelho\'s prose is simple yet profound. I\'ve read it three times and discover new meaning each time.' },
  { bookId: '15', userId: 'user-004', userName: 'David Brown', rating: 5, title: 'Inspiring memoir', content: 'Michelle Obama\'s story is both deeply personal and universally inspiring. Her honesty about struggles and triumphs makes this more than just a political memoir.' },
  { bookId: '18', userId: 'user-005', userName: 'Emma Davis', rating: 5, title: 'Timeless classic', content: 'To Kill a Mockingbird remains as relevant today as when it was written. Atticus Finch is one of literature\'s greatest characters. A book everyone should read.' },
  { bookId: '22', userId: 'user-001', userName: 'Alice Johnson', rating: 5, title: 'Frighteningly relevant', content: '1984 feels more prescient every year. Orwell\'s vision of surveillance and thought control is a powerful warning. The prose is stark and unforgettable.' },
  { bookId: '8', userId: 'user-003', userName: 'Carol Williams', rating: 4, title: 'Great for entrepreneurs', content: 'The Lean Startup methodology has influenced how I approach all my projects. The build-measure-learn loop is not just for startups â€” it\'s a mindset.' },
  { bookId: '13', userId: 'user-002', userName: 'Bob Smith', rating: 5, title: 'Unforgettable memoir', content: 'Educated is one of the most compelling memoirs I\'ve ever read. Tara Westover\'s journey from isolation to Cambridge is testament to the power of education.' },
  { bookId: '14', userId: 'user-004', userName: 'David Brown', rating: 5, title: 'Sci-fi masterpiece', content: 'Dune is the gold standard of science fiction. The world-building, political intrigue, and ecological themes are unmatched. Herbert created something truly extraordinary.' },
  { bookId: '19', userId: 'user-005', userName: 'Emma Davis', rating: 4, title: 'Timeless communication advice', content: 'Written decades ago but Carnegie\'s principles for dealing with people are just as applicable today. Some examples are dated but the core wisdom endures.' },
];

// â”€â”€ Newsletter Subscribers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const subscribers = [
  'reader1@example.com', 'bookworm@example.com', 'literati@example.com',
  'pageturner@example.com', 'bibliophile@example.com', 'novelreader@example.com',
  'fiction.fan@example.com', 'techreads@example.com',
];

// â”€â”€ Default Settings â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const DEFAULT_SETTINGS = [
  // General
  { key: 'site_name', value: 'The Book Times', category: 'general', label: 'Site Name', description: 'Name of the website', field_type: 'text', sort_order: 1 },
  { key: 'site_url', value: 'http://localhost:5173', category: 'general', label: 'Site URL', description: 'Public URL of the website', field_type: 'url', sort_order: 2 },
  { key: 'site_tagline', value: 'Discover your next favorite book', category: 'general', label: 'Site Tagline', description: 'Short tagline or slogan', field_type: 'text', sort_order: 3 },
  { key: 'site_description', value: 'The Book Times is a curated platform for book lovers to find, review, and discover new books.', category: 'general', label: 'Site Description', description: 'Short description of the website', field_type: 'textarea', sort_order: 4 },
  { key: 'admin_email', value: process.env.ADMIN_EMAIL || 'admin@thebooktimes.com', category: 'general', label: 'Admin Email', description: 'Primary admin email for receiving notifications', field_type: 'email', sort_order: 5 },
  { key: 'contact_email', value: 'contact@thebooktimes.com', category: 'general', label: 'Contact Email', description: 'Public contact email', field_type: 'email', sort_order: 6 },
  { key: 'items_per_page', value: '20', category: 'general', label: 'Items Per Page', description: 'Default number of items per page', field_type: 'number', sort_order: 7 },
  { key: 'maintenance_mode', value: 'false', category: 'general', label: 'Maintenance Mode', description: 'Enable maintenance mode (disables public access)', field_type: 'boolean', sort_order: 8 },
  // SMTP / Email
  { key: 'smtp_host', value: '', category: 'smtp', label: 'SMTP Host', description: 'e.g. smtp.gmail.com', field_type: 'text', sort_order: 1 },
  { key: 'smtp_port', value: '587', category: 'smtp', label: 'SMTP Port', description: 'Usually 587 for TLS, 465 for SSL', field_type: 'number', sort_order: 2 },
  { key: 'smtp_secure', value: 'false', category: 'smtp', label: 'SMTP Secure (SSL)', description: 'Use SSL (true for port 465)', field_type: 'boolean', sort_order: 3 },
  { key: 'smtp_user', value: '', category: 'smtp', label: 'SMTP Username', description: 'SMTP login username / email', field_type: 'email', sort_order: 4 },
  { key: 'smtp_pass', value: '', category: 'smtp', label: 'SMTP Password', description: 'App password or SMTP password', field_type: 'password', sort_order: 5 },
  { key: 'smtp_from_name', value: 'The Book Times', category: 'smtp', label: 'From Name', description: 'Display name in sent emails', field_type: 'text', sort_order: 6 },
  { key: 'smtp_from_email', value: 'noreply@thebooktimes.com', category: 'smtp', label: 'From Email', description: 'Sender email address', field_type: 'email', sort_order: 7 },
  // Branding
  { key: 'site_logo_url', value: '', category: 'branding', label: 'Logo URL', description: 'URL to site logo (leave empty for text logo)', field_type: 'url', sort_order: 1 },
  { key: 'site_favicon_url', value: '', category: 'branding', label: 'Favicon URL', description: 'URL to site favicon', field_type: 'url', sort_order: 2 },
  { key: 'brand_primary_color', value: '#c2631a', category: 'branding', label: 'Primary Color', description: 'Primary brand color (hex)', field_type: 'color', sort_order: 3 },
  { key: 'brand_secondary_color', value: '#1e293b', category: 'branding', label: 'Secondary Color', description: 'Secondary brand color (hex)', field_type: 'color', sort_order: 4 },
  { key: 'google_analytics_id', value: '', category: 'branding', label: 'Google Analytics ID', description: 'GA Measurement ID (e.g. G-XXXXXXXXXX)', field_type: 'text', sort_order: 5 },
  // Social Links
  { key: 'social_facebook', value: '', category: 'social', label: 'Facebook URL', description: 'Facebook page URL', field_type: 'url', sort_order: 1 },
  { key: 'social_twitter', value: '', category: 'social', label: 'Twitter / X URL', description: 'Twitter profile URL', field_type: 'url', sort_order: 2 },
  { key: 'social_instagram', value: '', category: 'social', label: 'Instagram URL', description: 'Instagram profile URL', field_type: 'url', sort_order: 3 },
  { key: 'social_linkedin', value: '', category: 'social', label: 'LinkedIn URL', description: 'LinkedIn company URL', field_type: 'url', sort_order: 4 },
  { key: 'social_youtube', value: '', category: 'social', label: 'YouTube URL', description: 'YouTube channel URL', field_type: 'url', sort_order: 5 },
  { key: 'social_tiktok', value: '', category: 'social', label: 'TikTok URL', description: 'TikTok profile URL', field_type: 'url', sort_order: 6 },
  { key: 'social_pinterest', value: '', category: 'social', label: 'Pinterest URL', description: 'Pinterest profile URL', field_type: 'url', sort_order: 7 },
  { key: 'social_goodreads', value: '', category: 'social', label: 'Goodreads URL', description: 'Goodreads profile URL', field_type: 'url', sort_order: 8 },
  // Legal (placeholder — full content in settings.ts defaults)
  { key: 'privacy_policy', value: '<h2>Privacy Policy</h2><p>Please visit our <a href="/legal/privacy_policy">privacy policy page</a> for the full policy.</p>', category: 'legal', label: 'Privacy Policy', description: 'Privacy policy content (HTML)', field_type: 'richtext', sort_order: 1 },
  { key: 'terms_conditions', value: '<h2>Terms & Conditions</h2><p>Please visit our <a href="/legal/terms_conditions">terms page</a> for the full terms.</p>', category: 'legal', label: 'Terms & Conditions', description: 'Terms and conditions content (HTML)', field_type: 'richtext', sort_order: 2 },
  { key: 'cookie_policy', value: '<h2>Cookie Policy</h2><p>Please visit our <a href="/legal/cookie_policy">cookie policy page</a> for details.</p>', category: 'legal', label: 'Cookie Policy', description: 'Cookie policy content (HTML)', field_type: 'richtext', sort_order: 3 },
  { key: 'refund_policy', value: '<h2>Refund Policy</h2><p>Please visit our <a href="/legal/refund_policy">refund policy page</a> for details.</p>', category: 'legal', label: 'Refund Policy', description: 'Refund policy (HTML)', field_type: 'richtext', sort_order: 4 },
  // Notifications
  { key: 'notify_new_user', value: 'true', category: 'notifications', label: 'New User Notification', description: 'Email admin when a new user registers', field_type: 'boolean', sort_order: 1 },
  { key: 'notify_new_review', value: 'true', category: 'notifications', label: 'New Review Notification', description: 'Email admin when a new review is submitted', field_type: 'boolean', sort_order: 2 },
  { key: 'notify_new_subscriber', value: 'true', category: 'notifications', label: 'New Subscriber Notification', description: 'Email admin when someone subscribes to newsletter', field_type: 'boolean', sort_order: 3 },
  { key: 'notify_contact_form', value: 'true', category: 'notifications', label: 'Contact Form Notification', description: 'Email admin on contact form submissions', field_type: 'boolean', sort_order: 4 },
  { key: 'welcome_email_enabled', value: 'true', category: 'notifications', label: 'Welcome Email', description: 'Send welcome email to new subscribers', field_type: 'boolean', sort_order: 5 },
  { key: 'welcome_email_subject', value: 'Welcome to The Book Times! ðŸ“š', category: 'notifications', label: 'Welcome Email Subject', description: 'Subject line for welcome email', field_type: 'text', sort_order: 6 },
  { key: 'welcome_email_content', value: '<h2>Welcome!</h2><p>Thank you for subscribing to The Book Times newsletter.</p>', category: 'notifications', label: 'Welcome Email Content', description: 'HTML content for welcome email', field_type: 'richtext', sort_order: 7 },
  // Security
  { key: 'admin_url_slug', value: 'ctrl-panel', category: 'security', label: 'Admin URL Slug', description: 'Secret URL slug to access admin dashboard', field_type: 'text', sort_order: 1 },
  // Affiliate
  { key: 'affiliate_disclosure', value: '<h2>Affiliate Disclosure</h2><p>The Book Times participates in affiliate programs.</p>', category: 'affiliate', label: 'Affiliate Disclosure', description: 'Affiliate disclosure statement (HTML)', field_type: 'richtext', sort_order: 1 },
  { key: 'affiliate_amazon_tag', value: '', category: 'affiliate', label: 'Amazon Affiliate Tag', description: 'Your Amazon Associates tag', field_type: 'text', sort_order: 2 },
  { key: 'affiliate_default_commission', value: '4.5', category: 'affiliate', label: 'Default Commission %', description: 'Default affiliate commission percentage', field_type: 'number', sort_order: 3 },
  { key: 'affiliate_cookie_days', value: '30', category: 'affiliate', label: 'Cookie Duration (days)', description: 'Affiliate cookie duration in days', field_type: 'number', sort_order: 4 },
  { key: 'affiliate_auto_link', value: 'true', category: 'affiliate', label: 'Auto-Link Books', description: 'Automatically add affiliate tags to book links', field_type: 'boolean', sort_order: 5 },
];

// â”€â”€ Testimonials â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const TESTIMONIALS = [
  { name: 'Sarah Chen', role: 'Book Club Organizer', content: "The Book Times has transformed how our book club picks our monthly reads. The AI recommendations are spot-on and we've discovered so many hidden gems!", rating: 5, sort_order: 1 },
  { name: 'Michael Rodriguez', role: 'Literature Professor', content: "As an educator, I appreciate the breadth of the catalog and the quality of the curation. My students love using it to find research materials and leisure reads alike.", rating: 5, sort_order: 2 },
  { name: 'Priya Patel', role: 'Avid Reader', content: "I've tried many book recommendation sites, but this one truly understands my taste. Every suggestion has been a page-turner. My reading list has never been better!", rating: 5, sort_order: 3 },
  { name: 'David Kim', role: 'Tech Entrepreneur', content: "The personalized recommendations save me hours of searching. I find exactly the business and tech books I need, plus great fiction for downtime. Highly recommend!", rating: 4, sort_order: 4 },
];

// â”€â”€ Main seed function â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function main() {
  // â”€â”€ Safety guard: prevent accidental data loss in production â”€â”€
  if (config.nodeEnv === 'production') {
    console.error('âŒ  Seed script must not run in production â€” it drops all tables!');
    process.exit(1);
  }

  console.log('ðŸ”§ Using shared database connection from database.ts');

  await initPool();

  await dbRun('SET FOREIGN_KEY_CHECKS = 0', []);

  // Drop all existing tables to start fresh
  const tables = await dbAll<any>(
    "SELECT table_name AS name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'",
    []
  );
  for (const t of tables) {
    await dbRun(`DROP TABLE IF EXISTS \`${t.name}\``, []);
  }
  console.log(`ðŸ—‘ï¸  Dropped ${tables.length} existing tables`);

  await dbRun('SET FOREIGN_KEY_CHECKS = 1', []);

  // Re-run schema creation
  await initDatabase();

  // â”€â”€ Categories â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  for (const cat of categories) {
    await dbRun(
      `INSERT INTO categories (id, name, slug, description, image_url, book_count) VALUES (?, ?, ?, ?, ?, ?)`,
      [cat.id, cat.name, cat.slug, cat.description, cat.imageUrl, cat.bookCount]
    );
  }
  console.log(`ðŸ“š Seeded ${categories.length} categories`);

  // â”€â”€ Authors â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const uniqueAuthors = [...new Set(books.map(b => b.author))];
  const authorNameToId: Record<string, string> = {};

  for (const authorName of uniqueAuthors) {
    const authorId = uuidv4();
    const authorSlug = authorName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const bio = authorBios[authorName] || `${authorName} is the author of popular books available on The Book Times.`;

    await dbRun(
      `INSERT INTO authors (id, name, slug, bio, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())`,
      [authorId, authorName, authorSlug, bio]
    );
    authorNameToId[authorName] = authorId;
  }
  console.log(`âœï¸  Seeded ${uniqueAuthors.length} authors`);

  // â”€â”€ Insert Books â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  for (const book of books) {
    const authorId = authorNameToId[book.author] || null;
    await dbRun(
      `INSERT INTO books (id, google_books_id, isbn10, isbn13, slug, title, subtitle, author, author_id, description, cover_image, publisher, published_date, page_count, language, google_rating, ratings_count, computed_score, price, currency, amazon_url, status, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [book.id, book.googleBooksId, book.isbn10, book.isbn13, book.slug, book.title, book.subtitle, book.author, authorId, book.description, book.coverImage, book.publisher, book.publishedDate, book.pageCount, book.language, book.googleRating, book.ratingsCount, book.computedScore, book.price, book.currency, book.amazonUrl, book.status]
    );

    for (const catName of book.categories) {
      const catId = catNameToId[catName];
      if (catId) {
        await dbRun(
          `INSERT IGNORE INTO book_categories (book_id, category_id) VALUES (?, ?)`,
          [book.id, catId]
        );
      }
    }
  }

  // Update category book counts
  await dbRun(
    `UPDATE categories SET book_count = (
      SELECT COUNT(*) FROM book_categories bc
      JOIN books b ON b.id = bc.book_id
      WHERE bc.category_id = categories.id AND b.status = 'PUBLISHED' AND b.is_active = 1
    )`,
    []
  );

  console.log(`ðŸ“– Seeded ${books.length} books`);

  // â”€â”€ Blog Posts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  for (const post of blogPosts) {
    await dbRun(
      `INSERT INTO blog_posts (id, title, slug, content, excerpt, featured_image, status, published_at, generated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'manual')`,
      [post.id, post.title, post.slug, post.content, post.excerpt, post.featuredImage, post.status, post.publishedAt]
    );
    for (const bookId of post.featuredBookIds) {
      await dbRun(
        `INSERT IGNORE INTO blog_featured_books (blog_id, book_id) VALUES (?, ?)`,
        [post.id, bookId]
      );
    }
  }
  console.log(`ðŸ“ Seeded ${blogPosts.length} blog posts`);

  // â”€â”€ Admin User â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const adminPasswordHash = bcrypt.hashSync(config.admin.password, 12);
  await dbRun(
    `INSERT INTO users (id, email, name, password_hash, avatar_url, role)
     VALUES (?, ?, ?, ?, ?, 'admin')`,
    [
      'admin-001',
      config.admin.email,
      'Admin',
      adminPasswordHash,
      `https://api.dicebear.com/7.x/avataaars/svg?seed=admin`,
    ]
  );
  console.log(`ðŸ‘¤ Created admin user: ${config.admin.email}`);

  // â”€â”€ Sample Users â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  for (const u of sampleUsers) {
    const hash = bcrypt.hashSync(u.password, 12);
    await dbRun(
      `INSERT INTO users (id, email, name, password_hash, avatar_url, role)
       VALUES (?, ?, ?, ?, ?, 'user')`,
      [u.id, u.email, u.name, hash, `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(u.email)}`]
    );
  }
  console.log(`ðŸ‘¥ Seeded ${sampleUsers.length} sample users`);

  // â”€â”€ Sample Reviews â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  for (const r of sampleReviews) {
    await dbRun(
      `INSERT INTO reviews (id, book_id, user_id, user_name, user_avatar, rating, title, content, helpful_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(), r.bookId, r.userId, r.userName,
        `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(r.userName)}`,
        r.rating, r.title, r.content,
        Math.floor(Math.random() * 25),
      ]
    );
  }
  console.log(`â­ Seeded ${sampleReviews.length} reviews`);

  // â”€â”€ Newsletter Subscribers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  for (const email of subscribers) {
    await dbRun(
      `INSERT INTO newsletter_subscribers (id, email) VALUES (?, ?)`,
      [uuidv4(), email]
    );
  }
  console.log(`ðŸ“§ Seeded ${subscribers.length} newsletter subscribers`);

  // â”€â”€ Sample Analytics Data (last 30 days) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const now = Date.now();
  const pages = ['/', '/books', '/categories/fiction', '/categories/business', '/categories/technology', '/categories/self-help', '/blog'];
  const bookIds = books.map(b => b.id);

  const toMysqlDatetime = (d: Date) => d.toISOString().slice(0, 19).replace('T', ' ');
  let pvCount = 0, evCount = 0, acCount = 0;

  for (let day = 0; day < 30; day++) {
    const date = new Date(now - day * 86400000);
    const dateStr = toMysqlDatetime(date);
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    const baseViews = isWeekend ? 30 : 60;
    const viewsToday = baseViews + Math.floor(Math.random() * 40);

    for (let v = 0; v < viewsToday; v++) {
      const sessionId = `sess-${day}-${v}`;
      const pageIdx = Math.floor(Math.random() * pages.length);
      const ts = toMysqlDatetime(new Date(date.getTime() + Math.floor(Math.random() * 86400000)));

      await dbRun(
        `INSERT INTO page_views (id, page_path, page_title, session_id, created_at) VALUES (?, ?, ?, ?, ?)`,
        [uuidv4(), pages[pageIdx], `Page: ${pages[pageIdx]}`, sessionId, ts]
      );
      pvCount++;

      // ~40% chance: also viewed a book
      if (Math.random() < 0.4) {
        const bookId = bookIds[Math.floor(Math.random() * bookIds.length)];
        await dbRun(
          `INSERT INTO analytics_events (id, event_type, entity_type, entity_id, session_id, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
          [uuidv4(), 'view', 'book', bookId, sessionId, ts]
        );
        evCount++;

        // ~15% of book views â†’ affiliate click
        if (Math.random() < 0.15) {
          await dbRun(
            `INSERT INTO affiliate_clicks (id, book_id, session_id, source, created_at) VALUES (?, ?, ?, ?, ?)`,
            [uuidv4(), bookId, sessionId, 'book-page', ts]
          );
          acCount++;
        }
      }

      // ~10% chance: search event
      if (Math.random() < 0.1) {
        await dbRun(
          `INSERT INTO analytics_events (id, event_type, entity_type, entity_id, session_id, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
          [uuidv4(), 'search', null, null, sessionId, ts]
        );
        evCount++;
      }
    }
  }

  console.log(`ðŸ“Š Seeded analytics: ${pvCount} page views, ${evCount} events, ${acCount} affiliate clicks`);

  // â”€â”€ Default Settings â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  for (const s of DEFAULT_SETTINGS) {
    await dbRun(
      `INSERT IGNORE INTO site_settings (\`key\`, value, category, label, description, field_type, sort_order, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [s.key, s.value, s.category, s.label, s.description, s.field_type, s.sort_order]
    );
  }
  console.log(`âš™ï¸  Seeded ${DEFAULT_SETTINGS.length} settings`);

  // â”€â”€ Seed Testimonials â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  for (const t of TESTIMONIALS) {
    await dbRun(
      `INSERT IGNORE INTO testimonials (id, name, role, content, rating, is_active, sort_order, created_at)
       VALUES (?, ?, ?, ?, ?, 1, ?, NOW())`,
      [uuidv4(), t.name, t.role, t.content, t.rating, t.sort_order]
    );
  }
  console.log(`ðŸ’¬ Seeded ${TESTIMONIALS.length} testimonials`);

  // â”€â”€ Done â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  await closePool();
  console.log('\nâœ… Database seeded successfully!');
  console.log(`   Admin login: ${config.admin.email} / ${config.admin.password}`);
}

main().catch(err => {
  console.error('âŒ Seed failed:', err);
  process.exit(1);
});
