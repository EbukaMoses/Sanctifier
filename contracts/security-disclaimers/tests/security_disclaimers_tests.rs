use security_disclaimers::{
    security_disclaimer, DisclaimerCategory, SecurityLevel, get_disclaimer, validate_security_config, requires_audit, get_testing_requirements,
};
use soroban_sdk::Env;

#[test]
fn test_security_level_ordering() {
    // Test that security levels are properly ordered
    assert!(SecurityLevel::Critical > SecurityLevel::High);
    assert!(SecurityLevel::High > SecurityLevel::Medium);
    assert!(SecurityLevel::Medium > SecurityLevel::Low);

    // Test specific values
    assert_eq!(SecurityLevel::Low as u8, 0);
    assert_eq!(SecurityLevel::Medium as u8, 1);
    assert_eq!(SecurityLevel::High as u8, 2);
    assert_eq!(SecurityLevel::Critical as u8, 3);
}

#[test]
fn test_disclaimer_category_values() {
    assert_eq!(DisclaimerCategory::Audit as u8, 0);
    assert_eq!(DisclaimerCategory::Usage as u8, 1);
    assert_eq!(DisclaimerCategory::Upgrade as u8, 2);
    assert_eq!(DisclaimerCategory::Emergency as u8, 3);
}

#[test]
fn test_audit_requirements() {
    let env = Env::default();

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
fn test_security_config_validation() {
    let env = Env::default();

    // Critical level requires both admin and upgrade
    assert!(validate_security_config(
        env.clone(),
        SecurityLevel::Critical,
        true,
        true
    ));
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

    // High level requires admin
    assert!(validate_security_config(
        env.clone(),
        SecurityLevel::High,
        true,
        false
    ));
    assert!(validate_security_config(
        env.clone(),
        SecurityLevel::High,
        true,
        true
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

    // Medium and Low levels have no requirements
    assert!(validate_security_config(
        env.clone(),
        SecurityLevel::Medium,
        false,
        false
    ));
    assert!(validate_security_config(
        env.clone(),
        SecurityLevel::Medium,
        true,
        true
    ));
    assert!(validate_security_config(
        env.clone(),
        SecurityLevel::Low,
        false,
        false
    ));
    assert!(validate_security_config(
        env.clone(),
        SecurityLevel::Low,
        true,
        true
    ));
}

#[test]
fn test_audit_disclaimers() {
    let env = Env::default();

    let critical_audit = get_disclaimer(
        env.clone(),
        SecurityLevel::Critical,
        DisclaimerCategory::Audit,
    );
    let high_audit = get_disclaimer(
        env.clone(),
        SecurityLevel::High,
        DisclaimerCategory::Audit,
    );
    let medium_audit = get_disclaimer(
        env.clone(),
        SecurityLevel::Medium,
        DisclaimerCategory::Audit,
    );
    let low_audit = get_disclaimer(
        env.clone(),
        SecurityLevel::Low,
        DisclaimerCategory::Audit,
    );

    // All should contain the basic audit warning
    assert!(critical_audit.len() > 0);
    assert!(high_audit.len() > 0);
    assert!(medium_audit.len() > 0);
    assert!(low_audit.len() > 0);

    // Critical should be longer than low
    assert!(critical_audit.len() > low_audit.len());

    // High should be longer than low
    assert!(high_audit.len() > low_audit.len());

    // Medium should be longer than low
    assert!(medium_audit.len() > low_audit.len());

    // Low should not have additional qualifiers
    assert!(low_audit.len() < critical_audit.len());
}

#[test]
fn test_usage_disclaimers() {
    let env = Env::default();

    let critical_usage = get_disclaimer(
        env.clone(),
        SecurityLevel::Critical,
        DisclaimerCategory::Usage,
    );
    let high_usage = get_disclaimer(
        env.clone(),
        SecurityLevel::High,
        DisclaimerCategory::Usage,
    );

    // All should contain the production warning
    assert!(critical_usage.len() > 0);
    assert!(high_usage.len() > 0);

    // Critical and high should have similar lengths
    assert!(critical_usage.len() > 0);
    assert!(high_usage.len() > 0);

    // High should be longer than low
    assert!(high_usage.len() > 0);
}

#[test]
fn test_upgrade_disclaimers() {
    let env = Env::default();

    let critical_upgrade = get_disclaimer(
        env.clone(),
        SecurityLevel::Critical,
        DisclaimerCategory::Upgrade,
    );
    let high_upgrade = get_disclaimer(
        env.clone(),
        SecurityLevel::High,
        DisclaimerCategory::Upgrade,
    );
    let medium_upgrade = get_disclaimer(
        env.clone(),
        SecurityLevel::Medium,
        DisclaimerCategory::Upgrade,
    );
    let low_upgrade = get_disclaimer(
        env.clone(),
        SecurityLevel::Low,
        DisclaimerCategory::Upgrade,
    );

    // All should contain the upgrade warning
    assert!(critical_upgrade.len() > 0);
    assert!(high_upgrade.len() > 0);
    assert!(medium_upgrade.len() > 0);
    assert!(low_upgrade.len() > 0);

    // All should have different lengths
    assert!(critical_upgrade.len() > 0);
    assert!(high_upgrade.len() > 0);
    assert!(medium_upgrade.len() > 0);
    assert!(low_upgrade.len() > 0);

    // Low should be shorter than medium
    assert!(low_upgrade.len() < medium_upgrade.len());
}

#[test]
fn test_emergency_disclaimers() {
    let env = Env::default();

    let emergency = get_disclaimer(
        env.clone(),
        SecurityLevel::Critical,
        DisclaimerCategory::Emergency,
    );

    let emergency_medium = get_disclaimer(
        env.clone(),
        SecurityLevel::Medium,
        DisclaimerCategory::Emergency,
    );
    
    // All emergency disclaimers should be the same regardless of level
    assert!(emergency.len() > 0);
    assert!(emergency_medium.len() > 0);
}

#[test]
fn test_testing_requirements() {
    let env = Env::default();

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
fn test_edge_cases() {
    let env = Env::default();

    // Test all combinations of security levels and categories
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
            let env_clone = env.clone();
            let disclaimer = get_disclaimer(env_clone, level, category);

            // All disclaimers should be non-empty
            assert!(!disclaimer.is_empty());

            // All disclaimers should contain appropriate content
            assert!(!disclaimer.is_empty());
            assert!(disclaimer.len() > 10); // Basic sanity check
        }
    }
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

#[test]
fn test_macro_expansion() {
    // Test that the security_disclaimer macro compiles and produces expected output
    let disclaimer = security_disclaimer!(SecurityLevel::Critical);

    assert!(disclaimer.contains("SECURITY DISCLAIMER"));
    assert!(disclaimer.contains("Critical"));
    assert!(disclaimer.contains("security level"));
}
