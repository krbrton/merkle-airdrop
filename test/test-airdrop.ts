import {expect} from "chai";
import {ethers} from "hardhat";
import {BigNumber, Contract} from "ethers";
import {airdropFactory, tokenFactory} from "./factory";
const { MerkleTree } = require('merkletreejs')

let airdrop: Contract;
let token: Contract;

const tokenSupply = ethers.utils.parseEther("10000");

describe("Airdrop", () => {
  beforeEach(async () => {
    const [owner] = await ethers.getSigners();

    token = await tokenFactory("TEST", "Test Token", 18);
    airdrop = await airdropFactory();

    await token.mint(owner.address, tokenSupply);

    // Don't do infinity approves in production environment
    await token.approve(airdrop.address, ethers.constants.MaxUint256);
  });

  describe("Create", () => {
    it("invalid amount", async () => {
      let invalidAmount = ethers.BigNumber.from(0);
      let userCount = ethers.BigNumber.from(1);
      let merkleRoot = ethers.utils.hexZeroPad("0x", 32);

      await expect(airdrop.create(token.address, invalidAmount, userCount, merkleRoot)).to.be.reverted;
    });

    it("invalid user count", async () => {
      let invalidAmount = ethers.BigNumber.from(1);
      let userCount = ethers.BigNumber.from(0);
      let merkleRoot = ethers.utils.hexZeroPad("0x", 32);

      await expect(airdrop.create(token.address, invalidAmount, userCount, merkleRoot)).to.be.reverted;
    });

    it("invalid user count", async () => {
      let amount = ethers.BigNumber.from(1);
      let userCount = ethers.BigNumber.from(10);
      let merkleRoot = ethers.utils.hexZeroPad("0x", 32);

      let createTx = await airdrop.create(token.address, amount, userCount, merkleRoot);

      expect(createTx).to
          .emit(airdrop, "Created")
          .withArgs("0", token.address, amount);
    });
  });

  describe("Claim", () => {
    const amount = ethers.utils.parseEther("1750");
    let users: string[];
    let userCount: BigNumber;
    let tree: typeof MerkleTree;
    let merkleRoot: string;

    beforeEach(async () => {
      const [_, user1, user2, user3, user4, user5] = await ethers.getSigners();
      users = [
        [user1.address, ethers.utils.parseEther("100")],
        [user2.address, ethers.utils.parseEther("150")],
        [user3.address, ethers.utils.parseEther("250")],
        [user4.address, ethers.utils.parseEther("750")],
        [user5.address, ethers.utils.parseEther("500")],
      ].map(u => ethers.utils.keccak256(ethers.utils.solidityPack(["address", "uint256"], u)))
      userCount = ethers.BigNumber.from(users.length);
      tree = new MerkleTree(users, ethers.utils.keccak256);
      merkleRoot = tree.getHexRoot();
      const createTx = await airdrop.create(token.address, amount, userCount, merkleRoot);

      expect(createTx).to
          .emit(airdrop, "Created")
          .withArgs("0", token.address, amount);
    })

    it("invalid amount", async () => {
      const [_, user1] = await ethers.getSigners();
      const user1Proof = tree.getHexProof(users[0]);
      const user1Positions = tree.getProof(users[0]).map((x: {position: string}) => x.position === 'right' ? 1 : 0)
      const invalidAmount = ethers.utils.parseEther("1000");

      await expect(
          airdrop.connect(user1).claim("0", user1Proof, user1Positions, invalidAmount)
      ).to.be.revertedWith("Airdrop::claim: invalid proof");
    });

    it("invalid claimer", async () => {
      const user1Proof = tree.getHexProof(users[0]);
      const user1Positions = tree.getProof(users[0]).map((x: {position: string}) => x.position === 'right' ? 1 : 0)
      const amount = ethers.utils.parseEther("100");

      await expect(
          airdrop.claim("0", user1Proof, user1Positions, amount)
      ).to.be.revertedWith("Airdrop::claim: invalid proof");
    });

    it("double claim", async () => {
      const [_, user1] = await ethers.getSigners();
      const user1Proof = tree.getHexProof(users[0]);
      const user1Positions = tree.getProof(users[0]).map((x: {position: string}) => x.position === 'right' ? 1 : 0)
      const amount = ethers.utils.parseEther("100");

      await airdrop.connect(user1).claim("0", user1Proof, user1Positions, amount);

      await expect(
          airdrop.connect(user1).claim("0", user1Proof, user1Positions, amount)
      ).to.be.revertedWith("Airdrop::claim: already claimed");
    });

    it("valid params", async () => {
      const [_, user1, user2, user3, user4, user5] = await ethers.getSigners();
      const airdropBalanceBefore = ethers.utils.formatEther(await token.balanceOf(airdrop.address));
      expect(airdropBalanceBefore).to.eq("1750.0");

      // user1
      const user1Proof = tree.getHexProof(users[0]);
      const user1Positions = tree.getProof(users[0]).map((x: {position: string}) => x.position === 'right' ? 1 : 0)
      const user1ClaimTx = await airdrop.connect(user1).claim("0", user1Proof, user1Positions, ethers.utils.parseEther("100"));
      const user1KeptAmount = amount.mul(2).div(10);
      const user1RewardAmount = BigNumber.from(0);

      expect(user1ClaimTx).to
          .emit(airdrop, "Claimed")
          .withArgs("0", user1.address, amount, user1KeptAmount, user1RewardAmount);

      const airdropBalance = ethers.utils.formatEther(await token.balanceOf(airdrop.address));
      expect(airdropBalance).to.eq("1670.0"); // 1750 - 100 + (100 * 20%)

      // user2
      const user2Proof = tree.getHexProof(users[1]);
      const user2Positions = tree.getProof(users[1]).map((x: {position: string}) => x.position === 'right' ? 1 : 0)
      const user2ClaimTx = await airdrop.connect(user2).claim("0", user2Proof, user2Positions, ethers.utils.parseEther("150"));

      expect(user2ClaimTx).to.emit(airdrop, "Claimed");

      // user3
      const user3Proof = tree.getHexProof(users[2]);
      const user3Positions = tree.getProof(users[2]).map((x: {position: string}) => x.position === 'right' ? 1 : 0)
      const user3ClaimTx = await airdrop.connect(user3).claim("0", user3Proof, user3Positions, ethers.utils.parseEther("250"));

      expect(user3ClaimTx).to.emit(airdrop, "Claimed");

      // user4
      const user4Proof = tree.getHexProof(users[3]);
      const user4Positions = tree.getProof(users[3]).map((x: {position: string}) => x.position === 'right' ? 1 : 0)
      const user4ClaimTx = await airdrop.connect(user4).claim("0", user4Proof, user4Positions, ethers.utils.parseEther("750"));

      expect(user4ClaimTx).to.emit(airdrop, "Claimed");

      // user5
      const user5Proof = tree.getHexProof(users[4]);
      const user5Positions = tree.getProof(users[4]).map((x: {position: string}) => x.position === 'right' ? 1 : 0)
      const user5ClaimTx = await airdrop.connect(user5).claim("0", user5Proof, user5Positions, ethers.utils.parseEther("500"));

      expect(user5ClaimTx).to.emit(airdrop, "Claimed");
      expect(await token.balanceOf(airdrop.address)).to.eq(BigNumber.from(0));
    });
  });
});
