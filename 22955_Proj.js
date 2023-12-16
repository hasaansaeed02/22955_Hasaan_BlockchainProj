// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract DecentralizedAuction {
    address public owner;
    uint public startBlock;
    uint public endBlock;

    address public highestBidder;
    uint public highestBindingBid;

    mapping(address => uint) public bids;
    address[] public bidders;

    uint public bidIncrement;

    uint public constant min_bidlength = 3;
    uint public constant min_fintime = 120;

    uint public biddercount;

    constructor(uint _startBlock, uint _endBlock, uint _bidIncrement) {
        require(_startBlock < _endBlock, "Invalid endBlock");
        require(_bidIncrement > 0, "Bid increment must be greater than zero");

        owner = msg.sender;
        startBlock = _startBlock;
        endBlock = _endBlock;
        bidIncrement = _bidIncrement;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only the owner can call this function");
        _;
    }

    modifier onlyBeforeEnd() {
        require(block.timestamp < endBlock, "Auction has already ended");
        _;
    }

    modifier onlyAfterEnd() {
        require(block.timestamp > endBlock, "Auction has not ended yet");
        _;
    }

    modifier onlyNotOwner() {
        require(msg.sender != owner, "Owner cannot bid on their own auction");
        _;
    }

    modifier canFinalize() {
        require(biddercount >= min_bidlength, "Can finalize when atleast 3 bidders bid");
        require(block.timestamp > endBlock + min_fintime, "Can finalize when atleast 2 minutes passed");
        _;
    }


    function placeBid() external payable onlyBeforeEnd onlyNotOwner {
        require(msg.value > bids[msg.sender] + bidIncrement, "Bid must be greater than the previous highest bid plus the bid increment");

        if (bids[msg.sender] == 0) {
            // If this is the first bid from the bidder, add them to the bidders array
            bidders.push(msg.sender);
            biddercount++; // Increment bidder count
        }

        if (bids[msg.sender] > 0) {
            // Refund the previous bid
            payable(msg.sender).transfer(bids[msg.sender]);
        }

        bids[msg.sender] = msg.value;

        if (msg.value > bids[highestBidder]) {
            highestBidder = msg.sender;
            highestBindingBid = bids[msg.sender] + bidIncrement;
        }
    }

    function finalizeAuction() external onlyOwner onlyAfterEnd canFinalize {
        require(highestBidder != address(0), "Auction has no winner");

        // Transfer the funds to the owner
        payable(owner).transfer(highestBindingBid);

        // Transfer any excess funds back to the highest bidder
        if (bids[highestBidder] > highestBindingBid) {
            payable(highestBidder).transfer(bids[highestBidder] - highestBindingBid);
        }
    }

    function cancelAuction() external onlyOwner onlyBeforeEnd {
        // Refund all bidders
        for (uint i = 0; i < bidders.length; i++) {
            address bidder = bidders[i];
            uint amount = bids[bidder];
            
            // Refund the bidder
            payable(bidder).transfer(amount);
        }
        endBlock = block.number; // Set the end block to the current block, effectively ending the auction
    }

    // Allow bidders to withdraw their funds after the auction ends
    function withdraw() external {
        require(block.number > endBlock, "Auction has not ended yet");
        require(msg.sender != highestBidder, "Highest bidder cannot withdraw until the auction is finalized");

        uint amount = bids[msg.sender];
        bids[msg.sender] = 0;
        payable(msg.sender).transfer(amount);
    }
}
