import logging
import sys
import re
from typing import Any

# Regex patterns for redacting sensitive PII and credentials
SENSITIVE_PATTERNS = [
    # Authorization header / Bearer token
    (re.compile(r'(?i)(bearer\s+)([A-Za-z0-9_\-\.]{10,})'), r'\1[REDACTED_TOKEN]'),
    # OpenAI / Third-party API keys (e.g. sk-..., aiza...)
    (re.compile(r'(?i)(sk-[A-Za-z0-9_\-]{15,})'), r'[REDACTED_OPENAI_KEY]'),
    (re.compile(r'(?i)(AIza[0-9A-Za-z-_]{30,45})'), r'[REDACTED_GOOGLE_KEY]'),
    # Password / secret fields in JSON or query params
    (re.compile(r'(?i)(password|secret|token|api_key|client_secret)["\']?\s*[:=]\s*["\']?([^"\'\s,;]+)'), r'\1=[REDACTED]'),
    # Email addresses (PII)
    (re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'), r'[REDACTED_EMAIL]'),
    # IPv4 addresses - mask last octet for privacy (e.g., 192.168.1.xxx)
    (re.compile(r'\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.)\d{1,3}\b'), r'\g<1>xxx')
]

def mask_sensitive_data(message: str) -> str:
    """Scrub PII, passwords, API keys, and authorization tokens from text."""
    if not isinstance(message, str):
        message = str(message)
    for pattern, replacement in SENSITIVE_PATTERNS:
        message = pattern.sub(replacement, message)
    return message

class SensitiveDataFilter(logging.Filter):
    """Logging filter ensuring no PII, credentials, or secrets leak to stdout or log files."""
    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.msg, str):
            record.msg = mask_sensitive_data(record.msg)
        if record.args:
            if isinstance(record.args, dict):
                record.args = {k: mask_sensitive_data(str(v)) for k, v in record.args.items()}
            elif isinstance(record.args, (list, tuple)):
                record.args = tuple(mask_sensitive_data(str(v)) for v in record.args)
        return True

def setup_logger(name: str = "autoclip") -> logging.Logger:
    logger = logging.getLogger(name)
    if not logger.handlers:
        logger.setLevel(logging.INFO)
        handler = logging.StreamHandler(sys.stdout)
        handler.setLevel(logging.INFO)
        formatter = logging.Formatter(
            fmt="%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S"
        )
        handler.setFormatter(formatter)
        handler.addFilter(SensitiveDataFilter())
        logger.addHandler(handler)
        logger.addFilter(SensitiveDataFilter())
    return logger

logger = setup_logger()
