# Infrastructure Security Analysis Reference

## IaC Security Checks

### Terraform Misconfigurations

#### 1. Unencrypted Storage (HIPAA Critical)

```hcl
# VULNERABLE: No encryption
resource "aws_s3_bucket" "patient_data" {
  bucket = "patient-records"
}

# SECURE: Server-side encryption
resource "aws_s3_bucket" "patient_data" {
  bucket = "patient-records"
}

resource "aws_s3_bucket_server_side_encryption_configuration" "patient_data" {
  bucket = aws_s3_bucket.patient_data.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.patient_data_key.arn
    }
  }
}
```

```hcl
# VULNERABLE: RDS without encryption
resource "aws_db_instance" "database" {
  engine         = "postgres"
  instance_class = "db.t3.micro"
  # storage_encrypted missing!
}

# SECURE: RDS with encryption
resource "aws_db_instance" "database" {
  engine            = "postgres"
  instance_class    = "db.t3.micro"
  storage_encrypted = true
  kms_key_id        = aws_kms_key.db_key.arn
}
```

#### 2. Public Access (HIPAA Critical)

```hcl
# VULNERABLE: Public S3 bucket
resource "aws_s3_bucket_public_access_block" "bad" {
  bucket                  = aws_s3_bucket.patient_data.id
  block_public_acls       = false  # DANGEROUS
  block_public_policy     = false  # DANGEROUS
}

# SECURE: Block all public access
resource "aws_s3_bucket_public_access_block" "good" {
  bucket                  = aws_s3_bucket.patient_data.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
```

#### 3. Overly Permissive Security Groups

```hcl
# VULNERABLE: Open to world
resource "aws_security_group" "database" {
  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]  # DANGEROUS
  }
}

# SECURE: Restricted to VPC
resource "aws_security_group" "database" {
  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.app_servers.id]
  }
}
```

#### 4. Missing Logging (HIPAA Required)

```hcl
# VULNERABLE: No logging
resource "aws_s3_bucket" "data" {
  bucket = "patient-data"
}

# SECURE: Access logging enabled
resource "aws_s3_bucket_logging" "data" {
  bucket        = aws_s3_bucket.data.id
  target_bucket = aws_s3_bucket.access_logs.id
  target_prefix = "patient-data-logs/"
}

# CloudTrail for API logging
resource "aws_cloudtrail" "audit" {
  name                          = "hipaa-audit-trail"
  s3_bucket_name                = aws_s3_bucket.audit_logs.id
  include_global_service_events = true
  is_multi_region_trail         = true
  enable_log_file_validation    = true
}
```

### Kubernetes Security Checks

#### 1. Pod Security (Run as non-root)

```yaml
# VULNERABLE: Running as root
apiVersion: v1
kind: Pod
spec:
  containers:
  - name: app
    image: app:latest
    # No security context!

# SECURE: Non-root with restrictions
apiVersion: v1
kind: Pod
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
    fsGroup: 1000
  containers:
  - name: app
    image: app:latest
    securityContext:
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: true
      capabilities:
        drop:
          - ALL
```

#### 2. Network Policies (Segmentation)

```yaml
# VULNERABLE: No network policy = all pods can communicate

# SECURE: Restrict traffic
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: database-policy
spec:
  podSelector:
    matchLabels:
      app: database
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: backend
    ports:
    - protocol: TCP
      port: 5432
```

#### 3. Secrets Management

```yaml
# VULNERABLE: Hardcoded secrets
apiVersion: v1
kind: Pod
spec:
  containers:
  - name: app
    env:
    - name: DB_PASSWORD
      value: "plaintext-password"  # DANGEROUS

# SECURE: External secrets
apiVersion: v1
kind: Pod
spec:
  containers:
  - name: app
    env:
    - name: DB_PASSWORD
      valueFrom:
        secretKeyRef:
          name: db-credentials
          key: password
```

#### 4. Resource Limits (DoS Protection)

```yaml
# VULNERABLE: No limits
containers:
- name: app
  image: app:latest

# SECURE: Resource constraints
containers:
- name: app
  image: app:latest
  resources:
    limits:
      memory: "512Mi"
      cpu: "500m"
    requests:
      memory: "256Mi"
      cpu: "250m"
```

### Docker/Container Security

#### 1. Base Image Security

```dockerfile
# VULNERABLE: Outdated/bloated base
FROM ubuntu:latest
FROM python:3.9

# SECURE: Minimal, pinned base
FROM python:3.11-slim-bookworm@sha256:abc123...
FROM gcr.io/distroless/python3
```

#### 2. Running as Root

```dockerfile
# VULNERABLE: Running as root (default)
FROM python:3.11
COPY . /app
CMD ["python", "app.py"]

# SECURE: Non-root user
FROM python:3.11-slim
RUN useradd -r -u 1000 appuser
WORKDIR /app
COPY --chown=appuser:appuser . .
USER appuser
CMD ["python", "app.py"]
```

#### 3. Secrets in Build

```dockerfile
# VULNERABLE: Secrets in image
COPY .env /app/.env
ENV API_KEY=sk-12345

# SECURE: Runtime injection
# Don't copy secrets, inject at runtime
# Use Docker secrets or environment variables
```

### Cloud Configuration Checks

#### AWS-Specific

| Check | Requirement | How to Verify |
|-------|-------------|---------------|
| S3 Encryption | HIPAA Required | `aws s3api get-bucket-encryption` |
| RDS Encryption | HIPAA Required | Check `StorageEncrypted` |
| EBS Encryption | HIPAA Required | Check volume encryption |
| CloudTrail | HIPAA Required | Audit logging enabled |
| VPC Flow Logs | Recommended | Network monitoring |
| GuardDuty | Recommended | Threat detection |

#### GCP-Specific

| Check | Requirement | How to Verify |
|-------|-------------|---------------|
| Cloud Storage Encryption | HIPAA Required | Default with CMEK preferred |
| Cloud SQL Encryption | HIPAA Required | Check encryption at rest |
| VPC Service Controls | Recommended | Data exfiltration prevention |
| Cloud Audit Logs | HIPAA Required | Admin/data access logs |

#### Azure-Specific

| Check | Requirement | How to Verify |
|-------|-------------|---------------|
| Storage Encryption | HIPAA Required | Check SSE with CMK |
| SQL TDE | HIPAA Required | Transparent data encryption |
| NSG Rules | HIPAA Required | Network security groups |
| Azure Monitor | HIPAA Required | Diagnostic settings |

### Network Security Checks

#### 1. TLS Configuration

```nginx
# VULNERABLE: Weak TLS
ssl_protocols TLSv1 TLSv1.1 TLSv1.2;
ssl_ciphers ALL:!aNULL:!eNULL;

# SECURE: Strong TLS only
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
ssl_prefer_server_ciphers on;
ssl_session_cache shared:SSL:10m;
```

#### 2. Security Headers

```nginx
# Required headers for security
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Content-Security-Policy "default-src 'self';" always;
```

### Severity Matrix

| Issue | Severity | HIPAA Impact |
|-------|----------|--------------|
| Unencrypted ePHI storage | Critical | Direct violation (2026 mandatory) |
| Public data access | Critical | Data breach risk |
| Missing audit logs | Critical | Compliance violation |
| Root container execution | High | Privilege escalation |
| Overly permissive SGs | High | Lateral movement risk |
| Missing network policies | High | No segmentation |
| Weak TLS | High | Data interception |
| Missing resource limits | Medium | DoS vulnerability |
| Missing security headers | Medium | Various attacks |
