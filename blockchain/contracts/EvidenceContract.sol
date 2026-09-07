// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title EvidenceContract
 * @notice Makes all investigative evidence tamper-proof.
 *
 * Stores the SHA-256 fingerprint (bytes32) of every evidence file on-chain
 * together with its IPFS CID. Anyone can verify a file against the immutable
 * record — the court can therefore prove whether evidence was altered.
 *
 * Access control:
 *   * only registered officers may add evidence
 *   * only senior officers may mark evidence court-admissible
 *   * anyone (public) may verify evidence integrity
 */
contract EvidenceContract {
    /// A single evidence record.
    struct Evidence {
        string evidenceId;      // unique business id (e.g. EV-2024-001)
        bytes32 fileHash;       // SHA-256 of the file contents
        string ipfsHash;        // IPFS CID where the file is stored
        string criminalId;      // linked criminal
        string caseNumber;      // case reference
        address uploadedBy;     // officer wallet address
        string officerBadgeId;  // officer badge number
        uint256 timestamp;      // block timestamp
        string evidenceType;    // photo | video | document | audio
        string description;
        bool isValid;
        bool courtAdmissible;
    }

    mapping(string => Evidence) private evidences;               // evidenceId => record
    mapping(string => string[]) private evidenceIdsByCase;       // caseNumber => ids
    mapping(string => string[]) private evidenceIdsByCriminal;   // criminalId => ids
    mapping(address => bool) public authorizedOfficers;          // may add evidence
    mapping(address => bool) public seniorOfficers;              // may mark admissible

    uint256 public totalEvidenceCount;

    event EvidenceAdded(
        string evidenceId,
        bytes32 fileHash,
        address officerAddress,
        uint256 timestamp
    );
    event EvidenceVerified(string evidenceId, bool verified, address checkedBy);
    event EvidenceInvalidated(string evidenceId, string reason, address invalidatedBy);
    event MarkedCourtAdmissible(string evidenceId, address markedBy);

    modifier onlyOfficer() {
        require(authorizedOfficers[msg.sender], "Not an authorized officer");
        _;
    }

    modifier onlySeniorOfficer() {
        require(seniorOfficers[msg.sender], "Not a senior officer");
        _;
    }

    constructor() {
        // The deployer is registered as both officer and senior officer.
        authorizedOfficers[msg.sender] = true;
        seniorOfficers[msg.sender] = true;
    }

    /// Register an officer allowed to submit evidence.
    function registerOfficer(address officer) external onlySeniorOfficer {
        authorizedOfficers[officer] = true;
    }

    /// Promote an officer to senior (court-admissible marking rights).
    function promoteSeniorOfficer(address officer) external onlySeniorOfficer {
        seniorOfficers[officer] = true;
    }

    /// Store a new evidence fingerprint on chain.
    function addEvidence(
        string calldata evidenceId,
        bytes32 fileHash,
        string calldata ipfsHash,
        string calldata criminalId,
        string calldata caseNumber,
        string calldata officerBadgeId,
        string calldata evidenceType,
        string calldata description
    ) external onlyOfficer {
        require(bytes(evidenceId).length > 0, "Empty evidence id");
        require(bytes(evidences[evidenceId].evidenceId).length == 0, "Evidence already exists");

        evidences[evidenceId] = Evidence({
            evidenceId: evidenceId,
            fileHash: fileHash,
            ipfsHash: ipfsHash,
            criminalId: criminalId,
            caseNumber: caseNumber,
            uploadedBy: msg.sender,
            officerBadgeId: officerBadgeId,
            timestamp: block.timestamp,
            evidenceType: evidenceType,
            description: description,
            isValid: true,
            courtAdmissible: false
        });

        evidenceIdsByCase[caseNumber].push(evidenceId);
        evidenceIdsByCriminal[criminalId].push(evidenceId);
        totalEvidenceCount += 1;

        emit EvidenceAdded(evidenceId, fileHash, msg.sender, block.timestamp);
    }

    /**
     * Verify a file against the immutable on-chain hash.
     * Returns (verified, message, originalTimestamp).
     */
    function verifyEvidence(
        string calldata evidenceId,
        bytes32 checkHash
    )
        external
        view
        returns (bool verified, string memory message, uint256 originalTimestamp)
    {
        Evidence storage ev = evidences[evidenceId];
        if (bytes(ev.evidenceId).length == 0) {
            return (false, "NOT FOUND - NO BLOCKCHAIN RECORD", 0);
        }
        if (!ev.isValid) {
            return (false, "INVALIDATED - RECORD REVOKED", ev.timestamp);
        }
        if (ev.fileHash == checkHash) {
            return (true, "VERIFIED - NOT TAMPERED", ev.timestamp);
        }
        return (false, "TAMPERED - HASH MISMATCH", ev.timestamp);
    }

    /// Return the full evidence struct.
    function getEvidence(string calldata evidenceId)
        external
        view
        returns (Evidence memory)
    {
        return evidences[evidenceId];
    }

    /// Mark evidence as court-admissible (senior officers only).
    function markCourtAdmissible(string calldata evidenceId) external onlySeniorOfficer {
        require(bytes(evidences[evidenceId].evidenceId).length > 0, "Evidence not found");
        evidences[evidenceId].courtAdmissible = true;
        emit MarkedCourtAdmissible(evidenceId, msg.sender);
    }

    /// Invalidate an evidence record (senior officers only).
    function invalidateEvidence(
        string calldata evidenceId,
        string calldata reason
    ) external onlySeniorOfficer {
        require(bytes(evidences[evidenceId].evidenceId).length > 0, "Evidence not found");
        evidences[evidenceId].isValid = false;
        emit EvidenceInvalidated(evidenceId, reason, msg.sender);
    }

    /// All evidence ids for a case number.
    function getEvidencesByCase(string calldata caseNumber)
        external
        view
        returns (Evidence[] memory)
    {
        string[] memory ids = evidenceIdsByCase[caseNumber];
        Evidence[] memory result = new Evidence[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            result[i] = evidences[ids[i]];
        }
        return result;
    }

    /// All evidence ids for a criminal.
    function getEvidencesByCriminal(string calldata criminalId)
        external
        view
        returns (Evidence[] memory)
    {
        string[] memory ids = evidenceIdsByCriminal[criminalId];
        Evidence[] memory result = new Evidence[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            result[i] = evidences[ids[i]];
        }
        return result;
    }
}
