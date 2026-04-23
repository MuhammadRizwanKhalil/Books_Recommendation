import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { dbGet, dbAll, dbRun } from '../database.js';
import { authenticate, requireAdmin, rateLimit } from '../middleware.js';
import { testSmtpConnection, sendEmail, wrapInBaseTemplate } from '../services/email.js';
import { logger } from '../lib/logger.js';

const router = Router();

// ── Legal page content ──────────────────────────────────────────────────────

const PRIVACY_POLICY_HTML = `<h2>Introduction</h2>
<p>The Book Times ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website at thebooktimes.com.</p>

<h2>Information We Collect</h2>
<h3>Personal Information</h3>
<p>When you create an account, subscribe to our newsletter, or contact us, we may collect:</p>
<ul>
<li>Name and email address</li>
<li>Account credentials (passwords are securely hashed and never stored in plain text)</li>
<li>Profile preferences and reading interests</li>
</ul>

<h3>Automatically Collected Information</h3>
<p>When you access our website, we automatically collect:</p>
<ul>
<li>Browser type and version</li>
<li>Operating system</li>
<li>IP address (anonymized)</li>
<li>Pages visited and time spent on pages</li>
<li>Referring website or source</li>
</ul>

<h2>How We Use Your Information</h2>
<p>We use the collected information to:</p>
<ul>
<li>Provide and maintain our book recommendation services</li>
<li>Personalize your reading recommendations</li>
<li>Send newsletters and book updates (with your consent)</li>
<li>Improve our website and user experience</li>
<li>Respond to your inquiries and support requests</li>
<li>Analyze website usage through Google Analytics</li>
</ul>

<h2>Cookies and Tracking</h2>
<p>We use cookies and similar tracking technologies to enhance your experience. See our <a href="/legal/cookie_policy">Cookie Policy</a> for details.</p>

<h2>Third-Party Services</h2>
<p>We may share limited data with trusted third-party services:</p>
<ul>
<li><strong>Google Analytics:</strong> For website usage statistics (anonymized data)</li>
<li><strong>Amazon Associates:</strong> When you click affiliate links, Amazon's privacy policy applies</li>
<li><strong>Email Service Providers:</strong> To deliver newsletters and transactional emails</li>
</ul>
<p>We do not sell, trade, or rent your personal information to third parties.</p>

<h2>Data Security</h2>
<p>We implement appropriate security measures including:</p>
<ul>
<li>HTTPS/SSL encryption for all data transmission</li>
<li>Secure password hashing with bcrypt (12 rounds)</li>
<li>Rate limiting to protect against abuse</li>
<li>Regular security updates and monitoring</li>
</ul>

<h2>Your Rights</h2>
<p>You have the right to:</p>
<ul>
<li>Access, update, or delete your personal information</li>
<li>Opt out of newsletters at any time via unsubscribe links</li>
<li>Request a copy of your data</li>
<li>Delete your account by contacting us</li>
</ul>

<h2>Children's Privacy</h2>
<p>Our services are not directed to individuals under 13 years of age. We do not knowingly collect personal information from children.</p>

<h2>Changes to This Policy</h2>
<p>We may update this Privacy Policy from time to time. We will notify registered users of significant changes via email. The "Last Updated" date at the bottom of this page indicates when the policy was last revised.</p>

<h2>Contact Us</h2>
<p>If you have questions about this Privacy Policy, please contact us at <strong>contact@thebooktimes.com</strong>.</p>`;

