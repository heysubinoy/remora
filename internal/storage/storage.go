package storage

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"mime/multipart"
	"path/filepath"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/google/uuid"
)

type StorageService interface {
	UploadPemFile(ctx context.Context, file multipart.File, filename string) (string, error)
	DownloadPemFile(ctx context.Context, url string) ([]byte, error)
	DeletePemFile(ctx context.Context, url string) error
}

type S3StorageService struct {
	client *s3.Client
	bucket string
	logger *slog.Logger
}

type StorageConfig struct {
	AWSRegion    string
	S3Bucket     string
	S3KeyPrefix  string
	AWSAccessKey string
	AWSSecretKey string
}

func NewS3StorageService(cfg *StorageConfig, logger *slog.Logger) (*S3StorageService, error) {
	// Load AWS config
	awsCfg, err := config.LoadDefaultConfig(context.TODO(),
		config.WithRegion(cfg.AWSRegion),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to load AWS config: %w", err)
	}

	// Create S3 client
	client := s3.NewFromConfig(awsCfg)

	return &S3StorageService{
		client: client,
		bucket: cfg.S3Bucket,
		logger: logger,
	}, nil
}

func (s *S3StorageService) UploadPemFile(ctx context.Context, file multipart.File, filename string) (string, error) {
	// Generate unique key for the file
	fileExt := filepath.Ext(filename)
	if fileExt == "" {
		fileExt = ".pem"
	}
	
	key := fmt.Sprintf("pem-files/%s%s", uuid.New().String(), fileExt)

	// Validate file extension
	if !strings.EqualFold(fileExt, ".pem") && !strings.EqualFold(fileExt, ".key") {
		return "", fmt.Errorf("invalid file type: only .pem and .key files are allowed")
	}

	// Reset file reader position
	if _, err := file.Seek(0, 0); err != nil {
		return "", fmt.Errorf("failed to reset file position: %w", err)
	}

	s.logger.Info("Uploading PEM file to S3", 
		slog.String("bucket", s.bucket), 
		slog.String("key", key))

	// Upload file to S3
	_, err := s.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:        aws.String(s.bucket),
		Key:           aws.String(key),
		Body:          file,
		ContentType:   aws.String("application/x-pem-file"),
		ServerSideEncryption: "AES256", // Encrypt at rest
		Metadata: map[string]string{
			"original-filename": filename,
			"uploaded-at":       time.Now().UTC().Format(time.RFC3339),
		},
	})

	if err != nil {
		return "", fmt.Errorf("failed to upload PEM file to S3: %w", err)
	}

	// Return the S3 URL
	url := fmt.Sprintf("s3://%s/%s", s.bucket, key)
	
	s.logger.Info("Successfully uploaded PEM file", 
		slog.String("url", url))

	return url, nil
}

func (s *S3StorageService) DownloadPemFile(ctx context.Context, url string) ([]byte, error) {
	// Parse S3 URL to extract bucket and key
	if !strings.HasPrefix(url, "s3://") {
		return nil, fmt.Errorf("invalid S3 URL format: %s", url)
	}

	// Remove s3:// prefix
	path := strings.TrimPrefix(url, "s3://")
	parts := strings.SplitN(path, "/", 2)
	if len(parts) != 2 {
		return nil, fmt.Errorf("invalid S3 URL format: %s", url)
	}

	bucket := parts[0]
	key := parts[1]

	s.logger.Info("Downloading PEM file from S3", 
		slog.String("bucket", bucket), 
		slog.String("key", key))

	// Download file from S3
	resp, err := s.client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to download PEM file from S3: %w", err)
	}
	defer resp.Body.Close()

	// Read file content
	content, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read PEM file content: %w", err)
	}

	s.logger.Info("Successfully downloaded PEM file", 
		slog.String("url", url),
		slog.Int("size", len(content)))

	return content, nil
}

func (s *S3StorageService) DeletePemFile(ctx context.Context, url string) error {
	// Parse S3 URL to extract bucket and key
	if !strings.HasPrefix(url, "s3://") {
		return fmt.Errorf("invalid S3 URL format: %s", url)
	}

	// Remove s3:// prefix
	path := strings.TrimPrefix(url, "s3://")
	parts := strings.SplitN(path, "/", 2)
	if len(parts) != 2 {
		return fmt.Errorf("invalid S3 URL format: %s", url)
	}

	bucket := parts[0]
	key := parts[1]

	s.logger.Info("Deleting PEM file from S3", 
		slog.String("bucket", bucket), 
		slog.String("key", key))

	// Delete file from S3
	_, err := s.client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(bucket),
		Key:    aws.String(key),
	})

	if err != nil {
		return fmt.Errorf("failed to delete PEM file from S3: %w", err)
	}

	s.logger.Info("Successfully deleted PEM file", 
		slog.String("url", url))

	return nil
}

// LocalStorageService provides a local file system implementation for development
type LocalStorageService struct {
	baseDir string
	logger  *slog.Logger
}

func NewLocalStorageService(baseDir string, logger *slog.Logger) *LocalStorageService {
	return &LocalStorageService{
		baseDir: baseDir,
		logger:  logger,
	}
}

func (l *LocalStorageService) UploadPemFile(ctx context.Context, file multipart.File, filename string) (string, error) {
	// This is a placeholder for local development
	// In production, you should use the S3StorageService
	return "", fmt.Errorf("local storage not implemented - use S3 storage service")
}

func (l *LocalStorageService) DownloadPemFile(ctx context.Context, url string) ([]byte, error) {
	return nil, fmt.Errorf("local storage not implemented - use S3 storage service")
}

func (l *LocalStorageService) DeletePemFile(ctx context.Context, url string) error {
	return fmt.Errorf("local storage not implemented - use S3 storage service")
}
