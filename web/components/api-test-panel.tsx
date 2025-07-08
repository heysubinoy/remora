"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Play, Copy, Check, Zap } from "lucide-react"
import { toast } from "sonner"

export function ApiTestPanel() {
  const [method, setMethod] = useState("GET")
  const [endpoint, setEndpoint] = useState("/api/servers")
  const [body, setBody] = useState("")
  const [response, setResponse] = useState("")
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const commonEndpoints = [
    { method: "GET", path: "/api/servers", body: "" },
    {
      method: "POST",
      path: "/api/servers",
      body: JSON.stringify(
        {
          name: "Test Server",
          hostname: "test.example.com",
          port: 22,
          username: "ubuntu",
          authType: "ssh-key",
          sshKeyPath: "/path/to/key.pem",
        },
        null,
        2,
      ),
    },
    { method: "GET", path: "/api/jobs", body: "" },
    {
      method: "POST",
      path: "/api/jobs",
      body: JSON.stringify(
        {
          serverIds: ["srv-001"],
          command: "echo 'Hello World'",
          timeout: 300,
        },
        null,
        2,
      ),
    },
    { method: "GET", path: "/api/system/stats", body: "" },
  ]

  const executeRequest = async () => {
    setLoading(true)
    setResponse("")

    try {
      const options: RequestInit = {
        method,
        headers: {
          "Content-Type": "application/json",
        },
      }

      if (method !== "GET" && body.trim()) {
        options.body = body
      }

      const startTime = Date.now()
      const res = await fetch(endpoint, options)
      const endTime = Date.now()

      const responseData = await res.json()

      const result = {
        status: res.status,
        statusText: res.statusText,
        responseTime: `${endTime - startTime}ms`,
        headers: Object.fromEntries(res.headers.entries()),
        data: responseData,
      }

      setResponse(JSON.stringify(result, null, 2))

      if (res.ok) {
        toast.success(`Request successful (${result.responseTime})`)
      } else {
        toast.error(`Request failed: ${res.status} ${res.statusText}`)
      }
    } catch (error) {
      const errorResponse = {
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      }
      setResponse(JSON.stringify(errorResponse, null, 2))
      toast.error("Request failed")
    } finally {
      setLoading(false)
    }
  }

  const copyResponse = async () => {
    await navigator.clipboard.writeText(response)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success("Response copied to clipboard")
  }

  const loadExample = (example: (typeof commonEndpoints)[0]) => {
    setMethod(example.method)
    setEndpoint(example.path)
    setBody(example.body)
  }

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-blue-500" />
          API Test Panel
        </CardTitle>
        <CardDescription>Test API endpoints directly from the dashboard</CardDescription>
      </CardHeader>

      <CardContent>
        <Tabs defaultValue="request" className="space-y-4">
          <TabsList>
            <TabsTrigger value="request">Request</TabsTrigger>
            <TabsTrigger value="examples">Examples</TabsTrigger>
            <TabsTrigger value="response">Response</TabsTrigger>
          </TabsList>

          <TabsContent value="request" className="space-y-4">
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Method</Label>
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GET">GET</SelectItem>
                    <SelectItem value="POST">POST</SelectItem>
                    <SelectItem value="PUT">PUT</SelectItem>
                    <SelectItem value="PATCH">PATCH</SelectItem>
                    <SelectItem value="DELETE">DELETE</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-3 space-y-2">
                <Label>Endpoint</Label>
                <Input value={endpoint} onChange={(e) => setEndpoint(e.target.value)} placeholder="/api/servers" />
              </div>
            </div>

            {method !== "GET" && (
              <div className="space-y-2">
                <Label>Request Body (JSON)</Label>
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Enter JSON request body..."
                  rows={8}
                  className="font-mono text-sm"
                />
              </div>
            )}

            <Button onClick={executeRequest} disabled={loading} className="w-full">
              <Play className="h-4 w-4 mr-2" />
              {loading ? "Executing..." : "Execute Request"}
            </Button>
          </TabsContent>

          <TabsContent value="examples" className="space-y-4">
            <div className="space-y-2">
              <Label>Common API Calls</Label>
              <div className="grid gap-2">
                {commonEndpoints.map((example, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    onClick={() => loadExample(example)}
                    className="justify-start h-auto p-3"
                  >
                    <div className="flex items-center gap-3 w-full">
                      <Badge variant="outline" className="text-xs">
                        {example.method}
                      </Badge>
                      <code className="text-sm font-mono">{example.path}</code>
                    </div>
                  </Button>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="response" className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Response</Label>
              {response && (
                <Button variant="ghost" size="sm" onClick={copyResponse}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              )}
            </div>

            <ScrollArea className="h-96">
              <pre className="text-sm bg-muted/50 p-4 rounded-lg font-mono whitespace-pre-wrap">
                {response || "No response yet. Execute a request to see the response here."}
              </pre>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
