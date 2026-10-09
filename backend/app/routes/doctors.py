from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.database.dependencies import get_db
from app.schemas.doctor import DoctorCreate, DoctorResponse, DoctorUpdate
from app.services.doctor_service import (
    create_doctor,
    delete_doctor,
    get_doctor,
    get_doctors,
    update_doctor,
)


router = APIRouter(prefix="/doctors", tags=["Doctors"])


@router.post(
    "/",
    response_model=DoctorResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_doctor_endpoint(
    data: DoctorCreate,
    db: Session = Depends(get_db),
):
    return create_doctor(db, data)


@router.get("/", response_model=list[DoctorResponse])
def list_doctors(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    return get_doctors(db, skip=skip, limit=limit)


@router.get("/{doctor_id}", response_model=DoctorResponse)
def retrieve_doctor(
    doctor_id: int,
    db: Session = Depends(get_db),
):
    doctor = get_doctor(db, doctor_id)

    if doctor is None:
        raise HTTPException(status_code=404, detail="Doctor not found.")

    return doctor


@router.patch("/{doctor_id}", response_model=DoctorResponse)
def edit_doctor(
    doctor_id: int,
    data: DoctorUpdate,
    db: Session = Depends(get_db),
):
    doctor = get_doctor(db, doctor_id)

    if doctor is None:
        raise HTTPException(status_code=404, detail="Doctor not found.")

    return update_doctor(db, doctor, data)


@router.delete("/{doctor_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_doctor(
    doctor_id: int,
    db: Session = Depends(get_db),
):
    doctor = get_doctor(db, doctor_id)

    if doctor is None:
        raise HTTPException(status_code=404, detail="Doctor not found.")

    delete_doctor(db, doctor)
    return Response(status_code=status.HTTP_204_NO_CONTENT)