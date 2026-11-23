import "dotenv/config";
import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import { Prisma, BookingStatus, Handler, RefundStatus, ServiceType, TripStatus, UserRole } from "@prisma/client";
import { z } from "zod";
import { authenticate, createSessionToken, hashPassword, requireRole, sessionUser, verifyPassword } from "./auth.js";
import { prisma } from "./db.js";

const app = express();
if ((process.env.AUTH_SECRET || "").length < 32) throw new Error("AUTH_SECRET must be at least 32 characters. Configure backend/.env before starting the API.");
const port = Number(process.env.PORT || 4000);
const allowedOrigin = process.env.CORS_ORIGIN || "http://localhost:5173";
app.use(cors({ origin: allowedOrigin.split(",").map((value) => value.trim()) }));
app.use(express.json({ limit: "1mb" }));

const serviceOrder: ServiceType[] = ["FLIGHTS", "STAYS", "ACTIVITIES", "TRANSFERS", "FERRY", "VISA", "TOURIST_TAX", "ARRIVAL_CARD", "TRAVEL_INSURANCE"];
const bookingStatusValues = ["UNKNOWN", "TO_BE_DONE", "IN_PROGRESS", "COMPLETED", "NOT_NEEDED", "CANCELLED"] as const;
const handlerValues = ["UNASSIGNED", "TRAVORA", "SELF", "MIXED"] as const;
const tripStatusValues = ["NOT_SPECIFIED", "UPCOMING", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;
const refundStatusValues = ["NOT_APPLICABLE", "UNKNOWN", "PENDING", "PARTIAL_REFUNDED", "FULL_REFUNDED"] as const;
const supportStatusValues = ["OPEN", "IN_PROGRESS", "RESOLVED"] as const;

const bookingUpdateSchema = z.object({
  bookingStatus: z.enum(bookingStatusValues).optional(), handledBy: z.enum(handlerValues).optional(),
  itemName: z.string().max(160).nullable().optional(), progressNote: z.string().max(250).nullable().optional(),
  notes: z.string().max(4000).nullable().optional(), sourceStatusText: z.string().max(250).nullable().optional(),
}).refine((value) => Object.keys(value).length > 0, { message: "Provide at least one field to update" });
const tripUpdateSchema = z.object({
  destination: z.string().min(1).max(160).optional(), startDate: z.string().datetime().optional(),
  tripStatus: z.enum(tripStatusValues).optional(), operationalNotes: z.string().max(8000).nullable().optional(),
  refundStatus: z.enum(refundStatusValues).optional(), refundPercentage: z.number().int().min(0).max(100).nullable().optional(),
  refundNotes: z.string().max(4000).nullable().optional(), sourceStatusText: z.string().max(250).nullable().optional(),
});
const createServiceSchema = z.object({ serviceType: z.enum(serviceOrder as [ServiceType, ...ServiceType[]]), itemName: z.string().max(160).nullable().optional() });
const createTripSchema = z.object({ customerName: z.string().min(1).max(160), destination: z.string().min(1).max(160), startDate: z.string().datetime(), operationalNotes: z.string().max(8000).optional() });

function statusLabel(status: BookingStatus, handler: Handler, progressNote?: string | null): string {
  if (status === "COMPLETED") { const owner = handler === "TRAVORA" ? "Travora" : handler === "SELF" ? "Self" : handler === "MIXED" ? "Mix" : ""; return owner ? `${owner} Completed` : "Completed"; }
  if (status === "IN_PROGRESS") return progressNote ? `In Progress (${progressNote})` : "In Progress";
  if (status === "TO_BE_DONE") return "To Be Done";
  if (status === "NOT_NEEDED") return "Not Needed";
  if (status === "CANCELLED") return "Cancelled";
  return "Not Specified";
}
function tripProgress(services: Array<{ bookingStatus: BookingStatus }>) {
  const required = services.filter((service) => service.bookingStatus !== "NOT_NEEDED");
  const completed = required.filter((service) => service.bookingStatus === "COMPLETED").length;
  return { completed, total: required.length, percent: required.length ? Math.round((completed / required.length) * 100) : 100 };
}
type AssignmentView = { id: string; serviceType: ServiceType; agentId: string; agent: { id: string; name: string; email: string } };
async function assignmentMap() {
  const rows = await prisma.serviceTypeAssignment.findMany({ include: { agent: { select: { id: true, name: true, email: true } } } });
  return new Map<ServiceType, AssignmentView>(rows.map((row) => [row.serviceType, row]));
}
function withDerived<T extends { services: Array<{ serviceType: ServiceType; bookingStatus: BookingStatus; handledBy: Handler; progressNote: string | null }> }>(trip: T, assignments: Map<ServiceType, AssignmentView>) {
  const services = trip.services.map((service) => ({ ...service, assignment: assignments.get(service.serviceType) ?? null, displayStatus: statusLabel(service.bookingStatus, service.handledBy, service.progressNote) }));
  return { ...trip, services, progress: tripProgress(services) };
}
async function getScope(userId: string, role: UserRole) {
  if (role === "ADMIN") return { customerId: null as string | null, serviceTypes: serviceOrder };
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { customerId: true, assignedServiceTypes: { select: { serviceType: true } } } });
  return { customerId: user?.customerId ?? null, serviceTypes: user?.assignedServiceTypes.map((item) => item.serviceType) ?? [] };
}
function tripWhereFor(role: UserRole, scope: { customerId: string | null; serviceTypes: ServiceType[] }): Prisma.TripWhereInput {
  if (role === "VIEWER") return scope.customerId ? { customerId: scope.customerId } : { id: "__no_customer_link__" };
  if (role === "AGENT") return scope.serviceTypes.length ? { services: { some: { serviceType: { in: scope.serviceTypes } } } } : { id: "__no_assigned_service__" };
  return {};
}
function tripIncludeFor(role: UserRole, scope: { serviceTypes: ServiceType[] }) {
  return { customer: true, services: { where: role === "AGENT" ? { serviceType: { in: scope.serviceTypes } } : undefined, orderBy: { serviceType: "asc" as const } } };
}

