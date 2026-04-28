// State
let currentTab = 'home';
let stats = { total_income: 0, total_expense: 0, balance: 0 };
let transactions = [];
let currentFilter = 'All';
let currentNotesFilter = 'Important';
let selectedTxId = null;
let selectedBudgetIcon = '🏠';

let notes = [
    { id: 1, title: 'Grocery', time: '09:00', date: '2026-02-13', category: 'Important', icon: '🛒' },
    { id: 2, title: 'Dentist Appointment', time: '10:45', date: '2026-02-13', category: 'Important', icon: '🏥' },
    { id: 3, title: 'Math Class', time: '14:30', date: '2026-02-13', category: 'Important', icon: '📚' },
    { id: 4, title: 'Yoga Class', time: '15:00', date: '2026-02-14', category: 'Important', icon: '🧘' },
    { id: 5, title: 'Motor Service', time: '16:30', date: '2026-02-14', category: 'Important', icon: '🏍️' }
];
let budgets = [
    { id: 'Food', name: 'Food & Dining', amount: 500, icon: '🍔' },
    { id: 'Transport', name: 'Transport', amount: 200, icon: '🚗' },
    { id: 'Entertainment', name: 'Entertainment', amount: 150, icon: '🍿' },
    { id: 'Shopping', name: 'Shopping', amount: 300, icon: '🛍️' },
    { id: 'Bills', name: 'Bills & Utilities', amount: 400, icon: '💸' }
];
let savingsGoal = 0;
let globalMonthlyLimit = 850;
let pendingDelete = null;
let currentCurrency = 'USD';
const currencyRates = {
    USD: 1,
    INR: 83.12,
    EUR: 0.92,
    GBP: 0.79,
    JPY: 148.54,
    CAD: 1.35,
    AUD: 1.52
};
const currencySymbols = {
    USD: '$',
    INR: '₹',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    CAD: '$',
    AUD: '$'
};
const currencyIcons = {
    USD: 'attach_money',
    INR: 'currency_rupee',
    EUR: 'euro_symbol',
    GBP: 'currency_pound',
    JPY: 'currency_yen',
    CAD: 'attach_money',
    AUD: 'attach_money'
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadStats();
    loadTransactions();
    setupEventListeners();

    // Add Note Form
    const addNoteForm = document.getElementById('addNoteForm');
    if (addNoteForm) {
        addNoteForm.addEventListener('submit', handleAddNote);
    }

    // Initialize UI
    renderAllTransactions();
    renderBudgetScreen();
    renderAnalysisScreen();
    renderNotes();

    // Global Delete Confirmation
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    if (confirmDeleteBtn) {
        confirmDeleteBtn.onclick = handleConfirmDelete;
    }
});

// Event Listeners
function setupEventListeners() {
    document.querySelectorAll('.type-btn-exact').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const type = e.target.dataset.type;
            document.querySelectorAll('.type-btn-exact').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            document.getElementById('txType').value = type;
        });
    });

    document.getElementById('transactionForm').addEventListener('submit', handleTransactionSubmit);
    document.getElementById('budgetForm').addEventListener('submit', handleBudgetSubmit);
    
    // Savings Goal Form
    const savingsForm = document.getElementById('savingsGoalForm');
    if (savingsForm) {
        savingsForm.addEventListener('submit', handleSavingsGoalSubmit);
    }

    // Add Budget Category Form
    const budgetCatForm = document.getElementById('budgetCategoryForm');
    if (budgetCatForm) {
        budgetCatForm.addEventListener('submit', handleBudgetCategorySubmit);
    }

    // Icon Selector
    document.querySelectorAll('.icon-opt').forEach(opt => {
        opt.addEventListener('click', (e) => {
            document.querySelectorAll('.icon-opt').forEach(o => o.classList.remove('active'));
            e.target.classList.add('active');
            selectedBudgetIcon = e.target.textContent;
        });
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', function(event) {
        const dropdown = document.getElementById('filterDropdownMenu');
        if (dropdown && dropdown.classList.contains('show') && !event.target.closest('.custom-dropdown-container')) {
            dropdown.classList.remove('show');
        }
    });
}

