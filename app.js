// Calendrier Famille – PWA + Firebase (Auth e-mail/mot de passe + Firestore temps réel)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig, MEMBERS } from "./config.js";

// ---------- Firebase ----------
const fbApp = initializeApp(firebaseConfig);
const auth = getAuth(fbApp);
const db = initializeFirestore(fbApp, {           // cache local => fonctionne hors ligne
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});
const eventsCol = collection(db, "events");

// ---------- Utilitaires date ----------
const $ = s => document.querySelector(s);
const pad = n => String(n).padStart(2, "0");
const toKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromKey = k => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtMonth = d => d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
const fmtDay = k => fromKey(k).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const member = id => MEMBERS.find(m => m.id === id) || MEMBERS[0];

// ---------- État ----------
const now = new Date();
const state = {
  raw: [],                                   // documents Firestore
  month: new Date(now.getFullYear(), now.getMonth(), 1),
  selected: toKey(now),
  view: "month",                             // "month" | "agenda"
  filter: new Set(JSON.parse(localStorage.getItem("filter") || "null") || MEMBERS.map(m => m.id)),
  unsub: null,
  editingId: null
};

// ---------- Récurrences ----------
function occurrences(fromK, toK) {
  const f = fromKey(fromK), t = fromKey(toK), out = [];
  for (const ev of state.raw) {
    if (!(ev.participants || ["famille"]).some(p => state.filter.has(p))) continue;
    const start = fromKey(ev.date);
    const until = ev.repeatUntil ? fromKey(ev.repeatUntil) : null;
    if (!ev.repeat || ev.repeat === "none") {
      if (ev.date >= fromK && ev.date <= toK) out.push({ ...ev, occ: ev.date });
      continue;
    }
    for (let i = 0; i < 2000; i++) {
      const d = ev.repeat === "weekly"
        ? addDays(start, 7 * i)
        : new Date(start.getFullYear(), start.getMonth() + i, start.getDate());
      if (d > t || (until && d > until)) break;
      if (ev.repeat === "monthly" && d.getDate() !== start.getDate()) continue; // ex : 31 dans un mois de 30 j
      if (d >= f) out.push({ ...ev, occ: toKey(d) });
    }
  }
  return out.sort((a, b) =>
    a.occ.localeCompare(b.occ) || (b.allDay - a.allDay) || (a.start || "").localeCompare(b.start || ""));
}
const color = ev => member((ev.participants || ["famille"])[0]).color;

// ---------- Rendu ----------
function render() {
  $("#toggleView").textContent = state.view === "month" ? "Agenda" : "Mois";
  $("#monthView").classList.toggle("hidden", state.view !== "month");
  $("#monthLabel").textContent = state.view === "month" ? fmtMonth(state.month) : "À venir";
  $("#prev").style.visibility = $("#next").style.visibility = state.view === "month" ? "visible" : "hidden";
  renderFilters();
  if (state.view === "month") { renderGrid(); renderDay(); } else renderAgenda();
}

function renderFilters() {
  $("#filters").innerHTML = MEMBERS.map(m =>
    `<span class="chip ${state.filter.has(m.id) ? "on" : ""}" style="--c:${m.color}" data-id="${m.id}">${esc(m.name)}</span>`
  ).join("");
}

function renderGrid() {
  const m = state.month;
  const gridStart = addDays(m, -((m.getDay() + 6) % 7));       // lundi
  const gridEnd = addDays(gridStart, 41);
  const byDay = {};
  for (const o of occurrences(toKey(gridStart), toKey(gridEnd))) (byDay[o.occ] ||= []).push(o);
  const todayK = toKey(new Date());
  let html = "";
  for (let i = 0; i < 42; i++) {
    const d = addDays(gridStart, i), k = toKey(d), evs = byDay[k] || [];
    const cls = ["cell", d.getMonth() !== m.getMonth() && "other", k === todayK && "today", k === state.selected && "selected"].filter(Boolean).join(" ");
    html += `<div class="${cls}" data-key="${k}">
      <span class="num">${d.getDate()}</span>
      <div class="dots">${evs.slice(0, 6).map(e => `<span class="dot" style="background:${color(e)}"></span>`).join("")}</div>
      ${evs.slice(0, 3).map(e => `<span class="pill" style="background:${color(e)}">${e.allDay ? "" : e.start + " "}${esc(e.title)}</span>`).join("")}
      ${evs.length > 3 ? `<span class="more pill-more">+${evs.length - 3}</span>` : ""}
    </div>`;
  }
  $("#grid").innerHTML = html;
}

