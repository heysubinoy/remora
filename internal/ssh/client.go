package ssh

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"io/ioutil"
	"job-executor/internal/config"
	"job-executor/internal/storage"
	"strings"
	"sync"
	"time"

	"golang.org/x/crypto/ssh"
)

type Client struct {
	config  *config.SSHConfig
	storage storage.StorageService
}

type ExecutionResult struct {
	Output   string
	Error    string
	ExitCode int
}

// StreamingCallback receives real-time output during command execution
type StreamingCallback func(output string, isStderr bool)

// StreamingResult contains the final result of a streaming execution
type StreamingResult struct {
	ExitCode int
	Error    error
}

func NewClient(cfg *config.SSHConfig) *Client {
	return &Client{config: cfg}
}

func NewClientWithStorage(cfg *config.SSHConfig, storage storage.StorageService) *Client {
	return &Client{config: cfg, storage: storage}
}

func (c *Client) Execute(ctx context.Context, command string, timeout time.Duration) (*ExecutionResult, error) {
	startTime := time.Now()
	
	// Create SSH client config
	sshConfig := &ssh.ClientConfig{
		User:            c.config.User,
		HostKeyCallback: ssh.InsecureIgnoreHostKey(), // Note: Use proper host key checking in production
		Timeout:         10 * time.Second,
	}

	// Configure authentication
	if c.config.Password != "" {
		sshConfig.Auth = append(sshConfig.Auth, ssh.Password(c.config.Password))
	}

	if c.config.PrivateKey != "" {
		var key []byte
		var err error
		
		// Check if it's a file path or the key content itself
		if strings.HasPrefix(c.config.PrivateKey, "-----BEGIN") {
			// It's the actual key content
			key = []byte(c.config.PrivateKey)
		} else {
			// It's a file path
			key, err = ioutil.ReadFile(c.config.PrivateKey)
			if err != nil {
				return nil, fmt.Errorf("failed to read private key file: %w", err)
			}
		}

		signer, err := ssh.ParsePrivateKey(key)
		if err != nil {
			return nil, fmt.Errorf("failed to parse private key: %w", err)
		}

		sshConfig.Auth = append(sshConfig.Auth, ssh.PublicKeys(signer))
	}

	// Handle PEM file URL (download from object storage)
	if c.config.PemFileURL != "" {
		if c.storage == nil {
			return nil, fmt.Errorf("storage service not available for PEM file URL")
		}

		key, err := c.storage.DownloadPemFile(ctx, c.config.PemFileURL)
		if err != nil {
			return nil, fmt.Errorf("failed to download PEM file from storage: %w", err)
		}

		signer, err := ssh.ParsePrivateKey(key)
		if err != nil {
			return nil, fmt.Errorf("failed to parse downloaded PEM file: %w", err)
		}

		sshConfig.Auth = append(sshConfig.Auth, ssh.PublicKeys(signer))
	}

	// Connect to SSH server
	addr := fmt.Sprintf("%s:%s", c.config.Host, c.config.Port)
	conn, err := ssh.Dial("tcp", addr, sshConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to SSH server at %s: %w", addr, err)
	}
	defer conn.Close()

	// Create session
	session, err := conn.NewSession()
	if err != nil {
		return nil, fmt.Errorf("failed to create SSH session: %w", err)
	}
	defer session.Close()

	// Setup output buffers with larger initial capacity for better performance
	var stdout, stderr bytes.Buffer
	stdout.Grow(4096)  // Pre-allocate 4KB
	stderr.Grow(1024)  // Pre-allocate 1KB
	
	session.Stdout = &stdout
	session.Stderr = &stderr

	// Execute command with timeout
	done := make(chan error, 1)
	go func() {
		done <- session.Run(command)
	}()

	select {
	case err := <-done:
		executionTime := time.Since(startTime)
		
		result := &ExecutionResult{
			Output: stdout.String(),
			Error:  stderr.String(),
		}

		if err != nil {
			if exitError, ok := err.(*ssh.ExitError); ok {
				result.ExitCode = exitError.ExitStatus()
			} else {
				return nil, fmt.Errorf("command execution failed after %v: %w", executionTime, err)
			}
		}

		return result, nil

	case <-ctx.Done():
		session.Signal(ssh.SIGKILL)
		executionTime := time.Since(startTime)
		return nil, fmt.Errorf("command execution canceled after %v: %w", executionTime, ctx.Err())

	case <-time.After(timeout):
		session.Signal(ssh.SIGKILL)
		executionTime := time.Since(startTime)
		return nil, fmt.Errorf("command execution timeout after %v (limit: %v)", executionTime, timeout)
	}
}

