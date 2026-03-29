use clap::{Parser, Subcommand};
use colored::*;
use sanctifier_core::{Analyzer, ArithmeticIssue, PanicIssue, SizeWarning, UnsafePattern};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Parser)]
#[command(name = "sanctifier")]
#[command(about = "Stellar Soroban Security & Formal Verification Suite", long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Analyze a Soroban contract for vulnerabilities
    Analyze {
        /// Path to the contract directory or Cargo.toml
        #[arg(default_value = ".")]
        path: PathBuf,
        
        /// Output format: text | json | junit
        #[arg(short, long, default_value = "text")]
        format: String,

        /// Limit for ledger entry size in bytes
        #[arg(short, long, default_value = "64000")]
        limit: usize,
    },
    /// Generate a security report
    Report {
        /// Output file path
        #[arg(short, long)]
        output: Option<PathBuf>,
    },
    /// Initialize Sanctifier in a new project
    Init,
}

fn main() {
    let cli = Cli::parse();

    match &cli.command {
        Commands::Analyze { path, format, limit } => {
            let is_json = format == "json";
            let is_junit = format == "junit";
            let is_machine = is_json || is_junit;

            if !is_soroban_project(path) {
                eprintln!("{} Error: {:?} is not a valid Soroban project. (Missing Cargo.toml with 'soroban-sdk' dependency)", "❌".red(), path);
                std::process::exit(1);
            }

            // In machine-output modes send informational lines to stderr so stdout is clean.
            if is_machine {
                eprintln!("{} Sanctifier: Valid Soroban project found at {:?}", "✨".green(), path);
                eprintln!("{} Analyzing contract at {:?}...", "🔍".blue(), path);
            } else {
                println!("{} Sanctifier: Valid Soroban project found at {:?}", "✨".green(), path);
                println!("{} Analyzing contract at {:?}...", "🔍".blue(), path);
            }
            
            let mut analyzer = Analyzer::new(false);
            analyzer.ledger_limit = *limit;
            
            let mut all_size_warnings: Vec<SizeWarning> = Vec::new();
            let mut all_unsafe_patterns: Vec<UnsafePattern> = Vec::new();
            let mut all_auth_gaps: Vec<String> = Vec::new();
            let mut all_panic_issues = Vec::new();
            let mut all_arithmetic_issues: Vec<ArithmeticIssue> = Vec::new();

            if path.is_dir() {
                analyze_directory(path, &analyzer, &mut all_size_warnings, &mut all_unsafe_patterns, &mut all_auth_gaps, &mut all_panic_issues, &mut all_arithmetic_issues);
            } else if path.extension().and_then(|s| s.to_str()) == Some("rs") {
                if let Ok(content) = fs::read_to_string(path) {
                    all_size_warnings.extend(analyzer.analyze_ledger_size(&content));

                    let patterns = analyzer.analyze_unsafe_patterns(&content);
                    for mut p in patterns {
                        p.snippet = format!("{}: {}", path.display(), p.snippet);
                        all_unsafe_patterns.push(p);
                    }

                    let gaps = analyzer.scan_auth_gaps(&content);
                    for g in gaps {
                        all_auth_gaps.push(format!("{}: {}", path.display(), g));
                    }

                    let panics = analyzer.scan_panics(&content);
                    for p in panics {
                        let mut p_mod = p.clone();
                        p_mod.location = format!("{}: {}", path.display(), p.location);
                        all_panic_issues.push(p_mod);
                    }

                    let arith = analyzer.scan_arithmetic_overflow(&content);
                    for mut a in arith {
                        a.location = format!("{}: {}", path.display(), a.location);
                        all_arithmetic_issues.push(a);
                    }
                }
            }

            if is_machine {
                eprintln!("{} Static analysis complete.", "✅".green());
            } else {
                println!("{} Static analysis complete.", "✅".green());
            }

            if is_json {
                let output = serde_json::json!({
                    "size_warnings": all_size_warnings,
                    "unsafe_patterns": all_unsafe_patterns,
                    "auth_gaps": all_auth_gaps,
                    "panic_issues": all_panic_issues,
                    "arithmetic_issues": all_arithmetic_issues,
                });
                println!("{}", serde_json::to_string_pretty(&output).unwrap_or_else(|_| "{}".to_string()));
            } else if is_junit {
                print_junit_report(
                    &all_size_warnings,
                    &all_unsafe_patterns,
                    &all_auth_gaps,
                    &all_panic_issues,
                    &all_arithmetic_issues,
                );
            } else {
                if all_size_warnings.is_empty() {
                    println!("No ledger size issues found.");
                } else {
                    for warning in &all_size_warnings {
                        println!(
                            "{} Warning: Struct {} is approaching ledger entry size limit!",
                            "⚠️".yellow(),
                            warning.struct_name.bold()
                        );
                        println!(
                            "   Estimated size: {} bytes (Limit: {} bytes)",
                            warning.estimated_size.to_string().red(),
                            warning.limit
                        );
                    }
                }

                if !all_auth_gaps.is_empty() {
                    println!("\n{} Found potential Authentication Gaps!", "🛑".red());
                    for gap in &all_auth_gaps {
                        println!("   {} Function {} is modifying state without require_auth()", "->".red(), gap.bold());
                    }
                } else {
                    println!("\nNo authentication gaps found.");
                }

                if !all_panic_issues.is_empty() {
                    println!("\n{} Found explicit Panics/Unwraps!", "🛑".red());
                    for issue in &all_panic_issues {
                        println!(
                            "   {} Function {}: Using {} (Location: {})",
                            "->".red(),
                            issue.function_name.bold(),
                            issue.issue_type.yellow().bold(),
                            issue.location
                        );
                    }
                    println!("   {} Tip: Prefer returning Result or Error types for better contract safety.", "💡".blue());
                } else {
                    println!("\nNo panic/unwrap issues found.");
                }

                if !all_arithmetic_issues.is_empty() {
                    println!("\n{} Found unchecked Arithmetic Operations!", "🔢".yellow());
                    for issue in &all_arithmetic_issues {
                        println!(
                            "   {} Function {}: Unchecked `{}` ({})",
                            "->".red(),
                            issue.function_name.bold(),
                            issue.operation.yellow().bold(),
                            issue.location
                        );
                        println!("      {} {}", "💡".blue(), issue.suggestion);
                    }
                } else {
                    println!("\nNo arithmetic overflow risks found.");
                }
            }
        },
        Commands::Report { output } => {
            println!("{} Generating report...", "📄".yellow());
            if let Some(p) = output {
                println!("Report saved to {:?}", p);
            } else {
                println!("Report printed to stdout.");
            }
        },
        Commands::Init => {
            println!("{} Initializing Sanctifier configuration...", "⚙️".cyan());
            println!("Created .sanctify.toml");
        }
    }
}

