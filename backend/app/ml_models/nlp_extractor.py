"""
NLP Entity Extractor (spaCy + multilingual BERT).

Extracts the five entity families used by the knowledge graph from raw text:
    PERSON, LOCATION, VEHICLE, ACCOUNT, ORGANIZATION

Pipeline:
    1. Clean and tokenise text
    2. Run spaCy NER (fast, always available) for PERSON/ORG/LOC
    3. Run multilingual BERT NER for high-recall labels (when transformers present)
    4. Regex extractors for VEHICLE / ACCOUNT / transaction entities
    5. Lightweight co-reference + alias handling
    6. Build relationship triplets between extracted entities
    7. Per-entity confidence scoring

Configuration (env): NLP_MODEL_NAME (default bert-base-multilingual-cased),
NLP_CONFIDENCE_THRESHOLD (default 0.75).
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from typing import Any, Optional

from app.config import settings

logger = logging.getLogger("crimenet.nlp")

# ── Regex patterns ────────────────────────────────────────────────────────────
PATTERNS: dict[str, re.Pattern] = {
    # Indian vehicle registration: MH-01-AB-1234 / DL 01 AB 1234 / TN01AB1234
    "vehicle": re.compile(
        r"\b[A-Z]{2}[\-\s]?\d{1,2}[\-\s]?[A-Z]{1,3}[\-\s]?\d{1,4}\b"
    ),
    # IFSC: 4 letters + 0 + 6 alphanumeric
    "ifsc": re.compile(r"\b[A-Z]{4}0[A-Z0-9]{6}\b"),
    # UPI id: user@bank
    "upi": re.compile(r"\b[\w.\-]{2,}@(?:oksbi|okaxis|okhdfcbank|okicici|ybl|apl|paytm|upi|ibl|axl)\b", re.I),
    # Generic UPI-style id
    "upi_generic": re.compile(r"\b[\w.\-]{2,}@[a-zA-Z]{2,}\b"),
    # Bank account (9-18 digits), often masked as XXXX1234
    "account": re.compile(r"\b(?:XXXX|x{4})?\d{9,18}\b"),
    # Crypto wallet (BTC P2PKH / bech32 / ETH / Tron / Solana)
    "crypto": re.compile(r"\b(?:0x[a-fA-F0-9]{40}|bc1[a-zA-HJ-NP-Z0-9]{25,62}|[13][a-km-zA-HJ-NP-Z1-9]{25,34}|T[a-zA-Z0-9]{33})\b"),
    # Phone (Indian): optional +91, starting 6-9, 10 digits
    "phone": re.compile(r"(?:\+91[\-\s]?)?\b[6-9]\d{9}\b"),
    # Amounts: ₹1,23,456 / Rs. 2.3 Crore / 45 Lakh
    "amount": re.compile(
        r"(?:₹|Rs\.?)\s?(\d+(?:,\d+)*(?:\.\d+)?)\s?(crore|cr|lakh|lac|L)?", re.I
    ),
    # Person age hint: "age 38" / "aged 38"
    "age": re.compile(r"\b(?:age|aged)\s+(\d{1,3})\b", re.I),
    # Biometric / Fingerprint / AFIS Code / DNA profile
    "fingerprint": re.compile(
        r"\b(?:FP|AFIS|LATENT|FINGERPRINT|BIO)[\-\s:#]?[A-Z0-9]{4,12}\b", re.I
    ),
    "dna": re.compile(r"\b(?:DNA|STR)[\-\s:#]?[A-Z0-9]{6,16}\b", re.I),
    # Indian National Identifiers: Aadhaar, PAN, Driving License, Passport, Voter ID
    "aadhaar": re.compile(r"\b(?:\d{4}[\-\s]\d{4}[\-\s]\d{4}|XXXX[\-\s]XXXX[\-\s]\d{4}|\b\d{12}\b)"),
    "pan": re.compile(r"\b[A-Z]{5}[0-9]{4}[A-Z]\b"),
    "driving_license": re.compile(r"\b[A-Z]{2}[0-9]{2}[\-\s]?[0-9]{11}\b"),
    "passport": re.compile(r"\b[A-Z][1-9][0-9]{7}\b"),
    "voter_id": re.compile(r"\b[A-Z]{3}[0-9]{7}\b"),
    # Hardware & Telephony: IMEI / IMSI / MAC Address
    "imei": re.compile(r"\b(?:IMEI[\-\s:#]?)?(\d{15})\b", re.I),
    # Digital / Cyber Handles: Telegram, IP address, Tor onion
    "telegram": re.compile(r"(?:t\.me/|@)([a-zA-Z0-9_]{5,32})\b"),
    "ip_address": re.compile(r"\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b"),
    "onion_url": re.compile(r"\b[a-z2-7]{16,56}\.onion\b"),
}

# Languages the system is expected to ingest (BERT is multilingual).
SUPPORTED_LANGUAGES = {"en", "hi", "ta", "bn", "mr", "te"}

# Map spaCy NER labels to our entity families.
SPACY_LABEL_MAP = {
    "PERSON": "PERSON",
    "ORG": "ORGANIZATION",
    "GPE": "LOCATION",
    "LOC": "LOCATION",
    "FAC": "LOCATION",
}

# Map BERT NER labels to our entity families.
BERT_LABEL_MAP = {
    "PER": "PERSON",
    "ORG": "ORGANIZATION",
    "LOC": "LOCATION",
}


@dataclass
class ExtractedEntity:
    """A single extracted entity with confidence and source."""

    text: str
    type: str  # PERSON | LOCATION | VEHICLE | ACCOUNT | ORGANIZATION
    confidence: float
    source: str  # spacy | bert | regex
    meta: dict[str, Any] = field(default_factory=dict)


class NLPEntityExtractor:
    """Hybrid entity extractor combining spaCy, BERT and rule engines."""

    def __init__(self) -> None:
        self._spacy_nlp = self._load_spacy()
        self._bert_pipeline: Optional[Any] = self._load_bert()
        self.threshold = settings.nlp_confidence_threshold

    # ── Model loading ─────────────────────────────────────────────────────────
    def _load_spacy(self) -> Any:
        """Load the spaCy model, falling back to a blank pipeline."""
        try:
            import spacy

            try:
                nlp = spacy.load("en_core_web_sm")
                logger.info("spaCy model en_core_web_sm loaded")
                return nlp
            except OSError:
                logger.warning("en_core_web_sm not found; using blank pipeline")
                return spacy.blank("en")
        except Exception as exc:  # noqa: BLE001
            logger.warning("spaCy unavailable (%s); regex-only mode", exc)
            return None

    def _load_bert(self) -> Optional[Any]:
        """Load the multilingual BERT NER pipeline when transformers is present."""
        if not settings.ml_load_models:
            return None
        try:
            from transformers import pipeline

            ner = pipeline(
                "ner",
                model=settings.nlp_model_name,
                aggregation_strategy="simple",
                device=-1,  # CPU for API serving
            )
            logger.info("BERT NER pipeline loaded: %s", settings.nlp_model_name)
            return ner
        except Exception as exc:  # noqa: BLE001
            logger.warning("BERT pipeline unavailable (%s); spaCy-only mode", exc)
            return None

    # ── Public API ────────────────────────────────────────────────────────────
    def extract(self, text: str, language: str = "en") -> dict[str, Any]:
        """
        Extract entities, relationships and metadata from raw text.

        Returns:
            {
                "entities": [...],
                "relationships": [...],
                "language": ...,
                "document_length": ...,
                "quality_score": ...
            }
        """
        cleaned = self._clean(text)
        entities: list[ExtractedEntity] = []
        entities += self._extract_spacy(cleaned)
        entities += self._extract_bert(cleaned)
        entities += self._extract_regex(cleaned)
        entities = self._deduplicate(entities)
        entities = [e for e in entities if e.confidence >= self.threshold or e.source == "regex"]

        relationships = self._build_triplets(cleaned, entities)
        return {
            "entities": [self._serialise(e) for e in entities],
            "relationships": relationships,
            "language": language if language in SUPPORTED_LANGUAGES else "en",
            "document_length": len(cleaned),
            "quality_score": self._quality(cleaned, entities),
            "model": {
                "spacy": self._spacy_nlp is not None,
                "bert": self._bert_pipeline is not None,
                "bert_model": settings.nlp_model_name,
                "threshold": self.threshold,
            },
        }

    # ── Cleaning ──────────────────────────────────────────────────────────────
    def _clean(self, text: str) -> str:
        """Strip HTML, normalise whitespace and standardise common tokens."""
        text = re.sub(r"<[^>]+>", " ", text)          # remove HTML tags
        text = re.sub(r"[^\S\r\n]+", " ", text)       # collapse whitespace
        text = re.sub(r"\bRs\.?\b", "₹", text)        # Rs. -> ₹
        return text.strip()

    # ── spaCy extraction ──────────────────────────────────────────────────────
    def _extract_spacy(self, text: str) -> list[ExtractedEntity]:
        if self._spacy_nlp is None:
            return []
        doc = self._spacy_nlp(text[:100_000])  # cap for safety
        out: list[ExtractedEntity] = []
        for ent in doc.ents:
            family = SPACY_LABEL_MAP.get(ent.label_)
            if not family:
                continue
            confidence = 0.9 if family == "PERSON" else 0.8
            out.append(ExtractedEntity(
                text=ent.text.strip(),
                type=family,
                confidence=confidence,
                source="spacy",
                meta={"label": ent.label_},
            ))
        return out

    # ── BERT extraction ───────────────────────────────────────────────────────
    def _extract_bert(self, text: str) -> list[ExtractedEntity]:
        if self._bert_pipeline is None:
            return []
        out: list[ExtractedEntity] = []
        try:
            # Chunk long documents to respect token limits.
            for chunk in self._chunk(text, 450):
                for item in self._bert_pipeline(chunk):
                    family = BERT_LABEL_MAP.get(item.get("entity_group"))
                    if not family:
                        continue
                    out.append(ExtractedEntity(
                        text=item.get("word", "").strip(),
                        type=family,
                        confidence=round(float(item.get("score", 0.0)), 3),
                        source="bert",
                    ))
        except Exception as exc:  # noqa: BLE001
            logger.debug("BERT extraction failed: %s", exc)
        return out

    # ── Regex extraction (vehicles / accounts / biometrics / national IDs) ─────
    def _extract_regex(self, text: str) -> list[ExtractedEntity]:
        out: list[ExtractedEntity] = []
        for match in PATTERNS["vehicle"].finditer(text):
            out.append(ExtractedEntity(
                text=match.group(0), type="VEHICLE", confidence=0.97,
                source="regex", meta={"subtype": "registration"},
            ))
        for match in PATTERNS["ifsc"].finditer(text):
            out.append(ExtractedEntity(
                text=match.group(0), type="ACCOUNT", confidence=0.95,
                source="regex", meta={"subtype": "ifsc"},
            ))
        for match in PATTERNS["upi"].finditer(text):
            out.append(ExtractedEntity(
                text=match.group(0), type="ACCOUNT", confidence=0.92,
                source="regex", meta={"subtype": "upi"},
            ))
        for match in PATTERNS["crypto"].finditer(text):
            out.append(ExtractedEntity(
                text=match.group(0), type="ACCOUNT", confidence=0.95,
                source="regex", meta={"subtype": "crypto_wallet"},
            ))
        for match in PATTERNS["account"].finditer(text):
            out.append(ExtractedEntity(
                text=match.group(0), type="ACCOUNT", confidence=0.85,
                source="regex", meta={"subtype": "bank_account"},
            ))
        for match in PATTERNS["fingerprint"].finditer(text):
            out.append(ExtractedEntity(
                text=match.group(0).upper(), type="BIOMETRIC", confidence=0.98,
                source="regex", meta={"subtype": "fingerprint_latent", "modality": "latent_fingerprint"},
            ))
        for match in PATTERNS["dna"].finditer(text):
            out.append(ExtractedEntity(
                text=match.group(0).upper(), type="BIOMETRIC", confidence=0.99,
                source="regex", meta={"subtype": "dna_profile", "modality": "str_dna"},
            ))
        for match in PATTERNS["aadhaar"].finditer(text):
            out.append(ExtractedEntity(
                text=match.group(0).strip(), type="NATIONAL_ID", confidence=0.96,
                source="regex", meta={"subtype": "aadhaar", "id_type": "AADHAAR"},
            ))
        for match in PATTERNS["pan"].finditer(text):
            out.append(ExtractedEntity(
                text=match.group(0).strip().upper(), type="NATIONAL_ID", confidence=0.96,
                source="regex", meta={"subtype": "pan", "id_type": "PAN"},
            ))
        for match in PATTERNS["driving_license"].finditer(text):
            out.append(ExtractedEntity(
                text=match.group(0).strip().upper(), type="NATIONAL_ID", confidence=0.94,
                source="regex", meta={"subtype": "driving_license", "id_type": "DL"},
            ))
        for match in PATTERNS["passport"].finditer(text):
            out.append(ExtractedEntity(
                text=match.group(0).strip().upper(), type="NATIONAL_ID", confidence=0.95,
                source="regex", meta={"subtype": "passport", "id_type": "PASSPORT"},
            ))
        for match in PATTERNS["imei"].finditer(text):
            out.append(ExtractedEntity(
                text=match.group(0).strip(), type="DIGITAL_IDENTIFIER", confidence=0.93,
                source="regex", meta={"subtype": "imei_hardware"},
            ))
        for match in PATTERNS["telegram"].finditer(text):
            out.append(ExtractedEntity(
                text=match.group(0).strip(), type="DIGITAL_IDENTIFIER", confidence=0.91,
                source="regex", meta={"subtype": "telegram_handle"},
            ))
        for match in PATTERNS["ip_address"].finditer(text):
            out.append(ExtractedEntity(
                text=match.group(0).strip(), type="DIGITAL_IDENTIFIER", confidence=0.90,
                source="regex", meta={"subtype": "ip_address"},
            ))
        return out

    # ── Deduplication ─────────────────────────────────────────────────────────
    def _deduplicate(self, entities: list[ExtractedEntity]) -> list[ExtractedEntity]:
        """Merge duplicates (same entity from multiple sources), keep best score."""
        best: dict[tuple[str, str], ExtractedEntity] = {}
        for e in entities:
            key = (e.type, e.text.lower())
            if key not in best or e.confidence > best[key].confidence:
                best[key] = e
        return sorted(best.values(), key=lambda e: -e.confidence)

    # ── Triplet building (lightweight co-reference) ───────────────────────────
    def _build_triplets(
        self, text: str, entities: list[ExtractedEntity]
    ) -> list[dict[str, str]]:
        """
        Build simple relationship triplets:
          PERSON -[LOCATED_AT]-> LOCATION   (first location after person)
          PERSON -[MEMBER_OF]-> ORGANIZATION
          PERSON -[OWNS_VEHICLE]-> VEHICLE
          PERSON -[OWNS_ACCOUNT]-> ACCOUNT
        """
        people = [e for e in entities if e.type == "PERSON"]
        orgs = [e for e in entities if e.type == "ORGANIZATION"]
        locs = [e for e in entities if e.type == "LOCATION"]
        vehs = [e for e in entities if e.type == "VEHICLE"]
        accts = [e for e in entities if e.type == "ACCOUNT"]
        triplets: list[dict[str, str]] = []

        if not people:
            return triplets

        for person in people[:5]:  # cap to avoid combinatorial blowup
            idx = text.lower().find(person.text.lower())
            if idx >= 0:
                following = text[idx + len(person.text): idx + len(person.text) + 300]
                for loc in locs:
                    if loc.text.lower() in following.lower():
                        triplets.append({
                            "source": person.text, "relation": "LOCATED_AT",
                            "target": loc.text, "confidence": "0.75",
                        })
                        break
                for org in orgs:
                    if org.text.lower() in following.lower():
                        triplets.append({
                            "source": person.text, "relation": "MEMBER_OF",
                            "target": org.text, "confidence": "0.7",
                        })
                        break
                for veh in vehs:
                    if veh.text.lower() in following.lower():
                        triplets.append({
                            "source": person.text, "relation": "OWNS_VEHICLE",
                            "target": veh.text, "confidence": "0.85",
                        })
                        break
                for acct in accts:
                    if acct.text.lower() in following.lower():
                        triplets.append({
                            "source": person.text, "relation": "OWNS_ACCOUNT",
                            "target": acct.text, "confidence": "0.8",
                        })
                        break
        return triplets

    # ── Helpers ───────────────────────────────────────────────────────────────
    @staticmethod
    def _chunk(text: str, size: int) -> list[str]:
        """Split text into word-boundary chunks of at most `size` words."""
        words = text.split()
        return [" ".join(words[i:i + size]) for i in range(0, len(words), size)]

    @staticmethod
    def _quality(text: str, entities: list[ExtractedEntity]) -> float:
        """Heuristic document quality score (entity density)."""
        if not text:
            return 0.0
        density = len(entities) / max(1, len(text.split()) / 50)
        return round(min(1.0, density), 3)

    @staticmethod
    def _serialise(e: ExtractedEntity) -> dict[str, Any]:
        return {
            "text": e.text,
            "type": e.type,
            "confidence": e.confidence,
            "source": e.source,
            "meta": e.meta,
        }


# ── Module-level singleton ────────────────────────────────────────────────────
_extractor: Optional[NLPEntityExtractor] = None


def get_nlp_extractor() -> NLPEntityExtractor:
    """Return the shared NLP extractor, initialising it on first use."""
    global _extractor
    if _extractor is None:
        _extractor = NLPEntityExtractor()
    return _extractor
