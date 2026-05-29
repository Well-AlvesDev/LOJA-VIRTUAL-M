/**
 * ===== SISTEMA DE CARRINHO PERSISTENTE =====
 * Gerencia adição, remoção e armazenamento de produtos no carrinho
 * Usa localStorage para persistência e Supabase (tabela j-box) para dados dos produtos
 */

const CartSystem = (() => {
    // ===== CONFIGURAÇÃO =====
    const STORAGE_KEY = 'dona-flor-cart';
    const CLICK_THROTTLE_MS = 1000; // Intervalo mínimo entre cliques (ms)
    let supabaseClient = null;
    let carrinhoData = null;
    const ultimoCliquePorProduto = new Map(); // Rastrear últimos cliques

    // ===== INICIALIZAR =====
    function init() {
        // Criar cliente Supabase se disponível
        if (window.supabase && SUPABASE_CONFIG) {
            supabaseClient = window.supabase.createClient(
                SUPABASE_CONFIG.url,
                SUPABASE_CONFIG.anonKey
            );
        }

        // Carregar dados do carrinho do localStorage
        carrinhoData = carregarDoLocalStorage();

        // Renderizar modal HTML (estrutura vazia, conteúdo será preenchido dinamicamente)
        if (!document.getElementById('cart-overlay')) {
            criarModalHTML();
            criarModalConfirmacaoHTML();
        }

        // Anexar listeners ao botão de carrinho se existir
        anexarListenersGlobais();

        console.log('✓ Sistema de carrinho inicializado');
    }

    // ===== CARREGAR/SALVAR DO LOCALSTORAGE =====
    function carregarDoLocalStorage() {
        try {
            const dados = localStorage.getItem(STORAGE_KEY);
            return dados ? JSON.parse(dados) : [];
        } catch (e) {
            console.warn('⚠️ Erro ao carregar carrinho do localStorage:', e);
            return [];
        }
    }

    function salvarNoLocalStorage(dados) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(dados));
            carrinhoData = dados;
            atualizarBadgeCarrinho();
            return true;
        } catch (e) {
            console.warn('⚠️ Erro ao salvar carrinho no localStorage:', e);
            return false;
        }
    }

    // ===== CRUD DE PRODUTOS =====
    function adicionarProduto(produtoId, nomeProduto, preco, imagemUrl = null) {
        if (!produtoId) {
            console.error('❌ ID do produto é obrigatório');
            return false;
        }

        // ===== PROTEÇÃO CONTRA CLIQUES DUPLOS =====
        const agora = Date.now();
        const ultimoClique = ultimoCliquePorProduto.get(produtoId) || 0;
        const intervaloDesdeUltimoClique = agora - ultimoClique;

        if (intervaloDesdeUltimoClique < CLICK_THROTTLE_MS) {
            console.warn(`⚠️ Clique muito rápido em "${nomeProduto}". Aguarde ${Math.ceil((CLICK_THROTTLE_MS - intervaloDesdeUltimoClique) / 100) * 100}ms`);
            mostrarNotificacaoErro('Aguarde um momento antes de adicionar novamente');
            return false;
        }

        // Registrar este clique
        ultimoCliquePorProduto.set(produtoId, agora);

        // Verificar se o produto já está no carrinho
        const indexExistente = carrinhoData.findIndex(item => item.id === produtoId);

        if (indexExistente >= 0) {
            // Aumentar quantidade
            carrinhoData[indexExistente].quantidade += 1;
        } else {
            // Adicionar novo produto
            carrinhoData.push({
                id: produtoId,
                nome: nomeProduto,
                preco: parseFloat(preco),
                imagem: imagemUrl,
                quantidade: 1,
                adicionadoEm: new Date().toISOString()
            });
        }

        salvarNoLocalStorage(carrinhoData);
        console.log(`✓ Produto adicionado ao carrinho: ${nomeProduto}`);
        mostrarNotificacaoAdicao(nomeProduto);
        return true;
    }

    function removerProduto(produtoId) {
        const indexOriginal = carrinhoData.length;
        carrinhoData = carrinhoData.filter(item => item.id !== produtoId);

        if (carrinhoData.length < indexOriginal) {
            salvarNoLocalStorage(carrinhoData);
            console.log(`✓ Produto removido do carrinho: ${produtoId}`);
            return true;
        }
        return false;
    }

    function atualizarQuantidade(produtoId, novaQuantidade) {
        const produto = carrinhoData.find(item => item.id === produtoId);
        if (!produto) return false;

        if (novaQuantidade <= 0) {
            return removerProduto(produtoId);
        }

        produto.quantidade = parseInt(novaQuantidade);
        salvarNoLocalStorage(carrinhoData);
        return true;
    }

    function obterCarrinho() {
        return [...carrinhoData];
    }

    function limparCarrinho() {
        carrinhoData = [];
        salvarNoLocalStorage(carrinhoData);
        console.log('✓ Carrinho limpo');
    }

    function limparCarrinhoComConfirmacao() {
        mostrarModalConfirmacao(
            'Tem certeza que deseja remover todos os itens do carrinho?',
            () => {
                limparCarrinho();
                renderizarCarrinho();
                mostrarNotificacaoLimpeza();
            }
        );
    }

    function criarModalConfirmacaoHTML() {
        const modal = document.createElement('div');
        modal.id = 'cart-confirmation-overlay';
        modal.className = 'cart-confirmation-overlay';
        modal.innerHTML = `
            <div class="cart-confirmation-modal" role="dialog" aria-modal="true" aria-labelledby="cart-confirmation-title">
                <div class="cart-confirmation-content">
                    <h3 id="cart-confirmation-title">Confirmar ação</h3>
                    <p id="cart-confirmation-message">Tem certeza?</p>
                </div>
                <div class="cart-confirmation-actions">
                    <button type="button" class="cart-confirmation-btn cart-confirmation-cancel">Cancelar</button>
                    <button type="button" class="cart-confirmation-btn cart-confirmation-confirm">Sim, limpar tudo</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                esconderModalConfirmacao();
            }
        });

        modal.querySelector('.cart-confirmation-cancel').addEventListener('click', esconderModalConfirmacao);
        modal.querySelector('.cart-confirmation-confirm').addEventListener('click', () => {
            const confirmar = modal.dataset.confirmAction;
            if (confirmar && window[confirmar] instanceof Function) {
                window[confirmar]();
            }
            esconderModalConfirmacao();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.classList.contains('aberto')) {
                esconderModalConfirmacao();
            }
        });
    }

    function mostrarModalConfirmacao(mensagem, callbackConfirmar) {
        const modal = document.getElementById('cart-confirmation-overlay');
        if (!modal) return;

        const messageElement = modal.querySelector('#cart-confirmation-message');
        messageElement.textContent = mensagem;
        modal.classList.add('aberto');
        modal.dataset.confirmAction = 'cartConfirmationCallback';

        window.cartConfirmationCallback = function() {
            if (callbackConfirmar instanceof Function) {
                callbackConfirmar();
            }
            delete window.cartConfirmationCallback;
        };
    }

    function esconderModalConfirmacao() {
        const modal = document.getElementById('cart-confirmation-overlay');
        if (!modal) return;
        modal.classList.remove('aberto');
        delete window.cartConfirmationCallback;
        delete modal.dataset.confirmAction;
    }

    // ===== CÁLCULOS =====
    function calcularTotal() {
        return carrinhoData.reduce((sum, item) => sum + (item.preco * item.quantidade), 0);
    }

    function calcularQuantidadeTotal() {
        return carrinhoData.reduce((sum, item) => sum + item.quantidade, 0);
    }

    // ===== RENDERIZAR MODAL =====
    function criarModalHTML() {
        const modal = document.createElement('div');
        modal.id = 'cart-overlay';
        modal.className = 'cart-overlay';
        modal.innerHTML = `
            <div class="cart-modal" id="cart-modal">
                <div class="cart-header">
                    <h2>Meu Carrinho</h2>
                    <button class="cart-close" onclick="CartSystem.fecharCarrinho()" aria-label="Fechar carrinho">
                        <i class="ri-close-line"></i>
                    </button>
                </div>

                <div class="cart-body" id="cart-body">
                    <div class="cart-vazio">
                        <i class="ri-shopping-cart-empty-line"></i>
                        <p>Seu carrinho está vazio</p>
                        <small>Adicione produtos para continuar</small>
                    </div>
                </div>

                <div class="cart-footer" id="cart-footer" style="display: none;">
                    <div class="cart-resumo">
                        <div class="cart-resumo-linha">
                            <span>Subtotal:</span>
                            <span id="cart-subtotal">R$ 0,00</span>
                        </div>
                        <div class="cart-resumo-linha cart-total">
                            <span>Total:</span>
                            <span id="cart-total">R$ 0,00</span>
                        </div>
                    </div>
                    <button class="cart-btn-checkout" onclick="CartSystem.irParaCheckout()">
                        <i class="ri-shopping-bag-4-fill"></i>
                        Finalizar Compra
                    </button>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                        <button class="cart-btn-continuar" onclick="CartSystem.fecharCarrinho()">
                            Continuar Comprando
                        </button>
                        <button class="cart-btn-limpar" onclick="CartSystem.limparCarrinhoComConfirmacao()" title="Limpar todo o carrinho">
                            <i class="ri-delete-bin-2-line"></i>
                            Limpar Tudo
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Event listener para fechar ao clicar no overlay
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                fecharCarrinho();
            }
        });

        // Fechar com ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.classList.contains('aberto')) {
                fecharCarrinho();
            }
        });
    }

    function renderizarCarrinho() {
        const cartBody = document.getElementById('cart-body');
        const cartFooter = document.getElementById('cart-footer');

        if (!cartBody) return;

        if (carrinhoData.length === 0) {
            cartBody.innerHTML = `
                <div class="cart-vazio">
                    <i class="ri-shopping-cart-empty-line"></i>
                    <p>Seu carrinho está vazio</p>
                    <small>Adicione produtos para continuar</small>
                </div>
            `;
            if (cartFooter) cartFooter.style.display = 'none';
            return;
        }

        cartBody.innerHTML = `
            <div class="cart-items">
                ${carrinhoData.map(item => `
                    <div class="cart-item" data-product-id="${item.id}">
                        <div class="cart-item-imagem">
                            ${item.imagem ? `
                                <img src="${item.imagem}" alt="${item.nome}" loading="lazy">
                            ` : `
                                <div class="cart-item-imagem-placeholder">
                                    <i class="ri-image-line"></i>
                                </div>
                            `}
                        </div>
                        <div class="cart-item-info">
                            <h4 class="cart-item-nome">${item.nome}</h4>
                            <div class="cart-item-preco">
                                ${formatarPreco(item.preco)}
                            </div>
                        </div>
                        <div class="cart-item-controles">
                            <button class="cart-btn-menos" onclick="CartSystem.atualizarQuantidadeUI(${item.id}, ${item.quantidade - 1})">
                                <i class="ri-subtract-line"></i>
                            </button>
                            <input type="number" class="cart-quantidade" value="${item.quantidade}" min="1" 
                                   onchange="CartSystem.atualizarQuantidadeUI(${item.id}, this.value)">
                            <button class="cart-btn-mais" onclick="CartSystem.atualizarQuantidadeUI(${item.id}, ${item.quantidade + 1})">
                                <i class="ri-add-line"></i>
                            </button>
                        </div>
                        <div class="cart-item-subtotal">
                            ${formatarPreco(item.preco * item.quantidade)}
                        </div>
                        <button class="cart-btn-remover" onclick="CartSystem.removerUI(${item.id})" title="Remover produto">
                            <i class="ri-delete-bin-line"></i>
                        </button>
                    </div>
                `).join('')}
            </div>
        `;

        // Atualizar footer com totais
        const total = calcularTotal();
        document.getElementById('cart-subtotal').textContent = formatarPreco(total);
        document.getElementById('cart-total').textContent = formatarPreco(total);
        if (cartFooter) cartFooter.style.display = 'block';
    }

    // ===== ABRIR/FECHAR CARRINHO =====
    function abrirCarrinho() {
        const overlay = document.getElementById('cart-overlay');
        if (!overlay) {
            criarModalHTML();
        }

        document.getElementById('cart-overlay').classList.add('aberto');
        document.body.style.overflow = 'hidden';
        renderizarCarrinho();
    }

    function fecharCarrinho() {
        const overlay = document.getElementById('cart-overlay');
        if (overlay) {
            overlay.classList.remove('aberto');
        }
        document.body.style.overflow = '';
    }

    // ===== UI HELPERS =====
    function atualizarQuantidadeUI(produtoId, novaQuantidade) {
        atualizarQuantidade(produtoId, novaQuantidade);
        renderizarCarrinho();
    }

    function removerUI(produtoId) {
        removerProduto(produtoId);
        renderizarCarrinho();
    }

    function atualizarBadgeCarrinho() {
        const badge = document.getElementById('cart-badge');
        const quantidadeTotal = calcularQuantidadeTotal();

        if (badge) {
            if (quantidadeTotal > 0) {
                badge.textContent = quantidadeTotal;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        }
    }

    function mostrarNotificacaoAdicao(nomeProduto) {
        // Criar notificação temporária
        const notificacao = document.createElement('div');
        notificacao.className = 'cart-notificacao';
        notificacao.innerHTML = `
            <i class="ri-check-line"></i>
            <span>${nomeProduto} foi adicionado ao carrinho</span>
        `;
        document.body.appendChild(notificacao);

        // Animar entrada
        setTimeout(() => {
            notificacao.classList.add('visivel');
        }, 10);

        // Remover após 3 segundos
        setTimeout(() => {
            notificacao.classList.remove('visivel');
            setTimeout(() => {
                document.body.removeChild(notificacao);
            }, 300);
        }, 3000);
    }

    function mostrarNotificacaoLimpeza() {
        // Criar notificação de limpeza
        const notificacao = document.createElement('div');
        notificacao.className = 'cart-notificacao';
        notificacao.style.background = '#ef4444';
        notificacao.innerHTML = `
            <i class="ri-delete-bin-2-line"></i>
            <span>Carrinho limpo com sucesso</span>
        `;
        document.body.appendChild(notificacao);

        // Animar entrada
        setTimeout(() => {
            notificacao.classList.add('visivel');
        }, 10);

        // Remover após 3 segundos
        setTimeout(() => {
            notificacao.classList.remove('visivel');
            setTimeout(() => {
                document.body.removeChild(notificacao);
            }, 300);
        }, 3000);
    }

    function mostrarNotificacaoErro(mensagem) {
        // Criar notificação de erro
        const notificacao = document.createElement('div');
        notificacao.className = 'cart-notificacao';
        notificacao.style.background = '#f97316';
        notificacao.innerHTML = `
            <i class="ri-alert-line"></i>
            <span>${mensagem}</span>
        `;
        document.body.appendChild(notificacao);

        // Animar entrada
        setTimeout(() => {
            notificacao.classList.add('visivel');
        }, 10);

        // Remover após 3 segundos
        setTimeout(() => {
            notificacao.classList.remove('visivel');
            setTimeout(() => {
                document.body.removeChild(notificacao);
            }, 300);
        }, 3000);
    }

    function irParaCheckout() {
        if (carrinhoData.length === 0) return;

        // Serializar carrinho para passar via sessionStorage
        sessionStorage.setItem('cart-checkout', JSON.stringify(carrinhoData));
        fecharCarrinho();

        // Passar todos os produtos para o checkout
        if (typeof abrirCheckout === 'function') {
            abrirCheckout(carrinhoData);
        }
    }

    // ===== HELPERS =====
    function formatarPreco(preco) {
        const valor = parseFloat(preco);
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(valor);
    }

    function anexarListenersGlobais() {
        // Botão de abertura do carrinho (pode estar em qualquer lugar)
        document.addEventListener('click', (e) => {
            if (e.target.closest('.cart-icon-trigger')) {
                abrirCarrinho();
                e.preventDefault();
                e.stopPropagation();
            }
        });
    }

    // ===== WRAPPER COM PROTEÇÃO DE CLIQUE DUPLO =====
    function adicionarProdutoComDesabilitar(botao, produtoId, nomeProduto, preco, imagemUrl) {
        // Desabilitar temporariamente o botão
        botao.disabled = true;
        botao.style.opacity = '0.6';
        botao.style.cursor = 'not-allowed';
        
        const textoOriginal = botao.innerHTML;
        botao.innerHTML = '<i class="ri-loader-4-line" style="animation: spin 1s linear infinite;"></i> Adicionando...';

        // Tentar adicionar produto
        const sucesso = adicionarProduto(produtoId, nomeProduto, preco, imagemUrl);

        // Re-habilitar após 1 segundo
        setTimeout(() => {
            botao.disabled = false;
            botao.style.opacity = '1';
            botao.style.cursor = 'pointer';
            botao.innerHTML = textoOriginal;
        }, CLICK_THROTTLE_MS);

        return sucesso;
    }

    // ===== PUBLIC API =====
    return {
        init,
        adicionarProduto,
        adicionarProdutoComDesabilitar,
        removerProduto,
        atualizarQuantidade,
        obterCarrinho,
        limparCarrinho,
        limparCarrinhoComConfirmacao,
        calcularTotal,
        calcularQuantidadeTotal,
        abrirCarrinho,
        fecharCarrinho,
        atualizarQuantidadeUI,
        removerUI,
        renderizarCarrinho,
        irParaCheckout
    };
})();

// Inicializar quando DOM está pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => CartSystem.init());
} else {
    CartSystem.init();
}
