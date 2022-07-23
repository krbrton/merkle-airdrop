import {ethers, upgrades} from "hardhat";
import {Contract} from "ethers";

export async function tokenFactory(symbol: string, name: string, decimals: number): Promise<Contract> {
    const ERC20Token = await ethers.getContractFactory("ERC20Token");
    const erc20Token = await upgrades.deployProxy(ERC20Token, [name, symbol, decimals]);
    await erc20Token.deployed();

    return erc20Token;
}

export async function airdropFactory(): Promise<Contract> {
    const Airdrop = await ethers.getContractFactory('Airdrop');
    const airdrop = await upgrades.deployProxy(Airdrop);
    await airdrop.deployed();

    return airdrop;
}
