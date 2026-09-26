// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title MeridianVault
/// @notice Holds deposited funds on the source chain until a relayer, acting
/// on a finalized GenLayer verdict (see contracts/meridian_adjudicator.py +
/// settlement_outbox.py), instructs a payout. This contract never asks
/// GenLayer anything itself — it only trusts calls from `relayer`.
/// Deployed once per source chain; escrows are keyed by an id the client
/// generates and mirrors on GenLayer's own MeridianAdjudicator.
contract MeridianVault {
    enum Verdict {
        ReleaseToPayee,
        RefundToPayer,
        Split
    }
    enum Status {
        None,
        Locked,
        Settled
    }

    struct Escrow {
        address payer;
        address payee;
        uint256 amount;
        Status status;
    }

    address public immutable relayer;
    mapping(bytes32 => Escrow) public escrows;

    event Deposited(bytes32 indexed escrowId, address indexed payer, address indexed payee, uint256 amount);
    event Settled(
        bytes32 indexed escrowId,
        Verdict verdict,
        uint16 payeeBps,
        uint256 payeeAmount,
        uint256 payerAmount
    );

    constructor(address _relayer) {
        require(_relayer != address(0), "relayer required");
        relayer = _relayer;
    }

    /// @notice Lock funds for `escrowId`. Caller is the payer; value is the
    /// escrowed amount in the chain's native currency. On Arc Testnet the
    /// native token IS USDC, accounted with 18 decimals (ether-style) at
    /// this native layer — a separate ERC-20 view of the same balance uses
    /// 6 decimals, but msg.value here always means the 18-decimal amount.
    function deposit(bytes32 escrowId, address payee) external payable {
        require(escrows[escrowId].status == Status.None, "escrow exists");
        require(msg.value > 0, "no funds");
        require(payee != address(0) && payee != msg.sender, "bad payee");
        escrows[escrowId] = Escrow(msg.sender, payee, msg.value, Status.Locked);
        emit Deposited(escrowId, msg.sender, payee, msg.value);
    }

    /// @notice Pay out `escrowId` per a finalized GenLayer verdict. Only the
    /// configured relayer may call this — it is expected to have already
    /// read the real verdict from settlement_outbox.get_message(escrowId).
    function settle(bytes32 escrowId, Verdict verdict, uint16 payeeBps) external {
        require(msg.sender == relayer, "only relayer");
        require(payeeBps <= 10000, "bad bps");
        Escrow storage e = escrows[escrowId];
        require(e.status == Status.Locked, "not locked");
        e.status = Status.Settled;

        uint256 payeeAmount = verdict == Verdict.ReleaseToPayee
            ? e.amount
            : verdict == Verdict.RefundToPayer
            ? 0
            : (e.amount * payeeBps) / 10000;
        uint256 payerAmount = e.amount - payeeAmount;

        if (payeeAmount > 0) {
            (bool sentToPayee, ) = payable(e.payee).call{value: payeeAmount}("");
            require(sentToPayee, "payee transfer failed");
        }
        if (payerAmount > 0) {
            (bool sentToPayer, ) = payable(e.payer).call{value: payerAmount}("");
            require(sentToPayer, "payer transfer failed");
        }
        emit Settled(escrowId, verdict, payeeBps, payeeAmount, payerAmount);
    }
}
