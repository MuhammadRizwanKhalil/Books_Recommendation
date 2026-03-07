import mysql, { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { v4 as uuidv4 } from 'uuid';
import { config } from './config.js';
import { runMigrations } from './lib/migrator.js';
import { logger } from './lib/logger.js';

// ── MySQL Connection Pool ───────────────────────────────────────────────────

let pool: Pool;

export function getPool(): Pool {
  return pool;
}

/**
 * Initialize the MySQL connection pool.
 * Must be called before any DB operations.
 */
export async function initPool(): Promise<void> {
  pool = mysql.createPool({
    host: config.mysql.host,
    port: config.mysql.port,
    user: config.mysql.user,
    password: config.mysql.password,
    database: config.mysql.database,
    waitForConnections: true,
    connectionLimit: config.mysql.connectionLimit,
    queueLimit: 100,
    charset: 'utf8mb4',
    timezone: '+00:00',
    // Return dates as strings (consistent with previous SQLite behavior)
    dateStrings: true,
  });

  // Retry connection up to 10 times with exponential backoff (Docker compose race)
  let retries = 10;
  let delay = 1000;
  while (retries > 0) {
    try {
      const conn = await pool.getConnection();
      logger.info(`  🔌 MySQL connected: ${config.mysql.host}:${config.mysql.port}/${config.mysql.database}`);
      conn.release();
      return;
    } catch (err: any) {
      retries--;
      if (retries === 0) {
        throw new Error(`Failed to connect to MySQL after 10 attempts: ${err.message}`);
      }
      logger.info(`  ⚠️  MySQL not ready, retrying in ${delay / 1000}s... (${retries} attempts left)`);
      await new Promise(r => setTimeout(r, delay));
      delay = Math.min(delay * 2, 10000);
    }
  }
}

/**
 * Close the pool (for graceful shutdown).
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
  }
}

// ── Query Helper Functions ──────────────────────────────────────────────────
// These provide a simple API similar to better-sqlite3 but async.

/**
 * Sanitize query parameters: convert ISO 8601 datetime strings (with 'T' and 'Z')
 * into MySQL-compatible 'YYYY-MM-DD HH:MM:SS' format.
 * MySQL DATETIME columns reject the ISO 'T' separator and 'Z' suffix.
 */
function sanitizeParams(params: any[]): any[] {
  return params.map(p => {
    if (typeof p === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(p)) {
      return p.slice(0, 19).replace('T', ' ');
    }
    return p;
  });
}

/**
 * Execute a SELECT and return the first row, or null.
 */
export async function dbGet<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  const [rows] = await pool.query<RowDataPacket[]>(sql, sanitizeParams(params));
  return (rows[0] as T) || null;
}

/**
 * Execute a SELECT and return all rows.
 */
export async function dbAll<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const [rows] = await pool.query<RowDataPacket[]>(sql, sanitizeParams(params));
  return rows as T[];
}

/**
 * Execute an INSERT/UPDATE/DELETE and return affected rows info.
 */
export async function dbRun(sql: string, params: any[] = []): Promise<{ changes: number; insertId: number }> {
  const [result] = await pool.query<ResultSetHeader>(sql, sanitizeParams(params));
  return { changes: result.affectedRows, insertId: result.insertId };
}

/**
 * Execute raw SQL (no params). Used for schema creation.
 * Splits multi-statement strings and executes each individually.
 */
export async function dbExec(sql: string): Promise<void> {
  // Split by semicolons, handling comments and strings roughly
  const statements = sql
    .split(/;\s*\n/)
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  for (const stmt of statements) {
    await pool.query(stmt);
  }
}

/**
 * Run a function inside a MySQL transaction.
 * The connection is passed in so all queries use the same connection.
 */
export async function dbTransaction<T>(
  fn: (conn: PoolConnection) => Promise<T>,
): Promise<T> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// ── Schema ──────────────────────────────────────────────────────────────────

export async function initDatabase(): Promise<void> {
  // ── Run versioned migrations (creates/updates all tables + indexes) ──
  await runMigrations();

  // ── Auto-link unlinked authors ────────────────────────────────────────
  try {
    const [unlinked] = await pool.execute<RowDataPacket[]>(
      "SELECT DISTINCT author FROM books WHERE author IS NOT NULL AND author != '' AND (author_id IS NULL OR author_id = '')",
    );
    if ((unlinked as any[]).length > 0) {
      logger.info(`  📝 Linking ${(unlinked as any[]).length} unlinked author(s)…`);
      let created = 0;
      for (const row of unlinked as any[]) {
        const [existing] = await pool.execute<RowDataPacket[]>('SELECT id FROM authors WHERE name = ?', [row.author]);
        let authorId: string;
        if ((existing as any[]).length > 0) {
          authorId = (existing as any[])[0].id;
        } else {
          authorId = uuidv4();
          const slug = row.author.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 80);
          try {
            await pool.execute('INSERT INTO authors (id, name, slug) VALUES (?, ?, ?)', [authorId, row.author, slug]);
          } catch {
            await pool.execute('INSERT INTO authors (id, name, slug) VALUES (?, ?, ?)', [authorId, row.author, `${slug}-${Date.now()}`]);
          }
          created++;
        }
        await pool.execute("UPDATE books SET author_id = ? WHERE author = ? AND (author_id IS NULL OR author_id = '')", [authorId, row.author]);
      }
      logger.info(`  ✅ Linked ${(unlinked as any[]).length} authors (${created} newly created)`);
    }
  } catch (err) {
    logger.error({ err: err }, '⚠️ Author migration warning');
  }

  logger.info('✅ Database schema initialized');
}
