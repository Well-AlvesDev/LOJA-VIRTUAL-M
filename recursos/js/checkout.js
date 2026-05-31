/* =============================================================
   checkout.js — Lógica do checkout Mercado Pago
   Fonte única para: index.html, produtos.html, detalhes.html
   Importe com: <script src="./recursos/js/checkout.js"></script>
   ANTES do SDK do Mercado Pago e DEPOIS do cart.js
   (ajuste o caminho relativo conforme a página)
============================================================= */

// ================================================================
//  CONFIGURAÇÃO DO MERCADO PAGO
//  Substitua os valores abaixo pelas suas credenciais reais
// ================================================================
const MP_CONFIG = {
    // Public Key do Mercado Pago — usada APENAS para tokenizar o cartão no browser (seguro)
    publicKey: 'APP_USR-d7f127f1-f241-4a77-8f93-9bae62484675',

    // ✅ Access Token REMOVIDO do frontend — agora fica seguro na Edge Function do Supabase.
    //    Substitua a URL abaixo pela URL da sua Edge Function após o deploy.
    //    Formato: https://<SEU_PROJECT_REF>.supabase.co/functions/v1/mp-checkout
    edgeFunctionUrl: 'https://hovfcntzthahwszjaxsw.supabase.co/functions/v1/mp-checkout',

    // Intervalo de polling em ms (verifica status do pagamento a cada X ms)
    // Aumentado para 5 segundos para reduzir requisições desnecessárias
    pollingInterval: 5000,

    // Máximo de tentativas de polling antes de parar
    // 600 tentativas × 5 segundos = 3000 segundos = 50 minutos (cobre os 30 min do PIX com margem)
    pollingMaxTentativas: 600,
};

// Helper: chama a Edge Function com uma action específica
async function mpEdge(action, dados) {
    const resp = await fetch(MP_CONFIG.edgeFunctionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...dados }),
    });
    const data = await resp.json();
    if (!resp.ok) throw { httpStatus: resp.status, ...data };
    return data;
}

// ================================================================
//  ESTADO DO CHECKOUT
// ================================================================
let _co = {
    abaAtiva: 'pix',
    nomeProduto: '',
    idProduto: null,
    precoProduto: 0,
    produtos: [], // Array de produtos para checkout múltiplo
    product_ids: [], // Array de IDs dos produtos
    totalProdutos: 0,
    orderId: null,
    paymentId: null,
    pollingTimer: null,
    tentativasPolling: 0,
    pixCopiaCola: '',
    clienteNome: '',
    clienteCpf: '',
    clienteEmail: '',
    clienteTelefone: '',
    clienteEndereco: '',
};

// ================================================================
//  ABRIR / FECHAR MODAL
// ================================================================
function abrirCheckout(produtosArray, paramPreco, paramId) {
    // Se receber um array, é checkout de múltiplos produtos (via Carrinho)
    if (Array.isArray(produtosArray) && produtosArray.length > 0) {
        _co.produtos = produtosArray;

        // Calcula o total real somando as quantidades de cada item
        const quantidadeReal = produtosArray.reduce((total, p) => total + (parseInt(p.quantidade) || 1), 0);

        _co.totalProdutos = quantidadeReal;
        _co.product_ids = produtosArray.map(p => parseInt(p.id) || 0).filter(id => id > 0);

        _co.nomeProduto = quantidadeReal === 1
            ? produtosArray[0].nome
            : `${quantidadeReal} produtos`;

        _co.idProduto = quantidadeReal === 1 ? _co.product_ids[0] : null;

        // Multiplica o preço unitário pela quantidade de cada item
        _co.precoProduto = produtosArray.reduce((sum, p) => {
            const preco = parseFloat(p.preco) || 0;
            const qtd = parseInt(p.quantidade) || 1;
            return sum + (preco * qtd);
        }, 0);

    } else {
        // Suporte para compra direta de um único produto (via botão "Comprar agora")
        const idNumerico = parseInt(paramId) || 0;
        const precoNumerico = parseFloat(paramPreco) || 0;
        const nomeProd = String(produtosArray || '');

        _co.idProduto = idNumerico;
        _co.product_ids = idNumerico > 0 ? [idNumerico] : [];
        _co.produtos = [{
            id: idNumerico,
            nome: nomeProd,
            preco: precoNumerico,
            quantidade: 1
        }];
        _co.totalProdutos = 1;
        _co.nomeProduto = nomeProd;
        _co.precoProduto = precoNumerico;
    }

    renderizarResumoCheckout();
    resetarCheckout();

    document.getElementById('checkout-overlay').classList.add('aberto');
    document.body.style.overflow = 'hidden';
}

