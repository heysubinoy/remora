"use client";

import { useState, useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Terminal, Square, Download, Search, Filter, Clock } from "lucide-react";
import { Job } from "@/lib/api";

interface LiveOutputViewerProps {
  job: Job | null;
  logs: {
    stdout: string;
    stderr: string;
    output: string;
    error: string;
  };
  isConnected: boolean;
  onCancel?: () => void;
}

interface ParsedLine {
  id: number;
  content: string;
  timestamp?: string;
  level?: 'info' | 'warn' | 'error' | 'debug';
  type?: 'command' | 'output' | 'system';
  raw: string;
}

export function LiveOutputViewer({ job, logs, isConnected, onCancel }: LiveOutputViewerProps) {
  const [parsedOutput, setParsedOutput] = useState<{
    lines: ParsedLine[];
    lastUpdate: Date;
    totalLines: number;
  }>({
    lines: [],
    lastUpdate: new Date(),
    totalLines: 0,
  });
  
  const [searchTerm, setSearchTerm] = useState("");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const outputRef = useRef<HTMLDivElement>(null);
  const [isAutoScroll, setIsAutoScroll] = useState(true);

  // Enhanced parser for different output formats
  const parseOutputLine = (line: string, index: number): ParsedLine | null => {
    const trimmedLine = line.trim();
    if (!trimmedLine) return null;

    // Try to parse different formats
    let parsed: ParsedLine = {
      id: index,
      content: trimmedLine,
      raw: line,
      type: 'output'
    };

    // JSON format detection
    if (trimmedLine.startsWith('{') && trimmedLine.includes('"')) {
      try {
        const jsonData = JSON.parse(trimmedLine);
        if (jsonData.level) parsed.level = jsonData.level;
        if (jsonData.message) parsed.content = jsonData.message;
        if (jsonData.timestamp) parsed.timestamp = jsonData.timestamp;
        parsed.type = 'system';
      } catch (e) {
        // Not valid JSON, continue with other parsing
      }
    }

    // Log level detection
    const levelMatch = trimmedLine.match(/^\[?(INFO|WARN|ERROR|DEBUG|TRACE)\]?\s*:?\s*(.*)/i);
    if (levelMatch) {
      parsed.level = levelMatch[1].toLowerCase() as any;
      parsed.content = levelMatch[2] || trimmedLine;
      parsed.type = 'system';
    }

    // Timestamp detection
    const timestampMatch = trimmedLine.match(/^(\d{4}-\d{2}-\d{2}[\sT]\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z?)\s+(.*)/);
    if (timestampMatch) {
      parsed.timestamp = timestampMatch[1];
      parsed.content = timestampMatch[2];
    }

    // Command detection
    if (trimmedLine.startsWith('$') || trimmedLine.startsWith('>') || trimmedLine.startsWith('#')) {
      parsed.type = 'command';
    }

    // Error detection
    if (trimmedLine.toLowerCase().includes('error') || trimmedLine.toLowerCase().includes('failed')) {
      parsed.level = 'error';
    }

    return parsed;
  };

  // Parse the job output field for live content
  useEffect(() => {
    // For live jobs, prioritize logs.output, fallback to job.output
    const outputContent = job?.status === 'running' || job?.status === 'queued' 
      ? (logs.output || job?.output || '')
      : (job?.output || logs.output || '');

    console.log('🔍 LiveOutputViewer data:', {
      jobStatus: job?.status,
      jobOutput: job?.output?.length || 0,
      logsOutput: logs.output?.length || 0,
      finalOutput: outputContent?.length || 0,
    });

    if (!outputContent) {
      setParsedOutput({ lines: [], lastUpdate: new Date(), totalLines: 0 });
      return;
    }

    // Split output by newlines and parse each line
    const rawLines = outputContent.split('\n');
    const parsedLines = rawLines
      .map((line: string, index: number) => parseOutputLine(line, index))
      .filter((line): line is ParsedLine => line !== null);
    
    console.log('📝 Parsed lines:', parsedLines.length, 'from', rawLines.length, 'raw lines');
    
    setParsedOutput({
      lines: parsedLines,
      lastUpdate: new Date(),
      totalLines: rawLines.length,
    });
  }, [job?.output, logs.output, job?.status]);

  // Auto-scroll to bottom when new content arrives - more aggressive for live jobs
  useEffect(() => {
    if (outputRef.current) {
      const isLiveJob = job?.status === 'running' || job?.status === 'queued';
      
      // For live jobs, always scroll to bottom regardless of isAutoScroll
      // For completed jobs, respect user's scroll preference
      if (isLiveJob || isAutoScroll) {
        // Use requestAnimationFrame for smoother scrolling
        requestAnimationFrame(() => {
          if (outputRef.current) {
            outputRef.current.scrollTop = outputRef.current.scrollHeight;
          }
        });
      }
    }
  }, [parsedOutput, isAutoScroll, job?.status, logs.output, logs.error]);

  // Force scroll to bottom for live jobs when they start
  useEffect(() => {
    const isLiveJob = job?.status === 'running' || job?.status === 'queued';
    if (isLiveJob && outputRef.current) {
      setIsAutoScroll(true); // Ensure auto-scroll is enabled for live jobs
      requestAnimationFrame(() => {
        if (outputRef.current) {
          outputRef.current.scrollTop = outputRef.current.scrollHeight;
        }
      });
    }
  }, [job?.status]);

  // Handle manual scroll to disable auto-scroll (only for completed jobs)
  const handleScroll = () => {
    if (outputRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = outputRef.current;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10;
      const isLiveJob = job?.status === 'running' || job?.status === 'queued';
      
      // Only allow disabling auto-scroll for completed jobs
      if (!isLiveJob) {
        setIsAutoScroll(isAtBottom);
      }
    }
  };

  // Filter lines based on search and level
  const filteredLines = parsedOutput.lines.filter(line => {
    const matchesSearch = searchTerm === "" || 
      line.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (line.timestamp && line.timestamp.includes(searchTerm));
    
    const matchesLevel = levelFilter === "all" || line.level === levelFilter;
    
    return matchesSearch && matchesLevel;
  });

  const getLevelColor = (level?: string, type?: string) => {
    if (type === 'command') return 'text-cyan-400';
    switch (level) {
      case 'error': return 'text-red-400';
      case 'warn': return 'text-yellow-400';
      case 'info': return 'text-blue-400';
      case 'debug': return 'text-gray-400';
      default: return 'text-green-400';
    }
  };

  const getLevelIcon = (level?: string, type?: string) => {
    if (type === 'command') return '$ ';
    switch (level) {
      case 'error': return '❌ ';
      case 'warn': return '⚠️ ';
      case 'info': return 'ℹ️ ';
      case 'debug': return '🐛 ';
      default: return '';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'canceled':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  const downloadLogs = () => {
    if (!job || !parsedOutput.lines.length) return;
    
    const content = parsedOutput.lines.map(line => line.raw).join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `job-${job.id}-output.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!job) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">No job selected</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header with search and filters */}
      <div className="flex items-center justify-between p-4 border-b bg-gray-50">
        <div className="flex items-center gap-3">
          <Terminal className="w-5 h-5" />
          <div>
            <h3 className="font-semibold">
              {job?.status === 'running' || job?.status === 'queued' 
                ? 'Live Job Monitor' 
                : 'Job Output Parser'
              }
            </h3>
            <p className="text-sm text-gray-600">
              {job?.command} {job?.args}
              {job?.status === 'running' && (
                <span className="ml-2 text-blue-600 text-xs">
                  • Output available after completion
                </span>
              )}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <Input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 w-48 h-8"
            />
          </div>
          
          {/* Level Filter */}
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="px-2 py-1 border rounded text-sm"
          >
            <option value="all">All Levels</option>
            <option value="error">Errors</option>
            <option value="warn">Warnings</option>
            <option value="info">Info</option>
            <option value="debug">Debug</option>
          </select>

          {/* Download Button */}
          {parsedOutput.lines.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={downloadLogs}
            >
              <Download className="w-4 h-4 mr-1" />
              Download
            </Button>
          )}
          
          {/* Connection Status */}
          {isConnected && job?.status === 'running' && (
            <div className="flex items-center gap-1 text-xs bg-green-500/20 px-2 py-1 rounded">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              Live
            </div>
          )}
          
          {/* Job Status */}
          {job && (
            <Badge className={getStatusColor(job.status)}>
              {job.status === 'running' && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
              {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
            </Badge>
          )}
          
          {/* Cancel Button */}
          {job && (job.status === 'running' || job.status === 'queued') && onCancel && (
            <Button
              variant="outline"
              size="sm"
              onClick={onCancel}
              className="text-red-600 hover:text-red-700"
            >
              <Square className="w-4 h-4 mr-1" />
              Cancel
            </Button>
          )}
        </div>
      </div>

      {/* Live Output Area */}
      <div className="flex-1 relative">
        <div 
          className="h-full overflow-auto" 
          ref={outputRef}
          onScroll={handleScroll}
          style={{ scrollBehavior: job?.status === 'running' ? 'smooth' : 'auto' }}
        >
          <div className="p-4 font-mono text-sm bg-black min-h-full">
            {filteredLines.length === 0 ? (
              <div className="text-gray-500 italic flex flex-col items-center justify-center h-32 space-y-2">
                {parsedOutput.lines.length === 0 ? (
                  job?.status === 'running' ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin text-green-400" />
                      <div className="text-center">
                        <div className="text-green-400 font-semibold">Job is running</div>
                        <div className="text-sm text-gray-400 mt-1">
                          Output will appear when the job completes
                        </div>
                        <div className="text-xs text-gray-500 mt-2">
                          Command: <span className="font-mono">{job.command} {job.args}</span>
                        </div>
                      </div>
                    </>
                  ) : job?.status === 'queued' ? (
                    <>
                      <Clock className="w-6 h-6 text-yellow-400" />
                      <div className="text-center">
                        <div className="text-yellow-400 font-semibold">Job queued</div>
                        <div className="text-sm text-gray-400 mt-1">
                          Waiting to start execution
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <Terminal className="w-6 h-6 text-gray-400" />
                      <div className="text-center">
                        <div className="text-gray-400 font-semibold">No output</div>
                        <div className="text-sm text-gray-500 mt-1">
                          Job completed without output
                        </div>
                      </div>
                    </>
                  )
                ) : (
                  <>
                    <Filter className="w-6 h-6 text-yellow-400" />
                    <div className="text-center">
                      <div className="text-yellow-400 font-semibold">No matches</div>
                      <div className="text-sm text-gray-400 mt-1">
                        Try adjusting your search or filter settings
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                {filteredLines.map((line, index) => (
                  <div key={line.id} className="whitespace-pre-wrap break-words hover:bg-gray-800/50 px-1 rounded">
                    <span className="text-gray-500 mr-3 select-none">{String(line.id + 1).padStart(4, ' ')}:</span>
                    {line.timestamp && (
                      <span className="text-gray-400 mr-2 text-xs">
                        [{line.timestamp}]
                      </span>
                    )}
                    {line.level && (
                      <span className={`mr-1 ${getLevelColor(line.level, line.type)}`}>
                        {getLevelIcon(line.level, line.type)}
                      </span>
                    )}
                    <span className={`${getLevelColor(line.level, line.type)}`}>
                      {line.content}
                    </span>
                  </div>
                ))}
                
                {/* Live cursor for running jobs */}
                {job?.status === 'running' && searchTerm === "" && levelFilter === "all" && (
                  <div className="flex items-center gap-1 mt-4 px-1 bg-gray-800/50 rounded p-2 border-l-2 border-green-400">
                    <span className="text-gray-500 mr-3 select-none">{String(parsedOutput.totalLines + 1).padStart(4, ' ')}:</span>
                    <span className="text-green-300 animate-pulse">█</span>
                    <span className="text-gray-400 text-xs ml-2">
                      Executing • {parsedOutput.lastUpdate.toLocaleTimeString()}
                    </span>
                    {isConnected && (
                      <span className="text-xs bg-green-500/20 px-2 py-1 rounded ml-2 flex items-center">
                        <div className="w-1 h-1 bg-green-400 rounded-full animate-pulse inline-block mr-1"></div>
                        Live streaming
                      </span>
                    )}
                    {!isConnected && (
                      <span className="text-xs bg-yellow-500/20 px-2 py-1 rounded ml-2 text-yellow-400">
                        Polling updates
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Auto-scroll indicator - only show for completed jobs */}
        {!isAutoScroll && filteredLines.length > 0 && job?.status !== 'running' && job?.status !== 'queued' && (
          <div className="absolute bottom-4 right-4">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setIsAutoScroll(true);
                if (outputRef.current) {
                  requestAnimationFrame(() => {
                    if (outputRef.current) {
                      outputRef.current.scrollTop = outputRef.current.scrollHeight;
                    }
                  });
                }
              }}
              className="shadow-lg"
            >
              Scroll to bottom
            </Button>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t bg-gray-50 text-xs text-gray-600">
        <div className="flex items-center justify-between">
          <div>
            Total: {parsedOutput.totalLines} lines • 
            Displayed: {filteredLines.length} lines • 
            Status: {job?.status} • 
            {job?.duration && `Duration: ${Math.round(job.duration / 1000000000)}s`}
            {job?.status === 'running' && (
              <span className="ml-2 text-blue-600">
                • Real-time output will appear after completion
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            {searchTerm && (
              <span className="text-blue-600">
                <Filter className="w-3 h-3 inline mr-1" />
                Filtered
              </span>
            )}
            {job?.exit_code !== null && (
              <span>
                Exit code: <span className={job.exit_code === 0 ? 'text-green-600' : 'text-red-600'}>
                  {job.exit_code}
                </span>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
