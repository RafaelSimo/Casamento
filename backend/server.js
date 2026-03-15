require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');

// Inicializa banco de dados (cria tabelas e admin)
require('./database');

const app = express();

// Segurança HTTP
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://sdk.mercadopago.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.mercadopago.com"],
      frameSrc: ["https://www.mercadopago.com.br", "https://www.mercadopago.com"],
    }
  }
}));

// CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting geral
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100,
  message: { error: 'Muitas requisições. Tente novamente em 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiting mais restritivo para pagamentos
const paymentLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 10,
  message: { error: 'Muitas tentativas de pagamento. Aguarde alguns minutos.' }
});

// Rate limiting para login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Muitas tentativas de login. Aguarde 15 minutos.' }
});

app.use('/api/', apiLimiter);
app.use('/api/payments/create', paymentLimiter);
app.use('/api/payments/pix-manual', paymentLimiter);
app.use('/api/admin/login', loginLimiter);

// Parser
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false }));

// Serve arquivos estáticos do frontend
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Rotas da API
app.use('/api/gifts', require('./routes/gifts'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/admin', require('./routes/admin'));

// Fallback para SPA
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'admin.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// Error handler global
app.use((err, req, res, next) => {
  console.error('Erro não tratado:', err);
  res.status(500).json({ error: 'Erro interno do servidor.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('');
  console.log('  💒 ════════════════════════════════════════════ 💒');
  console.log('  ║                                                ║');
  console.log('  ║    🎊  Casamento Rafael & Alleane  🎊          ║');
  console.log('  ║    Servidor rodando com sucesso!                ║');
  console.log('  ║                                                ║');
  console.log(`  ║    🌐 http://localhost:${PORT}                    ║`);
  console.log(`  ║    🔧 Admin: http://localhost:${PORT}/admin       ║`);
  console.log('  ║                                                ║');
  console.log('  💒 ════════════════════════════════════════════ 💒');
  console.log('');
});
