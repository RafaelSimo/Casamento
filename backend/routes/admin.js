const express = require('express');
const router = express.Router();
const db = require('../database');
const bcrypt = require('bcrypt');
const { authenticateToken, generateToken } = require('../middleware/auth');

// Valida e sanitiza input
function sanitize(str, maxLen = 200) {
  if (!str || typeof str !== 'string') return '';
  return str.trim().slice(0, maxLen).replace(/[<>]/g, '');
}

// POST /api/admin/login
router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;
    const user = sanitize(username, 50);
    const pass = password || '';

    if (!user || !pass) {
      return res.status(400).json({ error: 'Usuário e senha são obrigatórios.' });
    }

    const admin = db.prepare('SELECT * FROM admin_users WHERE username = ?').get(user);
    if (!admin || !bcrypt.compareSync(pass, admin.password_hash)) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    const token = generateToken(admin);
    res.json({ token, username: admin.username });
  } catch (err) {
    console.error('Erro no login:', err);
    res.status(500).json({ error: 'Erro ao fazer login.' });
  }
});

// GET /api/admin/dashboard - Estatísticas
router.get('/dashboard', authenticateToken, (req, res) => {
  try {
    const totalGifts = db.prepare('SELECT COUNT(*) as count FROM gifts WHERE active = 1').get();
    const claimedGifts = db.prepare('SELECT COUNT(*) as count FROM gifts WHERE active = 1 AND claimed = 1').get();
    const pendingGifts = db.prepare("SELECT COUNT(*) as count FROM gifts WHERE active = 1 AND payment_status = 'pending_confirmation'").get();
    const totalRaised = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE status IN ('approved', 'confirmed')").get();
    const totalMessages = db.prepare('SELECT COUNT(*) as count FROM messages').get();
    const recentPayments = db.prepare(`
      SELECT p.*, g.emoji, g.title as gift_title
      FROM payments p
      LEFT JOIN gifts g ON g.id = p.gift_id
      ORDER BY p.created_at DESC
      LIMIT 10
    `).all();

    res.json({
      totalGifts: totalGifts.count,
      claimedGifts: claimedGifts.count,
      pendingGifts: pendingGifts.count,
      totalRaised: totalRaised.total,
      totalMessages: totalMessages.count,
      recentPayments
    });
  } catch (err) {
    console.error('Erro no dashboard:', err);
    res.status(500).json({ error: 'Erro ao carregar dashboard.' });
  }
});

// GET /api/admin/gifts - Lista todos os presentes (admin)
router.get('/gifts', authenticateToken, (req, res) => {
  try {
    const gifts = db.prepare('SELECT * FROM gifts ORDER BY sort_order ASC, id ASC').all();
    res.json(gifts);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar presentes.' });
  }
});

// POST /api/admin/gifts - Adicionar presente
router.post('/gifts', authenticateToken, (req, res) => {
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

    const result = db.prepare(`
      INSERT INTO gifts (emoji, title, description, price, sort_order)
      VALUES (?, ?, ?, ?, ?)
    `).run(e, t, d, p, s);

    res.json({ id: result.lastInsertRowid, message: 'Presente adicionado! 🎁' });
  } catch (err) {
    console.error('Erro ao adicionar presente:', err);
    res.status(500).json({ error: 'Erro ao adicionar presente.' });
  }
});

// PUT /api/admin/gifts/:id - Editar presente
router.put('/gifts/:id', authenticateToken, (req, res) => {
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

    db.prepare(`
      UPDATE gifts SET emoji = ?, title = ?, description = ?, price = ?, sort_order = ?, active = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(e, t, d, p, s, a, id);

    res.json({ message: 'Presente atualizado! ✅' });
  } catch (err) {
    console.error('Erro ao editar presente:', err);
    res.status(500).json({ error: 'Erro ao editar presente.' });
  }
});

// DELETE /api/admin/gifts/:id - Remover presente
router.delete('/gifts/:id', authenticateToken, (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido.' });

    db.prepare('UPDATE gifts SET active = 0, updated_at = datetime(\'now\') WHERE id = ?').run(id);
    res.json({ message: 'Presente removido! 🗑️' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao remover presente.' });
  }
});

// GET /api/admin/payments - Lista pagamentos
router.get('/payments', authenticateToken, (req, res) => {
  try {
    const payments = db.prepare(`
      SELECT p.*, g.emoji, g.title as gift_title
      FROM payments p
      LEFT JOIN gifts g ON g.id = p.gift_id
      ORDER BY p.created_at DESC
    `).all();
    res.json(payments);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar pagamentos.' });
  }
});

// POST /api/admin/payments/:id/confirm - Confirmar PIX manual
router.post('/payments/:id/confirm', authenticateToken, (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido.' });

    const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(id);
    if (!payment) return res.status(404).json({ error: 'Pagamento não encontrado.' });

    // Atualiza pagamento
    db.prepare(`
      UPDATE payments SET status = 'confirmed', updated_at = datetime('now')
      WHERE id = ?
    `).run(id);

    // Marca presente como escolhido
    db.prepare(`
      UPDATE gifts SET
        claimed = 1,
        claimed_by = ?,
        claimed_message = ?,
        claimed_at = datetime('now'),
        payment_status = 'paid',
        payment_id = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(payment.payer_name, payment.payer_message, payment.external_id, payment.gift_id);

    res.json({ message: 'Pagamento confirmado! 💰' });
  } catch (err) {
    console.error('Erro ao confirmar pagamento:', err);
    res.status(500).json({ error: 'Erro ao confirmar pagamento.' });
  }
});

// POST /api/admin/payments/:id/reject - Rejeitar pagamento
router.post('/payments/:id/reject', authenticateToken, (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido.' });

    const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(id);
    if (!payment) return res.status(404).json({ error: 'Pagamento não encontrado.' });

    db.prepare(`UPDATE payments SET status = 'rejected', updated_at = datetime('now') WHERE id = ?`).run(id);
    db.prepare(`UPDATE gifts SET payment_status = 'available', updated_at = datetime('now') WHERE id = ?`).run(payment.gift_id);

    res.json({ message: 'Pagamento rejeitado.' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao rejeitar pagamento.' });
  }
});

// GET /api/admin/messages - Lista mensagens
router.get('/messages', authenticateToken, (req, res) => {
  try {
    const messages = db.prepare('SELECT * FROM messages ORDER BY created_at DESC').all();
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar mensagens.' });
  }
});

// PUT /api/admin/change-password - Alterar senha
router.put('/change-password', authenticateToken, (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Senha deve ter no mínimo 6 caracteres.' });
    }

    const admin = db.prepare('SELECT * FROM admin_users WHERE id = ?').get(req.user.id);
    if (!admin || !bcrypt.compareSync(currentPassword, admin.password_hash)) {
      return res.status(401).json({ error: 'Senha atual incorreta.' });
    }

    const newHash = bcrypt.hashSync(newPassword, 12);
    db.prepare('UPDATE admin_users SET password_hash = ? WHERE id = ?').run(newHash, req.user.id);

    res.json({ message: 'Senha alterada com sucesso! 🔐' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao alterar senha.' });
  }
});

module.exports = router;