app.get("/api/health", async (_req, res) => {
  try { await prisma.$queryRaw`SELECT 1`; return res.json({ ok: true, service: "travora-api", database: "connected" }); }
  catch { return res.status(503).json({ ok: false, service: "travora-api", database: "unavailable" }); }
});
app.post("/api/auth/login", async (req, res, next) => {
  try {
    const parsed = z.object({ email: z.string().email().max(254), password: z.string().min(1).max(200) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Enter a valid email and password" });
    const email = parsed.data.email.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive || !(await verifyPassword(parsed.data.password, user.passwordHash))) return res.status(401).json({ error: "Incorrect email or password" });
    if (user.role === "VIEWER" && !user.customerId) return res.status(403).json({ error: "This customer account is not linked to a customer profile. Contact Travora support." });
    const publicUser = { id: user.id, name: user.name, email: user.email, role: user.role, customerId: user.customerId };
    return res.json({ token: createSessionToken(publicUser), user: publicUser });
  } catch (error) { return next(error); }
});
app.get("/api/auth/me", authenticate, async (req, res, next) => {
  try {
    const session = sessionUser(req);
    const user = await prisma.user.findUnique({ where: { id: session.id }, select: { id: true, name: true, email: true, role: true, customerId: true, isActive: true } });
    if (!user?.isActive) return res.status(401).json({ error: "Account is inactive" });
    return res.json(user);
  } catch (error) { return next(error); }
});
app.use("/api", authenticate);

app.get("/api/users", requireRole("ADMIN"), async (_req, res, next) => {
  try {
    const users = await prisma.user.findMany({ where: { role: { in: ["AGENT", "VIEWER"] } }, orderBy: [{ role: "asc" }, { name: "asc" }], select: { id: true, name: true, email: true, role: true, isActive: true, customerId: true, customer: { select: { id: true, name: true } }, createdAt: true } });
    return res.json(users);
  } catch (error) { return next(error); }
});
app.get("/api/customers", requireRole("ADMIN"), async (_req, res, next) => {
  try {
    const customers = await prisma.customer.findMany({ orderBy: { name: "asc" }, include: { portalAccount: { select: { id: true, email: true } } } });
    return res.json(customers.map((customer) => ({ id: customer.id, name: customer.name, hasPortalAccount: Boolean(customer.portalAccount) })));
  } catch (error) { return next(error); }
});
app.post("/api/users", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const parsed = z.object({ name: z.string().min(1).max(120), email: z.string().email().max(254), password: z.string().min(10).max(200), role: z.enum(["AGENT", "VIEWER"]), customerId: z.string().optional() }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Enter a name, email, password (10+ characters), role and select a customer for Viewer accounts" });
    const input = parsed.data;
    if (input.role === "VIEWER" && !input.customerId) return res.status(400).json({ error: "Select the customer profile this viewer account belongs to" });
    if (input.role === "AGENT" && input.customerId) return res.status(400).json({ error: "Agent accounts cannot be linked to a customer profile" });
    if (input.customerId) {
      const customer = await prisma.customer.findUnique({ where: { id: input.customerId }, include: { portalAccount: true } });
      if (!customer) return res.status(404).json({ error: "Customer not found" });
      if (customer.portalAccount) return res.status(409).json({ error: "This customer already has a portal login" });
    }
    const user = await prisma.user.create({ data: { name: input.name.trim(), email: input.email.trim().toLowerCase(), passwordHash: await hashPassword(input.password), role: input.role, customerId: input.role === "VIEWER" ? input.customerId : null }, select: { id: true, name: true, email: true, role: true, isActive: true, customerId: true, createdAt: true } });
    return res.status(201).json(user);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return res.status(409).json({ error: "An account with this email or customer profile already exists" });
    return next(error);
  }
});

