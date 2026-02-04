---
name: hipaa-security-team
description: |
  Multi-agent security review system for HIPAA-compliant AI-built software. Use when performing comprehensive security audits, HIPAA compliance assessments, code-to-architecture security reviews, or vulnerability analysis. Triggers on: "security review", "HIPAA compliance check", "security audit", "vulnerability assessment", "PHI protection review", "access control audit", "encryption verification", "security architecture review", "penetration test prep", or any request to analyze software security comprehensively. Spawns multiple specialized subagents working in parallel to analyze code security, infrastructure security, dependency vulnerabilities, authentication/access controls, and HIPAA-specific compliance requirements. Generates actionable remediation reports with severity rankings and fix recommendations.
---

# HIPAA Security Team - Multi-Agent Security Review System

## Overview

This skill orchestrates a team of specialized security agents that work together to perform comprehensive security reviews of AI-built software, with specific focus on HIPAA compliance and healthcare data protection.

## Architecture

```
[Security Orchestrator] (this skill)
       ↓
  ┌────┴────┐
  │ SPAWN   │ (parallel execution)
  ├─────────┴─────────────────────────────────────────┐
  ↓         ↓         ↓         ↓         ↓          ↓
[Code    [Infra   [Deps    [Auth/   [HIPAA   [AI-Code
Security] Security] Security] Access]  Compliance] Patterns]
  ↓         ↓         ↓         ↓         ↓          ↓
  └─────────┴─────────┴─────────┴─────────┴──────────┘
                         ↓
              [Report Aggregator]
                         ↓
              [Final Security Report]
```

## Execution Workflow

### Phase 1: Scope Assessment (Orchestrator)

Before spawning agents, assess the target:

1. **Identify codebase structure**: Languages, frameworks, entry points
2. **Map data flows**: Where PHI/ePHI enters, processes, stores, exits
3. **Inventory infrastructure**: Cloud provider, containers, databases, APIs
4. **Determine compliance scope**: HIPAA, SOC 2, PCI-DSS requirements

Ask user if scope unclear:
- What areas to prioritize?
- Known compliance requirements?
- Recent changes or areas of concern?

### Phase 2: Parallel Agent Deployment

Spawn these specialized agents simultaneously using the Task tool:

```
Agent 1: Code Security Analysis
- Reference: references/code-security.md
- Focus: SAST patterns, AI-code vulnerabilities, input validation, injection flaws

Agent 2: Infrastructure Security
- Reference: references/infrastructure-security.md
- Focus: IaC misconfigurations, container security, network segmentation

Agent 3: Dependency Security
- Reference: references/dependency-security.md
- Focus: SCA, vulnerable packages, supply chain risks, license compliance

Agent 4: Authentication & Access Control
- Reference: references/auth-access.md
- Focus: MFA, RBAC, session management, unique user IDs

Agent 5: HIPAA Technical Safeguards
- Reference: references/hipaa-compliance.md
- Focus: ePHI protection, encryption, audit controls, transmission security

Agent 6: AI-Generated Code Patterns
- Reference: references/ai-code-patterns.md
- Focus: Common AI code vulnerabilities (XSS, SQL injection, secrets)
```

### Phase 3: Agent Prompts

Use these prompts when spawning each subagent:

**Code Security Agent Prompt:**
```
Perform SAST-style security analysis on this codebase. Focus on:
1. Input validation and sanitization gaps
2. SQL injection vulnerabilities (check for parameterized queries)
3. Cross-site scripting (XSS) vulnerabilities
4. Command injection risks
5. Path traversal vulnerabilities
6. Insecure deserialization
7. Hardcoded secrets or credentials
8. Error handling that leaks sensitive info

For each finding, provide:
- File path and line number
- Vulnerability type and CWE ID
- Severity (Critical/High/Medium/Low)
- Code snippet showing the issue
- Recommended fix with code example

Output format: JSON array of findings
```

**Infrastructure Security Agent Prompt:**
```
Analyze infrastructure configurations for security issues. Focus on:
1. Terraform/CloudFormation/Kubernetes misconfigurations
2. Unencrypted data stores
3. Overly permissive security groups/firewall rules
4. Missing network segmentation
5. Exposed management interfaces
6. Insecure default configurations
7. Missing encryption in transit (TLS)
8. IAM/RBAC misconfigurations

For each finding, provide:
- Configuration file and location
- Misconfiguration type
- Severity and compliance impact (HIPAA, CIS benchmark)
- Current insecure configuration
- Secure configuration recommendation

Output format: JSON array of findings
```

**Dependency Security Agent Prompt:**
```
Perform software composition analysis (SCA). Focus on:
1. Known CVEs in direct dependencies
2. Vulnerable transitive dependencies
3. Outdated packages with security patches available
4. License compliance issues
5. Dependency confusion risks
6. Typosquatting package risks
7. Unmaintained/abandoned packages

For each finding, provide:
- Package name and version
- CVE ID(s) and CVSS score
- Severity (Critical/High/Medium/Low)
- Fixed version available
- Upgrade path recommendation
- Breaking change warnings

Output format: JSON array of findings
```

