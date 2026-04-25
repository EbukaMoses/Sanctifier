#!/bin/bash
# scripts/generate-provenance.sh
# Generates a CHECKSUMS.txt manifest for DB and schema artifacts.

set -e

FILES=(
    "data/vulnerability-db.json"
    "schemas/analysis-output.json"
    "schemas/sanctifier.json"
)

MANIFEST="CHECKSUMS.txt"

# Ensure artifacts are formatted correctly first
./scripts/verify-artifacts.sh

echo "# Sanctifier Artifact Checksums (SHA-256)" > "$MANIFEST"
echo "# Generated on $(date -u +'%Y-%m-%dT%H:%M:%SZ')" >> "$MANIFEST"
echo "" >> "$MANIFEST"

for FILE in "${FILES[@]}"; do
    if [[ ! -f "$FILE" ]]; then
        echo "Warning: File $FILE not found, skipping."
        continue
    fi

    echo "Hashing $FILE..."
    shasum -a 256 "$FILE" >> "$MANIFEST"
done

echo "Provenance manifest generated at $MANIFEST"
