use anchor_lang::prelude::*;
use solutils::charge;

declare_id!("CikztTpnE9wiNzafzTCSzE4tXKFi5iHcGKzBhpNTiP7p");

pub mod instructions;

use instructions::*;

#[program]
pub mod breed_program {
    use std::ops::AddAssign;

    use super::*;

    pub fn create_machine(ctx: Context<InitializeBreedMachine>, config: BreedConfig) -> Result<()> {
        let machine = BreedMachine::new(ctx.accounts.authority.key(), config);
        ctx.accounts.breeding_machine.set_inner(machine);
        Ok(())
    }

    #[access_control(charge::token_fee(&ctx, fee))]
    #[access_control(InitializeBreed::validate_nfts(&ctx))]
    pub fn initialize_breeding(ctx: Context<InitializeBreed>, fee: u64) -> Result<()> {
        let owner = ctx.accounts.user_wallet.key();
        let mint_parent_a = ctx.accounts.mint_parent_a.key();
        let mint_parent_b = ctx.accounts.mint_parent_b.key();

        let breed_account = BreedData::new(
            ctx.accounts.breeding_machine.authority,
            owner,
            mint_parent_a,
            mint_parent_b,
        )?;

        ctx.accounts.breed_data.set_inner(breed_account);
        ctx.accounts.lock_parents()?;
        ctx.accounts.breeding_machine.bred += 2;

        msg!("BreedingProgram: Breeding initialized.");
        msg!("BreedingProgram: Parents locked.");

        Ok(())
    }

    pub fn finalize_breeding(ctx: Context<FinalizeBreeding>) -> Result<()> {
        let bump = *ctx.bumps.get("breed_data").unwrap();

        // Increment born counter
        // TODO: check integer overflow
        ctx.accounts.breeding_machine.born.add_assign(1);

        // Unlock parents (burn or transfer back)
        ctx.accounts.unlock_parents(&[&[
            BreedData::PREFIX,
            ctx.accounts.breeding_machine.key().as_ref(),
            ctx.accounts.mint_parent_a.key().as_ref(),
            ctx.accounts.mint_parent_b.key().as_ref(),
            &[bump], // must come last
        ]])?;
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
pub struct BreedData {
    pub owner: Pubkey,
    pub authority: Pubkey,
    pub timestamp: i64,
    pub mint_a: Pubkey,
    pub mint_b: Pubkey,
}

impl BreedData {
    // Account discriminator byte not considered.
    pub const LEN: usize = 8 + 32 + 32 + 32 + 32;
    pub const PREFIX: &'static [u8] = b"breed_account";

    pub fn new(authority: Pubkey, owner: Pubkey, mint_a: Pubkey, mint_b: Pubkey) -> Result<Self> {
        Ok(Self {
            authority,
            owner,
            timestamp: Clock::get()?.unix_timestamp,
            mint_a,
            mint_b,
        })
    }
}