fn is_soroban_project(path: &Path) -> bool {
    let cargo_toml_path = if path.is_dir() {
        path.join("Cargo.toml")
    } else if path.file_name().and_then(|s| s.to_str()) == Some("Cargo.toml") {
        path.to_path_buf()
    } else {
        // If it's a .rs file, look for Cargo.toml in parent directories
        let mut current = path.parent();
        let mut found = None;
        while let Some(p) = current {
            let cargo = p.join("Cargo.toml");
            if cargo.exists() {
                found = Some(cargo);
                break;
            }
            current = p.parent();
        }
        match found {
            Some(f) => f,
            None => return false,
        }
    };

    if !cargo_toml_path.exists() {
        return false;
    }

    if let Ok(content) = fs::read_to_string(cargo_toml_path) {
        content.contains("soroban-sdk")
    } else {
        false
    }
}

// ── JUnit XML output ──────────────────────────────────────────────────────────

fn xml_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

fn junit_suite(name: &str, cases: &[String]) -> String {
    let failures = cases.iter().filter(|c| c.contains("<failure")).count();
    let mut out = format!(
        "  <testsuite name=\"{name}\" tests=\"{tests}\" failures=\"{failures}\" errors=\"0\" time=\"0\">\n",
        name = name,
        tests = cases.len(),
        failures = failures,
    );
    for c in cases {
        out.push_str(c);
        out.push('\n');
    }
    out.push_str("  </testsuite>");
    out
}

