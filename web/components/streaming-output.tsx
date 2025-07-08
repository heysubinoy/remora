"use client";

import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface StreamingOutputProps {
  stdout?: string;
  stderr?: string;
  error?: string;
  output?: string;
  isStreaming: boolean;
  autoScroll?: boolean;
  className?: string;
}

export function StreamingOutput({
  stdout,
  stderr,
  error,
  output,
  isStreaming,
  autoScroll = true,
  className = "h-[300px]",
}: StreamingOutputProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const outputRef = useRef<string>("");

  // Track output changes and auto-scroll if needed
  useEffect(() => {
    const currentOutput = [stdout, stderr, error, output].filter(Boolean).join("");
    
    if (currentOutput !== outputRef.current && autoScroll && isStreaming) {
      outputRef.current = currentOutput;
      
      // Scroll to bottom after a short delay to ensure content is rendered
      setTimeout(() => {
        const scrollContainer = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
        if (scrollContainer) {
          scrollContainer.scrollTop = scrollContainer.scrollHeight;
        }
      }, 100);
    }
  }, [stdout, stderr, error, output, autoScroll, isStreaming]);

  return (
    <div className="border rounded-lg overflow-hidden bg-black/90">
      <ScrollArea className={className} ref={scrollAreaRef}>
        <div className="p-4 space-y-2">
          {/* Standard Output */}
          {stdout && (
            <div>
              <div className="text-green-400 text-xs font-semibold mb-1">
                STDOUT:
              </div>
              <pre className="text-green-100 text-sm font-mono whitespace-pre-wrap break-words">
                {stdout}
              </pre>
            </div>
          )}

          {/* Standard Error */}
          {stderr && (
            <div>
              <div className="text-red-400 text-xs font-semibold mb-1">
                STDERR:
              </div>
              <pre className="text-red-300 text-sm font-mono whitespace-pre-wrap break-words">
                {stderr}
              </pre>
            </div>
          )}

          {/* Error Messages */}
          {error && (
            <div>
              <div className="text-orange-400 text-xs font-semibold mb-1">
                ERROR:
              </div>
              <pre className="text-orange-300 text-sm font-mono whitespace-pre-wrap break-words">
                {error}
              </pre>
            </div>
          )}

          {/* Fallback to general output */}
          {!stdout && !stderr && output && (
            <div>
              <div className="text-blue-400 text-xs font-semibold mb-1">
                OUTPUT:
              </div>
              <pre className="text-gray-300 text-sm font-mono whitespace-pre-wrap break-words">
                {output}
              </pre>
            </div>
          )}

          {/* No output available */}
          {!stdout && !stderr && !error && !output && (
            <div className="text-gray-500 text-sm italic text-center py-8">
              {isStreaming ? "Waiting for output..." : "No output available"}
            </div>
          )}
          
          {/* Auto-scroll indicator when streaming */}
          {isStreaming && autoScroll && (
            <div className="text-center py-2">
              <div className="inline-flex items-center gap-2 text-xs text-green-500">
                <div className="h-1 w-1 rounded-full bg-green-500 animate-pulse" />
                Auto-scrolling enabled
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
