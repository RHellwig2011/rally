#!/bin/bash
# Script to create a Git bundle (includes full repository history)

echo "Creating Git bundle of Rally project..."

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BUNDLE_NAME="rally_${TIMESTAMP}.bundle"

# Create git bundle with all branches
git bundle create "/tmp/${BUNDLE_NAME}" --all

echo "Git bundle created: /tmp/${BUNDLE_NAME}"
echo "Size: $(du -h /tmp/${BUNDLE_NAME} | cut -f1)"
echo ""
echo "To use this bundle on your local machine:"
echo "1. Download /tmp/${BUNDLE_NAME} from the codespace"
echo "2. Run: git clone ${BUNDLE_NAME} rally"
echo "3. cd rally"
echo "4. git remote set-url origin https://github.com/RHellwig2011/rally.git"
