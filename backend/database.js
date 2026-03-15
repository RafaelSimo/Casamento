const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Inicializa tabelas e admin
async function initDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS gifts (
        id SERIAL PRIMARY KEY,
        emoji TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        price NUMERIC(10,2) NOT NULL,
        claimed INTEGER DEFAULT 0,
        claimed_by TEXT,
        claimed_message TEXT,
        claimed_at TIMESTAMPTZ,
        payment_id TEXT,
        payment_status TEXT DEFAULT 'available',
        sort_order INTEGER DEFAULT 0,
        active INTEGER DEFAULT 1,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        external_id TEXT UNIQUE NOT NULL,
        gift_id INTEGER NOT NULL REFERENCES gifts(id),
        amount NUMERIC(10,2) NOT NULL,
        payer_name TEXT NOT NULL,
        payer_email TEXT,
        payer_message TEXT,
        payment_method TEXT DEFAULT 'mercadopago',
        mercadopago_preference_id TEXT,
        mercadopago_payment_id TEXT,
        status TEXT DEFAULT 'pending',
        pix_manual INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS admin_users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        guest_name TEXT NOT NULL,
        message TEXT NOT NULL,
        gift_title TEXT,
        approved INTEGER DEFAULT 1,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS rsvp (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        guests INTEGER DEFAULT 1,
        message TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Cria admin padrão se não existir
    const adminUser = process.env.ADMIN_USER || 'admin';
    const adminPass = process.env.ADMIN_PASSWORD || 'casamento2026';
    const { rows } = await client.query('SELECT id FROM admin_users WHERE username = $1', [adminUser]);

    if (rows.length === 0) {
      const hash = await bcrypt.hash(adminPass, 12);
      await client.query('INSERT INTO admin_users (username, password_hash) VALUES ($1, $2)', [adminUser, hash]);
      console.log(`👤 Admin criado: ${adminUser}`);
    }
  } finally {
    client.release();
  }
}

module.exports = { pool, initDatabase };
