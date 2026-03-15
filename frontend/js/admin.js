/**
 * =============================================
 * CASAMENTO ALLEANE & RAFAEL — Admin Panel
 * =============================================
 */

(function () {
  'use strict';

  const API = '/api';
  let authToken = localStorage.getItem('admin_token') || '';

  // ===== INIT =====
  document.addEventListener('DOMContentLoaded', () => {
    if (authToken) {
      showDashboard();
    }
    initLogin();
    initTabs();
    initGiftModal();
    initLogout();
  });

  // ===== AUTH =====
  function initLogin() {
    document.getElementById('login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const user = document.getElementById('login-user').value.trim();
      const pass = document.getElementById('login-pass').value;
      const errorEl = document.getElementById('login-error');

      errorEl.style.display = 'none';

      try {
        const res = await fetch(`${API}/admin/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: user, password: pass })
        });

        const data = await res.json();

        if (!res.ok) {
          errorEl.textContent = data.error || 'Erro ao fazer login.';
          errorEl.style.display = 'block';
          return;
        }

        authToken = data.token;
        localStorage.setItem('admin_token', authToken);
        showDashboard();
      } catch (err) {
        errorEl.textContent = 'Erro de conexão.';
        errorEl.style.display = 'block';
      }
    });
  }

  function initLogout() {
    document.getElementById('btn-logout').addEventListener('click', () => {
      authToken = '';
      localStorage.removeItem('admin_token');
      document.getElementById('dashboard').style.display = 'none';
      document.getElementById('login-section').style.display = 'flex';
    });
  }

  function showDashboard() {
    document.getElementById('login-section').style.display = 'none';
    document.getElementById('dashboard').style.display = 'block';
    loadDashboard();
    loadGifts();
    loadPayments();
    loadMessages();
  }

  function authHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    };
  }

  async function authFetch(url, options = {}) {
    options.headers = { ...authHeaders(), ...(options.headers || {}) };
    const res = await fetch(url, options);
    if (res.status === 401 || res.status === 403) {
      authToken = '';
      localStorage.removeItem('admin_token');
      document.getElementById('dashboard').style.display = 'none';
      document.getElementById('login-section').style.display = 'flex';
      showAdminToast('Sessão expirada. Faça login novamente.');
      throw new Error('Unauthorized');
    }
    return res;
  }

  // ===== TABS =====
  function initTabs() {
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(tab.dataset.panel).classList.add('active');
      });
    });
  }

  // ===== DASHBOARD =====
  async function loadDashboard() {
    try {
      const res = await authFetch(`${API}/admin/dashboard`);
      const data = await res.json();

      document.getElementById('stat-total-gifts').textContent = data.totalGifts;
      document.getElementById('stat-claimed-gifts').textContent = data.claimedGifts;
      document.getElementById('stat-pending-gifts').textContent = data.pendingGifts;
      document.getElementById('stat-total-raised').textContent = `R$ ${formatPrice(data.totalRaised)}`;
      document.getElementById('stat-total-messages').textContent = data.totalMessages;
    } catch (err) {
      console.error('Erro ao carregar dashboard:', err);
    }
  }

  // ===== GIFTS =====
  async function loadGifts() {
    try {
      const res = await authFetch(`${API}/admin/gifts`);
      const gifts = await res.json();
      renderGiftsTable(gifts);
    } catch (err) {
      console.error('Erro ao carregar presentes:', err);
    }
  }

  function renderGiftsTable(gifts) {
    const tbody = document.getElementById('gifts-table-body');
    if (!gifts.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;">Nenhum presente cadastrado.</td></tr>';
      return;
    }

    tbody.innerHTML = gifts.map(g => {
      let statusBadge = '';
      if (g.claimed) {
        statusBadge = '<span class="badge badge-success">Escolhido ✓</span>';
      } else if (g.payment_status === 'pending_confirmation') {
        statusBadge = '<span class="badge badge-warning">Aguardando</span>';
      } else if (!g.active) {
        statusBadge = '<span class="badge badge-default">Inativo</span>';
      } else {
        statusBadge = '<span class="badge badge-info">Disponível</span>';
      }

      return `
        <tr>
          <td class="emoji-cell">${escapeHtml(g.emoji)}</td>
          <td>
            <strong>${escapeHtml(g.title)}</strong><br>
            <small style="color:var(--text-light)">${escapeHtml(g.description)}</small>
          </td>
          <td><strong>R$ ${formatPrice(g.price)}</strong></td>
          <td>${statusBadge}</td>
          <td>${g.claimed_by ? escapeHtml(g.claimed_by) : '—'}</td>
          <td class="actions-cell">
            <button class="btn btn-primary btn-edit-gift" data-id="${g.id}">✏️</button>
            ${!g.claimed ? `<button class="btn btn-danger btn-delete-gift" data-id="${g.id}">🗑️</button>` : ''}
          </td>
        </tr>
      `;
    }).join('');

    // Edit buttons
    tbody.querySelectorAll('.btn-edit-gift').forEach(btn => {
      btn.addEventListener('click', () => editGift(gifts.find(g => g.id === parseInt(btn.dataset.id, 10))));
    });

    // Delete buttons
    tbody.querySelectorAll('.btn-delete-gift').forEach(btn => {
      btn.addEventListener('click', () => deleteGift(parseInt(btn.dataset.id, 10)));
    });
  }

  // ===== GIFT MODAL =====
  function initGiftModal() {
    document.getElementById('btn-add-gift').addEventListener('click', () => {
      document.getElementById('gift-modal-title').textContent = 'Novo Presente';
      document.getElementById('gift-form-id').value = '';
      document.getElementById('gift-form-emoji').value = '';
      document.getElementById('gift-form-title').value = '';
      document.getElementById('gift-form-desc').value = '';
      document.getElementById('gift-form-price').value = '';
      document.getElementById('gift-form-order').value = '0';
      document.getElementById('gift-modal').classList.add('visible');
    });

    document.getElementById('gift-modal-cancel').addEventListener('click', () => {
      document.getElementById('gift-modal').classList.remove('visible');
    });

    document.getElementById('gift-modal').addEventListener('click', (e) => {
      if (e.target.id === 'gift-modal') {
        document.getElementById('gift-modal').classList.remove('visible');
      }
    });

    document.getElementById('gift-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('gift-form-id').value;
      const body = {
        emoji: document.getElementById('gift-form-emoji').value.trim(),
        title: document.getElementById('gift-form-title').value.trim(),
        description: document.getElementById('gift-form-desc').value.trim(),
        price: parseFloat(document.getElementById('gift-form-price').value),
        sort_order: parseInt(document.getElementById('gift-form-order').value, 10) || 0
      };

      try {
        const url = id ? `${API}/admin/gifts/${id}` : `${API}/admin/gifts`;
        const method = id ? 'PUT' : 'POST';

        const res = await authFetch(url, {
          method,
          body: JSON.stringify(body)
        });

        const data = await res.json();

        if (!res.ok) {
          showAdminToast(data.error || 'Erro ao salvar.');
          return;
        }

        showAdminToast(data.message || 'Salvo!');
        document.getElementById('gift-modal').classList.remove('visible');
        loadGifts();
        loadDashboard();
      } catch (err) {
        showAdminToast('Erro ao salvar presente.');
      }
    });
  }

  function editGift(gift) {
    if (!gift) return;
    document.getElementById('gift-modal-title').textContent = 'Editar Presente';
    document.getElementById('gift-form-id').value = gift.id;
    document.getElementById('gift-form-emoji').value = gift.emoji;
    document.getElementById('gift-form-title').value = gift.title;
    document.getElementById('gift-form-desc').value = gift.description;
    document.getElementById('gift-form-price').value = gift.price;
    document.getElementById('gift-form-order').value = gift.sort_order || 0;
    document.getElementById('gift-modal').classList.add('visible');
  }

  async function deleteGift(id) {
    if (!confirm('Tem certeza que deseja remover este presente?')) return;

    try {
      const res = await authFetch(`${API}/admin/gifts/${id}`, { method: 'DELETE' });
      const data = await res.json();
      showAdminToast(data.message || 'Removido!');
      loadGifts();
      loadDashboard();
    } catch (err) {
      showAdminToast('Erro ao remover.');
    }
  }

  // ===== PAYMENTS =====
  async function loadPayments() {
    try {
      const res = await authFetch(`${API}/admin/payments`);
      const payments = await res.json();
      renderPaymentsTable(payments);
    } catch (err) {
      console.error('Erro ao carregar pagamentos:', err);
    }
  }

  function renderPaymentsTable(payments) {
    const tbody = document.getElementById('payments-table-body');
    if (!payments.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;">Nenhum pagamento registrado.</td></tr>';
      return;
    }

    tbody.innerHTML = payments.map(p => {
      let statusBadge = '';
      switch (p.status) {
        case 'approved':
        case 'confirmed':
          statusBadge = '<span class="badge badge-success">Confirmado ✓</span>';
          break;
        case 'pending':
          statusBadge = '<span class="badge badge-info">Pendente</span>';
          break;
        case 'pending_confirmation':
          statusBadge = '<span class="badge badge-warning">Aguardando ⚠️</span>';
          break;
        case 'rejected':
          statusBadge = '<span class="badge badge-danger">Rejeitado</span>';
          break;
        default:
          statusBadge = `<span class="badge badge-default">${escapeHtml(p.status)}</span>`;
      }

      const date = new Date(p.created_at).toLocaleDateString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });

      let actions = '';
      if (p.status === 'pending_confirmation') {
        actions = `
          <button class="btn btn-success btn-confirm-payment" data-id="${p.id}" title="Confirmar">✓</button>
          <button class="btn btn-danger btn-reject-payment" data-id="${p.id}" title="Rejeitar">✗</button>
        `;
      }

      return `
        <tr>
          <td>${date}</td>
          <td>${p.emoji ? escapeHtml(p.emoji) : ''} ${p.gift_title ? escapeHtml(p.gift_title) : '—'}</td>
          <td><strong>R$ ${formatPrice(p.amount)}</strong></td>
          <td>
            ${escapeHtml(p.payer_name)}
            ${p.payer_message ? `<br><small style="color:var(--text-light)">"${escapeHtml(p.payer_message)}"</small>` : ''}
          </td>
          <td>${p.pix_manual ? '📱 PIX' : '💳 MP'}</td>
          <td>${statusBadge}</td>
          <td class="actions-cell">${actions}</td>
        </tr>
      `;
    }).join('');

    // Confirm buttons
    tbody.querySelectorAll('.btn-confirm-payment').forEach(btn => {
      btn.addEventListener('click', () => confirmPayment(parseInt(btn.dataset.id, 10)));
    });

    // Reject buttons
    tbody.querySelectorAll('.btn-reject-payment').forEach(btn => {
      btn.addEventListener('click', () => rejectPayment(parseInt(btn.dataset.id, 10)));
    });
  }

  async function confirmPayment(id) {
    if (!confirm('Confirmar que recebeu este pagamento?')) return;

    try {
      const res = await authFetch(`${API}/admin/payments/${id}/confirm`, { method: 'POST' });
      const data = await res.json();
      showAdminToast(data.message || 'Confirmado!');
      loadPayments();
      loadGifts();
      loadDashboard();
    } catch (err) {
      showAdminToast('Erro ao confirmar.');
    }
  }

  async function rejectPayment(id) {
    if (!confirm('Rejeitar este pagamento? O presente ficará disponível novamente.')) return;

    try {
      const res = await authFetch(`${API}/admin/payments/${id}/reject`, { method: 'POST' });
      const data = await res.json();
      showAdminToast(data.message || 'Rejeitado.');
      loadPayments();
      loadGifts();
      loadDashboard();
    } catch (err) {
      showAdminToast('Erro ao rejeitar.');
    }
  }

  // ===== MESSAGES =====
  async function loadMessages() {
    try {
      const res = await authFetch(`${API}/admin/messages`);
      const messages = await res.json();
      renderMessagesList(messages);
    } catch (err) {
      console.error('Erro ao carregar mensagens:', err);
    }
  }

  function renderMessagesList(messages) {
    const list = document.getElementById('messages-list');
    if (!messages.length) {
      list.innerHTML = '<p style="text-align:center;padding:40px;color:var(--text-light)">Nenhum recado recebido ainda.</p>';
      return;
    }

    list.innerHTML = messages.map(m => {
      const date = new Date(m.created_at).toLocaleDateString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric'
      });

      return `
        <div class="message-card" id="msg-${m.id}">
          <div class="msg-header">
            <span class="msg-name">${escapeHtml(m.guest_name)}</span>
            <div style="display:flex;align-items:center;gap:10px;">
              <span class="msg-date">${date}</span>
              <button class="msg-delete-btn" data-msg-id="${m.id}" title="Remover recado">🗑️</button>
            </div>
          </div>
          ${m.gift_title ? `<div class="msg-gift" style="font-size:13px;color:var(--text-light);margin-bottom:6px;">${escapeHtml(m.gift_title)}</div>` : ''}
          <div class="msg-text">"${escapeHtml(m.message)}"</div>
        </div>
      `;
    }).join('');

    // Attach delete handlers
    list.querySelectorAll('.msg-delete-btn').forEach(btn => {
      btn.addEventListener('click', () => deleteMessage(btn.dataset.msgId));
    });
  }

  // ===== TOAST =====
  function showAdminToast(message) {
    const existing = document.querySelector('.admin-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'admin-toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => toast.remove(), 3500);
  }

  // ===== DELETE MESSAGE =====
  async function deleteMessage(id) {
    if (!confirm('Tem certeza que deseja remover este recado?')) return;
    try {
      const res = await authFetch(`${API}/admin/messages/${id}`, { method: 'DELETE' });
      if (res.ok) {
        const card = document.getElementById(`msg-${id}`);
        if (card) card.remove();
        showAdminToast('Recado removido com sucesso!');
        loadDashboard();
      } else {
        showAdminToast('Erro ao remover recado.');
      }
    } catch (err) {
      console.error('Erro ao remover mensagem:', err);
      showAdminToast('Erro ao remover recado.');
    }
  }
  // window.deleteMessage not needed - using event delegation

  // ===== HELPERS =====
  function formatPrice(price) {
    return Number(price).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

})();
