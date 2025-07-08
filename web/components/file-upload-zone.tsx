"use client"

import type React from "react"

import { useCallback, useState } from "react"
import { Upload, type File, X, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface FileUploadZoneProps {
  onFileSelect: (file: File) => void
  onFileRemove: () => void
  selectedFile: File | null
  accept?: string
  maxSize?: number // in MB
  className?: string
}

export function FileUploadZone({
  onFileSelect,
  onFileRemove,
  selectedFile,
  accept = ".pem,.key,.ppk",
  maxSize = 5,
  className,
}: FileUploadZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const validateFile = (file: File): string | null => {
    // Check file size
    if (file.size > maxSize * 1024 * 1024) {
      return `File size must be less than ${maxSize}MB`
    }

    // Check file type
    const allowedExtensions = accept.split(",").map((ext) => ext.trim().toLowerCase())
    const fileExtension = "." + file.name.split(".").pop()?.toLowerCase()

    if (!allowedExtensions.includes(fileExtension)) {
      return `File type not supported. Allowed: ${accept}`
    }

    return null
  }

  const handleFileSelect = useCallback(
    (file: File) => {
      const validationError = validateFile(file)
      if (validationError) {
        setError(validationError)
        return
      }

      setError(null)
      onFileSelect(file)
    },
    [onFileSelect, maxSize, accept],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)

      const files = Array.from(e.dataTransfer.files)
      if (files.length > 0) {
        handleFileSelect(files[0])
      }
    },
    [handleFileSelect],
  )

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (files && files.length > 0) {
        handleFileSelect(files[0])
      }
    },
    [handleFileSelect],
  )

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  return (
    <div className={cn("space-y-2", className)}>
      {!selectedFile ? (
        <div
          className={cn(
            "relative border-2 border-dashed rounded-lg p-6 transition-all duration-200",
            "hover:border-primary/50 hover:bg-muted/50",
            isDragOver ? "border-primary bg-primary/5 scale-105" : "border-muted-foreground/25",
            error ? "border-destructive bg-destructive/5" : "",
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            type="file"
            accept={accept}
            onChange={handleFileInputChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />

          <div className="flex flex-col items-center justify-center text-center space-y-3">
            <div
              className={cn(
                "rounded-full p-3 transition-colors duration-200",
                isDragOver ? "bg-primary/10" : "bg-muted/50",
              )}
            >
              <Upload
                className={cn(
                  "h-6 w-6 transition-colors duration-200",
                  isDragOver ? "text-primary" : "text-muted-foreground",
                )}
              />
            </div>

            <div className="space-y-1">
              <p className="text-sm font-medium">
                {isDragOver ? "Drop your file here" : "Drag & drop your SSH key file"}
              </p>
              <p className="text-xs text-muted-foreground">
                or click to browse ({accept.replace(/\./g, "").toUpperCase()} files, max {maxSize}MB)
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border">
          <div className="rounded-full p-2 bg-green-500/10">
            <Check className="h-4 w-4 text-green-500" />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{selectedFile.name}</p>
            <p className="text-xs text-muted-foreground">
              {formatFileSize(selectedFile.size)} • {selectedFile.type || "Unknown type"}
            </p>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={onFileRemove}
            className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 p-2 rounded border border-destructive/20">
          {error}
        </div>
      )}
    </div>
  )
}
