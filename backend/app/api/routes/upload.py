"""Upload API routes for handling CSV data uploads and OCR photo ingestion."""

from pathlib import Path
from typing import Union
from fastapi import APIRouter, File, UploadFile, status

from app.schemas.response import PredictionResponse, OCRUploadResponse
from app.services.upload_service import UploadService
from app.services.ocr_service import OCRService
from app.utils.logging import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/upload", tags=["Upload"])

_upload_service = UploadService()
_ocr_service = OCRService()

IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff"}


@router.post(
    "/",
    response_model=Union[OCRUploadResponse, PredictionResponse],
    status_code=status.HTTP_200_OK,
    summary="Upload CSV or Statement Photo for end-to-end prediction & liquidity assessment",
    description="Accepts CSV statements or image photos (via camera/gallery), extracts transactions, and returns cashflow forecast.",
)
async def upload_file(file: UploadFile = File(...)) -> Union[OCRUploadResponse, PredictionResponse]:
    """Unified endpoint to upload either a CSV statement or an OCR photo for ML inference."""
    filename = file.filename or "unknown"
    ext = Path(filename).suffix.lower()
    logger.info(f"Received upload request for file '{filename}' with extension '{ext}'")

    if ext in IMAGE_EXTENSIONS:
        result = _ocr_service.process_image_and_predict(file)
        return OCRUploadResponse(**result)
    else:
        result = _upload_service.process_upload_and_predict(file)
        return PredictionResponse(**result)


@router.post(
    "/image",
    response_model=OCRUploadResponse,
    status_code=status.HTTP_200_OK,
    summary="Upload mobile camera photo or statement image for OCR processing",
    description="Preprocesses image with OpenCV, extracts text via Tesseract OCR, parses financial rows, and generates cashflow predictions.",
)
async def upload_statement_image(file: UploadFile = File(...)) -> OCRUploadResponse:
    """Dedicated endpoint for OCR photo uploads from mobile camera or image gallery."""
    logger.info(f"Received OCR statement photo: {file.filename if file else 'None'}")
    result = _ocr_service.process_image_and_predict(file)
    return OCRUploadResponse(**result)