const TERMS_CONDITIONS_HTML = `<h2>Acceptance of Terms</h2>
<p>By accessing and using The Book Times (thebooktimes.com), you accept and agree to be bound by these Terms and Conditions. If you do not agree to these terms, please do not use our website.</p>

<h2>Description of Service</h2>
<p>The Book Times is a book discovery and recommendation platform that provides:</p>
<ul>
<li>Curated book recommendations and reviews</li>
<li>Book search and discovery tools</li>
<li>Reading lists and personalized suggestions</li>
<li>Blog articles about books and reading</li>
<li>Newsletter subscriptions for book updates</li>
<li>Affiliate links to purchase books from third-party retailers</li>
</ul>

<h2>User Accounts</h2>
<p>To access certain features, you may need to create an account. You agree to:</p>
<ul>
<li>Provide accurate and complete information</li>
<li>Maintain the security of your password</li>
<li>Notify us of any unauthorized access to your account</li>
<li>Accept responsibility for all activities under your account</li>
</ul>

<h2>User Conduct</h2>
<p>When using our services, you agree not to:</p>
<ul>
<li>Post false, misleading, or fraudulent reviews</li>
<li>Use automated systems (bots) to access the service without permission</li>
<li>Harass, abuse, or threaten other users</li>
<li>Upload malicious content or attempt to compromise our systems</li>
<li>Violate any applicable laws or regulations</li>
<li>Infringe on the intellectual property rights of others</li>
</ul>

<h2>Reviews and User Content</h2>
<p>By submitting reviews, ratings, or other content, you:</p>
<ul>
<li>Grant us a non-exclusive, royalty-free license to display and use your content on our platform</li>
<li>Represent that your content is original and does not violate anyone's rights</li>
<li>Acknowledge that we may moderate or remove content that violates these terms</li>
</ul>

<h2>Affiliate Links and Purchases</h2>
<p>The Book Times contains affiliate links to third-party retailers (such as Amazon). When you make purchases through these links:</p>
<ul>
<li>You are buying from the third-party retailer, not from us</li>
<li>The retailer's terms of service and privacy policy apply</li>
<li>We may earn a commission at no additional cost to you</li>
<li>We do not guarantee product availability or pricing</li>
</ul>

<h2>Intellectual Property</h2>
<p>All content on The Book Times, including text, graphics, logos, and software, is the property of The Book Times or its content suppliers and is protected by intellectual property laws. Book cover images and descriptions are used under fair use for review and recommendation purposes.</p>

<h2>Disclaimer of Warranties</h2>
<p>The Book Times is provided "as is" without warranties of any kind. We do not guarantee that:</p>
<ul>
<li>The service will be uninterrupted or error-free</li>
<li>Book information is 100% accurate or complete</li>
<li>Recommendations will match your personal preferences</li>
</ul>

<h2>Limitation of Liability</h2>
<p>The Book Times shall not be liable for any indirect, incidental, or consequential damages arising from your use of our services, including but not limited to purchases made through affiliate links.</p>

<h2>Termination</h2>
<p>We reserve the right to suspend or terminate your account if you violate these terms, with or without notice.</p>

<h2>Changes to Terms</h2>
<p>We may update these Terms and Conditions at any time. Continued use of the website after changes constitutes acceptance of the new terms.</p>

<h2>Contact</h2>
<p>For questions about these terms, contact us at <strong>contact@thebooktimes.com</strong>.</p>`;

const COOKIE_POLICY_HTML = `<h2>What Are Cookies?</h2>
<p>Cookies are small text files that are placed on your device when you visit a website. They are widely used to make websites work more efficiently and provide information to site owners.</p>

<h2>How We Use Cookies</h2>
<p>The Book Times uses cookies and similar technologies for the following purposes:</p>

<h3>Essential Cookies</h3>
<p>These cookies are necessary for the website to function properly. They enable:</p>
<ul>
<li>User authentication and session management</li>
<li>Security features (CSRF protection, rate limiting)</li>
<li>Remembering your preferences (theme, language)</li>
</ul>
<p>These cookies cannot be disabled without affecting site functionality.</p>

<h3>Analytics Cookies</h3>
<p>We use Google Analytics to understand how visitors use our website. These cookies collect:</p>
<ul>
<li>Pages visited and navigation patterns</li>
<li>Time spent on pages</li>
<li>Browser and device information</li>
<li>Referral sources</li>
</ul>
<p>This data is anonymized and used solely to improve our website. Google Analytics ID: G-TDW096P47M.</p>

<h3>Functional Cookies</h3>
<p>These cookies remember your choices and preferences:</p>
<ul>
<li>Dark/light theme preference</li>
<li>Reading list selections</li>
<li>Search history (stored locally)</li>
<li>Wishlist items</li>
</ul>

<h2>Third-Party Cookies</h2>
<p>Some third-party services may set their own cookies when you interact with their features:</p>
<ul>
<li><strong>Google Analytics:</strong> Performance and usage tracking</li>
<li><strong>Amazon:</strong> When clicking affiliate links to Amazon</li>
</ul>

<h2>Managing Cookies</h2>
<p>You can control cookies through your browser settings. Most browsers allow you to:</p>
<ul>
<li>View and delete existing cookies</li>
<li>Block cookies from specific or all websites</li>
<li>Set preferences for cookie acceptance</li>
</ul>
<p>Note that disabling essential cookies may affect website functionality.</p>

<h3>Browser-Specific Instructions</h3>
<ul>
<li><strong>Chrome:</strong> Settings &gt; Privacy and Security &gt; Cookies</li>
<li><strong>Firefox:</strong> Settings &gt; Privacy &amp; Security &gt; Cookies</li>
<li><strong>Safari:</strong> Preferences &gt; Privacy &gt; Manage Website Data</li>
<li><strong>Edge:</strong> Settings &gt; Privacy, Search, and Services &gt; Cookies</li>
</ul>

<h2>Local Storage</h2>
<p>In addition to cookies, we use browser local storage to save:</p>
<ul>
<li>Authentication tokens (for keeping you signed in)</li>
<li>Theme preferences</li>
<li>Cached book data (for faster loading)</li>
</ul>
<p>Local storage data can be cleared through your browser's developer tools or settings.</p>

<h2>Updates to This Policy</h2>
<p>We may update this Cookie Policy periodically. Check back for any changes.</p>

<h2>Contact</h2>
<p>For questions about our use of cookies, contact us at <strong>contact@thebooktimes.com</strong>.</p>`;

