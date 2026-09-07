// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title CriminalRecordContract
 * @notice Immutable criminal-record change history.
 *
 * Every change to a criminal record (risk score, arrest, conviction, release,
 * profile edit) is appended to an append-only history with the previous and
 * new values, a data hash, and the acting officer. Any party can verify the
 * current database record against the latest on-chain hash to detect tampering.
 */
contract CriminalRecordContract {
    /// One immutable update in a criminal's history.
    struct RecordUpdate {
        uint256 updateId;
        string criminalId;
        string updateType;    // ARREST | RISK_SCORE | CONVICTION | RELEASE | PROFILE
        string previousValue; // JSON of previous state
        string newValue;      // JSON of new state
        address updatedBy;
        string officerBadgeId;
        uint256 timestamp;
        string reason;
        bytes32 dataHash;     // hash of the complete record at this point
        bool isVerified;
    }

    /// Current on-chain state of a criminal record.
    struct CriminalRecord {
        string criminalId;
        bytes32 currentDataHash;
        uint256 createdAt;
        uint256 lastUpdated;
        uint256 updateCount;
        bool isActive;
        bool highRisk;
    }

    mapping(string => CriminalRecord) private records;           // criminalId => state
    mapping(string => RecordUpdate[]) private history;           // criminalId => updates
    mapping(address => bool) public authorizedOfficers;

    uint256 public totalRecords;
    uint256 private nextUpdateId;

    event RecordCreated(string criminalId, bytes32 dataHash, address createdBy);
    event RecordUpdated(string criminalId, string updateType, address officer, uint256 timestamp);
    event RecordVerified(string criminalId, bool isIntact);
    event HighRiskFlagged(string criminalId, address flaggedBy);
    event RecordDeactivated(string criminalId, string reason);

    modifier onlyOfficer() {
        require(authorizedOfficers[msg.sender], "Not an authorized officer");
        _;
    }

    constructor() {
        authorizedOfficers[msg.sender] = true;
    }

    function registerOfficer(address officer) external onlyOfficer {
        authorizedOfficers[officer] = true;
    }

    /// Initialise a criminal record on chain.
    function createRecord(string calldata criminalId, bytes32 dataHash)
        external
        onlyOfficer
    {
        require(bytes(records[criminalId].criminalId).length == 0, "Record already exists");
        records[criminalId] = CriminalRecord({
            criminalId: criminalId,
            currentDataHash: dataHash,
            createdAt: block.timestamp,
            lastUpdated: block.timestamp,
            updateCount: 0,
            isActive: true,
            highRisk: false
        });
        totalRecords += 1;
        emit RecordCreated(criminalId, dataHash, msg.sender);
    }

    /// Append an update to the immutable history.
    function updateRecord(
        string calldata criminalId,
        string calldata updateType,
        string calldata previousValue,
        string calldata newValue,
        string calldata reason,
        bytes32 newHash
    ) external onlyOfficer {
        require(bytes(records[criminalId].criminalId).length > 0, "Record not found");
        require(records[criminalId].isActive, "Record deactivated");

        nextUpdateId += 1;
        history[criminalId].push(
            RecordUpdate({
                updateId: nextUpdateId,
                criminalId: criminalId,
                updateType: updateType,
                previousValue: previousValue,
                newValue: newValue,
                updatedBy: msg.sender,
                officerBadgeId: "",
                timestamp: block.timestamp,
                reason: reason,
                dataHash: newHash,
                isVerified: true
            })
        );

        records[criminalId].currentDataHash = newHash;
        records[criminalId].lastUpdated = block.timestamp;
        records[criminalId].updateCount += 1;

        emit RecordUpdated(criminalId, updateType, msg.sender, block.timestamp);
    }

    /// Full append-only history for a criminal.
    function getFullHistory(string calldata criminalId)
        external
        view
        returns (RecordUpdate[] memory)
    {
        return history[criminalId];
    }

    /// Current on-chain data hash for a criminal.
    function getLatestHash(string calldata criminalId)
        external
        view
        returns (bytes32)
    {
        return records[criminalId].currentDataHash;
    }

    /// Verify that a provided hash matches the on-chain hash (data intact?).
    function verifyCurrentData(string calldata criminalId, bytes32 checkHash)
        external
        view
        returns (bool isIntact)
    {
        CriminalRecord storage rec = records[criminalId];
        if (bytes(rec.criminalId).length == 0) {
            return false;
        }
        bool intact = rec.isActive && rec.currentDataHash == checkHash;
        // Cannot emit events from a view function; the frontend derives the flag.
        return intact;
    }

    /// Flag a record as high risk on chain.
    function markHighRisk(string calldata criminalId) external onlyOfficer {
        require(bytes(records[criminalId].criminalId).length > 0, "Record not found");
        records[criminalId].highRisk = true;
        emit HighRiskFlagged(criminalId, msg.sender);
    }

    /// Soft-delete a record with a reason (history remains immutable).
    function deactivateRecord(string calldata criminalId, string calldata reason)
        external
        onlyOfficer
    {
        require(bytes(records[criminalId].criminalId).length > 0, "Record not found");
        records[criminalId].isActive = false;
        emit RecordDeactivated(criminalId, reason);
    }
}
