const { web3, utils } = require("@project-serum/anchor")
const { readFile } = require("fs/promises")
const { mintTo, createAssociatedTokenAccount } = require("@solana/spl-token")

/**
 * Given a mint and a destination wallet, it creates an ATA and mints 1 ** 9 tokens to the destination.
 *
 * Usage:
 *
 * node mint_to.js <mint_addr> <destination_wallet_addr>
 */
;(async () => {
  const os = require("os")

  /**
   * Mint authority keypair
   */
  const pkString = (
    await readFile(os.homedir() + "/.config/solana/anchor.json")
  ).toString()

  const pkArray = pkString
    .replace("[", "")
    .replace("]", "")
    .split(",")
    .map(Number)

  const keyPair = web3.Keypair.fromSecretKey(new Uint8Array(pkArray))

  const connection = new web3.Connection("http://127.0.0.1:8899", "confirmed")

  const args = process.argv.slice(2)

  const mint = new web3.PublicKey(args[0])
  const destinationWallet = new web3.PublicKey(args[1])

  console.log(destinationWallet.toString())

  const ataAddress = await utils.token.associatedAddress({
    mint,
    owner: destinationWallet,
  })

  console.log("Fetching acc...")
  const ataAccountInfo = await connection.getAccountInfo(ataAddress)

  if (!ataAccountInfo) {
    console.log("Creating ATA...")
    await createAssociatedTokenAccount(
      connection,
      keyPair,
      mint,
      destinationWallet
    )
  }

  console.log("Minting..")
  const qty = 10 ** 10
  await mintTo(connection, keyPair, mint, ataAddress, keyPair, qty)

  console.log(`Minted ${qty} ${mint} to ${destinationWallet}!`)
})()
