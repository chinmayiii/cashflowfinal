"""Tests for OCR image upload and statement parsing."""

import io
from pathlib import Path
import pytest
from PIL import Image, ImageDraw
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


@pytest.fixture
def sample_statement_image_bytes():
    """Generate a clean synthetic bank statement image."""
    img = Image.new("RGB", (900, 450), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    lines = [
        "COMMERCIAL BANK STATEMENT - MSME ACCOUNT",
        "DATE        DESCRIPTION          AMOUNT     TYPE    BALANCE",
        "2026-03-01  CLIENT PAYMENT       5500.00    CREDIT  15500.00",
        "2026-03-02  OFFICE SUPPLIES      350.00     DEBIT   15150.00",
        "2026-03-03  CLOUD HOSTING        120.00     DEBIT   15030.00",
        "2026-03-04  CONSULTING REVENUE   2400.00    CREDIT  17430.00",
        "2026-03-05  EQUIPMENT LEASE      800.00     DEBIT   16630.00",
    ]
    y = 25
    for line in lines:
        draw.text((25, y), line, fill=(0, 0, 0))
        y += 45

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return buf.getvalue()


def test_ocr_image_upload_endpoint(sample_statement_image_bytes):
    """Test POST /upload/image endpoint with a valid statement photo."""
    response = client.post(
        "/upload/image",
        files={"file": ("mobile_statement_photo.png", sample_statement_image_bytes, "image/png")}
    )
    assert response.status_code == 200
    data = response.json()
    assert "predicted_cashflow" in data
    assert "liquidity_score" in data
    assert "risk" in data
    assert "recommendations" in data
    assert "extracted_transactions" in data
    assert len(data["extracted_transactions"]) >= 3
    assert data["total_extracted"] >= 3
    assert data["inflow_total"] > 0
    assert data["outflow_total"] > 0


def test_ocr_unified_upload_endpoint(sample_statement_image_bytes):
    """Test POST /upload/ handles images through unified dispatch."""
    response = client.post(
        "/upload/",
        files={"file": ("camera_snap.png", sample_statement_image_bytes, "image/png")}
    )
    assert response.status_code == 200
    data = response.json()
    assert "predicted_cashflow" in data
    assert "liquidity_score" in data


def test_ocr_invalid_image_type():
    """Test POST /upload/image rejects non-image files."""
    response = client.post(
        "/upload/image",
        files={"file": ("invalid.txt", b"plain text content", "text/plain")}
    )
    assert response.status_code == 400

