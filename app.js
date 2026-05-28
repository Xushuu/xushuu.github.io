/* =====================================================
   APP.JS — Agendamentos (Sala de Reunião & Motorista)
   =====================================================
   Firebase Realtime Database + Google Auth
   ===================================================== */

// ───── Firebase SDK Imports ─────
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js';
import {
  getDatabase,
  ref,
  push,
  set,
  remove,
  onValue
} from 'https://www.gstatic.com/firebasejs/12.13.0/firebase-database.js';
import {
  getAuth,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider
} from 'https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js';

// ───── Firebase Config ─────
const firebaseConfig = {
  apiKey: "AIzaSyAcIYydhlKtXmFyVfin4LUtI8RRIdPDaQM",
  authDomain: "agendamentos-cais.firebaseapp.com",
  databaseURL: "https://agendamentos-cais-default-rtdb.firebaseio.com",
  projectId: "agendamentos-cais",
  storageBucket: "agendamentos-cais.firebasestorage.app",
  messagingSenderId: "306453616190",
  appId: "1:306453616190:web:2dc5905bae52ec7905236f",
  measurementId: "G-MSEZKPHC0T"
};

// ───── Initialize Firebase ─────
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
const bookingsRef = ref(db, 'bookings');

// ───── Constants ─────
const TIME_SLOTS = [
  '07:00', '07:30',
  '08:00', '08:30',
  '09:00', '09:30',
  '10:00', '10:30',
  '11:00', '11:30',
  '12:00', '12:30',
  '13:00', '13:30',
  '14:00', '14:30',
  '15:00', '15:30',
  '16:00', '16:30',
  '17:00', '17:30',
  '18:00'
];

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

// ───── State ─────
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth();
let selectedDate = null;
let bookings = [];
let editingBookingId = null;
let currentUser = null; // Firebase Auth user

// ───── DOM References ─────
const $calendarGrid = document.getElementById('calendar-grid');
const $monthLabel = document.getElementById('calendar-month-label');
const $btnPrev = document.getElementById('btn-prev-month');
const $btnNext = document.getElementById('btn-next-month');
const $agendaDateLabel = document.getElementById('agenda-date-label');
const $timeslotsContainer = document.getElementById('timeslots-container');
const $emptyState = document.getElementById('empty-state');
const $btnNewBooking = document.getElementById('btn-new-booking');

// Modal — Form
const $modalOverlay = document.getElementById('modal-overlay');
const $bookingForm = document.getElementById('booking-form');
const $formDate = document.getElementById('form-date');
const $formTime = document.getElementById('form-time');
const $formDatetimeDisplay = document.getElementById('form-datetime-display');
const $formName = document.getElementById('form-name');
const $formEmail = document.getElementById('form-email');
const $formPeople = document.getElementById('form-people');
const $formNotes = document.getElementById('form-notes');
const $toggleReuniao = document.getElementById('toggle-reuniao');
const $toggleMotorista = document.getElementById('toggle-motorista');
const $btnCloseModal = document.getElementById('btn-close-modal');
const $btnCancelBooking = document.getElementById('btn-cancel-booking');
const $modalTitle = document.getElementById('modal-title');

// Modal — Detail
const $detailOverlay = document.getElementById('detail-overlay');
const $detailBody = document.getElementById('detail-body');
const $btnCloseDetail = document.getElementById('btn-close-detail');
const $btnCloseDetailBottom = document.getElementById('btn-close-detail-bottom');
const $btnEditBooking = document.getElementById('btn-edit-booking');
const $btnDeleteBooking = document.getElementById('btn-delete-booking');

// Auth
const $btnGoogleLogin = document.getElementById('btn-google-login');
const $userInfo = document.getElementById('user-info');
const $userAvatar = document.getElementById('user-avatar');
const $userName = document.getElementById('user-name');
const $btnLogout = document.getElementById('btn-logout');

// Toast
const $toast = document.getElementById('toast');

// ───── Auth — Google Login ─────
async function loginWithGoogle() {
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (error) {
    console.error('Login error:', error);
    if (error.code !== 'auth/popup-closed-by-user') {
      showToast('Erro ao fazer login com Google', true);
    }
  }
}

