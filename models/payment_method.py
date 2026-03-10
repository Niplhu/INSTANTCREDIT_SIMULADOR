from odoo import fields, models


class PaymentMethod(models.Model):
    _inherit = "payment.method"

    is_paycomet_instant_credit = fields.Boolean(
        string="PAYCOMET Instant Credit",
        help="Mark the payment method that should display the PAYCOMET Instant Credit simulator on checkout.",
    )
