// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract ERC20Token is ERC20Upgradeable, OwnableUpgradeable {
    uint8 public _tokenDecimals;

    function initialize(string memory symbol, string memory name, uint8 _decimals) public initializer {
        _tokenDecimals = _decimals;

        __ERC20_init(name, symbol);
        __Ownable_init();
    }

    function mint(address account, uint256 amount) public onlyOwner {
        _mint(account, amount);
    }

    function burn(address account, uint256 amount) public onlyOwner {
        _burn(account, amount);
    }

    function decimals() public view virtual override returns (uint8) {
        return _tokenDecimals;
    }
}
