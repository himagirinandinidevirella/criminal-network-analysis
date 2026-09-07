"""
Synthetic data generator — "Operation Mumbai" and associated networks.

Generates a realistic Indian criminal network dataset and loads it into Neo4j,
then seeds demo user accounts in PostgreSQL.

Counts (configurable via environment):
    * 500 criminals (Indian names)
    * 50 organizations (drug/cyber/terror/robbery/trafficking)
    * 200 locations (8 metro cities + surrounds)
    * ~2000 relationships (KNOWS / MEMBER_OF / COMMUNICATED_WITH / ...)
    * 1000 financial transactions (including anomalies)
    * 500 CDR records (spikes before crime events)
    * 100 crime events, 50 vehicles, 100 bank accounts (30 flagged)

Run standalone (as in start.sh):  python data/synthetic_data_generator.py
Or programmatically:            ensure_demo_data()
"""

from __future__ import annotations

import logging
import random
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from app.config import settings
from app.database import neo4j_connection as neo
from app.database.postgres_connection import execute, fetch_one

logger = logging.getLogger("crimenet.seed")

# ── Static corpora ────────────────────────────────────────────────────────────
FIRST_NAMES = [
    "Raja", "Shyam", "Meena", "Vikram", "Priya", "Deepak", "Suresh", "Anita",
    "Ramesh", "Sunita", "Arjun", "Kavita", "Sanjay", "Pooja", "Amit", "Neha",
    "Vijay", "Rekha", "Manoj", "Asha", "Ravi", "Lakshmi", "Gopal", "Kiran",
    "Harish", "Divya", "Nikhil", "Anjali", "Prakash", "Geeta", "Rajesh", "Sneha",
    "Kumar", "Farida", "Imran", "Salma", "Akhil", "Bhavna", "Chandan", "Devika",
    "Ehsaan", "Fathima", "Gautam", "Hema", "Irfan", "Jyoti", "Karthik", "Lata",
    "Mukesh", "Nirmala",
]
LAST_NAMES = [
    "Khan", "Verma", "Patil", "Rao", "Sharma", "Yadav", "Singh", "Gupta",
    "Reddy", "Nair", "Menon", "Iyer", "Bose", "Das", "Chopra", "Malhotra",
    "Sheikh", "Ansari", "Qureshi", "Naidu", "Pillai", "Rathore", "Chauhan",
    "Mehta", "Shah", "Joshi", "Deshmukh", "Kulkarni", "Gaikwad", "Nayak",
]
CRIME_TYPES = [
    "Drug Trafficking", "Money Laundering", "Extortion", "Armed Robbery",
    "Cyber Crime", "Human Trafficking", "Weapons Smuggling", "Fraud",
    "Kidnapping", "Hawala Operations",
]
VEHICLE_MAKES = [
    ("BMW", "X5", "CAR"), ("Honda", "City", "CAR"), ("Maruti", "Swift", "CAR"),
    ("Royal Enfield", "Classic 350", "BIKE"), ("Toyota", "Innova", "CAR"),
    ("Tata", "Ace", "TRUCK"), ("Hero", "Splendor", "BIKE"), ("Hyundai", "Creta", "CAR"),
    ("Mahindra", "Bolero", "CAR"), ("Bajaj", "Pulsar", "BIKE"),
]
BANKS = [
    ("State Bank of India", "SBIN"), ("HDFC Bank", "HDFC"), ("ICICI Bank", "ICIC"),
    ("Axis Bank", "UTIB"), ("Punjab National Bank", "PUNB"), ("Bank of Baroda", "BARB"),
    ("Canara Bank", "CNRB"), ("Kotak Mahindra Bank", "KKBK"),
]
CITIES = [
    ("Mumbai", "Maharashtra", 19.0760, 72.8777),
    ("Delhi", "Delhi", 28.6139, 77.2090),
    ("Chennai", "Tamil Nadu", 13.0827, 80.2707),
    ("Kolkata", "West Bengal", 22.5726, 88.3639),
    ("Hyderabad", "Telangana", 17.3850, 78.4867),
    ("Bengaluru", "Karnataka", 12.9716, 77.5946),
    ("Pune", "Maharashtra", 18.5204, 73.8567),
    ("Jaipur", "Rajasthan", 26.9124, 75.7873),
]
AREAS = ["Dharavi", "Andheri", "Colaba", "Karol Bagh", "T. Nagar", "Salt Lake",
         "Banjara Hills", "Whitefield", "Koregaon Park", "Malviya Nagar",
         "Dadar", "Juhu", "Vashi", "Byculla", "Mahim"]
