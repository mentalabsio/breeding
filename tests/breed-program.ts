import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import * as splToken from "@solana/spl-token";
import { expect } from "chai";

import { BreedProgram } from "../target/types/breed_program";

const findBreedMachineAddress = (
  parentsCandyMachine: anchor.web3.PublicKey,
  childrenCandyMachine: anchor.web3.PublicKey,
  authority: anchor.web3.PublicKey,
  breedingProgram: anchor.web3.PublicKey
) =>
  anchor.utils.publicKey.findProgramAddressSync(
    [
      Buffer.from("breed_machine"),
      parentsCandyMachine.toBuffer(),
      childrenCandyMachine.toBuffer(),
      authority.toBuffer(),
    ],
    breedingProgram
  )[0];

const findBreedDataAddress = (
  breedMachineAddress: anchor.web3.PublicKey,
  mintAddressA: anchor.web3.PublicKey,
  mintAddressB: anchor.web3.PublicKey,
  breedingProgram: anchor.web3.PublicKey
) =>
  anchor.utils.publicKey.findProgramAddressSync(
    [
      Buffer.from("breed_account"),
      breedMachineAddress.toBuffer(),
      mintAddressA.toBuffer(),
      mintAddressB.toBuffer(),
    ],
    breedingProgram
  )[0];

describe("breed-program", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.Provider.env());

  const program = anchor.workspace.BreedProgram as Program<BreedProgram>;

  const candyMachineAddress = new anchor.web3.PublicKey(
    "2foGcTHZ2C9c5xQrBopgLyNxQ33rdSxwDXqHJbv34Fvs"
  );

  const incineratorAddress = new anchor.web3.PublicKey(
    "1nc1nerator11111111111111111111111111111111"
  );

  const authority = anchor.web3.Keypair.fromSecretKey(
    anchor.utils.bytes.bs58.decode(
      "2YFHVfWEbNAFJtJ2z2ENTfZXcpD982ggcKvZtmKhUz3o7Tm1fS5JSDf4se2xxjjvj2ykqF4t6QnjRwGxznaN82Ru"
    )
  );

  const userWallet = anchor.web3.Keypair.fromSecretKey(
    anchor.utils.bytes.bs58.decode(
      "32Y9pum9ncAAhtGtadt7jMwUyYEHUzNbnKtB1rveBA1h6r2ttsnZm7XRnBs5RVQjcuwTj41mnTAkMAnJaWgsjuBA"
    )
  );

  const mintParentA = new anchor.web3.PublicKey(
    "4kZVPqN3b2CFUniF8bBdex32ziQ3FxbxhNYT3teV7Jkx"
  );
  const mintParentB = new anchor.web3.PublicKey(
    "2Z8esbcvecdEDXp6Py3HW3th9CAUJtTW5Df3Lz1m6qJC"
  );
  const feeToken = new anchor.web3.PublicKey(
    "NEpinL3xGXUpDeLdiJmVAoMGHXVF6BjsPHV6HRtNZDh"
  );

  const breedingMachine = findBreedMachineAddress(
    candyMachineAddress,
    candyMachineAddress,
    authority.publicKey,
    program.programId
  );

  it("should be able to create a new breeding machine", async () => {
    const config = {
      cooldown: new anchor.BN(0),
      burnParents: false,
      childrenCandyMachine: candyMachineAddress,
      parentsCandyMachine: candyMachineAddress,
    };

    const tx = await program.methods
      .createMachine(config)
      .accounts({
        breedingMachine,
        authority: authority.publicKey,
      })
      .signers([authority])
      .rpc();

    console.log("Your transaction signature", tx);

    const machineAccount = await program.account.breedMachine.fetch(
      breedingMachine
    );

    expect(machineAccount.born.toNumber()).to.equal(0);
    expect(machineAccount.bred.toNumber()).to.equal(0);
  });

  it("should be able to initialize a breeding", async () => {
    const breedData = findBreedDataAddress(
      breedingMachine,
      mintParentA,
      mintParentB,
      program.programId
    );

    const userAtaParentA = await anchor.utils.token.associatedAddress({
      mint: mintParentA,
      owner: userWallet.publicKey,
    });

    const userAtaParentB = await anchor.utils.token.associatedAddress({
      mint: mintParentB,
      owner: userWallet.publicKey,
    });

    const vaultAtaParentA = await anchor.utils.token.associatedAddress({
      mint: mintParentA,
      owner: breedData,
    });

    const vaultAtaParentB = await anchor.utils.token.associatedAddress({
      mint: mintParentB,
      owner: breedData,
    });

    const feePayerAta = await anchor.utils.token.associatedAddress({
      mint: feeToken,
      owner: userWallet.publicKey,
    });

    const feeIncineratorAta = (
      await splToken.getOrCreateAssociatedTokenAccount(
        program.provider.connection,
        userWallet,
        feeToken,
        incineratorAddress,
        true
      )
    ).address;

    const feePrice = new anchor.BN(1);

    const tx = await program.methods
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
        feePayerAta,
        feeIncineratorAta,

        userWallet: userWallet.publicKey,
      })
      .signers([userWallet])
      .rpc();

    console.log("Your transaction signature", tx);

    const userMintABalance =
      await program.provider.connection.getTokenAccountBalance(userAtaParentA);

    const userMintBBalance =
      await program.provider.connection.getTokenAccountBalance(userAtaParentB);

    const breedMintABalance =
      await program.provider.connection.getTokenAccountBalance(vaultAtaParentA);

    const breedMintBBalance =
      await program.provider.connection.getTokenAccountBalance(vaultAtaParentB);

    const breedMachineAccount = await program.account.breedMachine.fetch(
      breedingMachine
    );

    expect(breedMachineAccount.bred.toNumber()).to.equal(2);
    expect(userMintABalance.value.uiAmount).to.equal(0);
    expect(userMintBBalance.value.uiAmount).to.equal(0);
    expect(breedMintABalance.value.uiAmount).to.equal(1);
    expect(breedMintBBalance.value.uiAmount).to.equal(1);
  });

  it("should be able to terminate a breeding", async () => {
    const breedData = findBreedDataAddress(
      breedingMachine,
      mintParentA,
      mintParentB,
      program.programId
    );

    const userAtaParentA = await anchor.utils.token.associatedAddress({
      mint: mintParentA,
      owner: userWallet.publicKey,
    });

    const userAtaParentB = await anchor.utils.token.associatedAddress({
      mint: mintParentB,
      owner: userWallet.publicKey,
    });

    const vaultAtaParentA = await anchor.utils.token.associatedAddress({
      mint: mintParentA,
      owner: breedData,
    });

    const vaultAtaParentB = await anchor.utils.token.associatedAddress({
      mint: mintParentB,
      owner: breedData,
    });

    const tx = await program.methods
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

        userWallet: userWallet.publicKey,
      })
      .signers([userWallet])
      .rpc();

    console.log("Your transaction signature", tx);

    const userMintABalance =
      await program.provider.connection.getTokenAccountBalance(userAtaParentA);

    const userMintBBalance =
      await program.provider.connection.getTokenAccountBalance(userAtaParentB);

    const oldBreedAccount = await program.account.breedData.fetchNullable(
      breedData
    );

    const breedMachineAccount = await program.account.breedMachine.fetch(
      breedingMachine
    );

    expect(breedMachineAccount.born.toNumber()).to.equal(1);
    expect(oldBreedAccount).to.be.null;
    expect(userMintABalance.value.uiAmount).to.equal(1);
    expect(userMintBBalance.value.uiAmount).to.equal(1);
  });
});
