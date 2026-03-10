from odoo import fields, models


class ResConfigSettings(models.TransientModel):
    _inherit = "res.config.settings"

    instantcredit_script_url = fields.Char(
        string="PAYCOMET Simulator Script URL",
        config_parameter="instantcredit_simulator.script_url",
        help="Public JS URL provided by PAYCOMET for Instant Credit simulator.",
    )
    instantcredit_hash_token = fields.Char(
        string="PAYCOMET Instant Credit HASH_TOKEN",
        config_parameter="instantcredit_simulator.hash_token",
        help="HASH_TOKEN used by PAYCOMET simulator initialization.",
    )
