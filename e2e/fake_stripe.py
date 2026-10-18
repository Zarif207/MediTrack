"""
In-process stand-in for Stripe's API, used only by start_backend.py when
E2E_FAKE_STRIPE=1. Checkout Sessions are created and retrieved locally; webhook
signature verification is NOT faked — run.mjs signs events with the same
secret and the real stripe.Webhook.construct_event checks them.
"""
from types import SimpleNamespace

WEBHOOK_SECRET = "whsec_e2e_meditrack"
SESSIONS: dict = {}


class FakeStripeClient:
    def __init__(self, api_key):
        assert api_key.startswith("sk_test_")

        class Sessions:
            def create(self, params=None, options=None):
                sid = f"cs_test_e2e{len(SESSIONS) + 1:04d}"
                price = params["line_items"][0]["price_data"]
                SESSIONS[sid] = SimpleNamespace(
                    id=sid, url=f"https://checkout.stripe.com/c/pay/{sid}", status="open",
                    payment_status="unpaid", amount_total=price["unit_amount"], currency=price["currency"],
                    payment_intent=None)
                return SESSIONS[sid]

            def retrieve(self, session, params=None, options=None):
                return SESSIONS[session]

            def expire(self, session, params=None, options=None):
                SESSIONS[session].status = "expired"
                return SESSIONS[session]

        self.v1 = SimpleNamespace(checkout=SimpleNamespace(sessions=Sessions()))


def install(settings, stripe_module) -> None:
    settings.stripe_secret_key = "sk_test_e2e_fake"
    settings.stripe_webhook_secret = WEBHOOK_SECRET
    settings.stripe_currency = "usd"
    settings.public_app_url = f"http://localhost:{__import__('os').getenv('E2E_APP_PORT', '5174')}"
    stripe_module.StripeClient = FakeStripeClient
