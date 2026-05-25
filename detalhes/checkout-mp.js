/* ============================================================
   checkout-mp.js  —  Checkout Transparente Dona Flor
   Dependências (já carregadas na página):
     • https://sdk.mercadopago.com/js/v2
   Variáveis globais esperadas (de config.js):
     • window.MP_PUBLIC_KEY  — chave pública do Mercado Pago
     • window.SUPABASE_EDGE_URL — URL base das Edge Functions
       ex: "https://xxxx.supabase.co/functions/v1"
   ============================================================ */

(function () {
  "use strict";

  // ── CSS do modal ──────────────────────────────────────────
  const STYLES = `
    @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700&display=swap');

    .mpco-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,.55);
      z-index: 9000; display: flex; align-items: center; justify-content: center;
      animation: mpco-fadeIn .22s ease; padding: 16px;
    }
    @keyframes mpco-fadeIn { from{opacity:0} to{opacity:1} }

    .mpco-modal {
      font-family: 'Nunito', Arial, sans-serif;
      background: #fff; border-radius: 16px; width: 100%; max-width: 480px;
      max-height: 92vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,.22);
      animation: mpco-slideUp .28s cubic-bezier(.22,1,.36,1);
    }
    @keyframes mpco-slideUp { from{transform:translateY(30px);opacity:0} to{transform:translateY(0);opacity:1} }

    .mpco-header {
      background: linear-gradient(135deg,#eb3a75,#c0185a);
      padding: 22px 24px 18px; border-radius: 16px 16px 0 0;
      display: flex; align-items: center; justify-content: space-between; color:#fff;
    }
    .mpco-header h2 { font-size:18px; font-weight:700; margin:0; }
    .mpco-header small { font-size:12px; opacity:.8; }
    .mpco-close {
      background:rgba(255,255,255,.2); border:none; color:#fff; width:32px; height:32px;
      border-radius:50%; cursor:pointer; font-size:18px; display:flex; align-items:center;
      justify-content:center; transition:background .2s;
    }
    .mpco-close:hover { background:rgba(255,255,255,.35); }

    .mpco-product-bar {
      background:#fdf0f5; padding:14px 24px; display:flex; justify-content:space-between;
      align-items:center; border-bottom:1px solid #f5d5e5; font-size:14px;
    }
    .mpco-product-bar span { color:#555; max-width:280px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .mpco-product-bar strong { color:#eb3a75; font-size:18px; white-space:nowrap; }

    .mpco-tabs {
      display:flex; border-bottom:2px solid #f0f0f0; padding:0 24px;
    }
    .mpco-tab {
      flex:1; padding:14px 8px; background:none; border:none; cursor:pointer;
      font-family:'Nunito',sans-serif; font-size:14px; font-weight:600;
      color:#999; border-bottom:2px solid transparent; margin-bottom:-2px;
      transition:all .2s; display:flex; align-items:center; justify-content:center; gap:6px;
    }
    .mpco-tab.active { color:#eb3a75; border-bottom-color:#eb3a75; }
    .mpco-tab:hover:not(.active) { color:#c0185a; }

    .mpco-body { padding:24px; }

    .mpco-panel { display:none; }
    .mpco-panel.active { display:block; }

    /* Campos */
    .mpco-field { margin-bottom:16px; }
    .mpco-field label { display:block; font-size:12px; font-weight:700; color:#555; margin-bottom:6px; text-transform:uppercase; letter-spacing:.5px; }
    .mpco-field input, .mpco-field select {
      width:100%; padding:11px 14px; border:1.5px solid #e0e0e0; border-radius:8px;
      font-family:'Nunito',sans-serif; font-size:15px; color:#333;
      transition:border-color .2s; outline:none;
    }
    .mpco-field input:focus, .mpco-field select:focus { border-color:#eb3a75; }
    .mpco-field input::placeholder { color:#bbb; }
    .mpco-row { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
    .mpco-row-3 { display:grid; grid-template-columns:2fr 1fr 1fr; gap:14px; }

    /* Botão pagar */
    .mpco-btn-pay {
      width:100%; padding:15px; background:linear-gradient(135deg,#eb3a75,#c0185a);
      color:#fff; border:none; border-radius:10px; font-family:'Nunito',sans-serif;
      font-size:16px; font-weight:700; cursor:pointer; margin-top:8px;
      transition:opacity .2s, transform .15s; display:flex; align-items:center;
      justify-content:center; gap:10px;
    }
    .mpco-btn-pay:hover:not(:disabled) { opacity:.9; transform:translateY(-1px); }
    .mpco-btn-pay:disabled { opacity:.55; cursor:not-allowed; transform:none; }

    .mpco-secure { text-align:center; font-size:11px; color:#aaa; margin-top:12px; display:flex; align-items:center; justify-content:center; gap:5px; }

    /* PIX */
    .mpco-pix-info {
      background:#f0faf4; border:1.5px dashed #4caf50; border-radius:10px;
      padding:18px; text-align:center; margin-bottom:18px;
    }
    .mpco-pix-info p { color:#2e7d32; font-size:13px; margin:0 0 4px; }
    .mpco-pix-icon { font-size:36px; margin-bottom:8px; }
    .mpco-pix-result { display:none; }
    .mpco-pix-qr { text-align:center; margin-bottom:16px; }
    .mpco-pix-qr img { width:180px; height:180px; border:1px solid #eee; border-radius:8px; }
    .mpco-pix-copy {
      background:#f5f5f5; border:1px solid #ddd; border-radius:8px; padding:10px 14px;
      display:flex; align-items:center; gap:10px; cursor:pointer; transition:background .2s;
    }
    .mpco-pix-copy:hover { background:#efefef; }
    .mpco-pix-copy code { flex:1; font-size:11px; color:#333; word-break:break-all; font-family:monospace; }
    .mpco-pix-copy button {
      background:#eb3a75; color:#fff; border:none; border-radius:6px;
      padding:6px 12px; font-size:12px; font-weight:700; cursor:pointer; white-space:nowrap;
    }
    .mpco-pix-expiry { font-size:12px; color:#888; text-align:center; margin-top:10px; }
    .mpco-status-poll { display:flex; align-items:center; justify-content:center; gap:8px; margin-top:16px; color:#888; font-size:13px; }
    .mpco-spinner { width:16px; height:16px; border:2px solid #ddd; border-top-color:#eb3a75; border-radius:50%; animation:mpco-spin 1s linear infinite; flex-shrink:0; }
    @keyframes mpco-spin { to{transform:rotate(360deg)} }

    /* Sucesso/Erro */
    .mpco-feedback {
      text-align:center; padding:32px 16px; display:none;
    }
    .mpco-feedback.show { display:block; }
    .mpco-feedback-icon { font-size:56px; margin-bottom:14px; }
    .mpco-feedback h3 { font-size:22px; font-weight:700; margin:0 0 8px; }
    .mpco-feedback p { font-size:14px; color:#666; margin:0; }
    .mpco-feedback.success .mpco-feedback-icon { color:#4caf50; }
    .mpco-feedback.success h3 { color:#2e7d32; }
    .mpco-feedback.error .mpco-feedback-icon { color:#f44336; }
    .mpco-feedback.error h3 { color:#c62828; }

    /* loader overlay */
    .mpco-loading {
      display:none; position:absolute; inset:0; background:rgba(255,255,255,.8);
      border-radius:16px; align-items:center; justify-content:center; flex-direction:column;
      gap:12px; font-size:14px; color:#888; z-index:10;
    }
    .mpco-loading.show { display:flex; }
    .mpco-loading .mpco-spinner { width:32px; height:32px; border-width:3px; }

    .mpco-modal { position:relative; }

    @media(max-width:480px){
      .mpco-row, .mpco-row-3 { grid-template-columns:1fr; }
      .mpco-body { padding:16px; }
    }
  `;

  // ── Injetar estilos ───────────────────────────────────────
  function injectStyles() {
    if (document.getElementById("mpco-styles")) return;
    const s = document.createElement("style");
    s.id = "mpco-styles";
    s.textContent = STYLES;
    document.head.appendChild(s);
  }

  // ── Formatar moeda ────────────────────────────────────────
  function formatBRL(value) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  }

  // ── Máscara simples de cartão ─────────────────────────────
  function maskCard(val) {
    return val.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
  }
  function maskExpiry(val) {
    return val.replace(/\D/g, "").slice(0, 4).replace(/(\d{2})(\d)/, "$1/$2");
  }
  function maskDoc(val) {
    const d = val.replace(/\D/g, "");
    if (d.length <= 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }

  // ── Detectar bandeira ─────────────────────────────────────
  function detectBrand(num) {
    const n = num.replace(/\s/g, "");
    if (/^4/.test(n)) return "visa";
    if (/^5[1-5]/.test(n) || /^2[2-7]/.test(n)) return "master";
    if (/^3[47]/.test(n)) return "amex";
    if (/^(36|38|30[0-5])/.test(n)) return "diners";
    if (/^6(011|5)/.test(n)) return "discover";
    if (/^(606282|3841)/.test(n)) return "hipercard";
    if (/^(401178|401179|438935|451416|457393|504175|627780|636297|636368)/.test(n) || /^(506699|5067|4576|4011)/.test(n)) return "elo";
    return null;
  }

  // ── Chamar Edge Function ──────────────────────────────────
  async function callEdge(action, payload) {
    const url = `${window.SUPABASE_EDGE_URL}/mp-checkout`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...payload }),
    });
    const data = await res.json();
    if (!res.ok) throw data;
    return data;
  }

  // ── Criar token MP (client-side) ──────────────────────────
  async function createCardToken(mp, form) {
    const [month, year] = form.expiry.split("/");
    return mp.createCardToken({
      cardNumber: form.cardNumber.replace(/\s/g, ""),
      cardholderName: form.holderName,
      cardExpirationMonth: month,
      cardExpirationYear: "20" + year,
      securityCode: form.cvv,
      identificationType: form.docType,
      identificationNumber: form.docNumber.replace(/\D/g, ""),
    });
  }

  // ── HTML do modal ─────────────────────────────────────────
  function buildModalHTML(produto, preco) {
    return `
    <div class="mpco-overlay" id="mpco-overlay">
      <div class="mpco-modal" id="mpco-modal" role="dialog" aria-modal="true" aria-label="Finalizar pedido">
        <div class="mpco-loading" id="mpco-loading">
          <div class="mpco-spinner"></div>
          <span>Processando pagamento…</span>
        </div>

        <div class="mpco-header">
          <div>
            <h2>Finalizar Pedido</h2>
            <small>Checkout seguro • Dona Flor</small>
          </div>
          <button class="mpco-close" id="mpco-close" aria-label="Fechar">✕</button>
        </div>

        <div class="mpco-product-bar">
          <span>${produto}</span>
          <strong>${formatBRL(preco)}</strong>
        </div>

        <!-- Dados do comprador -->
        <div class="mpco-body" id="mpco-payer-section">
          <div class="mpco-field">
            <label>Nome completo</label>
            <input id="mpco-name" type="text" placeholder="Como está no cartão" autocomplete="name">
          </div>
          <div class="mpco-field">
            <label>E-mail</label>
            <input id="mpco-email" type="email" placeholder="seu@email.com" autocomplete="email">
          </div>
          <div class="mpco-row">
            <div class="mpco-field">
              <label>CPF / CNPJ</label>
              <input id="mpco-doc" type="text" placeholder="000.000.000-00" maxlength="18" inputmode="numeric">
            </div>
            <div class="mpco-field">
              <label>Tipo</label>
              <select id="mpco-doctype">
                <option value="CPF">CPF</option>
                <option value="CNPJ">CNPJ</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Abas de pagamento -->
        <div class="mpco-tabs" id="mpco-tabs">
          <button class="mpco-tab active" data-tab="credit" type="button">
            <i class="ri-bank-card-line"></i> Crédito
          </button>
          <button class="mpco-tab" data-tab="debit" type="button">
            <i class="ri-bank-card-2-line"></i> Débito
          </button>
          <button class="mpco-tab" data-tab="pix" type="button">
            <span style="font-weight:900;color:#32bcad;font-size:13px">PIX</span>
          </button>
        </div>

        <!-- Painel Crédito -->
        <div class="mpco-body">
          <div class="mpco-panel active" id="mpco-panel-credit">
            <div class="mpco-field">
              <label>Número do cartão</label>
              <input id="mpco-card-credit" type="text" placeholder="0000 0000 0000 0000" maxlength="19" inputmode="numeric">
            </div>
            <div class="mpco-row-3">
              <div class="mpco-field">
                <label>Nome no cartão</label>
                <input id="mpco-holder-credit" type="text" placeholder="NOME SOBRENOME" style="text-transform:uppercase">
              </div>
              <div class="mpco-field">
                <label>Validade</label>
                <input id="mpco-expiry-credit" type="text" placeholder="MM/AA" maxlength="5" inputmode="numeric">
              </div>
              <div class="mpco-field">
                <label>CVV</label>
                <input id="mpco-cvv-credit" type="text" placeholder="123" maxlength="4" inputmode="numeric">
              </div>
            </div>
            <div class="mpco-field">
              <label>Parcelas</label>
              <select id="mpco-installments">
                <option value="1">1x de ${formatBRL(preco)} (sem juros)</option>
              </select>
            </div>
            <button class="mpco-btn-pay" id="mpco-pay-credit" type="button">
              <i class="ri-lock-line"></i> Pagar ${formatBRL(preco)}
            </button>
            <p class="mpco-secure"><i class="ri-shield-check-line"></i> Pagamento seguro via Mercado Pago</p>
          </div>

          <!-- Painel Débito -->
          <div class="mpco-panel" id="mpco-panel-debit">
            <div class="mpco-field">
              <label>Número do cartão</label>
              <input id="mpco-card-debit" type="text" placeholder="0000 0000 0000 0000" maxlength="19" inputmode="numeric">
            </div>
            <div class="mpco-row-3">
              <div class="mpco-field">
                <label>Nome no cartão</label>
                <input id="mpco-holder-debit" type="text" placeholder="NOME SOBRENOME" style="text-transform:uppercase">
              </div>
              <div class="mpco-field">
                <label>Validade</label>
                <input id="mpco-expiry-debit" type="text" placeholder="MM/AA" maxlength="5" inputmode="numeric">
              </div>
              <div class="mpco-field">
                <label>CVV</label>
                <input id="mpco-cvv-debit" type="text" placeholder="123" maxlength="4" inputmode="numeric">
              </div>
            </div>
            <button class="mpco-btn-pay" id="mpco-pay-debit" type="button">
              <i class="ri-lock-line"></i> Pagar ${formatBRL(preco)} no Débito
            </button>
            <p class="mpco-secure"><i class="ri-shield-check-line"></i> Pagamento seguro via Mercado Pago</p>
          </div>

          <!-- Painel PIX -->
          <div class="mpco-panel" id="mpco-panel-pix">
            <div class="mpco-pix-info">
              <div class="mpco-pix-icon">⚡</div>
              <p><strong>Pague instantaneamente com PIX</strong></p>
              <p>Aprovação em segundos • 100% seguro</p>
            </div>

            <!-- Antes de gerar -->
            <div id="mpco-pix-generate">
              <button class="mpco-btn-pay" id="mpco-pay-pix" type="button" style="background:linear-gradient(135deg,#32bcad,#1a9c8e)">
                <span style="font-weight:900;font-size:15px">PIX</span> Gerar QR Code — ${formatBRL(preco)}
              </button>
            </div>

            <!-- Após gerar -->
            <div class="mpco-pix-result" id="mpco-pix-result">
              <div class="mpco-pix-qr">
                <img id="mpco-pix-qr-img" src="" alt="QR Code PIX">
              </div>
              <div class="mpco-pix-copy" id="mpco-pix-copy-area">
                <code id="mpco-pix-key"></code>
                <button type="button" onclick="window._mpCopyPix()">Copiar</button>
              </div>
              <p class="mpco-pix-expiry" id="mpco-pix-expiry"></p>
              <div class="mpco-status-poll">
                <div class="mpco-spinner"></div>
                <span>Aguardando pagamento…</span>
              </div>
            </div>
            <p class="mpco-secure" style="margin-top:16px"><i class="ri-shield-check-line"></i> Pagamento seguro via Mercado Pago</p>
          </div>

          <!-- Feedback sucesso/erro -->
          <div class="mpco-feedback success" id="mpco-success">
            <div class="mpco-feedback-icon">✅</div>
            <h3>Pagamento aprovado!</h3>
            <p>Seu pedido foi confirmado. Você receberá um e-mail em breve.</p>
          </div>
          <div class="mpco-feedback error" id="mpco-error">
            <div class="mpco-feedback-icon">❌</div>
            <h3>Pagamento recusado</h3>
            <p id="mpco-error-msg">Verifique os dados do cartão e tente novamente.</p>
          </div>
        </div>
      </div>
    </div>`;
  }

  // ── Parcelamento dinâmico ─────────────────────────────────
  function buildInstallments(total) {
    const MAX = 12;
    const RATE_MONTHLY = 0.0249; // ~2,49% a.m. — ajuste conforme sua tabela
    const FREE_INSTALLMENTS = 3;
    const sel = document.getElementById("mpco-installments");
    if (!sel) return;
    sel.innerHTML = "";
    for (let i = 1; i <= MAX; i++) {
      const opt = document.createElement("option");
      opt.value = i;
      if (i <= FREE_INSTALLMENTS) {
        const v = total / i;
        opt.textContent = `${i}x de ${formatBRL(v)} (sem juros)`;
      } else {
        const v = (total * Math.pow(1 + RATE_MONTHLY, i)) / i;
        const total2 = v * i;
        opt.textContent = `${i}x de ${formatBRL(v)} (total ${formatBRL(total2)})`;
      }
      sel.appendChild(opt);
    }
  }

  // ── Abrir / fechar modal ──────────────────────────────────
  function closeModal() {
    const ov = document.getElementById("mpco-overlay");
    if (ov) ov.remove();
    document.body.style.overflow = "";
    clearInterval(window._mpPixPoll);
  }

  // ── Validação básica ──────────────────────────────────────
  function getPayer() {
    const name = document.getElementById("mpco-name").value.trim();
    const email = document.getElementById("mpco-email").value.trim();
    const doc = document.getElementById("mpco-doc").value.replace(/\D/g, "");
    const docType = document.getElementById("mpco-doctype").value;
    if (!name) throw "Por favor informe seu nome.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw "E-mail inválido.";
    if (doc.length < 11) throw "CPF/CNPJ inválido.";
    return { name, email, doc, docType };
  }

  function getCardForm(prefix) {
    const card = document.getElementById(`mpco-card-${prefix}`).value.replace(/\s/g, "");
    const holder = document.getElementById(`mpco-holder-${prefix}`).value.trim();
    const expiry = document.getElementById(`mpco-expiry-${prefix}`).value.trim();
    const cvv = document.getElementById(`mpco-cvv-${prefix}`).value.trim();
    if (card.length < 13) throw "Número de cartão inválido.";
    if (!expiry.includes("/")) throw "Validade inválida. Use MM/AA.";
    if (cvv.length < 3) throw "CVV inválido.";
    if (!holder) throw "Informe o nome do titular.";
    return { cardNumber: card, holderName: holder, expiry, cvv };
  }

  // ── Mostrar feedback ──────────────────────────────────────
  function showFeedback(type, msg) {
    ["mpco-panel-credit", "mpco-panel-debit", "mpco-panel-pix", "mpco-payer-section", "mpco-tabs"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = "none";
    });
    const fb = document.getElementById(`mpco-${type}`);
    if (fb) fb.classList.add("show");
    if (type === "error" && msg) {
      const el = document.getElementById("mpco-error-msg");
      if (el) el.textContent = msg;
    }
    if (type === "success") setTimeout(closeModal, 4000);
  }

  // ── Polling de status PIX ─────────────────────────────────
  function startPixPoll(paymentId) {
    clearInterval(window._mpPixPoll);
    window._mpPixPoll = setInterval(async () => {
      try {
        const data = await callEdge("get_status", { id: paymentId, type: "payment" });
        if (data.status === "approved") {
          clearInterval(window._mpPixPoll);
          showFeedback("success");
        } else if (["cancelled", "rejected", "refunded"].includes(data.status)) {
          clearInterval(window._mpPixPoll);
          showFeedback("error", "Pagamento PIX cancelado ou expirado.");
        }
      } catch (_) { /* continua tentando */ }
    }, 5000);
  }

  // ── Copiar chave PIX ──────────────────────────────────────
  window._mpCopyPix = function () {
    const key = document.getElementById("mpco-pix-key")?.textContent;
    if (!key) return;
    navigator.clipboard.writeText(key).then(() => {
      const btn = document.querySelector("#mpco-pix-copy-area button");
      if (btn) { btn.textContent = "Copiado!"; setTimeout(() => { btn.textContent = "Copiar"; }, 2000); }
    });
  };

  // ── Inicializar checkout ──────────────────────────────────
  function initCheckout(produto, preco) {
    injectStyles();

    // Carregar SDK MP se necessário
    function boot() {
      const mp = new MercadoPago(window.MP_PUBLIC_KEY, { locale: "pt-BR" });

      // Injetar modal
      const wrapper = document.createElement("div");
      wrapper.innerHTML = buildModalHTML(produto, preco);
      document.body.appendChild(wrapper.firstElementChild);
      document.body.style.overflow = "hidden";

      buildInstallments(preco);

      // Fechar modal
      document.getElementById("mpco-close").addEventListener("click", closeModal);
      document.getElementById("mpco-overlay").addEventListener("click", (e) => {
        if (e.target.id === "mpco-overlay") closeModal();
      });

      // Máscaras
      ["credit", "debit"].forEach(t => {
        document.getElementById(`mpco-card-${t}`).addEventListener("input", function () {
          this.value = maskCard(this.value);
          buildInstallments(preco); // atualiza bandeira futuramente
        });
        document.getElementById(`mpco-expiry-${t}`).addEventListener("input", function () {
          this.value = maskExpiry(this.value);
        });
        document.getElementById(`mpco-cvv-${t}`).addEventListener("input", function () {
          this.value = this.value.replace(/\D/g, "").slice(0, 4);
        });
      });
      document.getElementById("mpco-doc").addEventListener("input", function () {
        this.value = maskDoc(this.value);
      });

      // Troca de abas
      document.querySelectorAll(".mpco-tab").forEach(tab => {
        tab.addEventListener("click", () => {
          document.querySelectorAll(".mpco-tab").forEach(t => t.classList.remove("active"));
          document.querySelectorAll(".mpco-panel").forEach(p => p.classList.remove("active"));
          tab.classList.add("active");
          document.getElementById(`mpco-panel-${tab.dataset.tab}`).classList.add("active");
        });
      });

      // ── Pagar Crédito ────────────────────────────────────
      document.getElementById("mpco-pay-credit").addEventListener("click", async () => {
        try {
          const payer = getPayer();
          const card = getCardForm("credit");
          const installments = parseInt(document.getElementById("mpco-installments").value, 10);
          const brand = detectBrand(card.cardNumber);
          if (!brand) throw "Bandeira de cartão não identificada.";

          document.getElementById("mpco-loading").classList.add("show");
          document.getElementById("mpco-pay-credit").disabled = true;

          const tokenRes = await createCardToken(mp, {
            ...card,
            docType: payer.docType,
            docNumber: payer.doc,
          });
          if (!tokenRes || tokenRes.error) throw tokenRes?.cause?.[0]?.description || "Erro ao tokenizar cartão.";

          const order = await callEdge("create_order", {
            amount: preco,
            description: produto,
            token: tokenRes.id,
            installments,
            paymentMethodId: brand,
            payerEmail: payer.email,
            payerName: payer.name,
            payerDocType: payer.docType,
            payerDocNumber: payer.doc,
            isDebit: false,
          });

          document.getElementById("mpco-loading").classList.remove("show");

          const status = order?.transactions?.payments?.[0]?.status ?? order?.status;
          if (status === "processed" || status === "approved") {
            showFeedback("success");
          } else {
            showFeedback("error", `Status: ${status}. Verifique os dados e tente novamente.`);
          }
        } catch (err) {
          document.getElementById("mpco-loading").classList.remove("show");
          document.getElementById("mpco-pay-credit").disabled = false;
          const msg = typeof err === "string" ? err : err?.message || err?.error || "Erro ao processar pagamento.";
          showFeedback("error", msg);
        }
      });

      // ── Pagar Débito ─────────────────────────────────────
      document.getElementById("mpco-pay-debit").addEventListener("click", async () => {
        try {
          const payer = getPayer();
          const card = getCardForm("debit");
          const brand = detectBrand(card.cardNumber);
          if (!brand) throw "Bandeira de cartão não identificada.";

          document.getElementById("mpco-loading").classList.add("show");
          document.getElementById("mpco-pay-debit").disabled = true;

          const tokenRes = await createCardToken(mp, {
            ...card,
            docType: payer.docType,
            docNumber: payer.doc,
          });
          if (!tokenRes || tokenRes.error) throw tokenRes?.cause?.[0]?.description || "Erro ao tokenizar cartão.";

          const order = await callEdge("create_order", {
            amount: preco,
            description: produto,
            token: tokenRes.id,
            installments: 1,
            paymentMethodId: `${brand}_debit`,
            payerEmail: payer.email,
            payerName: payer.name,
            payerDocType: payer.docType,
            payerDocNumber: payer.doc,
            isDebit: true,
          });

          document.getElementById("mpco-loading").classList.remove("show");

          const status = order?.transactions?.payments?.[0]?.status ?? order?.status;
          if (status === "processed" || status === "approved") {
            showFeedback("success");
          } else {
            showFeedback("error", `Status: ${status}. Verifique os dados e tente novamente.`);
          }
        } catch (err) {
          document.getElementById("mpco-loading").classList.remove("show");
          document.getElementById("mpco-pay-debit").disabled = false;
          const msg = typeof err === "string" ? err : err?.message || err?.error || "Erro ao processar pagamento.";
          showFeedback("error", msg);
        }
      });

      // ── Gerar PIX ────────────────────────────────────────
      document.getElementById("mpco-pay-pix").addEventListener("click", async () => {
        try {
          const payer = getPayer();
          document.getElementById("mpco-loading").classList.add("show");
          document.getElementById("mpco-pay-pix").disabled = true;

          const payment = await callEdge("create_pix", {
            amount: preco,
            description: produto,
            payerEmail: payer.email,
            payerName: payer.name,
            payerDocType: payer.docType,
            payerDocNumber: payer.doc,
          });

          document.getElementById("mpco-loading").classList.remove("show");

          const qrData = payment?.point_of_interaction?.transaction_data;
          if (!qrData) throw "PIX não disponível no momento.";

          // Exibir QR
          document.getElementById("mpco-pix-generate").style.display = "none";
          const result = document.getElementById("mpco-pix-result");
          result.style.display = "block";

          const qrImg = document.getElementById("mpco-pix-qr-img");
          if (qrData.qr_code_base64) {
            qrImg.src = `data:image/png;base64,${qrData.qr_code_base64}`;
          } else {
            qrImg.style.display = "none";
          }

          document.getElementById("mpco-pix-key").textContent = qrData.qr_code || "";

          // Expiração (~30min)
          const exp = new Date(Date.now() + 30 * 60 * 1000);
          document.getElementById("mpco-pix-expiry").textContent =
            `Válido até ${exp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;

          startPixPoll(payment.id);
        } catch (err) {
          document.getElementById("mpco-loading").classList.remove("show");
          document.getElementById("mpco-pay-pix").disabled = false;
          const msg = typeof err === "string" ? err : err?.message || err?.error || "Erro ao gerar PIX.";
          alert("Erro: " + msg);
        }
      });
    }

    if (typeof MercadoPago !== "undefined") {
      boot();
    } else {
      const script = document.createElement("script");
      script.src = "https://sdk.mercadopago.com/js/v2";
      script.onload = boot;
      document.head.appendChild(script);
    }
  }

  // ── Exportar público ──────────────────────────────────────
  window.MpCheckout = { open: initCheckout };
})();
