"""OCR Engine for preprocessing mobile photos, scanned statements, and receipts.

Uses OpenCV for image conditioning (scaling, contrast normalization, noise reduction,
adaptive binarization, deskewing) and Tesseract OCR for text extraction.
"""

from typing import Union, Tuple, Optional
import io
import math
import numpy as np
import cv2
import pytesseract
from PIL import Image


class OCREngine:
    """Image conditioning and Optical Character Recognition engine."""

    def __init__(self, tesseract_cmd: Optional[str] = None) -> None:
        """Initialize the OCR Engine with optional custom Tesseract binary path."""
        if tesseract_cmd:
            pytesseract.pytesseract.tesseract_cmd = tesseract_cmd

    def load_image(self, image_input: Union[bytes, str, io.BytesIO, Image.Image]) -> np.ndarray:
        """Load image input into OpenCV BGR numpy array.

        Args:
            image_input: Raw image bytes, file path, BytesIO stream, or PIL Image.

        Returns:
            np.ndarray: OpenCV BGR image array.
        """
        if isinstance(image_input, bytes):
            nparr = np.frombuffer(image_input, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        elif isinstance(image_input, io.BytesIO):
            image_input.seek(0)
            nparr = np.frombuffer(image_input.read(), np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        elif isinstance(image_input, Image.Image):
            rgb = np.array(image_input)
            img = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
        elif isinstance(image_input, str):
            img = cv2.imread(image_input)
        else:
            raise ValueError(f"Unsupported image input type: {type(image_input)}")

        if img is None:
            raise ValueError("Failed to decode image. Ensure the file is a valid image format.")

        return img

    def preprocess_image(self, image: np.ndarray) -> np.ndarray:
        """Condition image for optimal character recognition.

        Applies:
        1. Dimension upscaling if resolution is low
        2. Grayscale conversion
        3. Background/foreground polarity check
        4. Bilateral filtering for edge-preserving denoising
        5. Adaptive Gaussian thresholding and Otsu thresholding
        6. Deskewing to align text lines horizontally

        Args:
            image: Original BGR image.

        Returns:
            np.ndarray: Preprocessed binary image.
        """
        # 1. Scale image if width is less than 1500px for better OCR character geometry
        height, width = image.shape[:2]
        if width < 1500:
            scale = 1500.0 / float(width)
            new_width = 1500
            new_height = int(height * scale)
            image = cv2.resize(image, (new_width, new_height), interpolation=cv2.INTER_CUBIC)

        # 2. Convert to grayscale
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

        # 3. Deskewing check
        gray = self._deskew(gray)

        # 4. Bilateral filter to remove sensor noise while preserving sharp character edges
        denoised = cv2.bilateralFilter(gray, 9, 75, 75)

        # 5. Adaptive thresholding with Otsu blend for crisp text
        otsu_thresh = cv2.threshold(denoised, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)[1]

        # Invert if the image has a dark background and bright text
        white_pixels = np.sum(otsu_thresh == 255)
        total_pixels = otsu_thresh.shape[0] * otsu_thresh.shape[1]
        if white_pixels < (total_pixels / 2):
            otsu_thresh = cv2.bitwise_not(otsu_thresh)

        return otsu_thresh

    def _deskew(self, gray: np.ndarray) -> np.ndarray:
        """Detect dominant skew angle and rotate image straight."""
        try:
            # Find contours or threshold to estimate orientation angle
            thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV | cv2.THRESH_OTSU)[1]
            coords = np.column_stack(np.where(thresh > 0))
            if len(coords) < 100:
                return gray

            angle = cv2.minAreaRect(coords)[-1]
            if angle < -45:
                angle = -(90 + angle)
            elif angle > 45:
                angle = 90 - angle

            # Only correct realistic skew angles between -20 and 20 degrees
            if abs(angle) > 0.5 and abs(angle) < 25:
                (h, w) = gray.shape[:2]
                center = (w // 2, h // 2)
                M = cv2.getRotationMatrix2D(center, angle, 1.0)
                rotated = cv2.warpAffine(
                    gray, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE
                )
                return rotated
        except Exception:
            pass
        return gray

    def extract_text(
        self, image_input: Union[bytes, str, io.BytesIO, Image.Image]
    ) -> Tuple[str, np.ndarray]:
        """Execute end-to-end OCR extraction on an input image.

        Args:
            image_input: Image bytes, path, or stream.

        Returns:
            Tuple[str, np.ndarray]: (Extracted text string, preprocessed image)
        """
        img = self.load_image(image_input)
        preprocessed = self.preprocess_image(img)

        # Attempt PSM 6 (uniform block of text / tabular structure)
        text_psm6 = pytesseract.image_to_string(preprocessed, config="--psm 6").strip()

        # If PSM 6 yielded minimal text, try PSM 4 (variable column single column) or PSM 3
        if len(text_psm6.splitlines()) < 3:
            text_psm4 = pytesseract.image_to_string(preprocessed, config="--psm 4").strip()
            if len(text_psm4) > len(text_psm6):
                return text_psm4, preprocessed

        return text_psm6, preprocessed

