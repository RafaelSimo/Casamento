const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');

// Garante que o diretório data existe
const dataDir = path.resolve(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const DB_PATH = path.resolve(dataDir, 'casamento.db');
const db = new Database(DB_PATH);

// Configurações de performance e segurança
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Criação das tabelas
db.exec(`
  CREATE TABLE IF NOT EXISTS gifts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    emoji TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    price REAL NOT NULL,
    claimed INTEGER DEFAULT 0,
    claimed_by TEXT,
    claimed_message TEXT,
    claimed_at TEXT,
    payment_id TEXT,
    payment_status TEXT DEFAULT 'available',
    sort_order INTEGER DEFAULT 0,
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    external_id TEXT UNIQUE NOT NULL,
    gift_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    payer_name TEXT NOT NULL,
    payer_email TEXT,
    payer_message TEXT,
    payment_method TEXT DEFAULT 'mercadopago',
    mercadopago_preference_id TEXT,
    mercadopago_payment_id TEXT,
    status TEXT DEFAULT 'pending',
    pix_manual INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (gift_id) REFERENCES gifts(id)
  );

  CREATE TABLE IF NOT EXISTS admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guest_name TEXT NOT NULL,
    message TEXT NOT NULL,
    gift_title TEXT,
    approved INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// Cria admin padrão se não existir
const adminUser = process.env.ADMIN_USER || 'admin';
const adminPass = process.env.ADMIN_PASSWORD || 'casamento2026';
const adminExists = db.prepare('SELECT id FROM admin_users WHERE username = ?').get(adminUser);

if (!adminExists) {
  const hash = bcrypt.hashSync(adminPass, 12);
  db.prepare('INSERT INTO admin_users (username, password_hash) VALUES (?, ?)').run(adminUser, hash);
  console.log(`👤 Admin criado: ${adminUser}`);
}

module.exports = db;
