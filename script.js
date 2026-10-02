const STORAGE_KEY = "healthAnimalDataV1";
const SESSION_KEY = "healthAnimalSessionV1";

let db = loadDatabase();
let currentUserId = localStorage.getItem(SESSION_KEY) || null;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function loadDatabase() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { users: [] };
  } catch {
    return { users: [] };
  }
}

function saveDatabase() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

function currentUser() {
  return db.users.find(user => user.id === currentUserId) || null;
}

function uid(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

async function hashPassword(password) {
  if (window.crypto?.subtle) {
    const data = new TextEncoder().encode(password);
    const hash = await crypto.subtle.digest("SHA-256", data);
    return [...new Uint8Array(hash)]
      .map(byte => byte.toString(16).padStart(2, "0"))
      .join("");
  }
  return btoa(unescape(encodeURIComponent(password)));
}

function showAuthMessage(text, type = "error") {
  const el = $("#authMessage");
  el.textContent = text;
  el.className = `message ${type}`;
}

function showApp() {
  $("#authScreen").classList.add("hidden");
  $("#app").classList.remove("hidden");

  const user = currentUser();
  $("#userName").textContent = user ? `Hola, ${user.name}` : "";

  renderAll();
}

function showLogin() {
  $("#loginBox").classList.remove("hidden");
  $("#registerBox").classList.add("hidden");
  showAuthMessage("");
}

function showRegister() {
  $("#loginBox").classList.add("hidden");
  $("#registerBox").classList.remove("hidden");
  showAuthMessage("");
}

function logout() {
  localStorage.removeItem(SESSION_KEY);
  currentUserId = null;
  $("#app").classList.add("hidden");
  $("#authScreen").classList.remove("hidden");
  $("#loginForm").reset();
  showLogin();
  showToast("Sesión cerrada correctamente");
}

function formatDate(dateString) {
  if (!dateString) return "";
  const date = new Date(`${dateString}T12:00:00`);
  return date.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

function formatDateLong(dateString) {
  if (!dateString) return "";
  const date = new Date(`${dateString}T12:00:00`);
  return date.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  });
}

function escapeHTML(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getPets() {
  return currentUser()?.pets || [];
}

function getAppointments() {
  return currentUser()?.appointments || [];
}

function getHistory() {
  return currentUser()?.history || [];
}

function renderAll() {
  if (!currentUser()) return;
  renderPetOptions();
  renderPets();
  renderAppointments();
  renderHistory();
  renderHome();
}

function renderPetOptions() {
  const pets = getPets();
  const options = pets.length
    ? pets.map(p => `<option value="${p.id}">${escapeHTML(p.name)}</option>`).join("")
    : `<option value="">No hay mascotas</option>`;

  $("#appointmentPetFilter").innerHTML = `<option value="all">Todas</option>${options}`;
  $("#historyPetFilter").innerHTML = `<option value="all">Todas</option>${options}`;
}

function petById(id) {
  return getPets().find(pet => pet.id === id);
}

function renderPets() {
  const pets = getPets();

  if (!pets.length) {
    $("#petsGrid").innerHTML = `
      <div class="empty" style="grid-column:1/-1">
        Aún no tienes mascotas registradas. Usa “+ Registrar mascota” para agregar la primera.
      </div>`;
    return;
  }

  $("#petsGrid").innerHTML = pets.map(pet => `
    <article class="pet-card">
      <div class="pet-avatar">${pet.species === "Gato" ? "🐱" : pet.species === "Ave" ? "🐦" : pet.species === "Conejo" ? "🐰" : "🐶"}</div>
      <h3>${escapeHTML(pet.name)}</h3>
      <p><strong>Especie:</strong> ${escapeHTML(pet.species)}</p>
      <p><strong>Raza:</strong> ${escapeHTML(pet.breed || "No especificada")}</p>
      <p><strong>Edad:</strong> ${escapeHTML(pet.age || "No especificada")}</p>
      <p><strong>Sexo:</strong> ${escapeHTML(pet.sex || "No especificado")}</p>
      <div class="card-actions">
        <button class="small-btn" onclick="openHistoryForPet('${pet.id}')">Ver historial</button>
        <button class="small-btn danger" onclick="deletePet('${pet.id}')">Eliminar</button>
      </div>
    </article>
  `).join("");
}

function renderAppointments() {
  const petFilter = $("#appointmentPetFilter").value || "all";
  const statusFilter = $("#appointmentStatusFilter").value || "all";

  let appointments = [...getAppointments()].sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));

  if (petFilter !== "all") appointments = appointments.filter(a => a.petId === petFilter);
  if (statusFilter !== "all") appointments = appointments.filter(a => a.status === statusFilter);

  if (!appointments.length) {
    $("#appointmentsList").innerHTML = `<div class="empty">No hay citas que coincidan con el filtro.</div>`;
    return;
  }

  $("#appointmentsList").innerHTML = appointments.map(a => {
    const pet = petById(a.petId);
    return `
      <article class="appointment-card">
        <div class="appointment-date">
          <strong>${escapeHTML(a.date.split("-")[2])}</strong>
          ${escapeHTML(formatMonth(a.date))}
        </div>
        <div>
          <h3>${escapeHTML(pet?.name || "Mascota eliminada")}</h3>
          <p><strong>Hora:</strong> ${escapeHTML(a.time)}</p>
          <p><strong>Motivo:</strong> ${escapeHTML(a.reason)}</p>
          <p><strong>Veterinario:</strong> ${escapeHTML(a.vet || "Por asignar")}</p>
        </div>
        <div>
          <span class="status ${a.status.toLowerCase()}">${escapeHTML(a.status)}</span>
          ${a.status === "Pendiente" ? `
            <div class="card-actions">
              <button class="small-btn" onclick="completeAppointment('${a.id}')">Completar</button>
              <button class="small-btn danger" onclick="cancelAppointment('${a.id}')">Cancelar</button>
            </div>` : ""}
        </div>
      </article>
    `;
  }).join("");
}