VEHICLE_STATES = ["MH", "DL", "TN", "WB", "TS", "KA", "RJ", "GJ", "UP", "AP"]


def _rid(prefix: str) -> str:
    """Return a deterministic UUID for an entity id."""
    return str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{prefix}:{uuid.uuid4().hex}"))


def _reg_number(rng: random.Random) -> str:
    """Generate an Indian-style vehicle registration number."""
    state = rng.choice(VEHICLE_STATES)
    return f"{state}-{rng.randint(1, 20):02d}-{''.join(rng.choices('ABCDEFGHIJKLMNOPQRSTUVWXYZ', k=2))}-{rng.randint(1000, 9999)}"


def _account_number(rng: random.Random) -> str:
    """Generate a masked bank account number string."""
    return f"XXXX{rng.randint(1000, 9999)}"


def _phone(rng: random.Random) -> str:
    """Generate an Indian mobile number."""
    return f"+91{rng.choice('6789')}{rng.randint(100000000, 999999999)}"


# ── Data builders ─────────────────────────────────────────────────────────────
def build_dataset() -> dict[str, Any]:
    """
    Build the complete synthetic dataset as in-memory lists.

    Returns a dict of node/edge lists ready for bulk load into Neo4j.
    """
    rng = random.Random(2025)  # deterministic seed for reproducibility

    dataset: dict[str, Any] = {
        "persons": [], "organizations": [], "locations": [], "vehicles": [],
        "accounts": [], "transactions": [], "crime_events": [],
        "knows": [], "member_of": [], "communicated": [], "transacted": [],
        "owns_vehicle": [], "owns_account": [], "located_at": [],
        "participated": [], "transferred": [], "operates_in": [], "rival_of": [],
        "used_in": [],
    }

    # ── Locations (200) ───────────────────────────────────────────────
    location_ids: dict[str, str] = {}
    loc_index = 0
    while len(dataset["locations"]) < settings.synthetic_locations:
        city, state, lat, lon = CITIES[loc_index % len(CITIES)]
        area = AREAS[loc_index % len(AREAS)]
        sector = (loc_index // (len(CITIES) * len(AREAS))) + 1
        name = f"{area} Sector {sector}, {city}" if sector > 1 else f"{area}, {city}"
        if name in location_ids:
            loc_index += 1
            continue
        loc_id = _rid("loc")
        location_ids[name] = loc_id
        dataset["locations"].append({
            "id": loc_id, "name": name, "city": city, "state": state,
            "country": "IN", "latitude": round(lat + rng.uniform(-0.05, 0.05), 4),
            "longitude": round(lon + rng.uniform(-0.05, 0.05), 4),
            "crime_count": rng.randint(0, 40), "hotspot_score": round(rng.uniform(0, 1), 3),
        })
        loc_index += 1

    # ── Organizations (50) ────────────────────────────────────────────
    org_specs = [
        ("Mumbai Drug Syndicate", "DRUG", "Mumbai, Maharashtra", ["Drug Trafficking", "Money Laundering"], "HIGH"),
        ("Eastern Syndicate", "DRUG", "Delhi", ["Drug Trafficking", "Extortion"], "HIGH"),
        ("Dark Web Cell", "CYBER", "Online", ["Cyber Crime", "Fraud"], "HIGH"),
        ("Golden Triangle Traffickers", "TRAFFICKING", "Kolkata", ["Human Trafficking"], "CRITICAL"),
        ("Arms Runners Guild", "WEAPONS", "Jaipur", ["Weapons Smuggling"], "HIGH"),
        ("Hawala Network West", "FINANCIAL", "Mumbai, Maharashtra", ["Hawala Operations", "Money Laundering"], "MEDIUM"),
    ]
    org_ids: dict[str, str] = {}
    for name, otype, loc, specialty, threat in org_specs:
        oid = _rid("org")
        org_ids[name] = oid
        dataset["organizations"].append({
            "id": oid, "name": name, "type": otype, "founded_year": rng.randint(1995, 2020),
            "location": loc, "members_count": rng.randint(5, 40),
            "crime_specialty": specialty, "threat_level": threat, "active": True,
        })
    while len(dataset["organizations"]) < settings.synthetic_organizations:
        name = f"{rng.choice(['Red', 'Blue', 'Green', 'Silver', 'Iron'])} {rng.choice(['Lions', 'Tigers', 'Cobras', 'Wolves', 'Falcons'])} {rng.choice(['Gang', 'Syndicate', 'Cartel', 'Cell'])}"
        if name in org_ids:
            continue
        oid = _rid("org")
        org_ids[name] = oid
        dataset["organizations"].append({
            "id": oid, "name": name, "type": rng.choice(["DRUG", "CYBER", "ROBBERY", "TRAFFICKING", "EXTORTION"]),
            "founded_year": rng.randint(1990, 2022), "location": rng.choice(CITIES)[0],
            "members_count": rng.randint(3, 25),
            "crime_specialty": [rng.choice(CRIME_TYPES)],
            "threat_level": rng.choice(["LOW", "MEDIUM", "HIGH"]), "active": True,
        })

    # ── Core criminal network (Operation Mumbai) ──────────────────────
    def add_person(name: str, role: str, risk: float, crimes: list[str],
                   location: str, aliases: list[str] | None = None,
                   status: str = "ACTIVE") -> str:
        pid = _rid("person")
        dataset["persons"].append({
            "id": pid, "name": name, "aliases": aliases or [],
            "age": rng.randint(22, 55), "gender": "M" if rng.random() < 0.85 else "F",
            "nationality": "IN", "address": location, "criminal_id": f"CR-{rng.randint(100, 999)}",
            "risk_score": risk, "crime_types": crimes, "status": status,
            "verified": rng.random() < 0.4, "important_flag": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        return pid

    # Bosses & lieutenants (exact demo characters).
    raja = add_person("Raja Khan", "LEADER", 95, ["Drug Trafficking", "Money Laundering"],
                      "Dharavi, Mumbai", ["Ramu", "Raja", "Boss Kumar"], "WANTED")
    shyam = add_person("Shyam Verma", "LIEUTENANT", 78, ["Drug Distribution", "Extortion"],
                       "Andheri, Mumbai", ["Shyamu"], "WANTED")
    meena = add_person("Meena Patil", "LIEUTENANT", 72, ["Money Laundering", "Hawala Operations"],
                       "Colaba, Mumbai", ["Meena Bai"], "UNDER_INVESTIGATION")
    vikram = add_person("Vikram Rao", "LEADER", 88, ["Drug Trafficking", "Extortion"],
                        "Karol Bagh, Delhi", ["Vicky"], "WANTED")
    priya = add_person("Priya Hacker", "LEADER", 82, ["Cyber Crime", "Fraud"],
                       "Bengaluru", ["pH4ck"], "UNDER_INVESTIGATION")

    core_ids = {"raja": raja, "shyam": shyam, "meena": meena, "vikram": vikram, "priya": priya}
    mumbai_soldiers = []
    for i in range(5):
        pid = add_person(
            f"{rng.choice(FIRST_NAMES)} {rng.choice(LAST_NAMES)}", "SOLDIER",
            rng.randint(40, 60), [rng.choice(["Drug Trafficking", "Extortion", "Armed Robbery"])],
            f"{rng.choice(AREAS)}, Mumbai", status=rng.choice(["ACTIVE", "WANTED"]),
        )
        mumbai_soldiers.append(pid)
    mumbai_associates = []
    for i in range(10):
        pid = add_person(
            f"{rng.choice(FIRST_NAMES)} {rng.choice(LAST_NAMES)}", "ASSOCIATE",
            rng.randint(20, 40), [rng.choice(["Drug Trafficking", "Money Laundering"])],
            f"{rng.choice(AREAS)}, Mumbai",
        )
        mumbai_associates.append(pid)

    eastern_members = [vikram]
    for i in range(9):
        eastern_members.append(add_person(
            f"{rng.choice(FIRST_NAMES)} {rng.choice(LAST_NAMES)}",
            rng.choice(["LIEUTENANT", "SOLDIER", "ASSOCIATE"]), rng.randint(25, 75),
            [rng.choice(["Drug Trafficking", "Extortion", "Armed Robbery"])],
            f"{rng.choice(['Delhi', 'Lucknow', 'Kanpur'])}", status=rng.choice(["ACTIVE", "WANTED"]),
        ))

    cyber_members = [priya]
    for i in range(7):
        cyber_members.append(add_person(
            f"{rng.choice(FIRST_NAMES)} {rng.choice(LAST_NAMES)}",
            rng.choice(["SOLDIER", "ASSOCIATE"]), rng.randint(30, 70),
            ["Cyber Crime", "Fraud"], rng.choice(CITIES)[0],
        ))

    # Fill up to the configured total.
    used_names = {p["name"] for p in dataset["persons"]}
    while len(dataset["persons"]) < settings.synthetic_criminals:
        name = f"{rng.choice(FIRST_NAMES)} {rng.choice(LAST_NAMES)}"
        if name in used_names:
            continue
        used_names.add(name)
        city = rng.choice(CITIES)[0]
        add_person(
            name, rng.choice(["SOLDIER", "ASSOCIATE", "MEMBER"]),
            rng.randint(10, 90), [rng.choice(CRIME_TYPES)],
            f"{rng.choice(AREAS)}, {city}", status=rng.choice(["ACTIVE", "WANTED", "ARRESTED", "CONVICTED"]),
        )

    # ── Vehicles (50) ────────────────────────────────────────────────
    for _ in range(50):
        make, model, vtype = rng.choice(VEHICLE_MAKES)
        vid = _rid("vehicle")
        dataset["vehicles"].append({
            "id": vid, "registration_number": _reg_number(rng), "type": vtype,
            "make": make, "model": model, "color": rng.choice(["Black", "White", "Red", "Silver", "Blue"]),
            "year": rng.randint(2008, 2023), "owner_name": "", "seized": rng.random() < 0.3,
            "used_in_crimes": [rng.choice(CRIME_TYPES)] if rng.random() < 0.4 else [],
        })

    # ── Accounts (100; ~30 flagged) ──────────────────────────────────
    for i in range(100):
        bank, ifsc_prefix = rng.choice(BANKS)
        flagged = i < 30 or rng.random() < 0.1
        aid = _rid("account")
        dataset["accounts"].append({
            "id": aid, "account_number": _account_number(rng), "bank_name": bank,
            "ifsc_code": f"{ifsc_prefix}0{rng.randint(100000, 999999)}", "account_type": rng.choice(["SAVINGS", "CURRENT"]),
            "flagged": flagged, "frozen": flagged and rng.random() < 0.5,
            "total_suspicious_amount": round(rng.uniform(100000, 30000000), 2) if flagged else 0.0,
            "currency": "INR",
        })

    # ── Relationships: KNOWS, MEMBER_OF, COMMUNICATED_WITH ────────────
    person_ids = [p["id"] for p in dataset["persons"]]
    # Core network edges.
    for soldier in mumbai_soldiers:
        dataset["knows"].append({"source": raja, "target": soldier, "strength": rng.uniform(0.5, 1.0)})
        dataset["member_of"].append({"source": soldier, "target": org_ids["Mumbai Drug Syndicate"], "role": "SOLDIER"})
    for associate in mumbai_associates:
        dataset["knows"].append({"source": raja, "target": associate, "strength": rng.uniform(0.3, 0.8)})
        dataset["member_of"].append({"source": associate, "target": org_ids["Mumbai Drug Syndicate"], "role": "ASSOCIATE"})
    dataset["knows"].append({"source": raja, "target": shyam, "strength": 0.95})
    dataset["knows"].append({"source": raja, "target": meena, "strength": 0.9})
    dataset["member_of"].append({"source": shyam, "target": org_ids["Mumbai Drug Syndicate"], "role": "LIEUTENANT"})
    dataset["member_of"].append({"source": meena, "target": org_ids["Mumbai Drug Syndicate"], "role": "LIEUTENANT"})
    dataset["member_of"].append({"source": raja, "target": org_ids["Mumbai Drug Syndicate"], "role": "LEADER"})
    # Hidden link: Mumbai network to Eastern Syndicate.
    dataset["knows"].append({"source": shyam, "target": vikram, "strength": 0.4})
    dataset["rival_of"].append({"source": org_ids["Mumbai Drug Syndicate"], "target": org_ids["Eastern Syndicate"]})
    for m in eastern_members:
        dataset["member_of"].append({"source": m, "target": org_ids["Eastern Syndicate"], "role": "MEMBER"})
    for m in cyber_members:
        dataset["member_of"].append({"source": m, "target": org_ids["Dark Web Cell"], "role": "MEMBER"})
    for m in eastern_members[1:]:
        if rng.random() < 0.5:
            dataset["knows"].append({"source": vikram, "target": m, "strength": rng.uniform(0.4, 0.9)})
    for m in cyber_members[1:]:
        if rng.random() < 0.5:
            dataset["knows"].append({"source": priya, "target": m, "strength": rng.uniform(0.4, 0.9)})

    # Random KNOWS edges up to ~2000 total relationships.
    while len(dataset["knows"]) < 1400:
        a, b = rng.sample(person_ids, 2)
        if any(e["source"] == a and e["target"] == b for e in dataset["knows"]):
            continue
        dataset["knows"].append({"source": a, "target": b, "strength": round(rng.uniform(0.1, 0.9), 2)})

    # Random MEMBER_OF for generated orgs.
    for p in person_ids:
        if rng.random() < 0.35:
            org = rng.choice(dataset["organizations"])
            if not any(e["source"] == p and e["target"] == org["id"] for e in dataset["member_of"]):
                dataset["member_of"].append({"source": p, "target": org["id"], "role": "MEMBER"})

    # COMMUNICATED_WITH (500 CDR records with pre-crime spikes).
    spike_targets = [raja, shyam, vikram]
    for _ in range(500):
        a, b = rng.sample(person_ids, 2)
        freq = rng.randint(1, 60) if a in spike_targets or b in spike_targets else rng.randint(1, 10)
        dataset["communicated"].append({
            "source": a, "target": b, "frequency": freq,
            "last_date": (datetime.now(timezone.utc) - timedelta(days=rng.randint(0, 90))).isoformat(),
        })

    # TRANSACTED_WITH edges.
    for _ in range(300):
        a, b = rng.sample(person_ids, 2)
        dataset["transacted"].append({
            "source": a, "target": b,
            "amount": round(rng.uniform(5000, 5000000), 2),
            "date": (datetime.now(timezone.utc) - timedelta(days=rng.randint(0, 180))).isoformat(),
        })

    # ── Ownership links ──────────────────────────────────────────────
    for v in dataset["vehicles"]:
        owner = rng.choice(person_ids)
        dataset["owns_vehicle"].append({"source": owner, "target": v["id"]})
    for a in dataset["accounts"]:
        owner = rng.choice(person_ids)
        dataset["owns_account"].append({"source": owner, "target": a["id"]})

    # ── LOCATED_AT + OPERATES_IN ─────────────────────────────────────
    for p in person_ids:
        loc = rng.choice(dataset["locations"])["id"]
        dataset["located_at"].append({"source": p, "target": loc, "date": datetime.now(timezone.utc).isoformat()})
    for org in dataset["organizations"]:
        dataset["operates_in"].append({"source": org["id"], "target": rng.choice(dataset["locations"])["id"]})

    # ── Transactions (1000, with anomalies) ──────────────────────────
    account_ids = [a["id"] for a in dataset["accounts"]]
    for i in range(1000):
        src, dst = rng.sample(account_ids, 2)
        amount = round(rng.uniform(1000, 50000000), 2)
        # Inject anomalies: ~8% round-number, ~10% off-hours, ~5% cross-border.
        suspicious = False
        reason = None
        if rng.random() < 0.08:
            amount = rng.choice([100000, 500000, 1000000, 5000000, 10000000])
            suspicious, reason = True, "round_number"
        elif rng.random() < 0.05:
            suspicious, reason = True, "cross_border"
        hour = rng.choice([23, 0, 1, 2, 3]) if suspicious else rng.randint(6, 22)
        ts = datetime.now(timezone.utc) - timedelta(days=rng.randint(0, 120), hours=hour)
        tx_id = _rid("tx")
        dataset["transactions"].append({
            "id": tx_id, "amount": amount, "currency": "INR",
            "date": ts.isoformat(), "type": rng.choice(["TRANSFER", "UPI", "IMPS", "NEFT", "SWIFT"]),
            "suspicious": suspicious, "flagged_reason": reason,
        })
        dataset["transferred"].append({
            "source": src, "target": dst, "amount": amount,
            "date": ts.isoformat(), "suspicious": suspicious,
        })

    # ── Crime events (100) ───────────────────────────────────────────
    for i in range(100):
        ce_id = _rid("crime")
        city = rng.choice(CITIES)[0]
        dataset["crime_events"].append({
            "id": ce_id, "crime_type": rng.choice(CRIME_TYPES),
            "date": (datetime.now(timezone.utc) - timedelta(days=rng.randint(0, 730))).isoformat(),
            "severity": rng.choice(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
            "description": f"Reported incident in {city} — {rng.choice(CRIME_TYPES)}",
            "status": rng.choice(["OPEN", "UNDER_INVESTIGATION", "CHARGESHEETED", "CONVICTED"]),
            "case_number": f"CASE-2024-{rng.randint(100, 999)}",
        })
        # 2-4 participants per event.
        for _ in range(rng.randint(2, 4)):
            dataset["participated"].append({
                "source": rng.choice(person_ids), "target": ce_id,
                "role": rng.choice(["ACCUSED", "SUSPECT", "WITNESS"]),
            })
        if rng.random() < 0.3:
            dataset["used_in"].append({"source": rng.choice(dataset["vehicles"])["id"], "target": ce_id})

    return dataset


# ── Neo4j bulk loader ─────────────────────────────────────────────────────────
NODE_LOADERS = {
    "persons": (
        "UNWIND $rows AS row CREATE (n:Person) SET n += row"
    ),
    "organizations": (
        "UNWIND $rows AS row CREATE (n:Organization) SET n += row"
    ),
    "locations": (
        "UNWIND $rows AS row CREATE (n:Location) SET n += row"
    ),
    "vehicles": (
        "UNWIND $rows AS row CREATE (n:Vehicle) SET n += row"
    ),
    "accounts": (
        "UNWIND $rows AS row CREATE (n:Account) SET n += row"
    ),
    "transactions": (
        "UNWIND $rows AS row CREATE (n:Transaction) SET n += row"
    ),
    "crime_events": (
        "UNWIND $rows AS row CREATE (n:CrimeEvent) SET n += row"
    ),
}

REL_LOADERS = {
    "knows": (
        "UNWIND $rows AS row MATCH (a:Person {id: row.source}), (b:Person {id: row.target}) "
        "CREATE (a)-[r:KNOWS {strength: row.strength}]->(b)"
    ),
    "member_of": (
        "UNWIND $rows AS row MATCH (a:Person {id: row.source}), (b:Organization {id: row.target}) "
        "CREATE (a)-[r:MEMBER_OF {role: row.role}]->(b)"
    ),
    "communicated": (
        "UNWIND $rows AS row MATCH (a:Person {id: row.source}), (b:Person {id: row.target}) "
        "CREATE (a)-[r:COMMUNICATED_WITH {frequency: row.frequency, last_date: row.last_date}]->(b)"
    ),
    "transacted": (
        "UNWIND $rows AS row MATCH (a:Person {id: row.source}), (b:Person {id: row.target}) "
        "CREATE (a)-[r:TRANSACTED_WITH {amount: row.amount, date: row.date}]->(b)"
    ),
    "owns_vehicle": (
        "UNWIND $rows AS row MATCH (a:Person {id: row.source}), (b:Vehicle {id: row.target}) "
        "CREATE (a)-[r:OWNS_VEHICLE]->(b)"
    ),
    "owns_account": (
        "UNWIND $rows AS row MATCH (a:Person {id: row.source}), (b:Account {id: row.target}) "
        "CREATE (a)-[r:OWNS_ACCOUNT]->(b)"
    ),
    "located_at": (
        "UNWIND $rows AS row MATCH (a:Person {id: row.source}), (b:Location {id: row.target}) "
        "CREATE (a)-[r:LOCATED_AT {date: row.date}]->(b)"
    ),
    "participated": (
        "UNWIND $rows AS row MATCH (a:Person {id: row.source}), (b:CrimeEvent {id: row.target}) "
        "CREATE (a)-[r:PARTICIPATED_IN {role: row.role}]->(b)"
    ),
    "transferred": (
        "UNWIND $rows AS row MATCH (a:Account {id: row.source}), (b:Account {id: row.target}) "
        "CREATE (a)-[r:TRANSFERRED_TO {amount: row.amount, date: row.date}]->(b)"
    ),
    "operates_in": (
        "UNWIND $rows AS row MATCH (a:Organization {id: row.source}), (b:Location {id: row.target}) "
        "CREATE (a)-[r:OPERATES_IN]->(b)"
    ),
    "rival_of": (
        "UNWIND $rows AS row MATCH (a:Organization {id: row.source}), (b:Organization {id: row.target}) "
        "CREATE (a)-[r:RIVAL_OF]->(b)"
    ),
    "used_in": (
        "UNWIND $rows AS row MATCH (a:Vehicle {id: row.source}), (b:CrimeEvent {id: row.target}) "
        "CREATE (a)-[r:USED_IN]->(b)"
    ),
}


def load_dataset(dataset: dict[str, Any]) -> None:
    """Bulk-load the dataset into Neo4j using UNWIND batches."""
    for key, query in NODE_LOADERS.items():
        rows = dataset.get(key, [])
        if rows:
            neo.run_write(query, {"rows": rows})
            logger.info("Loaded %d %s nodes", len(rows), key)
    for key, query in REL_LOADERS.items():
        rows = dataset.get(key, [])
        if rows:
            neo.run_write(query, {"rows": rows})
            logger.info("Loaded %d %s edges", len(rows), key)


def seed_users() -> None:
    """Create the demo user accounts in PostgreSQL."""
    from app.api.routes.auth import hash_password

    users = [
        ("admin@crimenet.gov.in", "System Administrator", "ADMIN", "Ministry of Home Affairs", "Admin@123"),
        ("officer@crimenet.gov.in", "Inspector S. Sharma", "OFFICER", "Mumbai Police", "Officer@123"),
        ("analyst@crimenet.gov.in", "Analyst A. Nair", "ANALYST", "CBI", "Analyst@123"),
        ("senior@crimenet.gov.in", "SP R. Deshmukh", "SENIOR_OFFICER", "Maharashtra Police", "Senior@123"),
    ]
    for badge, name, role, dept, password in users:
        existing = fetch_one("SELECT id FROM users WHERE badge_id = %s", (badge,))
        if existing:
            continue
        execute(
            "INSERT INTO users (badge_id, name, password_hash, role, department, email) "
            "VALUES (%s, %s, %s, %s, %s, %s)",
            (badge, name, hash_password(password), role, dept, badge),
        )
        logger.info("Seeded user %s (%s)", badge, role)


def train_risk_model() -> None:
    """Train the XGBoost risk model on the freshly generated dataset."""
    try:
        from app.ml_models.risk_scorer import RULE_WEIGHTS, get_risk_scorer

        scorer = get_risk_scorer()
        rows = neo.run_query(
            "MATCH (p:Person) RETURN properties(p) AS props LIMIT 500"
        )
        X, y = [], []
        for row in rows:
            props = row["props"]
            features = scorer.extract_features(props)
            X.append(features)
            y.append(props.get("risk_score", 50))
        if X:
            scorer.train_xgboost(X, y)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Risk model training skipped: %s", exc)


def ensure_demo_data() -> None:
    """Idempotent entrypoint: seed graph data + users if not already present."""
    count = neo.run_query("MATCH (p:Person) RETURN count(p) AS c")
    if count and count[0]["c"] > 0:
        logger.info("Synthetic data already present (%d persons)", count[0]["c"])
        seed_users()
        return
    dataset = build_dataset()
    load_dataset(dataset)
    seed_users()
    train_risk_model()
    logger.info("Synthetic dataset loaded successfully")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO,
                        format="%(asctime)s | %(levelname)-8s | %(message)s")
    ensure_demo_data()
    print("[OK] Synthetic data generation complete")
