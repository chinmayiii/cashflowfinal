
from typing import List, Optional
from pydantic import BaseModel, Field


class PredictionResponse(BaseModel):

    predicted_cashflow: float = Field(
        ...,
        description="Predicted net cashflow value for the next day."
    )
    liquidity_score: float = Field(
        ...,
        description="Calculated liquidity score (0-100)."
    )
    risk: str = Field(
        ...,
        description="Risk classification level (e.g., Stable, Moderate Risk, High Risk)."
    )
    recommendations: List[str] = Field(
        ...,
        description="List of financial recommendations based on liquidity assessment."
    )


class ExtractedTransaction(BaseModel):
    id: str = Field(..., description="Unique ID for extracted transaction")
    date: str = Field(..., description="ISO Date string YYYY-MM-DD")
    description: str = Field(..., description="Extracted transaction memo or merchant name")
    amount: float = Field(..., description="Transaction monetary amount")
    type: str = Field(..., description="Transaction flow type: 'inflow' or 'outflow'")
    category: str = Field(default="General", description="Classified category")
    account: str = Field(default="Statement Account", description="Account label")
    balance: float = Field(default=0.0, description="Running cash balance")


class OCRUploadResponse(PredictionResponse):
    extracted_transactions: List[ExtractedTransaction] = Field(
        default_factory=list,
        description="List of structured transactions parsed by OCR"
    )
    raw_text_snippet: str = Field(
        default="",
        description="Preview of raw text extracted via OCR"
    )
    total_extracted: int = Field(
        default=0,
        description="Total count of recognized transactions"
    )
    inflow_total: float = Field(
        default=0.0,
        description="Sum of all extracted inflow credits"
    )
    outflow_total: float = Field(
        default=0.0,
        description="Sum of all extracted outflow debits"
    )
    confidence_note: Optional[str] = Field(
        default=None,
        description="Notes regarding OCR parsing and feature alignment"
    )

