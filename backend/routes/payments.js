const express = require('express');
const router = express.Router();
const db = require('../database');
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
    const gift = db.prepare('SELECT * FROM gifts WHERE id = ? AND active = 1').get(id);
    if (!gift) return res.status(404).json({ error: 'Presente não encontrado.' });

    if (gift.claimed) {
      return res.status(409).json({ error: 'Este presente já foi escolhido por outro convidado! 😅' });
    }

    // Verifica reservas pendentes recentes (últimos 30 min)
    const pendingPayment = db.prepare(`
      SELECT id FROM payments
      WHERE gift_id = ? AND status = 'pending' AND pix_manual = 0
      AND datetime(created_at) > datetime('now', '-30 minutes')
    `).get(id);

    if (pendingPayment) {
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

    db.prepare(`
      INSERT INTO payments (external_id, gift_id, amount, payer_name, payer_email, payer_message, payment_method, status)
      VALUES (?, ?, ?, ?, ?, ?, 'mercadopago', 'pending')
    `).run(externalId, id, gift.price, name, email, msg);

    // Cria preferência no Mercado Pago
    const preference = await mpPreference.create({
      body: {
        items: [{
          id: `gift-${id}`,
          title: `Presente de Casamento: ${gift.emoji} ${gift.title}`,
          description: gift.description,
          quantity: 1,
          unit_price: gift.price,
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
    db.prepare(`
      UPDATE payments SET mercadopago_preference_id = ?, updated_at = datetime('now')
      WHERE external_id = ?
    `).run(preference.id, externalId);

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
router.post('/pix-manual', (req, res) => {
  try {
    const { giftId, payerName, message } = req.body;

    const id = parseInt(giftId, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Presente inválido.' });

    const name = sanitize(payerName, 100);
    if (!name) return res.status(400).json({ error: 'Nome é obrigatório.' });

    const msg = sanitize(message, 500);

    // Verifica presente
    const gift = db.prepare('SELECT * FROM gifts WHERE id = ? AND active = 1').get(id);
    if (!gift) return res.status(404).json({ error: 'Presente não encontrado.' });

    if (gift.claimed) {
      return res.status(409).json({ error: 'Este presente já foi escolhido! 😅' });
    }

    const externalId = uuidv4();

    // Cria pagamento com status pending_confirmation
    db.prepare(`
      INSERT INTO payments (external_id, gift_id, amount, payer_name, payer_message, payment_method, status, pix_manual)
      VALUES (?, ?, ?, ?, ?, 'pix', 'pending_confirmation', 1)
    `).run(externalId, id, gift.price, name, msg);

    // Reserva o presente
    db.prepare(`
      UPDATE gifts SET payment_status = 'pending_confirmation', updated_at = datetime('now')
      WHERE id = ?
    `).run(id);

    // Salva mensagem
    if (msg) {
      db.prepare(`
        INSERT INTO messages (guest_name, message, gift_title, approved)
        VALUES (?, ?, ?, 1)
      `).run(name, msg, `${gift.emoji} ${gift.title}`);
    }

    res.json({
      success: true,
      message: 'Presente reservado! Agora faça o PIX e os noivos confirmarão o recebimento. 💕',
      pixKey: process.env.PIX_KEY || 'Chave PIX não configurada',
      pixName: process.env.PIX_NAME || 'Rafael e Alleane',
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
      const status = mpPaymentData.status; // approved, pending, rejected, etc.

      // Busca pagamento local
      const payment = db.prepare('SELECT * FROM payments WHERE external_id = ?').get(externalRef);
      if (!payment) return;

      // Atualiza pagamento
      db.prepare(`
        UPDATE payments SET mercadopago_payment_id = ?, status = ?, updated_at = datetime('now')
        WHERE external_id = ?
      `).run(data.id.toString(), status, externalRef);

      // Se aprovado, marca o presente como escolhido
      if (status === 'approved') {
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
        `).run(payment.payer_name, payment.payer_message, externalRef, payment.gift_id);

        // Salva mensagem do convidado
        if (payment.payer_message) {
          const gift = db.prepare('SELECT emoji, title FROM gifts WHERE id = ?').get(payment.gift_id);
          db.prepare(`
            INSERT INTO messages (guest_name, message, gift_title, approved)
            VALUES (?, ?, ?, 1)
          `).run(payment.payer_name, payment.payer_message, gift ? `${gift.emoji} ${gift.title}` : '');
        }
      }
    }
  } catch (err) {
    console.error('Erro no webhook:', err);
  }
});

// GET /api/payments/status/:externalId - Verifica status de pagamento
router.get('/status/:externalId', (req, res) => {
  try {
    const externalId = sanitize(req.params.externalId, 50);
    const payment = db.prepare(`
      SELECT status, payment_method FROM payments WHERE external_id = ?
    `).get(externalId);

    if (!payment) return res.status(404).json({ error: 'Pagamento não encontrado.' });

    res.json(payment);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao verificar status.' });
  }
});

// GET /api/payments/pix-info - Retorna informações do PIX
router.get('/pix-info', (req, res) => {
  res.json({
    pixKey: process.env.PIX_KEY || '',
    pixName: process.env.PIX_NAME || 'Rafael e Alleane',
    pixCity: process.env.PIX_CITY || ''
  });
});

module.exports = router;
