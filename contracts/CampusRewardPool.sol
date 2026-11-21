// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @notice Testnet-only native MON rewards for the LUMA campus photo walk.
/// Attendance must be verified by the owner before authorizing recipients.
contract CampusRewardPool {
    uint256 public constant CHAIN_ID = 10143;
    uint256 public constant REWARD = 0.001 ether;
    bytes32 public constant CAMPAIGN = keccak256("campus-t:photo-walk:v1");
    address public owner;
    bool public closed;
    uint256 public paidCount;
    mapping(address => bool) public eligible;
    mapping(address => bool) public claimed;
    bool private entered;

    event Eligibility(address indexed recipient, bool allowed);
    event Claimed(address indexed recipient, uint256 amount);
    event Funded(address indexed sender, uint256 amount);
    event Closed();
    event Withdrawn(address indexed owner, uint256 amount);

    modifier testnet() { require(block.chainid == CHAIN_ID, "Testnet only"); _; }
    modifier onlyOwner() { require(msg.sender == owner, "Owner only"); _; }
    modifier nonReentrant() { require(!entered, "Reentrant"); entered = true; _; entered = false; }

    constructor() payable testnet {
        require(msg.value >= REWARD, "Initial budget too small");
        owner = msg.sender;
        emit Funded(msg.sender, msg.value);
    }
    function fund() external payable testnet {
        require(!closed, "Pool closed");
        require(msg.value > 0, "Zero funding");
        emit Funded(msg.sender, msg.value);
    }
    function setEligible(address[] calldata recipients, bool allowed) external testnet onlyOwner {
        require(!closed, "Pool closed");
        require(recipients.length > 0 && recipients.length <= 100, "1 to 100 recipients");
        for (uint256 i; i < recipients.length; ++i) {
            require(recipients[i] != address(0), "Zero recipient");
            eligible[recipients[i]] = allowed;
            emit Eligibility(recipients[i], allowed);
        }
    }
    function claim() external testnet nonReentrant {
        require(!closed, "Pool closed");
        require(eligible[msg.sender], "Not eligible");
        require(!claimed[msg.sender], "Already claimed");
        require(address(this).balance >= REWARD, "Insufficient pool balance");
        claimed[msg.sender] = true;
        ++paidCount;
        (bool ok,) = payable(msg.sender).call{value: REWARD}("");
        require(ok, "Transfer failed");
        emit Claimed(msg.sender, REWARD);
    }
    function close() external testnet onlyOwner nonReentrant {
        require(!closed, "Already closed");
        closed = true;
        emit Closed();
    }
    function withdraw() external testnet onlyOwner nonReentrant {
        require(closed, "Close pool first");
        uint256 amount = address(this).balance;
        require(amount > 0, "Empty pool");
        (bool ok,) = payable(owner).call{value: amount}("");
        require(ok, "Transfer failed");
        emit Withdrawn(owner, amount);
    }
}
