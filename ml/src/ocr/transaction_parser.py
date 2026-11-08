"""Intelligent Financial Transaction Parser for OCR extracted text.

Parses unstructured and semi-structured text from mobile camera photos,
bank passbooks, account statements, and store receipts into normalized
cashflow transaction dictionaries.
"""

import re
import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple


class TransactionParser:
    """Parser converting raw OCR text into structured financial transactions."""

    DATE_PATTERNS = [
        # YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD
        (r"\b(20\d{2})[-/.](0?[1-9]|1[0-2])[-/.](0?[1-9]|[12]\d|3[01])\b", "%Y-%m-%d"),
        # DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY
        (r"\b(0?[1-9]|[12]\d|3[01])[-/.](0?[1-9]|1[0-2])[-/.](20\d{2})\b", "%d-%m-%Y"),
        # DD-Mon-YYYY (e.g. 15-Jan-2026 or 15 Jan 2026)
        (r"\b(0?[1-9]|[12]\d|3[01])[\s-](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s-](20\d{2})\b", "%d-%b-%Y"),
        # Mon DD, YYYY (e.g. Jan 15, 2026)
        (r"\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(0?[1-9]|[12]\d|3[01]),?\s+(20\d{2})\b", "%b %d %Y"),
    ]

    INFLOW_KEYWORDS = {
        "credit", "cr", "deposit", "dep", "received", "inward", "salary",
        "sale", "sales", "revenue", "transfer in", "refund", "interest", "upi in"
    }

    OUTFLOW_KEYWORDS = {
        "debit", "dr", "withdrawal", "withdrawn", "w/d", "paid", "payment",
        "outward", "purchase", "fee", "charge", "transfer out", "pos", "atm", "upi out"
    }

    def parse(self, ocr_text: str, default_balance: float = 10000.0) -> List[Dict[str, Any]]:
        """Parse raw OCR text into a list of structured transaction items.

        Args:
            ocr_text: Extracted text from OCR engine.
            default_balance: Baseline fallback balance for running balance tracking.

        Returns:
            List[Dict[str, Any]]: List of parsed transaction dictionaries.
        """
        lines = [line.strip() for line in ocr_text.splitlines() if line.strip()]
        transactions: List[Dict[str, Any]] = []
        running_balance = default_balance

        # First attempt: Tabular line parsing (bank statement / passbook format)
        for line in lines:
            parsed_txn = self._parse_tabular_line(line, running_balance)
            if parsed_txn:
                running_balance = parsed_txn["balance"]
                transactions.append(parsed_txn)

        # Second attempt: If tabular parsing found nothing, try receipt-style key-value parsing
        if not transactions:
            receipt_txns = self._parse_receipt_format(lines, default_balance)
            if receipt_txns:
                transactions.extend(receipt_txns)

        # Fallback: If still nothing, search for any floating amounts with dates
        if not transactions:
            freeform_txns = self._parse_freeform_amounts(lines, default_balance)
            if freeform_txns:
                transactions.extend(freeform_txns)

        # Sort transactions chronologically
        transactions.sort(key=lambda t: t["date"])
        return transactions

    def _parse_tabular_line(self, line: str, current_balance: float) -> Optional[Dict[str, Any]]:
        """Attempt to parse a single tabular bank statement row."""
        # Find date
        date_str, date_match = self._extract_date(line)
        if not date_str or not date_match:
            return None

        # Clean line removing the date part to examine description and numbers
        remaining_text = line[:date_match.start()] + " " + line[date_match.end():]
        remaining_text = remaining_text.strip()

        # Find all monetary amount candidates
        amounts = self._extract_amounts(remaining_text)
        if not amounts:
            return None

        # Determine transaction type (inflow vs outflow)
        lower_line = line.lower()
        is_inflow = any(re.search(rf"\b{kw}\b", lower_line) for kw in self.INFLOW_KEYWORDS)
        is_outflow = any(re.search(rf"\b{kw}\b", lower_line) for kw in self.OUTFLOW_KEYWORDS)

        # Assign amount and balance
        if len(amounts) >= 2:
            txn_amount = amounts[0]
            new_balance = amounts[-1]
            if not is_inflow and not is_outflow:
                is_inflow = new_balance >= current_balance
        else:
            txn_amount = amounts[0]
            if is_inflow:
                new_balance = current_balance + txn_amount
            elif is_outflow:
                new_balance = max(0.0, current_balance - txn_amount)
            else:
                is_inflow = True
                new_balance = current_balance + txn_amount

        txn_type = "inflow" if is_inflow else "outflow"

        # Extract description by stripping amounts and keywords
        desc = re.sub(r"[\$₹€£]?\s*\d+(?:,\d{3})*(?:\.\d{1,2})?", " ", remaining_text)
        desc = re.sub(r"\b(credit|debit|cr|dr|deposit|withdrawal|balance)\b", " ", desc, flags=re.IGNORECASE)
        desc = re.sub(r"\s+", " ", desc).strip()
        if not desc or len(desc) < 3:
            desc = "Commercial Transaction" if txn_type == "inflow" else "Operating Expense"

        category = self._categorize_transaction(desc, txn_type)

        return {
            "id": f"ocr_{uuid.uuid4().hex[:8]}",
            "date": date_str,
            "description": desc.title(),
            "amount": round(txn_amount, 2),
            "type": txn_type,
            "category": category,
            "account": "Statement Account",
            "balance": round(new_balance, 2),
        }

    def _parse_receipt_format(self, lines: List[str], current_balance: float) -> List[Dict[str, Any]]:
        """Parse single invoice or retail receipt format."""
        found_date: Optional[str] = None
        found_amount: Optional[float] = None
        merchant_name: str = "Merchant Purchase"
        is_inflow = False

        for i, line in enumerate(lines):
            # Extract header merchant
            if i == 0 and len(line) > 3 and not re.search(r"\d", line):
                merchant_name = line.strip().title()

            # Date search
            if not found_date:
                d_str, _ = self._extract_date(line)
                if d_str:
                    found_date = d_str

            # Check for Total or Amount keywords
            lower = line.lower()
            if any(k in lower for k in ["total", "amount", "net", "subtotal", "paid", "grand total"]):
                amounts = self._extract_amounts(line)
                if amounts:
                    found_amount = max(amounts)
                    if any(k in lower for k in ["credit", "refund", "received", "deposit"]):
                        is_inflow = True

        if found_amount is not None and found_amount > 0:
            if not found_date:
                found_date = datetime.now().strftime("%Y-%m-%d")

            txn_type = "inflow" if is_inflow else "outflow"
            balance = (current_balance + found_amount) if is_inflow else max(0.0, current_balance - found_amount)

            return [{
                "id": f"ocr_rcpt_{uuid.uuid4().hex[:8]}",
                "date": found_date,
                "description": merchant_name,
                "amount": round(found_amount, 2),
                "type": txn_type,
                "category": "Receipt Expense" if txn_type == "outflow" else "Sales Revenue",
                "account": "Business Checking",
                "balance": round(balance, 2),
            }]

        return []

    def _parse_freeform_amounts(self, lines: List[str], current_balance: float) -> List[Dict[str, Any]]:
        """Fallback to extract any floating date + amount pairs found across text lines."""
        results: List[Dict[str, Any]] = []
        bal = current_balance

        for line in lines:
            d_str, _ = self._extract_date(line)
            amounts = self._extract_amounts(line)
            if amounts:
                amt = amounts[0]
                if amt > 0 and amt < 1_000_000:
                    dt = d_str or datetime.now().strftime("%Y-%m-%d")
                    is_in = "credit" in line.lower() or "cr" in line.lower()
                    bal = (bal + amt) if is_in else max(0.0, bal - amt)
                    results.append({
                        "id": f"ocr_ff_{uuid.uuid4().hex[:8]}",
                        "date": dt,
                        "description": "OCR Scanned Transaction",
                        "amount": round(amt, 2),
                        "type": "inflow" if is_in else "outflow",
                        "category": "General",
                        "account": "Primary Account",
                        "balance": round(bal, 2),
                    })
        return results

    def _extract_date(self, text: str) -> Tuple[Optional[str], Optional[re.Match]]:
        """Extract standard ISO YYYY-MM-DD date string from arbitrary text."""
        for pattern, date_format in self.DATE_PATTERNS:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                raw_matched = match.group(0).replace("/", "-").replace(".", "-")
                try:
                    dt = datetime.strptime(raw_matched, date_format)
                    return dt.strftime("%Y-%m-%d"), match
                except ValueError:
                    pass

        # Also search for standalone YYYY-MM-DD
        iso_match = re.search(r"\b(20\d{2})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\b", text)
        if iso_match:
            return iso_match.group(0), iso_match

        return None, None

    def _extract_amounts(self, text: str) -> List[float]:
        """Extract numerical financial amounts from text string."""
        # Find amounts formatted like 1,234.56 or 1234.56 or 500
        matches = re.findall(
            r"\b([0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)\b",
            text,
        )
        amounts: List[float] = []
        for m in matches:
            clean_str = m.replace(",", "").strip()
            if not clean_str:
                continue
            try:
                val = float(clean_str)
                # Filter out pure small integers like day or account numbers, require reasonable transaction size
                if val >= 0.50 and val not in [2024, 2025, 2026, 2027]:
                    amounts.append(val)
            except ValueError:
                pass
        return amounts

    def _categorize_transaction(self, description: str, txn_type: str) -> str:
        """Infer financial category from transaction description keywords."""
        desc_lower = description.lower()
        if txn_type == "inflow":
            if any(k in desc_lower for k in ["consulting", "service", "client", "customer", "invoice"]):
                return "Client Invoicing"
            elif any(k in desc_lower for k in ["sale", "pos", "retail", "store"]):
                return "Sales Revenue"
            elif any(k in desc_lower for k in ["refund", "reversal"]):
                return "Refunds"
            return "Revenue"
        else:
            if any(k in desc_lower for k in ["salary", "payroll", "wage"]):
                return "Payroll"
            elif any(k in desc_lower for k in ["rent", "lease"]):
                return "Facilities & Rent"
            elif any(k in desc_lower for k in ["cloud", "hosting", "aws", "software", "tech", "saas"]):
                return "Technology & SaaS"
            elif any(k in desc_lower for k in ["supply", "office", "equipment", "material"]):
                return "Office Supplies"
            elif any(k in desc_lower for k in ["tax", "fee", "duty", "interest"]):
                return "Taxes & Fees"
            return "Operating Expense"
