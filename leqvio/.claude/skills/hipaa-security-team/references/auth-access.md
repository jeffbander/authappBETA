# Authentication & Access Control Analysis Reference

## HIPAA Authentication Requirements

### Multi-Factor Authentication (MFA) - REQUIRED 2026

**Verification checklist:**
- [ ] MFA enforced for ALL ePHI access (not optional)
- [ ] MFA required for remote access
- [ ] MFA required for admin access
- [ ] Uses 2+ different factor categories

**Valid MFA implementations:**
```python
# Example: TOTP verification
import pyotp

def verify_mfa(user, token):
    totp = pyotp.TOTP(user.mfa_secret)
    return totp.verify(token, valid_window=1)

@app.route('/login', methods=['POST'])
def login():
    user = authenticate(request.form['username'], request.form['password'])
    if not user:
        return error("Invalid credentials")

    # MFA step required
    if not verify_mfa(user, request.form['mfa_token']):
        return error("Invalid MFA token")

    return create_session(user)
```

**MFA patterns to flag as INSECURE:**
```python
# BAD: Optional MFA
if user.mfa_enabled:
    verify_mfa(user, token)

# BAD: MFA bypass for "trusted" devices
if device.is_trusted:
    skip_mfa = True

# BAD: Email as second factor only (easily compromised)
send_verification_email(user.email)
```

### Unique User Identification - REQUIRED

**Must verify:**
- [ ] No shared accounts (admin, clinical, billing, etc.)
- [ ] Each user has unique identifier
- [ ] All actions traceable to specific user

**Patterns to flag:**
```python
# BAD: Shared account check
if username in ["admin", "clinical", "nurse", "billing", "system"]:
    flag_shared_account(username)

# BAD: Generic login
def login_as_department(department):
    return get_shared_credentials(department)
```

**Correct pattern:**
```python
# GOOD: Individual user tracking
def access_patient_record(user, patient_id):
    audit_log.record(
        user_id=user.id,
        user_name=user.full_name,
        action="access",
        resource="patient_record",
        resource_id=patient_id,
        timestamp=datetime.utcnow()
    )
    return get_patient_record(patient_id)
```

### Password Security

**Requirements check:**
```python
# Password policy validation
def validate_password(password, user):
    errors = []

    # Minimum length (8+ required, 12+ recommended)
    if len(password) < 12:
        errors.append("Password must be at least 12 characters")

    # Complexity
    if not re.search(r'[A-Z]', password):
        errors.append("Must contain uppercase")
    if not re.search(r'[a-z]', password):
        errors.append("Must contain lowercase")
    if not re.search(r'\d', password):
        errors.append("Must contain number")
    if not re.search(r'[!@#$%^&*]', password):
        errors.append("Must contain special character")

    # Not username or common pattern
    if user.username.lower() in password.lower():
        errors.append("Cannot contain username")

    # Not in breach database (recommended)
    if is_breached_password(password):
        errors.append("Password found in data breach")

    return errors
```

**Password storage check:**
```python
# INSECURE patterns
password_hash = md5(password)           # WEAK
password_hash = sha1(password)          # WEAK
password_hash = sha256(password)        # No salt
stored_password = password              # Plaintext!

# SECURE pattern
import bcrypt

def hash_password(password):
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12))

def verify_password(password, hash):
    return bcrypt.checkpw(password.encode(), hash)
```

### Session Management

**HIPAA requirements:**
```python
# Session configuration checklist
SESSION_CONFIG = {
    'timeout': 1800,          # 30 minutes max for ePHI systems
    'secure_cookie': True,    # HTTPS only
    'httponly': True,         # No JavaScript access
    'samesite': 'Strict',     # CSRF protection
}

# Flask example
app.config.update(
    SESSION_COOKIE_SECURE=True,
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE='Strict',
    PERMANENT_SESSION_LIFETIME=timedelta(minutes=30)
)
```

**Automatic logoff implementation:**
```javascript
// Frontend session timeout
let idleTime = 0;
const maxIdleTime = 30 * 60 * 1000; // 30 minutes

document.addEventListener('mousemove', resetTimer);
document.addEventListener('keypress', resetTimer);

function resetTimer() {
    idleTime = 0;
}

setInterval(() => {
    idleTime += 1000;
    if (idleTime >= maxIdleTime - 60000) {
        showWarning("Session expiring in 1 minute");
    }
    if (idleTime >= maxIdleTime) {
        logout();
    }
}, 1000);
```

**Backend session validation:**
```python
def validate_session(session_token):
    session = get_session(session_token)

    if not session:
        raise SessionInvalid("Session not found")

    # Check expiry
    if session.expires_at < datetime.utcnow():
        destroy_session(session_token)
        raise SessionExpired("Session expired")

    # Check idle timeout
    if session.last_activity < datetime.utcnow() - timedelta(minutes=30):
        destroy_session(session_token)
        raise SessionTimeout("Session timed out due to inactivity")

    # Update last activity
    session.last_activity = datetime.utcnow()
    save_session(session)

    return session
```

