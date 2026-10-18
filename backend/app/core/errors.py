"""
Uniform error responses.

Every error body has the shape {"detail": ...}, matching FastAPI's own
HTTPException and validation responses, so the frontend parses one format.
Database and unexpected errors are logged server-side and never echoed to the
client.
"""
import logging

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy.exc import DataError, IntegrityError, OperationalError, SQLAlchemyError

logger = logging.getLogger("app.errors")


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(IntegrityError)
    async def _integrity(request: Request, exc: IntegrityError):
        logger.warning("Integrity error on %s %s", request.method, request.url.path)
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content={"detail": "The request conflicts with existing data."},
        )

    @app.exception_handler(DataError)
    async def _data(request: Request, exc: DataError):
        logger.warning("Data error on %s %s", request.method, request.url.path)
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            content={"detail": "One or more values are out of range or malformed."},
        )

    @app.exception_handler(OperationalError)
    async def _operational(request: Request, exc: OperationalError):
        logger.error("Database unavailable on %s %s", request.method, request.url.path)
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"detail": "The database is temporarily unavailable."},
        )

    @app.exception_handler(SQLAlchemyError)
    async def _database(request: Request, exc: SQLAlchemyError):
        logger.exception("Database error on %s %s", request.method, request.url.path)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "An unexpected error occurred."},
        )

    @app.exception_handler(Exception)
    async def _unexpected(request: Request, exc: Exception):
        logger.exception("Unhandled error on %s %s", request.method, request.url.path)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "An unexpected error occurred."},
        )