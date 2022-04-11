use anchor_lang::prelude::*;
use solutils::charge;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

pub mod instructions;

use instructions::*;

#[program]
pub mod breed_program {
    use super::*;

    pub fn create_machine(ctx: Context<InitializeBreedMachine>, config: BreedConfig) -> Result<()> {
        let machine = BreedMachine::new(ctx.accounts.authority.key(), config);
        ctx.accounts.breed_machine.set_inner(machine);
        Ok(())
    }

    #[access_control(charge::token_fee(&ctx, fee))]
    #[access_control(InitializeBreed::validate_nfts(&ctx))]
    pub fn initialize_breeding(ctx: Context<InitializeBreed>, fee: u64) -> Result<()> {
        let authority = ctx.accounts.authority.key();
        let owner = ctx.accounts.user_wallet.key();
        let breed_account = BreedAccount::new(authority, owner)?;

        ctx.accounts.breed_account.set_inner(breed_account);
        ctx.accounts.lock_parents()?;
        ctx.accounts.breed_machine.bred += 2;

        msg!("BreedingProgram: Breeding initialized.");
        msg!("BreedingProgram: Parents locked.");

        Ok(())
    }

    pub fn finalize_breeding(ctx: Context<FinalizeBreeding>) -> Result<()> {
        let bump = *ctx.bumps.get("breed_account").unwrap();
        // Increment born counter
        ctx.accounts.breed_machine.born += 1;
        // Unlock parents (burn or transfer back)
        ctx.accounts.unlock_parents(&[&[
            BreedAccount::PREFIX,
            ctx.accounts.breed_machine.key().as_ref(),
            ctx.accounts.mint_account_a.key().as_ref(),
            ctx.accounts.mint_account_b.key().as_ref(),
            ctx.accounts.authority.key().as_ref(),
            &[bump], // must come last
        ]])?;
        ctx.accounts.send_newborn()?;
        Ok(())
    }
}

#[account]
pub struct BreedMachine {
    pub authority: Pubkey,
    // How many NFTs were fed into the machine.
    pub bred: u64,
    // How many NFTs were generated.
    pub born: u64,
    pub config: BreedConfig,
}

impl BreedMachine {
    // Account discriminator byte not considered.
    pub const LEN: usize = 32 + 8 + 8 + BreedConfig::LEN;
    pub const PREFIX: &'static [u8] = b"breed_machine";

    pub fn new(authority: Pubkey, config: BreedConfig) -> Self {
        Self {
            authority,
            bred: 0,
            born: 0,
            config,
        }
    }
}

#[derive(Debug, Clone, AnchorSerialize, AnchorDeserialize)]
pub struct BreedConfig {
    // How long to be able to unlock the new NFT.
    pub cooldown: u64,
    // Parents should be burned after the breeding?
    pub burn_parents: bool,
    // Candy machine address in parents NFTs
    pub parents_candy_machine: Pubkey,
    // Candy machine address in children NFTs.
    pub children_candy_machine: Pubkey,
}

impl BreedConfig {
    pub const LEN: usize = 8 + 1 + 32 + 32;

    pub fn from_args(args: BreedConfig) -> Self {
        Self {
            cooldown: args.cooldown,
            burn_parents: args.burn_parents,
            parents_candy_machine: args.parents_candy_machine,
            children_candy_machine: args.children_candy_machine,
        }
    }
}

/// This account will manage a user's breeding progress, locking the NFTs in the meantime.
/// The NFTs would only be burned once the breeding is complete.
#[account]
pub struct BreedAccount {
    pub owner: Pubkey,
    pub authority: Pubkey,
    pub timestamp: i64,
}

impl BreedAccount {
    // Account discriminator byte not considered.
    pub const LEN: usize = 8 + 32 + 32;
    pub const PREFIX: &'static [u8] = b"breed_account";

    pub fn new(authority: Pubkey, owner: Pubkey) -> Result<Self> {
        Ok(Self {
            authority,
            owner,
            timestamp: Clock::get()?.unix_timestamp,
        })
    }
}
