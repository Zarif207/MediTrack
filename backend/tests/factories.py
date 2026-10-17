"""Synthetic test data. Every value here is invented."""
from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models import (
    Appointment, Bill, Department, Doctor, MedicalRecord, Medicine,
    Patient, Prescription, PrescriptionItem, UserProfile,
)

STAFF = ("admin", "receptionist", "doctor", "pharmacist", "accountant")


def future_weekday(days: int = 7) -> date:
    d = date.today() + timedelta(days=days)
    while d.weekday() >= 5:
        d += timedelta(days=1)
    return d


@dataclass
class World:
    dept: Department
    doctor: Doctor
    doctor2: Doctor
    patient_a: Patient
    patient_b: Patient
    appt_a: Appointment
    appt_b: Appointment
    record_a: MedicalRecord
    record_b: MedicalRecord
    rx_a: Prescription
    rx_b: Prescription
    item_a: PrescriptionItem
    item_b: PrescriptionItem
    bill_a: Bill
    bill_b: Bill
    medicine: Medicine
    uids: dict = field(default_factory=dict)


def make_profile(db: Session, uid: str, role: str, patient_id=None, name=None) -> UserProfile:
    p = UserProfile(
        firebase_uid=uid, role=role, patient_id=patient_id,
        display_name=name or f"Test {role.title()}",
        email=f"{uid.lower()}@test.invalid", created_at=datetime.now(),
    )
    db.add(p)
    db.commit()
    return p


def build_world(db: Session) -> World:
    now = datetime.now()
    dept = Department(department_name="Test Cardiology", description="Synthetic department")
    db.add(dept); db.flush()
    doctor = Doctor(department_id=dept.department_id, first_name="Ada", last_name="Okafor",
                    specialization="Cardiology", phone="+10000000001",
                    email="ada.okafor@test.invalid", license_number="TEST-LIC-1")
    doctor2 = Doctor(department_id=dept.department_id, first_name="Ben", last_name="Iyer",
                     specialization="Cardiology", phone="+10000000002",
                     email="ben.iyer@test.invalid", license_number="TEST-LIC-2")
    db.add_all([doctor, doctor2]); db.flush()
    pa = Patient(first_name="Alice", last_name="Synthetic", date_of_birth=date(1990, 1, 1),
                 gender="Female", phone="+10000000011", email="alice@test.invalid", registered_at=now)
    pb = Patient(first_name="Bob", last_name="Synthetic", date_of_birth=date(1985, 6, 1),
                 gender="Male", phone="+10000000012", email="bob@test.invalid", registered_at=now)
    db.add_all([pa, pb]); db.flush()
    appt_a = Appointment(patient_id=pa.patient_id, doctor_id=doctor.doctor_id,
                         appointment_date=date(2025, 8, 1), appointment_time=time(10, 0),
                         status="completed", created_at=now)
    appt_b = Appointment(patient_id=pb.patient_id, doctor_id=doctor.doctor_id,
                         appointment_date=date(2025, 8, 2), appointment_time=time(11, 0),
                         status="completed", created_at=now)
    db.add_all([appt_a, appt_b]); db.flush()
    rec_a = MedicalRecord(appointment_id=appt_a.appointment_id, diagnosis="Diagnosis A", record_date=now)
    rec_b = MedicalRecord(appointment_id=appt_b.appointment_id, diagnosis="Diagnosis B", record_date=now)
    db.add_all([rec_a, rec_b]); db.flush()
    rx_a = Prescription(record_id=rec_a.record_id, prescription_date=now, instructions="Rx A")
    rx_b = Prescription(record_id=rec_b.record_id, prescription_date=now, instructions="Rx B")
    med = Medicine(medicine_name="Testamol", generic_name="Testamolum", dosage_form="Tablet",
                   strength="500mg", manufacturer="Synthetic Pharma", unit_price=Decimal("1.50"),
                   stock_quantity=100)
    db.add_all([rx_a, rx_b, med]); db.flush()
    item_a = PrescriptionItem(prescription_id=rx_a.prescription_id, medicine_id=med.medicine_id,
                              dosage="1 tablet", frequency="Twice daily", duration="5 days", quantity=10)
    item_b = PrescriptionItem(prescription_id=rx_b.prescription_id, medicine_id=med.medicine_id,
                              dosage="1 tablet", frequency="Daily", duration="3 days", quantity=3)
    bill_a = Bill(patient_id=pa.patient_id, appointment_id=appt_a.appointment_id,
                  amount=Decimal("100.00"), payment_status="pending", issued_at=now)
    bill_b = Bill(patient_id=pb.patient_id, appointment_id=appt_b.appointment_id,
                  amount=Decimal("80.00"), payment_status="pending", issued_at=now)
    db.add_all([item_a, item_b, bill_a, bill_b])
    db.commit()

    uids = {}
    for role in STAFF + ("user",):
        uids[role] = f"UID_{role.upper()}"
        make_profile(db, uids[role], role)
    uids["patient_a"] = "UID_PATIENT_A"
    make_profile(db, "UID_PATIENT_A", "patient", patient_id=pa.patient_id, name="Alice Synthetic")
    uids["patient_b"] = "UID_PATIENT_B"
    make_profile(db, "UID_PATIENT_B", "patient", patient_id=pb.patient_id, name="Bob Synthetic")
    uids["patient_u"] = "UID_PATIENT_U"
    make_profile(db, "UID_PATIENT_U", "patient", name="Una Unlinked")

    w = World(dept, doctor, doctor2, pa, pb, appt_a, appt_b, rec_a, rec_b,
              rx_a, rx_b, item_a, item_b, bill_a, bill_b, med, uids)
    # Plain IDs so tests never touch detached ORM state.
    w.ids = {
        "dept": dept.department_id, "doctor": doctor.doctor_id, "doctor2": doctor2.doctor_id,
        "patient_a": pa.patient_id, "patient_b": pb.patient_id,
        "appt_a": appt_a.appointment_id, "appt_b": appt_b.appointment_id,
        "record_a": rec_a.record_id, "record_b": rec_b.record_id,
        "rx_a": rx_a.prescription_id, "rx_b": rx_b.prescription_id,
        "item_a": item_a.prescription_item_id, "item_b": item_b.prescription_item_id,
        "bill_a": bill_a.bill_id, "bill_b": bill_b.bill_id, "medicine": med.medicine_id,
    }
    return w


def auth(uid: str) -> dict:
    return {"Authorization": f"Bearer uid:{uid}"}