app.get("/api/service-assignments", requireRole("ADMIN"), async (_req, res, next) => {
  try {
    const rows = await prisma.serviceTypeAssignment.findMany({ include: { agent: { select: { id: true, name: true, email: true } } }, orderBy: { serviceType: "asc" } });
    return res.json(rows);
  } catch (error) { return next(error); }
});
app.put("/api/service-assignments/:serviceType", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const serviceType = req.params.serviceType as ServiceType;
    if (!serviceOrder.includes(serviceType)) return res.status(400).json({ error: "Invalid service category" });
    const parsed = z.object({ agentId: z.string().min(1) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Select an agent" });
    const agent = await prisma.user.findUnique({ where: { id: parsed.data.agentId } });
    if (!agent || agent.role !== "AGENT" || !agent.isActive) return res.status(400).json({ error: "Select an active agent account" });
    const admin = sessionUser(req);
    const assignment = await prisma.serviceTypeAssignment.upsert({ where: { serviceType }, create: { serviceType, agentId: agent.id, assignedById: admin.id }, update: { agentId: agent.id, assignedById: admin.id }, include: { agent: { select: { id: true, name: true, email: true } } } });
    return res.json(assignment);
  } catch (error) { return next(error); }
});
app.delete("/api/service-assignments/:serviceType", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const serviceType = req.params.serviceType as ServiceType;
    if (!serviceOrder.includes(serviceType)) return res.status(400).json({ error: "Invalid service category" });
    await prisma.serviceTypeAssignment.deleteMany({ where: { serviceType } });
    return res.status(204).send();
  } catch (error) { return next(error); }
});

