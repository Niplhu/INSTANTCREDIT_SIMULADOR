import os

from odoo import http
from odoo.http import Response, request


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
