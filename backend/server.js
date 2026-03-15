require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');

// Inicializa banco de dados (cria tabelas e admin)
const { pool, initDatabase } = require('./database');

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

// Inicialização async: DB → auto-seed → listen
async function start() {
  await initDatabase();

  // Auto-seed: insere presentes se a tabela estiver vazia (primeiro deploy)
  const { rows } = await pool.query('SELECT COUNT(*) as count FROM gifts');
  if (parseInt(rows[0].count) === 0) {
    console.log('📦 Tabela de presentes vazia — executando seed automático...');
    const gifts = [
      { emoji: '📖', title: 'Manual de Instruções do Rafael', description: 'Para a Alleane não surtar no primeiro mês de convivência', price: 200, sort_order: 1 },
      { emoji: '🧹', title: 'Kit "Quem Vai Limpar a Casa"', description: 'Inclui dado de 20 faces pra decidir quem faz o quê', price: 210, sort_order: 2 },
      { emoji: '🍕', title: 'Fundo Pizza de Emergência', description: 'Pra quando ninguém quiser cozinhar (vai acontecer MUITO)', price: 220, sort_order: 3 },
      { emoji: '💐', title: 'Fundo "Desculpa, Amor"', description: 'Para as flores que o Rafael VAI ter que comprar... muitas vezes', price: 250, sort_order: 4 },
      { emoji: '💥', title: 'Fundo pra Primeira Briga', description: 'Vai acontecer... e precisa de chocolate, vinho e Netflix pra resolver', price: 270, sort_order: 5 },
      { emoji: '🍺', title: 'Fundo Cerveja com os Amigos', description: 'Permissão da esposa já inclusa (válida por 24h, condições se aplicam)', price: 300, sort_order: 6 },
      { emoji: '🆘', title: 'Kit Sobrevivência do Marido', description: 'Manual "Sim, querida" + chocolate de emergência + cartão "Eu errei"', price: 320, sort_order: 7 },
      { emoji: '🍽️', title: '1 Semana de Almoço pro Rafael', description: 'Porque cozinhar não é o forte dele (água queimada é especialidade)', price: 350, sort_order: 8 },
      { emoji: '📺', title: '1 Ano de Streaming Premium', description: 'Pra maratonar juntos sem brigar pelo controle remoto (spoiler: vão brigar)', price: 400, sort_order: 9 },
      { emoji: '🛡️', title: 'Seguro Anti-Sogra (Bilateral)', description: 'Proteção garantida dos dois lados. Não cobre visitas surpresa.', price: 420, sort_order: 10 },
      { emoji: '👨‍🍳', title: 'Aulas de Culinária pro Rafael', description: 'Pra ele parar de confundir sal com açúcar e descobrir que fogão não morde', price: 450, sort_order: 11 },
      { emoji: '👙', title: '1 Ano de Calcinha pra Alleane', description: 'Presente prático é presente de qualidade! (52 semanas, 52 calcinhas)', price: 500, sort_order: 12 },
      { emoji: '🐶', title: 'Fundo Pro Primeiro Pet', description: 'Antes do bebê, vem o dog! Já aceitamos sugestões de nome', price: 520, sort_order: 13 },
      { emoji: '🌹', title: '1 Ano de Flores "Eu Errei"', description: '52 buquês de "me perdoa, amor" — um por semana (o Rafael vai precisar)', price: 600, sort_order: 14 },
      { emoji: '🧘', title: 'Terapia de Casal Preventiva', description: 'Melhor prevenir do que remediar, né? 10 sessões pra começar bem', price: 750, sort_order: 15 },
      { emoji: '✈️', title: 'Upgrade da Lua de Mel', description: 'De barraca no quintal pra resort all-inclusive! Cada real conta!', price: 1000, sort_order: 16 },
    ];
    for (const g of gifts) {
      await pool.query(
        'INSERT INTO gifts (emoji, title, description, price, sort_order) VALUES ($1, $2, $3, $4, $5)',
        [g.emoji, g.title, g.description, g.price, g.sort_order]
      );
    }
    console.log(`✅ ${gifts.length} presentes inseridos automaticamente!`);
  }

  app.listen(PORT, () => {
    console.log('');
    console.log('  💒 ════════════════════════════════════════════ 💒');
    console.log('  ║                                                ║');
    console.log('  ║    🎊  Casamento Rafael & Alleane  🎊          ║');
    console.log('  ║    Servidor rodando com sucesso!                ║');
    console.log('  ║                                                ║');
    console.log(`  ║    🌐 https://casamentorafaealle.up.railway.app ║`);
    console.log(`  ║    🔧 Admin:https://casamentorafaealle.up.railway.app/admin║`);
    console.log('  ║                                                ║');
    console.log('  💒 ════════════════════════════════════════════ 💒');
    console.log('');
  });
}

start().catch(err => {
  console.error('Erro fatal ao iniciar:', err);
  process.exit(1);
});