// ExecuteStreaming executes a command and streams output in real-time via callback
func (c *Client) ExecuteStreaming(ctx context.Context, command string, timeout time.Duration, callback StreamingCallback) (*StreamingResult, error) {
	startTime := time.Now()
	
	// Create SSH client config
	sshConfig := &ssh.ClientConfig{
		User:            c.config.User,
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		Timeout:         10 * time.Second,
	}

	// Configure authentication
	if c.config.Password != "" {
		sshConfig.Auth = append(sshConfig.Auth, ssh.Password(c.config.Password))
	}

	if c.config.PrivateKey != "" {
		var key []byte
		var err error
		
		if strings.HasPrefix(c.config.PrivateKey, "-----BEGIN") {
			key = []byte(c.config.PrivateKey)
		} else {
			key, err = ioutil.ReadFile(c.config.PrivateKey)
			if err != nil {
				return nil, fmt.Errorf("failed to read private key file: %w", err)
			}
		}

		signer, err := ssh.ParsePrivateKey(key)
		if err != nil {
			return nil, fmt.Errorf("failed to parse private key: %w", err)
		}

		sshConfig.Auth = append(sshConfig.Auth, ssh.PublicKeys(signer))
	}

	// Handle PEM file URL (download from object storage)
	if c.config.PemFileURL != "" {
		if c.storage == nil {
			return nil, fmt.Errorf("storage service not available for PEM file URL")
		}

		key, err := c.storage.DownloadPemFile(ctx, c.config.PemFileURL)
		if err != nil {
			return nil, fmt.Errorf("failed to download PEM file from storage: %w", err)
		}

		signer, err := ssh.ParsePrivateKey(key)
		if err != nil {
			return nil, fmt.Errorf("failed to parse downloaded PEM file: %w", err)
		}

		sshConfig.Auth = append(sshConfig.Auth, ssh.PublicKeys(signer))
	}

	// Connect to SSH server
	addr := fmt.Sprintf("%s:%s", c.config.Host, c.config.Port)
	conn, err := ssh.Dial("tcp", addr, sshConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to SSH server at %s: %w", addr, err)
	}
	defer conn.Close()

	// Create session
	session, err := conn.NewSession()
	if err != nil {
		return nil, fmt.Errorf("failed to create SSH session: %w", err)
	}
	defer session.Close()

	// Create pipes for stdout and stderr
	stdoutPipe, err := session.StdoutPipe()
	if err != nil {
		return nil, fmt.Errorf("failed to create stdout pipe: %w", err)
	}

	stderrPipe, err := session.StderrPipe()
	if err != nil {
		return nil, fmt.Errorf("failed to create stderr pipe: %w", err)
	}

	// Start the command
	if err := session.Start(command); err != nil {
		return nil, fmt.Errorf("failed to start command: %w", err)
	}

	// Stream output in real-time
	var wg sync.WaitGroup
	var streamErr error

	// Stream stdout with real-time support
	wg.Add(1)
	go func() {
		defer wg.Done()
		
		// Use a smaller buffer for more responsive streaming
		buf := make([]byte, 1024)
		var lineBuffer strings.Builder
		
		for {
			n, err := stdoutPipe.Read(buf[:])
			if n > 0 {
				data := string(buf[:n])
				
				// Process character by character for real-time output
				for _, char := range data {
					if char == '\n' || char == '\r' {
						if lineBuffer.Len() > 0 {
							line := lineBuffer.String()
							if callback != nil {
								callback(line+"\n", false) // false for stdout
							}
							lineBuffer.Reset()
						}
					} else {
						lineBuffer.WriteRune(char)
					}
				}
				
				// Also send partial lines for truly real-time experience (like ping dots)
				if lineBuffer.Len() > 0 {
					partialLine := lineBuffer.String()
					// Send partial updates for commands that show progress (like ping)
					if strings.Contains(partialLine, ".") || len(partialLine) > 50 {
						if callback != nil {
							callback(partialLine, false)
						}
						lineBuffer.Reset()
					}
				}
			}
			
			if err != nil {
				// Send any remaining data in buffer
				if lineBuffer.Len() > 0 {
					if callback != nil {
						callback(lineBuffer.String()+"\n", false)
					}
				}
				
				if err != io.EOF {
					streamErr = fmt.Errorf("stdout streaming error: %w", err)
				}
				break
			}
		}
	}()

	// Stream stderr with real-time support
	wg.Add(1)
	go func() {
		defer wg.Done()
		
		// Use a smaller buffer for more responsive streaming
		buf := make([]byte, 1024)
		var lineBuffer strings.Builder
		
		for {
			n, err := stderrPipe.Read(buf[:])
			if n > 0 {
				data := string(buf[:n])
				
				// Process character by character for real-time output
				for _, char := range data {
					if char == '\n' || char == '\r' {
						if lineBuffer.Len() > 0 {
							line := lineBuffer.String()
							if callback != nil {
								callback(line+"\n", true) // true for stderr
							}
							lineBuffer.Reset()
						}
					} else {
						lineBuffer.WriteRune(char)
					}
				}
				
				// Also send partial lines for truly real-time experience
				if lineBuffer.Len() > 0 {
					partialLine := lineBuffer.String()
					// Send partial updates for commands that show progress
					if strings.Contains(partialLine, ".") || len(partialLine) > 50 {
						if callback != nil {
							callback(partialLine, true)
						}
						lineBuffer.Reset()
					}
				}
			}
			
			if err != nil {
				// Send any remaining data in buffer
				if lineBuffer.Len() > 0 {
					if callback != nil {
						callback(lineBuffer.String()+"\n", true)
					}
				}
				
				if err != io.EOF {
					streamErr = fmt.Errorf("stderr streaming error: %w", err)
				}
				break
			}
		}
	}()

	// Wait for command completion or timeout
	done := make(chan error, 1)
	go func() {
		wg.Wait() // Wait for all streaming to complete
		done <- session.Wait()
	}()

	result := &StreamingResult{}

	select {
	case err := <-done:
		executionTime := time.Since(startTime)
		
		if err != nil {
			if exitError, ok := err.(*ssh.ExitError); ok {
				result.ExitCode = exitError.ExitStatus()
			} else {
				result.Error = fmt.Errorf("command execution failed after %v: %w", executionTime, err)
				return result, result.Error
			}
		}

		if streamErr != nil {
			result.Error = streamErr
			return result, streamErr
		}

		return result, nil

	case <-ctx.Done():
		session.Signal(ssh.SIGKILL)
		executionTime := time.Since(startTime)
		result.Error = fmt.Errorf("command execution canceled after %v: %w", executionTime, ctx.Err())
		return result, result.Error

	case <-time.After(timeout):
		session.Signal(ssh.SIGKILL)
		executionTime := time.Since(startTime)
		result.Error = fmt.Errorf("command execution timeout after %v (limit: %v)", executionTime, timeout)
		return result, result.Error
	}
}

