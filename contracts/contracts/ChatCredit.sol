// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title ChatCredit
/// @notice チャットの利用料をネイティブトークン（Polygon なら POL）で前払いする窓口。
/// @dev    残高の消費はオフチェーン（DB）で行う。チェーンに載せるのは「誰がいくら入れたか」
///         だけで、1 メッセージごとに TX を出すことはしない（ガスとレイテンシが見合わない）。
///         バックエンドは depositId をキーに冪等にクレジットを付与する。
contract ChatCredit is Ownable, ReentrancyGuard {
    /// @notice 1 回の入金の最小額。埃のような入金でイベントを溢れさせないためのもの。
    uint256 public minDeposit;

    /// @notice 連番の入金 ID（1 始まり）。バックエンドの冪等キー。
    uint256 public lastDepositId;

    /// @notice アドレスごとの累計入金額（wei）
    mapping(address => uint256) public totalDeposited;

    event Deposited(uint256 indexed depositId, address indexed user, uint256 amount, address payer);
    event MinDepositUpdated(uint256 previous, uint256 next);
    event Withdrawn(address indexed to, uint256 amount);

    error DepositTooSmall(uint256 amount, uint256 minimum);
    error ZeroAddress();
    error NothingToWithdraw();
    error WithdrawFailed();

    constructor(address initialOwner, uint256 initialMinDeposit) Ownable(initialOwner) {
        minDeposit = initialMinDeposit;
        emit MinDepositUpdated(0, initialMinDeposit);
    }

    /// @notice 自分のアカウントへ入金する。
    function deposit() external payable {
        _deposit(msg.sender);
    }

    /// @notice 別のアドレスのアカウントへ入金する（代理支払い）。
    function depositFor(address user) external payable {
        if (user == address(0)) revert ZeroAddress();
        _deposit(user);
    }

    /// @dev 素の送金も入金として扱う。ウォレットから直接送られた分を取りこぼさない。
    receive() external payable {
        _deposit(msg.sender);
    }

    function _deposit(address user) private {
        if (msg.value < minDeposit) revert DepositTooSmall(msg.value, minDeposit);

        uint256 depositId = lastDepositId + 1;
        lastDepositId = depositId;
        totalDeposited[user] += msg.value;

        emit Deposited(depositId, user, msg.value, msg.sender);
    }

    function setMinDeposit(uint256 next) external onlyOwner {
        emit MinDepositUpdated(minDeposit, next);
        minDeposit = next;
    }

    /// @notice 集まった入金を運営のアドレスへ引き出す。
    function withdraw(address payable to) external onlyOwner nonReentrant {
        if (to == address(0)) revert ZeroAddress();

        uint256 amount = address(this).balance;
        if (amount == 0) revert NothingToWithdraw();

        (bool ok, ) = to.call{value: amount}("");
        if (!ok) revert WithdrawFailed();

        emit Withdrawn(to, amount);
    }
}
