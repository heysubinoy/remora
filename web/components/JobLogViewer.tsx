import React, { useEffect, useRef } from "react";
import { useJobStream } from "../hooks/useJobStream";

interface Props {
  jobId: string;
}

export const JobLogViewer: React.FC<Props> = ({ jobId }) => {
  const { status, logs, errors, isComplete } = useJobStream(jobId);

  const stdoutRef = useRef<HTMLDivElement>(null);
  const stderrRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when logs update
  useEffect(() => {
    stdoutRef.current?.scrollTo(0, stdoutRef.current.scrollHeight);
  }, [logs]);

  useEffect(() => {
    stderrRef.current?.scrollTo(0, stderrRef.current.scrollHeight);
  }, [errors]);

  return (
    <div className="space-y-4 text-sm">
      {status ? (
        <div className="space-y-1 text-gray-700">
          <p>
            <strong>Status:</strong> {status.status}
          </p>
          <p>
            <strong>Command:</strong>{" "}
            <code>
              {status.command} {status.args}
            </code>
          </p>
          {status.started_at && (
            <p>
              <strong>Started:</strong>{" "}
              {(() => {
                const startDate = new Date(status.started_at);
                return (
                  <>
                    <span title="UTC Time">{startDate.toUTCString()}</span>
                    <br />
                    <span title="Local Time">{startDate.toLocaleString()}</span>
                  </>
                );
              })()}
            </p>
          )}
          {status.finished_at && (
            <p>
              <strong>Finished:</strong>{" "}
              {(() => {
                const finishDate = new Date(status.finished_at);
                return (
                  <>
                    <span title="UTC Time">{finishDate.toUTCString()}</span>
                    <br />
                    <span title="Local Time">
                      {finishDate.toLocaleString()}
                    </span>
                  </>
                );
              })()}
            </p>
          )}
          {status.duration && (
            <p>
              <strong>Duration:</strong> {status.duration}
            </p>
          )}
        </div>
      ) : (
        <p className="text-gray-500">Fetching job details...</p>
      )}

      <div className="grid grid-cols-2 gap-4 font-mono text-xs">
        <div
          className="bg-gray-100 p-3 rounded-lg overflow-auto max-h-64 border"
          ref={stdoutRef}
        >
          <h4 className="font-semibold mb-2 text-gray-700">STDOUT</h4>
          {logs.length > 0 ? (
            logs.map((line, i) => (
              <pre key={i} className="whitespace-pre-wrap">
                {line}
              </pre>
            ))
          ) : (
            <p className="text-gray-400">No output yet.</p>
          )}
        </div>

        <div
          className="bg-red-100 p-3 rounded-lg overflow-auto max-h-64 border"
          ref={stderrRef}
        >
          <h4 className="font-semibold mb-2 text-gray-700">STDERR</h4>
          {errors.length > 0 ? (
            errors.map((line, i) => (
              <pre key={i} className="whitespace-pre-wrap">
                {line}
              </pre>
            ))
          ) : (
            <p className="text-gray-400">No errors.</p>
          )}
        </div>
      </div>

      {isComplete && (
        <div className="text-green-600 font-medium">Job completed.</div>
      )}
    </div>
  );
};