app.get("/api/dashboard/summary", async (req, res, next) => {
  try {
    const user = sessionUser(req);
    const scope = await getScope(user.id, user.role);
    const trips = await prisma.trip.findMany({ where: tripWhereFor(user.role, scope), include: { customer: true, services: user.role === "AGENT" ? { where: { serviceType: { in: scope.serviceTypes } } } : true } });
    const bookings = trips.flatMap((trip) => trip.services);
    const byService = serviceOrder.filter((serviceType) => user.role !== "AGENT" || scope.serviceTypes.includes(serviceType)).map((serviceType) => {
      const records = bookings.filter((booking) => booking.serviceType === serviceType);
      return { serviceType, total: records.length, completed: records.filter((record) => record.bookingStatus === "COMPLETED").length, inProgress: records.filter((record) => record.bookingStatus === "IN_PROGRESS").length, toBeDone: records.filter((record) => record.bookingStatus === "TO_BE_DONE").length, notNeeded: records.filter((record) => record.bookingStatus === "NOT_NEEDED").length };
    });
    const indiaToday = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
    const today = new Date(`${indiaToday}T00:00:00.000Z`);
    const futureTrips = trips.filter((trip) => trip.startDate >= today && trip.tripStatus !== "COMPLETED" && trip.tripStatus !== "CANCELLED");
    const assignments = await assignmentMap();
    const upcomingDepartures = futureTrips.sort((a, b) => a.startDate.getTime() - b.startDate.getTime()).slice(0, 6).map((trip) => withDerived(trip, assignments));
    const activeTrips = trips.filter((trip) => trip.tripStatus !== "COMPLETED" && trip.tripStatus !== "CANCELLED");
    const needingAttention = activeTrips.flatMap((trip) => trip.services.filter((service) => ["TO_BE_DONE", "IN_PROGRESS", "UNKNOWN"].includes(service.bookingStatus)).map((service) => ({ id: service.id, tripId: trip.id, customerName: trip.customer.name, destination: trip.destination, startDate: trip.startDate, serviceType: service.serviceType, itemName: service.itemName, bookingStatus: service.bookingStatus, handledBy: service.handledBy, notes: service.notes }))).sort((a, b) => a.startDate.getTime() - b.startDate.getTime()).slice(0, 10);
    const openSupportRequests = user.role === "ADMIN" ? await prisma.supportRequest.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } } }) : 0;
    return res.json({ counts: { totalTrips: trips.length, completedTrips: trips.filter((trip) => trip.tripStatus === "COMPLETED").length, cancelledTrips: trips.filter((trip) => trip.tripStatus === "CANCELLED").length, upcomingTrips: futureTrips.length, inProgressTrips: trips.filter((trip) => trip.tripStatus === "IN_PROGRESS").length, bookingNeedsAttention: activeTrips.flatMap((trip) => trip.services).filter((booking) => ["TO_BE_DONE", "IN_PROGRESS", "UNKNOWN"].includes(booking.bookingStatus)).length, refundsPending: trips.filter((trip) => trip.refundStatus === "PENDING").length, partiallyRefunded: trips.filter((trip) => trip.refundStatus === "PARTIAL_REFUNDED").length, openSupportRequests }, byService, upcomingDepartures, needingAttention });
  } catch (error) { next(error); }
});

