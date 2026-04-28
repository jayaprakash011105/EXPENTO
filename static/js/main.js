// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyDNqydipSdOVXIJFRKWcrMjXajeAK0moEk",
    authDomain: "expento-005.firebaseapp.com",
    projectId: "expento-005",
    storageBucket: "expento-005.firebasestorage.app",
    messagingSenderId: "188082132004",
    appId: "1:188082132004:web:5d9a070206898e471174b1",
    measurementId: "G-5T63GN28F2"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// State
let currentUser = null;
let isSignUpMode = false;
let currentTab = 'home';
let stats = { total_income: 0, total_expense: 0, balance: 0 };
let transactions = [];
let currentFilter = 'All';
let currentNotesFilter = 'Important';
let selectedTxId = null;
let selectedBudgetIcon = '🏠';

let notes = [];
let budgets = [];
let savingsGoal = 0;
let globalMonthlyLimit = 850;
let pendingDelete = null;
let currentCurrency = 'USD';
let bills = [];
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
    // Check Auth State
    auth.onAuthStateChanged((user) => {
        if (user) {
            currentUser = user;
            document.getElementById('authView').classList.add('hidden');
            document.getElementById('authView').classList.remove('active');
            document.getElementById('mainNav').style.display = 'flex';
            
            // Set user email in settings
            const accEmailEl = document.getElementById('accEmail');
            if (accEmailEl) accEmailEl.value = user.email;
            
            // Load Real-time Data
            syncTransactions();
            syncNotes();
            syncUserSettings();
            syncBudgets();
            syncBills();
            
            switchTab('home');
        } else {
            currentUser = null;
            document.getElementById('mainNav').style.display = 'none';
            document.querySelectorAll('.view').forEach(v => {
                v.classList.add('hidden');
                v.classList.remove('active');
            });
            document.getElementById('authView').classList.remove('hidden');
            document.getElementById('authView').classList.add('active');
        }
    });

    // Theme logic
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
    }

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

// Authentication Methods
function toggleAuthMode() {
    isSignUpMode = !isSignUpMode;
    const btn = document.getElementById('authSubmitBtn');
    const toggleText = document.getElementById('authToggleText');
    const toggleLink = document.getElementById('authToggleLink');
    
    if (isSignUpMode) {
        btn.textContent = 'Sign Up';
        toggleText.textContent = 'Already have an account?';
        toggleLink.textContent = 'Sign In';
    } else {
        btn.textContent = 'Sign In';
        toggleText.textContent = "Don't have an account?";
        toggleLink.textContent = 'Sign Up';
    }
}

async function handleAuthSubmit(e) {
    e.preventDefault();
    const email = document.getElementById('authEmail').value;
    const password = document.getElementById('authPassword').value;
    const btn = document.getElementById('authSubmitBtn');
    
    btn.disabled = true;
    btn.textContent = 'Please wait...';
    
    try {
        if (isSignUpMode) {
            await auth.createUserWithEmailAndPassword(email, password);
        } else {
            await auth.signInWithEmailAndPassword(email, password);
        }
    } catch (error) {
        console.error(error);
        showAlert('Authentication Error', error.message, 'info');
    } finally {
        btn.disabled = false;
        btn.textContent = isSignUpMode ? 'Sign Up' : 'Sign In';
    }
}

function handleLogout() {
    auth.signOut().then(() => {
        // Reset state
        transactions = [];
        stats = { total_income: 0, total_expense: 0, balance: 0 };
    }).catch((error) => {
        console.error("Sign Out Error", error);
    });
}

