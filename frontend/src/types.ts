export type AppRole = "ADMIN" | "AGENT" | "VIEWER";
export interface AppUser { id: string; name: string; email: string; role: AppRole; customerId?: string | null; }
export interface TeamUser extends AppUser { isActive: boolean; createdAt: string; customer?: { id: string; name: string } | null; }
export interface CustomerOption { id: string; name: string; hasPortalAccount: boolean; }
export interface ServiceAssignment { id: string; serviceType: ServiceType; agentId: string; assignedById: string; agent: { id: string; name: string; email: string }; }
export type TripStatus = "NOT_SPECIFIED" | "UPCOMING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
export type BookingStatus = "UNKNOWN" | "TO_BE_DONE" | "IN_PROGRESS" | "COMPLETED" | "NOT_NEEDED" | "CANCELLED";
export type Handler = "UNASSIGNED" | "TRAVORA" | "SELF" | "MIXED";
export type RefundStatus = "NOT_APPLICABLE" | "UNKNOWN" | "PENDING" | "PARTIAL_REFUNDED" | "FULL_REFUNDED";
export type ServiceType = "FLIGHTS" | "STAYS" | "ACTIVITIES" | "TRANSFERS" | "FERRY" | "VISA" | "TOURIST_TAX" | "ARRIVAL_CARD" | "TRAVEL_INSURANCE";
export type SupportStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED";

export interface ServiceBooking {
  id: string; tripId: string; serviceType: ServiceType; itemName: string | null; bookingStatus: BookingStatus;
  handledBy: Handler; progressNote: string | null; notes: string | null; sourceStatusText: string | null;
  displayStatus: string; assignment?: ServiceAssignment | null;
}
export interface Trip {
  id: string; customerId: string; customer: { id: string; name: string; email?: string | null; phone?: string | null };
  destination: string; startDate: string; tripStatus: TripStatus; sourceStatusText: string | null; operationalNotes: string | null;
  refundStatus: RefundStatus; refundPercentage: number | null; refundAmount: string | null; refundNotes: string | null;
  updatedAt?: string; services: ServiceBooking[]; progress: { completed: number; total: number; percent: number };
}
export interface DashboardSummary {
  counts: { totalTrips: number; completedTrips: number; cancelledTrips: number; upcomingTrips: number; inProgressTrips: number; bookingNeedsAttention: number; refundsPending: number; partiallyRefunded: number; openSupportRequests?: number };
  byService: Array<{ serviceType: ServiceType; total: number; completed: number; inProgress: number; toBeDone: number; notNeeded: number }>;
  upcomingDepartures: Trip[];
  needingAttention: Array<{ id: string; tripId: string; customerName: string; destination: string; startDate: string; serviceType: ServiceType; itemName: string | null; bookingStatus: BookingStatus; handledBy: Handler; notes: string | null }>;
}
export interface BookingRow extends ServiceBooking { customerName: string; destination: string; startDate: string; tripId: string; }
export interface SupportRequest {
  id: string; customerId: string; requesterUserId: string; subject: string; message: string; status: SupportStatus;
  adminReply: string | null; respondedAt: string | null; createdAt: string; updatedAt: string;
  customer: { id: string; name: string }; requester: { id: string; name: string; email: string };
  trip?: { id: string; destination: string; startDate: string } | null;
  serviceBooking?: { id: string; serviceType: ServiceType; itemName: string | null } | null;
}
