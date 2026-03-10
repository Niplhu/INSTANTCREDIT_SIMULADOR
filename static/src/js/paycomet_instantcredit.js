(function () {
    "use strict";

    var DEFAULT_SCRIPT_URL = "https://instantcredit.net/simulator/test/ic-simulator.js";
    var HASH_PLACEHOLDER = "REPLACE_WITH_PAYCOMET_HASH_TOKEN";

    function ensureCss(url) {
        if (document.querySelector('link[href="' + url + '"]')) {
            return;
        }
        var link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = url;
        document.head.appendChild(link);
    }

    function ensureScript(url) {
        window.__instantcreditScriptPromises = window.__instantcreditScriptPromises || {};
        if (window.__instantcreditScriptPromises[url]) {
            return window.__instantcreditScriptPromises[url];
        }
        window.__instantcreditScriptPromises[url] = new Promise(function (resolve, reject) {
            var existing = document.querySelector('script[src="' + url + '"]');
            if (existing) {
                if (existing.dataset.loaded === "1") {
                    resolve();
                } else {
                    existing.addEventListener("load", function () { resolve(); }, { once: true });
                    existing.addEventListener("error", function () { reject(new Error("No se pudo cargar " + url)); }, { once: true });
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
            script.onerror = function () { reject(new Error("No se pudo cargar " + url)); };
            document.head.appendChild(script);
        });
        return window.__instantcreditScriptPromises[url];
    }

    function renderMessage(mountNode, message) {
        if (!mountNode) {
            return;
        }
        var msg = mountNode.querySelector(".o_paycomet_ic_message");
        if (!msg) {
            msg = document.createElement("div");
            msg.className = "alert alert-warning mb-2 o_paycomet_ic_message";
            msg.setAttribute("role", "alert");
            mountNode.insertBefore(msg, mountNode.firstChild);
        }
        msg.textContent = message;
    }

    function getOrCreateNodes(mountNode) {
        var conf = mountNode.querySelector(".ic-configuration");
        if (!conf) {
            conf = document.createElement("div");
            conf.className = "ic-configuration d-none";
            mountNode.appendChild(conf);
        }
        var sim = mountNode.querySelector(".ic-simulator");
        if (!sim) {
            sim = document.createElement("div");
            sim.className = "ic-simulator";
            mountNode.appendChild(sim);
        }
        return { conf: conf, sim: sim };
    }

    function initOfficialSimulator(opts) {
        var scriptUrl = opts.scriptUrl || DEFAULT_SCRIPT_URL;
        var hashToken = normalizeHashToken(opts.hashToken || HASH_PLACEHOLDER);
        var financialProductId = (opts.financialProductId || "").trim();
        var amount = Number.isFinite(opts.amount) ? opts.amount : 0;
        var mountNode = opts.mountNode;
        if (!mountNode) {
            return Promise.reject(new Error("No se encontro el contenedor del simulador"));
        }
        if (!hashToken || hashToken.indexOf(HASH_PLACEHOLDER) !== -1) {
            return Promise.reject(new Error("Falta HASH_TOKEN en Ajustes"));
        }
        var nodes = getOrCreateNodes(mountNode);
        setSingleActiveConfiguration(nodes.conf);
        nodes.conf.textContent = hashToken;
        nodes.sim.setAttribute("amount", amount.toFixed(2));
        nodes.sim.setAttribute("theme", "grey");
        if (financialProductId) {
            nodes.sim.setAttribute("financialProductId", financialProductId);
        } else {
            nodes.sim.removeAttribute("financialProductId");
        }

        var baseUrl = scriptUrl.replace(/\/ic-simulator\.js(?:\?.*)?$/, "");
        ensureCss(baseUrl + "/css/ic-style-4.0.1.css");
        ensureCss(baseUrl + "/css/ic-popup-style-4.0.1.css");

        return ensureScript(scriptUrl)
            .then(function () { return ensureScript("https://code.jquery.com/jquery-1.12.0.min.js"); })
            .then(function () { return ensureScript(baseUrl + "/ic-popup-4.0.1.js"); })
            .then(function () { return ensureScript(baseUrl + "/ic-utils-3.0.1.js"); })
            .then(function () {
                if (!window.icSimulator && window.ICSimulator) {
                    window.icSimulator = new window.ICSimulator();
                    window.icSimulator.initialize();
                    return;
                }
                if (!window.icSimulator || typeof window.icSimulator.refresh !== "function") {
                    throw new Error("El script no expone la API icSimulator esperada");
                }
                window.icSimulator.refresh();
            });
    }

    function setSingleActiveConfiguration(activeNode) {
        var activeClass = "ic-configuration d-none";
        var disabledClass = "ic-configuration-disabled d-none";

        var activeNodes = document.querySelectorAll(".ic-configuration");
        Array.prototype.forEach.call(activeNodes, function (node) {
            if (node !== activeNode) {
                node.textContent = "";
                node.className = disabledClass;
            }
        });

        var disabledNodes = document.querySelectorAll(".ic-configuration-disabled");
        Array.prototype.forEach.call(disabledNodes, function (node) {
            if (node !== activeNode) {
                node.textContent = "";
            }
        });

        activeNode.className = activeClass;
    }

    function normalizeHashToken(rawHash) {
        var token = (rawHash || "").replace(/\s+/g, "").trim();
        if (!token) {
            return token;
        }
        var deduped = getRepeatedBase(token);
        if (deduped !== token) {
            console.warn("PAYCOMET hash token parecia repetido. Se usara la version base.");
        }
        return deduped;
    }

    function getRepeatedBase(token) {
        var len = token.length;
        var size;
        for (size = 1; size <= Math.floor(len / 2); size++) {
            if (len % size !== 0) {
                continue;
            }
            var unit = token.slice(0, size);
            var rebuilt = "";
            var i;
            for (i = 0; i < len / size; i++) {
                rebuilt += unit;
            }
            if (rebuilt === token) {
                return unit;
            }
        }
        return token;
    }

    function initCart() {
        var cart = document.querySelector(".o_paycomet_cart_simulator");
        if (!cart) {
            return;
        }
        if (cart.dataset.simulatorInitialized === "1" || cart.dataset.simulatorInitializing === "1") {
            return;
        }
        cart.dataset.simulatorInitializing = "1";
        var mountNode = cart.querySelector(".o_paycomet_instantcredit_mount");
        var amount = parseFloat(cart.dataset.amount || "0") || 0;
        initOfficialSimulator({
            scriptUrl: cart.dataset.scriptUrl,
            hashToken: cart.dataset.hashToken,
            financialProductId: cart.dataset.financialProductId,
            amount: amount,
            mountNode: mountNode,
        }).then(function () {
            cart.dataset.simulatorInitialized = "1";
        }).catch(function (error) {
            renderMessage(mountNode, "Error al inicializar simulador: " + error.message);
        }).finally(function () {
            cart.dataset.simulatorInitializing = "0";
        });
    }

    function hideAllPaymentContainers(root) {
        var containers = root.querySelectorAll("[data-paycomet-instantcredit-container='1']");
        Array.prototype.forEach.call(containers, function (container) {
            container.classList.add("d-none");
        });
    }

    function syncPaymentVisibility(paymentForm) {
        var selected = paymentForm.querySelector("input[name='o_payment_radio']:checked");
        var orderAmount = parseFloat(paymentForm.dataset.amount || "0") || 0;

        var allContainers = paymentForm.querySelectorAll("[data-paycomet-instantcredit-container='1']");
        Array.prototype.forEach.call(allContainers, function (currentContainer) {
            var currentMount = currentContainer.querySelector(".o_paycomet_instantcredit_mount");
            if (!currentMount) {
                return;
            }
            var simulatorNode = currentMount.querySelector(".ic-simulator");
            if (!simulatorNode) {
                simulatorNode = document.createElement("div");
                simulatorNode.className = "ic-simulator";
                currentMount.appendChild(simulatorNode);
            }
            simulatorNode.setAttribute("amount", orderAmount.toFixed(2));
            simulatorNode.setAttribute("theme", "grey");

            var configNode = currentMount.querySelector(".ic-configuration");
            if (configNode) {
                configNode.textContent = "";
            }
        });

        hideAllPaymentContainers(paymentForm);
        if (!selected) {
            return;
        }
        var selectedMethodCode = selected.dataset.paymentMethodCode
            ? selected.dataset.paymentMethodCode.toLowerCase()
            : "";
        var isInstant = selected.dataset.paycometInstantcredit === "1" || selectedMethodCode === "credit";
        if (!isInstant) {
            return;
        }
        var option = selected.closest("[name='o_payment_option'], .o_payment_option, .list-group-item");
        var container = ensurePaymentContainer(option, paymentForm);
        if (!container || container.dataset.paycometEligible !== "1") {
            return;
        }
        container.classList.remove("d-none");
        if (container.dataset.simulatorInitialized === "1" || container.dataset.simulatorInitializing === "1") {
            return;
        }
        container.dataset.simulatorInitializing = "1";
        var mountNode = container.querySelector(".o_paycomet_instantcredit_mount");
        var amount = orderAmount;
        initOfficialSimulator({
            scriptUrl: container.dataset.scriptUrl,
            hashToken: container.dataset.hashToken,
            financialProductId: container.dataset.financialProductId,
            amount: amount,
            mountNode: mountNode,
        }).then(function () {
            container.dataset.simulatorInitialized = "1";
        }).catch(function (error) {
            renderMessage(mountNode, "Error al inicializar simulador: " + error.message);
        }).finally(function () {
            container.dataset.simulatorInitializing = "0";
        });
    }

    function initPayment() {
        var form = document.querySelector("#o_payment_form");
        if (!form) {
            return;
        }
        form.dataset.instantcreditWidgetStarted = "1";
        syncPaymentVisibility(form);
        form.addEventListener("change", function (ev) {
            if (ev.target && ev.target.name === "o_payment_radio") {
                syncPaymentVisibility(form);
            }
        });
        form.addEventListener("click", function (ev) {
            if (ev.target && (ev.target.name === "o_payment_radio" || ev.target.closest("[name='o_payment_option']"))) {
                syncPaymentVisibility(form);
            }
        });

        document.addEventListener("change", function (ev) {
            if (!ev.target || ev.target.name !== "o_payment_radio") {
                return;
            }
            var currentForm = document.querySelector("#o_payment_form");
            if (currentForm) {
                syncPaymentVisibility(currentForm);
            }
        });
    }

    function ensurePaymentContainer(option, paymentForm) {
        var container = option ? option.querySelector("[data-paycomet-instantcredit-container='1']") : null;
        if (container) {
            return container;
        }

        var globalConfig = document.querySelector(".o_paycomet_global_config");
        if (!option || !globalConfig) {
            return paymentForm.querySelector("[data-paycomet-instantcredit-container='1'][data-paycomet-eligible='1']");
        }

        container = document.createElement("div");
        container.className = "o_paycomet_instantcredit_container ms-4";
        container.setAttribute("data-paycomet-instantcredit-container", "1");
        container.setAttribute("data-paycomet-eligible", "1");
        container.setAttribute("data-script-url", globalConfig.dataset.scriptUrl || "");
        container.setAttribute("data-hash-token", globalConfig.dataset.hashToken || "");
        container.setAttribute("data-financial-product-id", globalConfig.dataset.financialProductId || "");

        var mount = document.createElement("div");
        mount.className = "o_paycomet_instantcredit_mount mt-2";

        var conf = document.createElement("div");
        conf.className = "ic-configuration d-none";

        var sim = document.createElement("div");
        sim.className = "ic-simulator";

        mount.appendChild(conf);
        mount.appendChild(sim);
        container.appendChild(mount);
        option.appendChild(container);

        return container;
    }

    function boot() {
        window.__instantcreditWidgetLoaded = true;
        initCart();
        initPayment();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot);
    } else {
        boot();
    }
})();
