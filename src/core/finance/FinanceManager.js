/**
 * FinanceManager — Tax Prep & Bookkeeping for OpenAce
 *
 * Parses bank statements (CSV/PDF), AI-categorizes transactions into
 * IRS Schedule C categories, tracks mileage, and generates CPA-ready reports.
 * All data stays local — no cloud, no third-party access.
 */

import fs from 'fs/promises';
import path from 'path';

// IRS Schedule C categories with line numbers
const SCHEDULE_C_CATEGORIES = {
  advertising:           { line: 8,  label: 'Advertising' },
  car_and_truck:         { line: 9,  label: 'Car & Truck Expenses' },
  commissions:           { line: 10, label: 'Commissions & Fees' },
  contract_labor:        { line: 11, label: 'Contract Labor' },
  depletion:             { line: 12, label: 'Depletion' },
  depreciation:          { line: 13, label: 'Depreciation' },
  employee_benefits:     { line: 14, label: 'Employee Benefit Programs' },
  insurance:             { line: 15, label: 'Insurance (other than health)' },
  interest_mortgage:     { line: '16a', label: 'Interest (Mortgage)' },
  interest_other:        { line: '16b', label: 'Interest (Other)' },
  legal_professional:    { line: 17, label: 'Legal & Professional Services' },
  office_expenses:       { line: 18, label: 'Office Expenses' },
  pension_profit_sharing: { line: 19, label: 'Pension & Profit-Sharing Plans' },
  rent_vehicles:         { line: '20a', label: 'Rent (Vehicles, Machinery, Equipment)' },
  rent_other:            { line: '20b', label: 'Rent (Other Business Property)' },
  repairs:               { line: 21, label: 'Repairs & Maintenance' },
  supplies:              { line: 22, label: 'Supplies' },
  taxes_licenses:        { line: 23, label: 'Taxes & Licenses' },
  travel:                { line: '24a', label: 'Travel' },
  meals:                 { line: '24b', label: 'Meals (50% deductible)' },
  utilities:             { line: 25, label: 'Utilities' },
  wages:                 { line: 26, label: 'Wages' },
  other_expenses:        { line: 27, label: 'Other Expenses' },
  cost_of_goods:         { line: 4,  label: 'Cost of Goods Sold' },
  home_office:           { line: 30, label: 'Home Office Deduction' },
  bank_fees:             { line: 27, label: 'Bank Fees (Other Expenses)' },
  software_subscriptions: { line: 27, label: 'Software & Subscriptions (Other Expenses)' },
  education_training:    { line: 27, label: 'Education & Training (Other Expenses)' },
  refund:                { line: '-', label: 'Refund / Reimbursement' },
  income:                { line: 1,  label: 'Gross Receipts / Income' },
  uncategorized:         { line: '-', label: 'Uncategorized' },
};

const IRS_MILEAGE_RATE_2025 = 0.70; // $0.70/mile for 2025

export default class FinanceManager {
  constructor(options = {}) {
    this.dataPath = options.dataPath;
    this.uploadsDir = options.uploadsDir;
    this.aiManager = options.aiManager || null;
    this.data = null;
  }

  async initialize() {
    // Ensure directories
    await fs.mkdir(path.dirname(this.dataPath), { recursive: true });
    await fs.mkdir(this.uploadsDir, { recursive: true });

    // Load or create data
    try {
      const raw = await fs.readFile(this.dataPath, 'utf-8');
      this.data = JSON.parse(raw);
    } catch {
      this.data = {
        transactions: [],
        mileage: [],
        statements: [],
        year: new Date().getFullYear(),
      };
      await this._save();
    }
  }

  // ── Statement Ingestion ──────────────────────────────────

