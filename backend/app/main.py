from fastapi import FastAPI

from app.routes.health import router as health_router
from app.routes.patients import router as patients_router



app = FastAPI(
    title="MediTrack API",
    description="Hospital Appointment and Patient Record Management System",
    version="1.0.0",
)

app.include_router(health_router)
app.include_router(patients_router)


@app.get("/")
def root() -> dict[str, str]:
    return {
        "message": "Welcome to MediTrack API",
        "docs": "/docs",
    }