function eventItem(e) {
  const when = e.allDay ? "Toute la journée" : `${e.start}${e.end ? " – " + e.end : ""}`;
  const rep = e.repeat === "weekly" ? " · ↻ hebdo" : e.repeat === "monthly" ? " · ↻ mensuel" : "";
  return `<li class="ev" style="--c:${color(e)}" data-id="${e.id}">
    <div class="t">${esc(e.title)}</div>
    <div class="meta">${when}${rep}${e.location ? " · 📍 " + esc(e.location) : ""}</div>
    ${e.notes ? `<div class="meta">${esc(e.notes)}</div>` : ""}
    <div class="who">${(e.participants || []).map(p => `<span class="tag" style="background:${member(p).color}">${esc(member(p).name)}</span>`).join("")}</div>
  </li>`;
}

function renderDay() {
  $("#sideTitle").textContent = fmtDay(state.selected);
  const evs = occurrences(state.selected, state.selected);
  $("#eventList").innerHTML = evs.length ? evs.map(eventItem).join("") : `<li class="empty">Rien de prévu 🎉</li>`;
}

function renderAgenda() {
  const from = toKey(new Date()), to = toKey(addDays(new Date(), 60));
  $("#sideTitle").textContent = "60 prochains jours";
  let html = "", last = "";
  for (const e of occurrences(from, to)) {
    if (e.occ !== last) { html += `<li class="day-sep">${fmtDay(e.occ)}</li>`; last = e.occ; }
    html += eventItem(e);
  }
  $("#eventList").innerHTML = html || `<li class="empty">Aucun événement à venir</li>`;
}

// ---------- Formulaire ----------
const form = $("#eventForm"), dlg = $("#eventDialog");

function openForm(ev = null, dateK = state.selected) {
  state.editingId = ev?.id || null;
  form.reset();
  $("#formTitle").textContent = ev ? "Modifier l'événement" : "Nouvel événement";
  $("#deleteBtn").classList.toggle("hidden", !ev);
  $("#formError").textContent = "";
  const sel = new Set(ev?.participants || []);
  $("#participants").innerHTML = MEMBERS.map(m =>
    `<span class="chip ${sel.has(m.id) ? "on" : ""}" style="--c:${m.color}" data-id="${m.id}">${esc(m.name)}</span>`).join("");
  form.title.value = ev?.title || "";
  form.date.value = ev?.date || dateK;
  form.allDay.checked = !!ev?.allDay;
  form.start.value = ev?.start || "09:00";
  form.end.value = ev?.end || "10:00";
  form.repeat.value = ev?.repeat || "none";
  form.repeatUntil.value = ev?.repeatUntil || "";
  form.location.value = ev?.location || "";
  form.notes.value = ev?.notes || "";
  syncFormVisibility();
  dlg.showModal();
}

function syncFormVisibility() {
  $("#timeRow").classList.toggle("hidden", form.allDay.checked);
  $("#untilLabel").classList.toggle("hidden", form.repeat.value === "none");
}

form.allDay.addEventListener("change", syncFormVisibility);
form.repeat.addEventListener("change", syncFormVisibility);
$("#participants").addEventListener("click", e => e.target.closest(".chip")?.classList.toggle("on"));
$("#cancelBtn").addEventListener("click", () => dlg.close());

form.addEventListener("submit", e => {
  e.preventDefault();
  const participants = [...document.querySelectorAll("#participants .chip.on")].map(c => c.dataset.id);
  const data = {
    title: form.title.value.trim(),
    date: form.date.value,
    allDay: form.allDay.checked,
    start: form.allDay.checked ? "" : form.start.value,
    end: form.allDay.checked ? "" : form.end.value,
    participants: participants.length ? participants : ["famille"],
    repeat: form.repeat.value,
    repeatUntil: form.repeat.value === "none" ? "" : form.repeatUntil.value,
    location: form.location.value.trim(),
    notes: form.notes.value.trim(),
    updatedBy: auth.currentUser?.email || "",
    updatedAt: serverTimestamp()
  };
  if (!data.title || !data.date) return ($("#formError").textContent = "Titre et date obligatoires.");
  if (!data.allDay && data.end && data.end < data.start) return ($("#formError").textContent = "L'heure de fin est avant le début.");
  // Pas d'await : en hors ligne, Firestore met l'écriture en file d'attente et l'affiche immédiatement.
  const p = state.editingId ? updateDoc(doc(db, "events", state.editingId), data) : addDoc(eventsCol, data);
  p.catch(err => alert("Erreur d'enregistrement : " + err.message));
  state.selected = data.date;
  dlg.close();
});

