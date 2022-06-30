use crate::{BreedConfig, BreedData, BreedMachine, BreedingError};
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Burn, CloseAccount, Mint, MintTo, SetAuthority, Token, TokenAccount, Transfer},
};
use solutils::wrappers::metadata::MetadataAccount;

#[derive(Accounts)]
#[instruction(config: BreedConfig)]
pub struct InitializeBreedMachine<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + BreedMachine::LEN,
        seeds = [
            BreedMachine::PREFIX,
            config.parents_candy_machine.as_ref(),
            config.reward_candy_machine.as_ref(),
            authority.key().as_ref(),
        ],
        bump
    )]
    pub breeding_machine: Account<'info, BreedMachine>,

    #[account(
        init,
        payer = authority,
        mint::decimals = 0_u8,
        mint::authority = breeding_machine,
        seeds = [b"whitelist_token", breeding_machine.key().as_ref()],
        bump,
    )]
    pub whitelist_token: Account<'info, Mint>,

    #[account(
        init,
        payer = authority,
        associated_token::mint = whitelist_token,
        associated_token::authority = breeding_machine,
    )]
    pub whitelist_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub rent: Sysvar<'info, Rent>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

impl<'info> InitializeBreedMachine<'info> {
    pub fn mint_to_ctx(&self) -> CpiContext<'_, '_, '_, 'info, MintTo<'info>> {
        let accounts = MintTo {
            mint: self.whitelist_token.to_account_info(),
            to: self.whitelist_vault.to_account_info(),
            authority: self.breeding_machine.to_account_info(),
        };

        CpiContext::new(self.token_program.to_account_info(), accounts)
    }

    pub fn set_authority_ctx(&self) -> CpiContext<'_, '_, '_, 'info, SetAuthority<'info>> {
        let accounts = SetAuthority {
            account_or_mint: self.whitelist_token.to_account_info(),
            current_authority: self.breeding_machine.to_account_info(),
        };

        CpiContext::new(self.token_program.to_account_info(), accounts)
    }
}

#[derive(Debug, Clone, AnchorSerialize, AnchorDeserialize)]
pub struct UpdateMachineConfigArgs {
    pub breeding_time: Option<u64>,
    pub burn_parents: Option<bool>,
    pub initialization_fee_price: Option<u64>,
}

#[derive(Accounts)]
pub struct UpdateMachineConfig<'info> {
    #[account(mut, has_one = authority)]
    pub breeding_machine: Account<'info, BreedMachine>,

    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct InitializeBreed<'info> {
    #[account(
        mut,
        seeds = [
            BreedMachine::PREFIX,
            breeding_machine.config.parents_candy_machine.as_ref(),
            breeding_machine.config.reward_candy_machine.as_ref(),
            breeding_machine.authority.key().as_ref(),
        ],
        bump
    )]
    pub breeding_machine: Account<'info, BreedMachine>,

    #[account(
        init,
        payer = user_wallet,
        space = 8 + BreedData::LEN,
        seeds = [
            BreedData::PREFIX,
            breeding_machine.key().as_ref(),
            mint_parent_a.key().as_ref(),
            mint_parent_b.key().as_ref(),
        ],
        bump
    )]
    pub breed_data: Account<'info, BreedData>,

    pub mint_parent_a: Account<'info, Mint>,

    #[account(
        constraint = metadata_parent_a.mint == mint_parent_a.key(),
    )]
    pub metadata_parent_a: Box<Account<'info, MetadataAccount>>,

    #[account(
        mut,
        associated_token::mint = mint_parent_a,
        associated_token::authority = user_wallet
    )]
    pub user_ata_parent_a: Box<Account<'info, TokenAccount>>,

    #[account(
        init,
        payer = user_wallet,
        associated_token::mint = mint_parent_a,
        associated_token::authority = breed_data
    )]
    pub vault_ata_parent_a: Box<Account<'info, TokenAccount>>,

    pub mint_parent_b: Account<'info, Mint>,

    #[account(
        constraint = metadata_parent_b.mint == mint_parent_b.key(),
    )]
    pub metadata_parent_b: Box<Account<'info, MetadataAccount>>,

    #[account(
        mut,
        associated_token::mint = mint_parent_b,
        associated_token::authority = user_wallet
    )]
    pub user_ata_parent_b: Box<Account<'info, TokenAccount>>,

    #[account(
        init,
        payer = user_wallet,
        associated_token::mint = mint_parent_b,
        associated_token::authority = breed_data
    )]
    pub vault_ata_parent_b: Box<Account<'info, TokenAccount>>,

    #[account(mut, address = breeding_machine.config.initialization_fee_token)]
    pub fee_token: Account<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = fee_token,
        associated_token::authority = user_wallet
    )]
    pub fee_payer_ata: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub user_wallet: Signer<'info>,
    pub rent: Sysvar<'info, Rent>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

