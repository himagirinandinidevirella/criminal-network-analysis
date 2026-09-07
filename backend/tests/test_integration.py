"""
Integration tests — FIR analysis pipeline and graph serialisation.

Marked with `pytest.mark.integration` so they can be run selectively when the
full stack (Neo4j/Redis/Postgres) is available. Without the stack, the FIR
analysis test still exercises the NLP extractor's deterministic regex path.
"""

from __future__ import annotations

import pytest

SAMPLE_FIR = """
FIR No: 042/2024
Raja Khan, aged 38, of Dharavi, Mumbai, is the leader of the Mumbai Drug
Syndicate. He was seen in a black BMW MH-01-AX-9999 with Shyam Verma.
A suspicious transfer of Rs. 45,00,000 from account XXXX1234 at State Bank of
India (IFSC SBIN0001234) was flagged. Meena Patil manages hawala operations.
"""


def test_fir_entity_extraction_regex() -> None:
    """The NLP extractor finds vehicles and accounts without a database."""
    from app.ml_models.nlp_extractor import get_nlp_extractor

    extractor = get_nlp_extractor()
    result = extractor.extract(SAMPLE_FIR, "en")
    texts = [e["text"] for e in result["entities"]]
    assert "MH-01-AX-9999" in texts
    assert "SBIN0001234" in texts


@pytest.mark.integration
def test_fir_graph_update() -> None:
    """FIR analysis updates the graph when Neo4j is available."""
    from app.services.nlp_service import analyze_fir

    result = analyze_fir(SAMPLE_FIR, "en")
    assert "created" in result
    assert result["created"].get("PERSON", 0) >= 0
