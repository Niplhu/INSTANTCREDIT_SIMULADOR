(function () {
    "use strict";

    var DEFAULT_SCRIPT_URL = "https://instantcredit.net/simulator/test/ic-simulator.js";

    function $(selector, root) {
        return (root || document).querySelector(selector);
    }

    function $all(selector, root) {
        return Array.prototype.slice.call((root || document).querySelectorAll(selector));
    }

    function ensureScript(url) {
        window.__icScriptPromises = window.__icScriptPromises || {};
        if (window.__icScriptPromises[url]) {
            return window.__icScriptPromises[url];
        }
        window.__icScriptPromises[url] = new Promise(function (resolve, reject) {
            var existing = document.querySelector('script[src="' + url + '"]');
            if (existing) {
                resolve();
                return;
            }
            var script = document.createElement("script");
            script.src = url;
            script.async = true;
            script.onload = resolve;
            script.onerror = function () {
                reject(new Error("No se pudo cargar " + url));
            };
            document.head.appendChild(script);
        });
        return window.__icScriptPromises[url];
    }

    function ensureCss(url) {
        if (document.querySelector('link[href="' + url + '"]')) {
            return;
        }
        var link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = url;
        document.head.appendChild(link);
    }

    function getApiBase(scriptUrl) {
        return scriptUrl.indexOf("/simulator/test/") !== -1
            ? "https://test.instantcredit.net/api"
            : "https://instantcredit.net/api";
    }

    function getFirstNonEmptyConfigText(jq) {
        var token = "";
        jq(".ic-configuration").each(function () {
            var value = (jq(this).text() || "").replace(/\s+/g, "").trim();
            if (!token && value) {
                token = value;
            }
        });
        return token;
    }

    function patchCallFinancedAmount(scriptUrl) {
        if (!window.ICSimulator || window.__icCallPatched) {
            return;
        }
        var apiBase = getApiBase(scriptUrl);

        window.ICSimulator.prototype.callFinancedAmount = function (simulations) {
            var hashToken = getFirstNonEmptyConfigText(this.jq1120);
            var context = this;
            if (!hashToken) {
                return false;
            }

            fetch("/instantcredit_simulator/api/simulator_proxy", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    hash_token: hashToken,
                    simulations: simulations,
                    api_base: apiBase,
                }),
            }).then(function (response) {
                if (!response.ok) {
                    throw new Error("Simulator proxy error " + response.status);
                }
                return response.json();
            }).then(function (data) {
                var elements = document.getElementsByClassName("ic-simulator");
                var i;
                var j;
                for (i = 0; i < elements.length; i++) {
                    for (j = 0; j < data.length; j++) {
                        if (context.utils.getAmountFromCommas(elements[i]) === data[j].amount && data[j].prices) {
                            context.createTheSimulator(elements[i], data[j].prices, data[j].filterPreselectedInstalmentsForMaximum);
                        }
                    }
                }
            }).catch(function (error) {
                console.error("PAYCOMET proxy error:", error);
            });

            return true;
        };

        window.__icCallPatched = true;
    }

    function loadOfficialSimulator(scriptUrl) {
        if (window.__icCoreLoadedPromise) {
            return window.__icCoreLoadedPromise;
        }

        var cleanScriptUrl = scriptUrl || DEFAULT_SCRIPT_URL;
        var baseUrl = cleanScriptUrl.replace(/\/ic-simulator\.js(?:\?.*)?$/, "");

        ensureCss(baseUrl + "/css/ic-style-4.0.1.css");
        ensureCss(baseUrl + "/css/ic-popup-style-4.0.1.css");

        window.__icCoreLoadedPromise = ensureScript("https://code.jquery.com/jquery-1.12.0.min.js")
            .then(function () { return ensureScript(baseUrl + "/ic-utils-3.0.1.js"); })
            .then(function () { return ensureScript(baseUrl + "/ic-popup-4.0.1.js"); })
            .then(function () { return ensureScript(cleanScriptUrl); })
            .then(function () {
                patchCallFinancedAmount(cleanScriptUrl);
            });

        return window.__icCoreLoadedPromise;
    }

    function showMessage(mountNode, message) {
        if (!mountNode) {
            return;
        }
        var node = $(".o_paycomet_ic_message", mountNode);
        if (!node) {
            node = document.createElement("div");
            node.className = "alert alert-warning mt-2 mb-0 o_paycomet_ic_message";
            mountNode.prepend(node);
        }
        node.textContent = message;
    }

    function setConfigOnMount(mountNode, hashToken, amount, financialProductId) {
        var conf = $(".ic-configuration", mountNode);
        var sim = $(".ic-simulator", mountNode);
        if (!conf || !sim) {
            return false;
        }
        conf.textContent = (hashToken || "").replace(/\s+/g, "").trim();
        sim.setAttribute("amount", Number(amount || 0).toFixed(2));
        sim.setAttribute("theme", "grey");
        if (financialProductId) {
            sim.setAttribute("financialProductId", financialProductId);
        } else {
            sim.removeAttribute("financialProductId");
        }
        return true;
    }

    function initMount(mountNode, scriptUrl, hashToken, amount, financialProductId) {
        if (!mountNode) {
            return;
        }
        if (!hashToken) {
            showMessage(mountNode, "Falta HASH_TOKEN en Ajustes.");
            return;
        }
        if (!setConfigOnMount(mountNode, hashToken, amount, financialProductId)) {
            showMessage(mountNode, "No se encontro el contenedor del simulador.");
            return;
        }

        loadOfficialSimulator(scriptUrl).then(function () {
            if (!window.icSimulator || !window.ICSimulator) {
                window.icSimulator = new window.ICSimulator();
                window.icSimulator.initialize();
            } else {
                window.icSimulator.refresh();
            }
        }).catch(function (error) {
            showMessage(mountNode, "Error al inicializar simulador: " + error.message);
        });
    }

    function getPaymentSelection(form) {
        var selected = $("input[name='o_payment_radio']:checked", form);
        if (!selected) {
            return { isInstant: false, option: null };
        }
        var methodCode = ((selected.dataset && selected.dataset.paymentMethodCode) || "").toLowerCase();
        var option = selected.closest("[name='o_payment_option'], .o_payment_option, .list-group-item");
        var text = (option ? option.textContent : "").toLowerCase();
        var isInstant = methodCode === "credit"
            || text.indexOf("instant credit") !== -1
            || text.indexOf("financiacion") !== -1
            || text.indexOf("financiación") !== -1;
        return { isInstant: isInstant, option: option };
    }

    function bindPayment() {
        var form = $("#o_payment_form");
        var globalContainer = $(".o_paycomet_global_payment_simulator");
        if (!form || !globalContainer) {
            return;
        }

        function refresh() {
            var selection = getPaymentSelection(form);
            globalContainer.classList.add("d-none");
            if (!selection.isInstant) {
                return;
            }

            if (selection.option && !selection.option.contains(globalContainer)) {
                selection.option.appendChild(globalContainer);
            }
            globalContainer.classList.remove("d-none");

            var mount = $(".o_paycomet_instantcredit_mount", globalContainer);
            initMount(
                mount,
                globalContainer.dataset.scriptUrl || DEFAULT_SCRIPT_URL,
                globalContainer.dataset.hashToken || "",
                parseFloat(form.dataset.amount || "0") || 0,
                globalContainer.dataset.financialProductId || ""
            );
        }

        form.addEventListener("change", function (ev) {
            if (ev.target && ev.target.name === "o_payment_radio") {
                refresh();
            }
        });
        form.addEventListener("click", function (ev) {
            if (ev.target && (ev.target.name === "o_payment_radio" || ev.target.closest("[name='o_payment_option']"))) {
                refresh();
            }
        });
        refresh();
    }

    function initCart() {
        var container = $(".o_paycomet_cart_simulator");
        if (!container) {
            return;
        }
        var mount = $(".o_paycomet_instantcredit_mount", container);
        initMount(
            mount,
            container.dataset.scriptUrl || DEFAULT_SCRIPT_URL,
            container.dataset.hashToken || "",
            parseFloat(container.dataset.amount || "0") || 0,
            container.dataset.financialProductId || ""
        );
    }

    function boot() {
        window.__instantcreditWidgetLoaded = true;
        initCart();
        bindPayment();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot);
    } else {
        boot();
    }
})();