const REFUND_POLICY_HTML = `<h2>About Our Service</h2>
<p>The Book Times is a free book discovery and recommendation platform. We do not sell books directly. Our service includes:</p>
<ul>
<li>Free book recommendations and reviews</li>
<li>Free reading lists and personalization features</li>
<li>Free newsletter subscriptions</li>
<li>Affiliate links to third-party retailers</li>
</ul>

<h2>Purchases Through Affiliate Links</h2>
<p>When you purchase books through our affiliate links (e.g., Amazon), the transaction is between you and the retailer. For refunds on such purchases:</p>
<ul>
<li>Contact the retailer directly (e.g., Amazon customer service)</li>
<li>The retailer's refund policy applies, not ours</li>
<li>We cannot process refunds for third-party purchases</li>
</ul>

<h2>Premium Services (If Applicable)</h2>
<p>If The Book Times offers any premium or paid services in the future:</p>
<ul>
<li>Refund terms will be clearly stated at the time of purchase</li>
<li>Contact us within 14 days of purchase for refund requests</li>
<li>Refunds will be processed to the original payment method</li>
</ul>

<h2>Newsletter Subscriptions</h2>
<p>Newsletter subscriptions are free. You can unsubscribe at any time by:</p>
<ul>
<li>Clicking the "Unsubscribe" link in any newsletter email</li>
<li>Managing your subscription in your account settings</li>
<li>Contacting us directly</li>
</ul>

<h2>Data Deletion Requests</h2>
<p>If you wish to delete your account and all associated data, please contact us at <strong>contact@thebooktimes.com</strong>. We will process your request within 30 days.</p>

<h2>Contact</h2>
<p>For any questions about this policy, reach out to us at <strong>contact@thebooktimes.com</strong>.</p>`;

const AFFILIATE_DISCLOSURE_HTML = `<h2>Affiliate Disclosure</h2>
<p>The Book Times is a participant in affiliate programs, including the Amazon Services LLC Associates Program, an affiliate advertising program designed to provide a means for sites to earn advertising fees by advertising and linking to Amazon.com and affiliated sites.</p>

<h2>How It Works</h2>
<p>Throughout our website, you will find links to books and products sold by third-party retailers. When you click on these links and make a purchase:</p>
<ul>
<li>We may earn a small commission from the retailer</li>
<li>This comes at no additional cost to you</li>
<li>The price you pay is the same whether you use our link or go directly to the retailer</li>
</ul>

<h2>Our Commitment to Honesty</h2>
<p>Affiliate partnerships do not influence our book recommendations or reviews. Our editorial integrity is paramount:</p>
<ul>
<li>We recommend books based on quality, reader ratings, and editorial merit</li>
<li>We never promote books solely because of affiliate commissions</li>
<li>Our reviews and ratings are honest and unbiased</li>
<li>We clearly distinguish editorial content from affiliate links</li>
</ul>

<h2>Why We Use Affiliate Links</h2>
<p>Running The Book Times requires time, effort, and resources. Affiliate commissions help us:</p>
<ul>
<li>Keep the website free for all users</li>
<li>Maintain and improve our book recommendation algorithms</li>
<li>Create quality blog content and reading guides</li>
<li>Cover hosting, development, and operational costs</li>
</ul>

<h2>Identifying Affiliate Links</h2>
<p>Links to purchase books on Amazon or other retailers on our site are affiliate links. While we do not mark each link individually, you should assume that any link leading to a product purchase page may be an affiliate link.</p>

<h2>Questions?</h2>
<p>If you have questions about our affiliate relationships, please contact us at <strong>contact@thebooktimes.com</strong>.</p>

<p><em>Thank you for supporting The Book Times!</em></p>`;

