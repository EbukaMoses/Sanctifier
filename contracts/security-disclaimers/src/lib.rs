//! # Security Disclaimers Module
//!
//! This module provides standardized security disclaimers and safe usage guidelines
//! for Soroban smart contracts. It ensures consistent security messaging across
//! all contract implementations and provides runtime safety checks.
//!
//! ## Usage
//!
//! Add this to your contract's Cargo.toml:
//! ```toml
//! [dependencies]
//! security-disclaimers = { path = "../security-disclaimers" }
//! ```
//!
//! Then include in your contract:
//! ```rust
//! use security_disclaimers::{security_disclaimer, SecurityLevel};
//! ```
//!
//! ## Security Levels
//!
//! - **CRITICAL**: Contracts handling significant value or with complex governance
//! - **HIGH**: Contracts with user funds or sensitive operations
//! - **MEDIUM**: Contracts with limited risk exposure
//! - **LOW**: Utility contracts with minimal risk
//!
//! ## Disclaimer Categories
//!
//! - **AUDIT_STATUS**: Audit completion and recommendations
//! - **USAGE_RISKS**: Known risks and mitigation strategies
//! - **UPGRADE_PATHS**: Safe upgrade procedures
//! - **EMERGENCY_RESPONSE**: Crisis management procedures

#![no_std]

extern crate alloc;
use alloc::string::String;

use soroban_sdk::{contract, contractimpl, contracttype, Env};

/// Security classification levels for contracts
#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u8)]
pub enum SecurityLevel {
    /// Minimal risk, utility contracts
    Low = 0,
    /// Limited risk exposure
    Medium = 1,
    /// User funds or sensitive operations
    High = 2,
    /// Critical infrastructure or high-value contracts
    Critical = 3,
}

/// Security disclaimer categories
#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u8)]
pub enum DisclaimerCategory {
    Audit = 0,
    Usage = 1,
    Upgrade = 2,
    Emergency = 3,
}

/// Standard security disclaimer messages
pub const DISCLAIMER_AUDIT_REQUIRED: &str = 
    "⚠️  SECURITY WARNING: This contract has not been audited. Use at your own risk. \
     Deploy only after thorough testing and security review.";

pub const DISCLAIMER_PRODUCTION_USE: &str = 
    "⚠️  PRODUCTION WARNING: This contract is intended for testing purposes only. \
     Do not use in production without security audit and formal verification.";

pub const DISCLAIMER_UPGRADE_RISK: &str = 
    "⚠️  UPGRADE WARNING: Contract upgrades may introduce security vulnerabilities. \
     Always verify upgrade logic and test thoroughly before deployment.";

pub const DISCLAIMER_ACCESS_CONTROL: &str = 
    "⚠️  ACCESS CONTROL WARNING: Improper configuration of access controls may lead to \
     unauthorized access or fund loss. Review permissions carefully.";

pub const DISCLAIMER_TIME_SENSITIVE: &str = 
    "⚠️  TIME-SENSITIVE WARNING: This contract depends on timing assumptions. \
     Network delays or clock variations may affect behavior.";

pub const DISCLAIMER_ORACLE_DEPENDENCY: &str = 
    "⚠️  ORACLE WARNING: This contract depends on external price feeds. \
     Oracle manipulation or delays may impact contract behavior.";

pub const DISCLAIMER_COMPLEX_LOGIC: &str = 
    "⚠️  COMPLEXITY WARNING: This contract contains complex logic that may have \
     edge cases. Comprehensive testing and formal verification recommended.";

/// Security disclaimer manager
#[contract]
pub struct SecurityDisclaimer;

