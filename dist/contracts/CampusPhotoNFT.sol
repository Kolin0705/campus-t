// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

/// @notice Testnet photo-walk collectible. Artwork and metadata are fully onchain.
/// A transferable collectible represents current ownership, not proof that its holder attended.
contract CampusPhotoNFT is ERC721Enumerable {
    uint256 public constant CHAIN_ID = 10143;
    address public owner;
    uint256 public maxSupply;
    bool public paused;
    mapping(address => bool) public eligible;
    mapping(address => bool) public claimed;
    event Eligibility(address indexed recipient, bool allowed);
    event Claimed(address indexed recipient, uint256 indexed tokenId);
    event PauseChanged(bool paused);

    modifier testnet() { require(block.chainid == CHAIN_ID, "Testnet only"); _; }
    modifier onlyOwner() { require(msg.sender == owner, "Owner only"); _; }

    constructor(uint256 limit) ERC721("CampusT LUMA Photo Walk", "CTPHOTO") testnet {
        require(limit > 0 && limit <= 10000, "Supply: 1 to 10000");
        owner = msg.sender;
        maxSupply = limit;
    }

    function setEligible(address[] calldata recipients, bool allowed) external testnet onlyOwner {
        require(recipients.length > 0 && recipients.length <= 100, "1 to 100 recipients");
        for (uint256 i; i < recipients.length; ++i) {
            require(recipients[i] != address(0), "Zero recipient");
            eligible[recipients[i]] = allowed;
            emit Eligibility(recipients[i], allowed);
        }
    }

    function setPaused(bool value) external testnet onlyOwner {
        paused = value;
        emit PauseChanged(value);
    }

    function claim() external testnet {
        require(!paused, "Mint paused");
        require(eligible[msg.sender], "Not eligible");
        require(!claimed[msg.sender], "Already claimed");
        require(totalSupply() < maxSupply, "Sold out");
        uint256 tokenId = totalSupply() + 1;
        // Persist before invoking an ERC721Receiver callback. Transferring cannot reset this flag.
        claimed[msg.sender] = true;
        _safeMint(msg.sender, tokenId);
        emit Claimed(msg.sender, tokenId);
    }

    function artwork(uint256 tokenId) public pure returns (string memory) {
        return string.concat(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#252c42"/><stop offset="1" stop-color="#69847c"/></linearGradient></defs>',
            '<rect width="600" height="600" rx="36" fill="url(#g)"/><circle cx="460" cy="160" r="90" fill="#ead2a5" opacity=".9"/><path d="M0 420Q150 280 300 420T600 420V600H0Z" fill="#3c635c"/>',
            '<rect x="130" y="130" width="340" height="340" rx="85" fill="#dbe6d4" fill-opacity=".12" stroke="#dfc698" stroke-width="3"/><path d="M155 215V155H215M385 155H445V215M445 385V445H385M215 445H155V385" fill="none" stroke="#fff1cd" stroke-width="12"/>',
            '<circle cx="300" cy="300" r="80" fill="none" stroke="#fff1cd" stroke-width="3"/><circle cx="300" cy="300" r="58" fill="none" stroke="#fff1cd"/><path d="M300 247V353M247 300H353" stroke="#fff1cd" opacity=".6"/>',
            '<text x="42" y="65" fill="#fff1cd" font-family="sans-serif" font-size="18" letter-spacing="4">LUMA x CAMPUS T</text><text x="42" y="526" fill="#fff1cd" font-family="sans-serif" font-size="29">CHASE THE LIGHT.</text><text x="42" y="562" fill="#d9e2d8" font-family="sans-serif" font-size="15">PHOTO WALK / MONAD TESTNET / #',
            Strings.toString(tokenId), '</text></svg>'
        );
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        string memory json = string.concat(
            '{"name":"CampusT LUMA Photo Walk #', Strings.toString(tokenId),
            '","description":"Fully onchain campus photo-walk collectible on Monad Testnet. Unlocks the LUMA avatar frame in CampusT. Transferable; ownership is not proof of attendance. Demo brand and event.","image":"data:image/svg+xml;base64,',
            Base64.encode(bytes(artwork(tokenId))),
            '","attributes":[{"trait_type":"Event","value":"LUMA Campus Photo Walk"},{"trait_type":"Network","value":"Monad Testnet"},{"trait_type":"Artwork","value":"Fully onchain"},{"trait_type":"Wearable","value":"LUMA Light Frame"}]}'
        );
        return string.concat("data:application/json;base64,", Base64.encode(bytes(json)));
    }
}
