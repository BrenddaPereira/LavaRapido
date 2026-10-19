require("dotenv").config();
const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "bookings.json");
fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, "[]", "utf8");

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const services = [
  { id: "simples", name: "Lavagem Simples", price: 40, duration: 30 },
  { id: "completa", name: "Lavagem Completa", price: 70, duration: 60 },
  { id: "interna", name: "Higienização Interna", price: 90, duration: 90 },
  { id: "enceramento", name: "Enceramento", price: 60, duration: 60 },
  { id: "motor", name: "Higienização do Motor", price: 80, duration: 60 }
];
const readBookings = () => JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
const writeBookings = (data) => fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));

function getSlots(date) {
  const day = new Date(`${date}T12:00:00`).getDay();
  if (day === 0) return [];
  const slots = [];
  const start = 8 * 60, end = (day === 6 ? 16 : 18) * 60;
  for (let t = start; t < end; t += 30) {
    if (t >= 12 * 60 && t < 13 * 60) continue;
    slots.push(`${String(Math.floor(t/60)).padStart(2,"0")}:${String(t%60).padStart(2,"0")}`);
  }
  return slots;
}
function overlaps(startA, durA, startB, durB) {
  return startA < startB + durB && startB < startA + durA;
}
function availableSlots(date, serviceId) {
  const service = services.find(s => s.id === serviceId);
  if (!service) return [];
  const all = readBookings().filter(b => b.date === date && b.status !== "cancelado");
  return getSlots(date).filter(slot => {
    const [h,m] = slot.split(":").map(Number);
    const start = h*60+m;
    if (start + service.duration > (new Date(`${date}T12:00:00`).getDay() === 6 ? 16*60 : 18*60)) return false;
    return !all.some(b => {
      const [bh,bm] = b.time.split(":").map(Number);
      const bStart = bh*60+bm;
      const bService = services.find(s => s.id === b.serviceId);
      return bService && overlaps(start, service.duration, bStart, bService.duration);
    });
  });
}
async function sendWhatsAppTemplate(booking) {
  const { WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_TEMPLATE_NAME, WHATSAPP_TEMPLATE_LANGUAGE } = process.env;
  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_NUMBER_ID || !WHATSAPP_TEMPLATE_NAME) {
    return { sent: false, reason: "WhatsApp Cloud API ainda não configurada" };
  }
  const service = services.find(s => s.id === booking.serviceId);
  const url = `https://graph.facebook.com/v23.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const body = {
    messaging_product: "whatsapp",
    to: booking.phone.replace(/\D/g, ""),
    type: "template",
    template: {
      name: WHATSAPP_TEMPLATE_NAME,
      language: { code: WHATSAPP_TEMPLATE_LANGUAGE || "pt_BR" },
      components: [{
        type: "body",
        parameters: [
          { type: "text", text: booking.name },
          { type: "text", text: service.name },
          { type: "text", text: booking.date.split("-").reverse().join("/") },
          { type: "text", text: booking.time }
        ]
      }]
    }
  };
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const result = await response.json();
  if (!response.ok) {
    console.error("Falha WhatsApp:", result);
    return { sent: false, reason: "A API do WhatsApp recusou o envio. Verifique token e template." };
  }
  return { sent: true };
}

app.get("/api/services", (_req, res) => res.json(services));
app.get("/api/slots", (req, res) => {
  const { date, serviceId } = req.query;
  if (!date || !serviceId) return res.status(400).json({ error: "Informe data e serviço." });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: "Data inválida." });
  const today = new Date(); today.setHours(0,0,0,0);
  const selected = new Date(`${date}T00:00:00`);
  if (Number.isNaN(selected.getTime()) || selected < today) return res.json([]);
  res.json(availableSlots(date, serviceId));
});
app.post("/api/bookings", async (req, res) => {
  const { name, phone, vehicle, plate, serviceId, date, time } = req.body || {};
  if (![name, phone, vehicle, serviceId, date, time].every(v => typeof v === "string" && v.trim())) {
    return res.status(400).json({ error: "Preencha todos os campos obrigatórios." });
  }
  if (name.length > 100 || phone.length > 25 || vehicle.length > 100 || (plate && plate.length > 12)) {
    return res.status(400).json({ error: "Um ou mais campos são muito longos." });
  }
  if (!availableSlots(date, serviceId).includes(time)) {
    return res.status(409).json({ error: "Esse horário acabou de ficar indisponível. Escolha outro." });
  }
  const service = services.find(s => s.id === serviceId);
  if (!service) return res.status(400).json({ error: "Serviço inválido." });
  const booking = {
    id: `CAR-${Date.now().toString(36).toUpperCase()}`,
    name: name.trim(), phone: phone.trim(), vehicle: vehicle.trim(),
    plate: (plate || "").trim(), serviceId, date, time,
    createdAt: new Date().toISOString(), status: "confirmado"
  };
  const bookings = readBookings();
  bookings.push(booking);
  writeBookings(bookings);
  const whatsapp = await sendWhatsAppTemplate(booking);
  res.status(201).json({
    booking: { ...booking, serviceName: service.name, price: service.price, duration: service.duration },
    whatsapp
  });
});
app.get("/api/admin/bookings", (req, res) => {
  const key = process.env.ADMIN_KEY;
  if (!key || req.get("x-admin-key") !== key) return res.status(401).json({ error: "Acesso não autorizado. Configure ADMIN_KEY no .env." });
  res.json(readBookings().map(b => ({ ...b, service: services.find(s => s.id === b.serviceId) })));
});
app.patch("/api/admin/bookings/:id/cancel", (req, res) => {
  const key = process.env.ADMIN_KEY;
  if (!key || req.get("x-admin-key") !== key) return res.status(401).json({ error: "Acesso não autorizado." });
  const bookings = readBookings();
  const booking = bookings.find(b => b.id === req.params.id);
  if (!booking) return res.status(404).json({ error: "Agendamento não encontrado." });
  booking.status = "cancelado";
  writeBookings(bookings);
  res.json({ ok: true });
});
app.listen(PORT, () => console.log(`Lava-Rápido do Carille rodando em http://localhost:${PORT}`));