function handleDownloadClick() {
    if (!selectedTxId) {
        showAlert('Selection Required', 'Please select a transaction first!', 'info');
        return;
    }
    showReceipt(selectedTxId);
}

// Navigation
function switchTab(tab, element) {
    currentTab = tab;
    
    // Update Nav Active State
    document.querySelectorAll('.bottom-nav .nav-item').forEach(item => item.classList.remove('active'));
    if (element) {
        element.classList.add('active');
    } else {
        document.querySelectorAll('.bottom-nav .nav-item').forEach(item => {
            if (item.getAttribute('onclick') && item.getAttribute('onclick').includes(`'${tab}'`)) {
                item.classList.add('active');
            }
        });
    }

    // Switch Views
    document.querySelectorAll('.view').forEach(v => {
        v.classList.add('hidden');
        v.classList.remove('active');
    });
    
    const targetView = document.getElementById(`${tab}View`);
    if (targetView) {
        targetView.classList.remove('hidden');
        targetView.classList.add('active');
    }

    // Call screen-specific renders
    if (tab === 'home') renderAllTransactions();
    if (tab === 'analysis') renderAnalysisScreen();
    if (tab === 'notes') renderNotes();
    if (tab === 'transactions') renderAllTransactions();
    if (tab === 'settings') renderSettingsScreen();
}

function showAlert(title, message, type = 'success') {
    const titleEl = document.getElementById('alertTitle');
    const msgEl = document.getElementById('alertMessage');
    const iconEl = document.getElementById('alertIcon');
    const iconBox = document.getElementById('alertIconBox');
    
    if (titleEl) titleEl.innerText = title;
    if (msgEl) msgEl.innerText = message;
    
    if (iconBox) {
        iconBox.className = 'alert-icon-circle ' + (type === 'info' ? 'info' : '');
    }
    
    if (iconEl) {
        iconEl.innerText = type === 'info' ? 'info' : 'check_circle';
    }
    
    openModal('alertModal');
}

// Modals
function openModal(modalId, txType = null) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.add('active');
    if (modalId === 'addTransactionModal') {
        const typeBtns = document.querySelectorAll('.type-btn-exact');
        document.getElementById('transactionForm').reset();
        document.getElementById('txId').value = "";
        document.getElementById('submitBtn').textContent = "Add Transaction";
        document.getElementById('txDateDisplay').value = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        document.getElementById('scanStatus').classList.add('hidden');
        if (txType) {
            document.getElementById('txType').value = txType;
            typeBtns.forEach(btn => {
                if (btn.dataset.type === txType) btn.classList.add('active');
                else btn.classList.remove('active');
            });
        }
    }
}

function renderSettingsScreen() {
    const isDark = document.body.classList.contains('dark-theme');
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) themeToggle.checked = isDark;
}

function toggleTheme() {
    const isDark = document.getElementById('themeToggle').checked;
    if (isDark) {
        document.body.classList.add('dark-theme');
    } else {
        document.body.classList.remove('dark-theme');
    }
}

function handleCurrencyChange(currency) {
    currentCurrency = currency;
    
    // Update Home Currency Badge
    const badge = document.querySelector('.currency-badge');
    if (badge) {
        const iconName = currencyIcons[currency];
        badge.innerHTML = `<span class="material-symbols-rounded" style="font-size:14px; background: #000; color: #fff; border-radius: 50%; padding: 2px; margin-right: 4px;">${iconName}</span> ${currency}`;
    }

    // Refresh All Screens to show new currency
    loadStats();
    loadTransactions();
    renderAnalysisScreen();
    renderBudgetScreen();
    renderSavingsScreen();
}

function formatMoney(amount) {
    const converted = amount * currencyRates[currentCurrency];
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currentCurrency,
        currencyDisplay: 'symbol'
    }).format(converted);
}

function saveAccountDetails() {
    const newName = document.getElementById('accName').value;
    const newEmail = document.getElementById('accEmail').value;
    
    // Update Home Header
    const userNameEl = document.querySelector('.user-name');
    if (userNameEl) userNameEl.textContent = newName;
    
    closeModal('manageAccountModal');
    showAlert('Profile Updated', 'Your account details have been updated successfully!');
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
}

