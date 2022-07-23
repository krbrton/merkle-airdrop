// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

library Math {
    // This is Babylonian method of finding square root.
    // More on this: https://en.wikipedia.org/wiki/Methods_of_computing_square_roots#Babylonian_method
    function sqrt(uint256 x) internal pure returns (uint y) {
        uint256 z = (x + 1) / 2;
        y = x;

        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
    }
}
