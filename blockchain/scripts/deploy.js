// CrimeNet AI — Smart contract deployment script.
//
// Deploys all five contracts in order and writes:
//   1. blockchain/deployed_contracts.json  (addresses + ABIs, consumed by backend)
//   2. frontend/src/contracts/contracts.json (addresses + minimal ABIs for UI)
//
// Usage:  npx hardhat run scripts/deploy.js --network localhost
const fs = require("fs");
const path = require("path");

// Read a compiled artifact's JSON ABI (web3.py consumes the standard ABI form).
function abiOf(name) {
  const artifactPath = path.join(
    __dirname,
    "..",
    "artifacts",
    "contracts",
    `${name}.sol`,
    `${name}.json`
  );
  return JSON.parse(fs.readFileSync(artifactPath, "utf8")).abi;
}

async function main() {
  console.log("⛓️  CrimeNet AI — deploying smart contracts…\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying from:", deployer.address);
  console.log(
    "Balance:",
    ethers.formatEther(await ethers.provider.getBalance(deployer.address)),
    "ETH\n"
  );

  // 1. AuditContract
  const AuditContract = await ethers.getContractFactory("AuditContract");
  const audit = await AuditContract.deploy();
  await audit.waitForDeployment();
  console.log("✅ AuditContract          deployed at", await audit.getAddress());

  // 2. EvidenceContract
  const EvidenceContract = await ethers.getContractFactory("EvidenceContract");
  const evidence = await EvidenceContract.deploy();
  await evidence.waitForDeployment();
  console.log("✅ EvidenceContract       deployed at", await evidence.getAddress());

  // 3. CriminalRecordContract
  const CriminalRecordContract = await ethers.getContractFactory(
    "CriminalRecordContract"
  );
  const criminalRecord = await CriminalRecordContract.deploy();
  await criminalRecord.waitForDeployment();
  console.log("✅ CriminalRecordContract deployed at", await criminalRecord.getAddress());

  // 4. ReportContract
  const ReportContract = await ethers.getContractFactory("ReportContract");
  const report = await ReportContract.deploy();
  await report.waitForDeployment();
  console.log("✅ ReportContract         deployed at", await report.getAddress());

  // 5. AgencyShareContract
  const AgencyShareContract = await ethers.getContractFactory("AgencyShareContract");
  const agencyShare = await AgencyShareContract.deploy();
  await agencyShare.waitForDeployment();
  console.log("✅ AgencyShareContract    deployed at", await agencyShare.getAddress());

  // ── Assemble deployment metadata ────────────────────────────────────────────
  const deployed = {
    network: "ganache-local",
    chainId: 1337,
    deployedAt: new Date().toISOString(),
    contracts: {
      audit: { address: await audit.getAddress(), abi: abiOf("AuditContract") },
      evidence: { address: await evidence.getAddress(), abi: abiOf("EvidenceContract") },
      criminal_record: { address: await criminalRecord.getAddress(), abi: abiOf("CriminalRecordContract") },
      report: { address: await report.getAddress(), abi: abiOf("ReportContract") },
      agency_share: { address: await agencyShare.getAddress(), abi: abiOf("AgencyShareContract") },
    },
  };

  // ── 1. Save full deployment file (backend + frontend) ───────────────────────
  const outFile = path.join(__dirname, "..", "deployed_contracts.json");
  fs.writeFileSync(outFile, JSON.stringify(deployed, null, 2));
  console.log("\n📦 Saved deployment metadata →", outFile);

  // ── 2. Save minimal frontend copy (addresses only) ─────────────────────────
  const frontendDir = path.join(
    __dirname,
    "..",
    "..",
    "frontend",
    "src",
    "contracts"
  );
  fs.mkdirSync(frontendDir, { recursive: true });
  const frontendFile = path.join(frontendDir, "contracts.json");
  fs.writeFileSync(
    frontendFile,
    JSON.stringify(
      {
        network: deployed.network,
        chainId: deployed.chainId,
        contracts: {
          audit: deployed.contracts.audit.address,
          evidence: deployed.contracts.evidence.address,
          criminal_record: deployed.contracts.criminal_record.address,
          report: deployed.contracts.report.address,
          agency_share: deployed.contracts.agency_share.address,
        },
      },
      null,
      2
    )
  );
  console.log("📦 Saved frontend contract addresses →", frontendFile);

  console.log("\n🎉 Deployment complete!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("⛓️  Blockchain Explorer: http://localhost/blockchain");
  console.log("🔒 Ganache Dashboard:   http://localhost:8545");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
