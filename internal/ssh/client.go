package ssh

import (
	"bytes"
	"context"
	"fmt"
	"io/ioutil"
	"job-executor/internal/config"
	"strings"
	"time"

	"golang.org/x/crypto/ssh"
)

type Client struct {
	config *config.SSHConfig
}

type ExecutionResult struct {
	Output   string
	Error    string
	ExitCode int
}

func NewClient(cfg *config.SSHConfig) *Client {
	return &Client{config: cfg}
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
