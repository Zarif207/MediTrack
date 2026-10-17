"""
MediTrack — FastAPI application entry point.

Authorization is centralised in app.auth.permissions (role → permission matrix)
and app.auth.ownership (patient data scoping). See docs/SECURITY.md for the
full permission matrix.
"""
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.auth.firebase import initialize_firebase
from app.core.config import settings
from app.core.errors import register_error_handlers
from app.routes.health import router as health_router
from app.routes.auth import router as auth_router
from app.routes.patients import router as patients_router
from app.routes.departments import router as departments_router
from app.routes.doctors import router as doctors_router
from app.routes.appointments import router as appointments_router
from app.routes.medical_records import router as medical_records_router
from app.routes.medicines import router as medicines_router
from app.routes.prescriptions import router as prescriptions_router
from app.routes.prescription_items import router as prescription_items_router
from app.routes.bills import router as bills_router

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")

# ── Bootstrap Firebase Admin SDK ─────────────────────────────────────────────
initialize_firebase()

# ── Application ──────────────────────────────────────────────────────────────
app = FastAPI(
    title="MediTrack API",
    description="Hospital Appointment and Patient Record Management System",
    version="1.1.0",
    # Interactive docs are a development convenience.
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None if settings.is_production else "/redoc",
    openapi_url=None if settings.is_production else "/openapi.json",
)

register_error_handlers(app)

# ── CORS ─────────────────────────────────────────────────────────────────────
# The API authenticates with bearer tokens, not cookies, so credentials are
# not allowed cross-origin.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(health_router)
app.include_router(auth_router)
app.include_router(patients_router)
app.include_router(departments_router)
app.include_router(doctors_router)
app.include_router(appointments_router)
app.include_router(medical_records_router)
app.include_router(medicines_router)
app.include_router(prescriptions_router)
app.include_router(prescription_items_router)
app.include_router(bills_router)


@app.get("/")
def root() -> dict[str, str]:
    return {"message": "Welcome to MediTrack API"}
