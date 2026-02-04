# Security Remediation Templates

## Quick Fix Templates by Vulnerability Type

### SQL Injection Fixes

**Python/SQLAlchemy:**
```python
# BEFORE (vulnerable)
cursor.execute(f"SELECT * FROM users WHERE id = {user_id}")

# AFTER (secure)
cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))

# SQLAlchemy ORM
user = session.query(User).filter(User.id == user_id).first()

# SQLAlchemy Core with text()
from sqlalchemy import text
result = session.execute(
    text("SELECT * FROM users WHERE id = :id"),
    {"id": user_id}
)
```

**JavaScript/Node.js:**
```javascript
// BEFORE (vulnerable)
db.query(`SELECT * FROM users WHERE id = ${userId}`);

// AFTER (secure) - MySQL
db.query("SELECT * FROM users WHERE id = ?", [userId]);

// AFTER (secure) - PostgreSQL
pool.query("SELECT * FROM users WHERE id = $1", [userId]);

// AFTER (secure) - Prisma
const user = await prisma.user.findUnique({ where: { id: userId } });
```

### XSS Prevention Fixes

**React:**
```jsx
// BEFORE (vulnerable)
<div dangerouslySetInnerHTML={{__html: userContent}} />

// AFTER (secure) - text only
<div>{userContent}</div>

// AFTER (secure) - if HTML needed
import DOMPurify from 'dompurify';
<div dangerouslySetInnerHTML={{__html: DOMPurify.sanitize(userContent)}} />
```

**Vanilla JavaScript:**
```javascript
// BEFORE (vulnerable)
element.innerHTML = userInput;

// AFTER (secure)
element.textContent = userInput;

// If HTML needed
import DOMPurify from 'dompurify';
element.innerHTML = DOMPurify.sanitize(userInput);
```

**Python/Jinja2:**
```python
# BEFORE (vulnerable)
return f"<div>{user_input}</div>"

# AFTER (secure) - auto-escaped
return render_template("page.html", content=user_input)

# Force escape if needed
from markupsafe import escape
return f"<div>{escape(user_input)}</div>"
```

### Input Validation Templates

**Python/Pydantic:**
```python
from pydantic import BaseModel, validator, constr, EmailStr
from typing import Optional

class PatientInput(BaseModel):
    id: int
    name: constr(min_length=1, max_length=100, pattern=r'^[a-zA-Z\s\-]+$')
    email: EmailStr
    phone: Optional[constr(pattern=r'^\+?1?\d{10,14}$')] = None
    ssn: Optional[constr(pattern=r'^\d{3}-\d{2}-\d{4}$')] = None

    @validator('id')
    def validate_id(cls, v):
        if v <= 0:
            raise ValueError('ID must be positive')
        return v

# Usage
@app.route('/patient', methods=['POST'])
def create_patient():
    try:
        patient = PatientInput(**request.json)
    except ValidationError as e:
        return {"errors": e.errors()}, 400
    # Process validated data
```

**JavaScript/Zod:**
```javascript
import { z } from 'zod';

const PatientSchema = z.object({
  id: z.number().positive(),
  name: z.string().min(1).max(100).regex(/^[a-zA-Z\s\-]+$/),
  email: z.string().email(),
  phone: z.string().regex(/^\+?1?\d{10,14}$/).optional(),
  ssn: z.string().regex(/^\d{3}-\d{2}-\d{4}$/).optional(),
});

// Usage
app.post('/patient', (req, res) => {
  const result = PatientSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ errors: result.error.issues });
  }
  // Process validated data
});
```

### Password Security Fixes

```python
# BEFORE (vulnerable)
import hashlib
password_hash = hashlib.md5(password.encode()).hexdigest()

# AFTER (secure)
import bcrypt

def hash_password(password: str) -> bytes:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12))

def verify_password(password: str, hashed: bytes) -> bool:
    return bcrypt.checkpw(password.encode(), hashed)

# Password validation
def validate_password(password: str) -> list[str]:
    errors = []
    if len(password) < 12:
        errors.append("Minimum 12 characters")
    if not any(c.isupper() for c in password):
        errors.append("Must contain uppercase")
    if not any(c.islower() for c in password):
        errors.append("Must contain lowercase")
    if not any(c.isdigit() for c in password):
        errors.append("Must contain number")
    if not any(c in "!@#$%^&*" for c in password):
        errors.append("Must contain special character")
    return errors
```