async function logout() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Logout error:', error);
  }
}

// Listen to auth state changes
onAuthStateChanged(auth, (user) => {
  currentUser = user;
  updateAuthUI();
  // Re-render agenda so edit buttons update based on ownership
  renderAgenda();
});

function updateAuthUI() {
  if (currentUser) {
    $btnGoogleLogin.style.display = 'none';
    $userInfo.style.display = 'flex';
    $userAvatar.src = currentUser.photoURL || '';
    $userName.textContent = currentUser.displayName || currentUser.email;
  } else {
    $btnGoogleLogin.style.display = 'inline-flex';
    $userInfo.style.display = 'none';
  }
}

// ───── Firebase Real-time Listener ─────
onValue(bookingsRef, (snapshot) => {
  bookings = [];
  if (snapshot.exists()) {
    snapshot.forEach((child) => {
      bookings.push({ id: child.key, ...child.val() });
    });
  }
  renderCalendar();
  renderAgenda();
}, (error) => {
  console.error('Firebase read error:', error);
  showToast('Erro ao conectar com o banco de dados', true);
});

// ───── Firebase CRUD ─────
async function createBooking(data) {
  try {
    const newRef = push(bookingsRef);
    await set(newRef, data);
    return newRef.key;
  } catch (error) {
    console.error('Firebase write error:', error);
    showToast('Erro ao salvar agendamento', true);
    return null;
  }
}

async function updateBooking(id, data) {
  try {
    const bookingRef = ref(db, `bookings/${id}`);
    await set(bookingRef, data);
    return true;
  } catch (error) {
    console.error('Firebase update error:', error);
    showToast('Erro ao atualizar agendamento', true);
    return false;
  }
}

async function deleteBookingFromDB(id) {
  try {
    const bookingRef = ref(db, `bookings/${id}`);
    await remove(bookingRef);
    return true;
  } catch (error) {
    console.error('Firebase delete error:', error);
    showToast('Erro ao excluir agendamento', true);
    return false;
  }
}