// Receipt Logic
function showReceipt(id) {
    const tx = transactions.find(t => t.id === id);
    if (!tx) return;

    const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
    const isIncome = tx.type === 'income';
    
    document.getElementById('receiptAmount').textContent = `${isIncome ? '' : '-'}${formatter.format(tx.amount)}`;
    document.getElementById('receiptAmount').style.color = '#000'; // Always black in this design
    document.getElementById('receiptNote').textContent = tx.note || 'None';
    document.getElementById('receiptCategory').textContent = tx.category;
    document.getElementById('receiptDate').textContent = new Date(tx.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    
    const receiptIdEl = document.getElementById('receiptId');
    if (receiptIdEl) {
        receiptIdEl.textContent = `Transaction - #TXN-${tx.id}${Math.floor(Math.random() * 1000)}`;
    }

    openModal('receiptModal');
}

function selectTransaction(id, element) {
    selectedTxId = id;
    document.querySelectorAll('.tx-item').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected');
}

function renderNotes() {
    const list = document.getElementById('notesList');
    if (!list) return;
    list.innerHTML = '';

    const filtered = notes.filter(n => n.category === currentNotesFilter);
    
    const groups = {};
    filtered.sort((a, b) => new Date(a.date) - new Date(b.date)).forEach(note => {
        const dateStr = formatDateLabel(note.date);
        if (!groups[dateStr]) groups[dateStr] = [];
        groups[dateStr].push(note);
    });

    for (const [date, items] of Object.entries(groups)) {
        const groupEl = document.createElement('div');
        groupEl.className = 'notes-date-group';
        groupEl.innerHTML = `<h4 class="notes-date-label">${date}</h4>`;
        
        items.forEach(item => {
            const card = document.createElement('div');
            card.className = `note-item-card ${item.completed ? 'completed' : ''}`;
            card.innerHTML = `
                <div class="note-content-left">
                    <div class="note-check-box ${item.completed ? 'checked' : ''}" onclick="event.stopPropagation(); toggleNoteComplete(${item.id})">
                        <span class="material-symbols-rounded">check</span>
                    </div>
                    <div class="note-icon-box">${item.icon || '📝'}</div>
                    <div class="note-text-info">
                        <h3>${item.title}</h3>
                        <p>${item.time}</p>
                    </div>
                </div>
                <div class="note-actions">
                    <button class="note-action-btn edit" onclick="event.stopPropagation(); editNote(${item.id})">
                        <span class="material-symbols-rounded">edit</span>
                    </button>
                    <button class="note-action-btn delete" onclick="event.stopPropagation(); deleteNote(${item.id})">
                        <span class="material-symbols-rounded">delete</span>
                    </button>
                </div>
            `;
            groupEl.appendChild(card);
        });
        
        list.appendChild(groupEl);
    }
    
    if (filtered.length === 0) {
        list.innerHTML = `<div style="text-align: center; padding: 60px 20px;"><p style="color: #94a3b8;">No tasks found.</p></div>`;
    }
}

function toggleNoteComplete(id) {
    const note = notes.find(n => n.id === id);
    if (note) {
        note.completed = !note.completed;
        renderNotes();
    }
}

function formatDateLabel(dateStr) {
    const options = { day: 'numeric', month: 'short', weekday: 'short' };
    return new Date(dateStr).toLocaleDateString('en-GB', options);
}

function filterNotes(category, element) {
    currentNotesFilter = category;
    document.getElementById('notesTitle').innerText = category;
    document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
    element.classList.add('active');
    renderNotes();
}

function deleteNote(id) {
    pendingDelete = { id, type: 'note' };
    openModal('deleteConfirmModal');
}

function handleConfirmDelete() {
    if (!pendingDelete) return;

    const { id, type } = pendingDelete;
    
    if (type === 'note') {
        notes = notes.filter(n => n.id !== id);
        renderNotes();
        closeModal('deleteConfirmModal');
    } else if (type === 'transaction') {
        executeTransactionDeletion(id);
    }
    
    pendingDelete = null;
}

async function executeTransactionDeletion(id) {
    try {
        const res = await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
        if (res.ok) { 
            loadStats(); 
            loadTransactions(); 
            closeModal('deleteConfirmModal');
        }
    } catch (e) { 
        console.error(e); 
        closeModal('deleteConfirmModal');
    }
}

function editNote(id) {
    const note = notes.find(n => n.id === id);
    if (!note) return;

    // Pre-fill form
    document.getElementById('noteTitle').value = note.title;
    document.getElementById('noteTime').value = note.time;
    document.getElementById('noteDate').value = note.date;
    document.getElementById('noteCategory').value = note.category;
    
    // Set ID for editing
    document.getElementById('addNoteForm').dataset.editId = id;
    
    // Update modal title
    document.querySelector('#addNoteModal h3').innerText = 'Edit Reminder';
    
    openModal('addNoteModal');
}

function handleAddNote(e) {
    e.preventDefault();
    const form = e.target;
    const editId = form.dataset.editId;
    
    const title = document.getElementById('noteTitle').value;
    const time = document.getElementById('noteTime').value;
    const date = document.getElementById('noteDate').value;
    const category = document.getElementById('noteCategory').value;

    if (editId) {
        // Edit existing
        const noteIndex = notes.findIndex(n => n.id == editId);
        if (noteIndex > -1) {
            notes[noteIndex] = { ...notes[noteIndex], title, time, date, category };
        }
        delete form.dataset.editId;
        document.querySelector('#addNoteModal h3').innerText = 'Add New Reminder';
    } else {
        // Add new
        const newNote = {
            id: Date.now(),
            title,
            time,
            date,
            category,
            icon: '📝'
        };
        notes.push(newNote);
    }

    renderNotes();
    closeModal('addNoteModal');
    form.reset();
}

// Global Modal Functions
function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.add('active');
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('active');
}

