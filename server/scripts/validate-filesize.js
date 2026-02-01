#!/usr/bin/env node
/**
 * File Size Advisory Script
 *
 * Reports file sizes as an ADVISORY signal. Primary enforcement is now
 * function-level complexity via ESLint (sonarjs/cognitive-complexity, complexity).
 *
 * This script provides a human-readable summary of file sizes by category.
 * Only files exceeding the EXTREME limit (1000 lines) cause a non-zero exit.
 *
 * Exit Codes:
 * - 0: No extreme violations (advisory warnings may exist)
 * - 1: Files exceeding 1000 lines without canonical annotation
 *
 * Usage:
 *   npm run validate:filesize
 *   node scripts/validate-filesize.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const ADVISORY_LIMIT = 500; // Advisory threshold — check responsibility count
const EXTREME_LIMIT = 1000; // Hard block — likely needs decomposition
const SRC_DIR = path.join(__dirname, '..', 'src');

/**
 * Recursively get all TypeScript files in a directory
 */
function getAllTypeScriptFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      // Skip node_modules, dist, and tests directories
      if (!['node_modules', 'dist', 'tests', 'test'].includes(file)) {
        getAllTypeScriptFiles(filePath, fileList);
      }
    } else if (file.endsWith('.ts') && !file.endsWith('.test.ts') && !file.endsWith('.d.ts')) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

/**
 * Count lines in a file
 */
function countLines(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  return content.split('\n').length;
}

/**
 * Check if file has @lifecycle canonical annotation
 */
function hasCanonicalAnnotation(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n').slice(0, 10); // Check first 10 lines
  return lines.some((line) => line.includes('@lifecycle canonical'));
}

/**
 * Get relative path from src directory
 */
function getRelativePath(filePath) {
  return path.relative(SRC_DIR, filePath);
}

/**
 * Validate all TypeScript files for size compliance
 */
function validateFileSizes() {
  console.log('File Size Advisory Report\n');
  console.log(`   Advisory threshold: ${ADVISORY_LIMIT} lines (check responsibility count)`);
  console.log(`   Extreme threshold:  ${EXTREME_LIMIT} lines (likely needs decomposition)`);
  console.log(`   Primary enforcement: ESLint cognitive/cyclomatic complexity per function\n`);

  const allFiles = getAllTypeScriptFiles(SRC_DIR);
  const extremeViolations = [];
  const largeFiles = [];
  const canonicalExemptions = [];

  allFiles.forEach((filePath) => {
    const lineCount = countLines(filePath);
    const relativePath = getRelativePath(filePath);
    const hasCanonical = hasCanonicalAnnotation(filePath);

    if (lineCount > EXTREME_LIMIT) {
      if (hasCanonical) {
        canonicalExemptions.push({ path: relativePath, lines: lineCount });
      } else {
        extremeViolations.push({ path: relativePath, lines: lineCount });
      }
    } else if (lineCount > ADVISORY_LIMIT) {
      largeFiles.push({ path: relativePath, lines: lineCount });
    }
  });

  // Report results
  console.log(`Scanned ${allFiles.length} TypeScript files\n`);

  if (extremeViolations.length > 0) {
    console.log(`Large files (>${EXTREME_LIMIT} lines): ${extremeViolations.length}\n`);
    console.log('These files likely need decomposition — check responsibility count:\n');
    extremeViolations
      .sort((a, b) => b.lines - a.lines)
      .forEach(({ path, lines }) => {
        console.log(`  ${path} (${lines} lines)`);
      });
    console.log();
  }

  if (canonicalExemptions.length > 0) {
    console.log(`Canonical exemptions: ${canonicalExemptions.length}\n`);
    canonicalExemptions
      .sort((a, b) => b.lines - a.lines)
      .forEach(({ path, lines }) => {
        console.log(`  ${path} (${lines} lines)`);
      });
    console.log();
  }

  if (largeFiles.length > 0) {
    console.log(`Advisory (>${ADVISORY_LIMIT} lines): ${largeFiles.length}\n`);
    largeFiles
      .sort((a, b) => b.lines - a.lines)
      .slice(0, 10)
      .forEach(({ path, lines }) => {
        console.log(`  ${path} (${lines} lines)`);
      });
    if (largeFiles.length > 10) {
      console.log(`  ... and ${largeFiles.length - 10} more`);
    }
    console.log();
  }

  console.log('Summary:');
  console.log(`  Large files (>${EXTREME_LIMIT}): ${extremeViolations.length}`);
  console.log(`  Canonical exemptions: ${canonicalExemptions.length}`);
  console.log(`  Advisory (>${ADVISORY_LIMIT}): ${largeFiles.length}`);
  console.log(`  Primary gate: ESLint sonarjs/cognitive-complexity + complexity rules\n`);

  if (extremeViolations.length > 0) {
    console.log(`Advisory: ${extremeViolations.length} file(s) exceed ${EXTREME_LIMIT} lines\n`);
  }

  // Only fail on extreme violations without canonical annotation
  return extremeViolations.length > 0 ? 1 : 0;
}

// Run validation
const exitCode = validateFileSizes();
process.exit(exitCode);
