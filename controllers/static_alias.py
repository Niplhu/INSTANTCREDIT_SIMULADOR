import os
import json
import logging
from urllib.parse import quote

import requests

from odoo import http
from odoo.http import Response, request


_logger = logging.getLogger(__name__)


class InstantCreditStaticAlias(http.Controller):
    @http.route(
        "/instantcredit_simulator/static/src/js/paycomet_instantcredit.js",
        type="http",
        auth="public",
        website=True,
        sitemap=False,
    )
    def paycomet_js_alias(self):
        module_root = os.path.dirname(os.path.dirname(__file__))
        js_path = os.path.join(module_root, "static", "src", "js", "paycomet_instantcredit.js")
        if not os.path.exists(js_path):
            return request.not_found()

        with open(js_path, "rb") as js_file:
            content = js_file.read()

        return Response(content, headers=[("Content-Type", "application/javascript; charset=utf-8")])

    @http.route(
        "/instantcredit_simulator/api/simulator_proxy",
        type="http",
        auth="public",
        website=True,
        csrf=False,
        methods=["POST"],
    )
    def simulator_proxy(self):
        payload = json.loads(request.httprequest.data.decode("utf-8") or "{}")
        hash_token = (payload.get("hash_token") or "").strip()
        simulations = payload.get("simulations") or []
        api_base = (payload.get("api_base") or "https://test.instantcredit.net/api").rstrip("/")

        if not hash_token:
            return Response(
                json.dumps({"error": "missing_hash_token"}),
                status=400,
                headers=[("Content-Type", "application/json")],
            )

        endpoint = f"{api_base}/merchant/{quote(hash_token)}/simulator"
        try:
            upstream = requests.post(endpoint, json=simulations, timeout=20)
        except requests.RequestException as exc:
            _logger.exception("Instant Credit proxy request failed")
            return Response(
                json.dumps({"error": "proxy_request_failed", "details": str(exc)}),
                status=502,
                headers=[("Content-Type", "application/json")],
            )

        return Response(
            upstream.text,
            status=upstream.status_code,
            headers=[("Content-Type", "application/json")],
        )
