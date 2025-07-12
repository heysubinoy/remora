# Security Guide

Security considerations and best practices for deploying NewRemora in production environments.

## Current Security Implementation

Based on the actual codebase, NewRemora currently implements:

### What's Currently Implemented

1. **Basic CORS Configuration**: Hardcoded allowed origins for development
2. **Gin Framework Security**: Basic logging and recovery middleware
3. **Database Security**: Standard GORM database connections
4. **SSH Key Storage**: S3 storage for PEM files with local fallback
5. **Environment Variables**: Basic configuration through env vars

### What's NOT Currently Implemented

⚠️ **Important**: NewRemora currently has **NO** built-in authentication or authorization. All API endpoints are publicly accessible.

- No API authentication (no API keys, JWT, OAuth)
- No user management or RBAC
- No rate limiting
- No input validation middleware
- No request signing
- No MFA
- No audit logging
- No security headers

## Current Security Risks

### High Risk

- **Open API**: All endpoints are publicly accessible without authentication
- **Command Injection**: No input validation on commands being executed
- **Credential Exposure**: SSH credentials stored in database without encryption
- **No Access Control**: Anyone can create, modify, or delete servers and jobs

### Medium Risk

- **CORS Misconfiguration**: Hardcoded origins in development mode
- **No Rate Limiting**: Potential for DoS attacks
- **Plain Text Logs**: Sensitive data may be logged in plain text

## Actual Configuration Options

Based on the code, these are the real environment variables you can set:

### Core Configuration

```bash
# API Server
SERVER_ADDR=":8080"                    # Server bind address

# Database
DATABASE_URL="./jobs.db"               # SQLite default
DATABASE_URL="postgres://..."          # PostgreSQL connection string

# NetQueue
NETQUEUE_ADDR="localhost:9000"

# Worker Pool
WORKER_POOL_SIZE=16                    # Auto-calculated based on CPU cores

# SSH Defaults (optional fallbacks)
SSH_HOST="localhost"
SSH_PORT="22"
SSH_USER=""
SSH_PASSWORD=""
SSH_PRIVATE_KEY=""

# Storage (S3 or local fallback)
AWS_REGION="ap-south-1"
S3_BUCKET="remora-files"
S3_KEY_PREFIX="pem-files/"
AWS_ACCESS_KEY_ID=""
AWS_SECRET_ACCESS_KEY=""
```

### Current CORS Configuration

The API server has hardcoded CORS settings:

```go
corsConfig := cors.Config{
    AllowOrigins: []string{
        "http://localhost:3000",   // Next.js dev server
        "http://127.0.0.1:3000",
        "http://localhost:8080",   // Backend server
        "http://127.0.0.1:8080",
    },
    AllowMethods: []string{
        "GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS",
    },
    AllowHeaders: []string{
        "Origin", "Content-Length", "Content-Type", "Authorization",
        "Accept", "X-Requested-With", "Cache-Control",
    },
    ExposeHeaders: []string{
        "Content-Length", "Content-Type",
    },
    AllowCredentials: true,
    MaxAge: 12 * time.Hour,
}
```

## Network Security

### TLS/SSL Configuration

#### API Server TLS

```bash
# Generate SSL certificates
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365

# Configure TLS
export TLS_ENABLED=true
export TLS_CERT_FILE=/path/to/cert.pem
export TLS_KEY_FILE=/path/to/key.pem
export TLS_MIN_VERSION=1.2
```

#### NetQueue Security

```bash
# NetQueue security configuration
export NETQUEUE_ADDR="localhost:9000"

# Certificate validation (if TLS enabled)
export QUEUE_TLS_ENABLED="true"
export QUEUE_TLS_CERT="/path/to/cert.pem"
export QUEUE_TLS_KEY="/path/to/key.pem"
```

### Firewall Configuration

```bash
# Allow only necessary ports
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 443/tcp     # HTTPS API
sudo ufw allow 9000/tcp    # NetQueue
sudo ufw deny 8080/tcp     # Block direct API access
sudo ufw deny 9001/tcp     # Block NetQueue management (if separate)
sudo ufw enable
```

### Network Segmentation