// ── Default settings seed data ──────────────────────────────────────────────

const DEFAULT_SETTINGS = [
  // General
  { key: 'site_name', value: 'The Book Times', category: 'general', label: 'Site Name', description: 'Name of the website', field_type: 'text', sort_order: 1 },
  { key: 'site_url', value: 'https://thebooktimes.com', category: 'general', label: 'Site URL', description: 'Public URL of the website', field_type: 'url', sort_order: 2 },
  { key: 'site_tagline', value: 'Discover your next favorite book', category: 'general', label: 'Site Tagline', description: 'Short tagline or slogan', field_type: 'text', sort_order: 3 },
  { key: 'site_description', value: 'The Book Times is a curated platform for book lovers to find, review, and discover new books.', category: 'general', label: 'Site Description', description: 'Short description of the website', field_type: 'textarea', sort_order: 4 },
  { key: 'admin_email', value: 'admin@thebooktimes.com', category: 'general', label: 'Admin Email', description: 'Primary admin email for receiving notifications', field_type: 'email', sort_order: 5 },
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

  // Analytics
  { key: 'google_analytics_enabled', value: 'true', category: 'analytics', label: 'Enable Analytics', description: 'Enable Google Analytics tracking and dashboard reporting', field_type: 'boolean', sort_order: 1 },
  { key: 'google_analytics_id', value: 'G-TDW096P47M', category: 'analytics', label: 'GA Measurement ID', description: 'Measurement ID used by the website tag (e.g. G-XXXXXXXXXX)', field_type: 'text', sort_order: 2 },
  { key: 'google_analytics_property_id', value: '', category: 'analytics', label: 'GA Property ID', description: 'GA4 property id for admin reporting (e.g. 123456789 or properties/123456789)', field_type: 'text', sort_order: 3 },

  // Social Links
  { key: 'social_facebook', value: '', category: 'social', label: 'Facebook URL', description: 'Facebook page URL', field_type: 'url', sort_order: 1 },
  { key: 'social_twitter', value: '', category: 'social', label: 'Twitter / X URL', description: 'Twitter profile URL', field_type: 'url', sort_order: 2 },
  { key: 'social_instagram', value: '', category: 'social', label: 'Instagram URL', description: 'Instagram profile URL', field_type: 'url', sort_order: 3 },
  { key: 'social_linkedin', value: '', category: 'social', label: 'LinkedIn URL', description: 'LinkedIn company URL', field_type: 'url', sort_order: 4 },
  { key: 'social_youtube', value: '', category: 'social', label: 'YouTube URL', description: 'YouTube channel URL', field_type: 'url', sort_order: 5 },
  { key: 'social_tiktok', value: '', category: 'social', label: 'TikTok URL', description: 'TikTok profile URL', field_type: 'url', sort_order: 6 },
  { key: 'social_pinterest', value: '', category: 'social', label: 'Pinterest URL', description: 'Pinterest profile URL', field_type: 'url', sort_order: 7 },
  { key: 'social_goodreads', value: '', category: 'social', label: 'Goodreads URL', description: 'Goodreads profile URL', field_type: 'url', sort_order: 8 },

  // Legal
  { key: 'privacy_policy', value: PRIVACY_POLICY_HTML, category: 'legal', label: 'Privacy Policy', description: 'Privacy policy content (HTML)', field_type: 'richtext', sort_order: 1 },
  { key: 'terms_conditions', value: TERMS_CONDITIONS_HTML, category: 'legal', label: 'Terms & Conditions', description: 'Terms and conditions content (HTML)', field_type: 'richtext', sort_order: 2 },
  { key: 'cookie_policy', value: COOKIE_POLICY_HTML, category: 'legal', label: 'Cookie Policy', description: 'Cookie policy content (HTML)', field_type: 'richtext', sort_order: 3 },
  { key: 'refund_policy', value: REFUND_POLICY_HTML, category: 'legal', label: 'Refund Policy', description: 'Refund policy (HTML)', field_type: 'richtext', sort_order: 4 },

  // Notifications
  { key: 'notify_new_user', value: 'true', category: 'notifications', label: 'New User Notification', description: 'Email admin when a new user registers', field_type: 'boolean', sort_order: 1 },
  { key: 'notify_new_review', value: 'true', category: 'notifications', label: 'New Review Notification', description: 'Email admin when a new review is submitted', field_type: 'boolean', sort_order: 2 },
  { key: 'notify_new_subscriber', value: 'true', category: 'notifications', label: 'New Subscriber Notification', description: 'Email admin when someone subscribes to newsletter', field_type: 'boolean', sort_order: 3 },
  { key: 'notify_contact_form', value: 'true', category: 'notifications', label: 'Contact Form Notification', description: 'Email admin on contact form submissions', field_type: 'boolean', sort_order: 4 },
  { key: 'welcome_email_enabled', value: 'true', category: 'notifications', label: 'Welcome Email', description: 'Send welcome email to new subscribers', field_type: 'boolean', sort_order: 5 },
  { key: 'welcome_email_subject', value: 'Welcome to The Book Times! 📚', category: 'notifications', label: 'Welcome Email Subject', description: 'Subject line for welcome email', field_type: 'text', sort_order: 6 },
  { key: 'welcome_email_content', value: '<h2>Welcome, {{subscriber_name}}!</h2><p>Thank you for subscribing to The Book Times newsletter. You\'ll receive curated book recommendations, exclusive deals, and reading tips straight to your inbox.</p><p>Happy reading! 📖</p>', category: 'notifications', label: 'Welcome Email Content', description: 'HTML content for welcome email', field_type: 'richtext', sort_order: 7 },

  // Security
  { key: 'admin_url_slug', value: 'ctrl-panel', category: 'security', label: 'Admin URL Slug', description: 'Secret URL slug to access admin dashboard (e.g. yoursite.com/ctrl-panel). Change this to any custom string.', field_type: 'text', sort_order: 1 },

  // Affiliate
  { key: 'affiliate_disclosure', value: AFFILIATE_DISCLOSURE_HTML, category: 'affiliate', label: 'Affiliate Disclosure', description: 'Affiliate disclosure statement (HTML)', field_type: 'richtext', sort_order: 1 },
  { key: 'affiliate_amazon_tag', value: '', category: 'affiliate', label: 'Amazon Affiliate Tag', description: 'Your Amazon Associates tag', field_type: 'text', sort_order: 2 },
  { key: 'affiliate_default_commission', value: '4.5', category: 'affiliate', label: 'Default Commission %', description: 'Default affiliate commission percentage', field_type: 'number', sort_order: 3 },
  { key: 'affiliate_cookie_days', value: '30', category: 'affiliate', label: 'Cookie Duration (days)', description: 'Affiliate cookie duration in days', field_type: 'number', sort_order: 4 },
  { key: 'affiliate_auto_link', value: 'true', category: 'affiliate', label: 'Auto-Link Books', description: 'Automatically add affiliate tags to book links', field_type: 'boolean', sort_order: 5 },

  // Homepage Content — editable section text
  { key: 'hero_badge_text', value: 'AI-Powered Book Discovery', category: 'homepage', label: 'Hero Badge Text', description: 'Badge label shown above the hero heading', field_type: 'text', sort_order: 1 },
  { key: 'popular_searches', value: 'Atomic Habits,Self Help,Business,Fiction,Technology', category: 'homepage', label: 'Popular Searches', description: 'Comma-separated list of popular search terms shown in hero', field_type: 'text', sort_order: 2 },
  { key: 'trending_badge', value: 'Hot Right Now', category: 'homepage', label: 'Trending Badge', description: 'Badge text for the trending section', field_type: 'text', sort_order: 3 },
  { key: 'trending_description', value: 'Discover what readers are loving right now. Our algorithm analyzes ratings, reviews, and reading patterns to surface the hottest books.', category: 'homepage', label: 'Trending Description', description: 'Description for the trending section', field_type: 'textarea', sort_order: 4 },
  { key: 'new_releases_badge', value: 'Fresh Arrivals', category: 'homepage', label: 'New Releases Badge', description: 'Badge text for the new releases section', field_type: 'text', sort_order: 5 },
  { key: 'new_releases_description', value: 'Stay ahead of the curve with the latest additions to our library, imported daily from Google Books.', category: 'homepage', label: 'New Releases Description', description: 'Description for the new releases section', field_type: 'textarea', sort_order: 6 },
  { key: 'categories_description', value: 'From fiction to technology, find exactly what you are looking for.', category: 'homepage', label: 'Categories Description', description: 'Description for the categories section', field_type: 'textarea', sort_order: 7 },
  { key: 'newsletter_heading', value: 'Never Miss a Great Read', category: 'homepage', label: 'Newsletter Heading', description: 'Heading for the newsletter signup section', field_type: 'text', sort_order: 8 },
  { key: 'newsletter_description', value: 'Subscribe to our newsletter and get personalized book recommendations, new release alerts, and curated reading lists delivered to your inbox.', category: 'homepage', label: 'Newsletter Description', description: 'Description for the newsletter section', field_type: 'textarea', sort_order: 9 },
  { key: 'footer_tagline', value: 'Made with ♥ for book lovers', category: 'homepage', label: 'Footer Tagline', description: 'Tagline shown at the bottom of the footer', field_type: 'text', sort_order: 10 },
];