**Authentication & Access Agent Prompt:**
```
Review authentication and access control implementation. Focus on:
1. Multi-factor authentication (MFA) implementation
2. Password policy enforcement (complexity, rotation, history)
3. Session management (timeout, secure cookies, invalidation)
4. Role-based access control (RBAC) implementation
5. Unique user identification (no shared accounts)
6. Account lockout policies
7. Password storage (hashing algorithm, salting)
8. API authentication mechanisms

For each finding, provide:
- Component and location
- Issue description
- HIPAA requirement reference (45 CFR 164.312)
- Current implementation gap
- Recommended implementation
- Code/config example

Output format: JSON array of findings
```

**HIPAA Compliance Agent Prompt:**
```
Assess HIPAA Security Rule technical safeguards compliance. Focus on:

ACCESS CONTROLS (164.312(a)):
- Unique user identification (Required)
- Emergency access procedures (Required)
- Automatic logoff (Required 2026)
- Encryption/decryption (Required 2026)

AUDIT CONTROLS (164.312(b)):
- Comprehensive logging of PHI access
- Log retention (6+ years)
- Log integrity protection
- Regular log review procedures

INTEGRITY CONTROLS (164.312(c)):
- Data integrity mechanisms
- Authentication of ePHI sources

AUTHENTICATION (164.312(d)):
- Person/entity authentication
- MFA implementation (Required 2026)

TRANSMISSION SECURITY (164.312(e)):
- TLS 1.2+ for data in transit
- Encryption for ePHI transmission

For each finding, provide:
- Requirement reference (CFR citation)
- Required vs Addressable status (and 2026 changes)
- Current implementation status
- Compliance gap description
- Remediation steps
- Priority (based on 2026 mandatory requirements)

Output format: JSON array of findings
```

**AI-Code Patterns Agent Prompt:**
```
Analyze for vulnerabilities common in AI-generated code. Focus on:
1. Missing input sanitization (most common AI flaw)
2. XSS vulnerabilities (86% AI failure rate)
3. String-concatenated SQL instead of parameterized queries
4. Weak/deprecated cryptography
5. Hardcoded secrets and credentials
6. Missing error handling
7. Insecure default configurations
8. Overly complex dependency trees

Also check for AI/LLM-specific risks:
- Prompt injection vulnerabilities
- Insecure output handling
- Excessive agent autonomy
- System prompt leakage risks

For each finding, provide:
- File and location
- AI-specific vulnerability pattern
- Why AI tools generate this pattern
- Severity
- Secure alternative implementation

Output format: JSON array of findings
```

### Phase 4: Report Aggregation

After all agents complete, aggregate findings:

1. **Deduplicate**: Same issue found by multiple agents = higher confidence
2. **Prioritize by severity**: Critical > High > Medium > Low
3. **Add HIPAA context**: Which findings violate which requirements
4. **2026 readiness**: Flag issues that will become mandatory violations
5. **Remediation grouping**: Group fixes by component/file for efficiency

### Phase 5: Final Report Generation

Generate comprehensive report with these sections:

```markdown
# Security Assessment Report
**Date**: [date]
**Scope**: [codebase/system reviewed]
**Compliance Target**: HIPAA Security Rule (45 CFR 164.312)

## Executive Summary
- Total findings: X
- Critical: X | High: X | Medium: X | Low: X
- HIPAA compliance score: X%
- 2026 readiness score: X%

## Critical Findings Requiring Immediate Action
[Top 5 critical issues with remediation]

## HIPAA Compliance Status
| Requirement | Status | Gap | Remediation Priority |
|-------------|--------|-----|---------------------|
| Unique User ID | ✓/✗ | Description | High/Medium/Low |
| MFA | ✓/✗ | Description | CRITICAL (2026) |
| Encryption at Rest | ✓/✗ | Description | CRITICAL (2026) |
| ...

## Detailed Findings by Category

### Code Security (X findings)
[Findings with remediation code]

### Infrastructure Security (X findings)
[Findings with config fixes]

### Dependency Vulnerabilities (X findings)
[Packages to upgrade]

### Authentication & Access (X findings)
[Implementation gaps]

### AI-Code Pattern Issues (X findings)
[AI-specific vulnerabilities]

## Remediation Roadmap
### Immediate (This Week)
- [Critical fixes]

### Short-term (30 days)
- [High-priority fixes]

### Medium-term (90 days)
- [Medium-priority and 2026 prep]

## Appendix
- Full finding details
- Tool versions used
- Agent execution logs
```

## Quick Start

For immediate security review, run:

```
Perform a comprehensive HIPAA security review of this codebase.
Focus on: [specific areas if any]
Compliance targets: HIPAA, [others]
```

The orchestrator will:
1. Analyze scope
2. Spawn 6 specialized agents in parallel
3. Aggregate findings
4. Generate prioritized remediation report

## Reference Files

Load these as needed for deep-dive analysis:
- `references/hipaa-compliance.md` - Full HIPAA technical safeguards checklist
- `references/code-security.md` - SAST patterns and vulnerability detection
- `references/infrastructure-security.md` - IaC and cloud security checks
- `references/dependency-security.md` - SCA and supply chain analysis
- `references/auth-access.md` - Authentication and access control standards
- `references/ai-code-patterns.md` - AI-generated code vulnerability patterns
- `references/remediation-templates.md` - Code fix templates by vulnerability type
