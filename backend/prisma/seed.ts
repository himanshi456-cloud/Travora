import "dotenv/config";
import { PrismaClient, type BookingStatus, type Handler, type RefundStatus, type ServiceType, type TripStatus } from "@prisma/client";

const prisma = new PrismaClient();

const serviceOrder: ServiceType[] = [
  "FLIGHTS", "STAYS", "ACTIVITIES", "TRANSFERS", "FERRY", "VISA", "TOURIST_TAX", "ARRIVAL_CARD", "TRAVEL_INSURANCE",
];

type ServiceSeed = {
  itemName: string;
  bookingStatus: BookingStatus;
  handledBy: Handler;
  progressNote?: string;
  notes?: string;
};
type TripSeed = {
  id: string;
  customerId: string;
  name: string;
  email: string;
  destination: string;
  date: string;
  tripStatus: TripStatus;
  operationalNotes?: string;
  refundStatus?: RefundStatus;
  refundPercentage?: number;
  refundNotes?: string;
};

const trips: TripSeed[] = [
  { id: "travora-trip-001", customerId: "travora-customer-001", name: "Aanya Mehta", email: "aanya.mehta@example.com", destination: "Bali, Indonesia", date: "2026-10-02", tripStatus: "COMPLETED", operationalNotes: "Five-night leisure itinerary completed. Airport transfer and Ubud day tour closed." },
  { id: "travora-trip-002", customerId: "travora-customer-002", name: "Rohan Khanna", email: "rohan.khanna@example.com", destination: "Singapore & Malaysia", date: "2026-10-09", tripStatus: "COMPLETED", operationalNotes: "Singapore city stay followed by Kuala Lumpur. All travel documents shared." },
  { id: "travora-trip-003", customerId: "travora-customer-003", name: "Kavya Nair", email: "kavya.nair@example.com", destination: "Dubai, UAE", date: "2026-10-18", tripStatus: "COMPLETED", operationalNotes: "Family itinerary completed. Desert safari and marina transfer confirmed." },
  { id: "travora-trip-004", customerId: "travora-customer-004", name: "Arjun Batra", email: "arjun.batra@example.com", destination: "Phuket, Thailand", date: "2026-10-24", tripStatus: "COMPLETED", operationalNotes: "Beach stay and island excursion completed. Final supplier confirmations archived." },
  { id: "travora-trip-005", customerId: "travora-customer-005", name: "Meera Iyer", email: "meera.iyer@example.com", destination: "Vietnam", date: "2026-11-04", tripStatus: "COMPLETED", operationalNotes: "Hanoi and Ha Long Bay itinerary completed. Customer feedback received." },
  { id: "travora-trip-006", customerId: "travora-customer-006", name: "Ishaan Verma", email: "ishaan.verma@example.com", destination: "Jaipur, India", date: "2026-11-23", tripStatus: "IN_PROGRESS", operationalNotes: "Three-day heritage break is underway. Confirm the Amber Fort visit and return transfer." },
  { id: "travora-trip-007", customerId: "travora-customer-007", name: "Saanvi Rao", email: "saanvi.rao@example.com", destination: "Bali, Indonesia", date: "2026-11-28", tripStatus: "UPCOMING", operationalNotes: "Final itinerary shared. Confirm the Nusa Penida excursion pickup window." },
  { id: "travora-trip-008", customerId: "travora-customer-008", name: "Dev Malhotra", email: "dev.malhotra@example.com", destination: "Tokyo & Kyoto, Japan", date: "2026-12-04", tripStatus: "UPCOMING", operationalNotes: "Rail pass and hotel shortlist approved. Awaiting final activity confirmations." },
  { id: "travora-trip-009", customerId: "travora-customer-009", name: "Myra Kapoor", email: "myra.kapoor@example.com", destination: "Phuket & Krabi, Thailand", date: "2026-12-12", tripStatus: "UPCOMING", operationalNotes: "Two-city itinerary. Review ferry timing and airport transfer coordination." },
  { id: "travora-trip-010", customerId: "travora-customer-010", name: "Vihaan Sethi", email: "vihaan.sethi@example.com", destination: "Da Nang & Hoi An, Vietnam", date: "2026-12-18", tripStatus: "UPCOMING", operationalNotes: "Hotel options approved. Ba Na Hills tickets and local transfers are pending." },
  { id: "travora-trip-011", customerId: "travora-customer-011", name: "Tara Menon", email: "tara.menon@example.com", destination: "Colombo & Galle, Sri Lanka", date: "2026-12-26", tripStatus: "UPCOMING", operationalNotes: "Holiday itinerary in progress. Check room category and private vehicle availability." },
  { id: "travora-trip-012", customerId: "travora-customer-012", name: "Aditya Bansal", email: "aditya.bansal@example.com", destination: "Dubai, UAE", date: "2027-01-08", tripStatus: "UPCOMING", operationalNotes: "New Year extension itinerary. Confirm attraction slots before issuing final voucher." },
  { id: "travora-trip-013", customerId: "travora-customer-013", name: "Kiara Shah", email: "kiara.shah@example.com", destination: "Kuala Lumpur & Langkawi, Malaysia", date: "2027-01-16", tripStatus: "UPCOMING", operationalNotes: "Domestic flight connection required between Kuala Lumpur and Langkawi." },
  { id: "travora-trip-014", customerId: "travora-customer-014", name: "Reyansh Arora", email: "reyansh.arora@example.com", destination: "Manila & Cebu, Philippines", date: "2027-01-24", tripStatus: "UPCOMING", operationalNotes: "Island transfer and domestic flight schedule under review." },
  { id: "travora-trip-015", customerId: "travora-customer-015", name: "Nisha Khurana", email: "nisha.khurana@example.com", destination: "Bali, Indonesia", date: "2027-02-05", tripStatus: "UPCOMING", operationalNotes: "Couple itinerary. Villa shortlist selected; request final room inclusions." },
  { id: "travora-trip-016", customerId: "travora-customer-016", name: "Aarav Gill", email: "aarav.gill@example.com", destination: "Mauritius", date: "2027-02-16", tripStatus: "UPCOMING", operationalNotes: "Resort package in review. Confirm airport pickup and catamaran activity." },
  { id: "travora-trip-017", customerId: "travora-customer-017", name: "Zoya Fernandes", email: "zoya.fernandes@example.com", destination: "Istanbul & Cappadocia, Türkiye", date: "2027-02-23", tripStatus: "UPCOMING", operationalNotes: "Internal flight and hot-air balloon availability to be reconfirmed." },
  { id: "travora-trip-018", customerId: "travora-customer-018", name: "Neil Chawla", email: "neil.chawla@example.com", destination: "Osaka & Tokyo, Japan", date: "2027-03-05", tripStatus: "UPCOMING", operationalNotes: "Itinerary draft approved. Awaiting hotel deposit and rail reservation window." },
  { id: "travora-trip-019", customerId: "travora-customer-019", name: "Samar Kapoor", email: "samar.kapoor@example.com", destination: "Bangkok & Koh Samui, Thailand", date: "2027-03-14", tripStatus: "UPCOMING", operationalNotes: "Beach extension requested. Compare ferry and short-haul flight options." },
  { id: "travora-trip-020", customerId: "travora-customer-020", name: "Anika Desai", email: "anika.desai@example.com", destination: "Rome & Florence, Italy", date: "2027-04-03", tripStatus: "UPCOMING", operationalNotes: "Early planning stage. Prepare intercity rail and guided tour shortlist." },
  { id: "travora-trip-021", customerId: "travora-customer-021", name: "Kabir Malhotra", email: "kabir.malhotra@example.com", destination: "Bali, Indonesia", date: "2026-12-02", tripStatus: "CANCELLED", operationalNotes: "Customer requested cancellation following a change in travel dates.", refundStatus: "PARTIAL_REFUNDED", refundPercentage: 50, refundNotes: "50% of the eligible amount has been processed; supplier reconciliation recorded." },
];

