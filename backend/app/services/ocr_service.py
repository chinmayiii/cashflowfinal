"""OCR Service module for processing statement and receipt photos through ML inference."""

from pathlib import Path
from typing import Dict, Any, List, Optional
import io
import pandas as pd
from fastapi import UploadFile, HTTPException, status

from ml.src.ocr.ocr_engine import OCREngine
from ml.src.ocr.transaction_parser import TransactionParser
from ml.src.features.feature_engineering import (
    convert_date_column,
    sort_by_date,
    create_lag_features,
    create_rolling_features,
    remove_missing_rows,
)
from app.services.prediction_service import PredictionService
from app.utils.logging import get_logger

logger = get_logger(__name__)


class OCRService:
    """Service responsible for OCR photo ingestion, text parsing, feature engineering, and inference."""

    def __init__(
        self,
        ocr_engine: Optional[OCREngine] = None,
        transaction_parser: Optional[TransactionParser] = None,
        prediction_service: Optional[PredictionService] = None,
    ) -> None:
        """Initialize OCRService with engine, parser, and prediction dependencies."""
        self.ocr_engine = ocr_engine or OCREngine()
        self.parser = transaction_parser or TransactionParser()
        self.prediction_service = prediction_service or PredictionService()

        # Path to baseline historical daily cashflow dataset for seamless history fusion
        self.project_root = Path(__file__).resolve().parents[3]
        self.baseline_csv = (
            self.project_root / "ml" / "data" / "processed" / "daily_cashflow.csv"
        )

    def process_image_and_predict(self, file: UploadFile) -> Dict[str, Any]:
        """Process an uploaded statement/receipt photo and execute end-to-end ML prediction.

        Args:
            file: Uploaded image file (PNG, JPG, JPEG, WEBP, BMP, etc.).

        Returns:
            Dict[str, Any]: Consolidated payload containing predictions, extracted transactions, and OCR metrics.

        Raises:
            HTTPException: If file is missing, format is invalid, or OCR yields no financial data.
        """
        # 1. Validate file
        if not file or not file.filename:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No image file provided.",
            )

        allowed_extensions = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff"}
        file_ext = Path(file.filename).suffix.lower()
        if file_ext not in allowed_extensions:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported image type '{file_ext}'. Allowed formats: {', '.join(sorted(allowed_extensions))}",
            )

        logger.info(f"Processing OCR statement image upload: {file.filename}")

        # 2. Read image bytes and run OCR
        try:
            image_bytes = file.file.read()
            if not image_bytes or len(image_bytes) == 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Uploaded image file is empty.",
                )
            extracted_text, _ = self.ocr_engine.extract_text(image_bytes)
        except HTTPException:
            raise
        except Exception as e:
            logger.warning(f"Error during OCR image extraction: {e}")
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Failed to extract text from image via OCR: {str(e)}",
            )

        if not extracted_text or len(extracted_text.strip()) < 5:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Could not detect readable text from the uploaded photo. Please ensure clear lighting and focus.",
            )

        # 3. Parse financial transactions from OCR text
        transactions = self.parser.parse(extracted_text)
        if not transactions:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    "OCR detected text but could not identify valid dates, amounts, or financial line items. "
                    "Please upload a photo of a bank statement, passbook, or payment receipt."
                ),
            )

        logger.info(f"Successfully parsed {len(transactions)} transactions from OCR text")

        # 4. Aggregate parsed transactions into daily cashflow format
        daily_records: Dict[str, Dict[str, Any]] = {}
        inflow_total = 0.0
        outflow_total = 0.0

        for txn in transactions:
            date_key = txn["date"]
            amt = float(txn["amount"])
            if txn["type"] == "inflow":
                inflow_total += amt
            else:
                outflow_total += amt

            if date_key not in daily_records:
                daily_records[date_key] = {
                    "Date": date_key,
                    "Cash_In": 0.0,
                    "Cash_Out": 0.0,
                    "End_Balance": float(txn.get("balance", 10000.0)),
                    "Transaction_Count": 0,
                }

            if txn["type"] == "inflow":
                daily_records[date_key]["Cash_In"] += amt
            else:
                daily_records[date_key]["Cash_Out"] += amt

            daily_records[date_key]["End_Balance"] = float(txn.get("balance", daily_records[date_key]["End_Balance"]))
            daily_records[date_key]["Transaction_Count"] += 1

        daily_list = list(daily_records.values())
        for d in daily_list:
            d["Net_Cashflow"] = d["Cash_In"] - d["Cash_Out"]

        ocr_daily_df = pd.DataFrame(daily_list)
        ocr_daily_df["Date"] = pd.to_datetime(ocr_daily_df["Date"])
        ocr_daily_df = ocr_daily_df.sort_values("Date").reset_index(drop=True)

        # 5. Build full sequence for Track A Feature Engineering (ensuring at least 8 days)
        if len(ocr_daily_df) >= 8:
            combined_df = ocr_daily_df
            confidence_note = "Features engineered directly from multi-day statement photo."
        else:
            # Fuse with baseline historical cashflow to maintain complete 7-day rolling windows
            if self.baseline_csv.exists():
                baseline_df = pd.read_csv(self.baseline_csv)
                baseline_df["Date"] = pd.to_datetime(baseline_df["Date"])
                combined_df = pd.concat([baseline_df, ocr_daily_df], ignore_index=True)
                combined_df = combined_df.drop_duplicates(subset=["Date"], keep="last")
                confidence_note = f"Extracted {len(transactions)} recent transactions, fused with historical baseline for 7-day lag features."
            else:
                # If no baseline CSV, pad synthetic chronological sequence
                pad_rows = []
                base_date = ocr_daily_df["Date"].min()
                for i in range(8, 0, -1):
                    pad_rows.append({
                        "Date": base_date - pd.Timedelta(days=i),
                        "Cash_In": ocr_daily_df["Cash_In"].mean(),
                        "Cash_Out": ocr_daily_df["Cash_Out"].mean(),
                        "Net_Cashflow": (ocr_daily_df["Cash_In"].mean() - ocr_daily_df["Cash_Out"].mean()),
                        "End_Balance": ocr_daily_df["End_Balance"].iloc[0],
                        "Transaction_Count": 1,
                    })
                combined_df = pd.concat([pd.DataFrame(pad_rows), ocr_daily_df], ignore_index=True)
                confidence_note = "Synthesized recent historical baseline for short receipt snapshot."

        # 6. Apply Track A Feature Engineering
        try:
            engineered_df = convert_date_column(combined_df)
            engineered_df = sort_by_date(engineered_df)
            engineered_df = create_lag_features(engineered_df)
            engineered_df = create_rolling_features(engineered_df)
            engineered_df = remove_missing_rows(engineered_df)
        except Exception as e:
            logger.warning(f"Feature engineering failed on OCR dataset: {e}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Error executing feature engineering on OCR data: {str(e)}",
            )

        if engineered_df.empty:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unable to compute rolling features from OCR data.",
            )

        latest_row = engineered_df.iloc[-1]
        features = {
            "cash_in": float(latest_row["Cash_In"]),
            "cash_out": float(latest_row["Cash_Out"]),
            "end_balance": float(latest_row["End_Balance"]),
            "transaction_count": int(latest_row["Transaction_Count"]),
            "lag_1": float(latest_row["Lag_1"]),
            "lag_7": float(latest_row["Lag_7"]),
            "rolling_mean_7": float(latest_row["Rolling_Mean_7"]),
            "rolling_std_7": float(latest_row["Rolling_Std_7"]),
            "rolling_cashin_7": float(latest_row["Rolling_CashIn_7"]),
            "rolling_cashout_7": float(latest_row["Rolling_CashOut_7"]),
        }

        # 7. Execute ML Prediction & Liquidity Assessment
        prediction_result = self.prediction_service.predict(features)

        # 8. Consolidate and return response payload
        raw_text_snippet = extracted_text[:350] + ("..." if len(extracted_text) > 350 else "")

        return {
            "predicted_cashflow": prediction_result["predicted_cashflow"],
            "liquidity_score": prediction_result["liquidity_score"],
            "risk": prediction_result["risk"],
            "recommendations": prediction_result["recommendations"],
            "extracted_transactions": transactions,
            "raw_text_snippet": raw_text_snippet,
            "total_extracted": len(transactions),
            "inflow_total": round(inflow_total, 2),
            "outflow_total": round(outflow_total, 2),
            "confidence_note": confidence_note,
        }