// TestConnection tests the SSH connection without executing any commands
func (c *Client) TestConnection(ctx context.Context) error {
	// Create SSH client config
	sshConfig := &ssh.ClientConfig{
		User:            c.config.User,
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		Timeout:         10 * time.Second,
	}

	// Configure authentication
	if c.config.Password != "" {
		sshConfig.Auth = append(sshConfig.Auth, ssh.Password(c.config.Password))
	}

	if c.config.PrivateKey != "" {
		var key []byte
		var err error
		
		if strings.HasPrefix(c.config.PrivateKey, "-----BEGIN") {
			key = []byte(c.config.PrivateKey)
		} else {
			key, err = ioutil.ReadFile(c.config.PrivateKey)
			if err != nil {
				return fmt.Errorf("failed to read private key file: %w", err)
			}
		}

		signer, err := ssh.ParsePrivateKey(key)
		if err != nil {
			return fmt.Errorf("failed to parse private key: %w", err)
		}

		sshConfig.Auth = append(sshConfig.Auth, ssh.PublicKeys(signer))
	}

	// Handle PEM file URL (download from object storage)
	if c.config.PemFileURL != "" {
		if c.storage == nil {
			return fmt.Errorf("storage service not available for PEM file URL")
		}

		key, err := c.storage.DownloadPemFile(ctx, c.config.PemFileURL)
		if err != nil {
			return fmt.Errorf("failed to download PEM file from storage: %w", err)
		}

		signer, err := ssh.ParsePrivateKey(key)
		if err != nil {
			return fmt.Errorf("failed to parse downloaded PEM file: %w", err)
		}

		sshConfig.Auth = append(sshConfig.Auth, ssh.PublicKeys(signer))
	}

	// Connect to SSH server
	addr := fmt.Sprintf("%s:%s", c.config.Host, c.config.Port)
	conn, err := ssh.Dial("tcp", addr, sshConfig)
	if err != nil {
		return fmt.Errorf("failed to connect to SSH server at %s: %w", addr, err)
	}
	defer conn.Close()

	// Test creating a session
	session, err := conn.NewSession()
	if err != nil {
		return fmt.Errorf("failed to create SSH session: %w", err)
	}
	defer session.Close()

	return nil
}
