/* reauth-success-modal.js
   Componente Vue 3 simples para exibir um modal de sucesso com animação
   - Monta automaticamente em DOMContentLoaded
   - Expõe `window.reauthSuccessModal.show({ orderId, previousStatus, statusText, onHidden })`
*/
(function () {
    const styleId = 'reauth-success-style';
    const css = `
    .reauth-success-overlay { position: fixed; inset: 0; display:flex; align-items:center; justify-content:center; z-index:1600; background: rgba(15,20,35,0.45); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); }
    .reauth-success-panel { background: var(--modal-bg, #ffffff); border-radius: 12px; padding: 20px; display:flex; gap:16px; align-items:center; box-shadow: 0 8px 40px rgba(0,0,0,0.18); max-width: 560px; width: 92%; }
    .reauth-check { width:64px; height:64px; border-radius:50%; background: linear-gradient(135deg,#16a34a,#34d399); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    .reauth-check svg { width:36px; height:36px; stroke:#fff; stroke-width:3; stroke-linecap:round; stroke-linejoin:round; fill:none; stroke-dasharray: 100; stroke-dashoffset: 100; animation: reauth-draw 700ms ease forwards 160ms; }
    @keyframes reauth-draw { to { stroke-dashoffset: 0; } }
    .reauth-success-body .title { font-weight:600; font-size:1.02rem; margin-bottom:6px; color: var(--modal-text, #111827); }
    .reauth-success-body code { background:white; padding:2px 6px; border-radius:4px; font-family: 'DM Mono', monospace; font-size:0.92rem; }
    .reauth-success-body .details { color:#374151; font-size:0.92rem; line-height:1.3; }
    .reauth-success-body .details div { margin-top:6px; }
    .reauth-success-body .new-status { color:#16a34a; font-weight:700; }
    @media (max-width:480px) { .reauth-success-panel { padding: 14px; gap:12px; } .reauth-check { width:52px; height:52px; } }
    `;

    function injectStyle() {
        if (document.getElementById(styleId)) return;
        const s = document.createElement('style');
        s.id = styleId;
        s.textContent = css;
        document.head.appendChild(s);
    }

    function createApp() {
        if (!window.Vue) {
            console.warn('Vue não encontrado para reauth success modal');
            return null;
        }

        const App = {
            data() {
                return {
                    visible: false,
                    orderId: '',
                    previousStatus: '',
                    statusText: '',
                    hideTimer: null,
                    onHiddenCallback: null
                };
            },
            methods: {
                show({ orderId = '', previousStatus = '', statusText = '', onHidden = null } = {}) {
                    this.orderId = orderId;
                    this.previousStatus = previousStatus;
                    this.statusText = statusText;
                    this.onHiddenCallback = typeof onHidden === 'function' ? onHidden : null;
                    this.visible = true;
                    if (this.hideTimer) clearTimeout(this.hideTimer);
                    this.hideTimer = setTimeout(() => {
                        this.hide();
                    }, 2200);
                },
                hide() {
                    if (this.hideTimer) {
                        clearTimeout(this.hideTimer);
                        this.hideTimer = null;
                    }
                    this.visible = false;
                    // chamar callback logo após animar (pequeno timeout)
                    setTimeout(() => {
                        if (this.onHiddenCallback) {
                            try { this.onHiddenCallback(); } catch (e) { console.error(e); }
                            this.onHiddenCallback = null;
                        }
                    }, 80);
                }
            },
            template: `
                <div v-if="visible" class="reauth-success-overlay" @click.self="hide()">
                    <div class="reauth-success-panel" role="dialog" aria-live="assertive">
                        <div class="reauth-check" aria-hidden="true">
                            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M20 6L9 17l-5-5"></path></svg>
                        </div>
                        <div class="reauth-success-body">
                            <div class="title">Operação bem-sucedida</div>
                            <div class="details">
                                <div><strong>ID do Pedido:</strong> <code>{{ orderId }}</code></div>
                                <div><strong>Status anterior:</strong> <span style="color:#ea580c">{{ previousStatus }}</span></div>
                                <div><strong>Status atual:</strong> <span class="new-status">{{ statusText }}</span></div>
                            </div>
                        </div>
                    </div>
                </div>
            `
        };

        const mountPoint = document.getElementById('reauthSuccessApp') || (function () { const el = document.createElement('div'); el.id = 'reauthSuccessApp'; document.body.appendChild(el); return el; })();
        const app = Vue.createApp(App);
        const vm = app.mount(mountPoint);

        // Expor API global simples
        window.reauthSuccessModal = {
            show: (opts) => { try { vm.show(opts); } catch (e) { console.error(e); } },
            hide: () => { try { vm.hide(); } catch (e) { console.error(e); } }
        };

        return vm;
    }

    document.addEventListener('DOMContentLoaded', () => {
        injectStyle();
        createApp();
    });

})();
