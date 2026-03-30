//! Heuristic: storing large or user-scoped datasets in instance storage balloons the single
//! instance ledger entry and increases rent / IO costs; prefer `persistent()` (or `temporary()`)
//! with keyed entries.

use crate::rules::{Rule, RuleViolation, Severity};
use syn::spanned::Spanned;
use syn::visit::{self, Visit};
use syn::{parse_str, Expr, ExprMethodCall, File};

pub struct InstanceStorageRule;

impl InstanceStorageRule {
    pub fn new() -> Self {
        Self
    }
}

impl Default for InstanceStorageRule {
    fn default() -> Self {
        Self::new()
    }
}

impl Rule for InstanceStorageRule {
    fn name(&self) -> &str {
        "instance_storage_large_data"
    }

    fn description(&self) -> &str {
        "Flags values that look like large datasets or user profiles stored via instance storage"
    }

    fn check(&self, source: &str) -> Vec<RuleViolation> {
        scan_instance_storage_risks(source)
            .into_iter()
            .map(|r| {
                RuleViolation::new(
                    self.name(),
                    Severity::Warning,
                    r.message,
                    format!("{}", r.line),
                )
                .with_suggestion(
                    "Use env.storage().persistent() (or temporary()) with a narrow key, so large or \
                     per-user data does not grow the single instance entry."
                        .to_string(),
                )
            })
            .collect()
    }

    fn as_any(&self) -> &dyn std::any::Any {
        self
    }
}

/// Public finding type for CLI / JSON (line + detail).
#[derive(Debug, Clone, serde::Serialize)]
pub struct InstanceStorageRisk {
    pub line: usize,
    pub message: String,
    pub snippet: String,
}

struct InstanceStorageVisitor {
    risks: Vec<InstanceStorageRisk>,
}