  async ingestStatement(buffer, filename) {
    const ext = path.extname(filename).toLowerCase();
    const stmtId = `stmt_${Date.now()}`;

    // Save original file
    const uploadPath = path.join(this.uploadsDir, `${stmtId}_${filename}`);
    await fs.writeFile(uploadPath, buffer);

    let transactions = [];

    if (ext === '.csv') {
      const text = buffer.toString('utf-8');
      transactions = this._parseCSV(text);
    } else if (ext === '.pdf') {
      // Use pdfjs-dist directly (pdf-parse v2 is buggy)
      let text = '';
      try {
        const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
        const uint8 = new Uint8Array(buffer);
        const doc = await pdfjsLib.getDocument({ data: uint8 }).promise;
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          const content = await page.getTextContent();
          text += content.items.map(item => item.str).join(' ') + '\n';
        }
      } catch (err) {
        throw new Error(`PDF parsing failed: ${err.message}`);
      }

      if (!text.trim()) {
        throw new Error('PDF contains no extractable text. It may be scanned/image-based.');
      }

      transactions = await this._parsePDFWithAI(text);
    } else if (ext === '.ofx' || ext === '.qfx') {
      const text = buffer.toString('utf-8');
      transactions = this._parseOFX(text);
    } else {
      throw new Error(`Unsupported file type: ${ext}. Use .csv, .pdf, .ofx, or .qfx`);
    }

    // Tag transactions with statement ID
    const dateRange = { from: null, to: null };
    for (const txn of transactions) {
      txn.id = `txn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      txn.source = 'statement';
      txn.statementId = stmtId;
      txn.category = txn.category || 'uncategorized';
      txn.categoryConfidence = 0;
      txn.notes = '';
      txn.personal = false;

      if (txn.date) {
        if (!dateRange.from || txn.date < dateRange.from) dateRange.from = txn.date;
        if (!dateRange.to || txn.date > dateRange.to) dateRange.to = txn.date;
      }
    }

    // Record statement
    this.data.statements.push({
      id: stmtId,
      filename,
      uploadedAt: new Date().toISOString(),
      transactionCount: transactions.length,
      dateRange,
    });

    // Add transactions
    this.data.transactions.push(...transactions);
    await this._save();

    return {
      statementId: stmtId,
      transactionCount: transactions.length,
      dateRange,
    };
  }

  _parseCSV(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return [];

    // Detect header row
    const headerLine = lines[0].toLowerCase();
    const delimiter = headerLine.includes('\t') ? '\t' : ',';

    const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());

    // Find column indices
    const dateIdx = headers.findIndex(h => /^(date|trans.*date|posted|post.*date)$/i.test(h));
    const descIdx = headers.findIndex(h => /^(description|memo|details|narrative|payee|name)$/i.test(h));
    const amountIdx = headers.findIndex(h => /^(amount|total)$/i.test(h));
    const debitIdx = headers.findIndex(h => /^(debit|withdrawal|money.?out|charges)$/i.test(h));
    const creditIdx = headers.findIndex(h => /^(credit|deposit|money.?in|payments)$/i.test(h));

    if (dateIdx === -1) {
      throw new Error('Could not find a Date column in the CSV. Expected headers like: Date, Description, Amount');
    }

    const transactions = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = this._splitCSVLine(lines[i], delimiter);
      if (!cols || cols.length < 2) continue;

      const rawDate = cols[dateIdx]?.replace(/^"|"$/g, '').trim();
      const description = (cols[descIdx] || cols[1] || '').replace(/^"|"$/g, '').trim();

      if (!rawDate || !description) continue;

      let amount = 0;
      if (amountIdx !== -1) {
        amount = this._parseAmount(cols[amountIdx]);
      } else if (debitIdx !== -1 || creditIdx !== -1) {
        const debit = debitIdx !== -1 ? this._parseAmount(cols[debitIdx]) : 0;
        const credit = creditIdx !== -1 ? this._parseAmount(cols[creditIdx]) : 0;
        amount = credit > 0 ? credit : -Math.abs(debit);
      }

      const date = this._normalizeDate(rawDate);
      if (!date) continue;

      transactions.push({
        date,
        description,
        amount,
        type: amount >= 0 ? 'credit' : 'debit',
      });
    }

    return transactions;
  }

  _splitCSVLine(line, delimiter = ',') {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === delimiter && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  }

  _parseAmount(str) {
    if (!str) return 0;
    const cleaned = str.replace(/^"|"$/g, '').replace(/[$,\s]/g, '').replace(/\((.+)\)/, '-$1');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }

  _normalizeDate(raw) {
    // Try common formats: MM/DD/YYYY, MM-DD-YYYY, YYYY-MM-DD, DD/MM/YYYY
    let m;

    // YYYY-MM-DD (ISO)
    m = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;

    // MM/DD/YYYY or MM-DD-YYYY
    m = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;

    // MM/DD/YY
    m = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/);
    if (m) {
      const yr = parseInt(m[3]) > 50 ? `19${m[3]}` : `20${m[3]}`;
      return `${yr}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
    }

