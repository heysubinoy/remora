package broadcast

import (
	"sync"
)

// OutputBroadcaster manages real-time output broadcasting to SSE clients
type OutputBroadcaster struct {
	clients map[string]map[chan OutputEvent]bool // jobID -> clients
	mutex   sync.RWMutex
}

// OutputEvent represents a real-time output event
type OutputEvent struct {
	JobID    string `json:"job_id"`
	Content  string `json:"content"`
	IsStderr bool   `json:"is_stderr"`
	LineNum  int    `json:"line_num"`
}

// Global broadcaster instance
var GlobalBroadcaster = NewOutputBroadcaster()

func NewOutputBroadcaster() *OutputBroadcaster {
	return &OutputBroadcaster{
		clients: make(map[string]map[chan OutputEvent]bool),
	}
}

// Subscribe creates a new SSE client for a job
func (b *OutputBroadcaster) Subscribe(jobID string) chan OutputEvent {
	b.mutex.Lock()
	defer b.mutex.Unlock()

	client := make(chan OutputEvent, 100) // Buffer for 100 events

	if b.clients[jobID] == nil {
		b.clients[jobID] = make(map[chan OutputEvent]bool)
	}
	b.clients[jobID][client] = true

	return client
}

// Unsubscribe removes an SSE client
func (b *OutputBroadcaster) Unsubscribe(jobID string, client chan OutputEvent) {
	b.mutex.Lock()
	defer b.mutex.Unlock()

	if b.clients[jobID] != nil {
		delete(b.clients[jobID], client)
		close(client)

		// Clean up empty job entries
		if len(b.clients[jobID]) == 0 {
			delete(b.clients, jobID)
		}
	}
}

// Broadcast sends output to all subscribers of a job
func (b *OutputBroadcaster) Broadcast(jobID string, content string, isStderr bool, lineNum int) {
	b.mutex.RLock()
	defer b.mutex.RUnlock()

	if clients, exists := b.clients[jobID]; exists {
		event := OutputEvent{
			JobID:    jobID,
			Content:  content,
			IsStderr: isStderr,
			LineNum:  lineNum,
		}

		for client := range clients {
			select {
			case client <- event:
				// Event sent successfully
			default:
				// Client buffer is full, skip this event
			}
		}
	}
}

// HasSubscribers checks if there are active subscribers for a job
func (b *OutputBroadcaster) HasSubscribers(jobID string) bool {
	b.mutex.RLock()
	defer b.mutex.RUnlock()

	clients, exists := b.clients[jobID]
	return exists && len(clients) > 0
}
