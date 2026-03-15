const express = require('express');
const router = express.Router();
const db = require('../database');

// GET /api/gifts - Lista todos os presentes ativos
router.get('/', (req, res) => {
  try {
    const gifts = db.prepare(`
      SELECT id, emoji, title, description, price, claimed, payment_status, sort_order
      FROM gifts
      WHERE active = 1
      ORDER BY sort_order ASC, id ASC
    `).all();

    res.json(gifts);
  } catch (err) {
    console.error('Erro ao buscar presentes:', err);
    res.status(500).json({ error: 'Erro ao buscar presentes.' });
  }
});

// GET /api/gifts/:id - Detalhes de um presente
router.get('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido.' });

    const gift = db.prepare(`
      SELECT id, emoji, title, description, price, claimed, payment_status
      FROM gifts
      WHERE id = ? AND active = 1
    `).get(id);

    if (!gift) return res.status(404).json({ error: 'Presente não encontrado.' });

    res.json(gift);
  } catch (err) {
    console.error('Erro ao buscar presente:', err);
    res.status(500).json({ error: 'Erro ao buscar presente.' });
  }
});

// GET /api/gifts/messages/all - Recados dos convidados
router.get('/messages/all', (req, res) => {
  try {
    const messages = db.prepare(`
      SELECT m.guest_name, m.message, m.gift_title, m.created_at
      FROM messages m
      WHERE m.approved = 1
      ORDER BY m.created_at DESC
      LIMIT 50
    `).all();

    res.json(messages);
  } catch (err) {
    console.error('Erro ao buscar mensagens:', err);
    res.status(500).json({ error: 'Erro ao buscar mensagens.' });
  }
});

module.exports = router;
