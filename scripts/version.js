#!/usr/bin/env node

import { Command } from "commander";
import enquirer from "enquirer";
const { Select, MultiSelect, Confirm } = enquirer;
import { readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { execSync } from "child_process";
import semver from "semver";
import pc from "picocolors";
import fg from "fast-glob";

// ============================================================================
// CONFIGURATION AND TYPES
// ============================================================================

const DEFAULT_CONFIG = {
  defaultBumpType: "patch",
  updateDependencies: true,
  gitTagPrefix: "",
  commitMessageTemplate: "chore: bump {packages} to {version}",
  packageGroups: {},
  excludePackages: [],
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function showError(message) {
  console.error(pc.red(`❌ ${message}`));
  process.exit(1);
}

function showSuccess(message) {
  console.log(pc.green(`✅ ${message}`));
}

function showWarning(message) {
  console.warn(pc.yellow(`⚠️  ${message}`));
}

function showInfo(message) {
  console.log(pc.blue(`ℹ️  ${message}`));
}

function showProgress(current, total, operation) {
  const percentage = Math.round((current / total) * 100);
  console.log(
    pc.blue(`📦 ${operation}... (${current}/${total}) ${percentage}%`)
  );
}

async function loadConfig(configPath) {
  if (!existsSync(configPath)) {
    return DEFAULT_CONFIG;
  }

  try {
    const configContent = await readFile(configPath, "utf-8");
    const config = JSON.parse(configContent);
    return { ...DEFAULT_CONFIG, ...config };
  } catch (error) {
    showWarning(`Failed to load config from ${configPath}, using defaults`);
    return DEFAULT_CONFIG;
  }
}

function isGitClean() {
  try {
    const status = execSync("git status --porcelain", { encoding: "utf-8" });
    return status.trim().length === 0;
  } catch {
    return false;
  }
}

// ============================================================================
// PACKAGE DISCOVERY
// ============================================================================

async function loadGitignore() {
  const gitignorePath = ".gitignore";
  if (!existsSync(gitignorePath)) {
    return [];
  }

  try {
    const content = await readFile(gitignorePath, "utf-8");
    return content
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"));
  } catch {
    return [];
  }
}

async function findPackageJsonFiles() {
  try {
    // Find all package.json files, excluding node_modules
    const packageFiles = await fg(["**/package.json"], {
      ignore: ["**/node_modules/**", ".git/**"],
      absolute: false,
    });

    return packageFiles;
  } catch (error) {
    showError(`Failed to find package.json files: ${error.message}`);
  }
}

async function parsePackageJson(filePath) {
  try {
    const content = await readFile(filePath, "utf-8");
    const parsed = JSON.parse(content);

    return {
      path: filePath,
      name: parsed.name || path.basename(path.dirname(filePath)),
      version: parsed.version || "0.0.0",
      dependencies: parsed.dependencies || {},
      devDependencies: parsed.devDependencies || {},
      peerDependencies: parsed.peerDependencies || {},
      private: parsed.private || false,
      location: filePath.startsWith("apps/")
        ? "apps"
        : filePath.startsWith("packages/")
          ? "packages"
          : "root",
    };
  } catch (error) {
    showError(`Failed to parse ${filePath}: ${error.message}`);
  }
}

async function discoverPackages() {
  showInfo("Discovering packages...");

  const packageFiles = await findPackageJsonFiles();
  const packages = [];

  for (let i = 0; i < packageFiles.length; i++) {
    showProgress(i + 1, packageFiles.length, "Parsing packages");
    const pkg = await parsePackageJson(packageFiles[i]);
    packages.push(pkg);
  }

  console.log(); // New line after progress
  showInfo(`Found ${packages.length} packages`);

  return packages;
}

// ============================================================================
// DEPENDENCY GRAPH
// ============================================================================

function buildDependencyGraph(packages) {
  const packageMap = new Map();
  const dependencyGraph = new Map();

  // Create package lookup map
  packages.forEach((pkg) => {
    packageMap.set(pkg.name, pkg);
    dependencyGraph.set(pkg.name, {
      package: pkg,
      dependsOn: new Set(),
      dependents: new Set(),
    });
  });

  // Build dependency relationships
  packages.forEach((pkg) => {
    const allDeps = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
      ...pkg.peerDependencies,
    };

    Object.keys(allDeps).forEach((depName) => {
      if (packageMap.has(depName)) {
        // This is an internal dependency
        dependencyGraph.get(pkg.name).dependsOn.add(depName);
        dependencyGraph.get(depName).dependents.add(pkg.name);
      }
    });
  });

  return dependencyGraph;
}

// ============================================================================
// PACKAGE SELECTION
// ============================================================================

function filterPackagesByOptions(packages, options, config) {
  // Don't filter out private packages by default - let user decide
  let filtered = [...packages];

  // Apply exclusions from config
  if (config.excludePackages?.length) {
    filtered = filtered.filter(
      (pkg) => !config.excludePackages.includes(pkg.name)
    );
  }

  // Apply directory filters
  if (options.appsOnly) {
    filtered = filtered.filter((pkg) => pkg.location === "apps");
  } else if (options.packagesOnly) {
    filtered = filtered.filter((pkg) => pkg.location === "packages");
  }

  // Apply specific package filter
  if (options.packages) {
    const selectedPackages = options.packages.split(",").map((p) => p.trim());
    filtered = filtered.filter(
      (pkg) =>
        selectedPackages.includes(pkg.name) ||
        selectedPackages.includes(path.basename(path.dirname(pkg.path)))
    );
  }

  return filtered;
}

async function selectPackagesInteractively(packages) {
  if (packages.length === 0) {
    showError("No packages available for selection");
  }

  const choices = packages.map((pkg) => ({
    name: pkg.name,
    message: `${pc.cyan(pkg.name)} (${pc.dim(pkg.version)}) - ${pc.gray(pkg.location)}`,
    value: pkg.name,
  }));

  const prompt = new MultiSelect({
    name: "packages",
    message: "Select packages to version:",
    choices,
    validate: (value) =>
      value.length > 0 ? true : "Please select at least one package",
  });

  const selectedNames = await prompt.run();
  return packages.filter((pkg) => selectedNames.includes(pkg.name));
}

// ============================================================================
// VERSION CALCULATION
// ============================================================================

function calculateNewVersion(currentVersion, bumpType, preid = "alpha") {
  try {
    if (bumpType.startsWith("pre")) {
      return semver.inc(currentVersion, bumpType, preid);
    }
    return semver.inc(currentVersion, bumpType);
  } catch (error) {
    showError(
      `Failed to calculate version for ${currentVersion}: ${error.message}`
    );
  }
}

function calculateVersionsForPackages(packages, bumpType, preid) {
  return packages.map((pkg) => ({
    ...pkg,
    newVersion: calculateNewVersion(pkg.version, bumpType, preid),
  }));
}

// ============================================================================
// DEPENDENCY UPDATES
// ============================================================================

function findDependencyUpdates(
  versionedPackages,
  allPackages,
  dependencyGraph
) {
  const updates = [];
  const versionMap = new Map();

  // Create version lookup map
  versionedPackages.forEach((pkg) => {
    versionMap.set(pkg.name, pkg.newVersion);
  });

  // Find all packages that need dependency updates
  versionedPackages.forEach((versionedPkg) => {
    const dependents =
      dependencyGraph.get(versionedPkg.name)?.dependents || new Set();

    dependents.forEach((dependentName) => {
      const dependentPkg = allPackages.find((p) => p.name === dependentName);
      if (!dependentPkg) return;

      // Check all dependency types
      ["dependencies", "devDependencies", "peerDependencies"].forEach(
        (depType) => {
          const deps = dependentPkg[depType] || {};
          if (deps[versionedPkg.name]) {
            const currentRange = deps[versionedPkg.name];
            const newRange = updateVersionRange(
              currentRange,
              versionedPkg.newVersion
            );

            updates.push({
              package: dependentPkg.name,
              dependency: versionedPkg.name,
              dependencyType: depType,
              currentRange,
              newRange,
              packagePath: dependentPkg.path,
            });
          }
        }
      );
    });
  });

  return updates;
}

function updateVersionRange(currentRange, newVersion) {
  // Handle workspace protocol
  if (currentRange.startsWith("workspace:")) {
    return currentRange; // Keep workspace protocol unchanged
  }

  // Preserve range operators
  if (currentRange.startsWith("^")) {
    return `^${newVersion}`;
  } else if (currentRange.startsWith("~")) {
    return `~${newVersion}`;
  } else if (currentRange.startsWith(">=")) {
    return `>=${newVersion}`;
  } else {
    return newVersion; // Exact version
  }
}

// ============================================================================
// FILE UPDATES
// ============================================================================

async function updatePackageVersions(versionedPackages) {
  for (const pkg of versionedPackages) {
    await updatePackageJson(pkg.path, (content) => {
      content.version = pkg.newVersion;
      return content;
    });
  }
}

async function updateDependencies(dependencyUpdates) {
  const updatesByPackage = new Map();

  // Group updates by package
  dependencyUpdates.forEach((update) => {
    if (!updatesByPackage.has(update.packagePath)) {
      updatesByPackage.set(update.packagePath, []);
    }
    updatesByPackage.get(update.packagePath).push(update);
  });

  // Apply updates to each package
  for (const [packagePath, updates] of updatesByPackage) {
    await updatePackageJson(packagePath, (content) => {
      updates.forEach((update) => {
        if (
          content[update.dependencyType] &&
          content[update.dependencyType][update.dependency]
        ) {
          content[update.dependencyType][update.dependency] = update.newRange;
        }
      });
      return content;
    });
  }
}

async function updatePackageJson(filePath, updateFn) {
  try {
    const content = await readFile(filePath, "utf-8");
    const parsed = JSON.parse(content);
    const updated = updateFn(parsed);

    await writeFile(filePath, JSON.stringify(updated, null, 2) + "\n");
  } catch (error) {
    showError(`Failed to update ${filePath}: ${error.message}`);
  }
}

// ============================================================================
// GIT OPERATIONS
// ============================================================================

function createGitCommit(versionedPackages, config) {
  try {
    // Stage all package.json files
    execSync("git add **/package.json package.json", { stdio: "inherit" });

    // Create commit message
    const packageNames = versionedPackages.map((pkg) => pkg.name).join(", ");
    const versions = versionedPackages.map((pkg) => pkg.newVersion).join(", ");

    const message = config.commitMessageTemplate
      .replace("{packages}", packageNames)
      .replace("{version}", versions);

    execSync(`git commit -m "${message}"`, { stdio: "inherit" });
    showSuccess(`Created commit: ${message}`);
  } catch (error) {
    showError(`Failed to create git commit: ${error.message}`);
  }
}

function createGitTags(versionedPackages, config) {
  try {
    versionedPackages.forEach((pkg) => {
      const tagName = `${config.gitTagPrefix}${pkg.name}@${pkg.newVersion}`;
      execSync(`git tag ${tagName}`, { stdio: "inherit" });
      showSuccess(`Created tag: ${tagName}`);
    });
  } catch (error) {
    showError(`Failed to create git tags: ${error.message}`);
  }
}

// ============================================================================
// REPORTING
// ============================================================================

function displayVersionPlan(versionedPackages) {
  console.log("\n" + pc.bold("📦 Version Plan:"));

  // Calculate dynamic column widths
  const maxNameLength = Math.max(
    23,
    ...versionedPackages.map((pkg) => pkg.name.length)
  );
  const maxCurrentLength = Math.max(
    7,
    ...versionedPackages.map((pkg) => pkg.version.length)
  );
  const maxNewLength = Math.max(
    7,
    ...versionedPackages.map((pkg) => pkg.newVersion.length)
  );
  const maxLocationLength = Math.max(
    8,
    ...versionedPackages.map((pkg) => pkg.location.length)
  );

  // Create table borders
  const topBorder = `┌─${"─".repeat(maxNameLength)}─┬─${"─".repeat(maxCurrentLength)}─┬─${"─".repeat(maxNewLength)}─┬─${"─".repeat(maxLocationLength)}─┐`;
  const middleBorder = `├─${"─".repeat(maxNameLength)}─┼─${"─".repeat(maxCurrentLength)}─┼─${"─".repeat(maxNewLength)}─┼─${"─".repeat(maxLocationLength)}─┤`;
  const bottomBorder = `└─${"─".repeat(maxNameLength)}─┴─${"─".repeat(maxCurrentLength)}─┴─${"─".repeat(maxNewLength)}─┴─${"─".repeat(maxLocationLength)}─┘`;

  console.log(topBorder);
  console.log(
    `│ ${"Package".padEnd(maxNameLength)} │ ${"Current".padEnd(maxCurrentLength)} │ ${"New".padEnd(maxNewLength)} │ ${"Location".padEnd(maxLocationLength)} │`
  );
  console.log(middleBorder);

  versionedPackages.forEach((pkg) => {
    const name = pkg.name.padEnd(maxNameLength);
    const current = pkg.version.padEnd(maxCurrentLength);
    // Don't use color codes in padding calculations - add color after padding
    const newVerPadded = pkg.newVersion.padEnd(maxNewLength);
    const newVer = pc.green(newVerPadded);
    const location = pkg.location.padEnd(maxLocationLength);

    console.log(`│ ${name} │ ${current} │ ${newVer} │ ${location} │`);
  });

  console.log(bottomBorder + "\n");
}

function displayDependencyUpdates(dependencyUpdates) {
  if (dependencyUpdates.length === 0) return;

  console.log(pc.bold("🔗 Dependency Updates:"));

  // Calculate dynamic column widths
  const maxPkgLength = Math.max(
    23,
    ...dependencyUpdates.map((u) => u.package.length)
  );
  const maxDepLength = Math.max(
    23,
    ...dependencyUpdates.map((u) => u.dependency.length)
  );
  const maxCurrentLength = Math.max(
    7,
    ...dependencyUpdates.map((u) => u.currentRange.length)
  );
  const maxNewLength = Math.max(
    7,
    ...dependencyUpdates.map((u) => u.newRange.length)
  );

  // Create table borders
  const topBorder = `┌─${"─".repeat(maxPkgLength)}─┬─${"─".repeat(maxDepLength)}─┬─${"─".repeat(maxCurrentLength)}─┬─${"─".repeat(maxNewLength)}─┐`;
  const middleBorder = `├─${"─".repeat(maxPkgLength)}─┼─${"─".repeat(maxDepLength)}─┼─${"─".repeat(maxCurrentLength)}─┼─${"─".repeat(maxNewLength)}─┤`;
  const bottomBorder = `└─${"─".repeat(maxPkgLength)}─┴─${"─".repeat(maxDepLength)}─┴─${"─".repeat(maxCurrentLength)}─┴─${"─".repeat(maxNewLength)}─┘`;

  console.log(topBorder);
  console.log(
    `│ ${"Package".padEnd(maxPkgLength)} │ ${"Dependency".padEnd(maxDepLength)} │ ${"Current".padEnd(maxCurrentLength)} │ ${"New".padEnd(maxNewLength)} │`
  );
  console.log(middleBorder);

  dependencyUpdates.forEach((update) => {
    const pkg = update.package.padEnd(maxPkgLength);
    const dep = update.dependency.padEnd(maxDepLength);
    const current = update.currentRange.padEnd(maxCurrentLength);
    // Don't use color codes in padding calculations
    const newRangePadded = update.newRange.padEnd(maxNewLength);
    const newRange = pc.green(newRangePadded);

    console.log(`│ ${pkg} │ ${dep} │ ${current} │ ${newRange} │`);
  });

  console.log(bottomBorder + "\n");
}

function displayGitTags(versionedPackages, config) {
  const tags = versionedPackages
    .map((pkg) => `${config.gitTagPrefix}${pkg.name}@${pkg.newVersion}`)
    .join(", ");

  console.log(pc.bold(`🏷️  Git Tags: ${pc.cyan(tags)}\n`));
}

// ============================================================================
// MAIN LOGIC
// ============================================================================

async function confirmDangerousOperation(bumpType, packages) {
  if (bumpType === "major" && packages.length > 0) {
    const prompt = new Confirm({
      name: "confirm",
      message: `This will create major version bumps for ${packages.length} packages. Continue?`,
      initial: false,
    });

    const confirmed = await prompt.run();
    if (!confirmed) {
      showInfo("Operation cancelled");
      process.exit(0);
    }
  }
}

async function runVersioning(bumpType, options) {
  try {
    // Load configuration
    const config = await loadConfig(options.config);

    // Check git status if git operations are enabled
    if (!options.noGit && !isGitClean()) {
      showError(
        "Git working directory is not clean. Commit or stash changes first."
      );
    }

    // Discover all packages
    const allPackages = await discoverPackages();
    const dependencyGraph = buildDependencyGraph(allPackages);

    // Filter packages based on options
    let targetPackages = filterPackagesByOptions(allPackages, options, config);

    // Interactive selection if requested
    if (options.interactive && targetPackages.length > 1) {
      targetPackages = await selectPackagesInteractively(targetPackages);
    }

    if (targetPackages.length === 0) {
      showError("No packages selected for versioning");
    }

    // Calculate new versions
    const versionedPackages = calculateVersionsForPackages(
      targetPackages,
      bumpType,
      options.preid
    );

    // Find dependency updates
    const dependencyUpdates = options.noDeps
      ? []
      : findDependencyUpdates(versionedPackages, allPackages, dependencyGraph);

    // Display plan
    displayVersionPlan(versionedPackages);
    displayDependencyUpdates(dependencyUpdates);

    if (!options.noGit && !options.noTags) {
      displayGitTags(versionedPackages, config);
    }

    // Confirm dangerous operations
    await confirmDangerousOperation(bumpType, versionedPackages);

    // Dry run check
    if (options.dryRun) {
      showInfo("Dry run complete. Use without --dry-run to apply changes.");
      return;
    }

    // Apply changes
    showInfo("Applying version updates...");
    await updatePackageVersions(versionedPackages);

    if (!options.noDeps && dependencyUpdates.length > 0) {
      showInfo("Updating dependencies...");
      await updateDependencies(dependencyUpdates);
    }

    // Git operations
    if (!options.noGit) {
      showInfo("Creating git commit...");
      createGitCommit(versionedPackages, config);

      if (!options.noTags) {
        showInfo("Creating git tags...");
        createGitTags(versionedPackages, config);
      }
    }

    showSuccess(`Successfully versioned ${versionedPackages.length} packages!`);
  } catch (error) {
    showError(`Versioning failed: ${error.message}`);
  }
}

// ============================================================================
// CLI SETUP
// ============================================================================

const program = new Command();

program
  .name("version")
  .description("Version management for monorepo packages")
  .version("1.0.0");

program
  .argument("<bump-type>", "Version bump type", (value) => {
    const validTypes = [
      "major",
      "minor",
      "patch",
      "premajor",
      "preminor",
      "prepatch",
      "prerelease",
    ];
    if (!validTypes.includes(value)) {
      throw new Error(
        `Invalid bump type. Must be one of: ${validTypes.join(", ")}`
      );
    }
    return value;
  })
  .option(
    "-p, --packages <packages>",
    "Comma-separated list of packages to version"
  )
  .option("-d, --dry-run", "Preview changes without applying them")
  .option("-i, --interactive", "Interactively select packages to version")
  .option("--apps-only", "Only version packages in apps/ directory")
  .option("--packages-only", "Only version packages in packages/ directory")
  .option(
    "--preid <identifier>",
    "Pre-release identifier (alpha, beta, rc)",
    "alpha"
  )
  .option("--no-git", "Skip git operations")
  .option("--no-deps", "Skip updating internal dependencies")
  .option("--no-tags", "Skip creating git tags")
  .option("-c, --config <path>", "Path to config file", "./version.config.json")
  .action(async (bumpType, options) => {
    await runVersioning(bumpType, options);
  });

// Add examples to help
program.addHelpText(
  "after",
  `
Examples:
  $ node version.js patch                                    # Bump all packages
  $ node version.js minor --packages="ui,shared"             # Bump specific packages
  $ node version.js major --interactive --dry-run            # Interactive selection with preview
  $ node version.js prerelease --preid=beta --packages="web" # Pre-release version
  $ node version.js patch --apps-only                        # Only bump apps
  $ node version.js minor --no-git                           # Skip git operations
`
);

program.parse();
