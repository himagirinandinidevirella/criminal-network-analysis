// CrimeNet AI — Contract verification on Etherscan.
//
// Verifies the five CrimeNet contracts on a public network (Goerli) so judges
// can inspect the source on Etherscan. Requires ETHERSCAN_API_KEY.
//
// Usage:  ETHERSCAN_API_KEY=... npx hardhat run scripts/verify.js --network goerli
const fs = require("fs");
const path = require("path");

const CONTRACTS = [
  { name: "AuditContract", key: "audit" },
  { name: "EvidenceContract", key: "evidence" },
  { name: "CriminalRecordContract", key: "criminal_record" },
  { name: "ReportContract", key: "report" },
  { name: "AgencyShareContract", key: "agency_share" },
];

async function main() {
  const deployedFile = path.join(__dirname, "..", "deployed_contracts.json");
  if (!fs.existsSync(deployedFile)) {
    console.error("deployed_contracts.json not found — run deploy.js first.");
    process.exit(1);
  }
  const deployed = JSON.parse(fs.readFileSync(deployedFile, "utf8"));
  console.log("Verifying contracts on", deployed.network, "…\n");

  for (const { name, key } of CONTRACTS) {
    const address = deployed.contracts[key].address;
    if (!address) {
      console.warn(`⚠️  ${name}: no address, skipping`);
      continue;
    }
    try {
      await run("verify:verify", {
        address,
        constructorArguments: [],
      });
      console.log(`✅ ${name} verified at ${address}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("Already Verified")) {
        console.log(`✅ ${name} already verified at ${address}`);
      } else {
        console.warn(`⚠️  ${name} verification failed: ${message}`);
      }
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