fn print_junit_report(
    size_warnings: &[SizeWarning],
    unsafe_patterns: &[UnsafePattern],
    auth_gaps: &[String],
    panic_issues: &[PanicIssue],
    arithmetic_issues: &[ArithmeticIssue],
) {
    let mut total_tests = 0usize;
    let mut total_failures = 0usize;
    let mut suites: Vec<String> = Vec::new();

    // auth_gaps
    {
        let cases: Vec<String> = if auth_gaps.is_empty() {
            total_tests += 1;
            vec!["    <testcase name=\"no_auth_gaps\" classname=\"sanctifier.auth_gaps\" time=\"0\"/>".into()]
        } else {
            total_tests += auth_gaps.len();
            total_failures += auth_gaps.len();
            auth_gaps.iter().enumerate().map(|(i, g)| {
                format!("    <testcase name=\"auth_gap_{i}\" classname=\"sanctifier.auth_gaps\" time=\"0\"><failure message=\"Authentication gap detected\" type=\"AuthGap\">{}</failure></testcase>", xml_escape(g))
            }).collect()
        };
        suites.push(junit_suite("auth_gaps", &cases));
    }

    // panic_issues
    {
        let cases: Vec<String> = if panic_issues.is_empty() {
            total_tests += 1;
            vec!["    <testcase name=\"no_panic_issues\" classname=\"sanctifier.panic_issues\" time=\"0\"/>".into()]
        } else {
            total_tests += panic_issues.len();
            total_failures += panic_issues.len();
            panic_issues.iter().enumerate().map(|(i, p)| {
                format!("    <testcase name=\"panic_issue_{i}\" classname=\"sanctifier.panic_issues\" time=\"0\"><failure message=\"{} detected\" type=\"PanicIssue\">{}</failure></testcase>",
                    xml_escape(&p.issue_type), xml_escape(&p.location))
            }).collect()
        };
        suites.push(junit_suite("panic_issues", &cases));
    }

    // arithmetic_issues
    {
        let cases: Vec<String> = if arithmetic_issues.is_empty() {
            total_tests += 1;
            vec!["    <testcase name=\"no_arithmetic_issues\" classname=\"sanctifier.arithmetic_issues\" time=\"0\"/>".into()]
        } else {
            total_tests += arithmetic_issues.len();
            total_failures += arithmetic_issues.len();
            arithmetic_issues.iter().enumerate().map(|(i, a)| {
                format!("    <testcase name=\"arithmetic_issue_{i}\" classname=\"sanctifier.arithmetic_issues\" time=\"0\"><failure message=\"{} overflow risk\" type=\"ArithmeticIssue\">{}: {}</failure></testcase>",
                    xml_escape(&a.operation), xml_escape(&a.location), xml_escape(&a.suggestion))
            }).collect()
        };
        suites.push(junit_suite("arithmetic_issues", &cases));
    }

    // size_warnings
    {
        let cases: Vec<String> = if size_warnings.is_empty() {
            total_tests += 1;
            vec!["    <testcase name=\"no_size_warnings\" classname=\"sanctifier.size_warnings\" time=\"0\"/>".into()]
        } else {
            total_tests += size_warnings.len();
            total_failures += size_warnings.len();
            size_warnings.iter().enumerate().map(|(i, w)| {
                format!("    <testcase name=\"size_warning_{i}\" classname=\"sanctifier.size_warnings\" time=\"0\"><failure message=\"{name} exceeds ledger size limit\" type=\"SizeWarning\">{name}: {size} bytes (limit: {limit})</failure></testcase>",
                    name = xml_escape(&w.struct_name), size = w.estimated_size, limit = w.limit)
            }).collect()
        };
        suites.push(junit_suite("size_warnings", &cases));
    }

    // unsafe_patterns
    {
        let cases: Vec<String> = if unsafe_patterns.is_empty() {
            total_tests += 1;
            vec!["    <testcase name=\"no_unsafe_patterns\" classname=\"sanctifier.unsafe_patterns\" time=\"0\"/>".into()]
        } else {
            total_tests += unsafe_patterns.len();
            total_failures += unsafe_patterns.len();
            unsafe_patterns.iter().enumerate().map(|(i, p)| {
                format!("    <testcase name=\"unsafe_pattern_{i}\" classname=\"sanctifier.unsafe_patterns\" time=\"0\"><failure message=\"Unsafe pattern detected\" type=\"UnsafePattern\">{}</failure></testcase>",
                    xml_escape(&p.snippet))
            }).collect()
        };
        suites.push(junit_suite("unsafe_patterns", &cases));
    }

    println!("<?xml version=\"1.0\" encoding=\"UTF-8\"?>");
    println!(
        "<testsuites name=\"sanctifier-analysis\" tests=\"{total_tests}\" failures=\"{total_failures}\" errors=\"0\" time=\"0\">",
        total_tests = total_tests,
        total_failures = total_failures,
    );
    for suite in &suites {
        println!("{}", suite);
    }
    println!("</testsuites>");
}

// ── Directory walker ──────────────────────────────────────────────────────────

#[allow(clippy::too_many_arguments)]
fn analyze_directory(
    dir: &Path,
    analyzer: &Analyzer,
    all_size_warnings: &mut Vec<SizeWarning>,
    all_unsafe_patterns: &mut Vec<UnsafePattern>,
    all_auth_gaps: &mut Vec<String>,
    all_panic_issues: &mut Vec<PanicIssue>,
    all_arithmetic_issues: &mut Vec<ArithmeticIssue>,
) {
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                analyze_directory(&path, analyzer, all_size_warnings, all_unsafe_patterns, all_auth_gaps, all_panic_issues, all_arithmetic_issues);
            } else if path.extension().and_then(|s| s.to_str()) == Some("rs") {
                if let Ok(content) = fs::read_to_string(&path) {
                    let warnings = analyzer.analyze_ledger_size(&content);
                    for mut w in warnings {
                        w.struct_name = format!("{}: {}", path.display(), w.struct_name);
                        all_size_warnings.push(w);
                    }

                    let gaps = analyzer.scan_auth_gaps(&content);
                    for g in gaps {
                        all_auth_gaps.push(format!("{}: {}", path.display(), g));
                    }

                    let panics = analyzer.scan_panics(&content);
                    for p in panics {
                        let mut p_mod = p.clone();
                        p_mod.location = format!("{}: {}", path.display(), p.location);
                        all_panic_issues.push(p_mod);
                    }

                    let arith = analyzer.scan_arithmetic_overflow(&content);
                    for mut a in arith {
                        a.location = format!("{}: {}", path.display(), a.location);
                        all_arithmetic_issues.push(a);
                    }
                }
            }
        }
    }
}
