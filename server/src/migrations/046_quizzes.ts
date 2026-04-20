import { dbRun } from '../database.js';
import type { Migration } from '../lib/migrator.js';

export const migration046: Migration = {
  version: 46,
  description: 'Quizzes and trivia',
  async up() {
    await dbRun(`
      CREATE TABLE IF NOT EXISTS quizzes (
        id VARCHAR(36) PRIMARY KEY,
        title VARCHAR(300) NOT NULL,
        description TEXT DEFAULT NULL,
        book_id VARCHAR(36) DEFAULT NULL COMMENT 'NULL for general quizzes',
        created_by VARCHAR(36) NOT NULL,
        question_count INT DEFAULT 0,
        attempt_count INT DEFAULT 0,
        avg_score DECIMAL(5,2) DEFAULT NULL,
        is_published BOOLEAN DEFAULT FALSE,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE SET NULL,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_book_quizzes (book_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await dbRun(`
      CREATE TABLE IF NOT EXISTS quiz_questions (
        id VARCHAR(36) PRIMARY KEY,
        quiz_id VARCHAR(36) NOT NULL,
        question_text TEXT NOT NULL,
        question_order INT NOT NULL,
        FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await dbRun(`
      CREATE TABLE IF NOT EXISTS quiz_answers (
        id VARCHAR(36) PRIMARY KEY,
        question_id VARCHAR(36) NOT NULL,
        answer_text VARCHAR(500) NOT NULL,
        is_correct BOOLEAN DEFAULT FALSE,
        FOREIGN KEY (question_id) REFERENCES quiz_questions(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await dbRun(`
      CREATE TABLE IF NOT EXISTS quiz_attempts (
        id VARCHAR(36) PRIMARY KEY,
        quiz_id VARCHAR(36) NOT NULL,
        user_id VARCHAR(36) NOT NULL,
        score INT NOT NULL,
        total_questions INT NOT NULL,
        completed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_attempts (user_id, completed_at DESC)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  },
};
