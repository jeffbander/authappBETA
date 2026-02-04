# Dependency Security Analysis Reference

## Software Composition Analysis (SCA)

### Package Vulnerability Checks

#### JavaScript/Node.js

**Check commands:**
```bash
# npm audit
npm audit --json

# Check for known vulnerabilities
npx audit-ci --moderate

# Check outdated packages
npm outdated

# Generate SBOM
npx @cyclonedx/cyclonedx-npm --output-file sbom.json
```

**High-risk patterns in package.json:**
```json
{
  "dependencies": {
    "lodash": "^3.10.0",        // Known prototype pollution CVEs
    "axios": "^0.18.0",          // SSRF vulnerabilities
    "minimist": "^1.2.0",        // Prototype pollution
    "node-fetch": "^2.6.0",      // Various CVEs
    "serialize-javascript": "*"   // Wildcard = always risky
  }
}
```

**Secure patterns:**
```json
{
  "dependencies": {
    "lodash": "^4.17.21",
    "axios": "^1.6.0",
    "overrides": {
      "nth-check": "^2.0.1"      // Pin transitive deps
    }
  }
}
```

#### Python

**Check commands:**
```bash
# pip-audit
pip-audit --format json

# Safety check
safety check --json

# Check outdated
pip list --outdated

# Generate SBOM
pip-licenses --format=json > licenses.json
cyclonedx-py --format json -o sbom.json
```

**High-risk patterns in requirements.txt:**
```
requests==2.19.0          # CVE-2023-32681
urllib3==1.24.0           # Multiple CVEs
Pillow==8.0.0             # Buffer overflow CVEs
PyYAML==5.3               # Arbitrary code execution
cryptography==2.9         # Multiple CVEs
```

**Secure patterns:**
```
requests>=2.31.0
urllib3>=2.0.7
Pillow>=10.0.1
PyYAML>=6.0.1
cryptography>=41.0.0
```

### Critical CVE Categories

| CVE Type | Severity | Example Packages |
|----------|----------|------------------|
| Remote Code Execution | Critical | log4j, PyYAML, Pickle |
| SQL Injection | Critical | ORMs with raw query support |
| Authentication Bypass | Critical | JWT libraries, auth middleware |
| Prototype Pollution | High | lodash, minimist, merge-deep |
| Path Traversal | High | file serving libraries |
| SSRF | High | axios, node-fetch, requests |
| XSS | High | template engines, sanitizers |
| DoS | Medium | regex-based parsers |

### Supply Chain Risks

#### 1. Dependency Confusion

**Risk:** Attacker publishes malicious package with same name as internal package.

**Check:**
```bash
# Verify package source
npm config get registry
pip config list

# Check for typosquatting
# Compare package name to popular packages
```

**Mitigation:**
```
# .npmrc - scope internal packages
@mycompany:registry=https://npm.mycompany.com/

# pip.conf - use private index
[global]
extra-index-url = https://pypi.mycompany.com/simple/
```

#### 2. Typosquatting

**High-risk examples:**
```
lodash → lodahs, lodesh
requests → request, requsets
express → expres, expresss
```

**Check:** Compare installed packages against known legitimate names.

#### 3. Abandoned Packages

**Risk indicators:**
- No updates in >2 years
- No maintainer response to issues
- Deprecated status
- Very low download count

**Check:**
```bash
# npm - check package age
npm view <package> time

# pypi - check release history
pip show <package>
```

### License Compliance

#### HIPAA-Incompatible Licenses

| License | Issue | Action |
|---------|-------|--------|
| AGPL-3.0 | Source disclosure requirement | Avoid or get legal review |
| GPL-3.0 | Copyleft provisions | Review with legal |
| SSPL | Service restrictions | Avoid for SaaS |
| No License | Unknown rights | Do not use |

#### Recommended Licenses

| License | Type | Notes |
|---------|------|-------|
| MIT | Permissive | Safe for most use |
| Apache-2.0 | Permissive | Patent grant included |
| BSD-3-Clause | Permissive | Safe for most use |
| ISC | Permissive | Equivalent to MIT |

### Transitive Dependency Analysis

**Why it matters:** Direct dependencies often pull in many transitive dependencies, each potentially vulnerable.

**Example vulnerability chain:**
```
your-app
  └── express (direct, secure)
        └── body-parser
              └── qs (transitive, vulnerable!)
```

**Commands to check:**
```bash
# npm - list full tree
npm ls --all

# pip - show dependency tree
pipdeptree --json

# Find specific vulnerable package
npm ls vulnerable-package
pip show vulnerable-package
```

**Fixing transitive vulnerabilities:**

```json
// package.json - force resolution
{
  "overrides": {
    "nth-check": "^2.0.1",
    "qs": "^6.11.0"
  }
}
```

```
# pip - pin in constraints.txt
qs>=6.11.0
```

### SBOM (Software Bill of Materials)

**Required for compliance audits.** Generate in CycloneDX or SPDX format.

```bash
# JavaScript
npx @cyclonedx/cyclonedx-npm --output-file sbom.json

# Python
cyclonedx-py --format json -o sbom.json

# Go
cyclonedx-go mod -json -output sbom.json

# Container images
syft <image> -o cyclonedx-json > sbom.json
```

### Vulnerability Databases

| Database | Coverage | Use For |
|----------|----------|---------|
| NVD (NIST) | Comprehensive | Official CVE data |
| GitHub Advisory | Language-specific | npm, pip, Go, etc. |
| Snyk DB | Commercial | Enhanced context |
| OSV | Google | Cross-ecosystem |

### Automated Scanning Integration

**CI/CD Integration:**
```yaml
# GitHub Actions example
- name: Run npm audit
  run: npm audit --audit-level=high

- name: Run Snyk
  uses: snyk/actions/node@master
  env:
    SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
```

**Pre-commit hook:**
```yaml
# .pre-commit-config.yaml
repos:
- repo: https://github.com/Lucas-C/pre-commit-hooks-safety
  rev: v1.3.1
  hooks:
  - id: python-safety-dependencies-check
```

### Severity Classification

| Finding | Severity | Action |
|---------|----------|--------|
| Known RCE CVE | Critical | Block deployment, fix immediately |
| Known Auth Bypass | Critical | Block deployment, fix immediately |
| Known SQLi CVE | Critical | Block deployment, fix immediately |
| High CVSS (7.0+) | High | Fix within 48 hours |
| Medium CVSS (4.0-6.9) | Medium | Fix within 2 weeks |
| Low CVSS (<4.0) | Low | Fix in next release |
| License violation | Medium | Legal review required |
| Outdated (no CVE) | Low | Plan upgrade |
| Abandoned package | Medium | Find alternative |
