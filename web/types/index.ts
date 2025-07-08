export interface Server {
  id: string
  name: string
  hostname: string
  port: number
  username: string
  authType: "ssh-key" | "private-key" | "password"
  sshKeyPath?: string
  privateKeyContent?: string
  password?: string
  status: "connected" | "disconnected" | "error"
}

export interface Job {
  id: string
  serverId: string
  serverName: string
  command: string
  status: "running" | "completed" | "failed" | "cancelled"
  created: Date
  duration: number
  exitCode: number | null
}
