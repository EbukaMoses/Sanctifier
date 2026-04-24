# Finding Code Fixture Contracts

This directory contains fixture source files used as deterministic scan inputs for Sanctifier finding codes.

## Goals

- Keep one fixture per core `S***` finding code.
- Keep fixtures intentionally small and readable.
- Preserve stable scanner input text for contributor docs and manual verification.

## Fixture index

| Finding code | Fixture file |
| --- | --- |
| `S001` | `s001_authentication.rs` |
| `S002` | `s002_panic_handling.rs` |
| `S003` | `s003_arithmetic.rs` |
| `S004` | `s004_storage_limits.rs` |
| `S005` | `s005_storage_keys.rs` |
| `S006` | `s006_unsafe_patterns.rs` |
| `S007` | `s007_custom_rule.rs` |
| `S008` | `s008_events.rs` |
| `S009` | `s009_logic_result_handling.rs` |
| `S010` | `s010_upgrade_admin.rs` |
| `S011` | `s011_formal_verification.rs` |
| `S012` | `s012_token_interface.rs` |

## Usage

From repository root:

```bash
sanctifier analyze contracts/fixtures/finding-codes --format json
```

These files are fixture sources, not deployable production contracts.
