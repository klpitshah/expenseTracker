import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import type { Transaction, CategoryTotal, HighlightColor, TransactionDocument } from './types';
import * as api from './api';
import { INCOME_THAT_HITS_ACCOUNT, FIXED_MUST_SAVINGS } from './your_numbers.js';
import { AccountBadge } from './AccountBadge';
import './App.css';

export type Theme = 'dark' | 'light';

const HIGHLIGHT_COLORS: Record<NonNullable<HighlightColor>, string> = {
  pink: 'rgba(255, 0, 110, 0.25)',
  blue: 'rgba(0, 212, 255, 0.2)',
  purple: 'rgba(191, 90, 242, 0.25)',
  lime: 'rgba(184, 255, 0, 0.2)',
  orange: 'rgba(255, 149, 0, 0.25)',
  yellow: 'rgba(255, 214, 10, 0.25)',
  red: 'rgba(255, 59, 48, 0.25)',
};

const PIE_COLORS = [
  '#00d4ff', '#ff006e', '#b8ff00', '#bf5af2', '#ff9500',
  '#5ac8fa', '#af52de', '#30d158', '#ffd60a', '#ff375f', '#64d2ff',
];

// Generate month tabs
function getMonthTabs(): { label: string; value: string }[] {
  const tabs: { label: string; value: string }[] = [];
  const now = new Date();
  for (let i = -2; i <= 1; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    tabs.push({
      label: d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
    });
  }
  return tabs;
}

function computeCategoryTotals(transactions: Transaction[]): CategoryTotal[] {
  const byCategory = new Map<string, number>();
  for (const t of transactions) {
    const cat = t.user_category || 'uncategorized';
    const current = byCategory.get(cat) ?? 0;
    // Expenses are negative → adds to spent; refunds are positive → subtracts
    byCategory.set(cat, current - t.amount);
  }
  return Array.from(byCategory.entries())
    .map(([category, spent]) => ({ category, spent }))
    .sort((a, b) => b.spent - a.spent);
}

function getRowBackground(t: Transaction): string | undefined {
  if (t.highlight_color && HIGHLIGHT_COLORS[t.highlight_color]) {
    return HIGHLIGHT_COLORS[t.highlight_color];
  }
  return undefined;
}

function computePieData(transactions: Transaction[]): { name: string; value: number }[] {
  const totals = computeCategoryTotals(transactions);
  const grandTotal = totals.reduce((s, t) => s + t.spent, 0);
  return totals.map(({ category, spent }) => ({
    name: category,
    value: grandTotal > 0 ? Math.round((spent / grandTotal) * 1000) / 10 : 0,
  }));
}

