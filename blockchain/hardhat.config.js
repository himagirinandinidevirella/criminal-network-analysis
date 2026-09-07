// CrimeNet AI — Hardhat configuration.
// Compiles and deploys the five CrimeNet smart contracts to a local Ganache
// node (chain id 1337) or the Goerli testnet for public demos.
require("@nomicfoundation/hardhat-toolbox");

const { mnemonic } = require("./secrets.json");

// Well-known Ganache/Hardhat development mnemonic (matches docker-compose
// `ganache` and `npx ganache` defaults so deploy accounts are funded).
const GANACHE_MNEMONIC =
  "test test test test test test test test test test test junk";

const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";

module.exports = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      // viaIR avoids "stack too deep" for struct-heavy contracts.
      viaIR: true,
    },
  },
  networks: {
    // Local Ganache / hardhat node (docker-compose `ganache` service).
    localhost: {
      url: "http://localhost:8545",
      chainId: 1337,
      accounts: {
        mnemonic: GANACHE_MNEMONIC,
      },
    },
    hardhat: {
      chainId: 1337,
      accounts: {
        mnemonic: GANACHE_MNEMONIC,
      },
    },
    goerli: {
      url: process.env.GOERLI_RPC_URL || "https://goerli.infura.io/v3/",
      chainId: 5,
      accounts: {
        mnemonic: mnemonic || "",
      },
    },
  },
  gasReporter: {
    enabled: false,
  },
  etherscan: {
    apiKey: ETHERSCAN_API_KEY,
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    artifacts: "./artifacts",
  },
};
