#!/usr/bin/env sh

# Check for TEMPLATE-TODO strings in src folder
if grep -r "TEMPLATE-TODO" src/; then
  echo "❌ Found TEMPLATE-TODO in src folder. Please replace all template placeholders before committing."
  exit 1
fi