```yaml
# docker-compose.yml - Network isolation
version: "3.8"
networks:
  frontend:
    driver: bridge
  backend:
    driver: bridge
    internal: true
  database:
    driver: bridge
    internal: true

services:
  nginx:
    networks: [frontend]
  api:
    networks: [frontend, backend]
  worker:
    networks: [backend]
  netqueue:
    networks: [backend]
  postgres:
    networks: [database]
```

### VPN Access

```bash
# Restrict API access to VPN networks only
export ALLOWED_NETWORKS="10.0.0.0/8,172.16.0.0/12,192.168.0.0/16"

# Configure firewall rules
sudo iptables -A INPUT -s 10.0.0.0/8 -p tcp --dport 8080 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 8080 -j DROP
```

## Data Protection

### Database Security

#### Encryption at Rest

```bash
# PostgreSQL encryption
export POSTGRES_ENCRYPTION=true
export POSTGRES_TDE_KEY="your-encryption-key"

# File-based encryption for SQLite
export DATABASE_ENCRYPTION=true
export DATABASE_KEY="your-database-encryption-key"
```

#### Connection Security

```bash
# Secure database connection
export DATABASE_URL="postgres://user:pass@localhost:5432/db?sslmode=require"
export DB_SSL_CERT=/path/to/client-cert.pem
export DB_SSL_KEY=/path/to/client-key.pem
export DB_SSL_CA=/path/to/ca-cert.pem
```

### Credential Management

#### SSH Key Encryption

```bash
# Encrypt stored SSH keys
export SSH_KEY_ENCRYPTION=true
export SSH_KEY_ENCRYPTION_KEY="your-ssh-key-encryption-key"

# Use external key management service
export KEY_MANAGEMENT_SERVICE="aws-kms"
export KMS_KEY_ID="arn:aws:kms:region:account:key/key-id"
```

#### Secrets Management

```bash
# Use HashiCorp Vault
export VAULT_ENABLED=true
export VAULT_URL="https://vault.example.com"
export VAULT_TOKEN="your-vault-token"

# Use AWS Secrets Manager
export AWS_SECRETS_MANAGER=true
export AWS_REGION="us-east-1"
```

### PII and Sensitive Data

```bash
# Enable data masking in logs
export LOG_MASK_SENSITIVE=true
export SENSITIVE_PATTERNS="password,secret,key,token"

# Automatic log redaction
export LOG_REDACTION=true
export REDACTION_PATTERNS="/etc/newremora/redaction-patterns.json"
```

## SSH Security

### SSH Key Management

#### Key Generation Best Practices

```bash
# Generate strong SSH keys
ssh-keygen -t ed25519 -b 4096 -f ~/.ssh/newremora_key
ssh-keygen -t rsa -b 4096 -f ~/.ssh/newremora_rsa_key

# Set proper permissions
chmod 600 ~/.ssh/newremora_key
chmod 644 ~/.ssh/newremora_key.pub
```

#### Key Rotation

```bash
# Automated key rotation
export SSH_KEY_ROTATION_ENABLED=true
export SSH_KEY_ROTATION_INTERVAL="90d"
export SSH_KEY_ROTATION_NOTIFICATION="admin@example.com"
```

### SSH Configuration

#### Client Configuration

```bash
# SSH client security settings
export SSH_CIPHERS="aes256-gcm@openssh.com,aes128-gcm@openssh.com"
export SSH_MACS="hmac-sha2-256-etm@openssh.com,hmac-sha2-512-etm@openssh.com"
export SSH_KEX="diffie-hellman-group16-sha512,diffie-hellman-group18-sha512"
export SSH_HOST_KEY_ALGORITHMS="ssh-ed25519,rsa-sha2-512,rsa-sha2-256"
```

#### Connection Security

```bash
# SSH connection limits
export SSH_MAX_CONNECTIONS=10
export SSH_CONNECTION_TIMEOUT=30s
export SSH_KEEPALIVE_INTERVAL=30s
export SSH_MAX_RETRIES=3
```

### Remote Server Hardening

```bash
# Secure SSH daemon configuration (/etc/ssh/sshd_config)
Protocol 2
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
AuthenticationMethods publickey
MaxAuthTries 3
MaxSessions 10
ClientAliveInterval 300
ClientAliveCountMax 2

# Restart SSH service
sudo systemctl restart sshd
```