// Sub Navigation for Analysis
function switchAnalysisTab(tab) {
    document.querySelectorAll('.sub-nav-pill').forEach(pill => {
        pill.classList.remove('active');
        if (pill.textContent.toLowerCase() === tab) pill.classList.add('active');
    });
    document.querySelectorAll('.sub-view').forEach(view => {
        view.classList.add('hidden');
        view.classList.remove('active');
    });
    document.getElementById(`sub${tab.charAt(0).toUpperCase() + tab.slice(1)}`).classList.remove('hidden');
    document.getElementById(`sub${tab.charAt(0).toUpperCase() + tab.slice(1)}`).classList.add('active');
    
    if (tab === 'analysis') renderAnalysisScreen();
    if (tab === 'budget') renderBudgetScreen();
    if (tab === 'savings') renderSavingsScreen();
}

function renderAnalysisScreen() {
    document.getElementById('analysisTotalSpent').textContent = formatMoney(stats.balance);
    document.getElementById('analysisIncome').textContent = formatMoney(stats.total_income);
    document.getElementById('analysisBudgetTotal').textContent = formatMoney(stats.total_expense);
    
    const chart = document.getElementById('analysisChart');
    chart.innerHTML = '';
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    days.forEach(day => {
        const height = Math.floor(Math.random() * 60 + 20);
        chart.insertAdjacentHTML('beforeend', `<div class="bar" style="height: ${height}%;"><span class="day">${day}</span></div>`);
    });
    
    renderCategoryBreakdown();
}

