#!/bin/bash
# Script to create a downloadable archive of the Rally project

echo "Creating archive of Rally project..."

# Create archive name with timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
ARCHIVE_NAME="rally_project_${TIMESTAMP}.tar.gz"

# Create tar archive excluding unnecessary files
tar -czf "/tmp/${ARCHIVE_NAME}" \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='.git' \
  --exclude='*.log' \
  --exclude='.env' \
  --exclude='.env.local' \
  -C /workspaces \
  rally

echo "Archive created: /tmp/${ARCHIVE_NAME}"
echo "Size: $(du -h /tmp/${ARCHIVE_NAME} | cut -f1)"
echo ""
echo "To download from codespace:"
echo "1. In VS Code, open the Explorer"
echo "2. Navigate to /tmp/${ARCHIVE_NAME}"
echo "3. Right-click and select 'Download'"
echo ""
echo "Or use this command on your local machine:"
echo "scp <codespace-name>:/tmp/${ARCHIVE_NAME} ."
