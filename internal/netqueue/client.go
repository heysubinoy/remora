package netqueue

import (
	"context"
	"encoding/json"
	"fmt"
	"job-executor/internal/models"
	"log/slog"
	"net"
	"sync"
	"time"
)

type NetQueueClient struct {
    addr string
    mu   sync.Mutex
    conn net.Conn
}

func NewNetQueueClient(addr string) (*NetQueueClient, error) {
    conn, err := net.Dial("tcp", addr)
    if err != nil {
        return nil, err
    }
    return &NetQueueClient{addr: addr, conn: conn}, nil
}

func (c *NetQueueClient) Push(job *models.Job) error {
    c.mu.Lock()
    defer c.mu.Unlock()
    b, err := json.Marshal(job)
    if err != nil {
        return err
    }
    req := map[string]interface{}{"cmd": "PUSH", "data": json.RawMessage(b)}
    if err := json.NewEncoder(c.conn).Encode(req); err != nil {
        return err
    }
    var resp map[string]interface{}
    if err := json.NewDecoder(c.conn).Decode(&resp); err != nil {
        return err
    }
    if resp["status"] != "ok" {
        return fmt.Errorf("push failed: %v", resp["error"])
    }
    return nil
}

func (c *NetQueueClient) StartConsumer(ctx context.Context, handler func(*models.Job)) error {
    go func() {
        for {
            select {
            case <-ctx.Done():
                return
            default:
                c.mu.Lock()
                req := map[string]interface{}{"cmd": "POP", "data": json.RawMessage([]byte("{}"))}
                if err := json.NewEncoder(c.conn).Encode(req); err != nil {
                    slog.Error("POP encode error", "error", err)
                    c.mu.Unlock()
                    time.Sleep(time.Second)
                    continue
                }
                var resp struct {
                    Status string      `json:"status"`
                    Data   struct {
                        Payload json.RawMessage `json:"payload"`
                        ID      string          `json:"id"`
                    } `json:"data"`
                    Error string `json:"error"`
                }
                if err := json.NewDecoder(c.conn).Decode(&resp); err != nil {
                    slog.Error("POP decode error", "error", err)
                    c.mu.Unlock()
                    time.Sleep(time.Second)
                    continue
                }
                c.mu.Unlock()
                if resp.Status == "ok" {
                    var job models.Job
                    if err := json.Unmarshal(resp.Data.Payload, &job); err != nil {
                        slog.Error("Failed to unmarshal job payload", "error", err)
                        continue
                    }
                    handler(&job)
                    // ACK after processing
                    c.Ack(job.ID)
                } else if resp.Status == "empty" {
                    time.Sleep(time.Second)
                }
            }
        }
    }()
    return nil
}

type netqueueJob struct {
    ID       string `json:"id"`
    Command  string `json:"command"`
    Args     string `json:"args"`
    Priority int    `json:"priority"`
}

func (c *NetQueueClient) Ack(jobID string) error {
    c.mu.Lock()
    defer c.mu.Unlock()
    ack := map[string]interface{}{"cmd": "ACK", "data": map[string]string{"id": jobID}}
    if err := json.NewEncoder(c.conn).Encode(ack); err != nil {
        return err
    }
    var resp map[string]interface{}
    if err := json.NewDecoder(c.conn).Decode(&resp); err != nil {
        return err
    }
    if resp["status"] != "ok" {
        return fmt.Errorf("ack failed: %v", resp["error"])
    }
    return nil
}

func (c *NetQueueClient) PublishCancelMessage(jobID string) error {
    c.mu.Lock()
    defer c.mu.Unlock()
    canc := map[string]interface{}{"cmd": "CANCEL", "data": map[string]string{"id": jobID}}
    if err := json.NewEncoder(c.conn).Encode(canc); err != nil {
        return err
    }
    var resp map[string]interface{}
    if err := json.NewDecoder(c.conn).Decode(&resp); err != nil {
        return err
    }
    if resp["status"] != "ok" {
        return fmt.Errorf("cancel failed: %v", resp["error"])
    }
    return nil
}

func (c *NetQueueClient) StartCancelConsumer(ctx context.Context, handler func(string)) error {
    // Not implemented for simple TCP client
    return nil
}

func (c *NetQueueClient) PublishOutputEvent(jobID, output string, isStderr bool, lineCount int) error {
    // Not implemented for simple TCP client
    return nil
}

func (c *NetQueueClient) StartOutputConsumer(ctx context.Context, jobID string, handler func(interface{})) error {
    // Not implemented for simple TCP client
    return nil
}

func (c *NetQueueClient) Close() error {
    c.mu.Lock()
    defer c.mu.Unlock()
    if c.conn != nil {
        return c.conn.Close()
    }
    return nil
}