### MFA Implementation Template

```python
import pyotp
import qrcode
from io import BytesIO
import base64

class MFAService:
    def generate_secret(self) -> str:
        return pyotp.random_base32()

    def get_qr_code(self, user_email: str, secret: str) -> str:
        totp = pyotp.TOTP(secret)
        uri = totp.provisioning_uri(user_email, issuer_name="YourApp")
        qr = qrcode.make(uri)
        buffer = BytesIO()
        qr.save(buffer, format='PNG')
        return base64.b64encode(buffer.getvalue()).decode()

    def verify_code(self, secret: str, code: str) -> bool:
        totp = pyotp.TOTP(secret)
        return totp.verify(code, valid_window=1)

# Usage
@app.route('/setup-mfa', methods=['POST'])
@login_required
def setup_mfa():
    mfa = MFAService()
    secret = mfa.generate_secret()
    current_user.mfa_secret = secret  # Store encrypted
    qr_code = mfa.get_qr_code(current_user.email, secret)
    return {"qr_code": qr_code}

@app.route('/verify-mfa', methods=['POST'])
@login_required
def verify_mfa():
    mfa = MFAService()
    if mfa.verify_code(current_user.mfa_secret, request.json['code']):
        current_user.mfa_enabled = True
        return {"success": True}
    return {"error": "Invalid code"}, 400
```

### Session Management Template

```python
from flask import Flask, session
from datetime import timedelta

app = Flask(__name__)
app.config.update(
    SECRET_KEY=os.environ.get('SECRET_KEY'),
    SESSION_COOKIE_SECURE=True,
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE='Strict',
    PERMANENT_SESSION_LIFETIME=timedelta(minutes=30),
)

@app.before_request
def check_session_timeout():
    session.permanent = True
    last_activity = session.get('last_activity')
    if last_activity:
        elapsed = datetime.utcnow() - datetime.fromisoformat(last_activity)
        if elapsed > timedelta(minutes=30):
            session.clear()
            return redirect(url_for('login'))
    session['last_activity'] = datetime.utcnow().isoformat()
```

### Encryption Templates

**Data at Rest:**
```python
from cryptography.fernet import Fernet
import os

class FieldEncryption:
    def __init__(self):
        key = os.environ.get('ENCRYPTION_KEY')
        if not key:
            raise ValueError("ENCRYPTION_KEY not set")
        self.cipher = Fernet(key.encode())

    def encrypt(self, data: str) -> str:
        return self.cipher.encrypt(data.encode()).decode()

    def decrypt(self, data: str) -> str:
        return self.cipher.decrypt(data.encode()).decode()

# Usage for PHI fields
encryption = FieldEncryption()

class Patient(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100))
    _ssn = db.Column('ssn', db.String(256))  # Encrypted

    @property
    def ssn(self):
        return encryption.decrypt(self._ssn) if self._ssn else None

    @ssn.setter
    def ssn(self, value):
        self._ssn = encryption.encrypt(value) if value else None
```

**Data in Transit (TLS config):**
```nginx
# nginx.conf
server {
    listen 443 ssl http2;
    ssl_certificate /etc/ssl/certs/server.crt;
    ssl_certificate_key /etc/ssl/private/server.key;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
}
```

### Audit Logging Template

```python
import logging
from datetime import datetime
import json

class AuditLogger:
    def __init__(self):
        self.logger = logging.getLogger('audit')
        handler = logging.FileHandler('/var/log/hipaa_audit.log')
        handler.setFormatter(logging.Formatter('%(message)s'))
        self.logger.addHandler(handler)
        self.logger.setLevel(logging.INFO)

    def log(self, user_id: str, action: str, resource: str,
            resource_id: str = None, outcome: str = "success",
            phi_accessed: bool = False, details: dict = None):
        entry = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "user_id": user_id,
            "action": action,
            "resource": resource,
            "resource_id": resource_id,
            "outcome": outcome,
            "phi_accessed": phi_accessed,
            "ip_address": request.remote_addr if request else None,
            "user_agent": request.user_agent.string if request else None,
            "details": details
        }
        self.logger.info(json.dumps(entry))

# Usage
audit = AuditLogger()

@app.route('/patient/<id>')
@login_required
def get_patient(id):
    audit.log(
        user_id=current_user.id,
        action="read",
        resource="patient",
        resource_id=id,
        phi_accessed=True
    )
    return patient_service.get(id)
```