const destinations: Record<string, { airport: string; airline: string; hotel: string; activity: string; transfer: string; ferry: string; country: string }> = {
  "Bali, Indonesia": { airport: "DPS", airline: "Singapore Airlines", hotel: "The Ubud Haven", activity: "Ubud cultural day tour", transfer: "Private airport SUV", ferry: "Nusa Penida fast boat", country: "Indonesia" },
  "Singapore & Malaysia": { airport: "SIN", airline: "Malaysia Airlines", hotel: "Marina Central Suites", activity: "Gardens by the Bay visit", transfer: "City airport transfer", ferry: "Harbour cruise", country: "Singapore / Malaysia" },
  "Dubai, UAE": { airport: "DXB", airline: "Emirates", hotel: "Creekside Grand Hotel", activity: "Desert safari with dinner", transfer: "Private airport transfer", ferry: "Dubai Creek abra ride", country: "UAE" },
  "Phuket, Thailand": { airport: "HKT", airline: "Thai Airways", hotel: "Sapphire Bay Resort", activity: "Phi Phi island excursion", transfer: "Airport minivan transfer", ferry: "Phuket island ferry", country: "Thailand" },
  "Vietnam": { airport: "HAN", airline: "Vietnam Airlines", hotel: "Lantern Riverside Hotel", activity: "Ha Long Bay cruise", transfer: "Private city transfer", ferry: "Ha Long Bay vessel", country: "Vietnam" },
  "Jaipur, India": { airport: "JAI", airline: "IndiGo", hotel: "Amber Court Jaipur", activity: "Amber Fort guided tour", transfer: "Station and city transfer", ferry: "Not required", country: "India" },
  "Tokyo & Kyoto, Japan": { airport: "NRT", airline: "Japan Airlines", hotel: "Sakura Park Hotel", activity: "Kyoto heritage walk", transfer: "Airport limousine transfer", ferry: "Not required", country: "Japan" },
  "Phuket & Krabi, Thailand": { airport: "KBV", airline: "Thai Airways", hotel: "Andaman Cove Resort", activity: "Four Islands speedboat tour", transfer: "Private resort transfer", ferry: "Phuket–Krabi ferry", country: "Thailand" },
  "Da Nang & Hoi An, Vietnam": { airport: "DAD", airline: "VietJet Air", hotel: "Hoi An Lantern Boutique", activity: "Ba Na Hills day pass", transfer: "Airport to Hoi An transfer", ferry: "Not required", country: "Vietnam" },
  "Colombo & Galle, Sri Lanka": { airport: "CMB", airline: "SriLankan Airlines", hotel: "Galle Fort Residence", activity: "Galle heritage walk", transfer: "Private coastal transfer", ferry: "Not required", country: "Sri Lanka" },
  "Kuala Lumpur & Langkawi, Malaysia": { airport: "KUL", airline: "Malaysia Airlines", hotel: "Langkawi Shoreline Resort", activity: "SkyCab and SkyBridge visit", transfer: "Airport and hotel transfer", ferry: "Langkawi island ferry", country: "Malaysia" },
  "Manila & Cebu, Philippines": { airport: "CEB", airline: "Philippine Airlines", hotel: "Cebu Seaview Hotel", activity: "Cebu coastal island tour", transfer: "Private airport transfer", ferry: "Cebu harbour ferry", country: "Philippines" },
  "Mauritius": { airport: "MRU", airline: "Air Mauritius", hotel: "Lagoon Pointe Resort", activity: "Catamaran lagoon cruise", transfer: "Resort airport transfer", ferry: "Island excursion boat", country: "Mauritius" },
  "Istanbul & Cappadocia, Türkiye": { airport: "IST", airline: "Turkish Airlines", hotel: "Pera House Istanbul", activity: "Cappadocia valley tour", transfer: "Private city transfer", ferry: "Bosphorus ferry cruise", country: "Türkiye" },
  "Osaka & Tokyo, Japan": { airport: "KIX", airline: "ANA", hotel: "Shinjuku Garden Hotel", activity: "Osaka food and culture walk", transfer: "Airport rail transfer", ferry: "Not required", country: "Japan" },
  "Bangkok & Koh Samui, Thailand": { airport: "BKK", airline: "Bangkok Airways", hotel: "Samui Palm Retreat", activity: "Ang Thong marine park tour", transfer: "Private airport transfer", ferry: "Koh Samui island ferry", country: "Thailand" },
  "Rome & Florence, Italy": { airport: "FCO", airline: "ITA Airways", hotel: "Piazza Navona Rooms", activity: "Florence historic centre tour", transfer: "Airport rail and hotel transfer", ferry: "Not required", country: "Italy" },
};

