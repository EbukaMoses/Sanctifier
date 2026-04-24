#![no_std]
use soroban_sdk::{contract, contractimpl, Env};

#[contract]
pub struct ArithmeticFixture;

#[contractimpl]
impl ArithmeticFixture {
    pub fn unchecked_add(_env: Env, a: u32, b: u32) -> u32 {
        a + b
    }
}
