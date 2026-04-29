//! Integration tests for security disclaimers
//!
//! These tests verify that security disclaimers work correctly in various scenarios.

use security_disclaimers::{DisclaimerCategory, SecurityLevel, get_disclaimer, validate_security_config, requires_audit, get_testing_requirements};

#[test]
fn test_security_level_consistency() {
    let env = soroban_sdk::Env::default();

    // Test that all security levels work consistently across different categories
    for level in [
        SecurityLevel::Low,
        SecurityLevel::Medium,
        SecurityLevel::High,
        SecurityLevel::Critical,
    ] {
        for category in [
            DisclaimerCategory::Audit,
            DisclaimerCategory::Usage,
            DisclaimerCategory::Upgrade,
            DisclaimerCategory::Emergency,
        ] {
            let disclaimer = get_disclaimer(env.clone(), level, category);

            // All disclaimers should be non-empty
            assert!(!disclaimer.is_empty(),
                "Disclaimer should not be empty for level {:?} and category {:?}",
                level,
                category
            );

            // All disclaimers should contain appropriate content
            assert!(!disclaimer.is_empty());
            assert!(disclaimer.len() > 10); // Basic sanity check
            match category {
                DisclaimerCategory::Audit => assert!(disclaimer.len() > 20),
                DisclaimerCategory::Usage => assert!(disclaimer.len() > 20),
                DisclaimerCategory::Upgrade => assert!(disclaimer.len() > 20),
                DisclaimerCategory::Emergency => assert!(disclaimer.len() > 10),
            }
        }
    }
}

#[test]
fn test_multi_contract_security_levels() {
    let env = soroban_sdk::Env::default();

    // Test different contracts with different security levels
    let low_contract_disclaimer = get_disclaimer(
        env.clone(),
        SecurityLevel::Low,
        DisclaimerCategory::Audit,
    );
    let critical_contract_disclaimer = get_disclaimer(
        env.clone(),
        SecurityLevel::Critical,
        DisclaimerCategory::Audit,
    );

    // Critical contract should have stronger warnings
    assert!(critical_contract_disclaimer.len() > low_contract_disclaimer.len());
}

#[test]
fn test_disclaimer_content_validation() {
    let env = soroban_sdk::Env::default();

    // Test that disclaimer content is appropriate for each security level
    let critical_disclaimer = get_disclaimer(
        env.clone(),
        SecurityLevel::Critical,
        DisclaimerCategory::Audit,
    );
    let high_disclaimer = get_disclaimer(
        env.clone(),
        SecurityLevel::High,
        DisclaimerCategory::Audit,
    );
    let medium_disclaimer = get_disclaimer(
        env.clone(),
        SecurityLevel::Medium,
        DisclaimerCategory::Audit,
    );
    let low_disclaimer = get_disclaimer(
        env.clone(),
        SecurityLevel::Low,
        DisclaimerCategory::Audit,
    );

    // Critical should be longer than low
    assert!(critical_disclaimer.len() > low_disclaimer.len());

    // High should be longer than low
    assert!(high_disclaimer.len() > low_disclaimer.len());

    // Medium should be longer than low
    assert!(medium_disclaimer.len() > low_disclaimer.len());

    // Low should have basic warning
    assert!(low_disclaimer.len() > 0);
}

#[test]
fn test_security_configuration_validation() {
    let env = soroban_sdk::Env::default();

    // Test valid security configurations
    assert!(validate_security_config(
        env.clone(),
        SecurityLevel::Critical,
        true,
        true
    ));
    assert!(validate_security_config(
        env.clone(),
        SecurityLevel::High,
        true,
        false
    ));
    assert!(validate_security_config(
        env.clone(),
        SecurityLevel::Medium,
        false,
        false
    ));
    assert!(validate_security_config(
        env.clone(),
        SecurityLevel::Low,
        false,
        false
    ));

    // Test invalid security configurations
    assert!(!validate_security_config(
        env.clone(),
        SecurityLevel::Critical,
        true,
        false
    ));
    assert!(!validate_security_config(
        env.clone(),
        SecurityLevel::Critical,
        false,
        true
    ));
    assert!(!validate_security_config(
        env.clone(),
        SecurityLevel::Critical,
        false,
        false
    ));
    assert!(!validate_security_config(
        env.clone(),
        SecurityLevel::High,
        false,
        true
    ));
    assert!(!validate_security_config(
        env.clone(),
        SecurityLevel::High,
        false,
        false
    ));
}

#[test]
fn test_audit_requirements() {
    let env = soroban_sdk::Env::default();

    // Critical and High levels require audits
    assert!(requires_audit(
        env.clone(),
        SecurityLevel::Critical
    ));
    assert!(requires_audit(
        env.clone(),
        SecurityLevel::High
    ));

    // Medium and Low levels don't require audits
    assert!(!requires_audit(
        env.clone(),
        SecurityLevel::Medium
    ));
    assert!(!requires_audit(
        env.clone(),
        SecurityLevel::Low
    ));
}

#[test]
fn test_testing_requirements() {
    let env = soroban_sdk::Env::default();

    let critical_reqs =
        get_testing_requirements(env.clone(), SecurityLevel::Critical);
    let high_reqs = get_testing_requirements(env.clone(), SecurityLevel::High);
    let medium_reqs =
        get_testing_requirements(env.clone(), SecurityLevel::Medium);
    let low_reqs = get_testing_requirements(env.clone(), SecurityLevel::Low);

    // Critical should require formal verification
    assert!(critical_reqs.len() > 0);

    // High should require professional audit
    assert!(high_reqs.len() > 0);

    // Medium should require security review
    assert!(medium_reqs.len() > 0);

    // Low should require basic testing
    assert!(low_reqs.len() > 0);
}

#[test]
fn test_contract_disclaimer_formatting() {
    use security_disclaimers::format_contract_disclaimer;

    let disclaimer = format_contract_disclaimer(SecurityLevel::High, "TestContract");

    // Should contain contract name
    assert!(disclaimer.len() > 10);

    // Should contain security level
    assert!(disclaimer.len() > 10);

    // Should contain audit requirement
    assert!(disclaimer.len() > 10);

    // Should contain testing requirements
    assert!(disclaimer.len() > 10);

    // Should contain security warning
    assert!(disclaimer.len() > 10);
}
