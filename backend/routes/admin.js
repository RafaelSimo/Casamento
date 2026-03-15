const express = require('express');
const router = express.Router();
const { pool } = require('../database');
const bcrypt = require('bcrypt');
const { authenticateToken, generateToken } = require('../middleware/auth');

// Valida e sanitiza input
function sanitize(str, maxLen = 200) {
  if (!str || typeof str !== 'string') return '';
  return str.trim().slice(0, maxLen).replace(/[<>]/g, '');
}

// POST /api/admin/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = sanitize(username, 50);
    const pass = password || '';

    if (!user || !pass) {
      return res.status(400).json({ error: 'Usuário e senha são obrigatórios.' });
    }

    const { rows } = await pool.query('SELECT * FROM admin_users WHERE username = $1', [user]);
    if (rows.length === 0 || !(await bcrypt.compare(pass, rows[0].password_hash))) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    const admin = rows[0];
    const token = generateToken(admin);
    res.json({ token, username: admin.username });
  } catch (err) {
    console.error('Erro no login:', err);
    res.status(500).json({ error: 'Erro ao fazer login.' });
  }
});

// GET /api/admin/dashboard - Estatísticas
router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    const totalGifts = await pool.query('SELECT COUNT(*) as count FROM gifts WHERE active = 1');
    const claimedGifts = await pool.query('SELECT COUNT(*) as count FROM gifts WHERE active = 1 AND claimed = 1');
    const pendingGifts = await pool.query("SELECT COUNT(*) as count FROM gifts WHERE active = 1 AND payment_status = 'pending_confirmation'");
    const totalRaised = await pool.query("SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE status IN ('approved', 'confirmed')");
    const totalMessages = await pool.query('SELECT COUNT(*) as count FROM messages');
    const recentPayments = await pool.query(`
      SELECT p.*, g.emoji, g.title as gift_title
      FROM payments p
      LEFT JOIN gifts g ON g.id = p.gift_id
      ORDER BY p.created_at DESC
      LIMIT 10
    `);

    res.json({
      totalGifts: parseInt(totalGifts.rows[0].count),
      claimedGifts: parseInt(claimedGifts.rows[0].count),
      pendingGifts: parseInt(pendingGifts.rows[0].count),
      totalRaised: parseFloat(totalRaised.rows[0].total),
      totalMessages: parseInt(totalMessages.rows[0].count),
      recentPayments: recentPayments.rows
    });
  } catch (err) {
    console.error('Erro no dashboard:', err);
    res.status(500).json({ error: 'Erro ao carregar dashboard.' });
  }
});

// GET /api/admin/gifts - Lista todos os presentes (admin)
router.get('/gifts', authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM gifts ORDER BY sort_order ASC, id ASC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar presentes.' });
  }
});

// POST /api/admin/gifts - Adicionar presente
router.post('/gifts', authenticateToken, async (req, res) => {
  try {
    const { emoji, title, description, price, sort_order } = req.body;

    const e = sanitize(emoji, 10);
    const t = sanitize(title, 100);
    const d = sanitize(description, 300);
    const p = parseFloat(price);
    const s = parseInt(sort_order, 10) || 0;

    if (!e || !t || !d || isNaN(p) || p <= 0) {
      return res.status(400).json({ error: 'Dados incompletos ou inválidos.' });
    }

    const { rows } = await pool.query(`
      INSERT INTO gifts (emoji, title, description, price, sort_order)
      VALUES ($1, $2, $3, $4, $5) RETURNING id
    `, [e, t, d, p, s]);

    res.json({ id: rows[0].id, message: 'Presente adicionado! 🎁' });
  } catch (err) {
    console.error('Erro ao adicionar presente:', err);
    res.status(500).json({ error: 'Erro ao adicionar presente.' });
  }
});

