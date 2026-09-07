// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title ReportContract
 * @notice Blockchain certificate for every generated report.
 *
 * The SHA-256 of every generated report (PDF/CSV/Excel/JSON) is registered
 * on-chain. Anyone can verify that a presented report is authentic and has
 * not been altered since generation — including the courts.
 */
contract ReportContract {
    struct Report {
        string reportId;
        string reportType;    // CRIMINAL | NETWORK | CASE | EXECUTIVE
        string entityId;      // criminal_id or case_id
        bytes32 reportHash;   // hash of the report content
        address generatedBy;
        string officerBadgeId;
        uint256 generatedAt;
        string classification; // PUBLIC | CONFIDENTIAL | SECRET
        bool isRevoked;
        string revokedReason;
        uint256 version;
        bytes digitalSignature;
    }

    mapping(string => Report) private reports;
    mapping(string => string[]) private reportsByEntity; // entityId => report ids
    mapping(address => bool) public authorizedOfficers;

    uint256 public totalReports;

    event ReportRegistered(string reportId, bytes32 reportHash, address generatedBy);
    event ReportVerified(string reportId, bool isAuthentic, uint256 verifiedAt);
    event ReportRevoked(string reportId, string reason, address revokedBy);

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

    /// Register a new report certificate.
    function registerReport(
        string calldata reportId,
        string calldata reportType,
        string calldata entityId,
        bytes32 reportHash,
        string calldata classification,
        bytes calldata signature
    ) external onlyOfficer {
        require(bytes(reports[reportId].reportId).length == 0, "Report already registered");

        reports[reportId] = Report({
            reportId: reportId,
            reportType: reportType,
            entityId: entityId,
            reportHash: reportHash,
            generatedBy: msg.sender,
            officerBadgeId: "",
            generatedAt: block.timestamp,
            classification: classification,
            isRevoked: false,
            revokedReason: "",
            version: 1,
            digitalSignature: signature
        });
        reportsByEntity[entityId].push(reportId);
        totalReports += 1;

        emit ReportRegistered(reportId, reportHash, msg.sender);
    }

    /// Verify that a report file matches its on-chain hash.
    function verifyReport(string calldata reportId, bytes32 checkHash)
        external
        view
        returns (bool isAuthentic)
    {
        Report storage rep = reports[reportId];
        if (bytes(rep.reportId).length == 0) {
            return false;
        }
        return !rep.isRevoked && rep.reportHash == checkHash;
    }

    /// Revoke (invalidate) a report certificate.
    function revokeReport(string calldata reportId, string calldata reason)
        external
        onlyOfficer
    {
        require(bytes(reports[reportId].reportId).length > 0, "Report not found");
        reports[reportId].isRevoked = true;
        reports[reportId].revokedReason = reason;
        emit ReportRevoked(reportId, reason, msg.sender);
    }

    /// Register a new version of a report.
    function updateReport(
        string calldata reportId,
        bytes32 newHash,
        uint256 newVersion
    ) external onlyOfficer {
        require(bytes(reports[reportId].reportId).length > 0, "Report not found");
        reports[reportId].reportHash = newHash;
        reports[reportId].version = newVersion;
    }

    /// Full report certificate metadata.
    function getReport(string calldata reportId)
        external
        view
        returns (Report memory)
    {
        return reports[reportId];
    }

    /// All reports for an entity.
    function getReportsByEntity(string calldata entityId)
        external
        view
        returns (Report[] memory)
    {
        string[] memory ids = reportsByEntity[entityId];
        Report[] memory result = new Report[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            result[i] = reports[ids[i]];
        }
        return result;
    }
}
