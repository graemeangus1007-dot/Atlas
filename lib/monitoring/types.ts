export type MonitoringLevel = "fatal" | "error" | "warning" | "info" | "debug";

export type MonitoringUserContext = {
  id?: string | null;
  email?: string | null;
};

export type MonitoringProjectContext = {
  projectId?: string | null;
  formId?: string | null;
};

export type MonitoringRequestContext = {
  requestId?: string | null;
  method?: string | null;
  path?: string | null;
  statusCode?: number | null;
};

export type MonitoringContext = {
  request?: MonitoringRequestContext;
  user?: MonitoringUserContext;
  project?: MonitoringProjectContext;
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
};

export type CaptureExceptionInput = {
  error: unknown;
  context?: MonitoringContext;
  level?: MonitoringLevel;
};

export type CaptureMessageInput = {
  message: string;
  context?: MonitoringContext;
  level?: MonitoringLevel;
};

export type MonitoringProvider = {
  readonly name: string;
  captureException(input: CaptureExceptionInput): void;
  captureMessage(input: CaptureMessageInput): void;
};
