/**
 * Seed dos presentes engraçados do casamento de Rafael & Alleane
 * Execute com: npm run seed
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const { pool, initDatabase } = require('../database');

const gifts = [
  {
    emoji: '📖',
    title: 'Manual de Instruções do Rafael',
    description: 'Para a Alleane não surtar no primeiro mês de convivência',
    price: 200,
    sort_order: 1
  },
  {
    emoji: '🧹',
    title: 'Kit "Quem Vai Limpar a Casa"',
    description: 'Inclui dado de 20 faces pra decidir quem faz o quê',
    price: 210,
    sort_order: 2
  },
  {
    emoji: '🍕',
    title: 'Fundo Pizza de Emergência',
    description: 'Pra quando ninguém quiser cozinhar (vai acontecer MUITO)',
    price: 220,
    sort_order: 3
  },
  {
    emoji: '💐',
    title: 'Fundo "Desculpa, Amor"',
    description: 'Para as flores que o Rafael VAI ter que comprar... muitas vezes',
    price: 250,
    sort_order: 4
  },
  {
    emoji: '💥',
    title: 'Fundo pra Primeira Briga',
    description: 'Vai acontecer... e precisa de chocolate, vinho e Netflix pra resolver',
    price: 270,
    sort_order: 5
  },
  {
    emoji: '🍺',
    title: 'Fundo Cerveja com os Amigos',
    description: 'Permissão da esposa já inclusa (válida por 24h, condições se aplicam)',
    price: 300,
    sort_order: 6
  },
  {
    emoji: '🆘',
    title: 'Kit Sobrevivência do Marido',
    description: 'Manual "Sim, querida" + chocolate de emergência + cartão "Eu errei"',
    price: 320,
    sort_order: 7
  },
  {
    emoji: '🍽️',
    title: '1 Semana de Almoço pro Rafael',
    description: 'Porque cozinhar não é o forte dele (água queimada é especialidade)',
    price: 350,
    sort_order: 8
  },
  {
    emoji: '📺',
    title: '1 Ano de Streaming Premium',
    description: 'Pra maratonar juntos sem brigar pelo controle remoto (spoiler: vão brigar)',
    price: 400,
    sort_order: 9
  },
  {
    emoji: '🛡️',
    title: 'Seguro Anti-Sogra (Bilateral)',
    description: 'Proteção garantida dos dois lados. Não cobre visitas surpresa.',
    price: 420,
    sort_order: 10
  },
  {
    emoji: '👨‍🍳',
    title: 'Aulas de Culinária pro Rafael',
    description: 'Pra ele parar de confundir sal com açúcar e descobrir que fogão não morde',
    price: 450,
    sort_order: 11
  },
  {
    emoji: '👙',
    title: '1 Ano de Calcinha pra Alleane',
    description: 'Presente prático é presente de qualidade! (52 semanas, 52 calcinhas)',
    price: 500,
    sort_order: 12
  },
  {
    emoji: '🐶',
    title: 'Fundo Pro Primeiro Pet',
    description: 'Antes do bebê, vem o dog! Já aceitamos sugestões de nome',
    price: 520,
    sort_order: 13
  },
  {
    emoji: '🌹',
    title: '1 Ano de Flores "Eu Errei"',
    description: '52 buquês de "me perdoa, amor" — um por semana (o Rafael vai precisar)',
    price: 600,
    sort_order: 14
  },
  {
    emoji: '🧘',
    title: 'Terapia de Casal Preventiva',
    description: 'Melhor prevenir do que remediar, né? 10 sessões pra começar bem',
    price: 750,
    sort_order: 15
  },
  {
    emoji: '✈️',
    title: 'Upgrade da Lua de Mel',
    description: 'De barraca no quintal pra resort all-inclusive! Cada real conta!',
    price: 1000,
    sort_order: 16
  }
];

// Limpa presentes existentes do seed (não remove adicionados manualmente)
console.log('🌱 Iniciando seed dos presentes...\n');

async function runSeed() {
  await initDatabase();

  const { rows: countRows } = await pool.query('SELECT COUNT(*) as count FROM gifts');
  const existingCount = parseInt(countRows[0].count);

  if (existingCount > 0) {
    console.log(`⚠️  Já existem ${existingCount} presentes no banco. Limpando para re-seed...`);
    await pool.query('DELETE FROM gifts');
  }

  for (const gift of gifts) {
    await pool.query(
      'INSERT INTO gifts (emoji, title, description, price, sort_order) VALUES ($1, $2, $3, $4, $5)',
      [gift.emoji, gift.title, gift.description, gift.price, gift.sort_order]
    );
  }

  console.log(`✅ ${gifts.length} presentes inseridos com sucesso!\n`);
  console.log('Lista de presentes:');
  console.log('─'.repeat(60));

  gifts.forEach((g, i) => {
    console.log(`  ${g.emoji}  ${g.title} — R$ ${g.price.toFixed(2)}`);
    console.log(`     "${g.description}"`);
    console.log('');
  });

  console.log('─'.repeat(60));
  console.log(`\n💰 Valor total da lista: R$ ${gifts.reduce((sum, g) => sum + g.price, 0).toFixed(2)}`);
  console.log('\n🎉 Seed concluído! Agora é só casar!\n');

  await pool.end();
}

runSeed().catch(err => {
  console.error('Erro no seed:', err);
  process.exit(1);
});

process.exit(0);
