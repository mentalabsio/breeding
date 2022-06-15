import {
  awaitTransactionSignatureConfirmation,
  CandyMachineAccount,
  CANDY_MACHINE_PROGRAM,
  createAccountsForMint,
  getCandyMachineState,
  getCollectionPDA,
  mintOneToken,
} from "@/utils/candy-machine/candy-machine"
import { DEFAULT_TIMEOUT } from "@/utils/candy-machine/connection"
import {
  createAssociatedTokenAccountInstruction,
  getAtaForMint,
  toDate,
} from "@/utils/candy-machine/mint"
import { web3, BN } from "@project-serum/anchor"
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  MintLayout,
  Token,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token"
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react"
import { Commitment, Connection, Keypair, Transaction } from "@solana/web3.js"
import { useCallback, useEffect, useState } from "react"

const candyMachineId = new web3.PublicKey(
  "GjntQcjKbmF6TD5nUvEDJxHF5StsCFAjcj3nnzb2A8Md"
)

export type SetupState = {
  mint: web3.Keypair
  userTokenAccount: web3.PublicKey
  transaction: string
}

export interface AlertState {
  open: boolean
  message: string
  severity: "success" | "info" | "warning" | "error" | undefined
  noHide?: boolean
}

export const useCandyMachine = () => {
  const { connection } = useConnection()
  const anchorWallet = useAnchorWallet()
  const [isUserMinting, setIsUserMinting] = useState(false)
  const [candyMachine, setCandyMachine] = useState<CandyMachineAccount>()

  const [alertState, setAlertState] = useState<AlertState>({
    open: false,
    message: "",
    severity: undefined,
  })
  const [isActive, setIsActive] = useState(false)
  const [endDate, setEndDate] = useState<Date>()
  const [itemsRemaining, setItemsRemaining] = useState<number>()
  const [isPresale, setIsPresale] = useState(false)
  const [discountPrice, setDiscountPrice] = useState<BN>()
  const [needTxnSplit, setNeedTxnSplit] = useState(true)
  const [setupTxn, setSetupTxn] = useState<SetupState>()

  const rpcHost =
    process.env.NEXT_PUBLIC_CONNECTION_NETWORK === "devnet"
      ? process.env.NEXT_PUBLIC_SOLANA_RPC_HOST_DEVNET
      : process.env.NEXT_PUBLIC_SOLANA_RPC_HOST_MAINNET_BETA

  const refreshCandyMachineState = useCallback(
    async (commitment: Commitment = "confirmed") => {
      if (!anchorWallet) {
        return
      }

      const connection = new Connection(rpcHost, commitment)

      if (candyMachineId) {
        try {
          const cndy = await getCandyMachineState(
            anchorWallet,
            candyMachineId,
            connection
          )
          let active =
            cndy?.state.goLiveDate?.toNumber() < new Date().getTime() / 1000
          let presale = false

          // duplication of state to make sure we have the right values!
          let isWLUser = false
          let userPrice = cndy.state.price

          // whitelist mint?
          if (cndy?.state.whitelistMintSettings) {
            // is it a presale mint?
            if (
              cndy.state.whitelistMintSettings.presale &&
              (!cndy.state.goLiveDate ||
                cndy.state.goLiveDate.toNumber() > new Date().getTime() / 1000)
            ) {
              presale = true
            }
            // is there a discount?
            if (cndy.state.whitelistMintSettings.discountPrice) {
              setDiscountPrice(cndy.state.whitelistMintSettings.discountPrice)
              userPrice = cndy.state.whitelistMintSettings.discountPrice
            } else {
              setDiscountPrice(undefined)
              // when presale=false and discountPrice=null, mint is restricted
              // to whitelist users only
              if (!cndy.state.whitelistMintSettings.presale) {
                cndy.state.isWhitelistOnly = true
              }
            }
            // retrieves the whitelist token
            const mint = new web3.PublicKey(
              cndy.state.whitelistMintSettings.mint
            )
            const token = (await getAtaForMint(mint, anchorWallet.publicKey))[0]

            try {
              const balance = await connection.getTokenAccountBalance(token)
              isWLUser = parseInt(balance.value.amount) > 0
              // only whitelist the user if the balance > 0
              // setIsWhitelistUser(isWLUser)

              if (cndy.state.isWhitelistOnly) {
                active = isWLUser && (presale || active)
              }
            } catch (e) {
              // setIsWhitelistUser(false)
              // no whitelist user, no mint
              if (cndy.state.isWhitelistOnly) {
                active = false
              }
              console.log(
                "There was a problem fetching whitelist token balance"
              )
              console.log(e)
            }
          }
          userPrice = isWLUser ? userPrice : cndy.state.price

          if (cndy?.state.tokenMint) {
            // retrieves the SPL token
            const mint = new web3.PublicKey(cndy.state.tokenMint)
            const token = (await getAtaForMint(mint, anchorWallet.publicKey))[0]
            try {
              const balance = await connection.getTokenAccountBalance(token)

              const valid = new BN(balance.value.amount).gte(userPrice)

              // only allow user to mint if token balance >  the user if the balance > 0
              // setIsValidBalance(valid)
              active = active && valid
            } catch (e) {
              // setIsValidBalance(false)
              active = false
              // no whitelist user, no mint
              console.log("There was a problem fetching SPL token balance")
              console.log(e)
            }
          } else {
            const balance = new BN(
              await connection.getBalance(anchorWallet.publicKey)
            )
            const valid = balance.gte(userPrice)
            // setIsValidBalance(valid)
            active = active && valid
          }

          // datetime to stop the mint?
          if (cndy?.state.endSettings?.endSettingType.date) {
            setEndDate(toDate(cndy.state.endSettings.number))
            if (
              cndy.state.endSettings.number.toNumber() <
              new Date().getTime() / 1000
            ) {
              active = false
            }
          }
          // amount to stop the mint?
          if (cndy?.state.endSettings?.endSettingType.amount) {
            let limit = Math.min(
              cndy.state.endSettings.number.toNumber(),
              cndy.state.itemsAvailable
            )
            if (cndy.state.itemsRedeemed < limit) {
              setItemsRemaining(limit - cndy.state.itemsRedeemed)
            } else {
              setItemsRemaining(0)
              cndy.state.isSoldOut = true
            }
          } else {
            setItemsRemaining(cndy.state.itemsRemaining)
          }

          if (cndy.state.isSoldOut) {
            active = false
          }

          const [collectionPDA] = await getCollectionPDA(candyMachineId)
          const collectionPDAAccount = await connection.getAccountInfo(
            collectionPDA
          )

          setIsActive((cndy.state.isActive = active))
          setIsPresale((cndy.state.isPresale = presale))
          setCandyMachine(cndy)

          const txnEstimate =
            892 +
            (!!collectionPDAAccount && cndy.state.retainAuthority ? 182 : 0) +
            (cndy.state.tokenMint ? 66 : 0) +
            (cndy.state.whitelistMintSettings ? 34 : 0) +
            (cndy.state.whitelistMintSettings?.mode?.burnEveryTime ? 34 : 0) +
            (cndy.state.gatekeeper ? 33 : 0) +
            (cndy.state.gatekeeper?.expireOnUse ? 66 : 0)

          setNeedTxnSplit(txnEstimate > 1230)
        } catch (e) {
          if (e instanceof Error) {
            if (e.message === `Account does not exist ${candyMachineId}`) {
              setAlertState({
                open: true,
                message: `Couldn't fetch candy machine state from candy machine with address: ${candyMachineId}, using rpc: ${rpcHost}! You probably typed the REACT_APP_CANDY_MACHINE_ID value in wrong in your .env file, or you are using the wrong RPC!`,
                severity: "error",
              })
            } else if (
              e.message.startsWith("failed to get info about account")
            ) {
              setAlertState({
                open: true,
                message: `Couldn't fetch candy machine state with rpc: ${rpcHost}! This probably means you have an issue with the REACT_APP_SOLANA_RPC_HOST value in your .env file, or you are not using a custom RPC!`,
                severity: "error",
              })
            }
          } else {
            setAlertState({
              open: true,
              message: `${e}`,
              severity: "error",
            })
          }
          console.log(e)
        }
      } else {
        setAlertState({
          open: true,
          message: `Your REACT_APP_CANDY_MACHINE_ID value in the .env file doesn't look right! Make sure you enter it in as plain base-58 address!`,
          severity: "error",
        })
      }
    },
    [anchorWallet, candyMachineId, rpcHost]
  )

  useEffect(() => {
    refreshCandyMachineState()
  }, [anchorWallet, candyMachineId, connection, refreshCandyMachineState])

  useEffect(() => {
    ;(function loop() {
      setTimeout(() => {
        refreshCandyMachineState()
        loop()
      }, 20000)
    })()
  }, [refreshCandyMachineState])

  const onMint = async (
    beforeTransactions: Transaction[] = [],
    afterTransactions: Transaction[] = []
  ) => {
    try {
      setIsUserMinting(true)
      document.getElementById("#identity")?.click()
      if (candyMachine?.program && anchorWallet.publicKey) {
        let setupMint: SetupState | undefined
        if (needTxnSplit && setupTxn === undefined) {
          setAlertState({
            open: true,
            message: "Please sign account setup transaction",
            severity: "info",
          })
          setupMint = await createAccountsForMint(
            candyMachine,
            anchorWallet.publicKey
          )
          let status: any = { err: true }
          if (setupMint.transaction) {
            status = await awaitTransactionSignatureConfirmation(
              setupMint.transaction,
              DEFAULT_TIMEOUT,
              connection,
              true
            )
          }
          if (status && !status.err) {
            setSetupTxn(setupMint)
            setAlertState({
              open: true,
              message:
                "Setup transaction succeeded! Please sign minting transaction",
              severity: "info",
            })
          } else {
            setAlertState({
              open: true,
              message: "Mint failed! Please try again!",
              severity: "error",
            })
            setIsUserMinting(false)
            return
          }
        } else {
          setAlertState({
            open: true,
            message: "Please sign minting transaction",
            severity: "info",
          })
        }

        let mintResult = await mintOneToken(
          candyMachine,
          anchorWallet.publicKey,
          beforeTransactions,
          afterTransactions,
          setupMint ?? setupTxn
        )

        let status: any = { err: true }
        let metadataStatus = null
        if (mintResult) {
          status = await awaitTransactionSignatureConfirmation(
            mintResult.mintTxId,
            DEFAULT_TIMEOUT,
            connection,
            true
          )

          metadataStatus =
            await candyMachine.program.provider.connection.getAccountInfo(
              mintResult.metadataKey,
              "processed"
            )
          console.log("Metadata status: ", !!metadataStatus)
        }

        if (status && !status.err && metadataStatus) {
          // manual update since the refresh might not detect
          // the change immediately
          let remaining = itemsRemaining! - 1
          setItemsRemaining(remaining)
          setIsActive((candyMachine.state.isActive = remaining > 0))
          candyMachine.state.isSoldOut = remaining === 0
          setSetupTxn(undefined)
          setAlertState({
            open: true,
            message: "Congratulations! Mint succeeded!",
            severity: "success",
          })
          refreshCandyMachineState("processed")
        } else if (status && !status.err) {
          setAlertState({
            open: true,
            message:
              "Mint likely failed! Anti-bot SOL 0.01 fee potentially charged! Check the explorer to confirm the mint failed and if so, make sure you are eligible to mint before trying again.",
            severity: "error",
          })
          refreshCandyMachineState()
        } else {
          setAlertState({
            open: true,
            message: "Mint failed! Please try again!",
            severity: "error",
          })
          refreshCandyMachineState()
        }
      }
    } catch (error: any) {
      let message = error.msg || "Minting failed! Please try again!"
      if (!error.msg) {
        if (!error.message) {
          message = "Transaction timeout! Please try again."
        } else if (error.message.indexOf("0x137")) {
          console.log(error)
          message = `SOLD OUT!`
        } else if (error.message.indexOf("0x135")) {
          message = `Insufficient funds to mint. Please fund your anchorWallet.`
        }
      } else {
        if (error.code === 311) {
          console.log(error)
          message = `SOLD OUT!`
          window.location.reload()
        } else if (error.code === 312) {
          message = `Minting period hasn't started yet.`
        }
      }

      setAlertState({
        open: true,
        message,
        severity: "error",
      })
      // updates the candy machine state to reflect the latest
      // information on chain
      refreshCandyMachineState()
    } finally {
      setIsUserMinting(false)
    }
  }

  return {
    onMint,
    candyMachine,
    alertState,
  }
}
