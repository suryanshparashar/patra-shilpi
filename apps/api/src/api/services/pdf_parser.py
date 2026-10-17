import io
from dataclasses import dataclass

import pdfplumber
from fastapi import UploadFile
from pdfminer.pdfdocument import PDFPasswordIncorrect
from pdfminer.pdfparser import PDFSyntaxError

from agents import devlog
from api.config import settings
from api.errors import AppError

PDF_MAGIC = b"%PDF-"


@dataclass(frozen=True)
class ParsedResume:
    text: str
    page_count: int


async def read_upload(file: UploadFile) -> bytes:
    """Read an upload, stopping as soon as it exceeds the size limit."""
    data = await file.read(settings.max_upload_bytes + 1)
    if len(data) > settings.max_upload_bytes:
        max_mb = settings.max_upload_bytes // (1024 * 1024)
        raise AppError(
            413,
            "FILE_TOO_LARGE",
            f"The file is too large. The maximum size is {max_mb} MB.",
            {"max_bytes": settings.max_upload_bytes},
        )
    return data


def parse_resume_pdf(data: bytes) -> ParsedResume:
    """Validate a resume PDF and extract its text. Blocking; run it in a worker thread."""
    if not data:
        raise AppError(422, "FILE_EMPTY", "The uploaded file is empty.")
    if not data.startswith(PDF_MAGIC):
        raise AppError(415, "INVALID_FILE_TYPE", "Only PDF files are supported.")

    try:
        with pdfplumber.open(io.BytesIO(data)) as pdf:
            page_count = len(pdf.pages)
            if page_count > settings.max_pdf_pages:
                raise AppError(
                    422,
                    "PDF_TOO_MANY_PAGES",
                    f"The PDF has {page_count} pages. The maximum is {settings.max_pdf_pages}.",
                    {"max": settings.max_pdf_pages, "actual": page_count},
                )
            text = "\n\n".join((page.extract_text() or "").strip() for page in pdf.pages).strip()
    except AppError:
        raise
    except PDFPasswordIncorrect as exc:
        raise _encrypted() from exc
    except PDFSyntaxError as exc:
        raise _corrupt() from exc
    except Exception as exc:
        # pdfminer raises several unrelated types for broken or encrypted files.
        if "password" in str(exc).lower() or "encrypt" in str(exc).lower():
            raise _encrypted() from exc
        raise _corrupt() from exc

    if len(text) < settings.min_resume_chars:
        raise AppError(
            422,
            "PDF_NO_TEXT",
            "No readable text was found. This looks like a scanned PDF. "
            "Please upload a text-based PDF.",
        )
    devlog("SERVICE", "PDF parsed", pages=page_count, chars=len(text), bytes=len(data))
    return ParsedResume(text=text, page_count=page_count)


def _encrypted() -> AppError:
    return AppError(
        422, "PDF_ENCRYPTED", "The PDF is password-protected. Remove the password and try again."
    )


def _corrupt() -> AppError:
    return AppError(422, "PDF_UNREADABLE", "The PDF could not be read. The file may be corrupted.")
