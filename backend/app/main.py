from fastapi import FastAPI

from app.routes.health import router as health_router
from app.routes.patients import router as patients_router
from app.routes.departments import router as departments_router
from app.routes.doctors import router as doctors_router
from app.routes.appointments import router as appointments_router
from app.routes.medical_records import router as medical_records_router
from app.routes.medicines import router as medicines_router
from app.routes.prescriptions import router as prescriptions_router
from app.routes.prescription_items import router as prescription_items_router


app = FastAPI(
    title="MediTrack API",
    description="Hospital Appointment and Patient Record Management System",
    version="1.0.0",
)

app.include_router(health_router)
app.include_router(patients_router)
app.include_router(departments_router)
app.include_router(doctors_router)
app.include_router(appointments_router)
app.include_router(medical_records_router)
app.include_router(medicines_router)
app.include_router(prescriptions_router)
app.include_router(prescription_items_router)


@app.get("/")
def root() -> dict[str, str]:
    return {
        "message": "Welcome to MediTrack API",
        "docs": "/docs",
    }