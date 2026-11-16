// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

interface IPqDirectory {
    function pqcKeyStatus(address account) external view returns (bool, uint8, bytes memory, bool);
}

interface IPqVerifier {
    function pqcVerify(bytes calldata key, bytes calldata signature, bytes calldata message)
        external view returns (bool);
}

/// One opt-in, native-asset estate on QoreChain Diana. No administrator or upgrade key.
contract JaydaadEstate {
    enum Phase { Enrollment, Active, Grace, Claimable, Closed }
    enum Action { CheckIn, Cancel, Claim }

    address public immutable owner;
    address public immutable heir;
    address public immutable witness;
    uint64 public immutable interval;
    uint64 public immutable grace;
    mapping(address => bytes32) public enrolledKey;
    uint256 public lastCheckIn;
    uint256 public nonce;
    bool public closed;
    address public payoutRecipient;

    IPqDirectory constant DIRECTORY = IPqDirectory(address(0x0A02));
    IPqVerifier constant VERIFIER = IPqVerifier(address(0x0A01));
    event CheckedIn(uint256 nextCheckIn, uint256 claimOpens);
    event Funded(address indexed from, uint256 amount);
    event Released(Action action, address indexed recipient, uint256 amount);
    event LateDepositRecovered(address indexed recipient, uint256 amount);

    constructor(address successor, address identityWitness, uint64 checkInInterval, uint64 gracePeriod) {
        require(block.chainid == 9800, "Diana testnet only");
        require(successor != address(0) && identityWitness != address(0), "missing participant");
        require(successor != msg.sender && successor != identityWitness && msg.sender != identityWitness, "distinct roles");
        require(checkInInterval > 0 && gracePeriod > 0, "empty window");
        owner = msg.sender;
        heir = successor;
        witness = identityWitness;
        interval = checkInInterval;
        grace = gracePeriod;
        _enroll(owner);
        _enroll(heir);
        _enroll(witness);
        require(enrolledKey[owner] != enrolledKey[witness] &&
                enrolledKey[heir] != enrolledKey[witness] &&
                enrolledKey[owner] != enrolledKey[heir], "distinct PQ keys required");
    }

    function _enroll(address account) private {
        (bool registered, uint8 algorithm, bytes memory key, bool proven) = DIRECTORY.pqcKeyStatus(account);
        require(registered && proven && algorithm == 1 && key.length == 2592, "verified ML-DSA-87 key required");
        enrolledKey[account] = keccak256(key);
    }

    function phase() public view returns (Phase) {
        if (closed) return Phase.Closed;
        if (lastCheckIn == 0) return Phase.Enrollment;
        uint256 due = lastCheckIn + interval;
        if (block.timestamp < due) return Phase.Active;
        if (block.timestamp < due + grace) return Phase.Grace;
        return Phase.Claimable;
    }

    function fund() external payable {
        require(phase() == Phase.Active && msg.value > 0, "fund an active estate");
        emit Funded(msg.sender, msg.value);
    }

    receive() external payable {
        require(phase() == Phase.Active && msg.value > 0, "fund an active estate");
        emit Funded(msg.sender, msg.value);
    }

    /// Native bank sends and forced EVM transfers can bypass receive(). Once closed,
    /// these deposits still belong to the recipient of the original settlement.
    function recoverLateDeposit() external {
        require(closed, "estate not closed");
        uint256 amount = address(this).balance;
        require(amount > 0, "nothing to recover");
        (bool sent,) = payable(payoutRecipient).call{value: amount}("");
        require(sent, "payout rejected");
        emit LateDepositRecovered(payoutRecipient, amount);
    }

    /// Different roles sign different messages. Both bind the estate, action, nonce and expiry.
    function message(Action action, address signer, uint256 validUntil) public view returns (bytes memory) {
        return abi.encodePacked("jaydaad-estate-diana-v1|", abi.encode(
            block.chainid, address(this), owner, heir, witness, interval, grace, action, signer, nonce, validUntil
        ));
    }

    struct Proof { bytes key; bytes signature; }

    function _verify(address signer, Proof calldata proof, Action action, uint256 validUntil) private view {
        require(keccak256(proof.key) == enrolledKey[signer], "unexpected key");
        (bool registered, uint8 algorithm, bytes memory currentKey, bool proven) = DIRECTORY.pqcKeyStatus(signer);
        require(registered && proven && algorithm == 1 && keccak256(currentKey) == enrolledKey[signer], "enrolled key no longer current");
        require(VERIFIER.pqcVerify(proof.key, proof.signature, message(action, signer, validUntil)), "invalid approval");
    }

    /// The witness is trusted to identify the enrolled human before co-signing this exact action.
    function execute(Action action, uint256 validUntil, Proof calldata participant, Proof calldata approval) external {
        Phase current = phase();
        require(block.timestamp <= validUntil && validUntil <= block.timestamp + 10 minutes, "approval window");
        require(current != Phase.Closed, "estate closed");
        address recipient = action == Action.Claim ? heir : owner;
        require(msg.sender == recipient, "wrong caller");
        if (action == Action.Claim) require(current == Phase.Claimable, "claim unavailable");
        else require(current != Phase.Claimable, "owner window ended");
        _verify(recipient, participant, action, validUntil);
        _verify(witness, approval, action, validUntil);
        nonce++;
        if (action == Action.CheckIn) {
            lastCheckIn = block.timestamp;
            emit CheckedIn(lastCheckIn + interval, lastCheckIn + interval + grace);
            return;
        }
        closed = true;
        payoutRecipient = recipient;
        uint256 amount = address(this).balance;
        (bool sent,) = payable(recipient).call{value: amount}("");
        require(sent, "payout rejected");
        emit Released(action, recipient, amount);
    }
}
