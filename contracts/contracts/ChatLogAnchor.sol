// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title ChatLogAnchor
/// @notice チャットルームごとの会話ログの Merkle root をチェーンへ記録する。
/// @dev    メッセージ本文はチェーンに載せない。載せるのは root だけで、
///         「あるメッセージがそのルームの、その時点のログに含まれていたか」は
///         オフチェーンの Merkle proof と、ここに記録された root の突き合わせで示す。
contract ChatLogAnchor is Ownable {
    struct Anchor {
        uint64 anchoredAt; // block.timestamp
        uint64 messageCount; // root を計算した時点のメッセージ件数
        uint64 sequence; // ルーム内の連番（1 始まり）
    }

    /// @notice roomId => merkleRoot => アンカー情報。anchoredAt == 0 なら未記録。
    mapping(bytes32 => mapping(bytes32 => Anchor)) private _anchors;

    /// @notice roomId => 最新の merkleRoot
    mapping(bytes32 => bytes32) public latestRoot;

    /// @notice roomId => これまでに記録した回数
    mapping(bytes32 => uint64) public anchorCount;

    /// @notice anchor を実行できるアドレス（バックエンドの署名鍵）
    mapping(address => bool) public isAnchorer;

    event Anchored(
        bytes32 indexed roomId,
        bytes32 indexed merkleRoot,
        uint64 messageCount,
        uint64 sequence,
        uint64 anchoredAt
    );

    event AnchorerUpdated(address indexed account, bool allowed);

    error NotAnchorer(address account);
    error EmptyRoot();
    error AlreadyAnchored(bytes32 roomId, bytes32 merkleRoot);
    error MessageCountNotIncreasing(uint64 previous, uint64 next);

    modifier onlyAnchorer() {
        if (!isAnchorer[msg.sender]) revert NotAnchorer(msg.sender);
        _;
    }

    constructor(address initialOwner) Ownable(initialOwner) {
        isAnchorer[initialOwner] = true;
        emit AnchorerUpdated(initialOwner, true);
    }

    function setAnchorer(address account, bool allowed) external onlyOwner {
        isAnchorer[account] = allowed;
        emit AnchorerUpdated(account, allowed);
    }

    /// @notice ルームのログの Merkle root を記録する。
    /// @param roomId       ルーム ID（アプリ側の ULID を keccak256 したもの）
    /// @param merkleRoot   messageCount 件のメッセージハッシュから作った root
    /// @param messageCount root を計算した時点のメッセージ件数
    function anchor(bytes32 roomId, bytes32 merkleRoot, uint64 messageCount) external onlyAnchorer {
        if (merkleRoot == bytes32(0)) revert EmptyRoot();
        if (_anchors[roomId][merkleRoot].anchoredAt != 0) {
            revert AlreadyAnchored(roomId, merkleRoot);
        }

        bytes32 previousRoot = latestRoot[roomId];
        if (previousRoot != bytes32(0)) {
            uint64 previousCount = _anchors[roomId][previousRoot].messageCount;
            // ログは追記のみ。件数が減る root は受け付けない。
            if (messageCount <= previousCount) {
                revert MessageCountNotIncreasing(previousCount, messageCount);
            }
        }

        uint64 sequence = anchorCount[roomId] + 1;
        uint64 anchoredAt = uint64(block.timestamp);

        _anchors[roomId][merkleRoot] = Anchor({
            anchoredAt: anchoredAt,
            messageCount: messageCount,
            sequence: sequence
        });
        latestRoot[roomId] = merkleRoot;
        anchorCount[roomId] = sequence;

        emit Anchored(roomId, merkleRoot, messageCount, sequence, anchoredAt);
    }

    /// @notice root が記録済みかを返す。未記録なら anchoredAt == 0。
    function anchorOf(bytes32 roomId, bytes32 merkleRoot) external view returns (Anchor memory) {
        return _anchors[roomId][merkleRoot];
    }

    /// @notice root が記録済みかどうかだけを返す。
    function isAnchored(bytes32 roomId, bytes32 merkleRoot) external view returns (bool) {
        return _anchors[roomId][merkleRoot].anchoredAt != 0;
    }
}