function makeServices(trip: TripSeed, index: number) {
  const detail = destinations[trip.destination] ?? { airport: "INT", airline: "International carrier", hotel: "City Centre Hotel", activity: "Guided city experience", transfer: "Private airport transfer", ferry: "Local boat service", country: trip.destination };
  const serviceNames: Record<ServiceType, string> = {
    FLIGHTS: `Delhi–${detail.airport} · ${detail.airline}`,
    STAYS: `${detail.hotel} · ${index % 3 + 3} nights`,
    ACTIVITIES: detail.activity,
    TRANSFERS: detail.transfer,
    FERRY: detail.ferry,
    VISA: `${detail.country} visitor documentation`,
    TOURIST_TAX: `${detail.country} local visitor levy`,
    ARRIVAL_CARD: `${detail.country} arrival declaration`,
    TRAVEL_INSURANCE: `International cover · ${index % 2 ? "Allianz" : "TATA AIG"}`,
  };
  return serviceOrder.map((serviceType, serviceIndex) => {
    let bookingStatus: BookingStatus = "TO_BE_DONE";
    let handledBy: Handler = "UNASSIGNED";
    let progressNote: string | undefined;
    let notes: string | undefined;

    if (trip.tripStatus === "COMPLETED") {
      bookingStatus = serviceIndex === 4 && index % 2 === 0 ? "NOT_NEEDED" : "COMPLETED";
      handledBy = serviceIndex === 0 && index % 3 === 0 ? "SELF" : serviceIndex === 2 && index % 4 === 0 ? "MIXED" : "TRAVORA";
      notes = bookingStatus === "COMPLETED" ? "Confirmation and final voucher shared with the traveller." : "Not part of the selected itinerary.";
    } else if (trip.tripStatus === "CANCELLED") {
      bookingStatus = serviceIndex === 0 ? "COMPLETED" : serviceIndex === 4 ? "NOT_NEEDED" : "CANCELLED";
      handledBy = serviceIndex === 0 ? "SELF" : "TRAVORA";
      notes = serviceIndex === 0 ? "Ticket cancellation terms reviewed with the traveller." : "Closed following trip cancellation.";
    } else if (trip.tripStatus === "IN_PROGRESS") {
      const statusByService: BookingStatus[] = ["COMPLETED", "COMPLETED", "IN_PROGRESS", "COMPLETED", "NOT_NEEDED", "COMPLETED", "NOT_NEEDED", "COMPLETED", "COMPLETED"];
      bookingStatus = statusByService[serviceIndex];
      handledBy = serviceIndex === 0 ? "SELF" : "TRAVORA";
      if (bookingStatus === "IN_PROGRESS") { progressNote = "Supplier reconfirmation pending"; notes = "Follow up with the local activity partner."; }
      else notes = bookingStatus === "NOT_NEEDED" ? "Not required for this itinerary." : "Service completed and customer informed.";
    } else {
      const statusByService: BookingStatus[] = index % 2 === 0
        ? ["COMPLETED", "IN_PROGRESS", "TO_BE_DONE", "COMPLETED", "TO_BE_DONE", "IN_PROGRESS", "TO_BE_DONE", "TO_BE_DONE", "COMPLETED"]
        : ["COMPLETED", "COMPLETED", "IN_PROGRESS", "TO_BE_DONE", "NOT_NEEDED", "TO_BE_DONE", "TO_BE_DONE", "IN_PROGRESS", "TO_BE_DONE"];
      bookingStatus = statusByService[serviceIndex];
      handledBy = serviceIndex === 0 && index % 3 === 0 ? "SELF" : bookingStatus === "NOT_NEEDED" ? "UNASSIGNED" : "TRAVORA";
      if (bookingStatus === "IN_PROGRESS") progressNote = serviceIndex === 1 ? "2 shortlisted options awaiting approval" : "Supplier confirmation pending";
      if (bookingStatus === "TO_BE_DONE") notes = serviceIndex === 2 ? "Shortlist activities and confirm preferred time." : "Coordinate after itinerary approval.";
      if (bookingStatus === "COMPLETED") notes = "Booking confirmation shared with the traveller.";
    }

    return { serviceType, itemName: serviceNames[serviceType], bookingStatus, handledBy, progressNote, notes };
  });
}

