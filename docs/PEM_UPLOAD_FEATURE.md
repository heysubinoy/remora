# PEM File Upload Feature

This feature allows you to upload PEM files to object storage (AWS S3) and use them for SSH authentication when connecting to remote servers.

## Features

- Upload PEM files via REST API
- Store PEM files securely in AWS S3 with server-side encryption
- Use stored PEM files for SSH authentication
- Backward compatibility with direct PEM content and local file paths

## Setup

### Environment Variables

Set the following environment variables for AWS S3 integration:

```bash
# AWS Configuration
export AWS_REGION=us-east-1
export AWS_ACCESS_KEY_ID=your-access-key
export AWS_SECRET_ACCESS_KEY=your-secret-key

# S3 Configuration
export S3_BUCKET=your-pem-files-bucket
export S3_KEY_PREFIX=pem-files/
```

### AWS S3 Bucket Setup

1. Create an S3 bucket for storing PEM files
2. Configure proper IAM permissions for read/write access
3. Enable server-side encryption (AES256) for security

Example IAM policy:
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:PutObject",
                "s3:DeleteObject"
            ],
            "Resource": "arn:aws:s3:::your-pem-files-bucket/pem-files/*"
        }
    ]
}
```

## API Usage

### 1. Upload PEM File

```bash
curl -X POST \
  -F "pem_file=@/path/to/your/file.pem" \
  http://localhost:8080/api/v1/pem-files/upload
```

Response:
```json
{
    "message": "PEM file uploaded successfully",
    "pem_file_url": "s3://your-bucket/pem-files/uuid.pem",
    "filename": "your-file.pem"
}
```

### 2. Create Server with Uploaded PEM File

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-server",
    "hostname": "example.com",
    "port": 22,
    "user": "ubuntu",
    "auth_type": "key",
    "pem_file_url": "s3://your-bucket/pem-files/uuid.pem"
  }' \
  http://localhost:8080/api/v1/servers
```

### 3. Alternative: Use Direct PEM Content (Legacy)

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-server",
    "hostname": "example.com",
    "port": 22,
    "user": "ubuntu",
    "auth_type": "key",
    "private_key": "-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
  }' \
  http://localhost:8080/api/v1/servers
```

## Server Configuration Options

When creating a server, you can use one of the following authentication methods:

1. **Password Authentication:**
   ```json
   {
     "auth_type": "password",
     "password": "your-password"
   }
   ```

2. **PEM File URL (Recommended):**
   ```json
   {
     "auth_type": "key",
     "pem_file_url": "s3://bucket/pem-files/uuid.pem"
   }
   ```

3. **Direct Private Key Content:**
   ```json
   {
     "auth_type": "key",
     "private_key": "-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
   }
   ```

4. **Local File Path:**
   ```json
   {
     "auth_type": "key",
     "private_key": "/path/to/local/key.pem"
   }
   ```

## Security Features

- **Encryption at Rest:** PEM files are stored with AES256 server-side encryption
- **Access Control:** Only authorized applications can access the S3 bucket
- **Secure Transport:** All API communications use HTTPS
- **No Exposure:** PEM file content is never returned in API responses

## Error Handling

The system provides detailed error messages for common issues:

- Invalid file format (only .pem and .key files allowed)
- AWS S3 upload failures
- Missing authentication credentials
- Server configuration validation errors

## Development Mode

For local development without AWS S3, the system will fall back to a local storage service that returns appropriate error messages, allowing you to develop and test other features without S3 configuration.

## Example Scripts

See `examples/pem-upload-example.sh` for a complete example of uploading a PEM file and creating a server configuration.