// PUT /api/admin/gifts/:id - Editar presente
router.put('/gifts/:id', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido.' });

    const { emoji, title, description, price, sort_order, active } = req.body;

    const e = sanitize(emoji, 10);
    const t = sanitize(title, 100);
    const d = sanitize(description, 300);
    const p = parseFloat(price);
    const s = parseInt(sort_order, 10) || 0;
    const a = active !== undefined ? (active ? 1 : 0) : 1;

    if (!e || !t || !d || isNaN(p) || p <= 0) {
      return res.status(400).json({ error: 'Dados incompletos ou inválidos.' });
    }

    await pool.query(`
      UPDATE gifts SET emoji = $1, title = $2, description = $3, price = $4, sort_order = $5, active = $6, updated_at = NOW()
      WHERE id = $7
    `, [e, t, d, p, s, a, id]);

    res.json({ message: 'Presente atualizado! ✅' });
  } catch (err) {
    console.error('Erro ao editar presente:', err);
    res.status(500).json({ error: 'Erro ao editar presente.' });
  }
});

// DELETE /api/admin/gifts/:id - Remover presente
router.delete('/gifts/:id', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido.' });

    await pool.query('UPDATE gifts SET active = 0, updated_at = NOW() WHERE id = $1', [id]);
    res.json({ message: 'Presente removido! 🗑️' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao remover presente.' });
  }
});

// GET /api/admin/payments - Lista pagamentos
router.get('/payments', authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.*, g.emoji, g.title as gift_title
      FROM payments p
      LEFT JOIN gifts g ON g.id = p.gift_id
      ORDER BY p.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar pagamentos.' });
  }
});

// POST /api/admin/payments/:id/confirm - Confirmar PIX manual
router.post('/payments/:id/confirm', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido.' });

    const { rows } = await pool.query('SELECT * FROM payments WHERE id = $1', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Pagamento não encontrado.' });
    const payment = rows[0];

    // Atualiza pagamento
    await pool.query(`
      UPDATE payments SET status = 'confirmed', updated_at = NOW()
      WHERE id = $1
    `, [id]);

    // Marca presente como escolhido
    await pool.query(`
      UPDATE gifts SET
        claimed = 1,
        claimed_by = $1,
        claimed_message = $2,
        claimed_at = NOW(),
        payment_status = 'paid',
        payment_id = $3,
        updated_at = NOW()
      WHERE id = $4
    `, [payment.payer_name, payment.payer_message, payment.external_id, payment.gift_id]);

    res.json({ message: 'Pagamento confirmado! 💰' });
  } catch (err) {
    console.error('Erro ao confirmar pagamento:', err);
    res.status(500).json({ error: 'Erro ao confirmar pagamento.' });
  }
});

// POST /api/admin/payments/:id/reject - Rejeitar pagamento
router.post('/payments/:id/reject', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido.' });

    const { rows } = await pool.query('SELECT * FROM payments WHERE id = $1', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Pagamento não encontrado.' });
    const payment = rows[0];

    await pool.query('UPDATE payments SET status = $1, updated_at = NOW() WHERE id = $2', ['rejected', id]);
    await pool.query('UPDATE gifts SET payment_status = $1, updated_at = NOW() WHERE id = $2', ['available', payment.gift_id]);

    res.json({ message: 'Pagamento rejeitado.' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao rejeitar pagamento.' });
  }
});

// GET /api/admin/messages - Lista mensagens
router.get('/messages', authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM messages ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar mensagens.' });
  }
});

// PUT /api/admin/change-password - Alterar senha
router.put('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Senha deve ter no mínimo 6 caracteres.' });
    }

    const { rows } = await pool.query('SELECT * FROM admin_users WHERE id = $1', [req.user.id]);
    if (rows.length === 0 || !(await bcrypt.compare(currentPassword, rows[0].password_hash))) {
      return res.status(401).json({ error: 'Senha atual incorreta.' });
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await pool.query('UPDATE admin_users SET password_hash = $1 WHERE id = $2', [newHash, req.user.id]);

    res.json({ message: 'Senha alterada com sucesso! 🔐' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao alterar senha.' });
  }
});

module.exports = router;
