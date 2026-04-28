from flask import Flask, render_template, request, jsonify, url_for
import sqlite3
import os
from werkzeug.utils import secure_filename
from datetime import datetime

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'static/uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024 # 16 MB max

os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
DB_PATH = 'expento.db'

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    conn.execute('''
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL,
            amount REAL NOT NULL,
            category TEXT,
            note TEXT,
            date TEXT NOT NULL,
            receipt_url TEXT,
            is_upi BOOLEAN DEFAULT 0
        )
    ''')
    conn.execute('''
        CREATE TABLE IF NOT EXISTS budgets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category TEXT UNIQUE NOT NULL,
            limit_amount REAL NOT NULL,
            spent_amount REAL DEFAULT 0
        )
    ''')
    conn.commit()
    conn.close()

init_db()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/transactions', methods=['GET', 'POST'])
def handle_transactions():
    conn = get_db_connection()
    if request.method == 'POST':
        type_ = request.form.get('type')
        amount = float(request.form.get('amount'))
        category = request.form.get('category')
        note = request.form.get('note', '')
        date = request.form.get('date', datetime.now().strftime('%Y-%m-%d %H:%M:%S'))
        is_upi = request.form.get('is_upi', 'false').lower() == 'true'
        
        receipt_url = None
        if 'receipt' in request.files:
            file = request.files['receipt']
            if file.filename != '':
                filename = secure_filename(file.filename)
                timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
                filename = f"{timestamp}_{filename}"
                file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
                receipt_url = url_for('static', filename=f'uploads/{filename}')

        conn.execute('''
            INSERT INTO transactions (type, amount, category, note, date, receipt_url, is_upi)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (type_, amount, category, note, date, receipt_url, is_upi))
        
        if type_ == 'expense' and category:
            conn.execute('''
                UPDATE budgets SET spent_amount = spent_amount + ? WHERE category = ?
            ''', (amount, category))

        conn.commit()
        return jsonify({'status': 'success'}), 201

    else:
        transactions = conn.execute('SELECT * FROM transactions ORDER BY id DESC').fetchall()
        return jsonify([dict(tx) for tx in transactions])

@app.route('/api/transactions/<int:tx_id>', methods=['PUT', 'DELETE'])
def handle_single_transaction(tx_id):
    conn = get_db_connection()
    if request.method == 'DELETE':
        conn.execute('DELETE FROM transactions WHERE id = ?', (tx_id,))
        conn.commit()
        return jsonify({'status': 'success'})
    
    elif request.method == 'PUT':
        # For simplicity, we'll handle JSON update
        data = request.json
        conn.execute('''
            UPDATE transactions 
            SET type = ?, amount = ?, category = ?, note = ?
            WHERE id = ?
        ''', (data['type'], data['amount'], data['category'], data['note'], tx_id))
        conn.commit()
        return jsonify({'status': 'success'})

@app.route('/api/budgets', methods=['GET', 'POST'])
def handle_budgets():
    conn = get_db_connection()
    if request.method == 'POST':
        data = request.json
        category = data['category']
        limit_amount = float(data['limit_amount'])
        
        try:
            conn.execute('''
                INSERT INTO budgets (category, limit_amount)
                VALUES (?, ?)
            ''', (category, limit_amount))
        except sqlite3.IntegrityError:
            conn.execute('''
                UPDATE budgets SET limit_amount = ? WHERE category = ?
            ''', (limit_amount, category))
        
        conn.commit()
        return jsonify({'status': 'success'}), 201
    else:
        budgets = conn.execute('SELECT * FROM budgets').fetchall()
        for b in budgets:
            total_spent = conn.execute('SELECT SUM(amount) FROM transactions WHERE type = "expense" AND category = ?', (b['category'],)).fetchone()[0] or 0
            conn.execute('UPDATE budgets SET spent_amount = ? WHERE category = ?', (total_spent, b['category']))
        conn.commit()
        
        budgets = conn.execute('SELECT * FROM budgets').fetchall()
        return jsonify([dict(b) for b in budgets])

@app.route('/api/stats', methods=['GET'])
def get_stats():
    conn = get_db_connection()
    total_income = conn.execute('SELECT SUM(amount) FROM transactions WHERE type = "income"').fetchone()[0] or 0
    total_expense = conn.execute('SELECT SUM(amount) FROM transactions WHERE type = "expense"').fetchone()[0] or 0
    balance = total_income - total_expense
    return jsonify({
        'total_income': total_income,
        'total_expense': total_expense,
        'balance': balance
    })

if __name__ == '__main__':
    app.run(debug=True, port=5000)