fn verify_creator(metadata: &MetadataAccount, creator_address: Pubkey) -> Result<()> {
    metadata
        .data
        .creators
        .as_ref()
        .filter(|c| c.iter().any(|c| c.address == creator_address && c.verified))
        .ok_or(BreedingError::InvalidNftCollection)?;
    Ok(())
}

impl<'info> InitializeBreed<'info> {
    pub fn validate_nfts(ctx: &Context<Self>) -> Result<()> {
        verify_creator(
            &*ctx.accounts.metadata_parent_a,
            ctx.accounts.breeding_machine.config.parents_candy_machine,
        )?;

        verify_creator(
            &*ctx.accounts.metadata_parent_b,
            ctx.accounts.breeding_machine.config.parents_candy_machine,
        )?;

        Ok(())
    }

    pub fn charge_token_fee(ctx: &Context<Self>, amount: u64) -> Result<()> {
        let fee_payer_ata = &*ctx.accounts.fee_payer_ata;
        let fee_payer_ata_balance = fee_payer_ata.amount;
        if fee_payer_ata_balance < amount {
            return Err(ProgramError::InsufficientFunds.into());
        }

        let cpi_accounts = Burn {
            from: ctx.accounts.fee_payer_ata.to_account_info(),
            mint: ctx.accounts.fee_token.to_account_info(),
            authority: ctx.accounts.user_wallet.to_account_info(),
        };

        let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts);

        anchor_spl::token::burn(cpi_ctx, amount)?;

        Ok(())
    }

    pub fn lock_parents(&self) -> Result<()> {
        // Lock NFT #1
        let accounts = Transfer {
            from: self.user_ata_parent_a.to_account_info(),
            to: self.vault_ata_parent_a.to_account_info(),
            authority: self.user_wallet.to_account_info(),
        };
        let cpi = CpiContext::new(self.token_program.to_account_info(), accounts);
        anchor_spl::token::transfer(cpi, 1)?;

        // Lock NFT #2
        let accounts = Transfer {
            from: self.user_ata_parent_b.to_account_info(),
            to: self.vault_ata_parent_b.to_account_info(),
            authority: self.user_wallet.to_account_info(),
        };
        let cpi = CpiContext::new(self.token_program.to_account_info(), accounts);
        anchor_spl::token::transfer(cpi, 1)
    }
}

