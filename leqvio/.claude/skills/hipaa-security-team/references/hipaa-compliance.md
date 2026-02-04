# HIPAA Technical Safeguards Compliance Checklist

## Quick Reference: 45 CFR 164.312

### Access Controls (164.312(a))

| Specification | Status | 2026 Change | Check |
|--------------|--------|-------------|-------|
| Unique User ID | Required | No change | No shared accounts, all users uniquely identified |
| Emergency Access | Required | No change | Documented break-glass procedures |
| Automatic Logoff | Addressable | **REQUIRED** | Session timeout 15-30 min, screen lock |
| Encryption/Decryption | Addressable | **REQUIRED** | AES-256 for ePHI at rest |

### Audit Controls (164.312(b))

| Control | Requirement | Check |
|---------|-------------|-------|
| Activity Logging | Required | Log all ePHI access: user, timestamp, action, resource |
| Log Retention | Required | Minimum 6 years retention |
| Log Protection | Required | Immutable/append-only, tamper-evident |
| Log Review | Required | Documented review procedures, regular audits |

### Integrity Controls (164.312(c))

| Control | Requirement | Check |
|---------|-------------|-------|
| Data Integrity | Required | SHA-256+ hashing, checksums on ePHI |
| Source Authentication | Required | Digital signatures for critical records |

### Authentication (164.312(d))

| Specification | Status | 2026 Change | Check |
|--------------|--------|-------------|-------|
| Person/Entity Auth | Required | No change | Verify identity before ePHI access |
| MFA | Recommended | **REQUIRED** | 2+ factors from different categories |

### Transmission Security (164.312(e))

| Specification | Status | Check |
|--------------|--------|-------|
| Encryption | Required | TLS 1.2+ for all ePHI in transit |
| Integrity Controls | Required | HMAC-SHA256 for message authentication |

## Detailed Compliance Checks

### 1. Unique User Identification

**Must verify:**
- [ ] No accounts named "admin", "clinical", "nurse", etc. used by multiple people
- [ ] All workforce members have individual credentials
- [ ] User IDs traceable to specific individuals
- [ ] Contractor/temp accounts separately identified
- [ ] Service accounts documented and justified

**Code patterns to flag:**
```python
# BAD: Shared credentials
username = "clinic_user"
password = os.environ.get("SHARED_PASSWORD")

# GOOD: Individual authentication
user = authenticate_user(request.credentials)
audit_log.record(user_id=user.id, action="login")
```

### 2. Emergency Access Procedures

**Must verify:**
- [ ] Documented break-glass procedures exist
- [ ] Emergency scenarios defined (system down, disaster)
- [ ] Authorization chain for emergency access
- [ ] All emergency access logged separately
- [ ] Annual testing of emergency procedures

### 3. Automatic Logoff (CRITICAL for 2026)

**Must verify:**
- [ ] Session timeout configured (15-30 minutes recommended)
- [ ] Timeout triggers screen lock, not just app close
- [ ] Session tokens invalidated on timeout
- [ ] Warning displayed before automatic logout
- [ ] Timeout events logged

**Code patterns to check:**
```javascript
// Check session middleware
app.use(session({
  cookie: { maxAge: 1800000 }, // 30 minutes
  rolling: true,
  resave: false
}));

// Check for idle timeout
if (Date.now() - lastActivity > SESSION_TIMEOUT) {
  session.destroy();
  redirect('/login');
}
```

### 4. Encryption at Rest (CRITICAL for 2026)

**Must verify:**
- [ ] Database fields containing PHI encrypted (AES-256)
- [ ] Full-disk encryption on all devices
- [ ] Backup media encrypted
- [ ] Encryption keys stored separately from data
- [ ] Key rotation procedures documented

**Database encryption check:**
```sql
-- PostgreSQL: Check for encrypted columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'patients';
-- PHI columns should use pgcrypto or similar

-- Check TDE (Transparent Data Encryption) status
SHOW ssl;
```

**Key management check:**
- Keys NOT in source code
- Keys NOT in configuration files
- Keys in dedicated KMS (AWS KMS, HashiCorp Vault, etc.)