// ── GET /api/settings — public settings (non-sensitive) ─────────────────────

router.get('/', async (_req: Request, res: Response) => {
  try {
    const sensitiveKeys = [
      'smtp_user',
      'smtp_pass',
      'smtp_host',
      'smtp_port',
      'smtp_secure',
      'smtp_from_name',
      'smtp_from_email',
      'admin_url_slug',
      'admin_email',
      'affiliate_amazon_tag',
      'google_analytics_property_id',
    ];
    const rows = await dbAll<any>(`
      SELECT \`key\`, value, category, label, description, field_type, sort_order
      FROM site_settings
      WHERE \`key\` NOT IN (${sensitiveKeys.map(() => '?').join(',')})
      ORDER BY category, sort_order
    `, sensitiveKeys);

    const grouped: Record<string, any[]> = {};
    for (const row of rows) {
      if (!grouped[row.category]) grouped[row.category] = [];
      grouped[row.category].push(row);
    }
    res.set('Cache-Control', 'public, max-age=120, stale-while-revalidate=240');
    res.json({ settings: grouped });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// ── GET /api/settings/admin — all settings (admin only) ─────────────────────

router.get('/admin', authenticate, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const rows = await dbAll<any>(`
      SELECT \`key\`, value, category, label, description, field_type, sort_order, updated_at
      FROM site_settings
      ORDER BY category, sort_order
    `, []);

    const grouped: Record<string, any[]> = {};
    for (const row of rows) {
      if (!grouped[row.category]) grouped[row.category] = [];
      grouped[row.category].push(row);
    }
    res.set('Cache-Control', 'no-store');
    res.json({ settings: grouped, categories: Object.keys(grouped) });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// ── PUT /api/settings — bulk update (admin only) ────────────────────────────

// Allowed setting keys for bulk update (prevent arbitrary key injection)
const ALLOWED_SETTING_KEYS = new Set(DEFAULT_SETTINGS.map(s => s.key));

router.put('/', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { settings } = req.body;
    if (!settings || typeof settings !== 'object') {
      res.status(400).json({ error: 'Settings object is required' });
      return;
    }

    const entries = Object.entries(settings).map(([k, v]) => [k, String(v)] as [string, string]);

    for (const [key, value] of entries) {
      if (!ALLOWED_SETTING_KEYS.has(key)) continue; // Skip unknown keys
      // Prevent excessively large values (legal/richtext pages up to 100 KB, others up to 2 KB)
      const maxLen = ['privacy_policy', 'terms_conditions', 'cookie_policy', 'refund_policy', 'affiliate_disclosure', 'welcome_email_content'].includes(key) ? 102400 : 2048;
      if (value.length > maxLen) continue;
      await dbRun(`
        INSERT INTO site_settings (\`key\`, value, updated_at)
        VALUES (?, ?, NOW())
        ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = VALUES(updated_at)
      `, [key, String(value)]);
    }

    res.json({ message: 'Settings updated', updated: entries.length });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// ── PUT /api/settings/:key — update single setting ──────────────────────────

router.put('/:key', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const key = req.params.key as string;
    const { value } = req.body;

    if (value === undefined) {
      res.status(400).json({ error: 'Value is required' });
      return;
    }

    // Validate key exists in allowed settings
    if (!ALLOWED_SETTING_KEYS.has(key)) {
      res.status(400).json({ error: 'Unknown setting key' });
      return;
    }

    await dbRun(`
      INSERT INTO site_settings (\`key\`, value, updated_at)
      VALUES (?, ?, NOW())
      ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = VALUES(updated_at)
    `, [key, String(value)]);

    res.json({ message: 'Setting updated', key, value: String(value) });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update setting' });
  }
});

// ── POST /api/settings/seed — seed default settings ─────────────────────────

router.post('/seed', authenticate, requireAdmin, async (_req: Request, res: Response) => {
  try {
    for (const s of DEFAULT_SETTINGS) {
      await dbRun(`
        INSERT INTO site_settings (\`key\`, value, category, label, description, field_type, sort_order, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
          category = VALUES(category),
          label = VALUES(label),
          description = VALUES(description),
          field_type = VALUES(field_type),
          sort_order = VALUES(sort_order)
      `, [s.key, s.value, s.category, s.label, s.description, s.field_type, s.sort_order]);
    }

    res.json({ message: 'Default settings seeded', count: DEFAULT_SETTINGS.length });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to seed settings' });
  }
});

// ── GET /api/settings/verify-admin-access/:slug — verify admin URL slug ─────

router.get('/verify-admin-access/:slug', rateLimit('admin-slug', 5, 15 * 60 * 1000), async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    if (!slug) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const row = await dbGet<any>('SELECT value FROM site_settings WHERE `key` = ?', ['admin_url_slug']);
    const storedSlug = row?.value || '';
    if (storedSlug && slug === storedSlug) {
      res.json({ valid: true });
    } else {
      res.status(404).json({ error: 'Not found' });
    }
  } catch {
    res.status(404).json({ error: 'Not found' });
  }
});

// ── POST /api/settings/test-smtp — test SMTP connection ────────────────────

router.post('/test-smtp', authenticate, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const result = await testSmtpConnection();
    res.json(result);
  } catch (err: any) {
    logger.error({ err: err.message }, 'SMTP test failed');
    res.status(500).json({ success: false, error: 'SMTP connection test failed' });
  }
});

