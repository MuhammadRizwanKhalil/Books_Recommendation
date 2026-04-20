import { getPool } from '../database.js';
import type { Migration } from '../lib/migrator.js';

export const migration040: Migration = {
  version: 40,
  description: 'Editions browser — works table and edition metadata on books',
  up: async () => {
    const pool = getPool();

    const addColumnIfMissing = async (columnName: string, definitionSql: string) => {
      const [rows] = await pool.query(
        `
          SELECT 1
          FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'books'
            AND COLUMN_NAME = ?
          LIMIT 1
        `,
        [columnName],
      );

      const exists = Array.isArray(rows) && rows.length > 0;
      if (!exists) {
        await pool.query(`ALTER TABLE books ADD COLUMN ${definitionSql}`);
      }
    };

    await pool.query(`
      CREATE TABLE IF NOT EXISTS works (
        id VARCHAR(36) PRIMARY KEY,
        canonical_book_id VARCHAR(36) NOT NULL COMMENT 'The main edition shown by default',
        title VARCHAR(500) NOT NULL COMMENT 'Work-level title',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (canonical_book_id) REFERENCES books(id),
        INDEX idx_canonical (canonical_book_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await addColumnIfMissing('work_id', 'work_id VARCHAR(36) DEFAULT NULL');
    await addColumnIfMissing(
      'edition_format',
      "edition_format ENUM('hardcover','paperback','ebook','audiobook','large_print','mass_market') DEFAULT NULL",
    );
    await addColumnIfMissing('edition_language', "edition_language VARCHAR(10) DEFAULT 'en'");
    await addColumnIfMissing('edition_publisher', 'edition_publisher VARCHAR(255) DEFAULT NULL');
    await addColumnIfMissing('edition_year', 'edition_year YEAR DEFAULT NULL');

    // Add FK and index separately — ALTER TABLE IF NOT EXISTS FK doesn't exist in MySQL 8
    try {
      await pool.query(`ALTER TABLE books ADD CONSTRAINT fk_books_work_id FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE SET NULL`);
    } catch {
      // FK may already exist
    }
    try {
      await pool.query(`ALTER TABLE books ADD INDEX idx_work (work_id)`);
    } catch {
      // Index may already exist
    }
  },
};
