const express = require('express');
const router = express.Router();
const { pool } = require('../database');
const { v4: uuidv4 } = require('uuid');

// Inicializa Mercado Pago (lazy - só quando configurado)
let mpPreference = null;
let mpPayment = null;

function initMercadoPago() {
  if (mpPreference) return true;
  if (!process.env.MP_ACCESS_TOKEN || process.env.MP_ACCESS_TOKEN.includes('0000000')) {
    return false;
  }
  try {
    const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');
    const client = new MercadoPagoConfig({
      accessToken: process.env.MP_ACCESS_TOKEN
    });
    mpPreference = new Preference(client);
    mpPayment = new Payment(client);
    return true;
  } catch (err) {
    console.error('Erro ao inicializar Mercado Pago:', err.message);
    return false;
  }
}

// Valida e sanitiza input
function sanitize(str, maxLen = 200) {
  if (!str || typeof str !== 'string') return '';
  return str.trim().slice(0, maxLen).replace(/[<>]/g, '');
}

// POST /api/payments/create - Cria pagamento via Mercado Pago
router.post('/create', async (req, res) => {
  try {
    const { giftId, payerName, payerEmail, message } = req.body;

    // Validações
    const id = parseInt(giftId, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Presente inválido.' });

    const name = sanitize(payerName, 100);
    if (!name) return res.status(400).json({ error: 'Nome é obrigatório.' });

    const email = sanitize(payerEmail, 150);
    const msg = sanitize(message, 500);

    // Verifica se presente existe e está disponível
    const { rows: giftRows } = await pool.query('SELECT * FROM gifts WHERE id = $1 AND active = 1', [id]);
    if (giftRows.length === 0) return res.status(404).json({ error: 'Presente não encontrado.' });
    const gift = giftRows[0];

    if (gift.claimed) {
      return res.status(409).json({ error: 'Este presente já foi escolhido por outro convidado! 😅' });
    }

    // Verifica reservas pendentes recentes (últimos 30 min)
    const { rows: pendingRows } = await pool.query(`
      SELECT id FROM payments
      WHERE gift_id = $1 AND status = 'pending' AND pix_manual = 0
      AND created_at > NOW() - INTERVAL '30 minutes'
    `, [id]);

    if (pendingRows.length > 0) {
      return res.status(409).json({
        error: 'Este presente está sendo adquirido por outro convidado. Tente novamente em alguns minutos! ⏳'
      });
    }

    // Verifica se Mercado Pago está configurado
    if (!initMercadoPago()) {
      return res.status(503).json({
        error: 'Pagamento online não configurado. Use a opção PIX manual.'
      });
    }

    // Cria registro de pagamento
    const externalId = uuidv4();
    const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

    await pool.query(`
      INSERT INTO payments (external_id, gift_id, amount, payer_name, payer_email, payer_message, payment_method, status)
      VALUES ($1, $2, $3, $4, $5, $6, 'mercadopago', 'pending')
    `, [externalId, id, gift.price, name, email, msg]);

    // Cria preferência no Mercado Pago
    const preference = await mpPreference.create({
      body: {
        items: [{
          id: `gift-${id}`,
          title: `Presente de Casamento: ${gift.emoji} ${gift.title}`,
          description: gift.description,
          quantity: 1,
          unit_price: parseFloat(gift.price),
          currency_id: 'BRL'
        }],
        payer: {
          name: name,
          email: email || undefined
        },
        back_urls: {
          success: `${BASE_URL}/?payment=success&gift=${id}`,
          failure: `${BASE_URL}/?payment=failure&gift=${id}`,
          pending: `${BASE_URL}/?payment=pending&gift=${id}`
        },
        auto_return: 'approved',
        notification_url: `${BASE_URL}/api/payments/webhook`,
        external_reference: externalId,
        statement_descriptor: 'CASAMENTO R&A',
        expires: true,
        expiration_date_from: new Date().toISOString(),
        expiration_date_to: new Date(Date.now() + 30 * 60 * 1000).toISOString()
      }
    });

    // Atualiza pagamento com ID da preferência
    await pool.query(`
      UPDATE payments SET mercadopago_preference_id = $1, updated_at = NOW()
      WHERE external_id = $2
    `, [preference.id, externalId]);

    res.json({
      preferenceId: preference.id,
      initPoint: preference.init_point,
      sandboxInitPoint: preference.sandbox_init_point
    });

  } catch (err) {
    console.error('Erro ao criar pagamento:', err);
    res.status(500).json({ error: 'Erro ao processar pagamento. Tente novamente.' });
  }
});

// POST /api/payments/pix-manual - Registra pagamento PIX manual
router.post('/pix-manual', async (req, res) => {
  try {
    const { giftId, payerName, message } = req.body;

    const id = parseInt(giftId, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Presente inválido.' });

    const name = sanitize(payerName, 100);
    if (!name) return res.status(400).json({ error: 'Nome é obrigatório.' });

    const msg = sanitize(message, 500);

    // Verifica presente
    const { rows: giftRows } = await pool.query('SELECT * FROM gifts WHERE id = $1 AND active = 1', [id]);
    if (giftRows.length === 0) return res.status(404).json({ error: 'Presente não encontrado.' });
    const gift = giftRows[0];

    if (gift.claimed) {
      return res.status(409).json({ error: 'Este presente já foi escolhido! 😅' });
    }

    const externalId = uuidv4();

    // Cria pagamento com status pending_confirmation
    await pool.query(`
      INSERT INTO payments (external_id, gift_id, amount, payer_name, payer_message, payment_method, status, pix_manual)
      VALUES ($1, $2, $3, $4, $5, 'pix', 'pending_confirmation', 1)
    `, [externalId, id, gift.price, name, msg]);

    // Reserva o presente
    await pool.query(`
      UPDATE gifts SET payment_status = 'pending_confirmation', updated_at = NOW()
      WHERE id = $1
    `, [id]);

    // Salva mensagem
    if (msg) {
      await pool.query(`
        INSERT INTO messages (guest_name, message, gift_title, approved)
        VALUES ($1, $2, $3, 1)
      `, [name, msg, `${gift.emoji} ${gift.title}`]);
    }

    res.json({
      success: true,
      message: 'Presente reservado! Agora faça o PIX e os noivos confirmarão o recebimento. 💕',
      pixKey: process.env.PIX_KEY || 'Chave PIX não configurada',
      pixName: process.env.PIX_NAME || 'Alleane e Rafael',
      amount: gift.price
    });

  } catch (err) {
    console.error('Erro ao registrar PIX manual:', err);
    res.status(500).json({ error: 'Erro ao processar. Tente novamente.' });
  }
});

// POST /api/payments/webhook - Webhook do Mercado Pago
router.post('/webhook', async (req, res) => {
  try {
    // Responde imediatamente
    res.sendStatus(200);

    const { type, data } = req.body;

    if (type === 'payment' && data && data.id) {
      if (!initMercadoPago()) return;

      // Busca detalhes do pagamento no Mercado Pago
      const mpPaymentData = await mpPayment.get({ id: data.id });

      if (!mpPaymentData) return;

      const externalRef = mpPaymentData.external_reference;
      const status = mpPaymentData.status;

      // Busca pagamento local
      const { rows: paymentRows } = await pool.query('SELECT * FROM payments WHERE external_id = $1', [externalRef]);
      if (paymentRows.length === 0) return;
      const payment = paymentRows[0];

      // Atualiza pagamento
      await pool.query(`
        UPDATE payments SET mercadopago_payment_id = $1, status = $2, updated_at = NOW()
        WHERE external_id = $3
      `, [data.id.toString(), status, externalRef]);

      // Se aprovado, marca o presente como escolhido
      if (status === 'approved') {
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
        `, [payment.payer_name, payment.payer_message, externalRef, payment.gift_id]);

        // Salva mensagem do convidado
        if (payment.payer_message) {
          const { rows: giftRows } = await pool.query('SELECT emoji, title FROM gifts WHERE id = $1', [payment.gift_id]);
          const gift = giftRows[0];
          await pool.query(`
            INSERT INTO messages (guest_name, message, gift_title, approved)
            VALUES ($1, $2, $3, 1)
          `, [payment.payer_name, payment.payer_message, gift ? `${gift.emoji} ${gift.title}` : '']);
        }
      }
    }
  } catch (err) {
    console.error('Erro no webhook:', err);
  }
});

// GET /api/payments/status/:externalId - Verifica status de pagamento
router.get('/status/:externalId', async (req, res) => {
  try {
    const externalId = sanitize(req.params.externalId, 50);
    const { rows } = await pool.query(`
      SELECT status, payment_method FROM payments WHERE external_id = $1
    `, [externalId]);

    if (rows.length === 0) return res.status(404).json({ error: 'Pagamento não encontrado.' });

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao verificar status.' });
  }
});

// GET /api/payments/pix-info - Retorna informações do PIX
router.get('/pix-info', (req, res) => {
  res.json({
    pixKey: process.env.PIX_KEY || '',
    pixName: process.env.PIX_NAME || 'Alleane e Rafael',
    pixCity: process.env.PIX_CITY || ''
  });
});

module.exports = router;
