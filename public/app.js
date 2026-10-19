const $ = (id) => document.getElementById(id);
const money = (n) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
let services = [];
const fallbackServices = [
  {id:"simples",name:"Lavagem Simples",price:40,duration:30,description:"Limpeza externa com produtos específicos e secagem.",image:"photo-1607860108855-64acr2075a2c",icon:"🚘"},
  {id:"completa",name:"Lavagem Completa",price:70,duration:60,description:"Lavagem externa e interna com aspiração e limpeza dos painéis.",image:"photo-1601362840469-51e4d8d58785",icon:"✦"},
  {id:"interna",name:"Higienização Interna",price:90,duration:90,description:"Limpeza profunda dos bancos, teto, painel e carpetes.",image:"photo-1600705722908-bab1d1e2c7e6",icon:"✧"},
  {id:"enceramento",name:"Enceramento",price:60,duration:60,description:"Proteção e brilho por mais tempo para a pintura do seu carro.",image:"photo-1503376780353-7e6692767b70",icon:"✧"},
  {id:"motor",name:"Higienização do Motor",price:80,duration:60,description:"Remove impurezas e melhora o aspecto do motor.",image:"photo-1486262715619-67b85e0b08d3",icon:"⚙"}
];
const businessWhatsApp = ""; // Configure o número em public/app.js, somente dígitos, ex.: 5511999999999
function waUrl(message="Olá! Gostaria de saber mais sobre os serviços do Lava-Rápido do Carille.") {
  return businessWhatsApp ? `https://wa.me/${businessWhatsApp}?text=${encodeURIComponent(message)}` : "#agendar";
}
$("headerWhatsApp").href = waUrl();
$("footerWhatsApp").href = waUrl();
$("year").textContent = new Date().getFullYear();
$("menuToggle").addEventListener("click", () => $("nav").classList.toggle("open"));
document.querySelectorAll("#nav a").forEach(a => a.addEventListener("click", () => $("nav").classList.remove("open")));
function renderServices() {
  $("service").innerHTML = services.map(s => `<option value="${s.id}">${s.name} — ${money(s.price)}</option>`).join("");
  $("serviceCards").innerHTML = services.map(s => {
    const extra = fallbackServices.find(x => x.id === s.id) || {};
    const image = extra.image ? `https://images.unsplash.com/${extra.image}?auto=format&fit=crop&w=700&q=80` : "";
    return `<article class="service-card"><div class="service-image" style="background-image:url('${image}')"></div><div class="service-body"><span class="service-icon">${extra.icon || "🚘"}</span><h3>${s.name}</h3><p>${extra.description || "Cuidado e limpeza para o seu veículo."}</p><div class="price">${money(s.price)}</div><div class="duration">◷ ${s.duration} min</div><button class="button primary" data-service="${s.id}">Agendar</button></div></article>`;
  }).join("");
  document.querySelectorAll("[data-service]").forEach(btn => btn.addEventListener("click", () => {
    $("service").value = btn.dataset.service; $("agendar").scrollIntoView({behavior:"smooth"}); loadSlots();
  }));
}
async function loadServices() {
  try { const r = await fetch("/api/services"); if (!r.ok) throw Error(); services = await r.json(); }
  catch { services = fallbackServices; }
  renderServices();
}
function todayLocal() {
  const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
$("date").min = todayLocal();
$("date").value = todayLocal();
async function loadSlots() {
  const date = $("date").value, serviceId = $("service").value;
  $("time").disabled = true; $("time").innerHTML = `<option value="">Carregando...</option>`;
  if (!date || !serviceId) { $("time").innerHTML = `<option value="">Escolha uma data e serviço</option>`; $("slotMessage").textContent = "Escolha uma data para consultar os horários."; return; }
  try {
    const response = await fetch(`/api/slots?date=${encodeURIComponent(date)}&serviceId=${encodeURIComponent(serviceId)}`);
    if (!response.ok) throw Error();
    const slots = await response.json();
    if (!slots.length) { $("time").innerHTML = `<option value="">Sem horários disponíveis</option>`; $("slotMessage").textContent = "Não há horários disponíveis nessa data. Tente outro dia."; return; }
    $("time").innerHTML = `<option value="">Escolha um horário</option>` + slots.map(t => `<option value="${t}">${t}</option>`).join("");
    $("time").disabled = false; $("slotMessage").textContent = `${slots.length} horário(s) disponível(is).`;
  } catch {
    $("time").innerHTML = `<option value="">Inicie o servidor para consultar</option>`;
    $("slotMessage").textContent = "Para consultar disponibilidade real, execute o site pelo servidor Node.js.";
  }
}
$("date").addEventListener("change", loadSlots);
$("service").addEventListener("change", loadSlots);
function showResult(html, error=false) { $("result").hidden=false; $("result").className=error?"result error":"result"; $("result").innerHTML=html; }
$("bookingForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = $("submitButton"); button.disabled = true; button.textContent = "Confirmando...";
  const data = {
    name: $("name").value.trim(), phone: $("phone").value.trim(),
    vehicle: $("vehicle").value.trim(), plate: $("plate").value.trim(),
    serviceId: $("service").value, date: $("date").value, time: $("time").value
  };
  try {
    const response = await fetch("/api/bookings", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});
    const result = await response.json();
    if (!response.ok) throw Error(result.error || "Não foi possível concluir o agendamento.");
    const b = result.booking;
    const date = b.date.split("-").reverse().join("/");
    const message = `Olá, ${b.name}! Seu agendamento no Lava-Rápido do Carille está confirmado. Serviço: ${b.serviceName}. Data: ${date}, às ${b.time}. Veículo: ${b.vehicle}. Código: ${b.id}.`;
    const waStatus = result.whatsapp.sent
      ? `<p>Enviamos a confirmação automática para seu WhatsApp.</p>`
      : `<p><strong>Agendamento salvo!</strong> A confirmação automática por WhatsApp ainda precisa ser configurada pelo responsável do site.</p>`;
    showResult(`<strong>Agendamento confirmado! 🎉</strong><p>Protocolo: <b>${b.id}</b></p><p>${b.serviceName} · ${money(b.price)} · ${date} às ${b.time}</p>${waStatus}<p>Guarde o número do protocolo para consultar sua reserva.</p>`);
    $("bookingForm").reset(); $("date").min=todayLocal(); $("date").value=todayLocal(); await loadSlots();
  } catch (err) { showResult(err.message || "Erro ao agendar. Tente novamente.", true); }
  finally { button.disabled=false; button.innerHTML='Confirmar agendamento <span>→</span>'; }
});
loadServices().then(loadSlots);