// ───── Utility ─────
function dateKey(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function formatDateBR(dateStr) {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function formatWeekday(dateStr) {
  const date = new Date(dateStr + 'T12:00:00');
  const day = date.getDay();
  const days = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  return days[day];
}

function getBookingsForDate(dateStr) {
  return bookings.filter(b => b.date === dateStr);
}

function getBookingForSlot(dateStr, time) {
  return bookings.find(b => b.date === dateStr && b.time === time);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/** Check if the current logged-in user owns a booking */
function isOwner(booking) {
  return currentUser && booking.uid === currentUser.uid;
}

// ───── Calendar Rendering ─────
function renderCalendar() {
  $monthLabel.textContent = `${MONTH_NAMES[currentMonth]} ${currentYear}`;

  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const prevMonthDays = new Date(currentYear, currentMonth, 0).getDate();

  const today = new Date();
  const todayStr = dateKey(today.getFullYear(), today.getMonth(), today.getDate());

  $calendarGrid.innerHTML = '';

  for (let i = firstDay - 1; i >= 0; i--) {
    const day = prevMonthDays - i;
    $calendarGrid.appendChild(createDayElement(day, true));
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dk = dateKey(currentYear, currentMonth, d);
    $calendarGrid.appendChild(createDayElement(d, false, dk, dk === todayStr, dk === selectedDate));
  }

  const totalCells = $calendarGrid.children.length;
  const remaining = (7 - (totalCells % 7)) % 7;
  for (let i = 1; i <= remaining; i++) {
    $calendarGrid.appendChild(createDayElement(i, true));
  }
}

function createDayElement(day, isOtherMonth, dk = null, isToday = false, isSelected = false) {
  const el = document.createElement('button');
  el.className = 'calendar-day';
  el.textContent = day;

  if (isOtherMonth) {
    el.classList.add('other-month');
    el.setAttribute('tabindex', '-1');
  } else {
    if (isToday) el.classList.add('today');
    if (isSelected) el.classList.add('calendar-day--selected');

    const dayBookings = getBookingsForDate(dk);
    if (dayBookings.length > 0) {
      const indicators = document.createElement('div');
      indicators.className = 'day-indicators';

      if (dayBookings.some(b => b.type === 'reuniao')) {
        const dot = document.createElement('span');
        dot.className = 'day-indicator reuniao';
        indicators.appendChild(dot);
      }
      if (dayBookings.some(b => b.type === 'motorista')) {
        const dot = document.createElement('span');
        dot.className = 'day-indicator motorista';
        indicators.appendChild(dot);
      }

      el.appendChild(indicators);
    }

    el.addEventListener('click', () => selectDate(dk));
  }

  return el;
}

// ───── Date Selection ─────
function selectDate(dk) {
  selectedDate = dk;
  renderCalendar();
  renderAgenda();
}

// ───── Agenda (Right Panel) ─────
function renderAgenda() {
  if (!selectedDate) {
    $agendaDateLabel.textContent = 'Selecione um dia';
    $btnNewBooking.style.display = 'none';
    $timeslotsContainer.innerHTML = '';
    $timeslotsContainer.appendChild($emptyState);
    $emptyState.style.display = 'flex';
    return;
  }

  const weekday = formatWeekday(selectedDate);
  const dateBR = formatDateBR(selectedDate);
  $agendaDateLabel.textContent = `${weekday}, ${dateBR}`;
  $btnNewBooking.style.display = 'inline-flex';

  $timeslotsContainer.innerHTML = '';

  TIME_SLOTS.forEach(time => {
    const booking = getBookingForSlot(selectedDate, time);
    const slot = document.createElement('div');
    slot.className = 'timeslot';

    if (booking) {
      slot.classList.add('booked', `booked-${booking.type}`);
      slot.innerHTML = `
        <span class="timeslot-time">${time}</span>
        <div class="timeslot-content">
          <span class="timeslot-booked-name">${escapeHtml(booking.name)}</span>
          <div class="timeslot-booked-detail">${booking.people} pessoa${booking.people > 1 ? 's' : ''}</div>
        </div>
        <span class="timeslot-badge badge-${booking.type}">
          ${booking.type === 'reuniao' ? 'Reunião' : 'Motorista'}
        </span>
      `;
      slot.addEventListener('click', () => showDetail(booking));
    } else {
      slot.innerHTML = `
        <span class="timeslot-time">${time}</span>
        <span class="timeslot-content">Horário disponível</span>
        <span class="timeslot-status available">Livre</span>
      `;
      slot.addEventListener('click', () => {
        if (!currentUser) {
          showToast('Faça login com Google para agendar', true);
          return;
        }
        openBookingModal(selectedDate, time);
      });
    }

    $timeslotsContainer.appendChild(slot);
  });
}

// ───── Booking Modal ─────
function openBookingModal(date, time, existingBooking = null) {
  if (!currentUser) {
    showToast('Faça login com Google para agendar', true);
    return;
  }

  editingBookingId = existingBooking ? existingBooking.id : null;

  $formDate.value = date;
  $formTime.value = time;

  const weekday = formatWeekday(date);
  const dateBR = formatDateBR(date);
  $formDatetimeDisplay.value = `${weekday}, ${dateBR} — ${time}`;

  if (existingBooking) {
    $modalTitle.textContent = 'Editar Agendamento';
    $formName.value = existingBooking.name;
    $formEmail.value = existingBooking.email;
    $formPeople.value = existingBooking.people;
    $formNotes.value = existingBooking.notes || '';
    setActivityType(existingBooking.type);
  } else {
    $modalTitle.textContent = 'Novo Agendamento';
    $bookingForm.reset();
    $formDate.value = date;
    $formTime.value = time;
    $formDatetimeDisplay.value = `${weekday}, ${dateBR} — ${time}`;
    // Auto-fill from Google account
    $formName.value = currentUser.displayName || '';
    $formEmail.value = currentUser.email || '';
    $formPeople.value = 1;
    setActivityType('reuniao');
  }

  $formName.classList.remove('invalid');
  $formEmail.classList.remove('invalid');

  $modalOverlay.style.display = 'flex';
  requestAnimationFrame(() => $formName.focus());
}

function closeBookingModal() {
  $modalOverlay.style.display = 'none';
  editingBookingId = null;
}

function setActivityType(type) {
  $toggleReuniao.classList.toggle('active', type === 'reuniao');
  $toggleMotorista.classList.toggle('active', type === 'motorista');
}

function getSelectedType() {
  return $toggleMotorista.classList.contains('active') ? 'motorista' : 'reuniao';
}

// ───── Detail Modal ─────
let currentDetailBooking = null;

function showDetail(booking) {
  currentDetailBooking = booking;
  editingBookingId = booking.id;

  const typeName = booking.type === 'reuniao' ? 'Reunião' : 'Motorista';
  const dateBR = formatDateBR(booking.date);
  const weekday = formatWeekday(booking.date);

  $detailBody.innerHTML = `
    <div class="detail-row">
      <div class="detail-icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
      </div>
      <div class="detail-info">
        <label>Data & Horário</label>
        <span>${weekday}, ${dateBR} — ${booking.time}</span>
      </div>
    </div>

    <div class="detail-row">
      <div class="detail-icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
      </div>
      <div class="detail-info">
        <label>Responsável</label>
        <span>${escapeHtml(booking.name)}</span>
      </div>
    </div>

    <div class="detail-row">
      <div class="detail-icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
          <polyline points="22,6 12,13 2,6"/>
        </svg>
      </div>
      <div class="detail-info">
        <label>E-mail</label>
        <span>${escapeHtml(booking.email)}</span>
      </div>
    </div>

    <div class="detail-row">
      <div class="detail-icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      </div>
      <div class="detail-info">
        <label>Tipo de Atividade</label>
        <span class="detail-type-badge ${booking.type}">
          ${typeName}
        </span>
      </div>
    </div>

    <div class="detail-row">
      <div class="detail-icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      </div>
      <div class="detail-info">
        <label>Nº de Pessoas</label>
        <span>${booking.people}</span>
      </div>
    </div>

    ${booking.notes ? `
    <div class="detail-row">
      <div class="detail-icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="17" y1="10" x2="3" y2="10"/>
          <line x1="21" y1="6" x2="3" y2="6"/>
          <line x1="21" y1="14" x2="3" y2="14"/>
          <line x1="17" y1="18" x2="3" y2="18"/>
        </svg>
      </div>
      <div class="detail-info">
        <label>Observações</label>
        <span>${escapeHtml(booking.notes)}</span>
      </div>
    </div>
    ` : ''}
  `;

  // Show edit/delete buttons ONLY if the logged-in user is the owner
  const ownerDisplay = isOwner(booking) ? 'inline-flex' : 'none';
  $btnEditBooking.style.display = ownerDisplay;
  $btnDeleteBooking.style.display = ownerDisplay;

  $detailOverlay.style.display = 'flex';
}

function closeDetailModal() {
  $detailOverlay.style.display = 'none';
  editingBookingId = null;
  currentDetailBooking = null;
}

/** Delete the current booking after ownership check and confirmation */
async function handleDeleteBooking() {
  if (!currentDetailBooking || !isOwner(currentDetailBooking)) {
    showToast('Você só pode excluir seus próprios agendamentos', true);
    return;
  }
  if (!confirm('Tem certeza que deseja excluir este agendamento?')) return;

  const success = await deleteBookingFromDB(currentDetailBooking.id);
  if (success) {
    closeDetailModal();
    showToast('Agendamento excluído');
  }
}

/** Open the booking form pre-filled with the current detail data for editing */
function handleEditBooking() {
  if (!currentDetailBooking || !isOwner(currentDetailBooking)) {
    showToast('Você só pode editar seus próprios agendamentos', true);
    return;
  }
  const booking = currentDetailBooking;
  closeDetailModal();
  openBookingModal(booking.date, booking.time, booking);
}

// ───── Save Booking ─────
async function handleFormSubmit(e) {
  e.preventDefault();

  if (!currentUser) {
    showToast('Faça login para salvar', true);
    return;
  }

  const name = $formName.value.trim();
  const email = $formEmail.value.trim();
  const people = parseInt($formPeople.value, 10) || 1;
  const notes = $formNotes.value.trim();
  const type = getSelectedType();
  const date = $formDate.value;
  const time = $formTime.value;

  // Validation
  let valid = true;
  $formName.classList.remove('invalid');
  $formEmail.classList.remove('invalid');

  if (!name) {
    $formName.classList.add('invalid');
    valid = false;
  }
  if (!email || !email.includes('@')) {
    $formEmail.classList.add('invalid');
    valid = false;
  }

  if (!valid) {
    showToast('Preencha todos os campos obrigatórios', true);
    return;
  }

  // Check conflict
  const existing = getBookingForSlot(date, time);
  if (existing && existing.id !== editingBookingId) {
    showToast('Este horário já está ocupado!', true);
    return;
  }

  const bookingData = {
    date,
    time,
    name,
    email,
    people,
    notes,
    type,
    uid: currentUser.uid,
    createdAt: new Date().toISOString()
  };

  if (editingBookingId) {
    // Verify ownership before updating
    const original = bookings.find(b => b.id === editingBookingId);
    if (original && original.uid !== currentUser.uid) {
      showToast('Você só pode editar seus próprios agendamentos', true);
      return;
    }
    const success = await updateBooking(editingBookingId, bookingData);
    if (success) {
      closeBookingModal();
      showToast('Agendamento atualizado!');
    }
  } else {
    const newId = await createBooking(bookingData);
    if (newId) {
      closeBookingModal();
      showToast('Agendamento salvo com sucesso!');
    }
  }
}

// ───── Toast ─────
function showToast(message, isError = false) {
  $toast.textContent = message;
  $toast.className = 'toast' + (isError ? ' error' : '');
  void $toast.offsetWidth;
  $toast.classList.add('show');
  setTimeout(() => {
    $toast.classList.remove('show');
  }, 2800);
}

// ───── Event Listeners ─────

// Auth
$btnGoogleLogin.addEventListener('click', loginWithGoogle);
$btnLogout.addEventListener('click', logout);

// Calendar nav
$btnPrev.addEventListener('click', () => {
  currentMonth--;
  if (currentMonth < 0) { currentMonth = 11; currentYear--; }
  renderCalendar();
});

$btnNext.addEventListener('click', () => {
  currentMonth++;
  if (currentMonth > 11) { currentMonth = 0; currentYear++; }
  renderCalendar();
});

$btnNewBooking.addEventListener('click', () => {
  if (!currentUser) {
    showToast('Faça login com Google para agendar', true);
    return;
  }
  if (!selectedDate) return;
  const firstAvailable = TIME_SLOTS.find(t => !getBookingForSlot(selectedDate, t));
  if (firstAvailable) {
    openBookingModal(selectedDate, firstAvailable);
  } else {
    showToast('Todos os horários deste dia estão ocupados!', true);
  }
});

// Modal form
$bookingForm.addEventListener('submit', handleFormSubmit);
$btnCloseModal.addEventListener('click', closeBookingModal);
$btnCancelBooking.addEventListener('click', closeBookingModal);
$modalOverlay.addEventListener('click', (e) => {
  if (e.target === $modalOverlay) closeBookingModal();
});

// Toggle buttons
$toggleReuniao.addEventListener('click', () => setActivityType('reuniao'));
$toggleMotorista.addEventListener('click', () => setActivityType('motorista'));

// Detail modal
$btnCloseDetail.addEventListener('click', closeDetailModal);
$btnCloseDetailBottom.addEventListener('click', closeDetailModal);
$btnEditBooking.addEventListener('click', handleEditBooking);
$btnDeleteBooking.addEventListener('click', handleDeleteBooking);
$detailOverlay.addEventListener('click', (e) => {
  if (e.target === $detailOverlay) closeDetailModal();
});

// Keyboard — ESC
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if ($modalOverlay.style.display !== 'none') closeBookingModal();
    if ($detailOverlay.style.display !== 'none') closeDetailModal();
  }
});

// ───── Init ─────
const today = new Date();
selectedDate = dateKey(today.getFullYear(), today.getMonth(), today.getDate());
renderCalendar();
renderAgenda();
