/** @odoo-module **/

import publicWidget from "@web/legacy/js/public/public_widget";

const FALLBACK_PAYCOMET_SCRIPT_URL = "https://REPLACE_WITH_PAYCOMET_SIMULATOR_JS_URL";
const FALLBACK_HASH_TOKEN = "REPLACE_WITH_PAYCOMET_HASH_TOKEN";
const OFFICIAL_TEST_SCRIPT_URL = "https://instantcredit.net/simulator/test/ic-simulator.js";

window.__instantcreditWidgetLoaded = true;

publicWidget.registry.PaycometInstantCreditSimulator = publicWidget.Widget.extend({
    selector: "#o_payment_form",
    events: {
        "change input[name='o_payment_radio']": "_onPaymentOptionInteraction",
        "click input[name='o_payment_radio']": "_onPaymentOptionInteraction",
        "click [name='o_payment_option']": "_onPaymentOptionInteraction",
    },

    start() {
        this.el.dataset.instantcreditWidgetStarted = "1";
        this._hideAllContainers();
        this._syncVisibility();

        return this._super(...arguments);
    },

    destroy() {
        return this._super(...arguments);
    },

    _onPaymentOptionInteraction() {
        this._syncVisibility();
    },

    _syncVisibility() {
        const selectedRadio = this.el.querySelector("input[name='o_payment_radio']:checked");
        const isMarkedInstantCredit = selectedRadio?.dataset.paycometInstantcredit === "1";
        const providerCode = (selectedRadio?.dataset.providerCode || "").toLowerCase();
        const paymentMethodCode = (selectedRadio?.dataset.paymentMethodCode || "").toLowerCase();
        const isPaycometCreditFallback = providerCode.includes("paycomet") && paymentMethodCode === "credit";
        const isInstantCredit = isMarkedInstantCredit || isPaycometCreditFallback;

        this._hideAllContainers();

        if (!selectedRadio || !isInstantCredit) {
            return;
        }

        const paymentOptionNode = selectedRadio.closest("[name='o_payment_option']");
        const container = paymentOptionNode?.querySelector("[data-paycomet-instantcredit-container='1']");
        if (!container) {
            return;
        }

        container.classList.remove("d-none");
        this._initSimulator(container).catch((error) => {
            console.error("PAYCOMET Instant Credit simulator init error:", error);
        });
    },

    _hideAllContainers() {
        this.el.querySelectorAll("[data-paycomet-instantcredit-container='1']").forEach((container) => {
            container.classList.add("d-none");
        });
    },

    async _initSimulator(container) {
        if (container.dataset.simulatorInitialized === "1") {
            return;
        }
        if (container.dataset.simulatorInitializing === "1") {
            return;
        }
        container.dataset.simulatorInitializing = "1";

        const scriptUrl = container.dataset.scriptUrl || FALLBACK_PAYCOMET_SCRIPT_URL;
        const hashToken = container.dataset.hashToken || FALLBACK_HASH_TOKEN;
        const amount = parseFloat(this.el.dataset.amount || "0");
        const mountNode = container.querySelector(".o_paycomet_instantcredit_mount");

        if (!mountNode) {
            return;
        }
        if (!scriptUrl || scriptUrl.includes("REPLACE_WITH_PAYCOMET_SIMULATOR_JS_URL")) {
            this._renderMessage(
                mountNode,
                "Falta la URL del script del simulador PAYCOMET en Ajustes."
            );
            console.warn("Missing PAYCOMET script URL. Set system parameter instantcredit_simulator.script_url.");
            return;
        }
        if (!hashToken || hashToken.includes("REPLACE_WITH_PAYCOMET_HASH_TOKEN")) {
            this._renderMessage(
                mountNode,
                "Falta el HASH_TOKEN de PAYCOMET en Ajustes."
            );
            console.warn("Missing PAYCOMET hash token. Set system parameter instantcredit_simulator.hash_token.");
            return;
        }

        try {
            await this._initOfficialInstantCreditSimulator({
                scriptUrl,
                hashToken,
                amount,
                mountNode,
            });
            container.dataset.simulatorInitialized = "1";
        } catch (error) {
            this._renderMessage(mountNode, `Error al inicializar simulador: ${error.message}`);
            throw error;
        } finally {
            container.dataset.simulatorInitializing = "0";
        }
    },

    async _initOfficialInstantCreditSimulator({ scriptUrl, hashToken, amount, mountNode }) {
        const resolvedScriptUrl = scriptUrl || OFFICIAL_TEST_SCRIPT_URL;
        const { simulatorElement, configurationElement } = this._getOrCreateSimulatorNodes(mountNode);

        configurationElement.textContent = hashToken;
        simulatorElement.setAttribute("amount", this._formatAmount(amount));
        simulatorElement.setAttribute("theme", "grey");

        await this._ensureExternalScript(resolvedScriptUrl);
        await this._ensureOfficialDependencies(resolvedScriptUrl);

        if (!window.icSimulator && window.ICSimulator) {
            window.icSimulator = new window.ICSimulator();
            window.icSimulator.initialize();
        }

        if (!window.icSimulator || typeof window.icSimulator.refresh !== "function") {
            throw new Error("El script no expone la API icSimulator esperada");
        }

        window.icSimulator.refresh();
    },

    _getOrCreateSimulatorNodes(mountNode) {
        let configurationElement = mountNode.querySelector(".ic-configuration");
        if (!configurationElement) {
            configurationElement = document.createElement("div");
            configurationElement.className = "ic-configuration d-none";
            mountNode.appendChild(configurationElement);
        }

        let simulatorElement = mountNode.querySelector(".ic-simulator");
        if (!simulatorElement) {
            simulatorElement = document.createElement("div");
            simulatorElement.className = "ic-simulator";
            mountNode.appendChild(simulatorElement);
        }

        return { simulatorElement, configurationElement };
    },

    async _ensureOfficialDependencies(scriptUrl) {
        if (window.__paycometIcDepsPromise) {
            return window.__paycometIcDepsPromise;
        }

        const baseUrl = scriptUrl.replace(/\/ic-simulator\.js(?:\?.*)?$/, "");
        const popupJs = `${baseUrl}/ic-popup-4.0.1.js`;
        const utilsJs = `${baseUrl}/ic-utils-3.0.1.js`;
        const styleCss = `${baseUrl}/css/ic-style-4.0.1.css`;
        const popupCss = `${baseUrl}/css/ic-popup-style-4.0.1.css`;

        this._ensureCss(styleCss);
        this._ensureCss(popupCss);

        window.__paycometIcDepsPromise = (async () => {
            await this._ensureScript("https://code.jquery.com/jquery-1.12.0.min.js");
            await this._ensureScript(popupJs);
            await this._ensureScript(utilsJs);
        })();

        return window.__paycometIcDepsPromise;
    },

    _ensureCss(url) {
        if (document.querySelector(`link[href="${url}"]`)) {
            return;
        }
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = url;
        document.head.appendChild(link);
    },

    _ensureScript(url) {
        if (!window.__paycometIcScriptPromises) {
            window.__paycometIcScriptPromises = {};
        }
        if (window.__paycometIcScriptPromises[url]) {
            return window.__paycometIcScriptPromises[url];
        }

        window.__paycometIcScriptPromises[url] = new Promise((resolve, reject) => {
            const existingScript = document.querySelector(`script[src="${url}"]`);
            if (existingScript) {
                if (existingScript.dataset.loaded === "1") {
                    resolve();
                } else {
                    existingScript.addEventListener("load", () => resolve(), { once: true });
                    existingScript.addEventListener("error", () => reject(new Error(`No se pudo cargar ${url}`)), {
                        once: true,
                    });
                }
                return;
            }

            const script = document.createElement("script");
            script.src = url;
            script.async = true;
            script.onload = () => {
                script.dataset.loaded = "1";
                resolve();
            };
            script.onerror = () => reject(new Error(`No se pudo cargar ${url}`));
            document.head.appendChild(script);
        });

        return window.__paycometIcScriptPromises[url];
    },

    _formatAmount(amount) {
        return Number.isFinite(amount) ? amount.toFixed(2) : "0.00";
    },

    _renderMessage(mountNode, message) {
        let messageNode = mountNode.querySelector(".o_paycomet_ic_message");
        if (!messageNode) {
            messageNode = document.createElement("div");
            messageNode.className = "alert alert-warning mb-2 o_paycomet_ic_message";
            messageNode.setAttribute("role", "alert");
            mountNode.prepend(messageNode);
        }
        messageNode.textContent = message;
    },

    _ensureExternalScript(url) {
        if (!window.__paycometInstantCreditScriptPromise) {
            window.__paycometInstantCreditScriptPromise = new Promise((resolve, reject) => {
                const existingScript = document.querySelector(`script[src="${url}"]`);
                if (existingScript) {
                    if (existingScript.dataset.loaded === "1") {
                        resolve();
                    } else {
                        existingScript.addEventListener("load", () => resolve(), { once: true });
                        existingScript.addEventListener("error", () => reject(new Error("Script load failed")), {
                            once: true,
                        });
                    }
                    return;
                }

                const script = document.createElement("script");
                script.src = url;
                script.async = true;
                script.onload = () => {
                    script.dataset.loaded = "1";
                    resolve();
                };
                script.onerror = () => reject(new Error("Script load failed"));
                document.head.appendChild(script);
            });
        }
        return window.__paycometInstantCreditScriptPromise;
    },
});

