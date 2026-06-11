export type TicketSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type TicketStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";

export type Ticket = {
  id: string;
  title: string;
  description: string;
  system: string;
  severity: TicketSeverity;
  status: TicketStatus;
  createdBy: string;
  assignedTo: string;
  updatedAt: string;
};

export type CreateTicketInput = Pick<
  Ticket,
  "title" | "description" | "system" | "severity"
>;

export type UpdateTicketInput = Partial<Pick<Ticket, "status" | "assignedTo">>;
