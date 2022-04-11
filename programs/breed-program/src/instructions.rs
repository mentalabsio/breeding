use crate::{BreedAccount, BreedConfig, BreedMachine};
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Burn, CloseAccount, Mint, Token, TokenAccount, Transfer},
};
use solutils::charge::Chargeable;

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
            config.children_candy_machine.as_ref(),
            authority.key().as_ref()
        ],
        bump
    )]
    pub breed_machine: Account<'info, BreedMachine>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts, Chargeable)]
pub struct InitializeBreed<'info> {
    #[account(mut, has_one = authority)]
    pub breed_machine: Account<'info, BreedMachine>,
    #[account(
        init,
        payer = user_wallet,
        space = 8 + BreedAccount::LEN,
        seeds = [
            BreedAccount::PREFIX,
            breed_machine.key().as_ref(),
            mint_account_a.key().as_ref(),
            mint_account_b.key().as_ref(),
            authority.key().as_ref(),
        ],
        bump
    )]
    pub breed_account: Account<'info, BreedAccount>,

    // Parent NFT #1
    pub mint_account_a: Account<'info, Mint>,
    // Parent NFT #2
    pub mint_account_b: Account<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = mint_account_a,
        associated_token::authority = user_wallet
    )]
    pub user_mint_a: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        associated_token::mint = mint_account_b,
        associated_token::authority = user_wallet
    )]
    pub user_mint_b: Box<Account<'info, TokenAccount>>,

    #[account(
        init,
        payer = user_wallet,
        associated_token::mint = mint_account_a,
        associated_token::authority = breed_account
    )]
    pub breed_mint_a: Box<Account<'info, TokenAccount>>,

    #[account(
        init,
        payer = user_wallet,
        associated_token::mint = mint_account_b,
        associated_token::authority = breed_account
    )]
    pub breed_mint_b: Box<Account<'info, TokenAccount>>,

    pub fee_token: Box<Account<'info, Mint>>,
    #[account(
        mut,
        associated_token::mint = fee_token,
        associated_token::authority = user_wallet
    )]
    pub fee_payer_ata: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub fee_incinerator_ata: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    #[fee_payer]
    pub user_wallet: Signer<'info>,

    pub authority: Signer<'info>,
    pub rent: Sysvar<'info, Rent>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

impl<'info> InitializeBreed<'info> {
    pub fn validate_nfts(_ctx: &Context<Self>) -> Result<()> {
        // TODO: validate parents verified creator.
        Ok(())
    }

    pub fn lock_parents(&self) -> Result<()> {
        // Lock NFT #1
        let accounts = Transfer {
            from: self.user_mint_a.to_account_info(),
            to: self.breed_mint_a.to_account_info(),
            authority: self.user_wallet.to_account_info(),
        };
        let cpi = CpiContext::new(self.token_program.to_account_info(), accounts);
        anchor_spl::token::transfer(cpi, 1)?;

        // Lock NFT #2
        let accounts = Transfer {
            from: self.user_mint_b.to_account_info(),
            to: self.breed_mint_b.to_account_info(),
            authority: self.user_wallet.to_account_info(),
        };
        let cpi = CpiContext::new(self.token_program.to_account_info(), accounts);
        anchor_spl::token::transfer(cpi, 1)
    }
}

#[derive(Accounts)]
pub struct FinalizeBreeding<'info> {
    #[account(mut, has_one = authority)]
    pub breed_machine: Account<'info, BreedMachine>,

    // Parent NFT #1
    pub mint_account_a: Account<'info, Mint>,
    // Parent NFT #2
    pub mint_account_b: Account<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = mint_account_a,
        associated_token::authority = user_wallet
    )]
    pub user_mint_a: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::mint = mint_account_b,
        associated_token::authority = user_wallet
    )]
    pub user_mint_b: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        associated_token::mint = mint_account_a,
        associated_token::authority = breed_account
    )]
    pub breed_mint_a: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::mint = mint_account_b,
        associated_token::authority = breed_account
    )]
    pub breed_mint_b: Box<Account<'info, TokenAccount>>,

    pub child_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        associated_token::mint = child_mint,
        associated_token::authority = authority
    )]
    pub child_vault: Box<Account<'info, TokenAccount>>,
    #[account(
        init,
        payer = user_wallet,
        associated_token::mint = child_mint,
        associated_token::authority = user_wallet
    )]
    pub user_child_ata: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        close = user_wallet,
        seeds = [
            BreedAccount::PREFIX,
            breed_machine.key().as_ref(),
            mint_account_a.key().as_ref(),
            mint_account_b.key().as_ref(),
            authority.key().as_ref(),
        ],
        bump
    )]
    pub breed_account: Account<'info, BreedAccount>,

    #[account(mut)]
    pub user_wallet: Signer<'info>,
    #[account(mut)]
    pub authority: Signer<'info>,

    pub rent: Sysvar<'info, Rent>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