publicWidget.registry.PaycometInstantCreditCartSimulator = publicWidget.Widget.extend({
    selector: ".o_paycomet_cart_simulator",

    async start() {
        await this._super(...arguments);
        await this._initCartSimulator();
    },

    async _initCartSimulator() {
        if (this.el.dataset.paycometEligible !== "1") {
            return;
        }
        if (this.el.dataset.simulatorInitialized === "1" || this.el.dataset.simulatorInitializing === "1") {
            return;
        }
        this.el.dataset.simulatorInitializing = "1";

        const scriptUrl = this.el.dataset.scriptUrl || OFFICIAL_TEST_SCRIPT_URL;
        const hashToken = this.el.dataset.hashToken || FALLBACK_HASH_TOKEN;
        const amount = parseFloat(this.el.dataset.amount || "0");
        const mountNode = this.el.querySelector(".o_paycomet_instantcredit_mount");

        try {
            if (!mountNode) {
                throw new Error("No se encontro el contenedor del simulador");
            }
            if (!hashToken || hashToken.includes("REPLACE_WITH_PAYCOMET_HASH_TOKEN")) {
                throw new Error("Falta HASH_TOKEN en Ajustes");
            }

            const paymentWidgetProto = publicWidget.registry.PaycometInstantCreditSimulator.prototype;
            await paymentWidgetProto._initOfficialInstantCreditSimulator.call(paymentWidgetProto, {
                scriptUrl,
                hashToken,
                amount,
                mountNode,
            });
            this.el.dataset.simulatorInitialized = "1";
        } catch (error) {
            this._renderMessage(mountNode, `Error al inicializar simulador: ${error.message}`);
        } finally {
            this.el.dataset.simulatorInitializing = "0";
        }
    },

    _renderMessage(mountNode, message) {
        if (!mountNode) {
            return;
        }
        let messageNode = mountNode.querySelector(".o_paycomet_ic_message");
        if (!messageNode) {
            messageNode = document.createElement("div");
            messageNode.className = "alert alert-warning mb-2 o_paycomet_ic_message";
            messageNode.setAttribute("role", "alert");
            mountNode.prepend(messageNode);
        }
        messageNode.textContent = message;
    },
});
