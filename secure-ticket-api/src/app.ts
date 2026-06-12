import crypto from "crypto";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { logEvents } from "./logger";
import { authMiddleware } from "./middleware/auth.middleware";
import { errorMiddleware, notFoundHandler } from "./middleware/error.middleware";
import { rateLimitMiddleware } from "./middleware/rateLimit.middleware";
import { AppError } from "./utils/AppError";
import { createAuthToken, tickets, validCredentials } from "./data";

export const createApp = () => {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json());

  app.use((req, res, next) => {
    const startedAt = Date.now();

    req.requestId = `req_${crypto.randomUUID()}`;
    res.setHeader("X-Request-Id", req.requestId);
    logEvents.requestReceived(req.requestId, req.method, req.originalUrl);

    res.once("finish", () => {
      logEvents.requestCompleted(
        req.requestId,
        req.method,
        req.originalUrl,
        res.statusCode,
        Date.now() - startedAt,
        req.user?.id
      );
    });

    next();
  });

  app.use(rateLimitMiddleware);

  app.get("/health", (_req, res) => {
    res.json({ success: true, message: "OK" });
  });

  app.post("/auth/login", (req, res, next) => {
    logEvents.controllerStarted(req.requestId, "AUTH_LOGIN", undefined, {
      email: req.body.email
    });
    const { email, password } = req.body;

    if (email === validCredentials.email && password === validCredentials.password) {
      const token = createAuthToken();
      logEvents.controllerSucceeded(req.requestId, "AUTH_LOGIN", 0, validCredentials.id);
      logEvents.userLoginSuccess(req.requestId, validCredentials.id);
      return res.json({ success: true, token });
    }

    logEvents.userLoginFailed(req.requestId, email);
    return next(new AppError("Invalid email or password", 401));
  });

  app.get("/tickets", authMiddleware, (_req, res) => {
    logEvents.controllerStarted(_req.requestId, "GET_TICKETS", _req.user?.id);
    res.json({ success: true, tickets });
    logEvents.controllerSucceeded(_req.requestId, "GET_TICKETS", 0, _req.user?.id);
  });

  app.post("/tickets", authMiddleware, (req, res, next) => {
    logEvents.controllerStarted(req.requestId, "CREATE_TICKET", req.user?.id, {
      title: req.body.title
    });

    const { title, description, system, severity } = req.body;

    if (!title || !description || !system || !severity) {
      logEvents.controllerFailed(req.requestId, "CREATE_TICKET", 0, new Error("Missing required fields"), req.user?.id);
      return next(new AppError("Missing required fields: title, description, system, severity", 400));
    }

    const validSeverities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
    if (!validSeverities.includes(severity)) {
      return next(new AppError(`Invalid severity. Must be one of: ${validSeverities.join(", ")}`, 400));
    }

    const ticketId = `INC-${Date.now().toString().slice(-5)}`;
    const newTicket = {
      id: ticketId,
      title,
      description,
      system,
      severity: severity as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
      status: "OPEN" as const,
      createdBy: req.user?.email || "System",
      assignedTo: "Unassigned",
      updatedAt: new Date().toISOString()
    };

    tickets.push(newTicket);
    logEvents.controllerSucceeded(req.requestId, "CREATE_TICKET", 0, req.user?.id);
    logEvents.ticketCreated(req.requestId, req.user?.id || "", ticketId);

    res.status(201).json({ success: true, ticket: newTicket });
  });

  app.patch("/tickets/:ticketId", authMiddleware, (req, res, next) => {
    const ticketIdParam = req.params.ticketId;
    const ticketId = Array.isArray(ticketIdParam) ? ticketIdParam[0] : ticketIdParam;
    const ticket = tickets.find((item) => item.id === ticketId);

    logEvents.controllerStarted(req.requestId, "UPDATE_TICKET", req.user?.id, {
      ticketId
    });

    if (!ticket) {
      return next(new AppError("Ticket not found", 404));
    }

    const { status, assignedTo } = req.body;
    const validStatuses = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];

    if (status !== undefined && !validStatuses.includes(status)) {
      return next(new AppError(`Invalid status. Must be one of: ${validStatuses.join(", ")}`, 400));
    }

    if (assignedTo !== undefined && (typeof assignedTo !== "string" || !assignedTo.trim())) {
      return next(new AppError("assignedTo must be a non-empty string", 400));
    }

    if (status === undefined && assignedTo === undefined) {
      return next(new AppError("Provide status or assignedTo to update the ticket", 400));
    }

    if (status !== undefined) {
      ticket.status = status as "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
    }

    if (assignedTo !== undefined) {
      ticket.assignedTo = assignedTo.trim();
    }

    ticket.updatedAt = new Date().toISOString();

    logEvents.controllerSucceeded(req.requestId, "UPDATE_TICKET", 0, req.user?.id, {
      ticketId
    });
    logEvents.ticketUpdated(req.requestId, req.user?.id || "", ticketId);

    res.json({ success: true, ticket });
  });

  app.delete("/tickets/:ticketId", authMiddleware, (req, res, next) => {
    const ticketIdParam = req.params.ticketId;
    const ticketId = Array.isArray(ticketIdParam) ? ticketIdParam[0] : ticketIdParam;
    const ticketIndex = tickets.findIndex((item) => item.id === ticketId);

    logEvents.controllerStarted(req.requestId, "DELETE_TICKET", req.user?.id, {
      ticketId
    });

    if (ticketIndex === -1) {
      return next(new AppError("Ticket not found", 404));
    }

    const [deletedTicket] = tickets.splice(ticketIndex, 1);

    logEvents.controllerSucceeded(req.requestId, "DELETE_TICKET", 0, req.user?.id, {
      ticketId
    });
    logEvents.ticketDeleted(req.requestId, req.user?.id || "", ticketId);

    res.json({ success: true, ticket: deletedTicket });
  });

  app.use(notFoundHandler);
  app.use(errorMiddleware);

  return app;
};

export const app = createApp();
