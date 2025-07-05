<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# Job Executor Project

This is a Go-based distributed job execution system that:

- Accepts job submissions via REST API
- Queues and executes shell commands remotely over SSH
- Tracks job status and logs
- Supports job cancellation
- Provides both CLI and web interfaces

## Architecture

- REST API server using Gin framework
- Background worker with job queue
- SQLite/PostgreSQL database for job metadata
- SSH execution using golang.org/x/crypto/ssh
- Real-time job status updates

## Code Style Guidelines

- Use structured logging with slog
- Follow Go naming conventions
- Use dependency injection for testability
- Implement proper error handling with wrapped errors
- Use context for cancellation and timeouts
