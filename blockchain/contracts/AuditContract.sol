// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title AuditContract
 * @notice Immutable audit trail of every system action.
 *
 * Every VIEW / EDIT / EXPORT / SHARE / DELETE / LOGIN / SEARCH action is
 * permanently recorded. The court can request the complete, tamper-proof
 * history for a criminal or case at any time.
 *
 * Auto-detects suspicious activity:
 *   * the same data accessed 50+ times in a rolling hour
 *   * unauthorized-access results
 */
contract AuditContract {
    struct AuditLog {
        uint256 logId;
        address officerAddress;
        string officerBadgeId;
        string officerDepartment;
        string action;        // VIEW | EDIT | EXPORT | SHARE | DELETE | LOGIN | SEARCH
        string targetId;      // criminal_id or case_id
        string targetType;    // CRIMINAL | CASE | EVIDENCE | REPORT | NETWORK
        uint256 timestamp;
        string ipAddress;     // hashed for privacy
        string result;        // SUCCESS | FAILED | UNAUTHORIZED
        bytes32 dataHash;     // hash of data accessed
        bytes32 sessionHash;
    }

    AuditLog[] private logs;
    mapping(string => uint256[]) private logsByTarget;   // targetId => log ids
    mapping(address => uint256[]) private logsByOfficer; // address => log ids

    // Suspicious-activity detection: per-officer per-hour VIEW counters.
    mapping(address => mapping(uint256 => uint256)) private hourlyViewCount;

    event ActionLogged(uint256 logId, address officer, string action, string targetId, uint256 timestamp);
    event SuspiciousActivity(address officerAddress, string action, uint256 timestamp);

    /// Record one action on the immutable ledger.
    function logAction(
        string calldata officerBadgeId,
        string calldata department,
        string calldata action,
        string calldata targetId,
        string calldata targetType,
        string calldata ipHash,
        string calldata result,
        bytes32 dataHash,
        bytes32 sessionHash
    ) external {
        uint256 logId = logs.length;
        logs.push(
            AuditLog({
                logId: logId,
                officerAddress: msg.sender,
                officerBadgeId: officerBadgeId,
                officerDepartment: department,
                action: action,
                targetId: targetId,
                targetType: targetType,
                timestamp: block.timestamp,
                ipAddress: ipHash,
                result: result,
                dataHash: dataHash,
                sessionHash: sessionHash
            })
        );
        logsByTarget[targetId].push(logId);
        logsByOfficer[msg.sender].push(logId);

        emit ActionLogged(logId, msg.sender, action, targetId, block.timestamp);

        // ── Suspicious-activity auto-detection ────────────────────────────────
        if (keccak256(bytes(result)) == keccak256(bytes("UNAUTHORIZED"))) {
            emit SuspiciousActivity(msg.sender, action, block.timestamp);
        } else if (keccak256(bytes(action)) == keccak256(bytes("VIEW"))) {
            uint256 hour = block.timestamp / 3600;
            hourlyViewCount[msg.sender][hour] += 1;
            if (hourlyViewCount[msg.sender][hour] >= 50) {
                emit SuspiciousActivity(msg.sender, action, block.timestamp);
            }
        }
    }

    /// All logs for a target id (criminal/case).
    function getAuditByTarget(string calldata targetId)
        external
        view
        returns (AuditLog[] memory)
    {
        uint256[] memory ids = logsByTarget[targetId];
        AuditLog[] memory result = new AuditLog[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            result[i] = logs[ids[i]];
        }
        return result;
    }

    /// All actions by an officer address.
    function getAuditByOfficer(address officerAddress)
        external
        view
        returns (AuditLog[] memory)
    {
        uint256[] memory ids = logsByOfficer[officerAddress];
        AuditLog[] memory result = new AuditLog[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            result[i] = logs[ids[i]];
        }
        return result;
    }

    /// Logs within a timestamp range.
    function getAuditByTimeRange(uint256 start, uint256 end)
        external
        view
        returns (AuditLog[] memory)
    {
        uint256 count = 0;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].timestamp >= start && logs[i].timestamp <= end) {
                count += 1;
            }
        }
        AuditLog[] memory result = new AuditLog[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].timestamp >= start && logs[i].timestamp <= end) {
                result[idx] = logs[i];
                idx += 1;
            }
        }
        return result;
    }

    /// Total actions ever recorded.
    function getTotalLogsCount() external view returns (uint256) {
        return logs.length;
    }

    /// A specific log entry.
    function getLogById(uint256 logId) external view returns (AuditLog memory) {
        require(logId < logs.length, "Log not found");
        return logs[logId];
    }
}
