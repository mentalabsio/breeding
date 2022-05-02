import { Provider, utils, web3, BN, Program, Idl } from "@project-serum/anchor"
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react"
import { useCallback, useEffect, useState } from "react"
import {
  findBreedingMachineAddress,
  findWhitelistTokenAddress,
} from "@/utils/breeding"
import { createBreeding } from "@/utils/breeding"
import { getNFTMetadata } from "@/utils/nfts"
import { useCandyMachine } from "../useCandyMachine"

const parentsCandyMachineAddress = new web3.PublicKey(
  "9bBjPXwFVzPSEA4BH2wFfDnzYTekQq6itf6JBNvzRW2C"
)

const rewardsCandyMachineAddress = new web3.PublicKey(
  "EuhcFYpMXoDUgTKNTmBEx3gtuaMpKgMTZ5ZBztbwL32Q"
)

const feeToken = new web3.PublicKey(
  "EmNtV2uNxC8kyGXSpLi8uLfgrmiTfEUhho4aqwUZdtMZ"
)

const programId = new web3.PublicKey(
  "GD3hCzdGedt7MQLKCcMebGQ1suNHdZedL24KjYyH7wTG"
)

const breedingMachineAuthority = new web3.PublicKey(
  "ViVDtpVYKdhRRH9FTKsh6reJB9xXUqpX1233BSDZWRQ"
)

export const useBreeding = () => {
  const { connection } = useConnection()
  const anchorWallet = useAnchorWallet()
  const { alertState, onMint, getInstructionsForSetupAccounts } =
    useCandyMachine()

  const [anchorProgram, setAnchorProgram] = useState<Program<Idl>>(null)
  const [breedingMachineAccount, setBreedingMachineAccount] = useState(null)
  const [userBreedDatas, setUserBreedDatas] = useState(null)
  const [feedbackStatus, setFeedbackStatus] = useState("")
  const [userTokenBalance, setUserTokenBalance] = useState(null)

  /**
   * Fetch IDL, breeding machine and breed datas on mount
   */
  const fetchData = useCallback(async () => {
    console.log("[useBreeding] Fetching breeding machine and breed datas...")
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
      setFeedbackStatus("Fetching breeding machine...")

      const breedingMachine = findBreedingMachineAddress(
        parentsCandyMachineAddress,
        rewardsCandyMachineAddress,
        /** Authority pubkey */
        breedingMachineAuthority,
        programId
      )

      // const whitelistToken = findWhitelistTokenAddress(
      //   breedingMachine,
      //   programId
      // )

      const machineAccount = await anchorProgram.account.breedMachine.fetch(
        breedingMachine
      )

      setBreedingMachineAccount(machineAccount)

      setFeedbackStatus("Fetching user token account...")

      const addr = await utils.token.associatedAddress({
        mint: machineAccount?.config.initializationFeeToken,
        owner: anchorWallet.publicKey,
      })

      const balance = await connection.getTokenAccountBalance(addr)
      setUserTokenBalance(balance.value.uiAmount.toLocaleString())
    } catch (e) {
      console.error("Couldn't fetch breeding machine!" + e)
    }

    setFeedbackStatus("Fetching user breedings...")
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
        if (breedData.owner.toString() === anchorWallet.publicKey.toString()) {
          return breedData
        }

        return null
        /** Error will be throwed if discriminator is invalid (not a breedData account) */
      } catch (e) {
        return null
      }
    })

    const breedDatas = (await Promise.all(userBreedDatasPromises)).filter(
      (value) => value !== null
    )

    const withNFTs = breedDatas.map(async (breedData) => {
      const metadatas = await Promise.all([
        getNFTMetadata(breedData.mintA, connection),
        getNFTMetadata(breedData.mintB, connection),
      ])

      return { breedData, metadatas }
    })

    const breedDatasWithNFTs = (await Promise.all(withNFTs)).filter(
      (value) => value !== null
    )

    setUserBreedDatas(breedDatasWithNFTs)
    setFeedbackStatus("")
  }, [connection, anchorWallet])

  useEffect(() => {
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
      rewardCandyMachine: rewardsCandyMachineAddress,
      parentsCandyMachine: parentsCandyMachineAddress,
    }

    const breedingMachine = findBreedingMachineAddress(
      parentsCandyMachineAddress,
      rewardsCandyMachineAddress,
      /** Authority pubkey */
      breedingMachineAuthority,
      programId
    )

    const whitelistToken = findWhitelistTokenAddress(breedingMachine, programId)

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

      const breedingMachine = findBreedingMachineAddress(
        parentsCandyMachineAddress,
        rewardsCandyMachineAddress,
        /** Authority pubkey */
        breedingMachineAuthority,
        programId
      )

      const { init } = createBreeding(
        connection,
        anchorProgram,
        breedingMachine,
        anchorWallet
      )

      setFeedbackStatus("[Breed] Initializing...")

      const { tx } = await init(mintParentA, mintParentB)

      setFeedbackStatus("[Breed] Confirming transaction...")

      await connection.confirmTransaction(tx, "confirmed")

      setFeedbackStatus("[Breed] Refetching data...")

      await fetchData()

      setFeedbackStatus("Success!")

      setTimeout(() => {
        setFeedbackStatus("")
      }, 6000)
    } catch (e) {
      console.log(e)

      setFeedbackStatus("Something went wrong. " + e + "")

      setTimeout(() => {
        fetchData()
      }, 6000)
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

      const breedingMachine = findBreedingMachineAddress(
        parentsCandyMachineAddress,
        rewardsCandyMachineAddress,
        /** Authority pubkey */
        breedingMachineAuthority,
        programId
      )

      const { terminate } = createBreeding(
        connection,
        anchorProgram,
        breedingMachine,
        anchorWallet
      )

      setFeedbackStatus("[Breed] Terminating...")

      const setupState = await getInstructionsForSetupAccounts(
        anchorWallet.publicKey
      )

      const { tx } = await terminate(
        mintParentA,
        mintParentB,
        [setupState.mint],
        setupState.instructions
      )

      setFeedbackStatus("[Breed] Confirming transaction...")

      await connection.confirmTransaction(tx, "confirmed")

      /**
       * @TODO MUST REMOVE the mint from here if there is locktime
       */
      setFeedbackStatus("[Breed] Awaiting approval to mint the new NFT...")

      await onMint({ setupMint: setupState.mint })

      setFeedbackStatus("[Breed] Refetching data...")

      await fetchData()

      setFeedbackStatus("Success!")

      setTimeout(() => {
        setFeedbackStatus("")
      }, 6000)
    } catch (e) {
      console.log(e)

      setFeedbackStatus("Something went wrong. " + e + "")

      setTimeout(() => {
        fetchData()
      }, 6000)
    }
  }

  return {
    initializeBreeding,
    terminateBreeding,
    initializeBreedingMachine,
    onMint,
    breedingMachineAccount,
    userBreedDatas,
    feedbackStatus,
    userTokenBalance,
  }
}
