/**
 * =============================================
 * CASAMENTO RAFAEL & ALLEANE — Frontend App
 * =============================================
 */

(function () {
  'use strict';

  const API = '/api';
  let giftsData = [];

  // ===== INIT =====
  document.addEventListener('DOMContentLoaded', () => {
    createFloatingHearts();
    initScrollReveal();
    loadGifts();
    loadMessages();
    initModal();
    initSmoothScroll();
    checkPaymentReturn();
  });

  // ===== FLOATING HEARTS =====
  function createFloatingHearts() {
    const container = document.getElementById('floating-hearts');
    const hearts = ['💕', '💗', '💖', '❤️', '🤍', '💛'];
    const isMobile = window.innerWidth < 480;
    const isTablet = window.innerWidth < 768;
    const count = isMobile ? 5 : isTablet ? 8 : 15;

    for (let i = 0; i < count; i++) {
      const heart = document.createElement('div');
      heart.className = 'floating-heart';
      heart.textContent = hearts[Math.floor(Math.random() * hearts.length)];
      heart.style.left = Math.random() * 100 + '%';
      heart.style.fontSize = (isMobile ? 10 : 12) + Math.random() * (isMobile ? 10 : 16) + 'px';
      heart.style.animationDuration = (15 + Math.random() * 20) + 's';
      heart.style.animationDelay = (Math.random() * 25) + 's';
      container.appendChild(heart);
    }
  }

  // ===== SCROLL REVEAL =====
  function initScrollReveal() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    document.querySelectorAll('.intro-card, .section-header, .gifts-stats, .gift-card, .message-bubble')
      .forEach(el => {
        el.classList.add('reveal');
        observer.observe(el);
      });
  }

  // ===== SMOOTH SCROLL =====
  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const target = document.querySelector(link.getAttribute('href'));
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
  }

  // ===== LOAD GIFTS =====
  async function loadGifts() {
    try {
      const res = await fetch(`${API}/gifts`);
      if (!res.ok) throw new Error('Erro ao carregar presentes');
      giftsData = await res.json();
      renderGifts(giftsData);
      updateStats(giftsData);
    } catch (err) {
      console.error(err);
      document.getElementById('loading-spinner').innerHTML =
        '<p style="color: var(--text-muted)">Erro ao carregar presentes. Recarregue a página. 😔</p>';
    }
  }

  function renderGifts(gifts) {
    const grid = document.getElementById('gifts-grid');
    const spinner = document.getElementById('loading-spinner');
    if (spinner) spinner.remove();

    grid.innerHTML = '';

    gifts.forEach((gift, index) => {
      const isClaimed = gift.claimed === 1 || gift.payment_status === 'paid';
      const isPending = gift.payment_status === 'pending_confirmation';

      const card = document.createElement('div');
      card.className = `gift-card${isClaimed ? ' claimed' : ''}${isPending ? ' pending' : ''}`;
      card.style.animationDelay = `${index * 0.05}s`;

      card.innerHTML = `
        <div class="gift-emoji">${escapeHtml(gift.emoji)}</div>
        <h3 class="gift-title">${escapeHtml(gift.title)}</h3>
        <p class="gift-description">${escapeHtml(gift.description)}</p>
        <div class="gift-price">R$ ${formatPrice(gift.price)}</div>
        <button class="gift-button" data-id="${gift.id}">Presentear 🎁</button>
        <div class="gift-claimed-badge">🎊 Presente garantido!</div>
        <div class="gift-pending-badge">⏳ Aguardando confirmação</div>
      `;

      // Reveal animation (faster on mobile)
      card.classList.add('reveal');
      const revealDelay = window.innerWidth < 480 ? 50 + index * 30 : 100 + index * 60;
      setTimeout(() => card.classList.add('visible'), revealDelay);

      grid.appendChild(card);
    });

    // Event delegation for gift buttons
    grid.addEventListener('click', (e) => {
      const btn = e.target.closest('.gift-button');
      if (btn) {
        const giftId = parseInt(btn.dataset.id, 10);
        openModal(giftId);
      }
    });
  }

  function updateStats(gifts) {
    const total = gifts.length;
    const claimed = gifts.filter(g => g.claimed === 1 || g.payment_status === 'paid').length;
    const available = total - claimed - gifts.filter(g => g.payment_status === 'pending_confirmation').length;

    animateCounter('stat-total', total);
    animateCounter('stat-claimed', claimed);
    animateCounter('stat-available', Math.max(0, available));
  }

  function animateCounter(id, target) {
    const el = document.getElementById(id);
    if (!el) return;
    let current = 0;
    const step = Math.max(1, Math.floor(target / 30));
    const interval = setInterval(() => {
      current += step;
      if (current >= target) {
        current = target;
        clearInterval(interval);
      }
      el.textContent = current;
    }, 30);
  }

  // ===== LOAD MESSAGES =====
  async function loadMessages() {
    try {
      const res = await fetch(`${API}/gifts/messages/all`);
      if (!res.ok) throw new Error('Erro');
      const messages = await res.json();
      renderMessages(messages);
    } catch (err) {
      console.error('Erro ao carregar mensagens:', err);
    }
  }

  function renderMessages(messages) {
    const grid = document.getElementById('messages-grid');
    const noMsg = document.getElementById('no-messages');

    if (!messages.length) {
      if (noMsg) noMsg.style.display = 'block';
      return;
    }

    if (noMsg) noMsg.style.display = 'none';
    grid.innerHTML = '';

    messages.forEach(msg => {
      const bubble = document.createElement('div');
      bubble.className = 'message-bubble reveal';

      bubble.innerHTML = `
        <div class="msg-header">
          <span class="msg-name">${escapeHtml(msg.guest_name)}</span>
          ${msg.gift_title ? `<span class="msg-gift">${escapeHtml(msg.gift_title)}</span>` : ''}
        </div>
        <p class="msg-text">${escapeHtml(msg.message)}</p>
      `;

      grid.appendChild(bubble);
      setTimeout(() => bubble.classList.add('visible'), 100);
    });
  }

  // ===== MODAL =====
  function initModal() {
    const overlay = document.getElementById('payment-modal');
    const closeBtn = document.getElementById('modal-close');

    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });

    // Payment method buttons
    document.getElementById('btn-pay-mp').addEventListener('click', handlePayMercadoPago);
    document.getElementById('btn-pay-pix').addEventListener('click', handlePayPix);
    document.getElementById('btn-confirm-pix').addEventListener('click', handleConfirmPix);
    document.getElementById('btn-back-pix').addEventListener('click', () => showStep('modal-step-1'));
    document.getElementById('btn-close-success').addEventListener('click', () => {
      closeModal();
      loadGifts();
      loadMessages();
    });

    // PIX copy button
    document.getElementById('pix-copy-btn').addEventListener('click', copyPixKey);
  }

  function openModal(giftId) {
    const gift = giftsData.find(g => g.id === giftId);
    if (!gift) return;

    document.getElementById('form-gift-id').value = giftId;
    document.getElementById('modal-emoji').textContent = gift.emoji;
    document.getElementById('modal-title').textContent = gift.title;
    document.getElementById('modal-description').textContent = gift.description;
    document.getElementById('modal-price').textContent = `R$ ${formatPrice(gift.price)}`;
    document.getElementById('pix-amount').textContent = `R$ ${formatPrice(gift.price)}`;

    // Reset form
    document.getElementById('form-name').value = '';
    document.getElementById('form-email').value = '';
    document.getElementById('form-message').value = '';

    showStep('modal-step-1');
    const overlay = document.getElementById('payment-modal');
    overlay.classList.add('active');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    // Focus first input
    setTimeout(() => document.getElementById('form-name').focus(), 300);
  }

  function closeModal() {
    const overlay = document.getElementById('payment-modal');
    overlay.classList.remove('active');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function showStep(stepId) {
    document.querySelectorAll('.modal-step').forEach(s => s.classList.add('hidden'));
    document.getElementById(stepId).classList.remove('hidden');
  }

  // ===== PAYMENT: MERCADO PAGO =====
  async function handlePayMercadoPago() {
    const name = document.getElementById('form-name').value.trim();
    if (!name) {
      showToast('Preencha seu nome!', 'warning');
      document.getElementById('form-name').focus();
      return;
    }

    const giftId = document.getElementById('form-gift-id').value;
    const email = document.getElementById('form-email').value.trim();
    const message = document.getElementById('form-message').value.trim();

    showStep('modal-step-loading');

    try {
      const res = await fetch(`${API}/payments/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          giftId: parseInt(giftId, 10),
          payerName: name,
          payerEmail: email,
          message: message
        })
      });

      const data = await res.json();

      if (!res.ok) {
        showStep('modal-step-1');
        showToast(data.error || 'Erro ao processar pagamento.', 'error');
        return;
      }

      // Redirect to Mercado Pago checkout
      if (data.initPoint) {
        window.location.href = data.initPoint;
      } else if (data.sandboxInitPoint) {
        window.location.href = data.sandboxInitPoint;
      } else {
        showStep('modal-step-1');
        showToast('Erro ao redirecionar para o pagamento.', 'error');
      }
    } catch (err) {
      console.error(err);
      showStep('modal-step-1');
      showToast('Erro de conexão. Tente novamente.', 'error');
    }
  }

  // ===== PAYMENT: PIX MANUAL =====
  async function handlePayPix() {
    const name = document.getElementById('form-name').value.trim();
    if (!name) {
      showToast('Preencha seu nome!', 'warning');
      document.getElementById('form-name').focus();
      return;
    }

    // Load PIX info
    try {
      const res = await fetch(`${API}/payments/pix-info`);
      const info = await res.json();

      document.getElementById('pix-key-display').textContent = info.pixKey || 'Não configurado';
      document.getElementById('pix-name-display').textContent = info.pixName || '';

      showStep('modal-step-pix');
    } catch (err) {
      showToast('Erro ao carregar dados do PIX.', 'error');
    }
  }

  async function handleConfirmPix() {
    const giftId = document.getElementById('form-gift-id').value;
    const name = document.getElementById('form-name').value.trim();
    const message = document.getElementById('form-message').value.trim();

    showStep('modal-step-loading');

    try {
      const res = await fetch(`${API}/payments/pix-manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          giftId: parseInt(giftId, 10),
          payerName: name,
          message: message
        })
      });

      const data = await res.json();

      if (!res.ok) {
        showStep('modal-step-pix');
        showToast(data.error || 'Erro ao registrar PIX.', 'error');
        return;
      }

      document.getElementById('success-message').textContent =
        'Obrigado! Os noivos vão confirmar o recebimento do PIX. Rafael e Alleane agradecem de coração! 💕';
      showStep('modal-step-success');
      launchConfetti();
    } catch (err) {
      showStep('modal-step-pix');
      showToast('Erro de conexão.', 'error');
    }
  }

  function copyPixKey() {
    const key = document.getElementById('pix-key-display').textContent;
    navigator.clipboard.writeText(key).then(() => {
      showToast('Chave PIX copiada! 📋', 'success');
    }).catch(() => {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = key;
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      showToast('Chave PIX copiada! 📋', 'success');
    });
  }

  // ===== CHECK PAYMENT RETURN =====
  function checkPaymentReturn() {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get('payment');
    const giftId = params.get('gift');

    if (payment === 'success') {
      showToast('Pagamento aprovado! Obrigado pelo presente! 🎉', 'success');
      launchConfetti();
      // Clean URL
      window.history.replaceState({}, '', '/');
      loadGifts();
    } else if (payment === 'failure') {
      showToast('Pagamento não aprovado. Tente novamente.', 'error');
      window.history.replaceState({}, '', '/');
    } else if (payment === 'pending') {
      showToast('Pagamento pendente. Aguarde a confirmação.', 'info');
      window.history.replaceState({}, '', '/');
    }
  }

  // ===== CONFETTI =====
  function launchConfetti() {
    const colors = ['#C4917B', '#D4AF37', '#E8C4B8', '#F0D98C', '#8B5E3C', '#FF6B8A', '#32BCAD'];
    const shapes = ['circle', 'square'];
    const count = window.innerWidth < 480 ? 40 : 80;

    for (let i = 0; i < count; i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      piece.style.left = Math.random() * 100 + 'vw';
      piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      piece.style.width = (6 + Math.random() * 8) + 'px';
      piece.style.height = (6 + Math.random() * 8) + 'px';
      piece.style.borderRadius = shapes[Math.floor(Math.random() * shapes.length)] === 'circle' ? '50%' : '2px';
      piece.style.animationDuration = (2 + Math.random() * 3) + 's';
      piece.style.animationDelay = (Math.random() * 1.5) + 's';
      document.body.appendChild(piece);

      setTimeout(() => piece.remove(), 5000);
    }
  }

  // ===== TOAST =====
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.transition = 'opacity 0.3s, transform 0.3s';
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // ===== HELPERS =====
  function formatPrice(price) {
    return Number(price).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

})();
