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
let currentAnalysisFilter = 'month'; // week | month | year | all
let stats = { total_income: 0, total_expense: 0, balance: 0 };
let transactions = [];
let currentFilter = 'Month';
let currentNotesFilter = 'Important';
let selectedTxId = null;
let selectedBudgetIcon = '🏠';

// Loading State Manager
const loadingManager = {
    services: {
        settings: false,
        transactions: false,
        budgets: false,
        bills: false,
        notes: false,
        accounts: false,
        loans: false,
        investments: false
    },
    markReady(service) {
        this.services[service] = true;
        const allReady = Object.values(this.services).every(s => s === true);
        if (allReady) {
            hideSplashScreen();
        }
    },
    reset() {
        Object.keys(this.services).forEach(k => this.services[k] = false);
    }
};

let notes = [];
let budgets = [];
let savingsGoal = 0;
let globalMonthlyLimit = 0;
let displayName = '';
let username = '';
let pendingDelete = null;
let currentCurrency = 'USD';
let bills = [];
let accounts = [];
let loans = [];
let investments = [];
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
            loadingManager.reset();
            syncTransactions();
            syncNotes();
            syncUserSettings();
            syncBudgets();
            syncBills();
            syncAccounts();
            syncLoans();
            syncInvestments();
            
            switchTab('home');
        } else {
            currentUser = null;
            loadingManager.reset();
            document.getElementById('mainNav').style.display = 'none';
            document.querySelectorAll('.view').forEach(v => {
                v.classList.add('hidden');
                v.classList.remove('active');
            });
            document.getElementById('authView').classList.remove('hidden');
            document.getElementById('authView').classList.add('active');
            
            // If not logged in, we can hide splash immediately
            hideSplashScreen();
        }
    });

    // Theme logic
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
    }

    // Initialize static event listeners
    setupEventListeners();

    // Global Delete Confirmation
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    if (confirmDeleteBtn) {
        confirmDeleteBtn.onclick = handleConfirmDelete;
    }
});

function hideSplashScreen() {
    const splash = document.getElementById('splashScreen');
    if (splash) {
        splash.style.opacity = '0';
        splash.style.visibility = 'hidden';
        setTimeout(() => {
            if (splash.parentNode) splash.remove();
        }, 500);
    }
}

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

    // Add Note Form
    const addNoteForm = document.getElementById('addNoteForm');
    if (addNoteForm) {
        addNoteForm.addEventListener('submit', handleAddNote);
    }

    // Add Bill Form
    const billForm = document.getElementById('billForm');
    if (billForm) {
        billForm.addEventListener('submit', handleBillSubmit);
    }

    // New Forms
    const accountForm = document.getElementById('accountForm');
    if (accountForm) accountForm.addEventListener('submit', handleAccountSubmit);

    const loanForm = document.getElementById('loanForm');
    if (loanForm) loanForm.addEventListener('submit', handleLoanSubmit);

    const investmentForm = document.getElementById('investmentForm');
    if (investmentForm) investmentForm.addEventListener('submit', handleInvestmentSubmit);

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
    const nameField = document.getElementById('nameFieldGroup');
    
    if (isSignUpMode) {
        btn.textContent = 'Sign Up';
        toggleText.textContent = 'Already have an account?';
        toggleLink.textContent = 'Sign In';
        nameField.style.display = 'block';
    } else {
        btn.textContent = 'Sign In';
        toggleText.textContent = "Don't have an account?";
        toggleLink.textContent = 'Sign Up';
        nameField.style.display = 'none';
    }
}

async function handleAuthSubmit(e) {
    e.preventDefault();
    const email = document.getElementById('authEmail').value;
    const password = document.getElementById('authPassword').value;
    const name = document.getElementById('authName').value;
    const btn = document.getElementById('authSubmitBtn');
    
    btn.disabled = true;
    btn.textContent = 'Please wait...';
    
    try {
        if (isSignUpMode) {
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;
            
            // Save additional user info to Firestore
            await db.collection('users').doc(user.uid).set({
                displayName: name || 'User',
                email: email,
                createdAt: new Date().toISOString()
            }, { merge: true });
            
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

async function handleGoogleSignIn() {
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
        const result = await auth.signInWithPopup(provider);
        const user = result.user;
        
        // Ensure user exists in Firestore
        const userRef = db.collection('users').doc(user.uid);
        const doc = await userRef.get();
        
        if (!doc.exists) {
            await userRef.set({
                displayName: user.displayName,
                email: user.email,
                photoURL: user.photoURL,
                createdAt: new Date().toISOString()
            }, { merge: true });
        }
    } catch (error) {
        console.error(error);
        showAlert('Google Sign-In Error', error.message, 'info');
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
    if (tab === 'accounts') renderAccounts();
    if (tab === 'loans') renderLoans();
    if (tab === 'investments') renderInvestments();
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
        // Hard-reset every field individually to avoid browser autofill retention
        const form = document.getElementById('transactionForm');
        if (form) form.reset();
        document.getElementById('txId').value = '';
        document.getElementById('txNote').value = '';
        document.getElementById('txAmount').value = '';
        document.getElementById('txIsUpi').value = 'false';
        document.getElementById('txCategoryExpense').value = 'Food';
        document.getElementById('txCategoryIncome').value = 'Salary';
        document.getElementById('submitBtn').textContent = 'Add Transaction';
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('txDateDisplay').value = today;
        const scanStatus = document.getElementById('scanStatus');
        if (scanStatus) scanStatus.classList.add('hidden');
        const smsArea = document.getElementById('txSmsPaste');
        if (smsArea) smsArea.value = '';
        // Default type
        const defaultType = (txType && txType !== 'upi') ? txType : 'expense';
        switchTxType(defaultType);
        document.getElementById('txIsUpi').value = txType === 'upi' ? 'true' : 'false';
    }
}

function switchTxType(type) {
    document.getElementById('txType').value = type;
    const expCat = document.getElementById('txCategoryExpense');
    const incCat = document.getElementById('txCategoryIncome');
    const typeBtns = document.querySelectorAll('.type-btn-exact');
    typeBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.type === type));
    if (type === 'expense') {
        expCat.style.display = '';
        expCat.required = true;
        incCat.style.display = 'none';
        incCat.required = false;
    } else {
        incCat.style.display = '';
        incCat.required = true;
        expCat.style.display = 'none';
        expCat.required = false;
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

async function handleCurrencyChange(currency) {
    currentCurrency = currency;
    
    // Update Firestore if user is logged in
    if (currentUser) {
        try {
            await db.collection('users').doc(currentUser.uid).set({
                currency: currency
            }, { merge: true });
        } catch (e) { console.error("Error saving currency:", e); }
    }

    updateCurrencyUI();
}

function updateCurrencyUI() {
    // Update Home Currency Badge
    const badge = document.querySelector('.currency-badge');
    if (badge) {
        const iconName = currencyIcons[currentCurrency];
        badge.innerHTML = `<span class="material-symbols-rounded" style="font-size:14px; background: #000; color: #fff; border-radius: 50%; padding: 2px; margin-right: 4px;">${iconName}</span> ${currentCurrency}`;
    }

    // Update Settings Select
    const selector = document.getElementById('currencySelector');
    if (selector) selector.value = currentCurrency;

    // Refresh All Screens to show new currency
    loadStats(); // This cascades to all screens
    renderTransactions();
    renderAllTransactions();
    renderAccounts();
    renderLoans();
    renderInvestments();
}

function formatMoney(amount) {
    const converted = amount * currencyRates[currentCurrency];
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currentCurrency,
        currencyDisplay: 'symbol'
    }).format(converted);
}

