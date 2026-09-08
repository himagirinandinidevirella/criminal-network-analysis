/** Deterministic, entirely fictional records. No real police or banking data. */
import type { Criminal, CriminalStatus } from "@/types/criminal.types";
import type { DemoState } from "./types";

export const DEMO_NOTICE =
  "SYNTHETIC DEMO ONLY. All people, records and risk scores are fictional. Not evidence, a prediction, or a basis for decisions about real people.";
export const DEMO_ACCOUNTS = [
  {
    id: "admin",
    badge_id: "admin@crimenet.gov.in",
    password: "Admin@123",
    name: "Demo Administrator",
    role: "ADMIN",
  },
  {
    id: "officer",
    badge_id: "officer@crimenet.gov.in",
    password: "Officer@123",
    name: "Demo Officer",
    role: "OFFICER",
  },
  {
    id: "analyst",
    badge_id: "analyst@crimenet.gov.in",
    password: "Analyst@123",
    name: "Demo Analyst",
    role: "ANALYST",
  },
  {
    id: "senior",
    badge_id: "senior@crimenet.gov.in",
    password: "Senior@123",
    name: "Demo Senior Officer",
    role: "SENIOR_OFFICER",
  },
] as const;

export function seedDemoState(now = new Date()): DemoState {
  const state: DemoState = {
    version: 1,
    cctv_trails: [],
    people: [],
    organizations: [],
    locations: [],
    vehicles: [],
    accounts: [],
    crimes: [],
    transactions: [],
    edges: [],
    alerts: [],
    rules: [],
    notes: [],
    evidence: [],
    audit: [],
    reports: [],
    shares: [],
  };
  const crimeTypes = [
    "Drug Trafficking",
    "Money Laundering",
    "Cyber Crime",
    "Extortion",
    "Robbery",
  ];
  state.locations = [
    {
      id: "loc-mumbai",
      name: "Dharavi, Mumbai",
      city: "Mumbai",
      state: "Maharashtra",
      latitude: 19.04,
      longitude: 72.85,
    },
    {
      id: "loc-delhi",
      name: "Karol Bagh, Delhi",
      city: "Delhi",
      state: "Delhi",
      latitude: 28.65,
      longitude: 77.19,
    },
    {
      id: "loc-kolkata",
      name: "Salt Lake, Kolkata",
      city: "Kolkata",
      state: "West Bengal",
      latitude: 22.58,
      longitude: 88.42,
    },
    {
      id: "loc-chennai",
      name: "T. Nagar, Chennai",
      city: "Chennai",
      state: "Tamil Nadu",
      latitude: 13.04,
      longitude: 80.23,
    },
    {
      id: "loc-hyderabad",
      name: "Banjara Hills, Hyderabad",
      city: "Hyderabad",
      state: "Telangana",
      latitude: 17.41,
      longitude: 78.44,
    },
    {
      id: "loc-bengaluru",
      name: "Whitefield, Bengaluru",
      city: "Bengaluru",
      state: "Karnataka",
      latitude: 12.97,
      longitude: 77.75,
    },
  ];
  state.organizations = [
    {
      id: "org-mumbai",
      name: "Mumbai Drug Syndicate",
      crime_types: [crimeTypes[0], crimeTypes[1]],
    },
    {
      id: "org-eastern",
      name: "Eastern Syndicate",
      crime_types: [crimeTypes[3], crimeTypes[4]],
    },
    {
      id: "org-cyber",
      name: "Dark Web Cell",
      crime_types: [crimeTypes[2], crimeTypes[1]],
    },
    {
      id: "org-coastal",
      name: "Coastal Logistics",
      crime_types: [crimeTypes[1], crimeTypes[4]],
    },
  ];
  const names = [
    "Raja Khan",
    "Shyam Verma",
    "Meena Patil",
    "Vikram Rao",
    "Priya Hacker",
    "Arjun Desai",
    "Kavya Sen",
    "Rohan Mehta",
    "Nisha Iyer",
    "Dev Kapoor",
    "Anil Sethi",
    "Tara Bose",
    "Kiran Nair",
    "Maya Das",
    "Aman Kulkarni",
    "Leela Shah",
    "Kabir Joshi",
    "Asha Menon",
    "Ravi Malhotra",
    "Neha Dutta",
    "Suraj Bhat",
    "Pooja Rao",
    "Aditya Paul",
    "Sana Mirza",
    "Varun Sinha",
    "Isha Verma",
    "Nikhil Reddy",
    "Diya Ghosh",
    "Sameer Roy",
    "Ritu Jain",
    "Akash Yadav",
    "Ananya Suri",
    "Vivek Kamat",
    "Mira Arora",
    "Rahul Bedi",
    "Sonia Lal",
    "Rohit Nath",
    "Rhea Kumar",
    "Manav Saha",
    "Simran Gill",
  ];
  const ids = names.map((name) => name.toLowerCase().replace(/ /g, "-"));
  const leaders = [ids[0], ids[3], ids[4], ids[7]];
  const groupOf = (i: number) =>
    i < 3 ? 0 : i === 3 ? 1 : i === 4 ? 2 : i % 4;
  const statuses: CriminalStatus[] = [
    "UNDER_INVESTIGATION",
    "WANTED",
    "ARRESTED",
    "CONVICTED",
    "RELEASED",
  ];
  state.people = names.map(
    (name, i): Criminal => ({
      id: ids[i],
      name,
      aliases:
        i === 0
          ? ["RK", "Raja Bhai"]
          : i === 4
            ? ["Cipher"]
            : [`Demo subject ${i + 1}`],
      age: i === 0 ? 38 : 23 + ((i * 7) % 30),
      nationality: "Indian",
      gender: "Not recorded",
      address: state.locations[i < 3 ? 0 : i % 6].name,
      criminal_id: `DEMO-${String(i + 1).padStart(3, "0")}`,
      risk_score: [95, 88, 82, 86, 78][i] ?? 12 + ((i * 17) % 78),
      crime_types: [...state.organizations[groupOf(i)].crime_types],
      status: statuses[i % statuses.length],
      verified: i % 7 === 0,
      important_flag: i === 0,
      created_at: "2026-01-10T09:00:00.000Z",
      updated_at: "2026-08-24T09:00:00.000Z",
      synthetic: true,
    }),
  );
  const edge = (
    source: string,
    target: string,
    type: string,
    strength = 0.6,
  ) => {
    const id = `${source}:${type}:${target}`;
    if (source !== target && !state.edges.some((e) => e.data.id === id)) {
      state.edges.push({
        data: {
          id,
          source,
          target,
          type,
          label: type.replace(/_/g, " "),
          strength,
        },
      });
    }
  };
  state.people.forEach((person, i) => {
    const group = groupOf(i);
    edge(person.id, state.organizations[group].id, "MEMBER_OF", 0.8);
    edge(person.id, state.locations[i < 3 ? 0 : i % 6].id, "LOCATED_AT", 0.5);
    edge(
      leaders[group],
      person.id,
      i % 2 ? "COMMUNICATED_WITH" : "KNOWS",
      0.5 + (i % 5) / 10,
    );
  });
  edge(ids[0], ids[2], "TRANSACTED_WITH", 0.95);
  edge(ids[2], ids[3], "COMMUNICATED_WITH", 0.75);
  edge(ids[3], ids[4], "KNOWS", 0.65);
  edge(ids[4], ids[7], "TRANSACTED_WITH", 0.7);

  state.vehicles = Array.from({ length: 8 }, (_, i) => ({
    id: `vehicle-${i + 1}`,
    registration_number: i === 0 ? "MH-01-AX-9999" : `DEMO-MH-${1000 + i}`,
    type: i % 2 ? "VAN" : "CAR",
    make: i === 0 ? "BMW" : "Demo Motors",
    model: "Sample",
    color: i % 2 ? "White" : "Black",
    year: 2021 + (i % 4),
    owner_id: ids[i],
    owner_name: names[i],
    seized: i % 3 === 0,
    used_in_crimes: [crimeTypes[i % 5]],
  }));
  state.vehicles.forEach((v) => edge(v.owner_id, v.id, "OWNS_VEHICLE"));
  state.accounts = Array.from({ length: 12 }, (_, i) => ({
    id: `account-${i + 1}`,
    account_number: i === 0 ? "XXXX1234" : `DEMO-XXXX${2000 + i}`,
    bank_name: i === 0 ? "State Bank of India (fictional record)" : "Demo Bank",
    ifsc_code: "DEMO0000000",
    account_type: i % 2 ? "CURRENT" : "SAVINGS",
    flagged: i < 4,
    frozen: i === 2,
    total_suspicious_amount: i === 0 ? 4500000 : i < 4 ? 750000 * i : 0,
    currency: "INR",
    owner_id: ids[i],
  }));
  state.accounts.forEach((a) => edge(a.owner_id, a.id, "OWNS_ACCOUNT"));
  state.crimes = Array.from({ length: 18 }, (_, i) => ({
    id: `case-${i + 1}`,
    case_number: `DEMO/2026/${String(i + 1).padStart(3, "0")}`,
    crime_type: crimeTypes[i % 5],
    date: `2026-08-${String(28 - i).padStart(2, "0")}T10:00:00.000Z`,
    severity: i % 3 === 0 ? "HIGH" : "MEDIUM",
    status: i % 4 === 0 ? "CLOSED" : "OPEN",
    description:
      "Fictional case created for the Operation Mumbai software demonstration.",
    person_ids: [ids[i % 5], ids[5 + i]],
    location_id: state.locations[i % 6].id,
  }));
  state.crimes.forEach((c) => {
    c.person_ids.forEach((id) => edge(id, c.id, "PARTICIPATED_IN"));
    edge(c.id, c.location_id, "LOCATED_AT");
  });
  state.transactions = Array.from({ length: 24 }, (_, i) => ({
    id: `transaction-${i + 1}`,
    name: `Demo transfer ${i + 1}`,
    from_account: state.accounts[i % 12].id,
    to_account: state.accounts[(i + 1) % 12].id,
    amount: i === 0 ? 4500000 : 15000 + i * 12000,
    currency: "INR",
    date: `2026-08-${String(28 - i).padStart(2, "0")}T12:00:00.000Z`,
    flagged: i % 6 === 0,
  }));
  state.transactions.forEach((t) => {
    edge(t.from_account, t.id, "TRANSFERRED_TO");
    edge(t.id, t.to_account, "TRANSFERRED_TO");
  });
  state.alerts = [
    {
      title: "Unusual transfer in the Mumbai network",
      severity: "CRITICAL",
      category: "FINANCIAL",
      description:
        "A fictional INR 45,00,000 transfer exceeds the sample threshold. Review the linked account records.",
    },
    {
      title: "Cross-network contact identified",
      severity: "HIGH",
      category: "COMMUNICATION",
      description:
        "Meena Patil and Vikram Rao share a communication edge in the synthetic graph.",
    },
    {
      title: "Flagged account requires review",
      severity: "HIGH",
      category: "FINANCIAL",
      description:
        "A sample account has an unresolved review flag. No real financial activity is being monitored.",
    },
    {
      title: "New connection in Dark Web Cell",
      severity: "MEDIUM",
      category: "NETWORK",
      description: "An example relationship was added to the seeded network.",
    },
    {
      title: "Location record updated",
      severity: "LOW",
      category: "LOCATION",
      description: "A synthetic location record is ready for review.",
    },
  ].map((a, i) => ({
    ...a,
    severity: a.severity as "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
    id: i + 1,
    criminal_id: ids[[0, 2, 2, 4, 3][i]],
    criminal_name: names[[0, 2, 2, 4, 3][i]],
    source: "Synthetic fixture",
    status: "ACTIVE",
    created_at: new Date(now.getTime() - (i + 1) * 15 * 60000).toISOString(),
  }));
  state.rules = [
    {
      id: 1,
      rule_name: "FINANCIAL_SPIKE",
      conditions_json: JSON.stringify({ threshold: 1000000 }),
      active: true,
      created_by: "Demo Administrator",
    },
  ];
  return state;
}
