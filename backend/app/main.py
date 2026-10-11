"""
MediTrack — FastAPI application entry point.

Role-permission matrix applied at the router level:
┌─────────────────────┬────────┬─────────────┬────────┬────────────┬───────────┬─────────┐
│ Resource            │ admin  │ receptionist│ doctor │ pharmacist │accountant │ patient │
├─────────────────────┼────────┼─────────────┼────────┼────────────┼───────────┼─────────┤
│ Patients (r/w)      │  ✓     │  ✓          │  ✓     │            │           │  own    │
│ Departments (r/w)   │  ✓     │  ✓(r)       │  ✓(r)  │  ✓(r)     │  ✓(r)     │  ✓(r)  │
│ Doctors (r/w)       │  ✓     │  ✓(r)       │  ✓(r)  │  ✓(r)     │  ✓(r)     │  ✓(r)  │
│ Appointments (r/w)  │  ✓     │  ✓          │  ✓(r)  │            │           │  own    │
│ Medical Records (w) │  ✓     │             │  ✓     │            │           │         │
│ Medicines (r/w)     │  ✓     │             │  ✓(r)  │  ✓        │           │         │
│ Prescriptions (r/w) │  ✓     │             │  ✓     │  ✓(r)     │           │         │
│ Rx Items (r/w)      │  ✓     │             │  ✓     │  ✓        │           │         │
│ Bills (r/w)         │  ✓     │  ✓          │        │            │  ✓        │  own    │
└─────────────────────┴────────┴─────────────┴────────┴────────────┴───────────┴─────────┘

(r) = read-only (GET methods only); full = all methods.
Finer-grained per-patient / per-record scope is enforced in the service layer
for patient-role users via the query filters.
"""
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.auth.firebase import initialize_firebase
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

# ── Bootstrap Firebase Admin SDK ─────────────────────────────────────────────
initialize_firebase()

# ── Application ──────────────────────────────────────────────────────────────
app = FastAPI(
    title="MediTrack API",
    description="Hospital Appointment and Patient Record Management System",
    version="1.0.0",
)

# ── CORS ─────────────────────────────────────────────────────────────────────
# ALLOWED_ORIGINS is a comma-separated list of allowed origins from env.
# In development the Vite dev server at localhost:5173 is always allowed.
# In production set ALLOWED_ORIGINS to your deployed frontend URL.
_raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
_allowed_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
    return {
        "message": "Welcome to MediTrack API",
        "docs": "/docs",
    }