### 5. Audit Controls - Comprehensive Logging

**Must verify logging of:**
- [ ] All authentication events (success/failure)
- [ ] All ePHI access (read, create, modify, delete)
- [ ] Permission changes
- [ ] Configuration changes
- [ ] Failed authorization attempts
- [ ] Bulk data operations (exports, downloads)

**Log entry requirements:**
```json
{
  "timestamp": "2026-02-03T14:30:00Z",
  "user_id": "user123",
  "action": "read",
  "resource": "patient_record",
  "resource_id": "patient456",
  "ip_address": "192.168.1.100",
  "outcome": "success",
  "phi_accessed": true
}
```

**Log protection check:**
- [ ] Logs stored in separate system from application
- [ ] Logs cannot be modified by application users
- [ ] Log integrity verification (checksums)
- [ ] Centralized logging (ELK, Splunk, CloudWatch)

### 6. Multi-Factor Authentication (CRITICAL for 2026)

**Must verify:**
- [ ] MFA enabled for ALL ePHI system access
- [ ] MFA uses 2+ different factor categories
- [ ] Remote access requires MFA
- [ ] Administrative access requires MFA

**Valid MFA combinations:**
- Password + TOTP (authenticator app)
- Password + SMS code
- Password + hardware token
- Biometric + PIN
- Smart card + password

**Invalid (NOT compliant):**
- Password + security questions (both knowledge)
- Password alone
- Email verification link only

**Code implementation check:**
```python
# Check for MFA enforcement
@require_mfa
def access_patient_data(request):
    if not request.user.mfa_verified:
        raise PermissionDenied("MFA required")
    # ... access data
```

### 7. Transmission Security

**Must verify:**
- [ ] All web traffic uses HTTPS (TLS 1.2+)
- [ ] TLS 1.0/1.1 disabled
- [ ] Strong cipher suites only
- [ ] Valid certificates (not self-signed in production)
- [ ] HSTS enabled
- [ ] API endpoints use TLS

**TLS configuration check (nginx example):**
```nginx
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
ssl_prefer_server_ciphers on;
add_header Strict-Transport-Security "max-age=31536000" always;
```

**Database connections:**
```python
# PostgreSQL with SSL
conn = psycopg2.connect(
    host="db.example.com",
    sslmode="verify-full",
    sslrootcert="/path/to/ca.crt"
)
```

### 8. Data Integrity Controls

**Must verify:**
- [ ] Hashing for data at rest verification
- [ ] Digital signatures for critical documents
- [ ] Checksums for data transmission
- [ ] Change tracking (before/after values)

**Implementation example:**
```python
import hashlib

def store_record(data):
    # Calculate integrity hash
    data['integrity_hash'] = hashlib.sha256(
        json.dumps(data, sort_keys=True).encode()
    ).hexdigest()
    db.save(data)

def verify_record(record):
    stored_hash = record.pop('integrity_hash')
    calculated_hash = hashlib.sha256(
        json.dumps(record, sort_keys=True).encode()
    ).hexdigest()
    return stored_hash == calculated_hash
```

## 2026 Readiness Scoring

**CRITICAL (Must fix before 2026):**
- Encryption at rest not implemented
- MFA not enforced
- Automatic logoff not configured
- Network segmentation missing

**HIGH (Should fix soon):**
- Audit logs incomplete
- Key management informal
- Emergency procedures not tested

**MEDIUM (Plan for remediation):**
- Log review procedures informal
- Backup encryption not verified
- Training documentation incomplete

## Common HIPAA Violations to Flag

1. **Shared accounts** - Any generic username like "admin", "clinical", "billing"
2. **Unencrypted ePHI** - Database fields, backups, mobile devices
3. **Missing MFA** - Especially for remote access
4. **Inadequate logging** - Can't answer "who accessed what when"
5. **No session timeout** - Sessions that never expire
6. **Unencrypted transmission** - HTTP instead of HTTPS
7. **Keys in code** - Encryption keys hardcoded or in config files
8. **Missing BAAs** - Third-party services handling PHI without agreements
