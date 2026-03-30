#![no_std]
use soroban_sdk::{contract, contractimpl, Env, Address, Map, String, symbol_short};

#[contract]
pub struct InstanceStorageContract;

#[contractimpl]
impl InstanceStorageContract {
    /// BAD: stores a per-user map in instance storage — balloons the single ledger entry.
    pub fn store_user_profiles(env: Env) {
        let profiles: Map<Address, String> = Map::new(&env);
        env.storage()
            .instance()
            .set(&symbol_short!("profiles"), &profiles);
    }

    /// BAD: key name suggests per-user data.
    pub fn store_user_data(env: Env, data: String) {
        env.storage()
            .instance()
            .set(&symbol_short!("user_data"), &data);
    }

    /// GOOD: small scalar config value — should not be flagged.
    pub fn set_admin(env: Env, admin: Address) {
        env.storage()
            .instance()
            .set(&symbol_short!("ADMIN"), &admin);
    }
}
