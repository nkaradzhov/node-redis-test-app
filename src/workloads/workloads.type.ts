export const WorkloadRunnerState = {
    Connecting: "connecting",
    Running: "running",
    Completed: "completed",
    Error: "error",
    Stopped: "stopped"
} as const;

export type WorkloadRunnerState = (typeof WorkloadRunnerState)[keyof typeof WorkloadRunnerState];
