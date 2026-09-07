// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title AgencyShareContract
 * @notice Secure cryptographic data sharing between agencies.
 *
 * Grants time-boxed, level-scoped access to criminal data between
 * STATE_POLICE, CBI, NIA, COURT, INTERPOL, CUSTOMS and NCB. Every grant,
 * check and revocation is recorded on-chain, giving a transparent and
 * auditable record of who accessed what, when, and why.
 */
contract AgencyShareContract {
    enum Agency { STATE_POLICE, CBI, NIA, COURT, INTERPOL, CUSTOMS, NCB }
    enum AccessLevel { READ_ONLY, FULL_ACCESS, ANALYSIS_ONLY }

    struct SharePermission {
        bytes32 permissionId;
        string dataId;
        string dataType;      // CRIMINAL | CASE | EVIDENCE | NETWORK
        Agency fromAgency;
        Agency toAgency;
        AccessLevel accessLevel;
        uint256 grantedAt;
        uint256 expiresAt;
        bool isActive;
        bytes32 dataHash;
        address grantedBy;
        string purpose;
        uint256 accessCount;
    }

    mapping(bytes32 => SharePermission) private permissions;
    mapping(string => bytes32[]) private permissionsByData;   // dataId => ids
    mapping(Agency => bytes32[]) private permissionsByAgency; // toAgency => ids
    mapping(bytes32 => string) private revokeReasons;

    event AccessGranted(
        bytes32 permissionId,
        string dataId,
        Agency fromAgency,
        Agency toAgency,
        uint256 expires
    );
    event AccessRevoked(bytes32 permissionId, string reason, address revokedBy);
    event AccessChecked(bytes32 permissionId, Agency agency, uint256 timestamp);
    event AccessExpired(bytes32 permissionId, string dataId);

    /// Grant access to another agency. Returns the permission id.
    function grantAccess(
        string calldata dataId,
        string calldata dataType,
        Agency toAgency,
        Agency fromAgency,
        AccessLevel accessLevel,
        uint256 durationHours,
        bytes32 dataHash,
        string calldata purpose
    ) external returns (bytes32) {
        bytes32 permissionId = keccak256(
            abi.encodePacked(dataId, toAgency, fromAgency, block.timestamp, msg.sender)
        );
        require(bytes(permissions[permissionId].dataId).length == 0, "Permission exists");

        permissions[permissionId] = SharePermission({
            permissionId: permissionId,
            dataId: dataId,
            dataType: dataType,
            fromAgency: fromAgency,
            toAgency: toAgency,
            accessLevel: accessLevel,
            grantedAt: block.timestamp,
            expiresAt: block.timestamp + (durationHours * 1 hours),
            isActive: true,
            dataHash: dataHash,
            grantedBy: msg.sender,
            purpose: purpose,
            accessCount: 0
        });
        permissionsByData[dataId].push(permissionId);
        permissionsByAgency[toAgency].push(permissionId);

        emit AccessGranted(
            permissionId,
            dataId,
            fromAgency,
            toAgency,
            permissions[permissionId].expiresAt
        );
        return permissionId;
    }

    /// Check whether a permission grants access right now.
    function checkAccess(bytes32 permissionId)
        external
        view
        returns (bool hasAccess, AccessLevel level)
    {
        SharePermission storage p = permissions[permissionId];
        if (bytes(p.dataId).length == 0) {
            return (false, AccessLevel.READ_ONLY);
        }
        if (!p.isActive) {
            return (false, AccessLevel.READ_ONLY);
        }
        if (block.timestamp > p.expiresAt) {
            return (false, AccessLevel.READ_ONLY);
        }
        return (true, p.accessLevel);
    }

    /// Revoke a permission.
    function revokeAccess(bytes32 permissionId, string calldata reason) external {
        require(bytes(permissions[permissionId].dataId).length > 0, "Permission not found");
        permissions[permissionId].isActive = false;
        revokeReasons[permissionId] = reason;
        emit AccessRevoked(permissionId, reason, msg.sender);
    }

    /// Extend a permission by additional hours.
    function extendAccess(bytes32 permissionId, uint256 additionalHours) external {
        SharePermission storage p = permissions[permissionId];
        require(bytes(p.dataId).length > 0, "Permission not found");
        require(p.isActive, "Permission inactive");
        p.expiresAt += additionalHours * 1 hours;
    }

    /// Record an access event (increments the counter).
    function logAccess(bytes32 permissionId) external {
        SharePermission storage p = permissions[permissionId];
        require(bytes(p.dataId).length > 0, "Permission not found");
        require(p.isActive, "Permission inactive");
        require(block.timestamp <= p.expiresAt, "Permission expired");
        p.accessCount += 1;
        emit AccessChecked(permissionId, p.toAgency, block.timestamp);
    }

    /// All permissions for a data id.
    function getPermissionsByData(string calldata dataId)
        external
        view
        returns (SharePermission[] memory)
    {
        bytes32[] memory ids = permissionsByData[dataId];
        SharePermission[] memory result = new SharePermission[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            result[i] = permissions[ids[i]];
        }
        return result;
    }

    /// All permissions held by an agency.
    function getPermissionsByAgency(Agency toAgency)
        external
        view
        returns (SharePermission[] memory)
    {
        bytes32[] memory ids = permissionsByAgency[toAgency];
        SharePermission[] memory result = new SharePermission[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            result[i] = permissions[ids[i]];
        }
        return result;
    }

    /// Permissions that have expired (for cleanup/audit).
    function getExpiredPermissions()
        external
        view
        returns (SharePermission[] memory)
    {
        // Gather across all agencies (bounded loop over the enum).
        uint256 total = 0;
        for (uint256 a = 0; a < 7; a++) {
            total += permissionsByAgency[Agency(a)].length;
        }
        SharePermission[] memory result = new SharePermission[](total);
        uint256 idx = 0;
        for (uint256 a = 0; a < 7; a++) {
            bytes32[] memory ids = permissionsByAgency[Agency(a)];
            for (uint256 i = 0; i < ids.length; i++) {
                SharePermission storage p = permissions[ids[i]];
                if (p.isActive && block.timestamp > p.expiresAt) {
                    result[idx] = p;
                    idx += 1;
                }
            }
        }
        // Re-pack the result array to the exact length.
        SharePermission[] memory packed = new SharePermission[](idx);
        for (uint256 i = 0; i < idx; i++) {
            packed[i] = result[i];
        }
        return packed;
    }
}
