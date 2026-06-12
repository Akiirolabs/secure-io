import pino from "pino";
import { config } from "./config";

type AuditLogInput = {
  requestId?: string;
  userId?: string;
  action: string;
  status: "success" | "failed";
  metadata?: Record<string, unknown>;
};

export const logger = pino({
  level: config.isTest ? "silent" : config.logLevel,
  base: {
    service: "secure-ticket-api"
  },
  formatters: {
    level: (label) => ({ level: label })
  },
  timestamp: pino.stdTimeFunctions.isoTime
});

export const auditLog = ({
  requestId,
  userId,
  action,
  status,
  metadata
}: AuditLogInput) => {
  logger.info(
    {
      requestId,
      userId,
      action,
      status,
      ...metadata
    },
    "Audit event"
  );
};

export const logEvents = {
  appStarted: (port: number) => logger.info({ port }, "App started"),
  requestReceived: (requestId: string, method: string, path: string) =>
    logger.info({ requestId, method, path }, "Request received"),
  requestCompleted: (
    requestId: string,
    method: string,
    path: string,
    statusCode: number,
    durationMs: number,
    userId?: string
  ) =>
    logger.info(
      { requestId, method, path, statusCode, durationMs, userId },
      "Request completed"
    ),
  controllerStarted: (
    requestId: string,
    action: string,
    userId?: string,
    metadata?: Record<string, unknown>
  ) =>
    logger.info(
      { requestId, action, userId, ...metadata },
      "Controller started"
    ),
  controllerSucceeded: (
    requestId: string,
    action: string,
    durationMs: number,
    userId?: string,
    metadata?: Record<string, unknown>
  ) =>
    logger.info(
      { requestId, action, durationMs, userId, ...metadata },
      "Controller succeeded"
    ),
  controllerFailed: (
    requestId: string,
    action: string,
    durationMs: number,
    error: unknown,
    userId?: string
  ) =>
    logger.error(
      { requestId, action, durationMs, error, userId },
      "Controller failed"
    ),
  userLoginSuccess: (requestId: string, userId: string) =>
    auditLog({ requestId, userId, action: "USER_LOGIN", status: "success" }),
  userLoginFailed: (requestId: string, email?: string) =>
    auditLog({
      requestId,
      action: "USER_LOGIN",
      status: "failed",
      metadata: { email }
    }),
  ticketCreated: (requestId: string, userId: string, ticketId: string) =>
    auditLog({
      requestId,
      userId,
      action: "CREATE_TICKET",
      status: "success",
      metadata: { ticketId }
    }),
  ticketUpdated: (requestId: string, userId: string, ticketId: string) =>
    auditLog({
      requestId,
      userId,
      action: "UPDATE_TICKET",
      status: "success",
      metadata: { ticketId }
    }),
  ticketDeleted: (requestId: string, userId: string, ticketId: string) =>
    auditLog({
      requestId,
      userId,
      action: "DELETE_TICKET",
      status: "success",
      metadata: { ticketId }
    }),
  permissionDenied: (requestId: string, userId?: string, path?: string) =>
    logger.warn({ requestId, userId, path }, "Permission denied"),
  validationFailed: (
    requestId: string,
    issues: unknown,
    path?: string
  ) => logger.warn({ requestId, issues, path }, "Validation failed"),
  databaseError: (requestId: string, error: unknown) =>
    logger.error({ requestId, error }, "Database error"),
  unhandledServerError: (requestId: string, error: unknown) =>
    logger.error({ requestId, error }, "Unhandled server error")
};
