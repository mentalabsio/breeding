import { Idl, Program, utils, web3, BN } from "@project-serum/anchor"
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  Token,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token"
import { AnchorWallet, WalletContextState } from "@solana/wallet-adapter-react"

const programId = new web3.PublicKey(
  "CikztTpnE9wiNzafzTCSzE4tXKFi5iHcGKzBhpNTiP7p"
)

const incineratorAddress = new web3.PublicKey(
  "1nc1nerator11111111111111111111111111111111"
)

export const findBreedingMachineAddress = (
  parentsCandyMachine: web3.PublicKey,
  rewardCandyMachine: web3.PublicKey,
  breedingProgram: web3.PublicKey
) =>
  utils.publicKey.findProgramAddressSync(
    [
      Buffer.from("breed_machine"),
      parentsCandyMachine.toBuffer(),
      rewardCandyMachine.toBuffer(),
    ],
    breedingProgram
  )[0]

export const findBreedDataAddress = (
  breedMachineAddress: web3.PublicKey,
  mintAddressA: web3.PublicKey,
  mintAddressB: web3.PublicKey,
  breedingProgram: web3.PublicKey
) =>
  utils.publicKey.findProgramAddressSync(
    [
      Buffer.from("breed_account"),
      breedMachineAddress.toBuffer(),
      mintAddressA.toBuffer(),
      mintAddressB.toBuffer(),
    ],
    breedingProgram
  )[0]

export const findWhitelistTokenAddress = (
  breedingMachine: web3.PublicKey,
  breedingProgram: web3.PublicKey
) =>
  utils.publicKey.findProgramAddressSync(
    [Buffer.from("whitelist_token"), breedingMachine.toBuffer()],
    breedingProgram
  )[0]

/**
 * Handles init and terminate breeding
 *
 * @param connection
 * @param breedingProgram
 * @param breedingMachineAddress
 * @param userWallet
 * @returns
 */
export const createBreeding = (
  connection: web3.Connection,
  breedingProgram: Program<Idl>,
  breedingMachineAddress: web3.PublicKey,
  userWallet: WalletContextState | web3.Keypair | AnchorWallet
) => {
  const whitelistToken = findWhitelistTokenAddress(
    breedingMachineAddress,
    programId
  )

  const init = async (
    mintParentA: web3.PublicKey,
    mintParentB: web3.PublicKey,
    signers: web3.Keypair[] = []
  ) => {
    try {
      if (!mintParentA || !mintParentB)
        throw new Error("Mint addresses are missing.")

      const breedingMachineAccount =
        await breedingProgram.account.breedMachine.fetch(breedingMachineAddress)

      const feeToken = breedingMachineAccount.config.initializationFeeToken

      const breedData = findBreedDataAddress(
        breedingMachineAddress,
        mintParentA,
        mintParentB,
        programId
      )

      const userAtaParentA = await utils.token.associatedAddress({
        mint: mintParentA,
        owner: userWallet.publicKey,
      })

      const userAtaParentB = await utils.token.associatedAddress({
        mint: mintParentB,
        owner: userWallet.publicKey,
      })

      const vaultAtaParentA = await utils.token.associatedAddress({
        mint: mintParentA,
        owner: breedData,
      })

      const vaultAtaParentB = await utils.token.associatedAddress({
        mint: mintParentB,
        owner: breedData,
      })

      /**
       * Additional instructions:
       *
       * Create ATA for fee payer if necessary
       * Create ATA for incinerator if necessary
       */
      const additionalInstructions = []

      const feePayerAtaAddress = await utils.token.associatedAddress({
        mint: feeToken,
        owner: userWallet.publicKey,
      })

      const feePayerAtaAccountInfo = await connection.getAccountInfo(
        feePayerAtaAddress
      )

      if (!feePayerAtaAccountInfo) {
        const createAtaInstruction =
          Token.createAssociatedTokenAccountInstruction(
            ASSOCIATED_TOKEN_PROGRAM_ID,
            TOKEN_PROGRAM_ID,
            feeToken,
            feePayerAtaAddress,
            userWallet.publicKey,
            userWallet.publicKey
          )

        additionalInstructions.push(createAtaInstruction)
      }

      const feeIncineratorAtaAddress = await utils.token.associatedAddress({
        mint: feeToken,
        owner: incineratorAddress,
      })

      const feeIncineratorAtaAccountInfo = await connection.getAccountInfo(
        feeIncineratorAtaAddress
      )

      if (!feeIncineratorAtaAccountInfo) {
        const createAtaInstruction =
          Token.createAssociatedTokenAccountInstruction(
            ASSOCIATED_TOKEN_PROGRAM_ID,
            TOKEN_PROGRAM_ID,
            feeToken,
            feeIncineratorAtaAddress,
            incineratorAddress,
            userWallet.publicKey
          )

        additionalInstructions.push(createAtaInstruction)
      }

      // setFeedbackStatus("[Breed] Sending transaction...")
      const tx = await breedingProgram.methods
        .initializeBreeding()
        .accounts({
          breedingMachine: breedingMachineAddress,
          breedData,

          mintParentA,
          userAtaParentA,
          vaultAtaParentA,

          mintParentB,
          userAtaParentB,
          vaultAtaParentB,

          feeToken,
          feePayerAta: feePayerAtaAddress,
          feeIncineratorAta: feeIncineratorAtaAddress,

          userWallet: userWallet.publicKey,
        })
        .preInstructions(additionalInstructions)
        .signers(signers)
        .rpc()

      return {
        tx,
        userAtaParentA,
        userAtaParentB,
        vaultAtaParentA,
        vaultAtaParentB,
      }
    } catch (e) {
      console.log(e)

      throw e
    }
  }

  const terminate = async (
    mintParentA: web3.PublicKey,
    mintParentB: web3.PublicKey,
    signers: web3.Keypair[] = []
  ) => {
    if (!mintParentA || !mintParentB)
      throw new Error("Mint addresses are missing.")

    const breedData = findBreedDataAddress(
      breedingMachineAddress,
      mintParentA,
      mintParentB,
      programId
    )

    const userAtaParentA = await utils.token.associatedAddress({
      mint: mintParentA,
      owner: userWallet.publicKey,
    })

    const userAtaParentB = await utils.token.associatedAddress({
      mint: mintParentB,
      owner: userWallet.publicKey,
    })

    const vaultAtaParentA = await utils.token.associatedAddress({
      mint: mintParentA,
      owner: breedData,
    })

    const vaultAtaParentB = await utils.token.associatedAddress({
      mint: mintParentB,
      owner: breedData,
    })

    const whitelistVault = await utils.token.associatedAddress({
      mint: whitelistToken,
      owner: breedingMachineAddress,
    })

    const userWhitelistAta = await utils.token.associatedAddress({
      mint: whitelistToken,
      owner: userWallet.publicKey,
    })

    const tx = await breedingProgram.methods
      .finalizeBreeding()
      .accounts({
        breedingMachine: breedingMachineAddress,
        breedData,

        mintParentA,
        mintParentB,

        userAtaParentA,
        userAtaParentB,

        vaultAtaParentA,
        vaultAtaParentB,

        whitelistToken,
        whitelistVault,
        userWhitelistAta,

        userWallet: userWallet.publicKey,
      })
      .signers(signers)
      .rpc()

    return { tx, userWhitelistAta, breedData, userAtaParentB, userAtaParentA }
  }

  return { init, terminate }
}