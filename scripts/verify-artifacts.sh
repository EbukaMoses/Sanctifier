#!/bin/bash
# scripts/verify-artifacts.sh
# Ensures that DB and schema JSON files are deterministically formatted (pretty-printed).

set -e

FILES=(
    "data/vulnerability-db.json"
    "schemas/analysis-output.json"
    "schemas/sanctifier.json"
)

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo "Error: jq is required for verification but not found."
    exit 1
fi

CHECK_ONLY=false
if [[ "$1" == "--check" ]]; then
    CHECK_ONLY=true
fi

FAILED=0

for FILE in "${FILES[@]}"; do
    if [[ ! -f "$FILE" ]]; then
        echo "Warning: File $FILE not found, skipping."
        continue
    fi

    # Create a temporary pretty-printed version
    TMP_FILE=$(mktemp)
    jq '.' "$FILE" > "$TMP_FILE"

    if ! diff -q "$FILE" "$TMP_FILE" > /dev/null; then
        if [ "$CHECK_ONLY" = true ]; then
            echo "Error: $FILE is not pretty-printed or formatted correctly."
            FAILED=1
        else
            echo "Formatting $FILE..."
            mv "$TMP_FILE" "$FILE"
        fi
    else
        rm "$TMP_FILE"
    fi
done

if [ $FAILED -ne 0 ]; then
    echo "Verification failed. Run './scripts/verify-artifacts.sh' to fix formatting."
    exit 1
fi

if [ "$CHECK_ONLY" = true ]; then
    echo "All artifacts are correctly formatted."
else
    echo "Artifact formatting complete."
fi
