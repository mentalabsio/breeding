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

const findBreedAccountAddress = (
  breedMachineAddress: anchor.web3.PublicKey,
  mintAddressA: anchor.web3.PublicKey,
  mintAddressB: anchor.web3.PublicKey,
  authority: anchor.web3.PublicKey,
  breedingProgram: anchor.web3.PublicKey
) =>
  anchor.utils.publicKey.findProgramAddressSync(
    [
      Buffer.from("breed_account"),
      breedMachineAddress.toBuffer(),
      mintAddressA.toBuffer(),
      mintAddressB.toBuffer(),
      authority.toBuffer(),
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

  const mintAccountA = new anchor.web3.PublicKey(
    "4kZVPqN3b2CFUniF8bBdex32ziQ3FxbxhNYT3teV7Jkx"
  );
  const mintAccountB = new anchor.web3.PublicKey(
    "2Z8esbcvecdEDXp6Py3HW3th9CAUJtTW5Df3Lz1m6qJC"
  );
  const childMint = new anchor.web3.PublicKey(
    "6B6T2eUzArgswFFQmd63nZuTScW9Xjsjh2KPtXNXQ3Pp"
  );
  const feeToken = new anchor.web3.PublicKey(
    "NEpinL3xGXUpDeLdiJmVAoMGHXVF6BjsPHV6HRtNZDh"
  );

  const breedMachine = findBreedMachineAddress(
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
        breedMachine,
        authority: authority.publicKey,
      })
      .signers([authority])
      .rpc();

    console.log("Your transaction signature", tx);

    const machineAccount = await program.account.breedMachine.fetch(
      breedMachine
    );

    expect(machineAccount.born.toNumber()).to.equal(0);
    expect(machineAccount.bred.toNumber()).to.equal(0);
  });

  it("should be able to initialize a breeding", async () => {
    const breedAccount = findBreedAccountAddress(
      breedMachine,
      mintAccountA,
      mintAccountB,
      authority.publicKey,
      program.programId
    );

    const userMintA = await anchor.utils.token.associatedAddress({
      mint: mintAccountA,
      owner: userWallet.publicKey,
    });

    const userMintB = await anchor.utils.token.associatedAddress({
      mint: mintAccountB,
      owner: userWallet.publicKey,
    });

    const breedMintA = await anchor.utils.token.associatedAddress({
      mint: mintAccountA,
      owner: breedAccount,
    });

    const breedMintB = await anchor.utils.token.associatedAddress({
      mint: mintAccountB,
      owner: breedAccount,
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
        breedMachine,
        breedAccount,

        mintAccountA,
        userMintA,
        breedMintA,

        mintAccountB,
        userMintB,
        breedMintB,

        feeToken,
        feePayerAta,
        feeIncineratorAta,

        userWallet: userWallet.publicKey,
        authority: authority.publicKey,
      })
      .signers([authority, userWallet])
      .rpc();

    console.log("Your transaction signature", tx);

    const userMintABalance =
      await program.provider.connection.getTokenAccountBalance(userMintA);

    const userMintBBalance =
      await program.provider.connection.getTokenAccountBalance(userMintA);

    const breedMintABalance =
      await program.provider.connection.getTokenAccountBalance(breedMintA);

    const breedMintBBalance =
      await program.provider.connection.getTokenAccountBalance(breedMintB);

    expect(userMintABalance.value.uiAmount).to.equal(0);
    expect(userMintBBalance.value.uiAmount).to.equal(0);
    expect(breedMintABalance.value.uiAmount).to.equal(1);
    expect(breedMintBBalance.value.uiAmount).to.equal(1);
  });

  it("should be able to terminate a breeding", async () => {
    const breedAccount = findBreedAccountAddress(
      breedMachine,
      mintAccountA,
      mintAccountB,
      authority.publicKey,
      program.programId
    );

    const userMintA = await anchor.utils.token.associatedAddress({
      mint: mintAccountA,
      owner: userWallet.publicKey,
    });

    const userMintB = await anchor.utils.token.associatedAddress({
      mint: mintAccountB,
      owner: userWallet.publicKey,
    });

    const breedMintA = await anchor.utils.token.associatedAddress({
      mint: mintAccountA,
      owner: breedAccount,
    });

    const breedMintB = await anchor.utils.token.associatedAddress({
      mint: mintAccountB,
      owner: breedAccount,
    });

    const childVault = await anchor.utils.token.associatedAddress({
      mint: childMint,
      owner: authority.publicKey,
    });

    const userChildAta = await anchor.utils.token.associatedAddress({
      mint: childMint,
      owner: userWallet.publicKey,
    });

    const tx = await program.methods
      .finalizeBreeding()
      .accounts({
        breedMachine,
        breedAccount,

        mintAccountA,
        userMintA,
        breedMintA,

        mintAccountB,
        userMintB,
        breedMintB,

        childMint,
        childVault,
        userChildAta,
        userWallet: userWallet.publicKey,
        authority: authority.publicKey,
      })
      .signers([authority, userWallet])
      .rpc();

    console.log("Your transaction signature", tx);

    const userMintABalance =
      await program.provider.connection.getTokenAccountBalance(userMintA);

    const userMintBBalance =
      await program.provider.connection.getTokenAccountBalance(userMintA);

    const userChildAtaBalance =
      await program.provider.connection.getTokenAccountBalance(userChildAta);

    const childVaultBalance =
      await program.provider.connection.getTokenAccountBalance(childVault);

    const oldBreedAccount = await program.account.breedAccount.fetchNullable(
      breedAccount
    );

    expect(oldBreedAccount).to.be.null;
    expect(userMintABalance.value.uiAmount).to.equal(1);
    expect(userMintBBalance.value.uiAmount).to.equal(1);
    expect(userChildAtaBalance.value.uiAmount).to.equal(1);
    expect(childVaultBalance.value.uiAmount).to.equal(0);
  });
});
