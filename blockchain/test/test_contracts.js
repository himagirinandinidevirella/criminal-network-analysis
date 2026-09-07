// CrimeNet AI — Smart contract unit tests.
//
// Verifies the evidence integrity flow end-to-end on a local Hardhat chain:
//   1. an officer adds evidence
//   2. the correct file hash verifies as INTACT
//   3. a tampered hash is rejected
//   4. only senior officers can mark evidence court-admissible
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("EvidenceContract", function () {
  let evidence;
  let owner, officer, senior;

  const FILE_HASH = ethers.keccak256(ethers.toUtf8Bytes("evidence-file-A"));
  const TAMPERED_HASH = ethers.keccak256(ethers.toUtf8Bytes("tampered-file"));

  beforeEach(async function () {
    [owner, officer, senior] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("EvidenceContract");
    evidence = await Factory.deploy();
    await evidence.waitForDeployment();
    // Register a second officer and a senior officer.
    await evidence.registerOfficer(officer.address);
    await evidence.promoteSeniorOfficer(senior.address);
  });

  it("stores evidence and verifies the correct hash", async function () {
    await evidence
      .connect(officer)
      .addEvidence(
        "EV-001",
        FILE_HASH,
        "QmIPFS123",
        "CR-001",
        "CASE-2024-001",
        "B-4521",
        "photo",
        "Seized device photo"
      );

    const [verified, message] = await evidence.verifyEvidence("EV-001", FILE_HASH);
    expect(verified).to.equal(true);
    expect(message).to.equal("VERIFIED - NOT TAMPERED");
  });

  it("rejects a tampered hash", async function () {
    await evidence
      .connect(officer)
      .addEvidence(
        "EV-002",
        FILE_HASH,
        "QmIPFS456",
        "CR-001",
        "CASE-2024-001",
        "B-4521",
        "document",
        "Confession statement"
      );

    const [verified, message] = await evidence.verifyEvidence("EV-002", TAMPERED_HASH);
    expect(verified).to.equal(false);
    expect(message).to.equal("TAMPERED - HASH MISMATCH");
  });

  it("only senior officers may mark evidence court-admissible", async function () {
    await evidence
      .connect(officer)
      .addEvidence(
        "EV-003",
        FILE_HASH,
        "QmIPFS789",
        "CR-001",
        "CASE-2024-001",
        "B-4521",
        "audio",
        "Intercepted call"
      );

    // A regular officer cannot mark court-admissible.
    await expect(
      evidence.connect(officer).markCourtAdmissible("EV-003")
    ).to.be.revertedWith("Not a senior officer");

    // A senior officer can.
    await evidence.connect(senior).markCourtAdmissible("EV-003");
    const stored = await evidence.getEvidence("EV-003");
    expect(stored.courtAdmissible).to.equal(true);
  });
});

describe("CriminalRecordContract", function () {
  it("detects data tampering via hash comparison", async function () {
    const [owner] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("CriminalRecordContract");
    const record = await Factory.deploy();
    await record.waitForDeployment();

    const original = ethers.keccak256(ethers.toUtf8Bytes('{"risk_score":95}'));
    const tampered = ethers.keccak256(ethers.toUtf8Bytes('{"risk_score":20}'));

    await record.createRecord("CR-001", original);
    expect(await record.verifyCurrentData("CR-001", original)).to.equal(true);
    expect(await record.verifyCurrentData("CR-001", tampered)).to.equal(false);
  });
});

describe("AgencyShareContract", function () {
  it("grants time-boxed access and records access checks", async function () {
    const [owner] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("AgencyShareContract");
    const share = await Factory.deploy();
    await share.waitForDeployment();

    const dataHash = ethers.keccak256(ethers.toUtf8Bytes('{"case":"CASE-1"}'));

    // STATE_POLICE=0, CBI=1, READ_ONLY=0
    const tx = await share.grantAccess(
      "CASE-1",
      "CASE",
      1, // toAgency = CBI
      0, // fromAgency = STATE_POLICE
      0, // accessLevel = READ_ONLY
      48,
      dataHash,
      "Joint investigation"
    );
    const receipt = await tx.wait();

    // Extract the permission id from the AccessGranted event.
    const event = receipt.logs
      .map((log) => {
        try {
          return share.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((parsed) => parsed && parsed.name === "AccessGranted");
    expect(event).to.not.be.undefined;

    const [hasAccess] = await share.checkAccess(event.args.permissionId);
    expect(hasAccess).to.equal(true);

    await share.logAccess(event.args.permissionId);
    await share.revokeAccess(event.args.permissionId, "Investigation complete");
    const [stillHasAccess] = await share.checkAccess(event.args.permissionId);
    expect(stillHasAccess).to.equal(false);
  });
});