impl InstanceStorageVisitor {
    fn consider_set(&mut self, node: &ExprMethodCall) {
        if node.method != "set" || node.args.len() < 2 {
            return;
        }
        if !receiver_chain_contains_instance(&node.receiver) {
            return;
        }
        let key = &node.args[0];
        let val = &node.args[1];
        if benign_instance_value(val) && !key_suggests_user_scale_data(key) {
            return;
        }
        if value_looks_like_large_payload(val) || key_suggests_user_scale_data(key) {
            let line = node.span().start().line;
            let snippet = quote::quote!(#node).to_string();
            let mut reason = String::new();
            if value_looks_like_large_payload(val) {
                reason.push_str(
                    "value looks like a map, vector, string/bytes, or profile-like struct",
                );
            }
            if key_suggests_user_scale_data(key) {
                if !reason.is_empty() {
                    reason.push_str("; ");
                }
                reason.push_str("key suggests per-user / profile-scale data");
            }
            let message = format!(
                "Instance storage `.set` may pin {reason} in the contract instance entry (high ledger cost). \
                 Prefer persistent storage for large or per-user datasets."
            );
            self.risks.push(InstanceStorageRisk {
                line,
                message,
                snippet,
            });
        }
    }
}

impl<'ast> Visit<'ast> for InstanceStorageVisitor {
    fn visit_expr_method_call(&mut self, node: &'ast ExprMethodCall) {
        self.consider_set(node);
        visit::visit_expr_method_call(self, node);
    }
}

fn receiver_chain_contains_instance(expr: &Expr) -> bool {
    let s = quote::quote!(#expr)
        .to_string()
        .chars()
        .filter(|c| !c.is_whitespace())
        .collect::<String>();
    s.contains(".instance()")
}

fn peel_refs(expr: &Expr) -> &Expr {
    match expr {
        Expr::Reference(r) => peel_refs(&r.expr),
        Expr::Group(g) => peel_refs(&g.expr),
        _ => expr,
    }
}

fn expr_quote_compact(expr: &Expr) -> String {
    quote::quote!(#expr)
        .to_string()
        .chars()
        .filter(|c| !c.is_whitespace())
        .collect()
}

fn key_suggests_user_scale_data(key: &Expr) -> bool {
    let k = expr_quote_compact(key).to_lowercase();
    k.contains("profile")
        || k.contains("user")
        || k.contains("member")
        || k.contains("account")
        || k.contains("metadata")
        || k.contains("dataset")
        || k.contains("record")
}

fn value_looks_like_large_payload(val: &Expr) -> bool {
    let inner = peel_refs(val);
    let compact = expr_quote_compact(inner);
    if compact.contains("Map<")
        || compact.contains("Vec<")
        || compact.contains("BytesN")
        || (compact.contains("Bytes") && !compact.contains("BytesLit"))
    {
        return true;
    }
    if let Expr::Path(p) = inner {
        if let Some(seg) = p.path.segments.last() {
            let id = seg.ident.to_string();
            if id == "String" || id == "Bytes" {
                return true;
            }
        }
    }
    if let Expr::Struct(s) = inner {
        let name_lc = s
            .path
            .segments
            .last()
            .map(|seg| seg.ident.to_string().to_lowercase())
            .unwrap_or_default();
        if name_lc.contains("profile")
            || name_lc.contains("user")
            || name_lc.contains("metadata")
            || name_lc.contains("record")
        {
            return true;
        }
    }
    let lc = compact.to_lowercase();
    lc.contains("profile") || lc.contains("userledger") || lc.contains("userdata")
}

/// Small configuration / token values typically kept in instance storage — skip those.
fn benign_instance_value(val: &Expr) -> bool {
    let inner = peel_refs(val);
    match inner {
        Expr::Lit(_) => return true,
        Expr::Path(p) => {
            if let Some(seg) = p.path.segments.last() {
                let id = seg.ident.to_string();
                if matches!(
                    id.as_str(),
                    "MAX" | "MIN" | "DECIMALS" | "NAME" | "SYMBOL" | "ADMIN"
                ) {
                    return true;
                }
                if matches!(
                    id.as_str(),
                    "i128" | "u32" | "u64" | "i64" | "bool" | "u128"
                ) {
                    return true;
                }
            }
        }
        Expr::Field(_) => return true,
        Expr::Call(c) => {
            if let Expr::Path(pp) = &*c.func {
                if pp.path.is_ident("symbol_short") {
                    return true;
                }
            }
        }
        _ => {}
    }
    let c = expr_quote_compact(inner);
    if c.len() < 48 && !c.contains("Map") && !c.contains("Vec") {
        if c.contains("DataKey::") || c.contains("Symbol::") || c.contains("Address::") {
            return true;
        }
    }
    false
}

pub fn scan_instance_storage_risks(source: &str) -> Vec<InstanceStorageRisk> {
    let Ok(file) = parse_str::<File>(source) else {
        return vec![];
    };
    let mut v = InstanceStorageVisitor { risks: vec![] };
    v.visit_file(&file);
    v.risks
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn flags_map_in_instance_storage() {
        let src = r#"
            use soroban_sdk::{Env, Map, Address, symbol_short};
            #[contractimpl]
            impl C {
                pub fn bad(e: Env) {
                    e.storage().instance().set(
                        &symbol_short!("idx"),
                        &Map::<Address, i128>::new(&e),
                    );
                }
            }
        "#;
        let r = scan_instance_storage_risks(src);
        assert!(!r.is_empty(), "{r:?}");
    }

    #[test]
    fn flags_profile_key_with_instance_storage() {
        let src = r#"
            use soroban_sdk::{Env, String, symbol_short};
            #[contractimpl]
            impl C {
                pub fn bad(e: Env, name: String) {
                    e.storage().instance().set(&symbol_short!("user_profile"), &name);
                }
            }
        "#;
        let r = scan_instance_storage_risks(src);
        assert!(!r.is_empty(), "{r:?}");
    }

    #[test]
    fn skips_small_datakey_scalar_in_instance() {
        let src = r#"
            use soroban_sdk::{Env, symbol_short};
            #[contracttype]
            enum DataKey { Admin }
            #[contractimpl]
            impl C {
                pub fn ok(e: Env, a: soroban_sdk::Address) {
                    e.storage().instance().set(&DataKey::Admin, &a);
                }
            }
        "#;
        let r = scan_instance_storage_risks(src);
        assert!(r.is_empty(), "{r:?}");
    }
}
