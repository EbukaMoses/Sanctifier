#![no_std]
use soroban_sdk::{contract, contractimpl, Env, Address, Map, String, symbol_short};

#[contract]
pub struct VulnerableContract;

#[contractimpl]
impl VulnerableContract {
    pub fn do_bad_stuff(env: Env, admin: Address) {
        env.storage().instance().set(&String::from_slice(&env, "admin"), &admin);
    } // Missing require_auth

    pub fn panic_calc(env: Env, a: u64, b: u64) -> u64 {
        if a > b {
            panic!("It overflowed!");
        }
        a + b // Unchecked arithmetic
    }

    /// BAD: large per-user map stored in instance storage.
    pub fn store_user_profiles(env: Env) {
        let profiles: Map<Address, String> = Map::new(&env);
        env.storage()
            .instance()
            .set(&symbol_short!("profiles"), &profiles);
    }
}
