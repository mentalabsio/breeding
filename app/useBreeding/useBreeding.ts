import { Provider, utils, web3, BN, Program, Idl } from "@project-serum/anchor"
// @ts-ignore
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  Token,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token"
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react"
import { useEffect, useState } from "react"
import {
  findBreedDataAddress,
  findBreedingMachineAddress,
  findWhitelistTokenAddress,
} from "../utils/breeding"

const candyMachineAddress = new web3.PublicKey(
  "2foGcTHZ2C9c5xQrBopgLyNxQ33rdSxwDXqHJbv34Fvs"
)

const incineratorAddress = new web3.PublicKey(
  "1nc1nerator11111111111111111111111111111111"
)

const feeToken = new web3.PublicKey(
  "EmNtV2uNxC8kyGXSpLi8uLfgrmiTfEUhho4aqwUZdtMZ"
)

const programId = new web3.PublicKey(
  "CikztTpnE9wiNzafzTCSzE4tXKFi5iHcGKzBhpNTiP7p"
)

const breedingMachine = findBreedingMachineAddress(
  candyMachineAddress,
  candyMachineAddress,
  programId
)

const whitelistToken = findWhitelistTokenAddress(breedingMachine, programId)

export const useBreeding = () => {
  const { connection } = useConnection()
  const anchorWallet = useAnchorWallet()
  const [anchorProgram, setAnchorProgram] = useState<Program<Idl>>(null)
  const [breedingMachineAccount, setBreedingMachineAccount] = useState(null)
  const [userBreedDatas, setUserBreedDatas] = useState(null)
  const [feedbackStatus, setFeedbackStatus] = useState("")

  /**
   * Fetch IDL, breeding machine and breed datas on mount
   */
  useEffect(() => {
    const fetchData = async () => {
      setFeedbackStatus("Fetching program...")
      const provider = new Provider(connection, anchorWallet, {
        preflightCommitment: "recent",
      })

      const idl = await Program.fetchIdl(programId, provider)

      if (!idl)
        throw new Error(
          "No idl with address " +
            programId.toString() +
            " has been found on " +
            process.env.NEXT_PUBLIC_CONNECTION_NETWORK +
            "."
        )

      const anchorProgram = new Program(idl, programId, provider)

      setAnchorProgram(anchorProgram)

      try {
        setFeedbackStatus("Fething breeding machine...")

        const machineAccount = await anchorProgram.account.breedMachine.fetch(
          breedingMachine
        )

        setBreedingMachineAccount(machineAccount)
      } catch (e) {
        console.error("Couldn't fetch breeding machine!" + e)
      }

      setFeedbackStatus("Fetching breeds...")
      /** Fetch all program accounts */
      const programAccs = await connection.getProgramAccounts(programId)

      // try {
      //   const multiple = await anchorProgram.account.breedData.fetchMultiple(
      //     programAccs.map((programAcc) => programAcc.pubkey)
      //   )

      //   console.log(multiple)
      // } catch (e) {
      //   console.log(e)
      // }

      /** Get user breed datas */
      const userBreedDatasPromises = programAccs.map(async (acc) => {
        try {
          /** Try to fetch breed data account using the program account address */
          const breedData = await anchorProgram.account.breedData.fetch(
            acc.pubkey
          )

          /** Return if the user wallet is the owner */
          if (
            breedData.owner.toString() === anchorWallet.publicKey.toString()
          ) {
            return breedData
          }

          return null
        } catch (e) {
          /** Error will be throwed if discriminator is invalid */
          console.log(e)

          return null
        }
      })

      const breedDatas = (await Promise.all(userBreedDatasPromises)).filter(
        (value) => value !== null
      )

      setUserBreedDatas(breedDatas)
      setFeedbackStatus("")
      console.log(breedDatas)
    }

    if (connection && anchorWallet?.publicKey) {
      fetchData()
    }
  }, [connection, anchorWallet])

  const initializeBreedingMachine = async () => {
    const config = {
      burnParents: false,
      breedingTime: new BN(1),
      rewardSupply: new BN(3333),
      initializationFeeToken: feeToken,
      initializationFeePrice: new BN(1),
      rewardCandyMachine: candyMachineAddress,
      parentsCandyMachine: candyMachineAddress,
    }

    const whitelistVault = await utils.token.associatedAddress({
      mint: whitelistToken,
      owner: breedingMachine,
    })

    const tx = await anchorProgram.methods
      .createMachine(config)
      .accounts({
        breedingMachine,
        whitelistToken,
        whitelistVault,
        authority: anchorWallet.publicKey,
      })
      .rpc()

    console.log(tx)
  }

  const initializeBreeding = async (
    mintParentA: web3.PublicKey,
    mintParentB: web3.PublicKey
  ) => {
    try {
      if (!anchorProgram) throw new Error("Anchor program is not initialized.")

      if (!mintParentA || !mintParentB)
        throw new Error("Mint addresses are missing.")

      // setFeedbackStatus("[Breed] Initializing...")

      const breedData = findBreedDataAddress(
        breedingMachine,
        mintParentA,
        mintParentB,
        anchorProgram.programId
      )

      const userAtaParentA = await utils.token.associatedAddress({
        mint: mintParentA,
        owner: anchorWallet.publicKey,
      })

      const userAtaParentB = await utils.token.associatedAddress({
        mint: mintParentB,
        owner: anchorWallet.publicKey,
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
        owner: anchorWallet.publicKey,
      })

      // setFeedbackStatus("[Breed] Fetching accounts...")
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
            anchorWallet.publicKey,
            anchorWallet.publicKey
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
            anchorWallet.publicKey
          )

        additionalInstructions.push(createAtaInstruction)
      }

      const feePrice = new BN(1000000000)

      // setFeedbackStatus("[Breed] Sending transaction...")
      const tx = await anchorProgram.methods
        .initializeBreeding(feePrice)
        .accounts({
          breedingMachine,
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

          userWallet: anchorWallet.publicKey,
        })
        .preInstructions(additionalInstructions)
        .signers([])
        .rpc()

      console.log(tx)

      // setFeedbackStatus("[Breed] Confirming transaction...")

      await connection.confirmTransaction(tx, "confirmed")

      // setFeedbackStatus("Success!")

      setTimeout(() => {
        // setFeedbackStatus("")
      }, 6000)
    } catch (e) {
      console.log(e)

      // setFeedbackStatus("Something went wrong. " + e + "")
    }
  }

  const terminateBreeding = async (
    mintParentA: web3.PublicKey,
    mintParentB: web3.PublicKey
  ) => {
    try {
      if (!anchorProgram) throw new Error("Anchor program is not initialized.")

      if (!mintParentA || !mintParentB)
        throw new Error("Mint addresses are missing.")

      setFeedbackStatus("[Breed] Terminating...")

      const breedData = findBreedDataAddress(
        breedingMachine,
        mintParentA,
        mintParentB,
        anchorProgram.programId
      )

      const userAtaParentA = await utils.token.associatedAddress({
        mint: mintParentA,
        owner: anchorWallet.publicKey,
      })

      const userAtaParentB = await utils.token.associatedAddress({
        mint: mintParentB,
        owner: anchorWallet.publicKey,
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
        owner: breedingMachine,
      })

      const userWhitelistAta = await utils.token.associatedAddress({
        mint: whitelistToken,
        owner: anchorWallet.publicKey,
      })

      setFeedbackStatus("[Breed] Sending transaction...")
      const tx = await anchorProgram.methods
        .finalizeBreeding()
        .accounts({
          breedingMachine,
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

          userWallet: anchorWallet.publicKey,
        })
        .signers([])
        .rpc()

      console.log(tx)

      setFeedbackStatus("[Breed] Confirming transaction...")

      await connection.confirmTransaction(tx, "confirmed")

      setFeedbackStatus("Success!")

      setTimeout(() => {
        setFeedbackStatus("")
      }, 6000)
    } catch (e) {
      console.log(e)

      setFeedbackStatus("Something went wrong. " + e + "")
    }
  }

  return {
    initializeBreeding,
    terminateBreeding,
    initializeBreedingMachine,
    breedingMachineAccount,
    userBreedDatas,
    feedbackStatus,
  }
}