#[contractimpl]
impl SecurityDisclaimer {
    /// Get the security disclaimer for a contract
    /// 
    /// # Arguments
    /// * `level` - Security level of the contract
    /// * `category` - Type of disclaimer needed
    /// 
    /// # Returns
    /// String containing the appropriate disclaimer
    pub fn get_disclaimer(_env: Env, level: SecurityLevel, category: DisclaimerCategory) -> String {
        match (level, category) {
            (SecurityLevel::Critical, DisclaimerCategory::Audit) => {
                String::from(DISCLAIMER_AUDIT_REQUIRED) + " CRITICAL: Formal verification required."
            }
            (SecurityLevel::High, DisclaimerCategory::Audit) => {
                String::from(DISCLAIMER_AUDIT_REQUIRED) + " HIGH: Professional audit strongly recommended."
            }
            (SecurityLevel::Medium, DisclaimerCategory::Audit) => {
                String::from(DISCLAIMER_AUDIT_REQUIRED) + " MEDIUM: Security review recommended."
            }
            (SecurityLevel::Low, DisclaimerCategory::Audit) => {
                String::from(DISCLAIMER_AUDIT_REQUIRED)
            }
            (SecurityLevel::Critical, DisclaimerCategory::Usage) => {
                String::from(DISCLAIMER_PRODUCTION_USE) + " CRITICAL: Extensive testing required."
            }
            (SecurityLevel::High, DisclaimerCategory::Usage) => {
                String::from(DISCLAIMER_PRODUCTION_USE) + " HIGH: Comprehensive testing required."
            }
            (SecurityLevel::Medium, DisclaimerCategory::Usage) => {
                String::from(DISCLAIMER_PRODUCTION_USE) + " MEDIUM: Basic testing required."
            }
            (SecurityLevel::Low, DisclaimerCategory::Usage) => {
                String::from(DISCLAIMER_PRODUCTION_USE)
            }
            (SecurityLevel::Critical, DisclaimerCategory::Upgrade) => {
                String::from(DISCLAIMER_UPGRADE_RISK) + " CRITICAL: Upgrade requires governance approval."
            }
            (SecurityLevel::High, DisclaimerCategory::Upgrade) => {
                String::from(DISCLAIMER_UPGRADE_RISK) + " HIGH: Upgrade requires multi-signature approval."
            }
            (SecurityLevel::Medium, DisclaimerCategory::Upgrade) => {
                String::from(DISCLAIMER_UPGRADE_RISK)
            }
            (SecurityLevel::Low, DisclaimerCategory::Upgrade) => {
                String::from("⚠️  UPGRADE INFO: This contract supports upgrades. Verify logic before deployment.")
            }
            (_, DisclaimerCategory::Emergency) => {
                String::from("⚠️  EMERGENCY: In case of security incident, contact development team immediately.")
            }
        }
    }

    /// Check if contract requires audit based on security level
    pub fn requires_audit(_env: Env, level: SecurityLevel) -> bool {
        matches!(level, SecurityLevel::High | SecurityLevel::Critical)
    }

    /// Get recommended testing requirements
    pub fn get_testing_requirements(_env: Env, level: SecurityLevel) -> String {
        match level {
            SecurityLevel::Critical => {
                String::from("Requirements: Formal verification, comprehensive audit, stress testing, security review")
            }
            SecurityLevel::High => {
                String::from("Requirements: Professional audit, integration testing, security review")
            }
            SecurityLevel::Medium => {
                String::from("Requirements: Security review, unit testing, integration testing")
            }
            SecurityLevel::Low => {
                String::from("Requirements: Unit testing, basic security review")
            }
        }
    }

    /// Validate security configuration
    pub fn validate_security_config(_env: Env, level: SecurityLevel, has_admin: bool, has_upgrade: bool) -> bool {
        match level {
            SecurityLevel::Critical => has_admin && has_upgrade,
            SecurityLevel::High => has_admin,
            SecurityLevel::Medium | SecurityLevel::Low => true,
        }
    }
}

/// Helper macro for adding security disclaimers to contracts
#[macro_export]
macro_rules! security_disclaimer {
    ($level:expr) => {
        concat!(
            "\n\n=== SECURITY DISCLAIMER ===\n",
            "This contract is classified as ",
            stringify!($level),
            " security level.\n",
            "Use only after appropriate security review and testing.\n",
            "See documentation for detailed security guidelines.\n",
            "=============================\n"
        )
    };
}