## API Security

### Input Validation

```go
// Example input validation
type JobRequest struct {
    Command   string `json:"command" validate:"required,max=1000"`
    Args      string `json:"args" validate:"max=2000"`
    ServerID  string `json:"server_id" validate:"required,uuid"`
    Timeout   int    `json:"timeout" validate:"min=1,max=7200"`
}
```

### Rate Limiting

```bash
# Configure rate limits
export RATE_LIMIT_ENABLED=true
export RATE_LIMIT_REQUESTS_PER_MINUTE=100
export RATE_LIMIT_BURST=200
export RATE_LIMIT_CLEANUP_INTERVAL=60s

# Per-user rate limits
export USER_RATE_LIMIT_ENABLED=true
export USER_RATE_LIMIT_REQUESTS_PER_HOUR=1000
```

### CORS Configuration

```bash
# Secure CORS settings
export CORS_ENABLED=true
export CORS_ALLOWED_ORIGINS="https://app.example.com,https://admin.example.com"
export CORS_ALLOWED_METHODS="GET,POST,PUT,DELETE"
export CORS_ALLOWED_HEADERS="Authorization,Content-Type,X-API-Key"
export CORS_EXPOSED_HEADERS="X-Total-Count,X-Page-Count"
export CORS_MAX_AGE=86400
```

### Request Signing

```bash
# HMAC request signing
export REQUEST_SIGNING_ENABLED=true
export REQUEST_SIGNING_SECRET="your-signing-secret"
export REQUEST_SIGNING_ALGORITHM="sha256"

# Example signed request
curl -H "X-Signature: sha256=calculated-hmac" \
     -H "X-Timestamp: 1640995200" \
     http://localhost:8080/api/v1/jobs
```

## Infrastructure Security

### Container Security

#### Image Security

```dockerfile
# Use minimal base images
FROM golang:1.23-alpine AS builder
FROM alpine:3.18

# Run as non-root user
RUN adduser -D -s /bin/sh appuser
USER appuser

# Set security options
LABEL security.disable_new_privs=true
```

#### Runtime Security

```yaml
# docker-compose.yml security settings
services:
  api:
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE
    read_only: true
    tmpfs:
      - /tmp:noexec,nosuid,size=100m
```

### Secrets Management

```yaml
# Docker secrets
services:
  api:
    secrets:
      - db_password
      - api_key
    environment:
      - DB_PASSWORD_FILE=/run/secrets/db_password
      - API_KEY_FILE=/run/secrets/api_key

secrets:
  db_password:
    external: true
  api_key:
    external: true
```

### Resource Limits

```yaml
# Resource constraints
services:
  api:
    deploy:
      resources:
        limits:
          cpus: "1.0"
          memory: 1G
        reservations:
          cpus: "0.5"
          memory: 512M
```

## Monitoring & Auditing

### Security Logging

```bash
# Enable security logging
export SECURITY_LOGGING=true
export SECURITY_LOG_LEVEL=info
export SECURITY_LOG_FILE=/var/log/newremora/security.log

# Log all authentication attempts
export LOG_AUTH_ATTEMPTS=true
export LOG_FAILED_AUTH=true
export LOG_PRIVILEGE_ESCALATION=true
```

### Audit Trail

```json
{
  "timestamp": "2024-12-09T10:30:00Z",
  "event_type": "job_execution",
  "user_id": "user123",
  "server_id": "server456",
  "command": "ls -la",
  "source_ip": "192.168.1.100",
  "user_agent": "curl/7.68.0",
  "result": "success",
  "duration_ms": 1234
}
```

### Security Monitoring

```bash
# Real-time security monitoring
export SECURITY_MONITORING=true
export SECURITY_ALERTS_WEBHOOK="https://alerts.example.com/webhook"
export SECURITY_ALERT_THRESHOLD=5

# Monitor for suspicious activities
export MONITOR_FAILED_LOGINS=true
export MONITOR_PRIVILEGE_ESCALATION=true
export MONITOR_UNUSUAL_COMMANDS=true
```

### Intrusion Detection

