# 💒 Manual do Site de Presentes — Casamento Rafael & Alleane

Parabéns pelo casamento! Este manual vai te guiar em **tudo** que você precisa para colocar o site no ar, receber pagamentos e gerenciar os presentes.

---

## 📋 Índice

1. [Visão Geral do Site](#1-visão-geral-do-site)
2. [Requisitos Técnicos](#2-requisitos-técnicos)
3. [Instalação Local (Teste)](#3-instalação-local-teste)
4. [Configuração do Mercado Pago](#4-configuração-do-mercado-pago)
5. [Configuração do PIX](#5-configuração-do-pix)
6. [Configuração do Arquivo .env](#6-configuração-do-arquivo-env)
7. [Usando o Painel Admin](#7-usando-o-painel-admin)
8. [Hospedagem (Colocar no Ar)](#8-hospedagem-colocar-no-ar)
9. [Domínio Personalizado](#9-domínio-personalizado)
10. [Segurança](#10-segurança)
11. [Perguntas Frequentes](#11-perguntas-frequentes)
12. [Suporte Técnico](#12-suporte-técnico)

---

## 1. Visão Geral do Site

O site tem **duas partes**:

### 🌐 Site Público (para convidados)
- **URL:** `seudominio.com.br`
- Os convidados veem a lista de presentes engraçados
- Escolhem um presente e pagam via **Mercado Pago** (cartão/boleto/PIX automático) ou **PIX manual**
- Podem deixar um recado para os noivos

### 🔧 Painel Admin (para vocês)
- **URL:** `seudominio.com.br/admin`
- Vocês acompanham todos os pagamentos
- Confirmam PIX manuais
- Adicionam/editam/removem presentes
- Veem os recados dos convidados
- Acompanham quanto já arrecadaram

---

## 2. Requisitos Técnicos

Para rodar o site você precisa:

- **Node.js** versão 18 ou superior — [Download](https://nodejs.org/)
- **npm** (já vem com o Node.js)
- **Conta no Mercado Pago** (gratuita) — [Criar conta](https://www.mercadopago.com.br/)

---

## 3. Instalação Local (Teste)

### Passo 1: Instalar Node.js
Baixe e instale o Node.js de https://nodejs.org/ (versão LTS recomendada).

### Passo 2: Instalar dependências
Abra o terminal/prompt na pasta do projeto e execute:

```bash
cd backend
npm install
```

### Passo 3: Configurar o .env
```bash
# Copie o arquivo de exemplo
copy .env.example .env
```

Edite o arquivo `.env` com suas informações (veja a seção 6).

### Passo 4: Popular o banco de dados com os presentes
```bash
npm run seed
```

### Passo 5: Iniciar o servidor
```bash
npm start
```

### Passo 6: Acessar
- Site: http://localhost:3000
- Admin: http://localhost:3000/admin
- **Usuário:** admin
- **Senha:** casamento2026 (ou a que você definiu no .env)

---

## 4. Configuração do Mercado Pago

O Mercado Pago é o serviço que processa pagamentos com cartão de crédito, débito, boleto e PIX automático.

### Passo 1: Criar conta no Mercado Pago
1. Acesse https://www.mercadopago.com.br/
2. Crie uma conta (pode usar a conta pessoal de vocês)

### Passo 2: Criar uma aplicação
1. Acesse o painel de desenvolvedores: https://www.mercadopago.com.br/developers/panel/app
2. Clique em **"Criar aplicação"**
3. Nome: `Casamento Rafael e Alleane` (ou o que preferir)
4. Marque a opção **"Checkout Pro"**
5. Clique em **"Criar aplicação"**

### Passo 3: Obter as credenciais
1. Na aplicação criada, vá em **"Credenciais de produção"**
2. Copie o **Access Token** (começa com `APP_USR-...`)
3. Copie a **Public Key** (começa com `APP_USR-...`)

### Passo 4: Testar antes de ir ao ar
1. Primeiro, use as **"Credenciais de teste"** (começam com `TEST-`)
2. Teste todo o fluxo de pagamento
3. Quando estiver tudo funcionando, troque para as credenciais de **produção**

### ⚠️ IMPORTANTE
- **Credenciais de teste** = pagamentos simulados (dinheiro não é real)
- **Credenciais de produção** = pagamentos reais
- Nunca compartilhe seu Access Token com ninguém!

### Passo 5: Configurar webhook (opcional mas recomendado)
1. No painel do Mercado Pago, vá em **"Webhooks"**
2. Adicione a URL: `https://seudominio.com.br/api/payments/webhook`
3. Selecione os eventos: **Payments**
4. Salve

O webhook confirma pagamentos automaticamente. Sem ele, você precisará verificar manualmente.

---

## 5. Configuração do PIX

O PIX Manual é uma alternativa simples: o convidado vê a chave PIX de vocês, faz o pagamento pelo app do banco e confirma no site. Vocês depois confirmam no painel admin.

### Configuração:
No arquivo `.env`, defina:

```env
PIX_KEY=seuemail@email.com
PIX_NAME=Rafael e Alleane
PIX_CITY=Sua Cidade
```

A chave PIX pode ser:
- **E-mail** (recomendado pela praticidade)
- **CPF** (cuidado com privacidade)
- **Telefone**
- **Chave aleatória** (gerada no app do banco)

### Importante:
- O PIX Manual **não confirma automaticamente**. Vocês precisam ir no painel admin e confirmar cada pagamento PIX manualmente.
- É uma boa opção para convidados que preferem não usar Mercado Pago.

---

## 6. Configuração do Arquivo .env

O arquivo `.env` fica em `backend/.env`. Aqui estão todas as configurações:

```env
# Porta do servidor (padrão: 3000)
PORT=3000

# URL do site (IMPORTANTE: mude quando hospedar!)
BASE_URL=https://seudominio.com.br

# Mercado Pago (credenciais de produção)
MP_ACCESS_TOKEN=APP_USR-000000000000-000000-0000000000000000-000000
MP_PUBLIC_KEY=APP_USR-00000000-0000-0000-0000-000000000000

# PIX dos noivos
PIX_KEY=seuemail@email.com
PIX_NAME=Rafael e Alleane
PIX_CITY=Sua Cidade

# Segurança (MUDE A CHAVE!)
JWT_SECRET=uma-chave-super-secreta-e-longa-que-ninguem-vai-adivinhar-2026

# Admin
ADMIN_USER=admin
ADMIN_PASSWORD=SuaSenhaSuperSegura123!
```

### ⚠️ NUNCA:
- Compartilhe o arquivo `.env` com ninguém
- Suba o `.env` para o GitHub (o `.gitignore` já protege)
- Use a senha padrão `casamento2026` em produção

---

## 7. Usando o Painel Admin

### Login
1. Acesse `seudominio.com.br/admin`
2. Use as credenciais definidas no `.env`

### Dashboard
No topo você vê:
- **Total de Presentes** — quantos presentes existem
- **Presentes Escolhidos** — quantos já foram pagos
- **Aguardando Confirmação** — PIX manuais esperando sua confirmação
- **Valor Arrecadado** — quanto vocês já receberam
- **Recados Recebidos** — mensagens dos convidados

### Aba "Presentes"
- Veja todos os presentes e seus status
- **+ Novo Presente** — adicione presentes novos (coloque um emoji, título engraçado, descrição e preço)
- **✏️** — edite um presente existente
- **🗑️** — remova um presente (ele fica inativo, não é deletado)

### Aba "Pagamentos"
- Veja todos os pagamentos, inclusive os pendentes
- **✓** — confirme um pagamento PIX manual
- **✗** — rejeite um pagamento (libera o presente para outros)

### Aba "Recados"
- Leia todas as mensagens carinhosas (e zoeiras!) dos seus convidados

---

## 8. Hospedagem (Colocar no Ar)

Recomendamos estas opções (da mais fácil para a mais avançada):

### Opção 1: Railway (Recomendada - Mais Fácil)
1. Crie uma conta em https://railway.app/
2. Conecte seu GitHub (suba o projeto para um repositório)
3. Crie um novo projeto e selecione o repositório
4. Configure o **Root Directory** como `backend`
5. Adicione as variáveis de ambiente (do `.env`) nas configurações
6. Deploy automático! 🚀

**Custo:** Plano gratuito com limitações. Plano Hobby a partir de ~$5/mês.

### Opção 2: Render
1. Acesse https://render.com/
2. Crie um novo **Web Service**
3. Conecte o repositório GitHub
4. Root Directory: `backend`
5. Build Command: `npm install`
6. Start Command: `npm start`
7. Adicione as variáveis de ambiente
8. Deploy! 🚀

**Custo:** Plano gratuito (pode ficar lento após inatividade). Plano pago a partir de ~$7/mês.

### Opção 3: VPS (DigitalOcean, Vultr, etc.)
Para quem tem mais experiência técnica:

1. Crie um servidor com Ubuntu
2. Instale Node.js:
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
```
3. Suba o projeto para o servidor
4. Instale dependências: `cd backend && npm install`
5. Configure o `.env`
6. Use **PM2** para manter o servidor rodando:
```bash
npm install -g pm2
pm2 start server.js --name casamento
pm2 save
pm2 startup
```
7. Configure **Nginx** como proxy reverso:
```nginx
server {
    listen 80;
    server_name seudominio.com.br;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```
8. Configure SSL com **Certbot** (HTTPS gratuito):
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d seudominio.com.br
```

---

## 9. Domínio Personalizado

Para um toque especial, registre um domínio personalizado como:
- `rafaelealleane.com.br`
- `casamentorafaelealleane.com.br`
- `rafaelealleane.love`

### Onde registrar:
- **Registro.br** — domínios `.com.br` (~R$ 40/ano)
- **Namecheap** — domínios internacionais (~$10/ano)
- **Google Domains** — interface simples

### Como conectar:
1. Registre o domínio
2. No painel DNS do domínio, aponte para o IP do seu servidor (registro tipo A) ou para o endereço do Railway/Render (registro tipo CNAME)
3. Atualize a variável `BASE_URL` no `.env`

---

## 10. Segurança

O site já vem com várias proteções de segurança:

✅ **Helmet** — proteção de headers HTTP
✅ **Rate Limiting** — limite de requisições (anti-spam)
✅ **CORS** — controle de origens
✅ **bcrypt** — senhas criptografadas
✅ **JWT** — autenticação segura do admin
✅ **Validação de input** — proteção contra injeção
✅ **Queries parametrizadas** — proteção contra SQL Injection
✅ **CSP** — Content Security Policy contra XSS

### Checklist antes de ir ao ar:
- [ ] Trocar a senha admin padrão
- [ ] Definir um JWT_SECRET longo e aleatório
- [ ] Usar credenciais de **produção** do Mercado Pago
- [ ] Configurar HTTPS (SSL)
- [ ] Atualizar a BASE_URL para o domínio real
- [ ] Testar todo o fluxo de pagamento

---

## 11. Perguntas Frequentes

### "O convidado pagou mas o presente não mudou de status"
- Se foi **Mercado Pago**: verifique se o webhook está configurado. Se não estiver, o status pode demorar.
- Se foi **PIX manual**: você precisa confirmar no painel admin.

### "Quero adicionar mais presentes"
Vá no painel admin, aba "Presentes", clique em **"+ Novo Presente"**. Ou edite o arquivo `backend/seeds/gifts.js` e rode `npm run seed` novamente (isso resetará todos os presentes).

### "Dois convidados querem dar o mesmo presente"
Cada presente só pode ser escolhido uma vez. Se quiser, crie variações:
- "Fundo Pizza de Emergência (Parte 1)"
- "Fundo Pizza de Emergência (Parte 2)"

### "Quero mudar as cores/design"
Edite o arquivo `frontend/css/style.css`. As cores principais estão nas variáveis CSS no topo do arquivo (`:root`).

### "Quero mudar os textos"
Edite o arquivo `frontend/index.html`. Os textos estão no HTML.

### "Posso usar sem Mercado Pago?"
Sim! Se não configurar as credenciais do Mercado Pago, só a opção **PIX Manual** ficará disponível. Os convidados verão a chave PIX de vocês e farão o pagamento direto.

### "Como vejo quanto arrecadei?"
No painel admin, o card **"Valor Arrecadado"** mostra o total de pagamentos confirmados.

### "O site pode ficar offline?"
Se estiver usando Railway/Render com plano gratuito, pode haver momentos de inatividade. Para garantir 100% de uptime, use um plano pago.

---

## 12. Suporte Técnico

### Logs do servidor
Se algo não funcionar, verifique os logs:

```bash
# Localmente
npm start  # os logs aparecem no terminal

# Com PM2
pm2 logs casamento

# No Railway/Render
Veja os logs no painel do serviço
```

### Resetar o banco de dados
Se precisar resetar tudo (⚠️ apaga todos os dados!):

```bash
# Delete o arquivo do banco
rm backend/data/casamento.db

# Recrie com os presentes
cd backend
npm run seed
```

### Backup
O banco de dados fica em `backend/data/casamento.db`. Faça backup regular deste arquivo!

---

## 🎊 Dica Final

Enviem o link do site para os convidados pelo WhatsApp com uma mensagem divertida como:

> *"Oi! 🥰 A gente casa no dia XX/XX! E pra facilitar a vida de todo mundo (e a nossa), fizemos uma lista de presentes... diferente. 😂 Acesse, escolha um presente engraçado e nos ajude a começar essa nova vida sem falir! 💒✨ Link: [seu link aqui]"*

---

**Feito com ❤️ para Rafael & Alleane — que esse seja apenas o começo de uma história linda (e engraçada)!**