app.get("/api/trips", async (req, res, next) => {
  try {
    const user = sessionUser(req); const scope = await getScope(user.id, user.role);
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const status = typeof req.query.status === "string" ? req.query.status : "";
    const destination = typeof req.query.destination === "string" ? req.query.destination.trim() : "";
    const where: Prisma.TripWhereInput = { AND: [tripWhereFor(user.role, scope)] };
    if (status && tripStatusValues.includes(status as typeof tripStatusValues[number])) where.tripStatus = status as TripStatus;
    if (destination) where.destination = { contains: destination, mode: "insensitive" };
    if (search) where.OR = [{ customer: { name: { contains: search, mode: "insensitive" } } }, { destination: { contains: search, mode: "insensitive" } }, { operationalNotes: { contains: search, mode: "insensitive" } }];
    const trips = await prisma.trip.findMany({ where, include: tripIncludeFor(user.role, scope), orderBy: { startDate: "asc" } });
    const assignments = await assignmentMap();
    return res.json(trips.map((trip) => withDerived(trip, assignments)));
  } catch (error) { return next(error); }
});
app.get("/api/trips/:id", async (req, res, next) => {
  try {
    const user = sessionUser(req); const scope = await getScope(user.id, user.role);
    const trip = await prisma.trip.findFirst({ where: { id: req.params.id, AND: [tripWhereFor(user.role, scope)] }, include: tripIncludeFor(user.role, scope) });
    if (!trip) return res.status(404).json({ error: "Trip not found" });
    const assignments = await assignmentMap();
    return res.json(withDerived(trip, assignments));
  } catch (error) { return next(error); }
});
app.post("/api/trips", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const parsed = createTripSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid trip details", details: parsed.error.flatten() });
    const input = parsed.data;
    const trip = await prisma.trip.create({ data: { customer: { create: { name: input.customerName } }, destination: input.destination, startDate: new Date(input.startDate), operationalNotes: input.operationalNotes ?? null, tripStatus: "NOT_SPECIFIED", services: { create: serviceOrder.map((serviceType) => ({ serviceType, bookingStatus: "UNKNOWN", handledBy: "UNASSIGNED" })) } }, include: { customer: true, services: true } });
    return res.status(201).json(withDerived(trip, await assignmentMap()));
  } catch (error) { return next(error); }
});
app.patch("/api/trips/:id", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const parsed = tripUpdateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid trip update", details: parsed.error.flatten() });
    const { startDate, ...tripFields } = parsed.data;
    const trip = await prisma.trip.update({ where: { id: req.params.id }, data: { ...tripFields, ...(startDate ? { startDate: new Date(startDate) } : {}) }, include: tripIncludeFor("ADMIN", { serviceTypes: serviceOrder }) });
    return res.json(withDerived(trip, await assignmentMap()));
  } catch (error) { return next(error); }
});
app.post("/api/trips/:id/services", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const parsed = createServiceSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid service details", details: parsed.error.flatten() });
    const trip = await prisma.trip.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!trip) return res.status(404).json({ error: "Trip not found" });
    const service = await prisma.serviceBooking.create({ data: { tripId: trip.id, serviceType: parsed.data.serviceType, itemName: parsed.data.itemName ?? null, bookingStatus: "UNKNOWN", handledBy: "UNASSIGNED" } });
    return res.status(201).json({ ...service, assignment: null, displayStatus: "Not Specified" });
  } catch (error) { return next(error); }
});
app.patch("/api/services/:id", async (req, res, next) => {
  try {
    const user = sessionUser(req);
    if (user.role === "VIEWER") return res.status(403).json({ error: "Customer accounts are read-only" });
    const parsed = bookingUpdateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid booking update", details: parsed.error.flatten() });
    const input = parsed.data;
    const existing = await prisma.serviceBooking.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Booking not found" });
    if (user.role === "AGENT") {
      const assignment = await prisma.serviceTypeAssignment.findUnique({ where: { serviceType: existing.serviceType } });
      if (!assignment || assignment.agentId !== user.id) return res.status(403).json({ error: "You can only update bookings for service categories assigned to you" });
      if (input.handledBy !== undefined || input.sourceStatusText !== undefined) return res.status(403).json({ error: "Agents cannot change booking ownership or imported source text" });
    }
    const nextStatus = input.bookingStatus ?? existing.bookingStatus; const nextHandler = input.handledBy ?? existing.handledBy;
    const nextProgress = input.progressNote === undefined ? existing.progressNote : input.progressNote;
    const service = await prisma.serviceBooking.update({ where: { id: req.params.id }, data: { ...(input.bookingStatus !== undefined ? { bookingStatus: input.bookingStatus } : {}), ...(user.role === "ADMIN" && input.handledBy !== undefined ? { handledBy: input.handledBy } : {}), ...(input.itemName !== undefined ? { itemName: input.itemName } : {}), ...(input.progressNote !== undefined ? { progressNote: input.progressNote } : {}), ...(input.notes !== undefined ? { notes: input.notes } : {}), ...(user.role === "ADMIN" && input.sourceStatusText !== undefined ? { sourceStatusText: input.sourceStatusText } : {}) } });
    const assignments = await assignmentMap();
    return res.json({ ...service, assignment: assignments.get(service.serviceType) ?? null, displayStatus: statusLabel(nextStatus, nextHandler, nextProgress) });
  } catch (error) { return next(error); }
});
app.get("/api/bookings", async (req, res, next) => {
  try {
    const user = sessionUser(req); const scope = await getScope(user.id, user.role);
    const status = typeof req.query.status === "string" ? req.query.status : "";
    const serviceType = typeof req.query.serviceType === "string" ? req.query.serviceType : "";
    const handledBy = typeof req.query.handledBy === "string" ? req.query.handledBy : "";
    const where: Prisma.ServiceBookingWhereInput = { trip: user.role === "VIEWER" ? { customerId: scope.customerId ?? "__no_customer_link__" } : undefined };
    if (user.role === "AGENT") where.serviceType = { in: scope.serviceTypes };
    if (status && bookingStatusValues.includes(status as typeof bookingStatusValues[number])) where.bookingStatus = status as BookingStatus;
    if (serviceOrder.includes(serviceType as ServiceType)) where.serviceType = user.role === "AGENT" ? { in: scope.serviceTypes.filter((type) => type === serviceType) } : serviceType as ServiceType;
    if (handledBy && handlerValues.includes(handledBy as typeof handlerValues[number])) where.handledBy = handledBy as Handler;
    const [bookings, assignments] = await Promise.all([prisma.serviceBooking.findMany({ where, include: { trip: { include: { customer: true } } }, orderBy: [{ trip: { startDate: "asc" } }, { serviceType: "asc" }] }), assignmentMap()]);
    return res.json(bookings.map((booking) => ({ ...booking, assignment: assignments.get(booking.serviceType) ?? null, customerName: booking.trip.customer.name, destination: booking.trip.destination, startDate: booking.trip.startDate, tripId: booking.tripId, displayStatus: statusLabel(booking.bookingStatus, booking.handledBy, booking.progressNote) })));
  } catch (error) { return next(error); }
});