// Navigation
function switchTab(tab, element) {
    currentTab = tab;
    
    // Prevent navigation if not authenticated
    if (!currentUser && tab !== 'auth') return;
    
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
    if (tab === 'home') renderTransactions();
    if (tab === 'analysis') renderAnalysisScreen();
    if (tab === 'notes') renderNotes();
    if (tab === 'transactions') renderAllTransactions();
    if (tab === 'settings') renderSettingsScreen();
    if (tab === 'bills') renderBills();
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
            if (txType === 'upi') {
                document.getElementById('txType').value = 'expense';
                document.getElementById('txIsUpi').value = 'true';
                typeBtns.forEach(btn => {
                    if (btn.dataset.type === 'expense') btn.classList.add('active');
                    else btn.classList.remove('active');
                });
            } else {
                document.getElementById('txType').value = txType;
                document.getElementById('txIsUpi').value = 'false';
                typeBtns.forEach(btn => {
                    if (btn.dataset.type === txType) btn.classList.add('active');
                    else btn.classList.remove('active');
                });
            }
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

async function saveAccountDetails() {
    const newName = document.getElementById('accName').value;
    
    if (currentUser) {
        try {
            await db.collection('users').doc(currentUser.uid).set({
                displayName: newName
            }, { merge: true });
            
            closeModal('manageAccountModal');
            showAlert('Profile Updated', 'Your account details have been updated successfully!');
        } catch (e) {
            console.error(e);
            showAlert('Error', 'Failed to update profile', 'info');
        }
    }
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
                    <div class="note-check-box ${item.completed ? 'checked' : ''}" onclick="event.stopPropagation(); toggleNoteComplete('${item.id}')">
                        <span class="material-symbols-rounded">check</span>
                    </div>
                    <div class="note-icon-box">${item.icon || '📝'}</div>
                    <div class="note-text-info">
                        <h3>${item.title}</h3>
                        <p>${item.time}</p>
                    </div>
                </div>
                <div class="note-actions">
                    <button class="note-action-btn edit" onclick="event.stopPropagation(); editNote('${item.id}')">
                        <span class="material-symbols-rounded">edit</span>
                    </button>
                    <button class="note-action-btn delete" onclick="event.stopPropagation(); deleteNote('${item.id}')">
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

function deleteNote(id) {
    pendingDelete = { id, type: 'note' };
    openModal('deleteConfirmModal');
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

async function handleAddNote(e) {
    e.preventDefault();
    if (!currentUser) return;
    const form = e.target;
    const editId = form.dataset.editId;
    
    const title = document.getElementById('noteTitle').value;
    const time = document.getElementById('noteTime').value;
    const date = document.getElementById('noteDate').value;
    const category = document.getElementById('noteCategory').value;

    const noteData = {
        title, time, date, category,
        icon: '📝',
        completed: false
    };

    try {
        const userNotes = db.collection('users').doc(currentUser.uid).collection('notes');
        if (editId) {
            await userNotes.doc(editId).update(noteData);
            delete form.dataset.editId;
            document.querySelector('#addNoteModal h3').innerText = 'Add New Reminder';
        } else {
            await userNotes.add(noteData);
        }
        closeModal('addNoteModal');
        form.reset();
    } catch (e) { console.error(e); }
}

async function toggleNoteComplete(id) {
    if (!currentUser) return;
    const note = notes.find(n => n.id === id);
    if (note) {
        try {
            await db.collection('users').doc(currentUser.uid).collection('notes').doc(id).update({
                completed: !note.completed
            });
        } catch (e) { console.error(e); }
    }
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
    if (!chart) return;
    chart.innerHTML = '';
    
    // Calculate last 7 days spending
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const now = new Date();
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(now.getDate() - i);
        last7Days.push(d);
    }
    
    let maxSpent = 0;
    const dailyTotals = last7Days.map(d => {
        const dStr = d.toDateString();
        const spent = transactions
            .filter(t => t.type === 'expense' && new Date(t.date).toDateString() === dStr)
            .reduce((sum, t) => sum + t.amount, 0);
        if (spent > maxSpent) maxSpent = spent;
        return { day: days[d.getDay()], date: dStr, amount: spent };
    });

    dailyTotals.forEach(data => {
        const height = maxSpent > 0 ? Math.max((data.amount / maxSpent) * 80, 5) : 5;
        chart.insertAdjacentHTML('beforeend', `<div class="bar" style="height: ${height}%;" title="${data.date}: ${formatMoney(data.amount)}"><span class="day">${data.day}</span></div>`);
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
            // Calculate spent per specific category
            const catSpent = transactions
                .filter(t => t.type === 'expense' && t.category === b.name)
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
    if (!currentUser) return;

    const name = e.target.querySelector('input[type="text"]').value;
    const amount = parseFloat(e.target.querySelector('input[type="number"]').value);
    
    try {
        await db.collection('users').doc(currentUser.uid).collection('budgets').add({
            name,
            amount,
            icon: selectedBudgetIcon
        });
        
        e.target.reset();
        document.querySelectorAll('.icon-opt').forEach(o => o.classList.remove('active'));
        document.querySelector('.icon-opt').classList.add('active');
        selectedBudgetIcon = '🏠';
        
        closeModal('addBudgetCategoryModal');
    } catch (e) {
        console.error(e);
        showAlert('Error', 'Failed to add budget category', 'info');
    }
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

// Deletion Logic
async function deleteTransaction(id) {
    pendingDelete = { id, type: 'transaction' };
    openModal('deleteConfirmModal');
}

async function handleConfirmDelete() {
    if (!pendingDelete || !currentUser) return;
    
    try {
        const userDoc = db.collection('users').doc(currentUser.uid);
        if (pendingDelete.type === 'transaction') {
            await userDoc.collection('transactions').doc(pendingDelete.id).delete();
            showAlert('Deleted', 'Transaction removed successfully');
        } else if (pendingDelete.type === 'note') {
            await userDoc.collection('notes').doc(pendingDelete.id).delete();
            showAlert('Deleted', 'Note removed successfully');
        }
        
        closeModal('deleteConfirmModal');
        pendingDelete = null;
    } catch (e) {
        console.error(e);
        showAlert('Error', 'Failed to delete item', 'info');
    }
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

// API Calls & Firestore Sync
function loadStats() {
    const income = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
    const expense = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
    stats = { total_income: income, total_expense: expense, balance: income - expense };
    document.getElementById('totalBalance').textContent = formatMoney(stats.balance);
    renderAnalysisScreen();
    renderBudgetScreen();
    renderSavingsScreen();
}

function syncTransactions() {
    db.collection('users').doc(currentUser.uid).collection('transactions')
        .orderBy('date', 'desc')
        .onSnapshot(snap => {
            transactions = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderTransactions();
            if (currentTab === 'transactions') renderAllTransactions();
            loadStats();
        });
}

function syncNotes() {
    db.collection('users').doc(currentUser.uid).collection('notes')
        .orderBy('date', 'asc')
        .onSnapshot(snap => {
            notes = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderNotes();
        });
}

function syncBudgets() {
    db.collection('users').doc(currentUser.uid).collection('budgets')
        .onSnapshot(snap => {
            budgets = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            updateCategoryOptions();
            renderBudgetScreen();
        });
}

function syncBills() {
    db.collection('users').doc(currentUser.uid).collection('bills')
        .orderBy('dueDate', 'asc')
        .onSnapshot(snap => {
            bills = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderBills();
        });
}

async function handleBillSubmit(e) {
    e.preventDefault();
    if (!currentUser) return;
    
    const data = {
        name: document.getElementById('billName').value,
        amount: parseFloat(document.getElementById('billAmount').value),
        dueDate: document.getElementById('billDate').value,
        paid: false
    };

    try {
        await db.collection('users').doc(currentUser.uid).collection('bills').add(data);
        closeModal('addBillModal');
        e.target.reset();
        showAlert('Bill Added', 'Your bill has been scheduled.');
    } catch (e) { 
        console.error(e); 
        showAlert('Error', 'Failed to add bill', 'info');
    }
}

function renderBills() {
    const list = document.getElementById('billsList');
    if (!list) return;
    list.innerHTML = '';

    if (bills.length === 0) {
        list.innerHTML = '<div style="text-align: center; padding: 40px; color: #94a3b8;">No bills scheduled yet.</div>';
        return;
    }

    bills.forEach(bill => {
        const date = new Date(bill.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const html = `
            <div class="tx-item" style="background: white; padding: 16px; margin-bottom: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.02); opacity: ${bill.paid ? '0.6' : '1'}">
                <div class="tx-icon-circle" style="background: ${bill.paid ? '#f1f5f9' : '#fff1f2'}; color: ${bill.paid ? '#94a3b8' : '#ef4444'};">
                    <span class="material-symbols-rounded">${bill.paid ? 'check_circle' : 'receipt'}</span>
                </div>
                <div class="tx-details">
                    <div class="tx-title">${bill.name}</div>
                    <div class="tx-subtitle">Due ${date}</div>
                </div>
                <div class="tx-right">
                    <div class="tx-amount" style="font-weight: 700;">${formatMoney(bill.amount)}</div>
                    <button class="pill-btn-gray" style="font-size: 11px; padding: 4px 8px; margin-top: 5px;" onclick="toggleBillPaid('${bill.id}', ${bill.paid})">
                        ${bill.paid ? 'Mark Unpaid' : 'Mark Paid'}
                    </button>
                </div>
            </div>
        `;
        list.insertAdjacentHTML('beforeend', html);
    });
}

async function toggleBillPaid(id, currentStatus) {
    if (!currentUser) return;
    try {
        await db.collection('users').doc(currentUser.uid).collection('bills').doc(id).update({
            paid: !currentStatus
        });
    } catch (e) { console.error(e); }
}

function updateCategoryOptions() {
    const select = document.getElementById('txCategory');
    if (!select) return;
    const currentVal = select.value;
    let html = '';
    budgets.forEach(b => {
        html += `<option value="${b.name}">${b.name}</option>`;
    });
    // Add default unbudgeted categories
    const fixedCategories = ['Salary', 'Income', 'Other'];
    fixedCategories.forEach(cat => {
        if (!budgets.find(b => b.name === cat)) {
            html += `<option value="${cat}">${cat}</option>`;
        }
    });
    select.innerHTML = html;
    if (currentVal && Array.from(select.options).some(o => o.value === currentVal)) {
        select.value = currentVal;
    }
}

function syncUserSettings() {
    db.collection('users').doc(currentUser.uid).onSnapshot(doc => {
        if (doc.exists) {
            const data = doc.data();
            globalMonthlyLimit = data.monthlyLimit || 850;
            savingsGoal = data.savingsGoal || 0;
            
            const displayName = data.displayName || 'John Jacob';
            
            // Update UI Name and Avatar
            document.querySelectorAll('.user-name').forEach(el => el.textContent = displayName);
            document.querySelectorAll('.header-avatar').forEach(el => {
                el.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=1c1c1e&color=fff`;
            });
            
            const accNameInput = document.getElementById('accName');
            if (accNameInput) accNameInput.value = displayName;
            
            const accEmailInput = document.getElementById('accEmail');
            if (accEmailInput && currentUser) accEmailInput.value = currentUser.email;

            renderBudgetScreen();
            renderSavingsScreen();
        }
    });
}

async function handleBudgetSubmit(e) {
    e.preventDefault();
    const newLimit = parseFloat(document.getElementById('budgetLimit').value);
    if (!isNaN(newLimit) && currentUser) {
        try {
            await db.collection('users').doc(currentUser.uid).set({
                monthlyLimit: newLimit
            }, { merge: true });
            closeModal('budgetModal');
            showAlert('Limit Updated', `Your monthly budget limit has been set to ${formatMoney(newLimit)}`);
        } catch (e) { console.error(e); }
    }
}

async function handleSavingsGoalSubmit(e) {
    e.preventDefault();
    const newGoal = parseFloat(document.getElementById('savingsGoalInput').value);
    if (!isNaN(newGoal) && currentUser) {
        try {
            await db.collection('users').doc(currentUser.uid).set({
                savingsGoal: newGoal
            }, { merge: true });
            closeModal('savingsGoalModal');
            renderSavingsScreen();
        } catch (e) { console.error(e); }
    }
}

async function handleTransactionSubmit(e) {
    e.preventDefault();
    if (!currentUser) return;

    const txId = document.getElementById('txId').value;
    const isUpdate = txId !== "";
    const submitBtn = document.getElementById('submitBtn');
    
    const data = {
        type: document.getElementById('txType').value,
        amount: parseFloat(document.getElementById('txAmount').value),
        category: document.getElementById('txCategory').value,
        note: document.getElementById('txNote').value,
        is_upi: document.getElementById('txIsUpi').value === 'true'
    };

    if (!isUpdate) {
        data.date = new Date().toISOString();
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';

    try {
        const userTransactions = db.collection('users').doc(currentUser.uid).collection('transactions');
        
        if (isUpdate) {
            await userTransactions.doc(txId).update(data);
        } else {
            await userTransactions.add(data);
        }
        
        closeModal('addTransactionModal');
        showAlert(isUpdate ? 'Updated' : 'Added', `Transaction ${isUpdate ? 'updated' : 'added'} successfully!`);
    } catch (e) {
        console.error(e);
        showAlert('Error', 'Failed to save transaction', 'info');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = isUpdate ? 'Update Transaction' : 'Add Transaction';
    }
}

// Removed duplicate handleBudgetSubmit

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
            <div class="tx-item" onclick="selectTransaction('${tx.id}', this)">
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
            <div class="tx-item" onclick="selectTransaction('${tx.id}', this)">
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
                        <div class="action-icon-pill edit" onclick="editTransaction('${tx.id}'); event.stopPropagation();"><span class="material-symbols-rounded" style="font-size:20px;">edit</span></div>
                        <div class="action-icon-pill delete" onclick="deleteTransaction('${tx.id}'); event.stopPropagation();"><span class="material-symbols-rounded" style="font-size:20px;">delete</span></div>
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