function formatAmount(amount: number): string {
  const absAmount = Math.abs(amount);
  return amount < 0 ? `-$${absAmount.toFixed(2)}` : `$${absAmount.toFixed(2)}`;
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getMonthFromDate(dateStr: string): string {
  const [year, month] = dateStr.split('-').map(Number);
  return `${year}-${String(month).padStart(2, '0')}`;
}

// Get display name for a transaction
function getDisplayName(t: Transaction): string {
  return t.title || t.vendor || t.description || 'Unknown';
}

function getDocumentCount(t: Transaction): number {
  return t.documents?.length ?? 0;
}

interface DocumentViewerModalProps {
  transaction: Transaction;
  document: TransactionDocument;
  onClose: () => void;
}

function DocumentViewerModal({ transaction, document, onClose }: DocumentViewerModalProps) {
  const url = api.getDocumentUrl(transaction.id, document.id);
  const isImage = document.mimeType.startsWith('image/');
  const isPdf = document.mimeType === 'application/pdf';

  return (
    <div className="modal-backdrop document-viewer-backdrop" onClick={onClose}>
      <div className="modal document-viewer-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{document.originalName}</h2>
          <button type="button" className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="document-viewer-body">
          {isImage && <img src={url} alt={document.originalName} className="document-viewer-image" />}
          {isPdf && <iframe src={url} title={document.originalName} className="document-viewer-frame" />}
          {!isImage && !isPdf && (
            <div className="document-viewer-fallback">
              <p>Preview is not available for this file type.</p>
              <a href={url} target="_blank" rel="noopener noreferrer" className="btn-primary">Open file</a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface DocumentsModalProps {
  transaction: Transaction;
  onClose: () => void;
  onDocumentsChange: (transaction: Transaction) => void;
}

function DocumentsModal({ transaction, onClose, onDocumentsChange }: DocumentsModalProps) {
  const [uploading, setUploading] = useState(false);
  const [viewingDoc, setViewingDoc] = useState<TransactionDocument | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const documents = transaction.documents || [];

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const updated = await api.uploadDocument(transaction.id, file);
      onDocumentsChange(updated);
    } catch (err) {
      console.error('Failed to upload document:', err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (docId: string) => {
    if (!window.confirm('Delete this document?')) return;
    try {
      const updated = await api.deleteDocument(transaction.id, docId);
      onDocumentsChange(updated);
      if (viewingDoc?.id === docId) setViewingDoc(null);
    } catch (err) {
      console.error('Failed to delete document:', err);
    }
  };

  return (
    <>
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal documents-modal" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h2>Documents</h2>
            <button type="button" className="modal-close" onClick={onClose}>✕</button>
          </div>

          <div className="documents-modal-subtitle">{getDisplayName(transaction)}</div>

          <div className="documents-upload-row">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf,.doc,.docx,.txt,.csv,.xls,.xlsx"
              onChange={handleUpload}
              className="documents-file-input"
              id={`documents-upload-${transaction.id}`}
            />
            <label htmlFor={`documents-upload-${transaction.id}`} className="btn-primary documents-upload-btn">
              {uploading ? 'Uploading…' : '+ Upload document'}
            </label>
          </div>

          {documents.length === 0 ? (
            <div className="documents-empty">No documents attached yet.</div>
          ) : (
            <ul className="documents-list">
              {documents.map(doc => (
                <li key={doc.id} className="documents-list-item">
                  <button type="button" className="documents-list-view" onClick={() => setViewingDoc(doc)}>
                    <span className="documents-list-name">{doc.originalName}</span>
                    <span className="documents-list-meta">
                      {api.formatDocumentSize(doc.size)}
                      {api.isPreviewableDocument(doc) ? ' · preview' : ' · download'}
                    </span>
                  </button>
                  <button type="button" className="documents-list-delete" onClick={() => handleDelete(doc.id)} title="Delete document">
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {viewingDoc && (
        <DocumentViewerModal
          transaction={transaction}
          document={viewingDoc}
          onClose={() => setViewingDoc(null)}
        />
      )}
    </>
  );
}

interface EditRowState {
  title: string;
  vendor: string;
  description: string;
  user_category: string;
  amount: string;
  notes: string;
  date: string;
}

interface ReviewTileProps {
  transaction: Transaction;
  onApprove: () => void;
  onReject: () => void;
  onUpdate: (t: Transaction) => void;
  onOpenDocuments: (t: Transaction) => void;
}

function ReviewTile({ transaction, onApprove, onReject, onUpdate, onOpenDocuments }: ReviewTileProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editState, setEditState] = useState<EditRowState>({
    title: transaction.title,
    vendor: transaction.vendor || '',
    description: transaction.description || '',
    user_category: transaction.user_category || '',
    amount: String(Math.abs(transaction.amount)),
    notes: transaction.notes,
    date: transaction.date,
  });

  const handleSave = () => {
    onUpdate({
      ...transaction,
      title: editState.title,
      vendor: editState.vendor,
      description: editState.description,
      user_category: editState.user_category,
      amount: transaction.amount < 0 ? -Math.abs(parseFloat(editState.amount)) : Math.abs(parseFloat(editState.amount)),
      notes: editState.notes,
      date: editState.date,
    });
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditState({
        title: transaction.title,
        vendor: transaction.vendor || '',
        description: transaction.description || '',
        user_category: transaction.user_category || '',
        amount: String(Math.abs(transaction.amount)),
        notes: transaction.notes,
        date: transaction.date,
      });
    }
  };

  if (isEditing) {
    return (
      <div className="review-tile editing">
        <div className="tile-edit-form">
          <div className="tile-edit-row">
            <label>Date</label>
            <input
              type="date"
              value={editState.date}
              onChange={e => setEditState(s => ({ ...s, date: e.target.value }))}
              onKeyDown={handleKeyDown}
            />
          </div>
          <div className="tile-edit-row">
            <label>Title</label>
            <input
              type="text"
              value={editState.title}
              onChange={e => setEditState(s => ({ ...s, title: e.target.value }))}
              onKeyDown={handleKeyDown}
              autoFocus
            />
          </div>
          <div className="tile-edit-row">
            <label>Vendor</label>
            <input
              type="text"
              value={editState.vendor}
              onChange={e => setEditState(s => ({ ...s, vendor: e.target.value }))}
              onKeyDown={handleKeyDown}
            />
          </div>
          <div className="tile-edit-row">
            <label>Category</label>
            <input
              type="text"
              value={editState.user_category}
              onChange={e => setEditState(s => ({ ...s, user_category: e.target.value }))}
              onKeyDown={handleKeyDown}
              placeholder="Enter category..."
            />
          </div>
          <div className="tile-edit-row">
            <label>Amount</label>
            <input
              type="number"
              step="0.01"
              value={editState.amount}
              onChange={e => setEditState(s => ({ ...s, amount: e.target.value }))}
              onKeyDown={handleKeyDown}
            />
          </div>
          <div className="tile-edit-row">
            <label>Notes</label>
            <input
              type="text"
              value={editState.notes}
              onChange={e => setEditState(s => ({ ...s, notes: e.target.value }))}
              onKeyDown={handleKeyDown}
            />
          </div>
          <div className="tile-edit-actions">
            <button type="button" className="btn-ghost" onClick={() => setIsEditing(false)}>Cancel</button>
            <button type="button" className="btn-primary" onClick={handleSave}>Save</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="review-tile" onDoubleClick={() => setIsEditing(true)}>
      <div className="tile-header">
        <span className="tile-date">{formatDate(transaction.date)}</span>
        <AccountBadge accountId={transaction.account_id} compact />
        {transaction.user_category && (
          <span className="tile-category">{transaction.user_category}</span>
        )}
      </div>
      <div className="tile-main">
        <div className="tile-title">{getDisplayName(transaction)}</div>
        {transaction.vendor && transaction.vendor !== transaction.title && (
          <div className="tile-vendor">{transaction.vendor}</div>
        )}
        <div className="tile-amount">{formatAmount(transaction.amount)}</div>
      </div>
      {transaction.description && (
        <div className="tile-description">{transaction.description}</div>
      )}
      {getDocumentCount(transaction) > 0 && (
        <div className="tile-documents-badge">{getDocumentCount(transaction)} document{getDocumentCount(transaction) === 1 ? '' : 's'}</div>
      )}
      <div className="tile-actions">
        <button type="button" className="btn-docs" onClick={() => onOpenDocuments(transaction)}>Docs</button>
        <button type="button" className="btn-reject" onClick={onReject}>Reject</button>
        <button type="button" className="btn-edit" onClick={() => setIsEditing(true)}>Edit</button>
        <button type="button" className="btn-approve" onClick={onApprove}>Approve</button>
      </div>
    </div>
  );
}

interface InlineEditRowProps {
  transaction: Transaction;
  onSave: (t: Transaction) => void;
  onCancel: () => void;
  onDelete: () => void;
  onOpenDocuments: (t: Transaction) => void;
}

function InlineEditRow({ transaction, onSave, onCancel, onDelete, onOpenDocuments }: InlineEditRowProps) {
  const [editState, setEditState] = useState<EditRowState>({
    title: transaction.title,
    vendor: transaction.vendor || '',
    description: transaction.description || '',
    user_category: transaction.user_category || '',
    amount: String(Math.abs(transaction.amount)),
    notes: transaction.notes,
    date: transaction.date,
  });
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const handleSave = () => {
    onSave({
      ...transaction,
      title: editState.title,
      vendor: editState.vendor,
      description: editState.description,
      user_category: editState.user_category,
      amount: transaction.amount < 0 ? -Math.abs(parseFloat(editState.amount)) : Math.abs(parseFloat(editState.amount)),
      notes: editState.notes,
      date: editState.date,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <tr className="row-editing">
      <td className="col-date">
        <input
          type="date"
          value={editState.date}
          onChange={e => setEditState(s => ({ ...s, date: e.target.value }))}
          onKeyDown={handleKeyDown}
          className="cell-input"
        />
      </td>
      <td className="col-vendor">
        <input
          type="text"
          value={editState.vendor}
          onChange={e => setEditState(s => ({ ...s, vendor: e.target.value }))}
          onKeyDown={handleKeyDown}
          className="cell-input"
          placeholder="Vendor..."
        />
      </td>
      <td className="col-title">
        <input
          ref={titleRef}
          type="text"
          value={editState.title}
          onChange={e => setEditState(s => ({ ...s, title: e.target.value }))}
          onKeyDown={handleKeyDown}
          className="cell-input"
        />
      </td>
      <td className="col-category">
        <input
          type="text"
          value={editState.user_category}
          onChange={e => setEditState(s => ({ ...s, user_category: e.target.value }))}
          onKeyDown={handleKeyDown}
          className="cell-input"
          placeholder="Category..."
        />
      </td>
      <td className="col-account">
        <AccountBadge accountId={transaction.account_id} />
      </td>
      <td className="col-money">
        <input
          type="number"
          step="0.01"
          value={editState.amount}
          onChange={e => setEditState(s => ({ ...s, amount: e.target.value }))}
          onKeyDown={handleKeyDown}
          className="cell-input num"
        />
      </td>
      <td className="col-notes">
        <input
          type="text"
          value={editState.notes}
          onChange={e => setEditState(s => ({ ...s, notes: e.target.value }))}
          onKeyDown={handleKeyDown}
          className="cell-input"
        />
      </td>
      <td className="col-actions">
        <button type="button" className="btn-row-docs" onClick={() => onOpenDocuments(transaction)}>Docs</button>
        <button type="button" className="btn-row-save" onClick={handleSave}>Save</button>
        <button type="button" className="btn-row-delete" onClick={onDelete}>Delete</button>
      </td>
    </tr>
  );
}

// Split Transaction Modal
interface SplitModalProps {
  transaction: Transaction;
  onSave: (splits: { amount: number; category: string; name: string }[]) => void;
  onClose: () => void;
}

interface SplitRow {
  id: string;
  amount: string;
  category: string;
  name: string;
}

function SplitModal({ transaction, onSave, onClose }: SplitModalProps) {
  const totalAmount = Math.abs(transaction.amount);
  const [splits, setSplits] = useState<SplitRow[]>([
    { id: '1', amount: '', category: '', name: '' },
    { id: '2', amount: '', category: '', name: '' },
  ]);

  const currentTotal = splits.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
  const remaining = totalAmount - currentTotal;
  const isValid = Math.abs(remaining) < 0.01 && splits.every(s => parseFloat(s.amount) > 0);

  const addRow = () => {
    setSplits(prev => [...prev, { id: String(Date.now()), amount: '', category: '', name: '' }]);
  };

  const removeRow = (id: string) => {
    if (splits.length > 2) {
      setSplits(prev => prev.filter(s => s.id !== id));
    }
  };

  const updateRow = (id: string, field: 'amount' | 'category' | 'name', value: string) => {
    setSplits(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const handleSave = () => {
    if (!isValid) return;
    onSave(splits.map(s => ({
      amount: parseFloat(s.amount),
      category: s.category,
      name: s.name,
    })));
  };

  const fillRemaining = (id: string) => {
    const otherTotal = splits.filter(s => s.id !== id).reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
    const fill = totalAmount - otherTotal;
    if (fill > 0) {
      updateRow(id, 'amount', fill.toFixed(2));
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal split-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Split Transaction</h2>
          <button type="button" className="modal-close" onClick={onClose}>✕</button>
        </div>
        
        <div className="split-original">
          <div className="split-original-title">{getDisplayName(transaction)}</div>
          <div className="split-original-vendor">{transaction.vendor || transaction.description}</div>
          <div className="split-original-amount">${totalAmount.toFixed(2)}</div>
        </div>

        <div className="split-rows">
          {splits.map((split, idx) => (
            <div key={split.id} className="split-row">
              <div className="split-row-header">
                <span className="split-row-num">#{idx + 1}</span>
                <div className="split-row-amount">
                  <span className="split-currency">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={split.amount}
                    onChange={e => updateRow(split.id, 'amount', e.target.value)}
                  />
                  <button
                    type="button"
                    className="split-fill-btn"
                    title="Fill remaining"
                    onClick={() => fillRemaining(split.id)}
                  >
                    ↵
                  </button>
                </div>
                {splits.length > 2 && (
                  <button type="button" className="split-remove-btn" onClick={() => removeRow(split.id)}>✕</button>
                )}
              </div>
              <div className="split-row-fields">
                <input
                  type="text"
                  placeholder="Name (optional)"
                  className="split-row-title"
                  value={split.name}
                  onChange={e => updateRow(split.id, 'name', e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Category"
                  className="split-row-category"
                  value={split.category}
                  onChange={e => updateRow(split.id, 'category', e.target.value)}
                />
              </div>
            </div>
          ))}
        </div>

        <button type="button" className="split-add-btn" onClick={addRow}>+ Add another split</button>

        <div className={`split-summary ${Math.abs(remaining) < 0.01 ? 'valid' : remaining < 0 ? 'over' : 'under'}`}>
          <div className="split-summary-row">
            <span>Total:</span>
            <span>${currentTotal.toFixed(2)}</span>
          </div>
          <div className="split-summary-row">
            <span>Remaining:</span>
            <span>${remaining.toFixed(2)}</span>
          </div>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn-primary" onClick={handleSave} disabled={!isValid}>
            Split into {splits.length} transactions
          </button>
        </div>
      </div>
    </div>
  );
}

// Add Transaction Modal
interface AddModalProps {
  onSave: (data: { title: string; vendor: string; description: string; user_category: string; amount: number; date: string; notes: string }) => void;
  onClose: () => void;
}

function AddTransactionModal({ onSave, onClose }: AddModalProps) {
  const today = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({
    title: '',
    vendor: '',
    description: '',
    user_category: '',
    amount: '',
    date: today,
    notes: '',
  });

  const isValid = form.title.trim() && parseFloat(form.amount) > 0;

  const handleSave = () => {
    if (!isValid) return;
    onSave({
      title: form.title.trim(),
      vendor: form.vendor.trim(),
      description: form.description.trim(),
      user_category: form.user_category.trim(),
      amount: parseFloat(form.amount),
      date: form.date,
      notes: form.notes.trim(),
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && isValid) handleSave();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal add-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add Transaction</h2>
          <button type="button" className="modal-close" onClick={onClose}>✕</button>
        </div>
        
        <div className="add-form">
          <div className="add-form-row">
            <label>Title *</label>
            <input
              type="text"
              placeholder="e.g. Coffee"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              onKeyDown={handleKeyDown}
              autoFocus
            />
          </div>
          
          <div className="add-form-row">
            <label>Vendor</label>
            <input
              type="text"
              placeholder="e.g. Starbucks"
              value={form.vendor}
              onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))}
              onKeyDown={handleKeyDown}
            />
          </div>
          
          <div className="add-form-row-group">
            <div className="add-form-row">
              <label>Amount *</label>
              <div className="add-amount-input">
                <span className="add-currency">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  onKeyDown={handleKeyDown}
                />
              </div>
            </div>
            
            <div className="add-form-row">
              <label>Date</label>
              <input
                type="date"
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                onKeyDown={handleKeyDown}
              />
            </div>
          </div>
          
          <div className="add-form-row">
            <label>Category</label>
            <input
              type="text"
              placeholder="e.g. dining, groceries"
              value={form.user_category}
              onChange={e => setForm(f => ({ ...f, user_category: e.target.value }))}
              onKeyDown={handleKeyDown}
            />
          </div>
          
          <div className="add-form-row">
            <label>Notes</label>
            <input
              type="text"
              placeholder="Optional notes"
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              onKeyDown={handleKeyDown}
            />
          </div>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn-primary" onClick={handleSave} disabled={!isValid}>Add Transaction</button>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'dark';
    const stored = localStorage.getItem('expense-theme') as Theme | null;
    return stored === 'light' || stored === 'dark' ? stored : 'dark';
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; transactionId: string } | null>(null);
  const [splitModalTransaction, setSplitModalTransaction] = useState<Transaction | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [documentsModalTransaction, setDocumentsModalTransaction] = useState<Transaction | null>(null);
  const [showChartLabels, setShowChartLabels] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncProviderName, setSyncProviderName] = useState('Origin');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  const monthTabs = useMemo(() => getMonthTabs(), []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('expense-theme', theme);
  }, [theme]);

  useEffect(() => {
    api.fetchTransactions()
      .then(setTransactions)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));

    api.fetchSyncProviders()
      .then(({ providers, active }) => {
        const provider = providers.find(p => p.id === active);
        if (provider) setSyncProviderName(provider.name);
      })
      .catch(err => console.error('Failed to fetch sync providers:', err));
  }, []);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('click', close);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [contextMenu]);

  const filteredTransactions = useMemo(
    () => transactions.filter(t => getMonthFromDate(t.date) === selectedMonth),
    [transactions, selectedMonth]
  );

  const pendingTransactions = useMemo(
    () => filteredTransactions.filter(t => t.review_status === 'pending').sort((a, b) => b.date.localeCompare(a.date)),
    [filteredTransactions]
  );

  const approvedTransactions = useMemo(
    () => filteredTransactions.filter(t => t.review_status === 'approved' && !t.is_split).sort((a, b) => b.date.localeCompare(a.date)),
    [filteredTransactions]
  );

  const categoriesInMonth = useMemo(() => {
    const set = new Set<string>();
    for (const t of approvedTransactions) {
      set.add(t.user_category || 'uncategorized');
    }
    return Array.from(set).sort();
  }, [approvedTransactions]);

  const gridTransactions = useMemo(() => {
    if (!selectedCategory) return approvedTransactions;
    return approvedTransactions.filter(t => (t.user_category || 'uncategorized') === selectedCategory);
  }, [approvedTransactions, selectedCategory]);

  const includedTransactions = useMemo(() => approvedTransactions.filter(t => !t.is_excluded), [approvedTransactions]);
  const grandTotal = useMemo(() => includedTransactions.reduce((s, t) => s - t.amount, 0), [includedTransactions]);
  const spendingPower = useMemo(
    () => INCOME_THAT_HITS_ACCOUNT - FIXED_MUST_SAVINGS - grandTotal,
    [grandTotal],
  );
  const categoryTotals = useMemo(() => computeCategoryTotals(includedTransactions), [includedTransactions]);
  const pieData = useMemo(() => computePieData(includedTransactions), [includedTransactions]);

  const handleApprove = useCallback(async (id: string) => {
    try {
      const updated = await api.approveTransaction(id);
      setTransactions(prev => prev.map(t => t.id === id ? updated : t));
    } catch (err) { console.error('Failed to approve:', err); }
  }, []);

  const handleReject = useCallback(async (id: string) => {
    try {
      await api.rejectTransaction(id);
      setTransactions(prev => prev.filter(t => t.id !== id));
    } catch (err) { console.error('Failed to reject:', err); }
  }, []);

  const handleUpdate = useCallback(async (updated: Transaction) => {
    try {
      const saved = await api.updateTransaction(updated.id, updated);
      setTransactions(prev => prev.map(t => t.id === saved.id ? saved : t));
      setEditingId(null);
    } catch (err) { console.error('Failed to save:', err); }
  }, []);

  const handleDocumentsChange = useCallback((updated: Transaction) => {
    setTransactions(prev => prev.map(t => t.id === updated.id ? updated : t));
    setDocumentsModalTransaction(updated);
  }, []);

  const handleOpenDocuments = useCallback((transaction: Transaction) => {
    setDocumentsModalTransaction(transaction);
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await api.deleteTransaction(id);
      setTransactions(prev => prev.filter(t => t.id !== id));
      setEditingId(null);
    } catch (err) { console.error('Failed to delete:', err); }
  }, []);

  const handleHighlight = useCallback(async (id: string, color: HighlightColor) => {
    try {
      const transaction = transactions.find(t => t.id === id);
      if (!transaction) return;
      const saved = await api.updateTransaction(id, { ...transaction, highlight_color: color });
      setTransactions(prev => prev.map(t => t.id === id ? saved : t));
      setContextMenu(null);
    } catch (err) { console.error('Failed to set highlight:', err); }
  }, [transactions]);

  const handleToggleExclude = useCallback(async (id: string) => {
    try {
      const transaction = transactions.find(t => t.id === id);
      if (!transaction) return;
      const saved = await api.updateTransaction(id, { ...transaction, is_excluded: !transaction.is_excluded });
      setTransactions(prev => prev.map(t => t.id === id ? saved : t));
      setContextMenu(null);
    } catch (err) { console.error('Failed to toggle exclude:', err); }
  }, [transactions]);

  const handleRowContextMenu = useCallback((e: React.MouseEvent, transactionId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, transactionId });
  }, []);

  const openSplitModal = useCallback((transactionId: string) => {
    const t = transactions.find(tr => tr.id === transactionId);
    if (t) { setSplitModalTransaction(t); setContextMenu(null); }
  }, [transactions]);

  const handleSplitSave = useCallback(async (splits: { amount: number; category: string; name: string }[]) => {
    if (!splitModalTransaction) return;
    
    try {
      const miniTransactions: Partial<Transaction>[] = splits.map((split, idx) => ({
        ...splitModalTransaction,
        id: `${splitModalTransaction.id}-split-${idx + 1}-${Date.now()}`,
        amount: splitModalTransaction.amount < 0 ? -Math.abs(split.amount) : split.amount,
        user_category: split.category,
        parent_transaction_id: splitModalTransaction.id,
        title: split.name.trim() || `${splitModalTransaction.title} (${idx + 1}/${splits.length})`,
        is_split: false,
      }));

      const savedMinis: Transaction[] = [];
      for (const mini of miniTransactions) {
        const saved = await api.createTransaction(mini);
        savedMinis.push(saved);
      }

      const updatedParent = { ...splitModalTransaction, is_split: true };
      await api.updateTransaction(splitModalTransaction.id, updatedParent);

      setTransactions(prev => [
        ...prev.map(t => t.id === splitModalTransaction.id ? updatedParent : t),
        ...savedMinis,
      ]);
      setSplitModalTransaction(null);
    } catch (err) { console.error('Failed to split transaction:', err); }
  }, [splitModalTransaction]);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const result = await api.launchSync();
      setSyncMessage(result.message);
      setTimeout(() => setSyncMessage(null), 10000);
    } catch (err) {
      setSyncMessage(`Error: ${err instanceof Error ? err.message : 'Sync failed'}`);
    } finally {
      setSyncing(false);
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.fetchTransactions();
      setTransactions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleAddManual = useCallback(async (data: { title: string; vendor: string; description: string; user_category: string; amount: number; date: string; notes: string }) => {
    try {
      const newTransaction: Partial<Transaction> = {
        user_id: '',
        account_id: 'manual',
        amount: -Math.abs(data.amount),
        status: 'completed',
        category: { primary: 'expense', detailed: data.user_category || 'other', tags: null },
        user_category: data.user_category,
        date: data.date,
        ignored_on: null,
        is_recurring: false,
        type: 'withdrawal',
        is_manual: true,
        is_edited: false,
        recurrence_details: null,
        logo: null,
        parent_transaction_id: null,
        tag_ids: null,
        metadata: null,
        is_subscription: false,
        recurrence_id: null,
        review_status: 'approved',
        vendor: data.vendor,
        description: data.description,
        notes: data.notes,
        title: data.title,
      };
      const saved = await api.createTransaction(newTransaction);
      setTransactions(prev => [...prev, saved]);
      setShowAddModal(false);
    } catch (err) { console.error('Failed to add transaction:', err); }
  }, []);

  if (loading) return <div className="app-loading">loading expenses…</div>;
  if (error) return <div className="app-error">Error: {error}</div>;

  return (
    <div className="expenses-sheet">
      <header className="sheet-header">
        <h1 className="sheet-title">expenses</h1>
        <div className="header-actions">
          <button type="button" className="btn-add" onClick={() => setShowAddModal(true)} title="Add manual transaction">+ Add</button>
          <button
            type="button"
            className="btn-sync"
            onClick={handleSync}
            disabled={syncing}
            title={`Sync from ${syncProviderName}`}
          >
            {syncing ? 'Syncing...' : `Sync from ${syncProviderName}`}
          </button>
          <button type="button" className="btn-refresh" onClick={handleRefresh} title="Refresh transactions">Refresh</button>
          <button
            type="button"
            className="btn-theme"
            onClick={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))}
            title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
        {syncMessage && <div className="sync-message">{syncMessage}</div>}
      </header>

      {pendingTransactions.length > 0 && (
        <section className="review-section">
          <h2 className="section-title">
            Pending Review
            <span className="badge">{pendingTransactions.length}</span>
          </h2>
          <div className="review-tiles">
            {pendingTransactions.map(t => (
              <ReviewTile
                key={t.id}
                transaction={t}
                onApprove={() => handleApprove(t.id)}
                onReject={() => handleReject(t.id)}
                onUpdate={handleUpdate}
                onOpenDocuments={handleOpenDocuments}
              />
            ))}
          </div>
        </section>
      )}

      <div className="summary-row">
        <div className="summary-cell label">Total Approved</div>
        <div className="summary-cell value grand-total">${grandTotal.toFixed(2)}</div>
        <div className="summary-spacer" />
        <div className="summary-cell label">Approved</div>
        <div className="summary-cell value green">{approvedTransactions.length}</div>
        <div className="summary-cell label">Pending</div>
        <div className="summary-cell value" style={{ color: 'var(--accent-cyan)' }}>{pendingTransactions.length}</div>
        <div className="summary-spacer" />
        <div className="summary-cell label">Spending Power</div>
        <div className="summary-cell value" style={{ color: spendingPower >= 0 ? 'var(--accent-lime)' : '#ff6b6b' }}>
          ${spendingPower.toFixed(2)}
        </div>
      </div>

      <div className="main-content">
        <div className="table-section">
          <div className="table-section-header">
            <h2 className="section-title">Approved Transactions</h2>
            <div className="category-filter">
              <label htmlFor="category-dropdown">Category</label>
              <select
                id="category-dropdown"
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
                className="category-dropdown"
              >
                <option value="">All categories</option>
                {categoriesInMonth.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="table-wrapper">
            <table className="transactions-table">
              <thead>
                <tr>
                  <th className="col-date">Date</th>
                  <th className="col-vendor">Merchant</th>
                  <th className="col-title">Name</th>
                  <th className="col-category">Category</th>
                  <th className="col-account">Account</th>
                  <th className="col-money">Amount</th>
                  <th className="col-notes">Notes</th>
                  <th className="col-docs">Docs</th>
                  <th className="col-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {gridTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="empty-state">
                      {approvedTransactions.length === 0
                        ? 'No approved transactions for this month.'
                        : `No transactions in "${selectedCategory}".`}
                    </td>
                  </tr>
                ) : (
                  gridTransactions.map(t =>
                    editingId === t.id ? (
                      <InlineEditRow
                        key={t.id}
                        transaction={t}
                        onSave={handleUpdate}
                        onCancel={() => setEditingId(null)}
                        onDelete={() => handleDelete(t.id)}
                        onOpenDocuments={handleOpenDocuments}
                      />
                    ) : (
                      <tr
                        key={t.id}
                        onDoubleClick={() => setEditingId(t.id)}
                        onContextMenu={(e) => handleRowContextMenu(e, t.id)}
                        className={`row-clickable ${t.is_excluded ? 'row-excluded' : ''}`}
                        style={{ backgroundColor: getRowBackground(t) }}
                      >
                        <td className="col-date">{formatDate(t.date)}</td>
                        <td className="col-vendor">{t.vendor || '—'}</td>
                        <td className="col-title">{t.title}</td>
                        <td className="col-category">
                          {t.user_category ? <span className="category-badge">{t.user_category}</span> : <span className="category-empty">—</span>}
                        </td>
                        <td className="col-account">
                          <AccountBadge accountId={t.account_id} />
                        </td>
                        <td className="col-money num">{formatAmount(t.amount)}</td>
                        <td className="col-notes">{t.notes || '—'}</td>
                        <td className="col-docs">
                          <button type="button" className="btn-row-docs" onClick={() => handleOpenDocuments(t)}>
                            {getDocumentCount(t) > 0 ? `${getDocumentCount(t)} file${getDocumentCount(t) === 1 ? '' : 's'}` : 'Add'}
                          </button>
                        </td>
                        <td className="col-actions">
                          <button type="button" className="btn-row-edit" onClick={() => setEditingId(t.id)}>Edit</button>
                          <button type="button" className="btn-row-delete" onClick={() => handleDelete(t.id)}>Delete</button>
                        </td>
                      </tr>
                    )
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="sidebar">
          <div className="pie-container">
            <div className="pie-header">
              <span className="pie-title">by category</span>
              <label className="chart-toggle">
                <input type="checkbox" checked={showChartLabels} onChange={e => setShowChartLabels(e.target.checked)} />
                Show labels
              </label>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={2}
                  label={showChartLabels ? ({ name, value }) => `${name} ${value}%` : false}
                  labelLine={showChartLabels ? { stroke: 'rgba(255,255,255,0.4)', strokeWidth: 1 } : undefined}
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="rgba(0,0,0,0.2)" strokeWidth={1} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => `${value}%`}
                  contentStyle={{ background: 'var(--tooltip-bg)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text)' }}
                  labelStyle={{ color: 'var(--accent-cyan)' }}
                />
                {showChartLabels && (
                  <Legend wrapperStyle={{ fontSize: '11px' }} formatter={value => <span style={{ color: 'var(--text-muted)' }}>{value}</span>} />
                )}
              </PieChart>
            </ResponsiveContainer>
          </div>

          <table className="category-table">
            <thead>
              <tr><th>Category</th><th>Spent</th></tr>
            </thead>
            <tbody>
              {categoryTotals.map(({ category, spent }) => (
                <tr key={category}><td>{category}</td><td className="num">${spent.toFixed(2)}</td></tr>
              ))}
              <tr className="grand-total-row"><td>Grand Total</td><td className="num">${grandTotal.toFixed(2)}</td></tr>
            </tbody>
          </table>
        </aside>
      </div>

      <div className="sheet-tabs">
        {monthTabs.map(tab => (
          <button
            key={tab.value}
            type="button"
            className={`tab ${selectedMonth === tab.value ? 'active' : ''}`}
            onClick={() => setSelectedMonth(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {contextMenu && (
        <div className="context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={e => e.stopPropagation()}>
          <button type="button" className="context-menu-item" onClick={() => openSplitModal(contextMenu.transactionId)}>Split transaction</button>
          <button type="button" className="context-menu-item" onClick={() => handleToggleExclude(contextMenu.transactionId)}>
            {transactions.find(t => t.id === contextMenu.transactionId)?.is_excluded ? 'Include in totals' : 'Cross out (exclude from totals)'}
          </button>
          <div className="context-menu-divider" />
          <div className="context-menu-label">Mark as</div>
          <div className="context-menu-colours">
            {(Object.keys(HIGHLIGHT_COLORS) as NonNullable<HighlightColor>[]).map(c => (
              <button
                key={c}
                type="button"
                className="context-colour-dot"
                style={{ backgroundColor: HIGHLIGHT_COLORS[c] }}
                title={c}
                onClick={() => handleHighlight(contextMenu.transactionId, c)}
              />
            ))}
            <button type="button" className="context-colour-clear" title="Clear colour" onClick={() => handleHighlight(contextMenu.transactionId, null)}>✕</button>
          </div>
        </div>
      )}

      {splitModalTransaction && (
        <SplitModal transaction={splitModalTransaction} onSave={handleSplitSave} onClose={() => setSplitModalTransaction(null)} />
      )}

      {showAddModal && <AddTransactionModal onSave={handleAddManual} onClose={() => setShowAddModal(false)} />}

      {documentsModalTransaction && (
        <DocumentsModal
          transaction={documentsModalTransaction}
          onClose={() => setDocumentsModalTransaction(null)}
          onDocumentsChange={handleDocumentsChange}
        />
      )}
    </div>
  );
}

export default App;