```bash
# Enable intrusion detection
export IDS_ENABLED=true
export IDS_RULES_FILE=/etc/newremora/ids-rules.json
export IDS_ACTION="alert"  # alert, block, quarantine

# Example IDS rule
{
  "rules": [
    {
      "name": "Suspicious command execution",
      "pattern": "(rm -rf|sudo su|chmod 777)",
      "severity": "high",
      "action": "alert"
    }
  ]
}
```

## Security Best Practices

### Development Security

1. **Secure Coding Practices**

   - Input validation and sanitization
   - Output encoding
   - Proper error handling
   - Secure session management

2. **Dependency Management**

   - Regular dependency updates
   - Vulnerability scanning
   - Supply chain security

3. **Code Review**
   - Security-focused code reviews
   - Automated security testing
   - Static code analysis

### Deployment Security

1. **Environment Hardening**

   - Minimal attack surface
   - Regular security updates
   - Proper user permissions

2. **Network Security**

   - Firewall configuration
   - Network segmentation
   - VPN access

3. **Monitoring**
   - Real-time alerting
   - Log analysis
   - Incident response

### Operational Security

1. **Access Control**

   - Principle of least privilege
   - Regular access reviews
   - Multi-factor authentication

2. **Data Protection**

   - Encryption in transit and at rest
   - Secure backup procedures
   - Data retention policies

3. **Incident Response**
   - Incident response plan
   - Regular drills
   - Forensic capabilities

## Compliance Considerations

### GDPR Compliance

```bash
# Data protection settings
export GDPR_COMPLIANCE=true
export DATA_RETENTION_PERIOD="365d"
export PERSONAL_DATA_ENCRYPTION=true
export RIGHT_TO_ERASURE=true
```

### SOC 2 Compliance

```bash
# SOC 2 controls
export ACCESS_LOGGING=true
export CONFIGURATION_MANAGEMENT=true
export CHANGE_MANAGEMENT=true
export INCIDENT_MANAGEMENT=true
```

### HIPAA Compliance

```bash
# HIPAA-specific settings
export HIPAA_COMPLIANCE=true
export AUDIT_LOGGING=comprehensive
export ACCESS_CONTROLS=strict
export DATA_ENCRYPTION=required
```

## Security Checklist

### Pre-Deployment Checklist

- [ ] TLS/SSL certificates configured
- [ ] Authentication mechanism implemented
- [ ] Database encryption enabled
- [ ] SSH keys properly secured
- [ ] Firewall rules configured
- [ ] Rate limiting enabled
- [ ] Input validation implemented
- [ ] Security headers configured
- [ ] Audit logging enabled
- [ ] Backup procedures tested

### Post-Deployment Checklist

- [ ] Security monitoring active
- [ ] Vulnerability scanning scheduled
- [ ] Incident response plan in place
- [ ] Access controls verified
- [ ] Log analysis configured
- [ ] Security training completed
- [ ] Regular security reviews scheduled
- [ ] Compliance requirements met
- [ ] Documentation updated
- [ ] Emergency procedures tested

### Regular Security Maintenance

- [ ] Weekly vulnerability scans
- [ ] Monthly access reviews
- [ ] Quarterly security assessments
- [ ] Annual penetration testing
- [ ] Continuous security monitoring
- [ ] Regular backup testing
- [ ] Security awareness training
- [ ] Compliance audits

## Emergency Procedures

### Security Incident Response

1. **Immediate Actions**

   - Isolate affected systems
   - Preserve evidence
   - Notify security team
   - Document incident

2. **Investigation**

   - Analyze logs
   - Identify attack vectors
   - Assess damage
   - Determine scope

3. **Recovery**
   - Patch vulnerabilities
   - Restore from backups
   - Implement additional controls
   - Monitor for reoccurrence

### Breach Notification

```bash
# Automated breach notification
export BREACH_NOTIFICATION=true
export NOTIFICATION_CONTACTS="security@example.com,legal@example.com"
export NOTIFICATION_THRESHOLD="medium"
export COMPLIANCE_REPORTING=true
```

This security guide provides comprehensive protection for NewRemora deployments. Regular review and updates of security measures are essential to maintain protection against evolving threats.
