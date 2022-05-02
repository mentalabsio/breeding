import { programs } from "@metaplex/js"
import { Idl, Program, utils, web3 } from "@project-serum/anchor"
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  Token,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token"
import { AnchorWallet, WalletContextState } from "@solana/wallet-adapter-react"
import { TransactionInstruction } from "@solana/web3.js"

const incineratorAddress = new web3.PublicKey(
  "1nc1nerator11111111111111111111111111111111"
)

export const findBreedingMachineAddress = (
  parentsCandyMachine: web3.PublicKey,
  rewardCandyMachine: web3.PublicKey,
  authority: web3.PublicKey,
  breedingProgram: web3.PublicKey
) =>
  utils.publicKey.findProgramAddressSync(
    [
      Buffer.from("breed_machine"),
      parentsCandyMachine.toBuffer(),
      rewardCandyMachine.toBuffer(),
      authority.toBuffer(),
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
    breedingProgram.programId
  )

  /**
   * Calls init method through RPC
   */
  const init = async (
    mintParentA: web3.PublicKey,
    mintParentB: web3.PublicKey,
    signers: web3.Keypair[] = []
  ) => {
    try {
      if (!mintParentA || !mintParentB)
        throw new Error("Mint addresses are missing.")

      const {
        instruction,
        userAtaParentA,
        userAtaParentB,
        vaultAtaParentA,
        vaultAtaParentB,
      } = await getInitInstruction(mintParentA, mintParentB, signers)

      const tx = await instruction.rpc()

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

  /**
   * Returns instruction for init method
   */
  const getInitInstruction = async (
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
        breedingProgram.programId
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

      const metadataParentA = await programs.metadata.Metadata.getPDA(
        mintParentA
      )
      const metadataParentB = await programs.metadata.Metadata.getPDA(
        mintParentB
      )

      // setFeedbackStatus("[Breed] Sending transaction...")
      const instruction = breedingProgram.methods
        .initializeBreeding()
        .accounts({
          breedingMachine: breedingMachineAddress,
          breedData,

          mintParentA,
          metadataParentA,
          userAtaParentA,
          vaultAtaParentA,

          mintParentB,
          metadataParentB,
          userAtaParentB,
          vaultAtaParentB,

          feeToken,
          feePayerAta: feePayerAtaAddress,
          feeIncineratorAta: feeIncineratorAtaAddress,

          userWallet: userWallet.publicKey,
        })
        .preInstructions(additionalInstructions)
        .signers(signers)

      return {
        instruction,
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

  /**
   * Calls terminate method through RPC
   */
  const terminate = async (
    mintParentA: web3.PublicKey,
    mintParentB: web3.PublicKey,
    signers: web3.Keypair[] = []
  ) => {
    if (!mintParentA || !mintParentB)
      throw new Error("Mint addresses are missing.")

    const {
      instruction,
      userWhitelistAta,
      breedData,
      userAtaParentB,
      userAtaParentA,
    } = await getTerminateInstruction(mintParentA, mintParentB, signers)

    const tx = await instruction.rpc()
    return { tx, userWhitelistAta, breedData, userAtaParentB, userAtaParentA }
  }

  /**
   * Returns instruction for terminate method
   */
  const getTerminateInstruction = async (
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
      breedingProgram.programId
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

    /**
     * Additional instructions:
     *
     * Create userWhitelistAta
     */
    const additionalInstructions = []

    const userWhitelistAtaAccountInfo = await connection.getAccountInfo(
      userWhitelistAta
    )

    if (!userWhitelistAtaAccountInfo) {
      const createAtaInstruction =
        Token.createAssociatedTokenAccountInstruction(
          ASSOCIATED_TOKEN_PROGRAM_ID,
          TOKEN_PROGRAM_ID,
          whitelistToken,
          userWhitelistAta,
          userWallet.publicKey,
          userWallet.publicKey
        )

      additionalInstructions.push(createAtaInstruction)
    }

    const instruction = breedingProgram.methods
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
      .preInstructions(additionalInstructions)
      .signers(signers)

    return {
      instruction,
      userWhitelistAta,
      breedData,
      userAtaParentB,
      userAtaParentA,
    }
  }

  const cancel = async (
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
      breedingProgram.programId
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

    const tx = await breedingProgram.methods
      .cancelBreeding()
      .accounts({
        breedingMachine: breedingMachineAddress,
        breedData,

        mintParentA,
        mintParentB,

        userAtaParentA,
        userAtaParentB,

        vaultAtaParentA,
        vaultAtaParentB,

        userWallet: userWallet.publicKey,
      })
      .signers(signers)
      .rpc()

    return { tx, breedData, userAtaParentB, userAtaParentA }
  }

  return {
    init,
    terminate,
    cancel,
    getTerminateInstruction,
    getInitInstruction,
  }
}