// ===== Renderizar resumo do checkout (múltiplos produtos) =====
function renderizarResumoCheckout() {
    const containerNome = document.getElementById('co-nome-produto');
    const containerPreco = document.getElementById('co-preco-produto');

    if (_co.produtos.length === 0) {
        // Sem produtos
        containerNome.textContent = '—';
        containerPreco.textContent = 'R$ 0,00';
        return;
    }

    // CORREÇÃO: Verifica se o TOTAL de itens é 1, e não se o array tem tamanho 1
    if (_co.totalProdutos === 1) {
        // Um único produto - mostrar nome e preço normalmente
        containerNome.textContent = _co.produtos[0].nome;
        containerPreco.textContent = 'R$ ' + parseFloat(_co.produtos[0].preco).toFixed(2).replace('.', ',');
    } else {
        // Múltiplos produtos - mostrar "Ver produtos" com link
        containerNome.innerHTML = `
            <span style="cursor: pointer; color: #2378da; text-decoration: underline;" onclick="abrirModalProdutosCheckout()">
                Ver produtos (${_co.totalProdutos})
            </span>
        `;
        containerPreco.textContent = 'R$ ' + _co.precoProduto.toFixed(2).replace('.', ',');
    }
}

// ===== Modal para visualizar todos os produtos =====
function abrirModalProdutosCheckout() {
    const modal = document.getElementById('modal-produtos-checkout');
    if (!modal) {
        criarModalProdutosCheckout();
    }
    document.getElementById('modal-produtos-checkout').classList.add('aberto');
}

function fecharModalProdutosCheckout() {
    const modal = document.getElementById('modal-produtos-checkout');
    if (modal) {
        modal.classList.remove('aberto');
    }
}