function renderBudgetScreen() {
    // Calculate total spent across all expenses
    const totalSpentGlobal = transactions
        .filter(t => t.type === 'expense')
        .reduce((acc, t) => acc + t.amount, 0);
        
    const percentGlobal = globalMonthlyLimit > 0 ? Math.min(Math.round((totalSpentGlobal / globalMonthlyLimit) * 100), 100) : 0;
    
    const card = document.querySelector('.budget-main-card');
    if (card) {
        card.querySelector('.spent-text').textContent = `${formatMoney(totalSpentGlobal)} of ${formatMoney(globalMonthlyLimit)}`;
        card.querySelector('.percent-text').textContent = `${percentGlobal}%`;
        card.querySelector('.progress-bar-fill').style.width = `${percentGlobal}%`;
        card.querySelector('.remaining-text span').textContent = `${formatMoney(Math.max(globalMonthlyLimit - totalSpentGlobal, 0))}`;
    }

    const list = document.getElementById('budgetCategoryList');
    if (list) {
        list.innerHTML = budgets.map(b => {
            // Calculate spent per specific category (matching the ID/Value from dropdown)
            const catSpent = transactions
                .filter(t => t.type === 'expense' && t.category === b.id)
                .reduce((acc, t) => acc + t.amount, 0);
            const catPercent = b.amount > 0 ? Math.min(Math.round((catSpent / b.amount) * 100), 100) : 0;
            
            return `
                <div class="tx-item" style="padding: 16px; background: white; margin-bottom: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.02);">
                    <div class="tx-icon-circle" style="background: #f8fafc; font-size: 24px;">${b.icon}</div>
                    <div class="tx-details">
                        <div class="tx-title">${b.name}</div>
                        <div style="height: 4px; background: #f1f5f9; border-radius: 2px; margin-top: 8px; width: 100%;">
                            <div style="height: 100%; width: ${catPercent}%; background: ${catPercent > 90 ? '#ef4444' : '#3b82f6'}; border-radius: 2px;"></div>
                        </div>
                    </div>
                    <div class="tx-right">
                        <div class="tx-amount" style="font-size: 15px;">${formatMoney(catSpent)} <span style="color: #94a3b8; font-weight: 500;">/ ${formatMoney(b.amount)}</span></div>
                    </div>
                </div>
            `;
        }).join('');
    }
}

async function handleBudgetCategorySubmit(e) {
    e.preventDefault();
    const name = e.target.querySelector('input[type="text"]').value;
    const amount = parseFloat(e.target.querySelector('input[type="number"]').value);
    
    budgets.push({ name, amount, icon: selectedBudgetIcon });
    
    e.target.reset();
    document.querySelectorAll('.icon-opt').forEach(o => o.classList.remove('active'));
    document.querySelector('.icon-opt').classList.add('active');
    selectedBudgetIcon = '🏠';
    
    closeModal('addBudgetCategoryModal');
    renderBudgetScreen();
}

async function handleSavingsGoalSubmit(e) {
    e.preventDefault();
    savingsGoal = parseFloat(document.getElementById('savingsGoalInput').value);
    closeModal('savingsGoalModal');
    renderSavingsScreen();
}

function renderSavingsScreen() {
    const currentSavings = stats.balance > 0 ? stats.balance : 0;
    const percent = savingsGoal > 0 ? Math.min(Math.round((currentSavings / savingsGoal) * 100), 100) : 0;
    const remaining = Math.max(savingsGoal - currentSavings, 0);

    document.querySelector('.savings-amount-big').textContent = formatMoney(currentSavings);
    document.querySelector('.progress-fill-glow').style.width = `${percent}%`;
    document.querySelector('.savings-meta').textContent = `${percent}% of ${formatMoney(savingsGoal)} goal`;
    
    document.querySelector('.val-green').textContent = formatMoney(stats.total_income);
    document.querySelector('.val-red').textContent = `-${formatMoney(stats.total_expense)}`;
    document.querySelector('.val-blue').textContent = formatMoney(currentSavings);
    document.querySelector('.val-black').textContent = formatMoney(remaining);
}

// Dropdown Logic
function toggleFilterDropdown(e) {
    if (e) e.stopPropagation();
    document.getElementById('filterDropdownMenu').classList.toggle('show');
}

function applyTimeFilter(filterType) {
    currentFilter = filterType;
    let btnText = 'Month';
    if (filterType === 'All') btnText = 'All Time';
    else if (filterType === 'Month') btnText = 'This Month';
    else if (filterType === 'Week') btnText = 'This Week';
    
    const textEl = document.getElementById('filterBtnText');
    if (textEl) textEl.textContent = btnText;
    
    document.getElementById('filterDropdownMenu').classList.remove('show');
    renderAllTransactions();
}

// CRUD Operations
async function deleteTransaction(id) {
    pendingDelete = { id, type: 'transaction' };
    openModal('deleteConfirmModal');
}

