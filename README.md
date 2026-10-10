# MediTrack — Hospital Appointment and Patient Record Management System

MediTrack is a database-driven hospital management project designed to organize patient information, doctor and department details, appointments, medical records, prescriptions, medicines, and billing.

The project focuses on relational database design, data integrity, and RESTful API development. A React-based frontend is planned for a later stage.

## Features

- **Patient Management:** Create, view, update, and delete patient records.
- **Department Management:** Manage hospital departments.
- **Doctor Management:** Maintain doctor profiles and associate doctors with departments.
- **Appointment Management:** Schedule, view, update, and cancel appointments while checking for scheduling conflicts.
- **Medical Record Management:** Store diagnoses, symptoms, and treatment notes associated with appointments.
- **Prescription Management:** Create and manage prescriptions linked to medical records.
- **Medicine Management:** Maintain medicine details, prices, and stock quantities.
- **Prescription Items:** Associate medicines with prescriptions and store dosage, frequency, duration, and quantity.
- **Billing Management:** Create bills, track payment status, and record payment timestamps.
- **Database Relationships:** Use primary keys, foreign keys, unique constraints, and an associative table to maintain relational integrity.
- **API Documentation:** Explore and test endpoints through FastAPI's interactive Swagger UI.

## Technology Stack

| Layer | Technology |
|---|---|
| Database | PostgreSQL 18 |
| Backend Language | Python 3.13 |
| API Framework | FastAPI |
| ORM | SQLAlchemy 2.x |
| Database Driver | Psycopg 3 |
| Data Validation | Pydantic |
| Configuration | pydantic-settings and environment variables |
| Frontend | React and Tailwind CSS (planned) |
| Version Control | Git and GitHub |
| Database Design | DrawSQL |

## Database Design

MediTrack currently contains nine entities:

1. `departments`
2. `doctors`
3. `patients`
4. `appointments`
5. `medical_records`
6. `prescriptions`
7. `medicines`
8. `prescription_items`
9. `bills`

### Main Relationships

- One department can have many doctors.
- One patient can have many appointments.
- One doctor can have many appointments.
- Each appointment can have at most one medical record.
- Each medical record can have multiple prescriptions.
- A prescription can contain multiple medicines, and a medicine can appear in multiple prescriptions. The `prescription_items` table resolves this many-to-many relationship.
- One patient can have multiple bills.
- Each appointment can have at most one bill.

## Project Structure

```text
MediTrack/
├── backend/
│   ├── app/
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   └── security.py
│   │   ├── database/
│   │   │   ├── base.py
│   │   │   ├── connection.py
│   │   │   └── dependencies.py
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── routes/
│   │   ├── services/
│   │   └── main.py
│   ├── .env
│   ├── requirements.txt
│   └── create_tables.py
├── .gitignore
└── README.md
```

The `models`, `schemas`, `routes`, and `services` directories contain separate modules for the project's database entities and API operations.

## Getting Started

### Prerequisites

Install the following software:

- Python 3.13 or compatible version
- PostgreSQL
- Git

### 1. Clone the Repository

```bash
git clone https://github.com/Zarif207/MediTrack.git
cd MediTrack
```

### 2. Navigate to the Backend

```bash
cd backend
```

### 3. Create and Activate a Virtual Environment

On macOS or Linux:

```bash
python3 -m venv .venv
source .venv/bin/activate
```

### 4. Install Dependencies

```bash
pip install -r requirements.txt
```

### 5. Configure Environment Variables

Create a `.env` file inside the `backend` directory and add your PostgreSQL connection string:

```env
DATABASE_URL=postgresql+psycopg://postgres:YOUR_PASSWORD@localhost:5432/meditrack_db
```

Replace `YOUR_PASSWORD` with your local PostgreSQL password.

**Security:** Never commit `.env` or real database credentials to GitHub. Keep the file excluded through `.gitignore`.

### 6. Create the Database

Create a PostgreSQL database named `meditrack_db` if it does not already exist.

For example, using `psql`:

```sql
CREATE DATABASE meditrack_db;
```

Run this SQL command only if the database has not already been created.

### 7. Create the Database Tables

From the `backend` directory, with the virtual environment activated:

```bash
python create_tables.py
```

This uses SQLAlchemy metadata to create any missing tables. It does not automatically migrate existing tables when model definitions change.

### 8. Start the API Server

```bash
uvicorn app.main:app --reload
```

The development server will run at:

http://127.0.0.1:8000

## API Documentation

Once the server is running, open:

- **Swagger UI:** http://127.0.0.1:8000/docs
- **ReDoc:** http://127.0.0.1:8000/redoc
- **Health Check:** http://127.0.0.1:8000/health

The health endpoint checks whether the API can communicate with the database.

## API Endpoints

The backend provides CRUD operations for the following resources:

| Resource | Base Endpoint |
|---|---|
| Patients | `/patients/` |
| Departments | `/departments/` |
| Doctors | `/doctors/` |
| Appointments | `/appointments/` |
| Medical Records | `/medical-records/` |
| Prescriptions | `/prescriptions/` |
| Medicines | `/medicines/` |
| Prescription Items | `/prescription-items/` |
| Bills | `/bills/` |

Most resources support:

- `POST` — Create a record
- `GET` — Retrieve records
- `PATCH` — Update a record
- `DELETE` — Delete a record

Exact filtering options and validation rules are documented in Swagger UI.

## Current Development Status

- [x] PostgreSQL database connection
- [x] SQLAlchemy model definitions for nine entities
- [x] Database table creation
- [x] Pydantic request and response schemas
- [x] Service and route layers for CRUD operations
- [x] Basic API and database health check
- [x] Manual testing of CRUD endpoints
- [ ] Comprehensive database integrity testing
- [ ] Additional SQL queries and reporting
- [ ] React frontend development
- [ ] End-to-end testing and final documentation

## Academic Project

MediTrack is being developed as a Database Management Systems (DBMS) semester project. Its primary objective is to demonstrate relational database design, entity relationships, constraints, data validation, and database-backed application development.

## License

This project is developed for academic purposes. A license can be added if the project is later distributed for reuse.