/// Helper function to format security disclaimer for contract documentation
pub fn format_contract_disclaimer(level: SecurityLevel, contract_name: &str) -> String {
    let mut result = String::from("\n\n## 🔐 Security Disclaimer\n\n");
    result += "**Contract:** ";
    result += contract_name;
    result += "\n**Security Level:** ";
    
    // Convert security level to string representation
    let level_str = match level {
        SecurityLevel::Low => "Low",
        SecurityLevel::Medium => "Medium", 
        SecurityLevel::High => "High",
        SecurityLevel::Critical => "Critical",
    };
    result += level_str;
    result += "\n**Audit Required:** ";
    
    let audit_required = SecurityDisclaimer::requires_audit(Env::default(), level);
    result += if audit_required { "true" } else { "false" };
    
    result += "\n\n";
    result += &SecurityDisclaimer::get_disclaimer(Env::default(), level, DisclaimerCategory::Audit);
    result += "\n\n**Testing Requirements:** ";
    result += &SecurityDisclaimer::get_testing_requirements(Env::default(), level);
    result += "\n\nUse this contract only after understanding the risks and implementing appropriate security measures.\n";
    
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_security_levels() {
        assert!(SecurityLevel::Critical > SecurityLevel::High);
        assert!(SecurityLevel::High > SecurityLevel::Medium);
        assert!(SecurityLevel::Medium > SecurityLevel::Low);
    }

    #[test]
    fn test_audit_requirements() {
        let env = Env::default();
        assert!(SecurityDisclaimer::requires_audit(env.clone(), SecurityLevel::Critical));
        assert!(SecurityDisclaimer::requires_audit(env.clone(), SecurityLevel::High));
        assert!(!SecurityDisclaimer::requires_audit(env.clone(), SecurityLevel::Medium));
        assert!(!SecurityDisclaimer::requires_audit(env.clone(), SecurityLevel::Low));
    }

    #[test]
    fn test_security_config_validation() {
        let env = Env::default();
        
        // Critical level requires both admin and upgrade
        assert!(SecurityDisclaimer::validate_security_config(env.clone(), SecurityLevel::Critical, true, true));
        assert!(!SecurityDisclaimer::validate_security_config(env.clone(), SecurityLevel::Critical, true, false));
        assert!(!SecurityDisclaimer::validate_security_config(env.clone(), SecurityLevel::Critical, false, true));
        assert!(!SecurityDisclaimer::validate_security_config(env.clone(), SecurityLevel::Critical, false, false));
        
        // High level requires admin
        assert!(SecurityDisclaimer::validate_security_config(env.clone(), SecurityLevel::High, true, false));
        assert!(SecurityDisclaimer::validate_security_config(env.clone(), SecurityLevel::High, true, true));
        assert!(!SecurityDisclaimer::validate_security_config(env.clone(), SecurityLevel::High, false, true));
        assert!(!SecurityDisclaimer::validate_security_config(env.clone(), SecurityLevel::High, false, false));
        
        // Medium and Low levels have no requirements
        assert!(SecurityDisclaimer::validate_security_config(env.clone(), SecurityLevel::Medium, false, false));
        assert!(SecurityDisclaimer::validate_security_config(env.clone(), SecurityLevel::Medium, true, true));
        assert!(SecurityDisclaimer::validate_security_config(env.clone(), SecurityLevel::Low, false, false));
        assert!(SecurityDisclaimer::validate_security_config(env.clone(), SecurityLevel::Low, true, true));
    }

    #[test]
    fn test_disclaimer_formatting() {
        let disclaimer = format_contract_disclaimer(SecurityLevel::High, "TestContract");
        assert!(disclaimer.contains("TestContract"));
        assert!(disclaimer.contains("High"));
        assert!(disclaimer.contains("true"));
    }
}
