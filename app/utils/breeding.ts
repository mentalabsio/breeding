import { utils, web3 } from "@project-serum/anchor"

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
