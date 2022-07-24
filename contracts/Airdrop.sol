// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import "./util/TransferHelper.sol";
import "./util/Math.sol";
import "./util/MerkleProof.sol";

// Airdrop contract can be used to send dynamic amount of any token to numerous amount of users.
// Also this contract supports managing multiple airdrops
contract Airdrop is Initializable, OwnableUpgradeable {
    struct AirdropInfo {
        uint256 amount;                        // Total amount distributed to all users
        uint64 userCount;                      // Total number of users that should claim tokens
        uint64 userClaimedCount;               // Number of users already claimed tokens
        mapping (address => bool) userClaimed; // Remember users who received their tokens
        uint256 keptAmount;                    // Amount of tokens that is kept by multiplying amount by keptCoef
        uint256 claimedAmount;                 // Amount of tokens already claimed by users
        uint256 keptCoef;                      // Initially 20% and then quadratically decreases with every claim() call
        address token;                         // Address of token to distribute between users
        bytes32 merkleRoot;                    // All users with their amounts in one hash
    }

    // Emits when new airdrop for specific token & amount created
    event Created(uint64 airdropId, address token, uint256 amount);
    // Emits every time user claimed his tokens
    event Claimed(
        uint64 airdropId,
        address claimer,
        uint256 amount,
        uint256 keptAmount,
        uint256 rewardAmount
    );

    // Incremental counter for indexing airdrops
    uint64 public count;
    // Initial keptCoef for every airdrop in percents
    uint256 constant keptCoefInitial = 20 * 1e18;
    // Denominator for keptCoef in every stored airdrop
    uint256 constant keptCoefDenominator = 1e20;
    // Airdrops itself
    mapping(uint64 => AirdropInfo) infos;

    function initialize() public initializer {
        __Ownable_init();
    }

    // Any user can create his own airdrop by calling this method.
    function create(
        address _token,
        uint256 _amount,
        uint64 _userCount,
        bytes32 _merkleRoot
    ) external {
        // Aware of zero division during claiming
        require(_amount > 0, 'Airdrop::create: invalid amount');
        require(_userCount > 0, 'Airdrop::create: invalid userCount');

        TransferHelper.safeTransferFrom(_token, msg.sender, address(this), _amount);

        // Create and save new airdrop
        infos[count].amount = _amount;
        infos[count].userCount = _userCount;
        infos[count].keptCoef = keptCoefInitial;
        infos[count].token = _token;
        infos[count].merkleRoot = _merkleRoot;

        emit Created(count, _token, _amount);
        count += 1;
    }

    // Anyone included in airdrop's merkleRoot can withdraw his tokens
    function claim(
        uint64 _airdropId,
        bytes32[] calldata _merkleProof,
        uint8[] calldata _merklePositions,
        uint256 _amount
    ) external {
        AirdropInfo storage airdropInfo = infos[_airdropId];
        bytes32 merkleLeaf = keccak256(abi.encodePacked(msg.sender, _amount));

        // Check user presence in airdrop's list
        require(MerkleProof.verify(airdropInfo.merkleRoot, merkleLeaf, _merkleProof, _merklePositions), 'Airdrop::claim: invalid proof');
        // Double claim check
        require(!airdropInfo.userClaimed[msg.sender], 'Airdrop::claim: already claimed');

        // Calculate amount to deduct from claimed amount
        uint256 keptAmount = airdropInfo.keptCoef * _amount / keptCoefDenominator;

        // Do not deduct tokens from last claiming user
        if (airdropInfo.userClaimedCount == airdropInfo.userCount - 1) {
            keptAmount = 0;
        } else {
            // Quadratically decrease keptCoef for current airdrop
            airdropInfo.keptCoef = Math.sqrt(airdropInfo.keptCoef);
        }

        // Calculate weighted amount to add to claiming amount. Note 1e18 is used for higher precision
        uint256 rewardAmount = airdropInfo.keptAmount * _amount * 1e36 / airdropInfo.amount / 1e36;

        // Don't forget to add increase airdrop's keptAmount for sharing with next users
        airdropInfo.keptAmount += keptAmount;
        airdropInfo.userClaimedCount += 1;
        // Save user received his tokens
        airdropInfo.userClaimed[msg.sender] = true;
        // Calculate final amount user receives from airdrop
        uint256 amount = _amount + rewardAmount - keptAmount;

        // Tracking sent airdrops
        airdropInfo.claimedAmount += amount;

        // Transfer remain change and reward to the last claimer
        if (airdropInfo.userClaimedCount == airdropInfo.userCount) {
            amount += airdropInfo.amount - airdropInfo.claimedAmount;
        }

        TransferHelper.safeTransfer(airdropInfo.token, msg.sender, amount);

        emit Claimed(_airdropId, msg.sender, amount, keptAmount, rewardAmount);
    }
}
