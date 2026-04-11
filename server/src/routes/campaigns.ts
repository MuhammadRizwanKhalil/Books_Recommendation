import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../lib/logger.js';
import { dbGet, dbAll, dbRun } from '../database.js';
import { authenticate, requireAdmin, rateLimit } from '../middleware.js';
import { sendBulkEmails, sendEmail, wrapInBaseTemplate, getSiteSetting } from '../services/email.js';

const router = Router();

// ── GET /api/campaigns — list all campaigns ─────────────────────────────────

router.get('/', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const status = req.query.status as string;
    const offset = (page - 1) * limit;

    let where = '1=1';
    const params: any[] = [];

    if (status) {
      where += ' AND status = ?';
      params.push(status);
    }

    const totalRow = await dbGet<any>(`SELECT COUNT(*) as count FROM email_campaigns WHERE ${where}`, [...params]);
    const total = totalRow.count;

    const campaigns = await dbAll<any>(`
      SELECT ec.*, u.name as creator_name
      FROM email_campaigns ec
      LEFT JOIN users u ON u.id = ec.created_by
      WHERE ${where}
      ORDER BY ec.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    res.json({
      campaigns,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch campaigns' });
  }
});

// ── Email Templates (must be BEFORE /:id to avoid route shadowing) ──────────

router.get('/templates/list', authenticate, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const templates = await dbAll<any>('SELECT * FROM email_templates ORDER BY created_at DESC', []);
    res.json({ templates });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

router.post('/templates', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { name, subject, html_content, plain_content, template_type = 'campaign', variables } = req.body;
    if (!name || !subject) {
      res.status(400).json({ error: 'Name and subject required' });
      return;
    }

    const id = uuidv4();
    await dbRun(`
      INSERT INTO email_templates (id, name, subject, html_content, plain_content, template_type, variables)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [id, name, subject, html_content || '', plain_content || null, template_type, variables || null]);

    const template = await dbGet<any>('SELECT * FROM email_templates WHERE id = ?', [id]);
    res.status(201).json(template);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create template' });
  }
});

router.put('/templates/:id', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { name, subject, html_content, plain_content, template_type, variables } = req.body;
    if (!name && !subject) {
      res.status(400).json({ error: 'Name or subject required' });
      return;
    }

    const existing = await dbGet<any>('SELECT * FROM email_templates WHERE id = ?', [req.params.id]);
    if (!existing) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }

    await dbRun(`
      UPDATE email_templates SET name = ?, subject = ?, html_content = ?, plain_content = ?, template_type = ?, variables = ?, updated_at = NOW()
      WHERE id = ?
    `, [
      name || existing.name,
      subject || existing.subject,
      html_content ?? existing.html_content,
      plain_content ?? existing.plain_content,
      template_type || existing.template_type,
      variables ?? existing.variables,
      req.params.id
    ]);

    const template = await dbGet<any>('SELECT * FROM email_templates WHERE id = ?', [req.params.id]);
    res.json(template);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update template' });
  }
});

router.delete('/templates/:id', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    await dbRun('DELETE FROM email_templates WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

// ── AI Email Generation (before /:id) ───────────────────────────────────────

router.post('/ai-generate', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { prompt, campaign_type = 'newsletter', tone = 'friendly' } = req.body;

    if (!prompt) {
      res.status(400).json({ error: 'Prompt is required' });
      return;
    }

    // Log the AI generation request
    const logId = uuidv4();
    await dbRun(`
      INSERT INTO ai_email_log (id, prompt, model_used, status, created_by)
      VALUES (?, ?, 'built-in', 'generating', ?)
    `, [logId, prompt, req.user!.userId]);

    const siteName = await getSiteSetting('site_name', 'The Book Times');

    const recentBooks = await dbAll<any>(`
      SELECT title, author, description, cover_image, computed_score
      FROM books WHERE is_active = 1
      ORDER BY created_at DESC LIMIT 5
    `, []);

    const topBooks = await dbAll<any>(`
      SELECT title, author, computed_score
      FROM books WHERE is_active = 1
      ORDER BY computed_score DESC LIMIT 5
    `, []);

    const generated = generateAIEmail(prompt, campaign_type, tone, siteName, recentBooks, topBooks);

    await dbRun(`
      UPDATE ai_email_log
      SET generated_subject = ?, generated_content = ?, status = 'generated'
      WHERE id = ?
    `, [generated.subject, generated.html, logId]);

    res.json({
      subject: generated.subject,
      html_content: generated.html,
      plain_content: generated.plain,
      log_id: logId,
    });
  } catch (err: any) {
    logger.error({ err: err }, 'AI generation error');
    res.status(500).json({ error: 'Failed to generate email content' });
  }
});