// ── POST /api/settings/test-email — send a real test email ─────────────────

router.post('/test-email', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const to = req.body.email;
    if (!to) {
      res.status(400).json({ success: false, error: 'Email address is required' });
      return;
    }
    const html = await wrapInBaseTemplate(
      `<h2>Test Email</h2><p>This is a test email sent from TheBookTimes admin panel at ${new Date().toISOString()}.</p><p>If you received this, email delivery is working correctly!</p>`,
      'Test Email',
    );
    const result = await sendEmail({ to, subject: 'TheBookTimes - Test Email', html });
    res.json(result);
  } catch (err: any) {
    logger.error({ err: err.message }, 'Test email failed');
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Seed default settings into DB on startup (INSERT IGNORE — won't overwrite existing).
 * Also updates legal pages that still have placeholder content.
 */
export async function seedDefaultSettings(): Promise<void> {
  let inserted = 0;
  for (const s of DEFAULT_SETTINGS) {
    const result = await dbRun(`
      INSERT INTO site_settings (\`key\`, value, category, label, description, field_type, sort_order, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE
        category = VALUES(category),
        label = VALUES(label),
        description = VALUES(description),
        field_type = VALUES(field_type),
        sort_order = VALUES(sort_order)
    `, [s.key, s.value, s.category, s.label, s.description, s.field_type, s.sort_order]);
    if (result.changes > 0) inserted++;
  }

  // Update legal pages that still have short placeholder content
  const legalKeys = ['privacy_policy', 'terms_conditions', 'cookie_policy', 'refund_policy', 'affiliate_disclosure'];
  for (const key of legalKeys) {
    const existing = await dbGet<any>('SELECT value FROM site_settings WHERE `key` = ?', [key]);
    if (existing && existing.value && existing.value.length < 300) {
      // Still has placeholder — update with full content
      const full = DEFAULT_SETTINGS.find(s => s.key === key);
      if (full && full.value.length > 300) {
        await dbRun('UPDATE site_settings SET value = ?, updated_at = NOW() WHERE `key` = ?', [full.value, key]);
        inserted++;
      }
    }
  }

  if (inserted > 0) {
    logger.info(`  ⚙️  Seeded ${inserted} default settings`);
  }
}

export default router;