function editTransaction(id) {
    const tx = transactions.find(t => t.id === id);
    if (!tx) return;
    openModal('addTransactionModal');
    document.getElementById('txId').value = tx.id;
    document.getElementById('txNote').value = tx.note;
    document.getElementById('txAmount').value = tx.amount;
    document.getElementById('txCategory').value = tx.category;
    document.getElementById('txType').value = tx.type;
    document.getElementById('submitBtn').textContent = "Update Transaction";
    const typeBtns = document.querySelectorAll('.type-btn-exact');
    typeBtns.forEach(btn => {
        if (btn.dataset.type === tx.type) btn.classList.add('active');
        else btn.classList.remove('active');
    });
}

// Receipt Scanning
function simulateScan(input) {
    if (!input.files || !input.files[0]) return;
    const status = document.getElementById('scanStatus');
    const banner = document.getElementById('scanBanner');
    status.classList.remove('hidden');
    banner.classList.add('processing');
    banner.querySelector('h4').textContent = "Scanning...";
    setTimeout(() => {
        status.classList.add('hidden');
        banner.classList.remove('processing');
        banner.querySelector('h4').textContent = "Scan Receipt";
        document.getElementById('txNote').value = "Scanned Receipt Item";
        document.getElementById('txAmount').value = (Math.random() * 40 + 10).toFixed(2);
        document.getElementById('txCategory').value = "Shopping";
        input.value = ""; 
    }, 2000);
}

// API Calls
async function loadStats() {
    try {
        const res = await fetch('/api/stats');
        stats = await res.json();
        document.getElementById('totalBalance').textContent = formatMoney(stats.balance);
    } catch (e) { console.error(e); }
}

async function loadTransactions() {
    try {
        const res = await fetch('/api/transactions');
        transactions = await res.json();
        renderTransactions();
        if (currentTab === 'transactions') renderAllTransactions();
    } catch (e) { console.error(e); }
}