// ── GET /api/campaigns/:id — get campaign details ───────────────────────────

router.get('/:id', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const campaign = await dbGet<any>(`
      SELECT ec.*, u.name as creator_name
      FROM email_campaigns ec
      LEFT JOIN users u ON u.id = ec.created_by
      WHERE ec.id = ?
    `, [req.params.id]);

    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }

    // Get recipient stats
    const recipientStats = await dbAll<any>(`
      SELECT status, COUNT(*) as count
      FROM campaign_recipients
      WHERE campaign_id = ?
      GROUP BY status
    `, [req.params.id]);

    res.json({ campaign, recipientStats });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch campaign' });
  }
});

// ── POST /api/campaigns — create campaign ───────────────────────────────────

router.post('/', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const {
      name, subject, preview_text, html_content, plain_content,
      campaign_type = 'manual', target_audience = 'all_subscribers',
      segment_filter, scheduled_at,
    } = req.body;

    if (!name || !subject) {
      res.status(400).json({ error: 'Name and subject are required' });
      return;
    }

    const id = uuidv4();
    const status = scheduled_at ? 'scheduled' : 'draft';

    await dbRun(`
      INSERT INTO email_campaigns (id, name, subject, preview_text, html_content, plain_content, status, campaign_type, target_audience, segment_filter, scheduled_at, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, name, subject, preview_text || null, html_content || '', plain_content || null, status, campaign_type, target_audience, segment_filter || null, scheduled_at || null, req.user!.userId]);

    const campaign = await dbGet<any>('SELECT * FROM email_campaigns WHERE id = ?', [id]);
    res.status(201).json(campaign);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create campaign' });
  }
});

// ── PUT /api/campaigns/:id — update campaign ────────────────────────────────

router.put('/:id', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const campaign = await dbGet<any>('SELECT * FROM email_campaigns WHERE id = ?', [req.params.id]);
    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }

    if (campaign.status === 'sent' || campaign.status === 'sending') {
      res.status(400).json({ error: 'Cannot edit a campaign that is already sent or sending' });
      return;
    }

    const {
      name, subject, preview_text, html_content, plain_content,
      target_audience, segment_filter, scheduled_at,
    } = req.body;

    await dbRun(`
      UPDATE email_campaigns SET
        name = COALESCE(?, name),
        subject = COALESCE(?, subject),
        preview_text = COALESCE(?, preview_text),
        html_content = COALESCE(?, html_content),
        plain_content = COALESCE(?, plain_content),
        target_audience = COALESCE(?, target_audience),
        segment_filter = ?,
        scheduled_at = ?,
        updated_at = NOW()
      WHERE id = ?
    `, [name, subject, preview_text, html_content, plain_content, target_audience, segment_filter || null, scheduled_at || null, req.params.id]);

    const updated = await dbGet<any>('SELECT * FROM email_campaigns WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update campaign' });
  }
});

// ── DELETE /api/campaigns/:id — delete campaign ─────────────────────────────

router.delete('/:id', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const campaign = await dbGet<any>('SELECT * FROM email_campaigns WHERE id = ?', [req.params.id]);
    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }
    if (campaign.status === 'sending') {
      res.status(400).json({ error: 'Cannot delete campaign that is currently sending' });
      return;
    }

    await dbRun('DELETE FROM campaign_recipients WHERE campaign_id = ?', [req.params.id]);
    await dbRun('DELETE FROM ai_email_log WHERE campaign_id = ?', [req.params.id]);
    await dbRun('DELETE FROM email_campaigns WHERE id = ?', [req.params.id]);

    res.json({ success: true, message: 'Campaign deleted' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete campaign' });
  }
});

// ── POST /api/campaigns/:id/send — send campaign ───────────────────────────

router.post('/:id/send', authenticate, requireAdmin, rateLimit('campaign-send', 5, 60 * 60 * 1000), async (req: Request, res: Response) => {
  try {
    const campaign = await dbGet<any>('SELECT * FROM email_campaigns WHERE id = ?', [req.params.id]);
    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }
    if (campaign.status === 'sent' || campaign.status === 'sending') {
      res.status(400).json({ error: 'Campaign already sent or sending' });
      return;
    }
    if (!campaign.html_content) {
      res.status(400).json({ error: 'Campaign has no email content' });
      return;
    }

    // Get target subscribers
    let subscriberQuery = 'SELECT id, email, name FROM newsletter_subscribers WHERE is_active = 1';
    if (campaign.target_audience === 'active_only') {
      subscriberQuery += " AND subscribed_at > DATE_SUB(NOW(), INTERVAL 90 DAY)";
    }
    const subscribers = await dbAll<any>(subscriberQuery, []);

    if (subscribers.length === 0) {
      res.status(400).json({ error: 'No subscribers to send to' });
      return;
    }

    // Mark as sending
    await dbRun(`
      UPDATE email_campaigns
      SET status = 'sending', sent_at = NOW(), total_recipients = ?
      WHERE id = ?
    `, [subscribers.length, req.params.id]);

    // Create recipient records
    const recipients: { id: string; email: string; name?: string }[] = [];

    for (const sub of subscribers) {
      const recipientId = uuidv4();
      await dbRun(`
        INSERT INTO campaign_recipients (id, campaign_id, subscriber_id, email, status)
        VALUES (?, ?, ?, ?, 'pending')
      `, [recipientId, req.params.id, sub.id, sub.email]);
      recipients.push({ id: recipientId, email: sub.email, name: sub.name });
    }

    // Wrap content in base template
    const fullHtml = await wrapInBaseTemplate(campaign.html_content, campaign.subject);

    // Send emails (async, respond immediately)
    res.json({
      message: 'Campaign sending started',
      totalRecipients: subscribers.length,
    });

    // Send in background
    try {
      const result = await sendBulkEmails(recipients, campaign.subject, fullHtml, req.params.id as string);

      // Update campaign status
      await dbRun(`
        UPDATE email_campaigns
        SET status = 'sent', sent_count = ?, updated_at = NOW()
        WHERE id = ?
      `, [result.sent, req.params.id]);

      logger.info(`📧 Campaign "${campaign.name}" sent: ${result.sent} delivered, ${result.failed} failed`);
    } catch (err: any) {
      logger.error({ err: err }, 'Campaign send error');
      await dbRun(`
        UPDATE email_campaigns SET status = 'failed', updated_at = NOW() WHERE id = ?
      `, [req.params.id]);
    }
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to send campaign' });
  }
});

// ── POST /api/campaigns/:id/test — send test email ─────────────────────────

router.post('/:id/test', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const campaign = await dbGet<any>('SELECT * FROM email_campaigns WHERE id = ?', [req.params.id]);
    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }

    const testEmail = req.body.email || req.user!.email;
    const fullHtml = await wrapInBaseTemplate(campaign.html_content || '<p>No content</p>', campaign.subject);

    const result = await sendEmail({
      to: testEmail,
      subject: `[TEST] ${campaign.subject}`,
      html: fullHtml,
    });

    res.json({ success: result.success, email: testEmail, error: result.error });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to send test email' });
  }
});

// ── GET /api/campaigns/:id/recipients — list recipients ─────────────────────

router.get('/:id/recipients', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;

    const totalRow = await dbGet<any>('SELECT COUNT(*) as count FROM campaign_recipients WHERE campaign_id = ?', [req.params.id]);
    const total = totalRow.count;

    const recipients = await dbAll<any>(`
      SELECT * FROM campaign_recipients
      WHERE campaign_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `, [req.params.id, limit, offset]);

    res.json({
      recipients,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch recipients' });
  }
});

// ── Built-in AI email generator ─────────────────────────────────────────────

function generateAIEmail(
  prompt: string,
  campaignType: string,
  tone: string,
  siteName: string,
  recentBooks: any[],
  topBooks: any[],
): { subject: string; html: string; plain: string } {
  const promptLower = prompt.toLowerCase();

  // Determine email focus
  const isNewBooks = promptLower.includes('new') || promptLower.includes('release') || promptLower.includes('latest');
  const isTopRated = promptLower.includes('top') || promptLower.includes('best') || promptLower.includes('rated');
  const isDigest = promptLower.includes('digest') || promptLower.includes('weekly') || promptLower.includes('monthly');
  const isSpecialOffer = promptLower.includes('sale') || promptLower.includes('offer') || promptLower.includes('deal') || promptLower.includes('discount');
  const isHoliday = promptLower.includes('holiday') || promptLower.includes('christmas') || promptLower.includes('summer') || promptLower.includes('valentine');

  // Tone modifiers
  const toneIntros: Record<string, string> = {
    friendly: "Hey there, fellow bookworm! 📚",
    professional: "Dear Reader,",
    casual: "What's up, bookworm! 🎉",
    enthusiastic: "OMG, you won't believe what we've got for you! 🤩📖",
    warm: "We hope this email finds you curled up with a good book! 📖☕",
  };

  const intro = toneIntros[tone] || toneIntros.friendly;
  let subject = '';
  let bodyHtml = '';

  if (isNewBooks) {
    subject = `📚 Fresh Reads Just Dropped on ${siteName}!`;
    bodyHtml = `
      <p>${intro}</p>
      <p>We've got some exciting new additions to our library that we couldn't wait to share with you!</p>
      <h3>🆕 Newest Arrivals</h3>
      ${generateBookList(recentBooks)}
      <p>${prompt.includes('?') ? prompt : `Based on your interests: "${prompt}"`}</p>
      <p>Dive in and discover your next page-turner!</p>
      <a href="{{site_url}}" class="btn">Browse New Arrivals →</a>
    `;
  } else if (isTopRated) {
    subject = `⭐ Top Rated Books Our Readers Can't Stop Talking About`;
    bodyHtml = `
      <p>${intro}</p>
      <p>Our community has spoken! Here are the top-rated books that everyone is loving right now.</p>
      <h3>🏆 Community Favorites</h3>
      ${generateBookList(topBooks)}
      <p>Don't miss out on these must-reads!</p>
      <a href="{{site_url}}" class="btn">See All Top Rated →</a>
    `;
  } else if (isDigest) {
    subject = `📖 Your ${siteName} Reading Digest`;
    bodyHtml = `
      <p>${intro}</p>
      <p>Here's your curated reading digest with the best picks from our collection.</p>
      <h3>🆕 New on ${siteName}</h3>
      ${generateBookList(recentBooks.slice(0, 3))}
      <h3>⭐ Top Rated This Period</h3>
      ${generateBookList(topBooks.slice(0, 3))}
      <p>Happy reading! And remember, every great adventure starts with turning the first page.</p>
      <a href="{{site_url}}" class="btn">Explore ${siteName} →</a>
    `;
  } else if (isSpecialOffer) {
    subject = `🔥 Exclusive Book Deals Just for You!`;
    bodyHtml = `
      <p>${intro}</p>
      <p><strong>We've curated some amazing deals on books you'll love!</strong></p>
      <p>${prompt}</p>
      <h3>📚 Featured Deals</h3>
      ${generateBookList(recentBooks.slice(0, 4))}
      <p>These deals won't last long — grab your favorites while you can!</p>
      <a href="{{site_url}}" class="btn">Shop Deals Now →</a>
    `;
  } else if (isHoliday) {
    subject = `🎄 Holiday Reading Guide from ${siteName}`;
    bodyHtml = `
      <p>${intro}</p>
      <p>The holidays are the perfect time to curl up with a great book (or gift one to someone you love)!</p>
      <h3>🎁 Gift-Worthy Reads</h3>
      ${generateBookList(topBooks)}
      <p>${prompt}</p>
      <p>Happy holidays and happy reading! 🎄📖</p>
      <a href="{{site_url}}" class="btn">Browse Holiday Picks →</a>
    `;
  } else {
    // General / custom prompt
    subject = `📚 ${prompt.slice(0, 60)}${prompt.length > 60 ? '...' : ''} — ${siteName}`;
    bodyHtml = `
      <p>${intro}</p>
      <p>${prompt}</p>
      <h3>📖 Recommended For You</h3>
      ${generateBookList(recentBooks.slice(0, 3))}
      <h3>🌟 Community Picks</h3>
      ${generateBookList(topBooks.slice(0, 3))}
      <p>Discover more books curated just for you on ${siteName}.</p>
      <a href="{{site_url}}" class="btn">Explore ${siteName} →</a>
    `;
  }

  const plainText = bodyHtml
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return { subject, html: bodyHtml, plain: plainText };
}

function generateBookList(books: any[]): string {
  if (!books || books.length === 0) {
    return '<p><em>Check out our latest collection on the website!</em></p>';
  }

  return books.map((b) => `
    <div class="book-card" style="border: 1px solid #e4e4e7; border-radius: 8px; padding: 12px; margin: 8px 0;">
      <div>
        <strong>${b.title}</strong> by ${b.author}<br/>
        ${b.computed_score ? `⭐ ${(b.computed_score / 10).toFixed(1)}/10` : ''}
        ${b.description ? `<br/><small style="color:#71717a;">${b.description.slice(0, 100)}...</small>` : ''}
      </div>
    </div>
  `).join('');
}

export default router;
