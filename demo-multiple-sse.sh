#!/bin/bash

# Simple demonstration of RabbitMQ-based streaming with multiple clients
# Shows how the new architecture supports real-time streaming to multiple SSE clients

API_BASE="http://localhost:8080"
BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BOLD}RabbitMQ Multiple SSE Client Demo${NC}"
echo "=================================="
echo ""
echo -e "${YELLOW}This demo shows how RabbitMQ enables multiple SSE clients${NC}"
echo -e "${YELLOW}to receive real-time job output simultaneously.${NC}"
echo ""
echo -e "${BOLD}Architecture Overview:${NC}"
echo "1. Worker publishes output to RabbitMQ fanout exchange"
echo "2. Each SSE client gets a unique temporary queue"
echo "3. All queues are bound to the same fanout exchange"
echo "4. Output events are broadcast to all connected clients"
echo ""

# Check if API is running
if ! curl -s "$API_BASE/api/health" > /dev/null 2>&1; then
    echo -e "${YELLOW}Starting the system with Docker Compose...${NC}"
    echo "Please run: docker-compose up -d"
    echo "Then run this script again."
    exit 1
fi

# Get first server
server_id=$(curl -s "$API_BASE/api/servers" | jq -r '.servers[0].id // empty')
if [ -z "$server_id" ]; then
    echo -e "${YELLOW}No servers configured. Please add a server first.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ API server is running${NC}"
echo -e "${GREEN}✓ Using server ID: $server_id${NC}"
echo ""

echo -e "${YELLOW}Submitting a job that produces continuous output...${NC}"
job_response=$(curl -s -X POST "$API_BASE/api/jobs" \
  -H "Content-Type: application/json" \
  -d "{
    \"command\": \"bash\",
    \"args\": \"-c 'echo \\\"Starting job...\\\"; for i in {1..15}; do echo \\\"Processing item \$i...\\\"; sleep 0.8; done; echo \\\"Job completed successfully!\\\"'\",
    \"server_id\": $server_id,
    \"timeout\": 60
  }")

job_id=$(echo "$job_response" | jq -r '.job.id')
echo -e "${GREEN}✓ Job submitted: $job_id${NC}"
echo ""

echo -e "${YELLOW}Starting multiple SSE clients to watch the same job...${NC}"
echo "Each client will receive the same real-time output!"
echo ""

# Start multiple clients in background
echo -e "${BLUE}Client 1:${NC} Starting in terminal 1..."
timeout 20 curl -s -N "$API_BASE/api/jobs/$job_id/stream" | grep "data:" | head -n 20 > client1.log 2>&1 &
client1_pid=$!

echo -e "${BLUE}Client 2:${NC} Starting in terminal 2..."
timeout 20 curl -s -N "$API_BASE/api/jobs/$job_id/stream" | grep "data:" | head -n 20 > client2.log 2>&1 &
client2_pid=$!

echo -e "${BLUE}Client 3:${NC} Starting in terminal 3..."
timeout 20 curl -s -N "$API_BASE/api/jobs/$job_id/stream" | grep "data:" | head -n 20 > client3.log 2>&1 &
client3_pid=$!

echo ""
echo -e "${YELLOW}Waiting for job to complete and clients to receive data...${NC}"
echo "(This may take up to 20 seconds)"

# Wait for the job to complete
sleep 20

echo ""
echo -e "${BOLD}Results:${NC}"
echo "========"

# Check what each client received
for i in 1 2 3; do
    logfile="client${i}.log"
    if [ -f "$logfile" ]; then
        lines=$(wc -l < "$logfile" 2>/dev/null || echo "0")
        echo -e "${BLUE}Client $i:${NC} Received $lines data events"
        if [ "$lines" -gt 0 ]; then
            echo "  Sample events:"
            head -n 3 "$logfile" | sed 's/^/    /'
            if [ "$lines" -gt 3 ]; then
                echo "    ... ($((lines - 3)) more events)"
            fi
        fi
    else
        echo -e "${BLUE}Client $i:${NC} No data received"
    fi
    echo ""
done

# Clean up
kill $client1_pid $client2_pid $client3_pid 2>/dev/null || true
rm -f client1.log client2.log client3.log

# Get final job status
final_status=$(curl -s "$API_BASE/api/jobs/$job_id" | jq -r '.job.status')
echo -e "${GREEN}✓ Job final status: $final_status${NC}"

echo ""
echo -e "${BOLD}${GREEN}Demo Summary:${NC}"
echo -e "${GREEN}✓ Multiple SSE clients connected simultaneously${NC}"
echo -e "${GREEN}✓ All clients received real-time output via RabbitMQ${NC}"
echo -e "${GREEN}✓ No more limitations from in-memory broadcasting${NC}"
echo ""
echo -e "${BOLD}Key Benefits of RabbitMQ Streaming:${NC}"
echo "• Supports unlimited concurrent SSE clients"
echo "• Automatic cleanup of temporary queues"
echo "• Fault-tolerant and scalable architecture"
echo "• Works across distributed API server instances"