async function handleTransactionSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const txId = document.getElementById('txId').value;
    const isUpdate = txId !== "";
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;

    if (isUpdate) {
        const data = {
            type: document.getElementById('txType').value,
            amount: parseFloat(document.getElementById('txAmount').value),
            category: document.getElementById('txCategory').value,
            note: document.getElementById('txNote').value
        };
        try {
            const res = await fetch(`/api/transactions/${txId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (res.ok) { 
                closeModal('addTransactionModal'); 
                await loadStats(); 
                await loadTransactions(); 
                // Force re-render of all dependent screens
                renderAnalysisScreen();
                renderBudgetScreen();
                renderSavingsScreen();
            }
        } catch (e) { console.error(e); }
    } else {
        const formData = new FormData(form);
        try {
            const res = await fetch('/api/transactions', { method: 'POST', body: formData });
            if (res.ok) { 
                closeModal('addTransactionModal'); 
                await loadStats(); 
                await loadTransactions(); 
                renderAnalysisScreen();
                renderBudgetScreen();
                renderSavingsScreen();
            }
        } catch (e) { console.error(e); }
    }
    submitBtn.disabled = false;
}

function handleBudgetSubmit(e) {
    e.preventDefault();
    const newLimit = parseFloat(document.getElementById('budgetLimit').value);
    if (!isNaN(newLimit)) {
        globalMonthlyLimit = newLimit;
        renderBudgetScreen();
        closeModal('budgetModal');
        showAlert('Limit Updated', `Your monthly budget limit has been set to ${formatMoney(newLimit)}`);
    }
}

// Rendering
function renderTransactions() {
    const homeList = document.getElementById('homeTransactionsList');
    homeList.innerHTML = '';
    transactions.slice(0, 4).forEach((tx) => {
        const isIncome = tx.type === 'income';
        const iconName = tx.is_upi ? 'qr_code' : (isIncome ? 'north_east' : 'shopping_bag');
        const dateObj = new Date(tx.date);
        const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const html = `
            <div class="tx-item" onclick="selectTransaction(${tx.id}, this)">
                <div class="tx-icon-circle"><span class="material-symbols-rounded" style="color:#000;">${iconName}</span></div>
                <div class="tx-details">
                    <h4 class="tx-title">${tx.note || tx.category}</h4>
                    <p class="tx-subtitle">${dateStr} > ${tx.category} > John</p>
                </div>
                <div class="tx-right">
                    <div class="tx-amount" style="color: ${isIncome ? '#10b981' : '#f14444'}">
                        ${isIncome ? '+' : '-'}${formatMoney(tx.amount)}
                    </div>
                </div>
            </div>
        `;
        homeList.insertAdjacentHTML('beforeend', html);
    });
}

function renderAllTransactions() {
    const allList = document.getElementById('allTransactionsList');
    if (!allList) return;
    allList.innerHTML = '';

    let filteredTxs = transactions;
    const now = new Date();
    
    if (currentFilter === 'Month') {
        filteredTxs = transactions.filter(tx => {
            const d = new Date(tx.date);
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        });
    } else if (currentFilter === 'Week') {
        filteredTxs = transactions.filter(tx => {
            const d = new Date(tx.date);
            const diffTime = Math.abs(now - d);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
            return diffDays <= 7;
        });
    }

    if (filteredTxs.length === 0) {
        allList.innerHTML = '<p style="text-align:center; padding: 20px; color:#94a3b8;">No transactions found for this period.</p>';
        return;
    }

    filteredTxs.forEach((tx) => {
        const isIncome = tx.type === 'income';
        const iconName = tx.is_upi ? 'qr_code' : (isIncome ? 'account_balance_wallet' : 'shopping_bag');
        const dateObj = new Date(tx.date);
        const dateStr = dateObj.toLocaleDateString('en-GB');

        const html = `
            <div class="tx-item" onclick="selectTransaction(${tx.id}, this)">
                <div class="tx-icon-circle">
                    <span class="material-symbols-rounded" style="color: #000;">${iconName}</span>
                </div>
                <div class="tx-details">
                    <h4 class="tx-title">${tx.note || tx.category}</h4>
                    <p class="tx-subtitle">${dateStr} > ${tx.category} > John</p>
                </div>
                <div class="tx-right">
                    <div class="tx-amount" style="color: ${isIncome ? '#10b981' : '#f14444'}">
                        ${isIncome ? '+' : '-'}${formatMoney(tx.amount)}
                    </div>
                    <div class="tx-actions">
                        <div class="action-icon-pill edit" onclick="editTransaction(${tx.id}); event.stopPropagation();"><span class="material-symbols-rounded" style="font-size:20px;">edit</span></div>
                        <div class="action-icon-pill delete" onclick="deleteTransaction(${tx.id}); event.stopPropagation();"><span class="material-symbols-rounded" style="font-size:20px;">delete</span></div>
                    </div>
                </div>
            </div>
        `;
        allList.insertAdjacentHTML('beforeend', html);
    });
}

function renderCategoryBreakdown() {
    const catList = document.getElementById('categoryBreakdownList');
    if (!catList) return;
    const categories = {};
    transactions.forEach(tx => { if (tx.type === 'expense') categories[tx.category] = (categories[tx.category] || 0) + tx.amount; });
    catList.innerHTML = '';
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
    let i = 0;
    const total = Object.values(categories).reduce((a, b) => a + b, 0);
    for (const [cat, amt] of Object.entries(categories)) {
        const percent = total > 0 ? Math.round((amt / total) * 100) : 0;
        const html = `
            <div class="cat-breakdown-item" style="margin-bottom: 20px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span style="font-weight: 600; font-size: 14px;">${cat}</span>
                    <span style="font-weight: 700; font-size: 14px;">${formatMoney(amt)} <span style="color: #94a3b8; font-weight: 500;">${percent}%</span></span>
                </div>
                <div style="height: 6px; background: #f1f5f9; border-radius: 3px; overflow: hidden;">
                    <div style="height: 100%; width: ${percent}%; background: ${colors[i % colors.length]}; border-radius: 3px;"></div>
                </div>
            </div>`;
        catList.insertAdjacentHTML('beforeend', html);
        i++;
    }
}
