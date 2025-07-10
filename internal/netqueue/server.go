package netqueue

import (
    "container/heap"
    "encoding/json"
    "log/slog"
    "net"
    "sync"
    "time"
)

// Job represents a job in the queue (minimal for network queue)
type Job struct {
    ID       string    `json:"id"`
    Command  string    `json:"command"`
    Args     string    `json:"args"`
    Priority int       `json:"priority"`
    Created  time.Time `json:"created"`
    Payload  []byte    `json:"payload"` // for full job struct
}

// PriorityQueue implements heap.Interface and holds Jobs
type PriorityQueue []*Job

func (pq PriorityQueue) Len() int { return len(pq) }
func (pq PriorityQueue) Less(i, j int) bool {
    // Higher priority first, then FIFO
    if pq[i].Priority == pq[j].Priority {
        return pq[i].Created.Before(pq[j].Created)
    }
    return pq[i].Priority > pq[j].Priority
}
func (pq PriorityQueue) Swap(i, j int) { pq[i], pq[j] = pq[j], pq[i] }
func (pq *PriorityQueue) Push(x interface{}) {
    *pq = append(*pq, x.(*Job))
}
func (pq *PriorityQueue) Pop() interface{} {
    old := *pq
    n := len(old)
    item := old[n-1]
    *pq = old[0 : n-1]
    return item
}

// NetQueueServer is the main server struct
type NetQueueServer struct {
    mu         sync.Mutex
    jobs       PriorityQueue
    reserved   map[string]*Job // jobs handed out but not acked
    listeners  map[net.Conn]struct{}
}

func NewNetQueueServer() *NetQueueServer {
    return &NetQueueServer{
        jobs:      make(PriorityQueue, 0),
        reserved:  make(map[string]*Job),
        listeners: make(map[net.Conn]struct{}),
    }
}

// Start launches the server on the given address (e.g. ":9000")
func (s *NetQueueServer) Start(addr string) error {
    ln, err := net.Listen("tcp", addr)
    if err != nil {
        return err
    }
    slog.Info("NetQueue server listening", "addr", addr)
    for {
        conn, err := ln.Accept()
        if err != nil {
            slog.Error("Accept error", "error", err)
            continue
        }
        s.listeners[conn] = struct{}{}
        go s.handleConn(conn)
    }
}

type request struct {
    Cmd  string          `json:"cmd"`
    Data json.RawMessage `json:"data"`
}

type response struct {
    Status string      `json:"status"`
    Data   interface{} `json:"data,omitempty"`
    Error  string      `json:"error,omitempty"`
}

func (s *NetQueueServer) handleConn(conn net.Conn) {
    defer func() {
        conn.Close()
        delete(s.listeners, conn)
    }()
    dec := json.NewDecoder(conn)
    enc := json.NewEncoder(conn)
    for {
        var req request
        if err := dec.Decode(&req); err != nil {
            slog.Warn("Decode error", "error", err)
            return
        }
        switch req.Cmd {
        case "PUSH":
            // Accept full job struct as payload
            var fullJob map[string]interface{}
            if err := json.Unmarshal(req.Data, &fullJob); err != nil {
                enc.Encode(response{Status: "error", Error: "invalid job"})
                continue
            }
            // Use req.Data directly as the payload (it's already json.RawMessage)
            payload := []byte(req.Data)
            job := Job{
                ID:       fullJob["id"].(string),
                Command:  fullJob["command"].(string),
                Args:     fullJob["args"].(string),
                Priority: int(fullJob["priority"].(float64)),
                Created:  time.Now(),
                Payload:  payload,
            }
            s.mu.Lock()
            heap.Push(&s.jobs, &job)
            s.mu.Unlock()
            slog.Info("Job pushed", "job_id", job.ID, "priority", job.Priority)
            enc.Encode(response{Status: "ok"})
        case "POP":
            s.mu.Lock()
            if s.jobs.Len() == 0 {
                s.mu.Unlock()
                enc.Encode(response{Status: "empty"})
                continue
            }
            job := heap.Pop(&s.jobs).(*Job)
            s.reserved[job.ID] = job
            s.mu.Unlock()
            slog.Info("Job popped", "job_id", job.ID)
            // Send the original payload as the job, not the server's Job struct
            enc.Encode(response{Status: "ok", Data: map[string]interface{}{
                "payload": json.RawMessage(job.Payload),
                "id": job.ID,
            }})
        case "ACK":
            var ack struct{ ID string `json:"id"` }
            if err := json.Unmarshal(req.Data, &ack); err != nil {
                enc.Encode(response{Status: "error", Error: "invalid ack"})
                continue
            }
            s.mu.Lock()
            delete(s.reserved, ack.ID)
            s.mu.Unlock()
            slog.Info("Job acked", "job_id", ack.ID)
            enc.Encode(response{Status: "ok"})
        case "CANCEL":
            var cancel struct{ ID string `json:"id"` }
            if err := json.Unmarshal(req.Data, &cancel); err != nil {
                enc.Encode(response{Status: "error", Error: "invalid cancel"})
                continue
            }
            s.mu.Lock()
            // Remove from reserved or queue
            if _, ok := s.reserved[cancel.ID]; ok {
                delete(s.reserved, cancel.ID)
                s.mu.Unlock()
                slog.Info("Job canceled (reserved)", "job_id", cancel.ID)
                enc.Encode(response{Status: "ok"})
                continue
            }
            // Remove from queue
            for i, job := range s.jobs {
                if job.ID == cancel.ID {
                    heap.Remove(&s.jobs, i)
                    break
                }
            }
            s.mu.Unlock()
            slog.Info("Job canceled (queue)", "job_id", cancel.ID)
            enc.Encode(response{Status: "ok"})
        default:
            enc.Encode(response{Status: "error", Error: "unknown command"})
        }
    }
}