function criarModalProdutosCheckout() {
    const modal = document.createElement('div');
    modal.id = 'modal-produtos-checkout';
    modal.className = 'modal-produtos-checkout';
    modal.innerHTML = `
        <div class="modal-produtos-checkout-overlay" onclick="if(event.target === this) fecharModalProdutosCheckout()"></div>
        <div class="modal-produtos-checkout-content">
            <div class="modal-produtos-checkout-header">
                <h3>Produtos no Carrinho</h3>
                <button onclick="fecharModalProdutosCheckout()" class="modal-close-btn">
                    <i class="ri-close-line"></i>
                </button>
            </div>
            <div class="modal-produtos-checkout-body" id="modal-produtos-lista">
                <!-- Será preenchido dinamicamente -->
            </div>
            <div class="modal-produtos-checkout-footer">
                <div class="modal-produtos-total">
                    <span>Total:</span>
                    <strong id="modal-produtos-total-preco">R$ 0,00</strong>
                </div>
                <button onclick="fecharModalProdutosCheckout()" class="modal-btn-fechar">Fechar</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    // Fechar com ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('aberto')) {
            fecharModalProdutosCheckout();
        }
    });

    renderizarProdutosCheckout();
}

function renderizarProdutosCheckout() {
    const lista = document.getElementById('modal-produtos-lista');
    if (!lista || _co.produtos.length === 0) return;

    lista.innerHTML = `
        <table class="modal-produtos-tabela">
            <thead>
                <tr>
                    <th>Produto</th>
                    <th>Quantidade</th>
                    <th>Preço Unit.</th>
                    <th>Subtotal</th>
                </tr>
            </thead>
            <tbody>
                ${_co.produtos.map(p => {
        const preco = parseFloat(p.preco) || 0;
        const qtd = p.quantidade || 1;
        const subtotal = preco * qtd;
        return `
                        <tr>
                            <td>${p.nome}</td>
                            <td>${qtd}</td>
                            <td>R$ ${preco.toFixed(2).replace('.', ',')}</td>
                            <td>R$ ${subtotal.toFixed(2).replace('.', ',')}</td>
                        </tr>
                    `;
    }).join('')}
            </tbody>
        </table>
    `;

    const totalEl = document.getElementById('modal-produtos-total-preco');
    if (totalEl) {
        totalEl.textContent = 'R$ ' + _co.precoProduto.toFixed(2).replace('.', ',');
    }
}

function fecharCheckout() {
    document.getElementById('checkout-overlay').classList.remove('aberto');
    document.body.style.overflow = '';
    pararPolling();
}

// fechar com tecla ESC quando modal estiver aberto
window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.getElementById('checkout-overlay').classList.contains('aberto')) {
        fecharCheckout();
    }
});

function fecharCheckoutOverlay(e) {
    if (e.target === document.getElementById('checkout-overlay')) {
        fecharCheckout();
    }
}

function resetarCheckout() {
    _co.orderId = null;
    _co.paymentId = null;
    _co.tentativasPolling = 0;
    _co.pixCopiaCola = '';
    pararPolling();

    // Esconder tela de status
    const status = document.getElementById('mp-status');
    status.classList.remove('visivel', 'aprovado', 'pendente', 'rejeitado');

    // Mostrar tabs e conteúdo
    const mpTabs = document.getElementById('mp-tabs');
    if (mpTabs) mpTabs.style.display = 'flex';
    const secaoDados = document.getElementById('secao-dados-comprador');
    if (secaoDados) secaoDados.style.display = 'block';

    // Resetar abas e seções
    trocarAba('pix');

    // Limpar campos
    ['co-nome', 'co-cpf', 'co-email', 'co-telefone', 'co-endereco']
        .forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });

    // Resetar PIX QR
    document.getElementById('pix-qr-container').classList.remove('visivel');
    document.getElementById('btn-gerar-pix').style.display = 'flex';
    document.getElementById('btn-gerar-pix').innerHTML =
        '<i class="ri-qr-code-line"></i> Gerar QR Code PIX';
    document.getElementById('btn-gerar-pix').disabled = false;

    // Esconder ícone PIX estático, se presente
    const pixLogo = document.getElementById('pix-logo');
    if (pixLogo) pixLogo.style.display = 'none';

    // Limpar erro
    esconderErro();
}

// ================================================================
//  TABS
// ================================================================
function trocarAba(aba) {
    _co.abaAtiva = aba;
    ['pix', 'credito', 'debito'].forEach(a => {
        const tab = document.getElementById('tab-' + a);
        if (tab) tab.classList.toggle('ativo', a === aba);
        const section = document.getElementById('secao-' + a);
        if (section) section.style.display = a === aba ? 'block' : 'none';
    });
    esconderErro();
    // Evitar salto em mobile: remover foco do botão e garantir scroll interno
    if (window.innerWidth <= 640) {
        setTimeout(() => {
            try {
                const active = document.activeElement;
                if (active && (active.tagName === 'BUTTON' || active.tagName === 'A')) active.blur();
            } catch (e) { }
            const body = document.querySelector('#checkout-modal .checkout-body');
            if (body) body.scrollTop = 0;
        }, 40);
    }
}

// ================================================================
//  MÁSCARAS
// ================================================================
function mascaraCPF(input) {
    let v = input.value.replace(/\D/g, '').substring(0, 11);
    v = v.replace(/(\d{3})(\d)/, '$1.$2');
    v = v.replace(/(\d{3})(\d)/, '$1.$2');
    v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    input.value = v;
}

function mascaraTelefone(input) {
    let v = input.value.replace(/\D/g, '').substring(0, 11);
    if (v.length > 6) {
        v = '(' + v.substring(0, 2) + ') ' + v.substring(2, 7) + '-' + v.substring(7);
    } else if (v.length > 2) {
        v = '(' + v.substring(0, 2) + ') ' + v.substring(2);
    } else if (v.length > 0) {
        v = '(' + v;
    }
    input.value = v;
}

// ================================================================
//  VALIDAÇÃO
// ================================================================
function validarDadosComuns() {
    const nome = document.getElementById('co-nome').value.trim();
    const cpf = document.getElementById('co-cpf').value.replace(/\D/g, '');
    const email = document.getElementById('co-email').value.trim();
    const telefone = document.getElementById('co-telefone').value.replace(/\D/g, '');
    const endereco = document.getElementById('co-endereco').value.trim();

    if (!nome || nome.split(' ').length < 2)
        return mostrarErro('Informe seu nome completo (nome e sobrenome).');
    if (cpf.length !== 11)
        return mostrarErro('CPF inválido. Digite os 11 dígitos.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        return mostrarErro('E-mail inválido.');
    if (telefone.length < 10 || telefone.length > 11)
        return mostrarErro('Telefone inválido. Digite DDD + número.');
    if (!endereco || endereco.length < 10)
        return mostrarErro('Informe o endereço completo de entrega.');
    return true;
}

// ================================================================
//  UTILITÁRIOS
// ================================================================
function mostrarErro(msg) {
    const el = document.getElementById('mp-erro');
    el.textContent = msg;
    el.classList.add('visivel');
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return false;
}

function esconderErro() {
    document.getElementById('mp-erro').classList.remove('visivel');
}

function setBotaoCarregando(btnId, carregando) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.disabled = carregando;
    if (carregando) {
        btn.innerHTML = '<div class="spinner-btn"></div> Processando...';
    }
}

function copiarPixCopiaCola() {
    if (!_co.pixCopiaCola) return;
    navigator.clipboard.writeText(_co.pixCopiaCola).then(() => {
        const container = document.querySelector('.pix-codigo-container');
        if (container) {
            const icone = container.querySelector('.pix-codigo-icone');
            const textoOriginal = icone.className;
            icone.className = 'ri-check-line pix-codigo-icone';
            container.style.borderColor = '#22c55e';
            container.style.background = '#f0fdf4';
            setTimeout(() => {
                icone.className = textoOriginal;
                container.style.borderColor = '#e0e0e0';
                container.style.background = '#ffffff';
            }, 2000);
        }
    }).catch(() => {
        // Fallback para iOS Safari
        const ta = document.createElement('textarea');
        ta.value = _co.pixCopiaCola;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
    });
}

// ================================================================
//  TELA DE STATUS
// ================================================================
function mostrarStatusTela(tipo, icone, titulo, descricao, mostrarPolling) {
    const mpTabs = document.getElementById('mp-tabs');
    if (mpTabs) mpTabs.style.display = 'none';
    const secaoDados = document.getElementById('secao-dados-comprador');
    if (secaoDados) secaoDados.style.display = 'none';
    ['pix', 'credito', 'debito'].forEach(a => {
        const section = document.getElementById('secao-' + a);
        if (section) section.style.display = 'none';
    });

    const el = document.getElementById('mp-status');
    el.className = 'mp-status visivel ' + tipo;
    document.getElementById('mp-status-icon').textContent = icone;
    document.getElementById('mp-status-titulo').textContent = titulo;
    document.getElementById('mp-status-descricao').textContent = descricao;

    const polling = document.getElementById('mp-polling-info');
    polling.style.display = mostrarPolling ? 'flex' : 'none';
}

// ================================================================
//  POLLING DE STATUS
// ================================================================
function iniciarPolling(paymentId) {
    pararPolling();
    _co.tentativasPolling = 0;
    _co.pollingTimer = setInterval(() => verificarStatusPagamento(paymentId), MP_CONFIG.pollingInterval);
}

function pararPolling() {
    if (_co.pollingTimer) {
        clearInterval(_co.pollingTimer);
        _co.pollingTimer = null;
    }
}

async function verificarStatusPagamento(paymentId) {
    _co.tentativasPolling++;

    if (_co.tentativasPolling > MP_CONFIG.pollingMaxTentativas) {
        pararPolling();
        mostrarStatusTela('pendente', '', 'Tempo expirado',
            'Não conseguimos confirmar seu pagamento automaticamente. Se o pagamento foi realizado, entre em contato conosco.', false);
        return;
    }

    try {
        const data = await mpEdge('status_pagamento', {
            payment_id: paymentId,
            cliente_nome: _co.clienteNome,
            cliente_cpf: _co.clienteCpf,
            cliente_email: _co.clienteEmail,
            cliente_telefone: _co.clienteTelefone,
            cliente_endereco: _co.clienteEndereco,
            nome_produto: _co.nomeProduto,
            valor_produto: _co.precoProduto,
            product_ids: _co.product_ids,
            produtos: _co.produtos.map(p => ({ id: p.id, nome: p.nome, preco: p.preco, quantidade: p.quantidade })),
        });
        const status = data.status;

        if (status === 'approved') {
            pararPolling();
            mostrarStatusTela('aprovado', '', 'Pagamento aprovado!',
                'Seu pagamento foi confirmado com sucesso. Em breve você receberá mais informações.', false);

        } else if (status === 'rejected' || status === 'cancelled') {
            pararPolling();
            mostrarStatusTela('rejeitado', '', 'Pagamento recusado',
                'O pagamento não foi aprovado. Verifique os dados do cartão ou tente outra forma de pagamento.', false);
        }
        // se pending/in_process: não faz nada, aguarda próximo tick do polling
    } catch (err) {
        console.warn('Erro ao verificar status (tentativa ' + _co.tentativasPolling + '):', err);
        // Não para o polling em erro de rede — tenta novamente no próximo tick
    }
}

// ================================================================
//  PAGAMENTO PIX
// ================================================================
async function processarPagamentoPIX() {
    esconderErro();
    if (validarDadosComuns() !== true) return;

    setBotaoCarregando('btn-gerar-pix', true);

    const cpf = document.getElementById('co-cpf').value.replace(/\D/g, '');
    const nome = document.getElementById('co-nome').value.trim();
    const email = document.getElementById('co-email').value.trim();
    const telefone = document.getElementById('co-telefone').value.replace(/\D/g, '');
    const endereco = document.getElementById('co-endereco').value.trim();

    // Salvar dados do cliente no estado global para uso no polling
    _co.clienteNome = nome;
    _co.clienteCpf = cpf;
    _co.clienteEmail = email;
    _co.clienteTelefone = telefone;
    _co.clienteEndereco = endereco;

    try {
        const data = await mpEdge('criar_pix', {
            transaction_amount: _co.precoProduto,
            description: _co.nomeProduto,
            email,
            first_name: nome.split(' ')[0],
            last_name: nome.split(' ').slice(1).join(' '),
            cpf,
            telefone,
            endereco,
            nome_produto: _co.nomeProduto,
            product_id: _co.idProduto,
            product_ids: _co.product_ids,
            produtos: _co.produtos.map(p => ({ id: p.id, nome: p.nome, preco: p.preco, quantidade: p.quantidade })),
        });

        _co.paymentId = data.id;

        const qrBase64 = data.qr_code_base64;
        const qrText = data.qr_code;

        if (qrBase64) {
            document.getElementById('pix-qr-img').src = 'data:image/png;base64,' + qrBase64;
        }
        if (qrText) {
            _co.pixCopiaCola = qrText;
            document.getElementById('pix-copia-cola-texto').textContent = qrText;
        }

        document.getElementById('pix-qr-container').classList.add('visivel');
        document.getElementById('btn-gerar-pix').style.display = 'none';

        // Exibir tela de aguardando PIX + QR Code inline
        mostrarStatusTela('pendente', '', 'Aguardando pagamento PIX',
            'Escaneie o QR Code com o app do seu banco ou use o código Copia e Cola. O pagamento expira em 30 minutos.',
            true);

        // Limpar elementos dinamicamente adicionados anteriormente
        const mpStatus = document.getElementById('mp-status');
        const elementsToKeep = new Set([
            'pix-logo',
            'mp-status-icon',
            'mp-status-titulo',
            'mp-status-descricao',
            'mp-polling-info'
        ]);

        Array.from(mpStatus.children).forEach(child => {
            if (!elementsToKeep.has(child.id)) {
                child.remove();
            }
        });

        // Mostrar o ícone PIX estático (adicionado no HTML)
        const pixLogo = document.getElementById('pix-logo');
        if (pixLogo) pixLogo.style.display = 'block';

        mpStatus.insertAdjacentHTML('beforeend', `
        <div style="margin-top:20px; text-align: center;">
            <div style="margin-bottom: 20px;">
                <img src="${qrBase64 ? 'data:image/png;base64,' + qrBase64 : ''}"
                     style="width:160px;height:160px;border-radius:8px;border:2px solid #f0f0f0;">
            </div>
            <p style="font-size: 12px; color: #999; margin-bottom: 12px; margin-top: 0;">Código de pagamento</p>
            <div class="pix-codigo-container" onclick="copiarPixCopiaCola()">
                <span class="pix-codigo-texto">${_co.pixCopiaCola.substring(0, 26)}...</span>
                <i class="ri-file-copy-line pix-codigo-icone"></i>
            </div>
        </div>
    `);

        iniciarPolling(data.id);

    } catch (err) {
        console.error('Erro PIX:', err);
        setBotaoCarregando('btn-gerar-pix', false);
        document.getElementById('btn-gerar-pix').innerHTML =
            '<i class="ri-qr-code-line"></i> Gerar QR Code PIX';
        mostrarErro(err.error || 'Erro ao gerar PIX. Verifique sua conexão e tente novamente.');
    }
}