import request from "supertest";
import jwt from "jsonwebtoken";
import { app } from "./app";
import { config } from "./config";
import { createAuthToken, validCredentials, tickets } from "./data";

describe("API routes", () => {
  it("should return health status", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, message: "OK" });
  });

  it("should return an auth token for valid credentials", async () => {
    const response = await request(app)
      .post("/auth/login")
      .send({ email: validCredentials.email, password: validCredentials.password });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(typeof response.body.token).toBe("string");

    const decoded = jwt.verify(response.body.token, config.jwt.secret) as {
      id: string;
      email: string;
      role: string;
    };

    expect(decoded.email).toBe(validCredentials.email);
    expect(decoded.role).toBe(validCredentials.role);
  });

  it("should reject invalid login credentials", async () => {
    const response = await request(app)
      .post("/auth/login")
      .send({ email: "bad@example.com", password: "wrong" });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Invalid email or password");
  });

  it("should require authorization for tickets", async () => {
    const response = await request(app).get("/tickets");

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Missing authorization token");
  });

  it("should return tickets when authorized", async () => {
    const token = createAuthToken();
    const response = await request(app)
      .get("/tickets")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.tickets).toEqual(tickets);
  });

  it("should create a ticket when authorized", async () => {
    const token = createAuthToken();
    const originalLength = tickets.length;

    const response = await request(app)
      .post("/tickets")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Customer portal unavailable",
        description: "Users receive gateway errors when opening the portal.",
        system: "Customer Portal",
        severity: "HIGH"
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.ticket).toMatchObject({
      title: "Customer portal unavailable",
      system: "Customer Portal",
      severity: "HIGH",
      status: "OPEN",
      assignedTo: "Unassigned"
    });
    expect(tickets).toHaveLength(originalLength + 1);

    tickets.pop();
  });

  it("should update ticket status and assignment when authorized", async () => {
    const token = createAuthToken();
    const ticket = tickets[0];
    const originalStatus = ticket.status;
    const originalAssignee = ticket.assignedTo;
    const originalUpdatedAt = ticket.updatedAt;

    const response = await request(app)
      .patch(`/tickets/${ticket.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "IN_PROGRESS", assignedTo: "Platform Operations" });

    expect(response.status).toBe(200);
    expect(response.body.ticket).toMatchObject({
      id: ticket.id,
      status: "IN_PROGRESS",
      assignedTo: "Platform Operations"
    });

    ticket.status = originalStatus;
    ticket.assignedTo = originalAssignee;
    ticket.updatedAt = originalUpdatedAt;
  });

  it("should reject unsupported ticket status values", async () => {
    const token = createAuthToken();
    const response = await request(app)
      .patch(`/tickets/${tickets[0].id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "WAITING_FOREVER" });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("Invalid status");
  });

  it("should delete a ticket when authorized", async () => {
    const token = createAuthToken();
    const ticket = {
      ...tickets[0],
      id: "INC-DELETE-TEST",
      title: "Temporary deletion test ticket"
    };
    tickets.push(ticket);

    const response = await request(app)
      .delete(`/tickets/${ticket.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, ticket });
    expect(tickets.some((item) => item.id === ticket.id)).toBe(false);
  });

  it("should return 404 when deleting an unknown ticket", async () => {
    const token = createAuthToken();
    const response = await request(app)
      .delete("/tickets/INC-DOES-NOT-EXIST")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(404);
    expect(response.body.message).toBe("Ticket not found");
  });
});
