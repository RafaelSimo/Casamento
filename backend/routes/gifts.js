const express = require('express');
const router = express.Router();
const { pool } = require('../database');

// GET /api/gifts - Lista todos os presentes ativos
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT id, emoji, title, description, price, claimed, payment_status, sort_order
      FROM gifts
      WHERE active = 1
      ORDER BY sort_order ASC, id ASC
    `);

    res.json(rows);
  } catch (err) {
    console.error('Erro ao buscar presentes:', err);
    res.status(500).json({ error: 'Erro ao buscar presentes.' });
  }
});

// GET /api/gifts/messages/all - Recados dos convidados (MUST be before /:id)
router.get('/messages/all', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT m.guest_name, m.message, m.gift_title, m.created_at
      FROM messages m
      WHERE m.approved = 1
      ORDER BY m.created_at DESC
      LIMIT 50
    `);

    res.json(rows);
  } catch (err) {
    console.error('Erro ao buscar mensagens:', err);
    res.status(500).json({ error: 'Erro ao buscar mensagens.' });
  }
});

// GET /api/gifts/:id - Detalhes de um presente
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido.' });

    const { rows } = await pool.query(`
      SELECT id, emoji, title, description, price, claimed, payment_status
      FROM gifts
      WHERE id = $1 AND active = 1
    `, [id]);

    if (rows.length === 0) return res.status(404).json({ error: 'Presente não encontrado.' });

    res.json(rows[0]);
  } catch (err) {
    console.error('Erro ao buscar presente:', err);
    res.status(500).json({ error: 'Erro ao buscar presente.' });
  }
});

module.exports = router;