    // Try JS Date as fallback
    const d = new Date(raw);
    if (!isNaN(d.getTime())) {
      return d.toISOString().slice(0, 10);
    }

    return null;
  }

  async _parsePDFWithAI(text) {
    if (!this.aiManager) {
      throw new Error('AI provider not available. Cannot parse PDF statement.');
    }

    // Truncate very long statements to avoid token limits
    const maxChars = 30000;
    const truncated = text.length > maxChars ? text.slice(0, maxChars) + '\n...[TRUNCATED]' : text;

    const prompt = `You are a bank statement parser. Extract EVERY transaction from this text.

Return ONLY a JSON array. Each object must have:
- "date": "YYYY-MM-DD"
- "description": the transaction description/payee
- "amount": number (negative for debits/charges/withdrawals, positive for credits/deposits/payments received)

Rules:
- Do NOT skip any transactions
- Do NOT fabricate transactions — only extract what appears in the text
- Ignore balance lines, headers, footers, interest rate info
- If a transaction has separate debit/credit columns, use negative for debits and positive for credits

Raw statement text:
${truncated}`;

    const messages = [{ role: 'user', content: prompt }];
    const response = await this.aiManager.chat(messages, { temperature: 0.1 });
    const responseText = typeof response === 'string' ? response : response?.text || response?.content || '';

    // Extract JSON array from response
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('AI could not extract transactions from the PDF. The statement format may not be supported.');
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(parsed)) throw new Error('Not an array');

      return parsed
        .filter(t => t.date && t.description && typeof t.amount === 'number')
        .map(t => ({
          date: t.date,
          description: String(t.description).trim(),
          amount: Number(t.amount),
          type: t.amount >= 0 ? 'credit' : 'debit',
        }));
    } catch (err) {
      throw new Error(`Failed to parse AI response as transaction JSON: ${err.message}`);
    }
  }

  _parseOFX(text) {
    // Simple OFX/QFX parser — extract STMTTRN blocks
    const transactions = [];
    const txnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
    let match;

    while ((match = txnRegex.exec(text)) !== null) {
      const block = match[1];
      const get = (tag) => {
        const m = block.match(new RegExp(`<${tag}>([^<\\n]+)`, 'i'));
        return m ? m[1].trim() : '';
      };

      const rawDate = get('DTPOSTED');
      const amount = parseFloat(get('TRNAMT')) || 0;
      const description = get('NAME') || get('MEMO') || 'Unknown';

      let date = null;
      if (rawDate.length >= 8) {
        date = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`;
      }

      if (date) {
        transactions.push({
          date,
          description,
          amount,
          type: amount >= 0 ? 'credit' : 'debit',
        });
      }
    }

    return transactions;
  }

  // ── AI Categorization ────────────────────────────────────

  async categorizeTransactions(txnIds = null) {
    if (!this.aiManager) {
      throw new Error('AI provider not available for categorization.');
    }

    // Get uncategorized transactions (or specific IDs)
    let targets;
    if (txnIds) {
      targets = this.data.transactions.filter(t => txnIds.includes(t.id));
    } else {
      targets = this.data.transactions.filter(t => t.category === 'uncategorized' && !t.personal);
    }

    if (targets.length === 0) return { categorized: 0 };

    const categoryList = Object.entries(SCHEDULE_C_CATEGORIES)
      .filter(([k]) => k !== 'uncategorized' && k !== 'income')
      .map(([k, v]) => `${k}: ${v.label}`)
      .join('\n');

    // Process in batches of 20
    let categorized = 0;
    for (let i = 0; i < targets.length; i += 20) {
      const batch = targets.slice(i, i + 20);
      const batchData = batch.map(t => ({
        id: t.id,
        date: t.date,
        description: t.description,
        amount: t.amount,
        type: t.type,
      }));

      const prompt = `Categorize these business transactions into IRS Schedule C categories.

Available categories:
income: Gross Receipts / Income (for credits/deposits that are business revenue)
${categoryList}

For each transaction, return a JSON array with:
{ "id": "...", "category": "category_key", "personal": true/false, "confidence": 0.0-1.0 }

Rules:
- Mark as personal=true if clearly not business (groceries, personal dining, entertainment, personal shopping, etc.)
- Credits/deposits that look like business payments → "income"
- Use your best judgment for category. When unsure, use "other_expenses".
- Return ONLY the JSON array, no explanation.

Transactions:
${JSON.stringify(batchData, null, 2)}`;

      try {
        const messages = [{ role: 'user', content: prompt }];
        const response = await this.aiManager.chat(messages, { temperature: 0.1 });
        const responseText = typeof response === 'string' ? response : response?.text || response?.content || '';

        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        if (!jsonMatch) continue;

        const results = JSON.parse(jsonMatch[0]);
        if (!Array.isArray(results)) continue;

        for (const result of results) {
          const txn = this.data.transactions.find(t => t.id === result.id);
          if (txn && result.category) {
            txn.category = result.category;
            txn.categoryConfidence = result.confidence || 0;
            if (result.personal === true) txn.personal = true;
            categorized++;
          }
        }
      } catch (err) {
        console.error('[Finance] Categorization batch failed:', err.message);
      }
    }

    await this._save();
    return { categorized, total: targets.length };
  }

  // ── Manual Entries ───────────────────────────────────────

  addManualExpense({ date, description, amount, category }) {
    if (!date || !description || amount === undefined) {
      throw new Error('Missing required fields: date, description, amount');
    }

    const txn = {
      id: `txn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      date,
      description,
      amount: Number(amount),
      type: Number(amount) >= 0 ? 'credit' : 'debit',
      category: category || 'other_expenses',
      categoryConfidence: 1.0,
      source: 'manual',
      statementId: null,
      notes: '',
      personal: false,
    };

    this.data.transactions.push(txn);
    this._save();
    return txn;
  }

  addMileage({ date, miles, purpose, rate }) {
    if (!date || !miles) {
      throw new Error('Missing required fields: date, miles');
    }

    const mileRate = rate || IRS_MILEAGE_RATE_2025;
    const entry = {
      id: `mile_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      date,
      miles: Number(miles),
      purpose: purpose || '',
      rate: mileRate,
      amount: Math.round(Number(miles) * mileRate * 100) / 100,
    };

    this.data.mileage.push(entry);
    this._save();
    return entry;
  }

  addBulkMileage(entries, year) {
    // entries = [{ month: 1, miles: 520, purpose: 'Business driving' }, ...]
    if (!Array.isArray(entries) || entries.length === 0) {
      throw new Error('No mileage entries provided');
    }

    const yr = year || new Date().getFullYear();
    const added = [];

    for (const entry of entries) {
      if (!entry.miles || Number(entry.miles) <= 0) continue;

      const month = Number(entry.month);
      // Use the 15th of the month as the representative date
      const date = `${yr}-${String(month).padStart(2, '0')}-15`;
      const miles = Number(entry.miles);
      const rate = IRS_MILEAGE_RATE_2025;

      const mileEntry = {
        id: `mile_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        date,
        miles,
        purpose: entry.purpose || `Business mileage - ${new Date(yr, month - 1).toLocaleString('default', { month: 'long' })} ${yr}`,
        rate,
        amount: Math.round(miles * rate * 100) / 100,
      };

      this.data.mileage.push(mileEntry);
      added.push(mileEntry);
    }

    this._save();
    return { added: added.length, entries: added };
  }

  updateMileage(id, updates) {
    const entry = this.data.mileage.find(m => m.id === id);
    if (!entry) throw new Error(`Mileage entry not found: ${id}`);

    if (updates.date !== undefined) entry.date = updates.date;
    if (updates.miles !== undefined) {
      entry.miles = Number(updates.miles);
      entry.amount = Math.round(entry.miles * entry.rate * 100) / 100;
    }
    if (updates.purpose !== undefined) entry.purpose = updates.purpose;

    this._save();
    return entry;
  }

  deleteMileage(id) {
    const idx = this.data.mileage.findIndex(m => m.id === id);
    if (idx === -1) throw new Error(`Mileage entry not found: ${id}`);
    this.data.mileage.splice(idx, 1);
    this._save();
  }

  // ── Transaction Management ───────────────────────────────

  updateTransaction(id, updates) {
    const txn = this.data.transactions.find(t => t.id === id);
    if (!txn) throw new Error(`Transaction not found: ${id}`);

    if (updates.category !== undefined) {
      txn.category = updates.category;
      txn.categoryConfidence = 1.0; // Manual override = full confidence
    }
    if (updates.notes !== undefined) txn.notes = updates.notes;
    if (updates.personal !== undefined) txn.personal = updates.personal;
    if (updates.description !== undefined) txn.description = updates.description;

    this._save();
    return txn;
  }

  deleteTransaction(id) {
    const idx = this.data.transactions.findIndex(t => t.id === id);
    if (idx === -1) throw new Error(`Transaction not found: ${id}`);
    this.data.transactions.splice(idx, 1);
    this._save();
  }

  togglePersonal(id) {
    const txn = this.data.transactions.find(t => t.id === id);
    if (!txn) throw new Error(`Transaction not found: ${id}`);
    txn.personal = !txn.personal;
    this._save();
    return txn;
  }

  // ── Queries ──────────────────────────────────────────────

  getTransactions(filters = {}) {
    let txns = [...this.data.transactions];

    if (filters.year) txns = txns.filter(t => t.date?.startsWith(String(filters.year)));
    if (filters.month) {
      const monthStr = String(filters.month).padStart(2, '0');
      txns = txns.filter(t => t.date?.slice(5, 7) === monthStr);
    }
    if (filters.category) txns = txns.filter(t => t.category === filters.category);
    if (filters.source) txns = txns.filter(t => t.source === filters.source);
    if (filters.personal !== undefined) txns = txns.filter(t => t.personal === filters.personal);
    if (filters.type) txns = txns.filter(t => t.type === filters.type);
    if (filters.search) {
      const q = filters.search.toLowerCase();
      txns = txns.filter(t => t.description?.toLowerCase().includes(q));
    }

    // Sort by date descending
    txns.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    return txns;
  }

  getMileage(year) {
    let entries = [...this.data.mileage];
    if (year) entries = entries.filter(m => m.date?.startsWith(String(year)));
    entries.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    return entries;
  }

  getStatements() {
    return [...this.data.statements].sort((a, b) => (b.uploadedAt || '').localeCompare(a.uploadedAt || ''));
  }

  getStats(year) {
    const yr = year || new Date().getFullYear();
    const txns = this.data.transactions.filter(t =>
      t.date?.startsWith(String(yr)) && !t.personal
    );

    const income = txns.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
    const expenses = txns.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const mileageEntries = this.data.mileage.filter(m => m.date?.startsWith(String(yr)));
    const totalMiles = mileageEntries.reduce((sum, m) => sum + (m.miles || 0), 0);
    const mileageDeduction = mileageEntries.reduce((sum, m) => sum + (m.amount || 0), 0);

    const uncategorized = txns.filter(t => t.category === 'uncategorized').length;
    const totalTransactions = txns.length;

    // Category breakdown
    const categories = {};
    for (const txn of txns) {
      if (!categories[txn.category]) categories[txn.category] = { total: 0, count: 0 };
      categories[txn.category].total += txn.amount;
      categories[txn.category].count++;
    }

    return {
      year: yr,
      income: Math.round(income * 100) / 100,
      expenses: Math.round(expenses * 100) / 100,
      net: Math.round((income - expenses) * 100) / 100,
      totalMiles: Math.round(totalMiles * 10) / 10,
      mileageDeduction: Math.round(mileageDeduction * 100) / 100,
      uncategorized,
      totalTransactions,
      categories,
      statementCount: this.data.statements.length,
    };
  }

  // ── Report Generation ────────────────────────────────────

  generateReport(year) {
    const yr = year || new Date().getFullYear();
    const txns = this.data.transactions.filter(t =>
      t.date?.startsWith(String(yr)) && !t.personal
    );

    // Category totals with Schedule C line numbers
    const categoryTotals = {};
    for (const txn of txns) {
      const cat = txn.category || 'uncategorized';
      if (!categoryTotals[cat]) {
        const info = SCHEDULE_C_CATEGORIES[cat] || { line: '-', label: cat };
        categoryTotals[cat] = {
          category: cat,
          label: info.label,
          scheduleCLine: info.line,
          total: 0,
          count: 0,
          transactions: [],
        };
      }
      categoryTotals[cat].total += txn.amount;
      categoryTotals[cat].count++;
      categoryTotals[cat].transactions.push(txn);
    }

    // Mileage
    const mileageEntries = this.data.mileage.filter(m => m.date?.startsWith(String(yr)));
    const totalMiles = mileageEntries.reduce((sum, m) => sum + (m.miles || 0), 0);
    const mileageDeduction = mileageEntries.reduce((sum, m) => sum + (m.amount || 0), 0);

    // Summary
    const income = txns.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
    const expenses = txns.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0);

    return {
      year: yr,
      generatedAt: new Date().toISOString(),
      summary: {
        grossIncome: Math.round(income * 100) / 100,
        totalExpenses: Math.round((expenses + mileageDeduction) * 100) / 100,
        netProfit: Math.round((income - expenses - mileageDeduction) * 100) / 100,
        totalMiles,
        mileageDeduction: Math.round(mileageDeduction * 100) / 100,
        mileageRate: IRS_MILEAGE_RATE_2025,
      },
      categories: Object.values(categoryTotals)
        .sort((a, b) => Math.abs(b.total) - Math.abs(a.total)),
      mileageLog: mileageEntries.sort((a, b) => (a.date || '').localeCompare(b.date || '')),
      transactionCount: txns.length,
      personalExcluded: this.data.transactions.filter(t =>
        t.date?.startsWith(String(yr)) && t.personal
      ).length,
    };
  }

  exportCSV(year) {
    const report = this.generateReport(year);

    const lines = [];
    lines.push('=== CPA TAX REPORT ===');
    lines.push(`Year: ${report.year}`);
    lines.push(`Generated: ${report.generatedAt}`);
    lines.push('');

    // Summary
    lines.push('=== SUMMARY ===');
    lines.push(`Gross Income,$${report.summary.grossIncome.toFixed(2)}`);
    lines.push(`Total Expenses,$${report.summary.totalExpenses.toFixed(2)}`);
    lines.push(`Net Profit/Loss,$${report.summary.netProfit.toFixed(2)}`);
    lines.push(`Mileage Deduction (${report.summary.totalMiles} mi x $${report.summary.mileageRate}/mi),$${report.summary.mileageDeduction.toFixed(2)}`);
    lines.push('');

    // Category breakdown
    lines.push('=== SCHEDULE C BREAKDOWN ===');
    lines.push('Category,Schedule C Line,Amount,Transaction Count');
    for (const cat of report.categories) {
      lines.push(`"${cat.label}",Line ${cat.scheduleCLine},$${Math.abs(cat.total).toFixed(2)},${cat.count}`);
    }
    lines.push('');

    // All transactions
    lines.push('=== ALL TRANSACTIONS ===');
    lines.push('Date,Description,Amount,Type,Category,Source,Notes');
    const allTxns = this.data.transactions
      .filter(t => t.date?.startsWith(String(year || new Date().getFullYear())) && !t.personal)
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    for (const t of allTxns) {
      const catInfo = SCHEDULE_C_CATEGORIES[t.category] || { label: t.category };
      lines.push(`${t.date},"${t.description.replace(/"/g, '""')}",${t.amount.toFixed(2)},${t.type},"${catInfo.label}",${t.source},"${(t.notes || '').replace(/"/g, '""')}"`);
    }
    lines.push('');

    // Mileage log
    if (report.mileageLog.length > 0) {
      lines.push('=== MILEAGE LOG ===');
      lines.push('Date,Miles,Purpose,Rate,Deduction');
      for (const m of report.mileageLog) {
        lines.push(`${m.date},${m.miles},"${(m.purpose || '').replace(/"/g, '""')}",$${m.rate},${m.amount.toFixed(2)}`);
      }
    }

    return lines.join('\n');
  }

  // ── Statement Management ─────────────────────────────────

  deleteStatement(stmtId) {
    const idx = this.data.statements.findIndex(s => s.id === stmtId);
    if (idx === -1) throw new Error(`Statement not found: ${stmtId}`);

    // Remove all transactions from this statement
    this.data.transactions = this.data.transactions.filter(t => t.statementId !== stmtId);
    this.data.statements.splice(idx, 1);
    this._save();
  }

  // ── Categories Reference ─────────────────────────────────

  getCategories() {
    return Object.entries(SCHEDULE_C_CATEGORIES).map(([key, val]) => ({
      key,
      label: val.label,
      line: val.line,
    }));
  }

  // ── Persistence ──────────────────────────────────────────

  async _save() {
    try {
      await fs.mkdir(path.dirname(this.dataPath), { recursive: true });
      await fs.writeFile(this.dataPath, JSON.stringify(this.data, null, 2));
    } catch (err) {
      console.error('[Finance] Save failed:', err.message);
    }
  }
}