### Role-Based Access Control (RBAC)

**Implementation check:**
```python
# GOOD: RBAC implementation
class Permission:
    VIEW_PATIENT = "patient:view"
    EDIT_PATIENT = "patient:edit"
    VIEW_PHI = "phi:view"
    ADMIN = "admin:all"

class Role:
    PHYSICIAN = [Permission.VIEW_PATIENT, Permission.EDIT_PATIENT, Permission.VIEW_PHI]
    NURSE = [Permission.VIEW_PATIENT, Permission.VIEW_PHI]
    BILLING = [Permission.VIEW_PATIENT]  # No PHI access
    ADMIN = [Permission.ADMIN]

def require_permission(permission):
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            if permission not in current_user.permissions:
                audit_log.record(
                    user_id=current_user.id,
                    action="access_denied",
                    required_permission=permission
                )
                raise PermissionDenied()
            return f(*args, **kwargs)
        return decorated
    return decorator

@app.route('/patient/<id>')
@require_permission(Permission.VIEW_PATIENT)
def get_patient(id):
    return patient_service.get(id)
```

**Minimum necessary principle:**
```python
# GOOD: Filter data based on role
def get_patient_data(patient_id, user):
    patient = Patient.get(patient_id)

    if Permission.VIEW_PHI in user.permissions:
        return patient.full_record()  # Includes PHI
    else:
        return patient.summary()  # No PHI
```

### API Authentication

**JWT validation:**
```python
# Required JWT checks
def validate_jwt(token):
    try:
        payload = jwt.decode(
            token,
            JWT_SECRET,
            algorithms=['HS256'],
            options={
                'require': ['exp', 'iat', 'sub'],
                'verify_exp': True,
                'verify_iat': True,
            }
        )

        # Additional validation
        if payload['iat'] > time.time():
            raise InvalidToken("Token issued in future")

        if payload['exp'] - payload['iat'] > 3600:
            raise InvalidToken("Token lifetime too long")

        return payload

    except jwt.ExpiredSignatureError:
        raise TokenExpired()
    except jwt.InvalidTokenError as e:
        raise InvalidToken(str(e))
```

**API key management:**
```python
# GOOD: Scoped API keys
class APIKey:
    def __init__(self, key_id, scopes, expires_at):
        self.key_id = key_id
        self.scopes = scopes
        self.expires_at = expires_at

def validate_api_key(key):
    api_key = get_api_key(key)

    if not api_key:
        raise InvalidKey()

    if api_key.expires_at < datetime.utcnow():
        raise KeyExpired()

    # Log API key usage
    audit_log.record(
        key_id=api_key.key_id,
        action="api_access",
        timestamp=datetime.utcnow()
    )

    return api_key
```

### Account Lockout

```python
# Required: Account lockout after failed attempts
MAX_FAILED_ATTEMPTS = 5
LOCKOUT_DURATION = timedelta(minutes=15)

def handle_login_attempt(username, password):
    user = get_user(username)

    if user.is_locked():
        if user.lockout_expires > datetime.utcnow():
            raise AccountLocked(f"Account locked until {user.lockout_expires}")
        else:
            user.unlock()

    if not verify_password(password, user.password_hash):
        user.failed_attempts += 1

        if user.failed_attempts >= MAX_FAILED_ATTEMPTS:
            user.lock(until=datetime.utcnow() + LOCKOUT_DURATION)
            audit_log.record(
                user_id=user.id,
                action="account_locked",
                reason="max_failed_attempts"
            )
            raise AccountLocked()

        raise InvalidCredentials()

    user.failed_attempts = 0
    return create_session(user)
```

### Emergency Access Procedures

```python
# Break-glass implementation
class EmergencyAccess:
    def request(self, user, patient_id, reason):
        # Log emergency access request
        request = EmergencyAccessRequest.create(
            user_id=user.id,
            patient_id=patient_id,
            reason=reason,
            timestamp=datetime.utcnow()
        )

        # Alert security/compliance
        notify_security_team(request)

        # Grant temporary elevated access
        grant_emergency_access(user, patient_id, duration=timedelta(hours=4))

        # Require follow-up documentation
        schedule_audit_review(request)

        return request

@app.route('/emergency-access', methods=['POST'])
@require_authentication
def emergency_access():
    request = EmergencyAccess().request(
        user=current_user,
        patient_id=request.json['patient_id'],
        reason=request.json['reason']
    )
    return {"request_id": request.id, "expires_in": "4 hours"}
```

### Severity Classification

| Finding | Severity | HIPAA Impact |
|---------|----------|--------------|
| No MFA | Critical | 2026 violation, unauthorized access |
| Shared accounts | Critical | No accountability, audit failure |
| Plaintext passwords | Critical | Mass credential exposure |
| Weak password policy | High | Brute force vulnerability |
| No session timeout | High | Unauthorized access via abandoned session |
| Missing RBAC | High | Excessive access to PHI |
| No account lockout | Medium | Brute force enabled |
| Weak JWT validation | High | Token forgery possible |
| Missing audit logging | High | Compliance violation |