### Secrets Management Template

```python
# Using environment variables (basic)
import os

DATABASE_URL = os.environ.get('DATABASE_URL')
API_KEY = os.environ.get('API_KEY')

# Using AWS Secrets Manager
import boto3
import json

def get_secret(secret_name: str) -> dict:
    client = boto3.client('secretsmanager')
    response = client.get_secret_value(SecretId=secret_name)
    return json.loads(response['SecretString'])

# Using HashiCorp Vault
import hvac

def get_vault_secret(path: str) -> dict:
    client = hvac.Client(url=os.environ['VAULT_ADDR'])
    client.token = os.environ['VAULT_TOKEN']
    secret = client.secrets.kv.v2.read_secret_version(path=path)
    return secret['data']['data']
```

### RBAC Implementation Template

```python
from functools import wraps
from enum import Enum

class Permission(Enum):
    VIEW_PATIENT = "patient:view"
    EDIT_PATIENT = "patient:edit"
    VIEW_PHI = "phi:view"
    ADMIN = "admin:all"

ROLES = {
    "physician": [Permission.VIEW_PATIENT, Permission.EDIT_PATIENT, Permission.VIEW_PHI],
    "nurse": [Permission.VIEW_PATIENT, Permission.VIEW_PHI],
    "billing": [Permission.VIEW_PATIENT],
    "admin": [Permission.ADMIN],
}

def require_permission(*permissions):
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            user_perms = set(ROLES.get(current_user.role, []))

            # Admin has all permissions
            if Permission.ADMIN in user_perms:
                return f(*args, **kwargs)

            # Check required permissions
            required = set(permissions)
            if not required.issubset(user_perms):
                audit.log(
                    user_id=current_user.id,
                    action="access_denied",
                    resource=f.__name__,
                    outcome="denied",
                    details={"required": [p.value for p in required]}
                )
                raise PermissionDenied()

            return f(*args, **kwargs)
        return decorated
    return decorator

# Usage
@app.route('/patient/<id>')
@login_required
@require_permission(Permission.VIEW_PATIENT)
def get_patient(id):
    return patient_service.get(id)

@app.route('/patient/<id>/phi')
@login_required
@require_permission(Permission.VIEW_PATIENT, Permission.VIEW_PHI)
def get_patient_phi(id):
    return patient_service.get_phi(id)
```

### Kubernetes Security Fixes

```yaml
# BEFORE (insecure)
apiVersion: v1
kind: Pod
spec:
  containers:
  - name: app
    image: app:latest

# AFTER (secure)
apiVersion: v1
kind: Pod
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
    fsGroup: 1000
    seccompProfile:
      type: RuntimeDefault
  containers:
  - name: app
    image: app:latest@sha256:abc123...  # Pinned digest
    securityContext:
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: true
      capabilities:
        drop:
          - ALL
    resources:
      limits:
        memory: "512Mi"
        cpu: "500m"
      requests:
        memory: "256Mi"
        cpu: "250m"
```

### Terraform Security Fixes

```hcl
# BEFORE (insecure)
resource "aws_s3_bucket" "data" {
  bucket = "patient-data"
}

# AFTER (secure)
resource "aws_s3_bucket" "data" {
  bucket = "patient-data"
}

resource "aws_s3_bucket_server_side_encryption_configuration" "data" {
  bucket = aws_s3_bucket.data.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.data.arn
    }
  }
}

resource "aws_s3_bucket_public_access_block" "data" {
  bucket                  = aws_s3_bucket.data.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "data" {
  bucket = aws_s3_bucket.data.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_logging" "data" {
  bucket        = aws_s3_bucket.data.id
  target_bucket = aws_s3_bucket.logs.id
  target_prefix = "data-access-logs/"
}
```
