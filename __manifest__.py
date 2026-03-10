{
    "name": "PAYCOMET Instant Credit Simulator - Website Checkout",
    "version": "18.0.1.0.0",
    "summary": "Show PAYCOMET Instant Credit simulator only when selected on /shop/payment",
    "category": "Website/Website",
    "author": "Custom",
    "license": "LGPL-3",
    "depends": [
        "payment",
        "website_sale",
    ],
    "data": [
        "views/res_config_settings_views.xml",
        "views/payment_method_views.xml",
        "views/website_sale_payment.xml",
    ],
    "assets": {
        "web.assets_frontend": [
            "instantcredit_simulator/static/src/js/paycomet_instantcredit.js",
        ],
    },
    "installable": True,
    "application": False,
}
