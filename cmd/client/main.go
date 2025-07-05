package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
	"time"
)

const (
	DefaultServerURL = "http://localhost:8080"
)

type JobRequest struct {
	Command  string `json:"command"`
	Args     string `json:"args,omitempty"`
	ServerID string `json:"server_id"`
	Timeout  int    `json:"timeout,omitempty"`
}

type ServerRequest struct {
	Name       string `json:"name"`
	Hostname   string `json:"hostname"`
	Port       int    `json:"port,omitempty"`
	User       string `json:"user"`
	AuthType   string `json:"auth_type"`
	Password   string `json:"password,omitempty"`
	PrivateKey string `json:"private_key,omitempty"`
	PemFile    string `json:"pem_file,omitempty"`
	IsActive   *bool  `json:"is_active,omitempty"`
}

func main() {
	var (
		serverURL = flag.String("url", DefaultServerURL, "Job executor server URL")
		action    = flag.String("action", "", "Action to perform: submit-job, get-job, list-jobs, cancel-job, create-server, list-servers")
		
		// Job flags
		command  = flag.String("command", "", "Command to execute")
		args     = flag.String("args", "", "Command arguments")
		serverID = flag.String("server-id", "", "Server ID to execute job on")
		timeout  = flag.Int("timeout", 300, "Job timeout in seconds")
		jobID    = flag.String("job-id", "", "Job ID for get/cancel operations")
		
		// Server flags
		serverName = flag.String("server-name", "", "Server name")
		hostname   = flag.String("hostname", "", "Server hostname")
		port       = flag.Int("port", 22, "SSH port")
		user       = flag.String("user", "", "SSH user")
		authType   = flag.String("auth-type", "", "Authentication type: password or key")
		password   = flag.String("password", "", "SSH password")
		privateKey = flag.String("private-key", "", "SSH private key content or file path")
		pemFile    = flag.String("pem-file", "", "PEM file path")
	)
	flag.Parse()

	if *action == "" {
		fmt.Println("Usage: ./client -action <action> [options]")
		fmt.Println("\nActions:")
		fmt.Println("  submit-job    Submit a new job")
		fmt.Println("  get-job       Get job details")
		fmt.Println("  list-jobs     List all jobs")
		fmt.Println("  cancel-job    Cancel a job")
		fmt.Println("  create-server Create a server configuration")
		fmt.Println("  list-servers  List all servers")
		fmt.Println("\nExamples:")
		fmt.Println("  ./client -action submit-job -command 'ls' -args '-la' -server-id <id>")
		fmt.Println("  ./client -action get-job -job-id <id>")
		fmt.Println("  ./client -action create-server -server-name myserver -hostname 192.168.1.100 -user ubuntu -auth-type password -password mypass")
		os.Exit(1)
	}

	switch *action {
	case "submit-job":
		submitJob(*serverURL, *command, *args, *serverID, *timeout)
	case "get-job":
		getJob(*serverURL, *jobID)
	case "list-jobs":
		listJobs(*serverURL)
	case "cancel-job":
		cancelJob(*serverURL, *jobID)
	case "create-server":
		createServer(*serverURL, *serverName, *hostname, *port, *user, *authType, *password, *privateKey, *pemFile)
	case "list-servers":
		listServers(*serverURL)
	default:
		fmt.Printf("Unknown action: %s\n", *action)
		os.Exit(1)
	}
}

func submitJob(serverURL, command, args, serverID string, timeout int) {
	if command == "" || serverID == "" {
		fmt.Println("Error: command and server-id are required for submit-job")
		os.Exit(1)
	}

	req := JobRequest{
		Command:  command,
		Args:     args,
		ServerID: serverID,
		Timeout:  timeout,
	}

	jsonData, err := json.Marshal(req)
	if err != nil {
		fmt.Printf("Error marshaling request: %v\n", err)
		os.Exit(1)
	}

	resp, err := http.Post(serverURL+"/api/v1/jobs", "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		fmt.Printf("Error submitting job: %v\n", err)
		os.Exit(1)
	}
	defer resp.Body.Close()

	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		fmt.Printf("Error reading response: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("Response (%d): %s\n", resp.StatusCode, string(body))
}

func getJob(serverURL, jobID string) {
	if jobID == "" {
		fmt.Println("Error: job-id is required for get-job")
		os.Exit(1)
	}

	resp, err := http.Get(serverURL + "/api/v1/jobs/" + jobID)
	if err != nil {
		fmt.Printf("Error getting job: %v\n", err)
		os.Exit(1)
	}
	defer resp.Body.Close()

	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		fmt.Printf("Error reading response: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("Response (%d): %s\n", resp.StatusCode, string(body))
}

func listJobs(serverURL string) {
	resp, err := http.Get(serverURL + "/api/v1/jobs")
	if err != nil {
		fmt.Printf("Error listing jobs: %v\n", err)
		os.Exit(1)
	}
	defer resp.Body.Close()

	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		fmt.Printf("Error reading response: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("Response (%d): %s\n", resp.StatusCode, string(body))
}

func cancelJob(serverURL, jobID string) {
	if jobID == "" {
		fmt.Println("Error: job-id is required for cancel-job")
		os.Exit(1)
	}

	req, err := http.NewRequest("POST", serverURL+"/api/v1/jobs/"+jobID+"/cancel", nil)
	if err != nil {
		fmt.Printf("Error creating request: %v\n", err)
		os.Exit(1)
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		fmt.Printf("Error canceling job: %v\n", err)
		os.Exit(1)
	}
	defer resp.Body.Close()

	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		fmt.Printf("Error reading response: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("Response (%d): %s\n", resp.StatusCode, string(body))
}

func createServer(serverURL, name, hostname string, port int, user, authType, password, privateKey, pemFile string) {
	if name == "" || hostname == "" || user == "" || authType == "" {
		fmt.Println("Error: server-name, hostname, user, and auth-type are required for create-server")
		os.Exit(1)
	}

	active := true
	req := ServerRequest{
		Name:       name,
		Hostname:   hostname,
		Port:       port,
		User:       user,
		AuthType:   authType,
		Password:   password,
		PrivateKey: privateKey,
		PemFile:    pemFile,
		IsActive:   &active,
	}

	jsonData, err := json.Marshal(req)
	if err != nil {
		fmt.Printf("Error marshaling request: %v\n", err)
		os.Exit(1)
	}

	resp, err := http.Post(serverURL+"/api/v1/servers", "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		fmt.Printf("Error creating server: %v\n", err)
		os.Exit(1)
	}
	defer resp.Body.Close()

	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		fmt.Printf("Error reading response: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("Response (%d): %s\n", resp.StatusCode, string(body))
}

func listServers(serverURL string) {
	resp, err := http.Get(serverURL + "/api/v1/servers")
	if err != nil {
		fmt.Printf("Error listing servers: %v\n", err)
		os.Exit(1)
	}
	defer resp.Body.Close()

	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		fmt.Printf("Error reading response: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("Response (%d): %s\n", resp.StatusCode, string(body))
}