async function main() {
  for (let index = 0; index < trips.length; index++) {
    const trip = trips[index];
    await prisma.customer.upsert({
      where: { id: trip.customerId },
      create: { id: trip.customerId, name: trip.name, email: trip.email },
      update: { name: trip.name, email: trip.email },
    });
    await prisma.trip.upsert({
      where: { id: trip.id },
      create: {
        id: trip.id, customerId: trip.customerId, destination: trip.destination,
        startDate: new Date(`${trip.date}T00:00:00.000Z`), tripStatus: trip.tripStatus,
        operationalNotes: trip.operationalNotes ?? null, refundStatus: trip.refundStatus ?? "NOT_APPLICABLE",
        refundPercentage: trip.refundPercentage ?? null, refundNotes: trip.refundNotes ?? null,
      },
      update: {
        customerId: trip.customerId, destination: trip.destination,
        startDate: new Date(`${trip.date}T00:00:00.000Z`), tripStatus: trip.tripStatus,
        operationalNotes: trip.operationalNotes ?? null, refundStatus: trip.refundStatus ?? "NOT_APPLICABLE",
        refundPercentage: trip.refundPercentage ?? null, refundNotes: trip.refundNotes ?? null,
      },
    });
    const services = makeServices(trip, index);
    if (trip.id === "travora-trip-007" || trip.id === "travora-trip-015") {
      services.push({ serviceType: "ACTIVITIES", itemName: "Private sunset cruise · preferred evening slot", bookingStatus: "TO_BE_DONE", handledBy: "TRAVORA", progressNote: undefined, notes: "Confirm departure time and inclusions." });
    }
    if (trip.id === "travora-trip-009" || trip.id === "travora-trip-013") {
      services.push({ serviceType: "STAYS", itemName: "Second city stay · 2 nights", bookingStatus: "IN_PROGRESS", handledBy: "TRAVORA", progressNote: "Room category reconfirmation", notes: "Hold the selected room while supplier confirms." });
    }
    for (let serviceIndex = 0; serviceIndex < services.length; serviceIndex++) {
      const service = services[serviceIndex];
      const id = `${trip.id}-${service.serviceType.toLowerCase()}-${serviceIndex + 1}`;
      await prisma.serviceBooking.upsert({
        where: { id },
        create: { id, tripId: trip.id, ...service },
        update: { tripId: trip.id, ...service },
      });
    }
  }
  const serviceCount = trips.reduce((total, trip, index) => total + makeServices(trip, index).length + (["travora-trip-007", "travora-trip-015", "travora-trip-009", "travora-trip-013"].includes(trip.id) ? 1 : 0), 0);
  console.log(`Travora records are ready: ${trips.length} customer trips and ${serviceCount} service bookings.`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => { await prisma.$disconnect(); });