#[derive(Accounts)]
pub struct FinalizeBreeding<'info> {
    #[account(
        mut,
        seeds = [
            BreedMachine::PREFIX,
            breeding_machine.config.parents_candy_machine.as_ref(),
            breeding_machine.config.reward_candy_machine.as_ref(),
            breeding_machine.authority.key().as_ref(),
        ],
        bump
    )]
    pub breeding_machine: Account<'info, BreedMachine>,

    #[account(
        mut,
        close = user_wallet,
        seeds = [
            BreedData::PREFIX,
            breeding_machine.key().as_ref(),
            mint_parent_a.key().as_ref(),
            mint_parent_b.key().as_ref(),
        ],
        bump
    )]
    pub breed_data: Account<'info, BreedData>,

    #[account(mut, address = breed_data.mint_a)]
    pub mint_parent_a: Account<'info, Mint>,

    #[account(mut, address = breed_data.mint_b)]
    pub mint_parent_b: Account<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = mint_parent_a,
        associated_token::authority = user_wallet
    )]
    pub user_ata_parent_a: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::mint = mint_parent_b,
        associated_token::authority = user_wallet
    )]
    pub user_ata_parent_b: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        associated_token::mint = mint_parent_a,
        associated_token::authority = breed_data
    )]
    pub vault_ata_parent_a: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::mint = mint_parent_b,
        associated_token::authority = breed_data
    )]
    pub vault_ata_parent_b: Box<Account<'info, TokenAccount>>,

    #[account(
        seeds = [b"whitelist_token", breeding_machine.key().as_ref()],
        bump,
    )]
    pub whitelist_token: Box<Account<'info, Mint>>,

    #[account(
        mut,
        associated_token::mint = whitelist_token,
        associated_token::authority = breeding_machine
    )]
    pub whitelist_vault: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        associated_token::mint = whitelist_token,
        associated_token::authority = user_wallet
    )]
    pub user_whitelist_ata: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub user_wallet: Signer<'info>,

    pub rent: Sysvar<'info, Rent>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

impl<'info> FinalizeBreeding<'info> {
    fn transfer_back(&self, signer_seeds: &[&[&[u8]]]) -> Result<()> {
        let accounts = Transfer {
            from: self.vault_ata_parent_a.to_account_info(),
            to: self.user_ata_parent_a.to_account_info(),
            authority: self.breed_data.to_account_info(),
        };
        let cpi = CpiContext::new(self.token_program.to_account_info(), accounts);
        anchor_spl::token::transfer(cpi.with_signer(signer_seeds), 1)?;

        let accounts = Transfer {
            from: self.vault_ata_parent_b.to_account_info(),
            to: self.user_ata_parent_b.to_account_info(),
            authority: self.breed_data.to_account_info(),
        };
        let cpi = CpiContext::new(self.token_program.to_account_info(), accounts);
        anchor_spl::token::transfer(cpi.with_signer(signer_seeds), 1)?;

        Ok(())
    }

    fn burn(&self, signer_seeds: &[&[&[u8]]]) -> Result<()> {
        let accounts = Burn {
            from: self.vault_ata_parent_a.to_account_info(),
            mint: self.mint_parent_a.to_account_info(),
            authority: self.breed_data.to_account_info(),
        };
        let cpi = CpiContext::new(self.token_program.to_account_info(), accounts);
        anchor_spl::token::burn(cpi.with_signer(signer_seeds), 1)?;

        let accounts = Burn {
            from: self.vault_ata_parent_b.to_account_info(),
            mint: self.mint_parent_b.to_account_info(),
            authority: self.breed_data.to_account_info(),
        };
        let cpi = CpiContext::new(self.token_program.to_account_info(), accounts);
        anchor_spl::token::burn(cpi.with_signer(signer_seeds), 1)?;

        Ok(())
    }

    fn close_parent_vaults(&self, signer_seeds: &[&[&[u8]]]) -> Result<()> {
        let accounts = CloseAccount {
            account: self.vault_ata_parent_a.to_account_info(),
            destination: self.breed_data.to_account_info(),
            authority: self.breed_data.to_account_info(),
        };
        let cpi = CpiContext::new(self.token_program.to_account_info(), accounts);
        anchor_spl::token::close_account(cpi.with_signer(signer_seeds))?;

        let accounts = CloseAccount {
            account: self.vault_ata_parent_b.to_account_info(),
            destination: self.breed_data.to_account_info(),
            authority: self.breed_data.to_account_info(),
        };
        let cpi = CpiContext::new(self.token_program.to_account_info(), accounts);
        anchor_spl::token::close_account(cpi.with_signer(signer_seeds))?;

        Ok(())
    }