function formatMonth(dateString) {
  return new Date(`${dateString}T12:00:00`).toLocaleDateString("es-MX", { month: "short" }).replace(".", "").toUpperCase();
}

function renderHistory() {
  const filter = $("#historyPetFilter").value || "all";
  let records = [...getHistory()].sort((a, b) => b.date.localeCompare(a.date));

  if (filter !== "all") records = records.filter(h => h.petId === filter);

  if (!records.length) {
    $("#historyTable").innerHTML = `
      <tr><td colspan="6" style="text-align:center;padding:30px">No hay registros médicos para mostrar.</td></tr>`;
    return;
  }

  $("#historyTable").innerHTML = records.map(h => {
    const pet = petById(h.petId);
    return `
      <tr>
        <td>${escapeHTML(formatDate(h.date))}</td>
        <td>${escapeHTML(pet?.name || "Mascota eliminada")}</td>
        <td>${escapeHTML(h.consultation)}</td>
        <td>${escapeHTML(h.diagnosis)}</td>
        <td>${escapeHTML(h.treatment)}</td>
        <td>${escapeHTML(h.vet || "No indicado")}</td>
      </tr>
    `;
  }).join("");
}

function renderHome() {
  const appointments = [...getAppointments()]
    .filter(a => a.status === "Pendiente")
    .sort((a,b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
    .slice(0, 3);

  $("#homeAppointments").innerHTML = appointments.length
    ? appointments.map(a => {
        const pet = petById(a.petId);
        return `
          <div class="home-appointment">
            <div class="date-box">
              <strong>${escapeHTML(a.date.split("-")[2])}</strong>
              ${escapeHTML(formatMonth(a.date))}
            </div>
            <div>
              <strong>${escapeHTML(pet?.name || "Mascota")}</strong>
              <div style="font-size:10px;margin-top:5px">${escapeHTML(a.time)} · ${escapeHTML(a.reason)}</div>
            </div>
          </div>
        `;
      }).join("")
    : `<div class="empty">No tienes próximas citas.</div>`;

  const history = [...getHistory()].sort((a,b) => b.date.localeCompare(a.date)).slice(0, 4);

  $("#homeHistoryTable").innerHTML = history.length
    ? history.map(h => {
        const pet = petById(h.petId);
        return `
          <tr>
            <td>${escapeHTML(formatDate(h.date))}</td>
            <td>${escapeHTML(pet?.name || "Mascota")}</td>
            <td>${escapeHTML(h.consultation)}</td>
            <td><span class="status completada">Registrada</span></td>
          </tr>`;
      }).join("")
    : `<tr><td colspan="4" style="text-align:center">Sin historial todavía.</td></tr>`;
}

function openModal(content) {
  $("#modalContent").innerHTML = content;
  $("#modal").classList.remove("hidden");
}

function closeModal() {
  $("#modal").classList.add("hidden");
  $("#modalContent").innerHTML = "";
}

function openPetModal() {
  openModal(`
    <h2>Registrar mascota</h2>
    <p class="muted">Los datos se guardarán en tu cuenta.</p>
    <form id="petForm">
      <div class="form-grid">
        <div class="form-full">
          <label>Nombre de la mascota</label>
          <input id="petName" required placeholder="Ej. Max">
        </div>
        <div>
          <label>Especie</label>
          <select id="petSpecies" required>
            <option value="Perro">Perro</option>
            <option value="Gato">Gato</option>
            <option value="Ave">Ave</option>
            <option value="Conejo">Conejo</option>
            <option value="Otro">Otro</option>
          </select>
        </div>
        <div>
          <label>Raza</label>
          <input id="petBreed" placeholder="Ej. Labrador">
        </div>
        <div>
          <label>Edad</label>
          <input id="petAge" placeholder="Ej. 3 años">
        </div>
        <div>
          <label>Sexo</label>
          <select id="petSex">
            <option value="Hembra">Hembra</option>
            <option value="Macho">Macho</option>
            <option value="No especificado">No especificado</option>
          </select>
        </div>
        <div class="form-full">
          <label>Notas</label>
          <textarea id="petNotes" placeholder="Vacunas, alergias u otra información importante"></textarea>
        </div>
      </div>
      <button class="btn btn-dark full" type="submit">Guardar mascota</button>
    </form>
  `);

  $("#petForm").addEventListener("submit", (event) => {
    event.preventDefault();

    const user = currentUser();
    user.pets.push({
      id: uid("pet"),
      name: $("#petName").value.trim(),
      species: $("#petSpecies").value,
      breed: $("#petBreed").value.trim(),
      age: $("#petAge").value.trim(),
      sex: $("#petSex").value,
      notes: $("#petNotes").value.trim()
    });

    saveDatabase();
    closeModal();
    renderAll();
    showToast("Mascota registrada correctamente");
  });
}

function openAppointmentModal() {
  const pets = getPets();

  if (!pets.length) {
    showToast("Primero registra una mascota");
    showSection("mascotas");
    return;
  }

  openModal(`
    <h2>Agendar cita</h2>
    <p class="muted">La cita quedará asociada a tu usuario y a la mascota seleccionada.</p>
    <form id="appointmentForm">
      <div class="form-grid">
        <div class="form-full">
          <label>Mascota</label>
          <select id="appointmentPet" required>
            ${pets.map(p => `<option value="${p.id}">${escapeHTML(p.name)}</option>`).join("")}
          </select>
        </div>
        <div>
          <label>Fecha</label>
          <input id="appointmentDate" type="date" required>
        </div>
        <div>
          <label>Hora</label>
          <input id="appointmentTime" type="time" required>
        </div>
        <div>
          <label>Veterinario</label>
          <input id="appointmentVet" placeholder="Nombre del veterinario">
        </div>
        <div>
          <label>Motivo</label>
          <input id="appointmentReason" required placeholder="Consulta, vacuna, revisión...">
        </div>
        <div class="form-full">
          <label>Notas</label>
          <textarea id="appointmentNotes" placeholder="Información adicional"></textarea>
        </div>
      </div>
      <button class="btn btn-dark full" type="submit">Guardar cita</button>
    </form>
  `);

  const today = new Date().toISOString().split("T")[0];
  $("#appointmentDate").min = today;

  $("#appointmentForm").addEventListener("submit", (event) => {
    event.preventDefault();

    const user = currentUser();
    user.appointments.push({
      id: uid("appt"),
      petId: $("#appointmentPet").value,
      date: $("#appointmentDate").value,
      time: $("#appointmentTime").value,
      vet: $("#appointmentVet").value.trim(),
      reason: $("#appointmentReason").value.trim(),
      notes: $("#appointmentNotes").value.trim(),
      status: "Pendiente"
    });

    saveDatabase();
    closeModal();
    renderAll();
    showSection("citas");
    showToast("Cita guardada correctamente");
  });
}

function openHistoryModal(preselectedPetId = "") {
  const pets = getPets();

  if (!pets.length) {
    showToast("Primero registra una mascota");
    showSection("mascotas");
    return;
  }

  openModal(`
    <h2>Agregar consulta médica</h2>
    <p class="muted">Agrega el diagnóstico y tratamiento para que aparezca en el historial.</p>
    <form id="historyForm">
      <div class="form-grid">
        <div class="form-full">
          <label>Mascota</label>
          <select id="historyPet" required>
            ${pets.map(p => `<option value="${p.id}" ${p.id === preselectedPetId ? "selected" : ""}>${escapeHTML(p.name)}</option>`).join("")}
          </select>
        </div>
        <div>
          <label>Fecha</label>
          <input id="historyDate" type="date" required>
        </div>
        <div>
          <label>Veterinario</label>
          <input id="historyVet" placeholder="Nombre del veterinario">
        </div>
        <div class="form-full">
          <label>Consulta</label>
          <input id="historyConsultation" required placeholder="Ej. Revisión general">
        </div>
        <div class="form-full">
          <label>Diagnóstico</label>
          <textarea id="historyDiagnosis" required></textarea>
        </div>
        <div class="form-full">
          <label>Tratamiento / vacunas</label>
          <textarea id="historyTreatment" required></textarea>
        </div>
      </div>
      <button class="btn btn-dark full" type="submit">Guardar en historial</button>
    </form>
  `);

  $("#historyDate").value = new Date().toISOString().split("T")[0];

  $("#historyForm").addEventListener("submit", (event) => {
    event.preventDefault();

    const user = currentUser();
    user.history.push({
      id: uid("history"),
      petId: $("#historyPet").value,
      date: $("#historyDate").value,
      vet: $("#historyVet").value.trim(),
      consultation: $("#historyConsultation").value.trim(),
      diagnosis: $("#historyDiagnosis").value.trim(),
      treatment: $("#historyTreatment").value.trim()
    });

    saveDatabase();
    closeModal();
    renderAll();
    showSection("historial");
    showToast("Consulta agregada al historial");
  });
}

function deletePet(petId) {
  const user = currentUser();
  const pet = user.pets.find(p => p.id === petId);
  if (!pet) return;

  if (!confirm(`¿Eliminar a ${pet.name}? También se eliminarán sus citas e historial médico.`)) return;

  user.pets = user.pets.filter(p => p.id !== petId);
  user.appointments = user.appointments.filter(a => a.petId !== petId);
  user.history = user.history.filter(h => h.petId !== petId);

  saveDatabase();
  renderAll();
  showToast("Mascota eliminada correctamente");
}

function completeAppointment(id) {
  const appointment = currentUser().appointments.find(a => a.id === id);
  if (!appointment) return;

  appointment.status = "Completada";
  saveDatabase();
  renderAll();
  showToast("Cita marcada como completada");
}

function cancelAppointment(id) {
  const appointment = currentUser().appointments.find(a => a.id === id);
  if (!appointment) return;

  appointment.status = "Cancelada";
  saveDatabase();
  renderAll();
  showToast("Cita cancelada");
}

function openHistoryForPet(petId) {
  showSection("historial");
  $("#historyPetFilter").value = petId;
  renderHistory();
}

function showSection(sectionId) {
  $$(".section").forEach(section => section.classList.remove("active-section"));
  const target = document.getElementById(sectionId);
  if (target) target.classList.add("active-section");

  $$(".nav-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.section === sectionId);
  });

  if (sectionId === "inicio") renderHome();
  if (sectionId === "mascotas") renderPets();
  if (sectionId === "citas") renderAppointments();
  if (sectionId === "historial") renderHistory();

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showToast(text) {
  const toast = $("#toast");
  toast.textContent = text;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2500);
}

$("#showRegister").addEventListener("click", showRegister);
$("#showLogin").addEventListener("click", showLogin);
$("#logoutBtn").addEventListener("click", logout);
$("#closeModal").addEventListener("click", closeModal);

$("#modal").addEventListener("click", (event) => {
  if (event.target === $("#modal")) closeModal();
});

$("#registerForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const name = $("#registerName").value.trim();
  const email = $("#registerEmail").value.trim().toLowerCase();
  const password = $("#registerPassword").value;
  const password2 = $("#registerPassword2").value;

  if (password !== password2) {
    showAuthMessage("Las contraseñas no coinciden.");
    return;
  }

  if (db.users.some(user => user.email === email)) {
    showAuthMessage("Ese correo ya tiene una cuenta.");
    return;
  }

  const passwordHash = await hashPassword(password);

  const newUser = {
    id: uid("user"),
    name,
    email,
    passwordHash,
    pets: [],
    appointments: [],
    history: [],
    createdAt: new Date().toISOString()
  };

  db.users.push(newUser);
  saveDatabase();

  currentUserId = newUser.id;
  localStorage.setItem(SESSION_KEY, currentUserId);

  showAuthMessage("Cuenta creada correctamente.", "success");
  setTimeout(showApp, 300);
});

$("#loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = $("#loginEmail").value.trim().toLowerCase();
  const password = $("#loginPassword").value;
  const passwordHash = await hashPassword(password);

  const user = db.users.find(u => u.email === email && u.passwordHash === passwordHash);

  if (!user) {
    showAuthMessage("Correo o contraseña incorrectos.");
    return;
  }

  currentUserId = user.id;
  localStorage.setItem(SESSION_KEY, currentUserId);
  showApp();
});

$("#openPetModal").addEventListener("click", openPetModal);
$("#openAppointmentModal").addEventListener("click", openAppointmentModal);
$("#openHistoryModal").addEventListener("click", () => openHistoryModal());

$("#appointmentPetFilter").addEventListener("change", renderAppointments);
$("#appointmentStatusFilter").addEventListener("change", renderAppointments);
$("#historyPetFilter").addEventListener("change", renderHistory);

$$("[data-section]").forEach(button => {
  button.addEventListener("click", () => showSection(button.dataset.section));
});

if (currentUser()) {
  showApp();
} else {
  $("#authScreen").classList.remove("hidden");
  $("#app").classList.add("hidden");
}