impl<'info> FinalizeBreeding<'info> {
    fn transfer_back(&self, signer_seeds: &[&[&[u8]]]) -> Result<()> {
        let accounts = Transfer {
            from: self.breed_mint_a.to_account_info(),
            to: self.user_mint_a.to_account_info(),
            authority: self.breed_account.to_account_info(),
        };
        let cpi = CpiContext::new(self.token_program.to_account_info(), accounts);
        anchor_spl::token::transfer(cpi.with_signer(signer_seeds), 1)?;

        let accounts = Transfer {
            from: self.breed_mint_b.to_account_info(),
            to: self.user_mint_b.to_account_info(),
            authority: self.breed_account.to_account_info(),
        };
        let cpi = CpiContext::new(self.token_program.to_account_info(), accounts);
        anchor_spl::token::transfer(cpi.with_signer(signer_seeds), 1)?;

        Ok(())
    }

    fn burn(&self, signer_seeds: &[&[&[u8]]]) -> Result<()> {
        let accounts = Burn {
            to: self.breed_mint_a.to_account_info(),
            mint: self.mint_account_a.to_account_info(),
            authority: self.breed_account.to_account_info(),
        };
        let cpi = CpiContext::new(self.token_program.to_account_info(), accounts);
        anchor_spl::token::burn(cpi.with_signer(signer_seeds), 1)?;

        let accounts = Burn {
            to: self.breed_mint_b.to_account_info(),
            mint: self.mint_account_b.to_account_info(),
            authority: self.breed_account.to_account_info(),
        };
        let cpi = CpiContext::new(self.token_program.to_account_info(), accounts);
        anchor_spl::token::burn(cpi.with_signer(signer_seeds), 1)?;

        Ok(())
    }

    fn close_parent_vaults(&self, signer_seeds: &[&[&[u8]]]) -> Result<()> {
        let accounts = CloseAccount {
            account: self.breed_mint_a.to_account_info(),
            destination: self.breed_account.to_account_info(),
            authority: self.breed_account.to_account_info(),
        };
        let cpi = CpiContext::new(self.token_program.to_account_info(), accounts);
        anchor_spl::token::close_account(cpi.with_signer(signer_seeds))?;

        let accounts = CloseAccount {
            account: self.breed_mint_b.to_account_info(),
            destination: self.breed_account.to_account_info(),
            authority: self.breed_account.to_account_info(),
        };
        let cpi = CpiContext::new(self.token_program.to_account_info(), accounts);
        anchor_spl::token::close_account(cpi.with_signer(signer_seeds))?;

        Ok(())
    }

    pub fn unlock_parents(&self, signer_seeds: &[&[&[u8]]]) -> Result<()> {
        match self.breed_machine.config.burn_parents {
            true => self.burn(signer_seeds)?,
            false => self.transfer_back(signer_seeds)?,
        };
        self.close_parent_vaults(signer_seeds)
    }

    pub fn send_newborn(&self) -> Result<()> {
        // Send child NFT
        let accounts = Transfer {
            from: self.child_vault.to_account_info(),
            to: self.user_child_ata.to_account_info(),
            authority: self.authority.to_account_info(),
        };
        let cpi = CpiContext::new(self.token_program.to_account_info(), accounts);
        anchor_spl::token::transfer(cpi, 1)?;

        msg!("BreedingProgram: breeding complete!");

        Ok(())
    }
}