function formatDateLabel(dateString) {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

async function saveAccountDetails() {
    const newName = document.getElementById('accName').value;
    const newUsername = document.getElementById('accUser').value;
    
    if (currentUser) {
        try {
            await db.collection('users').doc(currentUser.uid).set({
                displayName: newName,
                username: newUsername
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

function filterNotes(category, element) {
    currentNotesFilter = category;
    
    // Update UI
    document.querySelectorAll('.cat-pill').forEach(btn => btn.classList.remove('active'));
    if (element) element.classList.add('active');
    
    // Update Title
    const titleEl = document.getElementById('notesTitle');
    if (titleEl) titleEl.textContent = category;
    
    renderNotes();
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

// ── Analysis filter helpers ──────────────────────────────────────────────────
let _analysisFilterCache = 'month';

function switchAnalysisFilter(filter, btn) {
    _analysisFilterCache = filter;
    document.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderAnalysisScreen();
}

function getFilteredTransactions(filter) {
    const now = new Date();
    return transactions.filter(tx => {
        const d = new Date(tx.date);
        if (filter === 'week') return (now - d) / (1000 * 60 * 60 * 24) <= 7;
        if (filter === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        if (filter === 'year') return d.getFullYear() === now.getFullYear();
        return true; // 'all'
    });
}

function getCategoryIcon(category) {
    const icons = {
        'Food': 'restaurant', 'Groceries': 'local_grocery_store', 'Transport': 'directions_car',
        'Travel': 'flight', 'Shopping': 'shopping_bag', 'Outing': 'celebration',
        'Entertainment': 'movie', 'Health': 'medication', 'Bills': 'bolt',
        'Education': 'school', 'Rent': 'home', 'Subscriptions': 'subscriptions',
        'Fitness': 'fitness_center', 'Gifts': 'card_giftcard', 'Personal': 'spa',
        'Salary': 'work', 'Freelance': 'laptop_mac', 'Business': 'business',
        'Investment': 'trending_up', 'Bonus': 'stars', 'Gift': 'redeem',
        'Account Opening': 'account_balance', 'Income': 'payments', 'Other': 'category'
    };
    return icons[category] || 'receipt_long';
}

function renderAnalysisScreen() {
    const filter = _analysisFilterCache || 'month';
    const filtered = getFilteredTransactions(filter);

    const filteredIncome = filtered.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const filteredExpense = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const filteredBalance = filteredIncome - filteredExpense;

    // Update hero label
    const labels = { week: 'This Week', month: 'This Month', year: 'This Year', all: 'All Time' };
    const heroLabel = document.getElementById('analysisHeroLabel');
    if (heroLabel) heroLabel.textContent = `Total Balance — ${labels[filter] || 'This Month'}`;

    document.getElementById('analysisTotalSpent').textContent = formatMoney(filteredBalance);
    document.getElementById('analysisIncome').textContent = formatMoney(filteredIncome);
    document.getElementById('analysisBudgetTotal').textContent = formatMoney(filteredExpense);
    
    const chart = document.getElementById('analysisChart');
    if (!chart) return;
    chart.innerHTML = '';
    
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
        const spent = filtered
            .filter(t => t.type === 'expense' && new Date(t.date).toDateString() === dStr)
            .reduce((sum, t) => sum + t.amount, 0);
        if (spent > maxSpent) maxSpent = spent;
        return { day: days[d.getDay()], date: dStr, amount: spent };
    });

    dailyTotals.forEach(data => {
        const height = maxSpent > 0 ? Math.max((data.amount / maxSpent) * 80, 5) : 5;
        chart.insertAdjacentHTML('beforeend', `<div class="bar" style="height: ${height}%;" title="${data.date}: ${formatMoney(data.amount)}"><span class="day">${data.day}</span></div>`);
    });
    
    renderCategoryBreakdown(filtered);
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

// Modal Helpers with Currency Conversion
function openBudgetModal() {
    const input = document.getElementById('budgetLimit');
    if (input) {
        input.value = (globalMonthlyLimit * currencyRates[currentCurrency]).toFixed(2);
    }
    openModal('budgetModal');
}

function openSavingsGoalModal() {
    const input = document.getElementById('savingsGoalInput');
    if (input) {
        input.value = (savingsGoal * currencyRates[currentCurrency]).toFixed(2);
    }
    openModal('savingsGoalModal');
}

function renderSavingsScreen() {
    // Use unified balance as current savings
    const currentSavings = stats.balance > 0 ? stats.balance : 0;
    const percent = savingsGoal > 0 ? Math.min(Math.round((currentSavings / savingsGoal) * 100), 100) : 0;
    const remaining = Math.max(savingsGoal - currentSavings, 0);

    const amountBig = document.querySelector('.savings-amount-big');
    if (amountBig) amountBig.textContent = formatMoney(currentSavings);
    
    const fill = document.querySelector('.progress-fill-glow');
    if (fill) fill.style.width = `${percent}%`;
    
    const meta = document.querySelector('.savings-meta');
    if (meta) meta.textContent = `${percent}% of ${formatMoney(savingsGoal)} goal`;
    
    const valGreen = document.querySelector('.val-green');
    if (valGreen) valGreen.textContent = formatMoney(stats.total_income);
    
    const valRed = document.querySelector('.val-red');
    if (valRed) valRed.textContent = `-${formatMoney(stats.total_expense)}`;
    
    const valBlue = document.querySelector('.val-blue');
    if (valBlue) valBlue.textContent = formatMoney(currentSavings);
    
    const valBlack = document.querySelector('.val-black');
    if (valBlack) valBlack.textContent = formatMoney(remaining);
}

async function handleBudgetCategorySubmit(e) {
    e.preventDefault();
    if (!currentUser) return;

    const nameInput = e.target.querySelector('input[type="text"]');
    const amountInput = e.target.querySelector('input[type="number"]');
    
    const displayAmount = parseFloat(amountInput.value);
    const baseAmount = displayAmount / currencyRates[currentCurrency];
    
    try {
        await db.collection('users').doc(currentUser.uid).collection('budgets').add({
            name: nameInput.value,
            amount: baseAmount,
            icon: typeof selectedBudgetIcon !== 'undefined' ? selectedBudgetIcon : '💰'
        });
        
        e.target.reset();
        document.querySelectorAll('.icon-opt').forEach(o => o.classList.remove('active'));
        if (typeof selectedBudgetIcon !== 'undefined') selectedBudgetIcon = '🏠';
        
        closeModal('addBudgetCategoryModal');
    } catch (e) {
        console.error(e);
        showAlert('Error', 'Failed to add budget category', 'info');
    }
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
    document.getElementById('txAmount').value = (tx.amount * currencyRates[currentCurrency]).toFixed(2);
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

// Unified Financial Sync Engine
// This is the single source of truth for all financial data across the app.
// Called whenever accounts, transactions, loans, or investments change.
function loadStats() {
    const income = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
    const expense = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);

    // Unified balance: sum of all account balances is the ground truth.
    // If user has accounts set up, use that total. Otherwise fall back to transaction math.
    let unifiedBalance;
    if (accounts.length > 0) {
        // Total across all accounts (credit cards subtract from net)
        unifiedBalance = accounts.reduce((sum, acc) => {
            return sum + (acc.type === 'credit' ? -acc.balance : acc.balance);
        }, 0);
    } else {
        // Fallback: derive from transaction history
        unifiedBalance = income - expense;
    }

    stats = {
        total_income: income,
        total_expense: expense,
        balance: unifiedBalance
    };

    // Update Home Balance display
    const balEl = document.getElementById('totalBalance');
    if (balEl) balEl.textContent = formatMoney(stats.balance);

    // Update Net Worth (includes investments)
    updateNetWorth();

    // Cascade updates to all screens
    renderAnalysisScreen();
    renderBudgetScreen();
    renderSavingsScreen();
    renderAccounts();
}

function syncTransactions() {
    db.collection('users').doc(currentUser.uid).collection('transactions')
        .orderBy('date', 'desc')
        .onSnapshot(snap => {
            transactions = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderTransactions();
            if (currentTab === 'transactions') renderAllTransactions();
            loadStats();
            loadingManager.markReady('transactions');
        }, err => {
            console.error(err);
            loadingManager.markReady('transactions');
        });
}

function syncNotes() {
    db.collection('users').doc(currentUser.uid).collection('notes')
        .orderBy('date', 'asc')
        .onSnapshot(snap => {
            notes = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderNotes();
            loadingManager.markReady('notes');
        }, err => {
            console.error(err);
            loadingManager.markReady('notes');
        });
}

function syncBudgets() {
    db.collection('users').doc(currentUser.uid).collection('budgets')
        .onSnapshot(snap => {
            budgets = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            updateCategoryOptions();
            renderBudgetScreen();
            loadingManager.markReady('budgets');
        }, err => {
            console.error(err);
            loadingManager.markReady('budgets');
        });
}

function syncBills() {
    db.collection('users').doc(currentUser.uid).collection('bills')
        .orderBy('dueDate', 'asc')
        .onSnapshot(snap => {
            bills = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderBills();
            loadingManager.markReady('bills');
        }, err => {
            console.error(err);
            loadingManager.markReady('bills');
        });
}

function syncAccounts() {
    db.collection('users').doc(currentUser.uid).collection('accounts')
        .onSnapshot(snap => {
            accounts = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            updateAccountSelectors();
            // Re-run loadStats so the home balance updates immediately from the new account data
            loadStats();
            loadingManager.markReady('accounts');
        }, err => {
            console.error(err);
            loadingManager.markReady('accounts');
        });
}

function syncLoans() {
    db.collection('users').doc(currentUser.uid).collection('loans')
        .onSnapshot(snap => {
            loans = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderLoans();
            // Update net worth whenever loans change
            updateNetWorth();
            loadingManager.markReady('loans');
        }, err => {
            console.error(err);
            loadingManager.markReady('loans');
        });
}

function syncInvestments() {
    db.collection('users').doc(currentUser.uid).collection('investments')
        .onSnapshot(snap => {
            investments = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderInvestments();
            // Update net worth whenever investments change
            updateNetWorth();
            loadingManager.markReady('investments');
        }, err => {
            console.error(err);
            loadingManager.markReady('investments');
        });
}

function parseSms(text) {
    if (!text) return;
    
    // Patterns for common Indian banking SMS
    const amountRegex = /(?:rs\.?|inr|₹)\s*([\d,.]+)/i;
    const typeRegex = /(debited|spent|withdrawn|credited|received)/i;
    const bankRegex = /(?:at|in|from|to)\s+([A-Z0-9\s]+?)(?:\s+on|\s+at|\s+using|$)/i;
    
    const amountMatch = text.match(amountRegex);
    const typeMatch = text.match(typeRegex);
    const bankMatch = text.match(bankRegex);
    
    if (amountMatch) {
        document.getElementById('txAmount').value = amountMatch[1].replace(/,/g, '');
    }
    
    if (typeMatch) {
        const type = typeMatch[1].toLowerCase();
        const isExpense = ['debited', 'spent', 'withdrawn'].includes(type);
        const typeBtn = document.querySelector(`.type-btn-exact.${isExpense ? 'expense' : 'income'}`);
        if (typeBtn) typeBtn.click();
    }
    
    if (bankMatch) {
        document.getElementById('txNote').value = `SMS: ${bankMatch[1].trim()}`;
    }
}

async function handleBillSubmit(e) {
    e.preventDefault();
    if (!currentUser) return;
    
    const displayName = document.getElementById('billName').value;
    const displayAmount = parseFloat(document.getElementById('billAmount').value);
    const baseAmount = displayAmount / currencyRates[currentCurrency];

    const data = {
        name: displayName,
        amount: baseAmount,
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
        list.innerHTML = `
            <div class="empty-state-modern">
                <span class="material-symbols-rounded" style="font-size: 48px; color: #cbd5e1; margin-bottom: 12px;">receipt_long</span>
                <h4 style="font-size: 18px; font-weight: 700; color: #1e293b; margin-bottom: 6px;">No Pending Bills</h4>
                <p style="font-size: 13px; color: #64748b; margin-bottom: 16px;">You're all caught up! No upcoming bills or subscriptions detected.</p>
                <button class="pill-btn-gray" onclick="openModal('addBillModal')">Add a Bill</button>
            </div>
        `;
        return;
    }

    bills.forEach(bill => {
        const date = new Date(bill.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const isOverdue = new Date(bill.dueDate) < new Date() && !bill.paid;
        
        const html = `
            <div class="settings-card interactive-card" style="margin-bottom: 16px; padding: 20px; transition: all 0.3s ease; border-left: 4px solid ${bill.paid ? '#10b981' : (isOverdue ? '#ef4444' : '#f59e0b')}; opacity: ${bill.paid ? '0.7' : '1'}">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; gap: 15px; align-items: center;">
                        <div class="tx-icon-circle" style="background: ${bill.paid ? '#ecfdf5' : '#f8fafc'}; color: ${bill.paid ? '#10b981' : '#64748b'}; width: 44px; height: 44px;">
                            <span class="material-symbols-rounded">${bill.paid ? 'check_circle' : 'calendar_today'}</span>
                        </div>
                        <div>
                            <h4 style="font-weight: 800; font-size: 16px; color: #1e293b;">${bill.name}</h4>
                            <p style="font-size: 12px; color: ${isOverdue ? '#ef4444' : '#64748b'}; font-weight: 500;">
                                ${isOverdue ? '⚠️ Overdue' : 'Due'} on ${date}
                            </p>
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-weight: 800; font-size: 18px; color: #1e293b;">${formatMoney(bill.amount)}</div>
                        <div style="display: flex; gap: 6px; justify-content: flex-end; margin-top: 8px; align-items: center;">
                            <button class="pill-btn-status ${bill.paid ? 'paid' : 'unpaid'}" onclick="toggleBillPaid('${bill.id}', ${bill.paid})">
                                ${bill.paid ? 'Mark Unpaid' : 'Mark Paid'}
                            </button>
                            <button class="icon-action-btn delete" onclick="deleteBill('${bill.id}')" title="Delete">
                                <span class="material-symbols-rounded" style="font-size: 16px;">delete</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        list.insertAdjacentHTML('beforeend', html);
    });
}

async function deleteBill(id) {
    const bill = bills.find(b => b.id === id);
    if (!bill) return;
    pendingDelete = { id, type: 'bill', label: bill.name };
    document.getElementById('deleteConfirmTitle').textContent = `Delete "${bill.name}"?`;
    document.getElementById('deleteConfirmMsg').textContent = `This bill of ${formatMoney(bill.amount)} will be permanently removed.`;
    openModal('deleteConfirmModal');
}


async function toggleBillPaid(id, currentStatus) {
    if (!currentUser) return;
    try {
        await db.collection('users').doc(currentUser.uid).collection('bills').doc(id).update({
            paid: !currentStatus
        });
    } catch (e) { console.error(e); }
}

// updateCategoryOptions is kept as a no-op.
// Categories are now statically defined in the HTML <select id="txCategory">
// so that the full expense/income list with emojis is always available.
function updateCategoryOptions() {
    // No-op: the category dropdown is defined in HTML and must not be overwritten.
    // This function previously overwrote options from budgets — intentionally disabled.
}

function syncUserSettings() {
    if (!currentUser) return;
    db.collection('users').doc(currentUser.uid).onSnapshot(async doc => {
        if (doc.exists) {
            const data = doc.data();
            displayName = data.displayName || 'User';
            username = data.username || `@user_${currentUser.uid.substring(0, 5)}`;
            globalMonthlyLimit = data.monthlyLimit || 0;
            savingsGoal = data.savingsGoal || 0;
            const currency = data.currency || 'USD';
            
            // Update UI elements
            const headerUserName = document.getElementById('headerUserName');
            if(headerUserName) headerUserName.textContent = displayName;
            
            const headerAvatar = document.getElementById('headerAvatar');
            if(headerAvatar) headerAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=1c1c1e&color=fff`;
            
            const analysisAvatar = document.getElementById('analysisAvatar');
            if(analysisAvatar) analysisAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=1c1c1e&color=fff`;
            
            const idDisplay = document.getElementById('accIdDisplay');
            if(idDisplay) idDisplay.value = `EXP-${currentUser.uid.substring(0, 4)}-${displayName.substring(0, 2).toUpperCase()}`;

            const accNameInput = document.getElementById('accName');
            if (accNameInput) accNameInput.value = displayName;

            const accUserInput = document.getElementById('accUser');
            if (accUserInput) accUserInput.value = username;
            
            const accEmailInput = document.getElementById('accEmail');
            if (accEmailInput) accEmailInput.value = currentUser.email;

            // Handle Currency Change without re-saving
            if (currentCurrency !== currency) {
                currentCurrency = currency;
                updateCurrencyUI();
            }

            renderBudgetScreen();
            renderSavingsScreen();
            loadingManager.markReady('settings');
        } else {
            // New User Initialization
            const initialData = {
                displayName: currentUser.displayName || 'New User',
                username: `@user_${currentUser.uid.substring(0, 5)}`,
                monthlyLimit: 0,
                savingsGoal: 0,
                currency: 'USD',
                email: currentUser.email,
                createdAt: new Date().toISOString()
            };
            try {
                await db.collection('users').doc(currentUser.uid).set(initialData);
                loadingManager.markReady('settings');
            } catch (e) {
                console.error("Error creating user profile:", e);
                loadingManager.markReady('settings');
            }
        }
    }, err => {
        console.error(err);
        loadingManager.markReady('settings');
    });
}

async function handleBudgetSubmit(e) {
    e.preventDefault();
    const displayLimit = parseFloat(document.getElementById('budgetLimit').value);
    if (!isNaN(displayLimit) && currentUser) {
        const baseLimit = displayLimit / currencyRates[currentCurrency];
        try {
            await db.collection('users').doc(currentUser.uid).set({
                monthlyLimit: baseLimit
            }, { merge: true });
            closeModal('budgetModal');
            showAlert('Limit Updated', `Your monthly budget limit has been set to ${formatMoney(baseLimit)}`);
        } catch (e) { console.error(e); }
    }
}

async function handleSavingsGoalSubmit(e) {
    e.preventDefault();
    const displayGoal = parseFloat(document.getElementById('savingsGoalInput').value);
    if (!isNaN(displayGoal) && currentUser) {
        const baseGoal = displayGoal / currencyRates[currentCurrency];
        try {
            await db.collection('users').doc(currentUser.uid).set({
                savingsGoal: baseGoal
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
    
    const displayAmount = parseFloat(document.getElementById('txAmount').value);
    const baseAmount = displayAmount / currencyRates[currentCurrency];
    const accountId = document.getElementById('txAccount').value;
    const type = document.getElementById('txType').value;
    // Read from the currently visible category select
    const catExpEl = document.getElementById('txCategoryExpense');
    const catIncEl = document.getElementById('txCategoryIncome');
    const category = (type === 'income' ? catIncEl : catExpEl).value;

    if (isNaN(baseAmount) || baseAmount <= 0) {
        showAlert('Invalid Amount', 'Please enter a valid amount.', 'info');
        return;
    }

    const data = {
        type,
        amount: baseAmount,
        category,
        note: document.getElementById('txNote').value,
        is_upi: document.getElementById('txIsUpi').value === 'true',
        accountId: accountId
    };

    if (!isUpdate) {
        // Use the selected date from the date picker, fallback to now
        const dateInput = document.getElementById('txDateDisplay').value;
        data.date = dateInput ? new Date(dateInput).toISOString() : new Date().toISOString();
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';

    try {
        const userRef = db.collection('users').doc(currentUser.uid);
        const userTransactions = userRef.collection('transactions');
        
        if (isUpdate) {
            // Reverse the OLD account balance effect before applying the new one
            const oldTxDoc = await userTransactions.doc(txId).get();
            if (oldTxDoc.exists) {
                const oldTx = oldTxDoc.data();
                if (oldTx.accountId && oldTx.accountId !== 'cash') {
                    const reverseDelta = oldTx.type === 'income' ? -oldTx.amount : oldTx.amount;
                    await userRef.collection('accounts').doc(oldTx.accountId).update({
                        balance: firebase.firestore.FieldValue.increment(reverseDelta)
                    });
                }
            }
            await userTransactions.doc(txId).update(data);
        } else {
            await userTransactions.add(data);
        }

        // Apply the NEW balance effect
        if (accountId && accountId !== 'cash') {
            const balanceDelta = type === 'income' ? baseAmount : -baseAmount;
            await userRef.collection('accounts').doc(accountId).update({
                balance: firebase.firestore.FieldValue.increment(balanceDelta)
            });
        }
        
        closeModal('addTransactionModal');
        showAlert(isUpdate ? 'Updated' : 'Added', `Transaction ${isUpdate ? 'updated' : 'added'} successfully!`);
    } catch (err) {
        console.error(err);
        showAlert('Error', 'Failed to save transaction', 'info');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = isUpdate ? 'Update Transaction' : 'Add Transaction';
    }
}

function editTransaction(id) {
    const tx = transactions.find(t => t.id === id);
    if (!tx) return;
    // Open modal first (resets everything cleanly)
    openModal('addTransactionModal');
    // Now fill in the existing values
    document.getElementById('txId').value = tx.id;
    document.getElementById('txAmount').value = (tx.amount * currencyRates[currentCurrency]).toFixed(2);
    document.getElementById('txNote').value = tx.note || '';
    // Switch to correct type (this also shows the right category select)
    switchTxType(tx.type);
    if (tx.type === 'income') {
        const incEl = document.getElementById('txCategoryIncome');
        if (incEl && tx.category) incEl.value = tx.category;
    } else {
        const expEl = document.getElementById('txCategoryExpense');
        if (expEl && tx.category) expEl.value = tx.category;
    }
    const accEl = document.getElementById('txAccount');
    if (accEl && tx.accountId) accEl.value = tx.accountId;
    const dateStr = tx.date ? new Date(tx.date).toISOString().split('T')[0] : '';
    document.getElementById('txDateDisplay').value = dateStr;
    document.getElementById('submitBtn').textContent = 'Update Transaction';
}

function deleteTransaction(id) {
    const tx = transactions.find(t => t.id === id);
    if (!tx) return;
    pendingDelete = { id, type: 'transaction' };
    document.getElementById('deleteConfirmTitle').textContent = 'Delete Transaction?';
    document.getElementById('deleteConfirmMsg').textContent = `Remove the ${tx.type} of ${formatMoney(tx.amount)}. The linked account balance will be reversed automatically.`;
    openModal('deleteConfirmModal');
}

async function handleConfirmDelete() {
    if (!pendingDelete || !currentUser) return;
    const { id, type } = pendingDelete;
    const userRef = db.collection('users').doc(currentUser.uid);
    try {
        if (type === 'transaction') {
            // Reverse the account balance effect
            const tx = transactions.find(t => t.id === id);
            if (tx && tx.accountId && tx.accountId !== 'cash') {
                const delta = tx.type === 'income' ? -tx.amount : tx.amount;
                await userRef.collection('accounts').doc(tx.accountId).update({
                    balance: firebase.firestore.FieldValue.increment(delta)
                });
            }
            await userRef.collection('transactions').doc(id).delete();
        } else if (type === 'note') {
            await userRef.collection('notes').doc(id).delete();
        } else if (type === 'bill') {
            await userRef.collection('bills').doc(id).delete();
        } else if (type === 'account') {
            await userRef.collection('accounts').doc(id).delete();
            showAlert('Deleted', 'Account removed.');
        } else if (type === 'loan') {
            await userRef.collection('loans').doc(id).delete();
        }
        pendingDelete = null;
        closeModal('deleteConfirmModal');
    } catch(err) { console.error(err); }
}


// Rendering
function renderTransactions() {
    const homeList = document.getElementById('homeTransactionsList');
    homeList.innerHTML = '';
    // Sort newest first
    const sorted = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
    sorted.slice(0, 4).forEach((tx) => {
        const isIncome = tx.type === 'income';
        const iconName = tx.is_upi ? 'qr_code' : getCategoryIcon(tx.category);
        const dateObj = new Date(tx.date);
        const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const html = `
            <div class="tx-item" onclick="selectTransaction('${tx.id}', this)">
                <div class="tx-icon-circle" style="background: ${isIncome ? '#ecfdf5' : '#fef2f2'}; color: ${isIncome ? '#10b981' : '#ef4444'};">
                    <span class="material-symbols-rounded" style="font-size: 20px;">${iconName}</span>
                </div>
                <div class="tx-details">
                    <h4 class="tx-title">${tx.note || tx.category}</h4>
                    <p class="tx-subtitle">${dateStr} &rsaquo; ${tx.category}</p>
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

    let filteredTxs = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
    const now = new Date();
    
    if (currentFilter === 'Month') {
        filteredTxs = filteredTxs.filter(tx => {
            const d = new Date(tx.date);
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        });
    } else if (currentFilter === 'Week') {
        filteredTxs = filteredTxs.filter(tx => {
            const d = new Date(tx.date);
            return (now - d) / (1000 * 60 * 60 * 24) <= 7;
        });
    }

    if (filteredTxs.length === 0) {
        allList.innerHTML = '<p style="text-align:center; padding: 20px; color:#94a3b8;">No transactions found for this period.</p>';
        return;
    }

    filteredTxs.forEach((tx) => {
        const isIncome = tx.type === 'income';
        const iconName = tx.is_upi ? 'qr_code' : getCategoryIcon(tx.category);
        const dateObj = new Date(tx.date);
        const dateStr = dateObj.toLocaleDateString('en-GB');
        const userName = displayName || 'Me';

        const html = `
            <div class="tx-item" onclick="selectTransaction('${tx.id}', this)">
                <div class="tx-icon-circle" style="background: ${isIncome ? '#ecfdf5' : '#fef2f2'}; color: ${isIncome ? '#10b981' : '#ef4444'};">
                    <span class="material-symbols-rounded" style="font-size: 20px;">${iconName}</span>
                </div>
                <div class="tx-details">
                    <h4 class="tx-title">${tx.note || tx.category}</h4>
                    <p class="tx-subtitle">${dateStr} &rsaquo; ${tx.category} &rsaquo; ${userName}</p>
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

function renderCategoryBreakdown(txList) {
    const catList = document.getElementById('categoryBreakdownList');
    if (!catList) return;
    const source = txList || transactions;
    const categories = {};
    source.forEach(tx => { if (tx.type === 'expense') categories[tx.category] = (categories[tx.category] || 0) + tx.amount; });
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
// Multi-Account Management
async function handleAccountSubmit(e) {
    e.preventDefault();
    if (!currentUser) return;
    const name = document.getElementById('accountName').value;
    const type = document.getElementById('accountType').value;
    const displayBalance = parseFloat(document.getElementById('accountBalance').value) || 0;
    const balance = displayBalance / currencyRates[currentCurrency];

    try {
        const userRef = db.collection('users').doc(currentUser.uid);
        
        // Create the account
        const accRef = await userRef.collection('accounts').add({
            name, type, balance, createdAt: new Date().toISOString()
        });

        // If initial balance > 0, record it as an income transaction so Analysis screen shows it
        if (balance > 0) {
            await userRef.collection('transactions').add({
                type: 'income',
                amount: balance,
                note: `Initial balance — ${name}`,
                category: 'Account Opening',
                accountId: accRef.id,
                date: new Date().toISOString(),
                isInitialBalance: true
            });
        }

        closeModal('addAccountModal');
        e.target.reset();
        showAlert('Account Added', `"${name}" has been added with ${formatMoney(balance)} as initial balance.`);
    } catch (err) { console.error(err); }
}

function renderAccounts() {
    const list = document.getElementById('accountsList');
    if (!list) return;
    
    if (accounts.length === 0) {
        list.innerHTML = `
            <div class="empty-state-modern">
                <span class="material-symbols-rounded" style="font-size: 48px; color: #cbd5e1; margin-bottom: 12px;">account_balance</span>
                <h4 style="font-size: 18px; font-weight: 700; color: #1e293b; margin-bottom: 6px;">No Accounts Found</h4>
                <p style="font-size: 13px; color: #64748b; margin-bottom: 16px;">Add your first bank account, wallet, or physical cash stash to start tracking your net worth.</p>
                <button class="pill-btn-gray" onclick="openModal('addAccountModal')">Add Your First Account</button>
            </div>
        `;
        return;
    }
    
    list.innerHTML = accounts.map(acc => {
        const iconName = acc.type === 'bank' ? 'account_balance' : (acc.type === 'credit' ? 'credit_card' : (acc.type === 'wallet' ? 'account_balance_wallet' : 'payments'));
        const colorClass = acc.type === 'bank' ? 'blue' : (acc.type === 'credit' ? 'orange' : 'green');
        const amtColor = acc.type === 'credit' ? '#ef4444' : '#10b981';
        return `
        <div class="settings-card interactive-card" style="margin-bottom: 16px; padding: 20px; transition: all 0.3s ease;">
            <div class="settings-item">
                <div class="item-left">
                    <div class="item-icon-box ${colorClass}">
                        <span class="material-symbols-rounded">${iconName}</span>
                    </div>
                    <div class="item-text">
                        <h4 style="font-size: 16px; font-weight: 700;">${acc.name}</h4>
                        <p style="font-size: 12px; color: #64748b; margin-top: 2px;">${acc.type.toUpperCase()}</p>
                    </div>
                </div>
                <div style="text-align: right;">
                    <h4 style="font-weight: 800; font-size: 18px; color: ${amtColor}">${formatMoney(acc.balance)}</h4>
                    <div style="display: flex; gap: 6px; justify-content: flex-end; margin-top: 6px;">
                        <button class="icon-action-btn edit" onclick="event.stopPropagation(); openEditAccountModal('${acc.id}')" title="Edit">
                            <span class="material-symbols-rounded" style="font-size: 16px;">edit</span>
                        </button>
                        <button class="icon-action-btn delete" onclick="event.stopPropagation(); deleteAccount('${acc.id}')" title="Delete">
                            <span class="material-symbols-rounded" style="font-size: 16px;">delete</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `}).join('');
}

async function openEditAccountModal(id) {
    const acc = accounts.find(a => a.id === id);
    if (!acc) return;
    document.getElementById('editAccountId').value = acc.id;
    document.getElementById('editAccountName').value = acc.name;
    document.getElementById('editAccountType').value = acc.type;
    document.getElementById('editAccountBalance').value = (acc.balance * currencyRates[currentCurrency]).toFixed(2);
    openModal('editAccountModal');
}

async function submitEditAccount(e) {
    e.preventDefault();
    if (!currentUser) return;
    const id = document.getElementById('editAccountId').value;
    const name = document.getElementById('editAccountName').value;
    const type = document.getElementById('editAccountType').value;
    const balance = parseFloat(document.getElementById('editAccountBalance').value) / currencyRates[currentCurrency];
    try {
        await db.collection('users').doc(currentUser.uid).collection('accounts').doc(id).update({ name, type, balance });
        closeModal('editAccountModal');
        showAlert('Account Updated', `"${name}" has been updated successfully.`);
    } catch(err) { console.error(err); }
}

async function deleteAccount(id) {
    const acc = accounts.find(a => a.id === id);
    if (!acc) return;
    pendingDelete = { id, type: 'account', label: acc.name };
    document.getElementById('deleteConfirmTitle').textContent = `Delete "${acc.name}"?`;
    document.getElementById('deleteConfirmMsg').textContent = `This will permanently remove "${acc.name}" account. All its transaction history will remain but the account will be gone.`;
    openModal('deleteConfirmModal');
}


function updateAccountSelectors() {
    const selectors = ['txAccount', 'loanAccount'];
    selectors.forEach(sid => {
        const select = document.getElementById(sid);
        if (!select) return;
        let html = sid === 'txAccount' ? '<option value="cash">Main Wallet (Cash)</option>' : '';
        accounts.forEach(acc => {
            html += `<option value="${acc.id}">${acc.name}</option>`;
        });
        select.innerHTML = html;
    });
}

function updateNetWorth() {
    const totalAccounts = accounts.reduce((sum, acc) => sum + (acc.type === 'credit' ? -acc.balance : acc.balance), 0);
    const loansLiability = loans.filter(l => l.direction !== 'lent').reduce((sum, l) => sum + l.remainingBalance, 0);
    const loansAsset = loans.filter(l => l.direction === 'lent').reduce((sum, l) => sum + l.remainingBalance, 0);
    const investmentsValue = investments.reduce((sum, inv) => sum + (inv.qty * inv.currentPrice), 0);
    
    const totalNetWorth = totalAccounts - loansLiability + loansAsset + investmentsValue;
    
    const display = document.getElementById('netWorthDisplay');
    if (display) display.textContent = formatMoney(totalNetWorth);
}

// Loans Feature
async function handleLoanSubmit(e) {
    e.preventDefault();
    if (!currentUser) return;
    const direction = document.getElementById('loanDirection').value;
    const name = document.getElementById('loanName').value;
    const lender = document.getElementById('loanLender').value;
    const amount = parseFloat(document.getElementById('loanAmount').value) / currencyRates[currentCurrency];
    const rate = parseFloat(document.getElementById('loanRate').value);
    const dueDate = document.getElementById('loanDueDate').value;
    const accountId = document.getElementById('loanAccount').value;
    const notes = document.getElementById('loanNotes').value;

    try {
        await db.collection('users').doc(currentUser.uid).collection('loans').add({
            direction, name, lender, amount, interestRate: rate, dueDate, accountId, notes,
            remainingBalance: amount,
            createdAt: new Date().toISOString()
        });
        closeModal('addLoanModal');
        e.target.reset();
    } catch (e) { console.error(e); }
}

function renderLoans() {
    const list = document.getElementById('loansList');
    if (!list) return;
    
    if (loans.length === 0) {
        list.innerHTML = `
            <div class="empty-state-modern">
                <span class="material-symbols-rounded" style="font-size: 52px; color: #cbd5e1; margin-bottom: 14px;">real_estate_agent</span>
                <h4 style="font-size: 18px; font-weight: 800; color: #1e293b; margin-bottom: 6px;">No Active Loans</h4>
                <p style="font-size: 13px; color: #64748b; margin-bottom: 18px;">Track debts and money you've lent. Add your first loan to get started.</p>
                <button class="pill-btn-gray" onclick="openModal('addLoanModal')">Add Loan or Debt</button>
            </div>
        `;
        updateNetWorth();
        return;
    }

    list.innerHTML = loans.map(loan => {
        const progress = Math.min(Math.round(((loan.amount - loan.remainingBalance) / loan.amount) * 100), 100);
        const isLent = loan.direction === 'lent';
        const color = isLent ? '#10b981' : '#ef4444';
        const lightBg = isLent ? '#ecfdf5' : '#fef2f2';
        const gradientBg = isLent
            ? 'linear-gradient(135deg, #064e3b 0%, #065f46 60%, #047857 100%)'
            : 'linear-gradient(135deg, #7f1d1d 0%, #991b1b 60%, #b91c1c 100%)';
        const iconName = isLent ? 'call_made' : 'call_received';
        const dirLabel = isLent ? 'LENT OUT' : 'BORROWED';
        const dueDateObj = loan.dueDate ? new Date(loan.dueDate) : null;
        const isOverdue = dueDateObj && dueDateObj < new Date() && loan.remainingBalance > 0;
        const dueDateStr = dueDateObj
            ? dueDateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            : 'No Due Date';
        const settleColor = isLent ? '#059669' : '#dc2626';

        return `
        <div style="margin-bottom: 20px; border-radius: 22px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.1);">
            <div style="background: ${gradientBg}; padding: 20px 22px 28px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 18px;">
                    <div style="display: flex; gap: 12px; align-items: center;">
                        <div style="width: 44px; height: 44px; border-radius: 14px; background: rgba(255,255,255,0.15); backdrop-filter: blur(10px); display: flex; align-items: center; justify-content: center; border: 1px solid rgba(255,255,255,0.2);">
                            <span class="material-symbols-rounded" style="color: white; font-size: 22px;">${iconName}</span>
                        </div>
                        <div>
                            <span style="font-size: 10px; font-weight: 700; color: rgba(255,255,255,0.55); letter-spacing: 1.5px; text-transform: uppercase; display: block;">${dirLabel}</span>
                            <h3 style="font-size: 17px; font-weight: 800; color: white; margin-top: 2px;">${loan.name}</h3>
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <p style="font-size: 10px; color: rgba(255,255,255,0.45); margin-bottom: 2px;">Remaining</p>
                        <h2 style="font-size: 22px; font-weight: 900; color: white; letter-spacing: -0.5px;">${formatMoney(loan.remainingBalance)}</h2>
                        <p style="font-size: 10px; color: rgba(255,255,255,0.4);">of ${formatMoney(loan.amount)}</p>
                    </div>
                </div>
                <div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 7px;">
                        <span style="font-size: 11px; color: rgba(255,255,255,0.5); font-weight: 600;">Repayment Progress</span>
                        <span style="font-size: 11px; color: rgba(255,255,255,0.85); font-weight: 700;">${progress}%</span>
                    </div>
                    <div style="height: 7px; background: rgba(255,255,255,0.15); border-radius: 4px; overflow: hidden;">
                        <div style="height: 100%; width: ${progress}%; background: rgba(255,255,255,0.8); border-radius: 4px; transition: width 0.8s ease;"></div>
                    </div>
                </div>
            </div>

            <div style="background: white; padding: 18px 22px; border: 1px solid #f1f5f9; border-top: none; border-radius: 0 0 22px 22px;">
                <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 14px;">
                    <span style="display: inline-flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 600; background: #f8fafc; border: 1px solid #e2e8f0; padding: 5px 11px; border-radius: 8px; color: #475569;">
                        <span class="material-symbols-rounded" style="font-size: 13px;">person</span>${loan.lender}
                    </span>
                    <span style="display: inline-flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 600; background: #f8fafc; border: 1px solid #e2e8f0; padding: 5px 11px; border-radius: 8px; color: #475569;">
                        <span class="material-symbols-rounded" style="font-size: 13px;">percent</span>${loan.interestRate}% APR
                    </span>
                    <span style="display: inline-flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 600; background: ${isOverdue ? '#fef2f2' : '#f8fafc'}; border: 1px solid ${isOverdue ? '#fca5a5' : '#e2e8f0'}; padding: 5px 11px; border-radius: 8px; color: ${isOverdue ? '#ef4444' : '#475569'};">
                        <span class="material-symbols-rounded" style="font-size: 13px;">${isOverdue ? 'warning' : 'event'}</span>${isOverdue ? 'Overdue · ' : ''}${dueDateStr}
                    </span>
                </div>
                ${loan.notes ? `<p style="font-size: 12px; color: #64748b; font-style: italic; background: #f8fafc; padding: 10px 14px; border-radius: 10px; margin-bottom: 14px; border-left: 3px solid #e2e8f0;">"${loan.notes}"</p>` : ''}
                <div style="display: flex; gap: 8px;">
                    <button onclick="handleLoanPayment('${loan.id}', 1000)" style="flex: 1; padding: 12px 0; border-radius: 14px; border: 1.5px solid ${lightBg}; background: ${lightBg}; color: ${color}; font-weight: 700; font-size: 13px; cursor: pointer; font-family: inherit; display: flex; align-items: center; justify-content: center; gap: 6px; transition: all 0.2s;" onmouseover="this.style.filter='brightness(0.94)'" onmouseout="this.style.filter='brightness(1)'">
                        <span class="material-symbols-rounded" style="font-size: 17px;">payments</span> Pay EMI
                    </button>
                    <button onclick="handleLoanSettle('${loan.id}')" style="flex: 1; padding: 12px 0; border-radius: 14px; border: none; background: linear-gradient(135deg, ${color}, ${settleColor}); color: white; font-weight: 700; font-size: 13px; cursor: pointer; font-family: inherit; display: flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 4px 14px ${color}40; transition: all 0.2s;" onmouseover="this.style.opacity='0.88'" onmouseout="this.style.opacity='1'">
                        <span class="material-symbols-rounded" style="font-size: 17px;">check_circle</span> Settle
                    </button>
                    <button onclick="deleteLoan('${loan.id}')" style="width: 48px; border-radius: 14px; border: 1.5px solid #fee2e2; background: white; color: #ef4444; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s;" onmouseover="this.style.background='#fef2f2'" onmouseout="this.style.background='white'">
                        <span class="material-symbols-rounded" style="font-size: 19px;">delete</span>
                    </button>
                </div>
            </div>
        </div>
        `;
    }).join('');
    updateNetWorth();
}

async function deleteLoan(id) {
    const loan = loans.find(l => l.id === id);
    if (!loan) return;
    pendingDelete = { id, type: 'loan' };
    document.getElementById('deleteConfirmTitle').textContent = `Delete "${loan.name}"?`;
    document.getElementById('deleteConfirmMsg').textContent = `This loan of ${formatMoney(loan.amount)} will be permanently removed from your records.`;
    openModal('deleteConfirmModal');
}

// Investments Feature
async function handleInvestmentSubmit(e) {
    e.preventDefault();
    if (!currentUser) return;
    const assetName = document.getElementById('invAssetName').value;
    const type = document.getElementById('invType').value;
    const qty = parseFloat(document.getElementById('invQty').value);
    const buyPrice = parseFloat(document.getElementById('invBuyPrice').value) / currencyRates[currentCurrency];
    const currentPrice = parseFloat(document.getElementById('invCurrentPrice').value) / currencyRates[currentCurrency];

    try {
        await db.collection('users').doc(currentUser.uid).collection('investments').add({
            assetName, type, qty, buyPrice, currentPrice, createdAt: new Date().toISOString()
        });
        closeModal('addInvestmentModal');
        e.target.reset();
    } catch (e) { console.error(e); }
}

function renderInvestments() {
    const list = document.getElementById('investmentsList');
    if (!list) return;
    
    let totalValue = 0;
    let totalInvested = 0;

    if (investments.length === 0) {
        list.innerHTML = `
            <div class="empty-state-modern">
                <span class="material-symbols-rounded" style="font-size: 48px; color: #cbd5e1; margin-bottom: 12px;">monitoring</span>
                <h4 style="font-size: 18px; font-weight: 700; color: #1e293b; margin-bottom: 6px;">No Investments</h4>
                <p style="font-size: 13px; color: #64748b; margin-bottom: 16px;">Start building your wealth portfolio by adding your first stock or crypto holding.</p>
                <button class="pill-btn-gray" onclick="openModal('addInvestmentModal')">Add Your First Holding</button>
            </div>
        `;
        const totalDisplay = document.getElementById('portfolioTotal');
        if (totalDisplay) totalDisplay.textContent = formatMoney(0);
        const pnlDisplay = document.getElementById('portfolioPnL');
        if (pnlDisplay) pnlDisplay.innerHTML = `<span class="material-symbols-rounded">horizontal_rule</span> 0% Overall`;
        return;
    }

    list.innerHTML = investments.map(inv => {
        const val = inv.qty * inv.currentPrice;
        const invested = inv.qty * inv.buyPrice;
        const pnl = val - invested;
        const pnlPercent = invested > 0 ? ((pnl / invested) * 100).toFixed(2) : 0;
        
        totalValue += val;
        totalInvested += invested;

        const iconMap = { stock: 'stacked_line_chart', crypto: 'currency_bitcoin', mf: 'account_balance' };
        const iconColorMap = { stock: '#3b82f6', crypto: '#f59e0b', mf: '#8b5cf6' };

        return `
            <div class="settings-card interactive-card" style="margin-bottom: 16px; padding: 20px; transition: all 0.3s ease;">
                <div style="display: flex; justify-content: space-between;">
                    <div style="display: flex; gap: 12px;">
                        <div class="tx-icon-circle" style="background: #f8fafc; color: ${iconColorMap[inv.type] || '#3b82f6'}; width: 40px; height: 40px;">
                            <span class="material-symbols-rounded">${iconMap[inv.type] || 'monitoring'}</span>
                        </div>
                        <div>
                            <h4 style="font-weight: 800; font-size: 16px;">${inv.assetName}</h4>
                            <p style="font-size: 12px; color: #64748b; margin-top: 2px;">${inv.qty} units @ ${formatMoney(inv.buyPrice)}</p>
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <h4 style="font-weight: 800; font-size: 18px;">${formatMoney(val)}</h4>
                        <div style="display: inline-flex; align-items: center; gap: 4px; margin-top: 4px; padding: 4px 8px; border-radius: 6px; background: ${pnl >= 0 ? '#ecfdf5' : '#fef2f2'}; color: ${pnl >= 0 ? '#10b981' : '#ef4444'}; font-size: 11px; font-weight: 700;">
                            <span class="material-symbols-rounded" style="font-size: 14px;">${pnl >= 0 ? 'trending_up' : 'trending_down'}</span>
                            ${pnl >= 0 ? '+' : ''}${formatMoney(pnl)} (${pnl >= 0 ? '+' : ''}${pnlPercent}%)
                        </div>
                        <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 10px;">
                            <button class="pill-btn-gray" style="padding: 4px 10px; font-size: 10px;" onclick="handleSellInvestment('${inv.id}')">Sell</button>
                            <button class="pill-btn-gray" style="padding: 4px 10px; font-size: 10px;" onclick="handleUpdatePrice('${inv.id}')">Update</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    const totalDisplay = document.getElementById('portfolioTotal');
    if (totalDisplay) totalDisplay.textContent = formatMoney(totalValue);
    
    const pnlDisplay = document.getElementById('portfolioPnL');
    if (pnlDisplay) {
        const totalPnL = totalValue - totalInvested;
        const totalPnLPercent = totalInvested > 0 ? ((totalPnL / totalInvested) * 100).toFixed(2) : 0;
        pnlDisplay.innerHTML = `<span class="material-symbols-rounded">${totalPnL >= 0 ? 'trending_up' : 'trending_down'}</span> ${totalPnL >= 0 ? '+' : ''}${totalPnLPercent}% Overall`;
        pnlDisplay.style.color = totalPnL >= 0 ? '#fff' : '#fee2e2';
        pnlDisplay.style.background = totalPnL >= 0 ? 'rgba(255,255,255,0.2)' : 'rgba(239, 68, 68, 0.4)';
    }
}

async function simulateScan(input) {
    if (!input.files || !input.files[0]) return;
    
    const status = document.getElementById('scanStatus');
    if (status) status.classList.remove('hidden');
    
    // Simulate OCR processing
    setTimeout(async () => {
        const mockAmount = (Math.random() * 500 + 50).toFixed(2);
        const mockMerchant = ["Starbucks", "Walmart", "Shell", "Amazon"][Math.floor(Math.random() * 4)];
        
        const txAmountEl = document.getElementById('txAmount');
        const txNoteEl = document.getElementById('txNote');
        
        if (txAmountEl) txAmountEl.value = mockAmount;
        if (txNoteEl) txNoteEl.value = mockMerchant;
        
        if (status) status.classList.add('hidden');
        
        // Save as a Bill automatically as requested
        if (currentUser) {
            try {
                await db.collection('users').doc(currentUser.uid).collection('bills').add({
                    name: `Receipt: ${mockMerchant}`,
                    amount: parseFloat(mockAmount) / currencyRates[currentCurrency],
                    dueDate: new Date().toISOString().split('T')[0],
                    paid: true,
                    isReceipt: true,
                    createdAt: new Date().toISOString()
                });
            } catch (e) { console.error("Error saving receipt to bills:", e); }
        }
        
        showAlert('Scan Complete', `Extracted ${mockAmount} from ${mockMerchant}. Auto-saved to your Bills.`);
    }, 2000);
}

async function handleLoanPayment(loanId, amount) {
    if (!currentUser) return;
    const loan = loans.find(l => l.id === loanId);
    if (!loan) return;
    
    const newBalance = Math.max(0, loan.remainingBalance - amount);
    try {
        await db.collection('users').doc(currentUser.uid).collection('loans').doc(loanId).update({
            remainingBalance: newBalance
        });
        showAlert('Payment Logged', `Paid ${formatMoney(amount)} towards ${loan.name}.`);
    } catch (e) { console.error(e); }
}

async function handleLoanSettle(loanId) {
    if (!currentUser || !confirm('Are you sure you want to settle this loan completely?')) return;
    try {
        await db.collection('users').doc(currentUser.uid).collection('loans').doc(loanId).delete();
        showAlert('Loan Settled', 'The loan has been fully settled and removed.');
    } catch (e) { console.error(e); }
}

async function handleSellInvestment(invId) {
    if (!currentUser || !confirm('Confirm selling this asset? This will remove it from your portfolio.')) return;
    try {
        await db.collection('users').doc(currentUser.uid).collection('investments').doc(invId).delete();
        showAlert('Asset Sold', 'Holding removed from your portfolio.');
    } catch (e) { console.error(e); }
}

async function handleUpdatePrice(invId) {
    const newPrice = prompt('Enter current market price:');
    if (!newPrice || isNaN(parseFloat(newPrice))) return;
    
    try {
        await db.collection('users').doc(currentUser.uid).collection('investments').doc(invId).update({
            currentPrice: parseFloat(newPrice)
        });
    } catch (e) { console.error(e); }
}
