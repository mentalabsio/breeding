import * as anchor from "@project-serum/anchor"
import { Program } from "@project-serum/anchor"
import { expect } from "chai"

import {
  createBreeding,
  findBreedingMachineAddress,
  findWhitelistTokenAddress,
} from "../app/utils/breeding"
import { BreedProgram } from "../target/types/breed_program"

describe("breed-program", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env())

  const program = anchor.workspace.BreedProgram as Program<BreedProgram>

  const parentsCandyMachineAddress = new anchor.web3.PublicKey(
    "9bBjPXwFVzPSEA4BH2wFfDnzYTekQq6itf6JBNvzRW2C"
  )

  const rewardsCandyMachineAddress = new anchor.web3.PublicKey(
    "GjntQcjKbmF6TD5nUvEDJxHF5StsCFAjcj3nnzb2A8Md"
  )

  const breedingMachineAuthority = anchor.web3.Keypair.fromSecretKey(
    anchor.utils.bytes.bs58.decode(
      "i4FDfFrETVUApv1pmsfKJoQ1kMthYk5iAyn1z9PsaBi7RrAAHAReVs6eUv1QuwVzuLBdqwZs4AdYndKaeAip5xn"
    )
  )

  const userWallet = anchor.web3.Keypair.fromSecretKey(
    anchor.utils.bytes.bs58.decode(
      "i4FDfFrETVUApv1pmsfKJoQ1kMthYk5iAyn1z9PsaBi7RrAAHAReVs6eUv1QuwVzuLBdqwZs4AdYndKaeAip5xn"
    )
  )

  const mintParentA = new anchor.web3.PublicKey(
    "Fdv4nCDfm2835Xe9FJNdNsTTTzkb34HV2a3s4L2HzdPX"
  )
  const mintParentB = new anchor.web3.PublicKey(
    "vjhUBzNoKN9cWnf8SRojvX3X5QzZqAJD8JDb6fZKEfP"
  )

  const feeToken = new anchor.web3.PublicKey(
    "Eez6QJBwD9Woe2JSUQuPnGkGrKoQtaZniMbY8Xjv2kcE"
  )

  const breedingMachine = findBreedingMachineAddress(
    parentsCandyMachineAddress,
    rewardsCandyMachineAddress,
    breedingMachineAuthority.publicKey,
    program.programId
  )

  const whitelistToken = findWhitelistTokenAddress(
    breedingMachine,
    program.programId
  )

  const { init, terminate, cancel } = createBreeding(
    program.provider.connection,
    program as any,
    breedingMachine,
    userWallet
  )

  it("should be able to create a new breeding machine", async () => {
    const config = {
      burnParents: false,
      /** breedingTime in seconds */
      breedingTime: new anchor.BN(2),
      rewardSupply: new anchor.BN(3333),
      initializationFeeToken: feeToken,
      initializationFeePrice: new anchor.BN(1),
      rewardCandyMachine: rewardsCandyMachineAddress,
      parentsCandyMachine: parentsCandyMachineAddress,
    }

    const whitelistVault = await anchor.utils.token.associatedAddress({
      mint: whitelistToken,
      owner: breedingMachine,
    })

    const tx = await program.methods
      .createMachine(config)
      .accounts({
        breedingMachine,
        whitelistToken,
        whitelistVault,
        authority: breedingMachineAuthority.publicKey,
      })
      .signers([breedingMachineAuthority])
      .rpc()

    console.log("Your transaction signature", tx)

    const machineAccount = await program.account.breedMachine.fetch(
      breedingMachine
    )

    const wlTokenSupply = await program.provider.connection.getTokenSupply(
      whitelistToken
    )

    const wlVaultBalance =
      await program.provider.connection.getTokenAccountBalance(whitelistVault)

    expect(wlTokenSupply.value.uiAmount).to.equal(3333)
    expect(wlVaultBalance.value.uiAmount).to.equal(3333)
    expect(machineAccount.born.toNumber()).to.equal(0)
    expect(machineAccount.bred.toNumber()).to.equal(0)
  })

  it("should be able to update a machine's config", async () => {
    const newPrice = new anchor.BN(1234)

    const tx = await program.methods
      .updateMachineConfig({
        initializationFeePrice: newPrice,
        breedingTime: new anchor.BN(0),
        burnParents: false,
      })
      .accounts({
        breedingMachine,
        authority: breedingMachineAuthority.publicKey,
      })
      .signers([breedingMachineAuthority])
      .rpc()

    console.log("Your transaction signature:", tx)

    const machineAccount = await program.account.breedMachine.fetch(
      breedingMachine
    )

    expect(machineAccount.config.initializationFeePrice.toNumber()).to.equal(
      1234
    )
  })

  it("should be able to initialize a breeding", async () => {
    const {
      tx,
      userAtaParentA,
      userAtaParentB,
      vaultAtaParentA,
      vaultAtaParentB,
    } = await init(mintParentA, mintParentB, [userWallet])

    console.log("Your transaction signature", tx)

    const userMintABalance =
      await program.provider.connection.getTokenAccountBalance(userAtaParentA)

    const userMintBBalance =
      await program.provider.connection.getTokenAccountBalance(userAtaParentB)

    const breedMintABalance =
      await program.provider.connection.getTokenAccountBalance(vaultAtaParentA)

    const breedMintBBalance =
      await program.provider.connection.getTokenAccountBalance(vaultAtaParentB)

    expect(userMintABalance.value.uiAmount).to.equal(0)
    expect(userMintBBalance.value.uiAmount).to.equal(0)
    expect(breedMintABalance.value.uiAmount).to.equal(1)
    expect(breedMintBBalance.value.uiAmount).to.equal(1)
  })

  it("should be able to terminate a breeding", async () => {
    const { tx, breedData, userWhitelistAta, userAtaParentB, userAtaParentA } =
      await terminate(mintParentA, mintParentB, [userWallet])

    console.log("Your transaction signature", tx)
    const userMintABalance =
      await program.provider.connection.getTokenAccountBalance(userAtaParentA)

    const userMintBBalance =
      await program.provider.connection.getTokenAccountBalance(userAtaParentB)

    const oldBreedAccount = await program.account.breedData.fetchNullable(
      breedData
    )

    const breedMachineAccount = await program.account.breedMachine.fetch(
      breedingMachine
    )

    const userWhitelistTokenBalance =
      await program.provider.connection.getTokenAccountBalance(userWhitelistAta)

    expect(oldBreedAccount).to.be.null
    expect(breedMachineAccount.born.toNumber()).to.greaterThanOrEqual(1)
    expect(breedMachineAccount.bred.toNumber()).to.greaterThanOrEqual(2)
    expect(userMintABalance.value.uiAmount).to.equal(1)
    expect(userMintBBalance.value.uiAmount).to.equal(1)
    expect(userWhitelistTokenBalance.value.uiAmount).to.greaterThanOrEqual(1)
  })

  it("should be able to cancel a breeding", async () => {
    await init(mintParentA, mintParentB, [userWallet])

    const { tx, breedData, userAtaParentB, userAtaParentA } = await cancel(
      mintParentA,
      mintParentB,
      [userWallet]
    )

    console.log("Your transaction signature", tx)

    const userMintABalance =
      await program.provider.connection.getTokenAccountBalance(userAtaParentA)

    const userMintBBalance =
      await program.provider.connection.getTokenAccountBalance(userAtaParentB)

    const oldBreedAccount = await program.account.breedData.fetchNullable(
      breedData
    )

    const breedMachineAccount = await program.account.breedMachine.fetch(
      breedingMachine
    )

    expect(oldBreedAccount).to.be.null
    expect(breedMachineAccount.born.toNumber()).to.greaterThanOrEqual(1)
    expect(breedMachineAccount.bred.toNumber()).to.greaterThanOrEqual(2)
    expect(userMintABalance.value.uiAmount).to.equal(1)
    expect(userMintBBalance.value.uiAmount).to.equal(1)
  })
})