$("#deleteBtn").addEventListener("click", () => {
  const ev = state.raw.find(x => x.id === state.editingId);
  const msg = ev?.repeat && ev.repeat !== "none" ? "Supprimer TOUTE la série récurrente ?" : "Supprimer cet événement ?";
  if (!confirm(msg)) return;
  deleteDoc(doc(db, "events", state.editingId)).catch(err => alert(err.message));
  dlg.close();
});

// ---------- Interactions ----------
const shiftMonth = n => { state.month = new Date(state.month.getFullYear(), state.month.getMonth() + n, 1); render(); };
$("#prev").onclick = () => shiftMonth(-1);
$("#next").onclick = () => shiftMonth(1);
$("#today").onclick = () => { const d = new Date(); state.month = new Date(d.getFullYear(), d.getMonth(), 1); state.selected = toKey(d); state.view = "month"; render(); };
$("#toggleView").onclick = () => { state.view = state.view === "month" ? "agenda" : "month"; render(); };
$("#fab").onclick = () => openForm(null, state.view === "month" ? state.selected : toKey(new Date()));
$("#logout").onclick = () => confirm("Se déconnecter ?") && signOut(auth);

$("#grid").addEventListener("click", e => {
  const cell = e.target.closest(".cell"); if (!cell) return;
  const k = cell.dataset.key;
  if (k === state.selected) return openForm(null, k);          // 2e clic sur le jour => ajout
  state.selected = k;
  const d = fromKey(k);
  if (d.getMonth() !== state.month.getMonth()) state.month = new Date(d.getFullYear(), d.getMonth(), 1);
  render();
});
$("#eventList").addEventListener("click", e => {
  const li = e.target.closest(".ev"); if (!li) return;
  openForm(state.raw.find(x => x.id === li.dataset.id));
});
$("#filters").addEventListener("click", e => {
  const id = e.target.closest(".chip")?.dataset.id; if (!id) return;
  state.filter.has(id) ? state.filter.delete(id) : state.filter.add(id);
  localStorage.setItem("filter", JSON.stringify([...state.filter]));
  render();
});

// Balayage gauche/droite sur smartphone/iPad pour changer de mois
let tx = null;
$("#grid").addEventListener("touchstart", e => (tx = e.touches[0].clientX), { passive: true });
$("#grid").addEventListener("touchend", e => {
  if (tx === null) return;
  const dx = e.changedTouches[0].clientX - tx; tx = null;
  if (Math.abs(dx) > 60) shiftMonth(dx < 0 ? 1 : -1);
});

const netStatus = () => $("#offline").classList.toggle("hidden", navigator.onLine);
addEventListener("online", netStatus); addEventListener("offline", netStatus);

// ---------- Authentification ----------
$("#loginForm").addEventListener("submit", async e => {
  e.preventDefault();
  $("#loginError").textContent = "";
  try { await signInWithEmailAndPassword(auth, $("#email").value.trim(), $("#password").value); }
  catch { $("#loginError").textContent = "E-mail ou mot de passe incorrect."; }
});

onAuthStateChanged(auth, user => {
  $("#login").classList.toggle("hidden", !!user);
  $("#app").classList.toggle("hidden", !user);
  state.unsub?.(); state.unsub = null;
  if (!user) { state.raw = []; return; }
  // Synchronisation temps réel : toute modification apparaît instantanément chez tout le monde
  state.unsub = onSnapshot(eventsCol,
    snap => { state.raw = snap.docs.map(d => ({ id: d.id, ...d.data() })); render(); },
    err => alert("Accès refusé : votre adresse n'est pas autorisée.\n" + err.message));
  netStatus();
  render();
});

// ---------- PWA ----------
if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js");
