const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const { pool } = require('../database');

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// POST /api/rsvp — confirmar presença
router.post('/', async (req, res) => {
  try {
    const { name, email, phone, guests, message } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Nome é obrigatório.' });
    }

    const safeName = name.trim().substring(0, 100);
    const safeEmail = email ? email.trim().substring(0, 150) : null;
    const safePhone = phone ? phone.trim().substring(0, 20) : null;
    const safeGuests = Math.min(Math.max(parseInt(guests) || 1, 1), 10);
    const safeMessage = message ? message.trim().substring(0, 500) : null;

    await pool.query(
      'INSERT INTO rsvp (name, email, phone, guests, message) VALUES ($1, $2, $3, $4, $5)',
      [safeName, safeEmail, safePhone, safeGuests, safeMessage]
    );

    // Send email notification (non-blocking — doesn't fail the request)
    sendEmailNotification({
      name: safeName,
      email: safeEmail,
      phone: safePhone,
      guests: safeGuests,
      message: safeMessage
    }).catch(err => console.error('Erro ao enviar email RSVP:', err.message));

    res.json({ success: true, message: 'Presença confirmada com sucesso!' });
  } catch (err) {
    console.error('Erro ao salvar RSVP:', err);
    res.status(500).json({ error: 'Erro ao confirmar presença. Tente novamente.' });
  }
});

// GET /api/rsvp — listar confirmações (admin)
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM rsvp ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    console.error('Erro ao listar RSVPs:', err);
    res.status(500).json({ error: 'Erro ao carregar confirmações.' });
  }
});

async function sendEmailNotification(data) {
  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;
  const emailTo = process.env.EMAIL_TO || emailUser;

  if (!emailUser || !emailPass) {
    console.log('⚠️  EMAIL_USER/EMAIL_PASS não configurados. RSVP salvo apenas no banco.');
    return;
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: emailUser, pass: emailPass }
  });

  await transporter.sendMail({
    from: `"Casamento Rafael & Alleane" <${emailUser}>`,
    to: emailTo,
    subject: `💒 Nova confirmação: ${escapeHtml(data.name)} (${data.guests} pessoa${data.guests > 1 ? 's' : ''})`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #2E7D50; border-bottom: 2px solid #D4AF37; padding-bottom: 10px;">
          💒 Nova Confirmação de Presença
        </h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px 0; font-weight: bold; color: #1B4332;">Nome:</td><td style="padding: 8px 0;">${escapeHtml(data.name)}</td></tr>
          <tr><td style="padding: 8px 0; font-weight: bold; color: #1B4332;">Email:</td><td style="padding: 8px 0;">${escapeHtml(data.email) || 'Não informado'}</td></tr>
          <tr><td style="padding: 8px 0; font-weight: bold; color: #1B4332;">Telefone:</td><td style="padding: 8px 0;">${escapeHtml(data.phone) || 'Não informado'}</td></tr>
          <tr><td style="padding: 8px 0; font-weight: bold; color: #1B4332;">Nº de pessoas:</td><td style="padding: 8px 0;">${data.guests}</td></tr>
          <tr><td style="padding: 8px 0; font-weight: bold; color: #1B4332;">Mensagem:</td><td style="padding: 8px 0;">${escapeHtml(data.message) || '—'}</td></tr>
        </table>
        <p style="color: #666; font-size: 12px; margin-top: 20px;">Enviado automaticamente pelo site do casamento.</p>
      </div>
    `
  });
}

module.exports = router;
