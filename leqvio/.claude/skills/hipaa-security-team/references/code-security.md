# Code Security Analysis Reference

## SAST Vulnerability Patterns

### 1. SQL Injection (CWE-89)

**Detection patterns:**
```python
# VULNERABLE: String concatenation
query = "SELECT * FROM users WHERE id = " + user_id
query = f"SELECT * FROM patients WHERE name = '{name}'"
cursor.execute("SELECT * FROM records WHERE id = %s" % record_id)

# SECURE: Parameterized queries
cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))
query = text("SELECT * FROM patients WHERE name = :name").bindparams(name=name)
```

```javascript
// VULNERABLE
const query = `SELECT * FROM users WHERE id = ${userId}`;
db.query("SELECT * FROM patients WHERE name = '" + name + "'");

// SECURE
db.query("SELECT * FROM users WHERE id = ?", [userId]);
const [rows] = await pool.execute("SELECT * FROM patients WHERE name = ?", [name]);
```

**Grep patterns:**
```
"SELECT.*\+.*"
"SELECT.*\$\{.*\}"
"SELECT.*%s.*%"
"execute\(.*\+.*\)"
"query\(.*\+.*\)"
```

### 2. Cross-Site Scripting (CWE-79)

**Detection patterns:**
```javascript
// VULNERABLE: Direct DOM injection
element.innerHTML = userInput;
document.write(data);
$(selector).html(untrustedData);

// VULNERABLE: React dangerouslySetInnerHTML without sanitization
<div dangerouslySetInnerHTML={{__html: userContent}} />

// SECURE: Text content or sanitization
element.textContent = userInput;
DOMPurify.sanitize(userInput);
```

```python
# VULNERABLE: Template without escaping
return f"<div>{user_input}</div>"
render_template_string("<p>" + comment + "</p>")

# SECURE: Auto-escaping templates
return render_template("page.html", content=user_input)  # Jinja2 escapes by default
```

**Grep patterns:**
```
"innerHTML\s*="
"dangerouslySetInnerHTML"
"document\.write"
"\$\(.*\)\.html\("
"v-html="
```

### 3. Command Injection (CWE-78)

**Detection patterns:**
```python
# VULNERABLE
os.system("ping " + hostname)
subprocess.call("ls " + directory, shell=True)
os.popen("cat " + filename)

# SECURE
subprocess.run(["ping", "-c", "4", hostname], shell=False)
subprocess.run(["ls", directory], shell=False, check=True)
```

```javascript
// VULNERABLE
exec("ls " + userDir);
child_process.execSync(`cat ${filename}`);

// SECURE
execFile("ls", [userDir]);
spawn("cat", [filename]);
```

**Grep patterns:**
```
"os\.system\(.*\+"
"subprocess.*shell=True"
"exec\(.*\+"
"child_process\.exec"
```

### 4. Path Traversal (CWE-22)

**Detection patterns:**
```python
# VULNERABLE
file_path = "/data/" + user_filename
open(request.args.get('file'))

# SECURE
import os
safe_path = os.path.normpath(os.path.join(BASE_DIR, user_filename))
if not safe_path.startswith(BASE_DIR):
    raise SecurityError("Path traversal attempt")
```

**Grep patterns:**
```
"open\(.*request\."
"os\.path\.join\(.*user"
"\.\./"
```

### 5. Hardcoded Secrets (CWE-798)

**Detection patterns:**
```python
# VULNERABLE
API_KEY = "sk-1234567890abcdef"
password = "admin123"
db_connection = "postgresql://user:password@host/db"
aws_secret = "AKIA..."

# SECURE
API_KEY = os.environ.get("API_KEY")
password = secrets.get("DB_PASSWORD")
```

**Grep patterns (high-entropy strings):**
```
"(api|secret|key|password|token|auth).*=.*['\"][A-Za-z0-9+/]{20,}['\"]"
"AWS[A-Za-z0-9]{16,}"
"sk-[A-Za-z0-9]{32,}"
"ghp_[A-Za-z0-9]{36}"
"-----BEGIN.*PRIVATE KEY-----"
```

### 6. Insecure Cryptography (CWE-327)

**Detection patterns:**
```python
# VULNERABLE: Weak algorithms
hashlib.md5(password.encode())
hashlib.sha1(data)
from Crypto.Cipher import DES
cipher = DES.new(key, DES.MODE_ECB)

# SECURE
import bcrypt
hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt())

from cryptography.fernet import Fernet
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
cipher = Cipher(algorithms.AES256(key), modes.GCM(iv))
```

**Grep patterns:**
```
"md5\("
"sha1\("
"DES\."
"MODE_ECB"
"RC4"
```

### 7. Insecure Deserialization (CWE-502)

**Detection patterns:**
```python
# VULNERABLE
pickle.loads(user_data)
yaml.load(data)  # without Loader
marshal.loads(data)

# SECURE
yaml.safe_load(data)
json.loads(data)  # JSON is safer for untrusted data
```

**Grep patterns:**
```
"pickle\.loads"
"yaml\.load\([^,)]*\)"  # yaml.load without Loader
"marshal\.loads"
"unserialize\("  # PHP
```

### 8. Missing Authentication (CWE-306)

**Detection patterns:**
```python
# VULNERABLE: No auth decorator
@app.route('/admin/users')
def list_users():
    return get_all_users()

# SECURE
@app.route('/admin/users')
@login_required
@require_role('admin')
def list_users():
    return get_all_users()
```

**Check for:**
- API endpoints without authentication middleware
- Admin routes without authorization checks
- Sensitive data access without role verification

### 9. Sensitive Data Exposure (CWE-200)

**Detection patterns:**
```python
# VULNERABLE: Logging sensitive data
logger.info(f"User login: {username}, password: {password}")
print(f"Processing patient: {patient_record}")

# VULNERABLE: Error messages exposing internals
except Exception as e:
    return {"error": str(e), "stack": traceback.format_exc()}

# SECURE
logger.info(f"User login: {username}")  # No password
except Exception as e:
    logger.error(f"Error: {e}")  # Log internally
    return {"error": "An error occurred"}  # Generic to user
```

**Grep patterns:**
```
"log.*password"
"print.*patient"
"traceback.*format"
"str\(e\)"  # in API responses
```

### 10. Missing Input Validation (CWE-20)

**Detection patterns:**
```python
# VULNERABLE: Direct use of user input
user_id = request.args.get('id')
records = db.query(f"id = {user_id}")

# SECURE: Validation
from pydantic import BaseModel, validator

class UserQuery(BaseModel):
    id: int

    @validator('id')
    def validate_id(cls, v):
        if v < 0:
            raise ValueError('ID must be positive')
        return v
```

**Check for:**
- Request parameters used without validation
- Missing type checking
- Missing range/format validation
- Missing sanitization before storage

## Severity Classification

| Vulnerability | Severity | HIPAA Impact |
|--------------|----------|--------------|
| SQL Injection | Critical | ePHI exposure, data breach |
| Command Injection | Critical | System compromise |
| Hardcoded Secrets | Critical | Full system access |
| XSS (Stored) | High | Session hijacking, PHI theft |
| Path Traversal | High | File access, config exposure |
| Weak Crypto | High | ePHI decryption possible |
| Missing Auth | High | Unauthorized access |
| Insecure Deserial | High | Remote code execution |
| XSS (Reflected) | Medium | Phishing, session theft |
| Sensitive Logging | Medium | Log-based PHI exposure |
| Missing Validation | Medium | Various attacks enabled |