    pub fn unlock_parents(&self, signer_seeds: &[&[&[u8]]]) -> Result<()> {
        match self.breeding_machine.config.burn_parents {
            true => self.burn(signer_seeds)?,
            false => self.transfer_back(signer_seeds)?,
        };
        self.close_parent_vaults(signer_seeds)
    }

    pub fn transfer_ctx(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let accounts = Transfer {
            from: self.whitelist_vault.to_account_info(),
            to: self.user_whitelist_ata.to_account_info(),
            authority: self.breeding_machine.to_account_info(),
        };

        CpiContext::new(self.token_program.to_account_info(), accounts)
    }
}

#[derive(Accounts)]
pub struct CancelBreeding<'info> {
    #[account(mut)]
    pub breeding_machine: Account<'info, BreedMachine>,

    #[account(
        mut,
        close = user_wallet,
        seeds = [
            BreedData::PREFIX,
            breeding_machine.key().as_ref(),
            mint_parent_a.key().as_ref(),
            mint_parent_b.key().as_ref(),
        ],
        bump
    )]
    pub breed_data: Account<'info, BreedData>,

    #[account(address = breed_data.mint_a)]
    pub mint_parent_a: Account<'info, Mint>,
    #[account(address = breed_data.mint_b)]
    pub mint_parent_b: Account<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = mint_parent_a,
        associated_token::authority = user_wallet
    )]
    pub user_ata_parent_a: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        associated_token::mint = mint_parent_b,
        associated_token::authority = user_wallet
    )]
    pub user_ata_parent_b: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        associated_token::mint = mint_parent_a,
        associated_token::authority = breed_data
    )]
    pub vault_ata_parent_a: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        associated_token::mint = mint_parent_b,
        associated_token::authority = breed_data
    )]
    pub vault_ata_parent_b: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub user_wallet: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

impl<'info> CancelBreeding<'info> {
    fn return_parents(&self, signer_seeds: &[&[&[u8]]]) -> Result<()> {
        let accounts = Transfer {
            from: self.vault_ata_parent_a.to_account_info(),
            to: self.user_ata_parent_a.to_account_info(),
            authority: self.breed_data.to_account_info(),
        };
        let cpi = CpiContext::new(self.token_program.to_account_info(), accounts);
        anchor_spl::token::transfer(cpi.with_signer(signer_seeds), 1)?;

        let accounts = Transfer {
            from: self.vault_ata_parent_b.to_account_info(),
            to: self.user_ata_parent_b.to_account_info(),
            authority: self.breed_data.to_account_info(),
        };
        let cpi = CpiContext::new(self.token_program.to_account_info(), accounts);
        anchor_spl::token::transfer(cpi.with_signer(signer_seeds), 1)?;

        Ok(())
    }

    fn close_parent_vaults(&self, signer_seeds: &[&[&[u8]]]) -> Result<()> {
        let accounts = CloseAccount {
            account: self.vault_ata_parent_a.to_account_info(),
            destination: self.breed_data.to_account_info(),
            authority: self.breed_data.to_account_info(),
        };
        let cpi = CpiContext::new(self.token_program.to_account_info(), accounts);
        anchor_spl::token::close_account(cpi.with_signer(signer_seeds))?;

        let accounts = CloseAccount {
            account: self.vault_ata_parent_b.to_account_info(),
            destination: self.breed_data.to_account_info(),
            authority: self.breed_data.to_account_info(),
        };
        let cpi = CpiContext::new(self.token_program.to_account_info(), accounts);
        anchor_spl::token::close_account(cpi.with_signer(signer_seeds))?;

        Ok(())
    }

    pub fn unlock_parents(&self, signer_seeds: &[&[&[u8]]]) -> Result<()> {
        self.return_parents(signer_seeds)?;
        self.close_parent_vaults(signer_seeds)?;
        Ok(())
    }
}
