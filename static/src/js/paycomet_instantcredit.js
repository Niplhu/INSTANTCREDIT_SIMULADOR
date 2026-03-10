odoo.define("instantcredit_simulator.paycomet_instantcredit", function (require) {
"use strict";

var publicWidget = require("web.public.widget");

var FALLBACK_PAYCOMET_SCRIPT_URL = "https://instantcredit.net/simulator/test/ic-simulator.js";
var FALLBACK_HASH_TOKEN = "REPLACE_WITH_PAYCOMET_HASH_TOKEN";

window.__instantcreditWidgetLoaded = true;

function _ensureCss(url) {
    if (document.querySelector('link[href="' + url + '"]')) {
        return;
    }
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = url;
    document.head.appendChild(link);
}

function _ensureScript(url) {
    window.__paycometIcScriptPromises = window.__paycometIcScriptPromises || {};
    if (window.__paycometIcScriptPromises[url]) {
        return window.__paycometIcScriptPromises[url];
    }

    window.__paycometIcScriptPromises[url] = new Promise(function (resolve, reject) {
        var existingScript = document.querySelector('script[src="' + url + '"]');
        if (existingScript) {
            if (existingScript.dataset.loaded === "1") {
                resolve();
            } else {
                existingScript.addEventListener("load", function () { resolve(); }, { once: true });
                existingScript.addEventListener("error", function () {
                    reject(new Error("No se pudo cargar " + url));
                }, { once: true });
            }
            return;
        }

        var script = document.createElement("script");
        script.src = url;
        script.async = true;
        script.onload = function () {
            script.dataset.loaded = "1";
            resolve();
        };
        script.onerror = function () {
            reject(new Error("No se pudo cargar " + url));
        };
        document.head.appendChild(script);
    });

    return window.__paycometIcScriptPromises[url];
}

function _getOrCreateSimulatorNodes(mountNode) {
    var configurationElement = mountNode.querySelector(".ic-configuration");
    if (!configurationElement) {
        configurationElement = document.createElement("div");
        configurationElement.className = "ic-configuration d-none";
        mountNode.appendChild(configurationElement);
    }

    var simulatorElement = mountNode.querySelector(".ic-simulator");
    if (!simulatorElement) {
        simulatorElement = document.createElement("div");
        simulatorElement.className = "ic-simulator";
        mountNode.appendChild(simulatorElement);
    }

    return {
        simulatorElement: simulatorElement,
        configurationElement: configurationElement,
    };
}

function _renderMessage(mountNode, message) {
    if (!mountNode) {
        return;
    }
    var messageNode = mountNode.querySelector(".o_paycomet_ic_message");
    if (!messageNode) {
        messageNode = document.createElement("div");
        messageNode.className = "alert alert-warning mb-2 o_paycomet_ic_message";
        messageNode.setAttribute("role", "alert");
        mountNode.insertBefore(messageNode, mountNode.firstChild);
    }
    messageNode.textContent = message;
}

function _initOfficialSimulator(options) {
    var scriptUrl = options.scriptUrl || FALLBACK_PAYCOMET_SCRIPT_URL;
    var hashToken = options.hashToken || FALLBACK_HASH_TOKEN;
    var amount = Number.isFinite(options.amount) ? options.amount : 0;
    var mountNode = options.mountNode;

    if (!mountNode) {
        return Promise.reject(new Error("No se encontro el contenedor del simulador"));
    }
    if (!scriptUrl) {
        return Promise.reject(new Error("Falta la URL del script del simulador"));
    }
    if (!hashToken || hashToken.indexOf("REPLACE_WITH_PAYCOMET_HASH_TOKEN") !== -1) {
        return Promise.reject(new Error("Falta HASH_TOKEN en Ajustes"));
    }

    var nodes = _getOrCreateSimulatorNodes(mountNode);
    nodes.configurationElement.textContent = hashToken;
    nodes.simulatorElement.setAttribute("amount", amount.toFixed(2));
    nodes.simulatorElement.setAttribute("theme", "grey");

    var baseUrl = scriptUrl.replace(/\/ic-simulator\.js(?:\?.*)?$/, "");
    _ensureCss(baseUrl + "/css/ic-style-4.0.1.css");
    _ensureCss(baseUrl + "/css/ic-popup-style-4.0.1.css");

    return _ensureScript(scriptUrl)
        .then(function () { return _ensureScript("https://code.jquery.com/jquery-1.12.0.min.js"); })
        .then(function () { return _ensureScript(baseUrl + "/ic-popup-4.0.1.js"); })
        .then(function () { return _ensureScript(baseUrl + "/ic-utils-3.0.1.js"); })
        .then(function () {
            if (!window.icSimulator && window.ICSimulator) {
                window.icSimulator = new window.ICSimulator();
                window.icSimulator.initialize();
            }
            if (!window.icSimulator || typeof window.icSimulator.refresh !== "function") {
                throw new Error("El script no expone la API icSimulator esperada");
            }
            window.icSimulator.refresh();
        });
}

publicWidget.registry.PaycometInstantCreditSimulator = publicWidget.Widget.extend({
    selector: "#o_payment_form",
    events: {
        "change input[name='o_payment_radio']": "_onPaymentOptionInteraction",
        "click input[name='o_payment_radio']": "_onPaymentOptionInteraction",
        "click [name='o_payment_option']": "_onPaymentOptionInteraction",
    },

    start: function () {
        this.el.dataset.instantcreditWidgetStarted = "1";
        this._hideAllContainers();
        this._syncVisibility();
        return this._super.apply(this, arguments);
    },

    _onPaymentOptionInteraction: function () {
        this._syncVisibility();
    },

    _syncVisibility: function () {
        var selectedRadio = this.el.querySelector("input[name='o_payment_radio']:checked");
        var isMarkedInstantCredit = selectedRadio && selectedRadio.dataset.paycometInstantcredit === "1";
        var providerCode = selectedRadio && selectedRadio.dataset.providerCode
            ? selectedRadio.dataset.providerCode.toLowerCase()
            : "";
        var paymentMethodCode = selectedRadio && selectedRadio.dataset.paymentMethodCode
            ? selectedRadio.dataset.paymentMethodCode.toLowerCase()
            : "";
        var isPaycometCreditFallback = providerCode.indexOf("paycomet") !== -1 && paymentMethodCode === "credit";
        var isInstantCredit = isMarkedInstantCredit || isPaycometCreditFallback;

        this._hideAllContainers();
        if (!selectedRadio || !isInstantCredit) {
            return;
        }

        var paymentOptionNode = selectedRadio.closest("[name='o_payment_option']");
        var container = paymentOptionNode
            ? paymentOptionNode.querySelector("[data-paycomet-instantcredit-container='1']")
            : null;
        if (!container || container.dataset.paycometEligible !== "1") {
            return;
        }

        container.classList.remove("d-none");
        this._initSimulator(container);
    },

    _hideAllContainers: function () {
        var containers = this.el.querySelectorAll("[data-paycomet-instantcredit-container='1']");
        Array.prototype.forEach.call(containers, function (container) {
            container.classList.add("d-none");
        });
    },

    _initSimulator: function (container) {
        if (container.dataset.simulatorInitialized === "1" || container.dataset.simulatorInitializing === "1") {
            return;
        }
        container.dataset.simulatorInitializing = "1";

        var mountNode = container.querySelector(".o_paycomet_instantcredit_mount");
        var amount = parseFloat(this.el.dataset.amount || "0") || 0;

        _initOfficialSimulator({
            scriptUrl: container.dataset.scriptUrl,
            hashToken: container.dataset.hashToken,
            amount: amount,
            mountNode: mountNode,
        }).then(function () {
            container.dataset.simulatorInitialized = "1";
        }).catch(function (error) {
            _renderMessage(mountNode, "Error al inicializar simulador: " + error.message);
            console.error("PAYCOMET Instant Credit simulator init error:", error);
        }).finally(function () {
            container.dataset.simulatorInitializing = "0";
        });
    },
});

publicWidget.registry.PaycometInstantCreditCartSimulator = publicWidget.Widget.extend({
    selector: ".o_paycomet_cart_simulator",

    start: function () {
        var self = this;
        return this._super.apply(this, arguments).then(function () {
            self._initCartSimulator();
        });
    },

    _initCartSimulator: function () {
        if (this.el.dataset.paycometEligible !== "1") {
            return;
        }
        if (this.el.dataset.simulatorInitialized === "1" || this.el.dataset.simulatorInitializing === "1") {
            return;
        }
        this.el.dataset.simulatorInitializing = "1";

        var mountNode = this.el.querySelector(".o_paycomet_instantcredit_mount");
        var amount = parseFloat(this.el.dataset.amount || "0") || 0;
        var self = this;

        _initOfficialSimulator({
            scriptUrl: this.el.dataset.scriptUrl,
            hashToken: this.el.dataset.hashToken,
            amount: amount,
            mountNode: mountNode,
        }).then(function () {
            self.el.dataset.simulatorInitialized = "1";
        }).catch(function (error) {
            _renderMessage(mountNode, "Error al inicializar simulador: " + error.message);
        }).finally(function () {
            self.el.dataset.simulatorInitializing = "0";
        });
    },
});

});
