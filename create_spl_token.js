const { web3, utils } = require("@project-serum/anchor")
const { readFile } = require("fs/promises")
const {
  createMint,
  mintTo,
  createAssociatedTokenAccount,
} = require("@solana/spl-token")

;(async () => {
  const os = require("os")

  console.log()
  const pkString = (
    await readFile(os.homedir() + "/.config/solana/id.json")
  ).toString()

  const pkArray = pkString
    .replace("[", "")
    .replace("]", "")
    .split(",")
    .map(Number)

  const keyPair = web3.Keypair.fromSecretKey(new Uint8Array(pkArray))

  const connection = new web3.Connection("http://127.0.0.1:8899", "confirmed")

  console.log("Creating mint...")
  const mint = await createMint(
    connection,
    keyPair,
    keyPair.publicKey,
    keyPair.publicKey,
    9
  )

  const ataAddress = await utils.token.associatedAddress({
    mint,
    owner: keyPair.publicKey,
  })

  console.log("Fetching acc...")
  const ataAccountInfo = await connection.getAccountInfo(ataAddress)

  if (!ataAccountInfo) {
    console.log("Creating ATA...")
    await createAssociatedTokenAccount(
      connection,
      keyPair,
      mint,
      keyPair.publicKey
    )
  }

  console.log("Minting..")
  const qty = 100000
  await mintTo(connection, keyPair, mint, ataAddress, keyPair, qty)

  console.log(`Minted ${qty} ${mint} to ${keyPair.publicKey}!`)
})()