// Customer Service: viewer accounts can create and see only their own requests.
app.get("/api/support", async (req, res, next) => {
  try {
    const user = sessionUser(req);
    if (user.role === "AGENT") return res.status(403).json({ error: "Customer service is available to customer and admin accounts" });
    const where = user.role === "ADMIN" ? {} : { requesterUserId: user.id };
    const requests = await prisma.supportRequest.findMany({ where, include: { customer: { select: { id: true, name: true } }, requester: { select: { id: true, name: true, email: true } }, trip: { select: { id: true, destination: true, startDate: true } }, serviceBooking: { select: { id: true, serviceType: true, itemName: true } } }, orderBy: { createdAt: "desc" } });
    return res.json(requests);
  } catch (error) { return next(error); }
});
app.post("/api/support", requireRole("VIEWER"), async (req, res, next) => {
  try {
    const parsed = z.object({ subject: z.string().min(3).max(160), message: z.string().min(5).max(5000), tripId: z.string().optional(), serviceBookingId: z.string().optional() }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Enter a subject and message" });
    const user = sessionUser(req); const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { customerId: true } });
    if (!dbUser?.customerId) return res.status(403).json({ error: "Your account is not linked to a customer profile" });
    let tripId = parsed.data.tripId ?? null;
    if (parsed.data.serviceBookingId) {
      const service = await prisma.serviceBooking.findFirst({ where: { id: parsed.data.serviceBookingId, trip: { customerId: dbUser.customerId } }, select: { id: true, tripId: true } });
      if (!service) return res.status(404).json({ error: "Selected service was not found in your trips" });
      tripId = service.tripId;
    }
    if (tripId) {
      const trip = await prisma.trip.findFirst({ where: { id: tripId, customerId: dbUser.customerId }, select: { id: true } });
      if (!trip) return res.status(404).json({ error: "Selected trip was not found in your account" });
    }
    const created = await prisma.supportRequest.create({ data: { customerId: dbUser.customerId, requesterUserId: user.id, subject: parsed.data.subject, message: parsed.data.message, tripId, serviceBookingId: parsed.data.serviceBookingId ?? null } });
    return res.status(201).json(created);
  } catch (error) { return next(error); }
});
app.patch("/api/support/:id", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const parsed = z.object({ status: z.enum(supportStatusValues).optional(), adminReply: z.string().max(5000).nullable().optional() }).refine((value) => Object.keys(value).length > 0).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Enter a valid response or request status" });
    const data = { ...parsed.data, ...(parsed.data.adminReply !== undefined && parsed.data.adminReply !== null ? { respondedAt: new Date() } : {}) };
    const updated = await prisma.supportRequest.update({ where: { id: req.params.id }, data, include: { customer: { select: { id: true, name: true } }, requester: { select: { id: true, name: true, email: true } }, trip: { select: { id: true, destination: true, startDate: true } }, serviceBooking: { select: { id: true, serviceType: true, itemName: true } } } });
    return res.json(updated);
  } catch (error) { return next(error); }
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(error);
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return res.status(404).json({ error: "Record not found" });
  return res.status(500).json({ error: "Something went wrong while processing the request" });
});
const server = app.listen(port, () => console.log(`Travora API listening on http://localhost:${port}`));
async function shutdown() { server.close(); await prisma.$disconnect(); }
process.on("SIGINT", shutdown); process.on("SIGTERM", shutdown);
