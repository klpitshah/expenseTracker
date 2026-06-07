import type { Transaction, TransactionDocument } from './types';

const API_BASE = 'http://localhost:3001/api';

// ============== TRANSACTIONS ==============

export async function fetchTransactions(): Promise<Transaction[]> {
  const res = await fetch(`${API_BASE}/transactions`);
  if (!res.ok) throw new Error('Failed to fetch transactions');
  const data = await res.json();
  return data.transactions;
}

export async function createTransaction(transaction: Partial<Transaction>): Promise<Transaction> {
  const res = await fetch(`${API_BASE}/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(transaction),
  });
  if (!res.ok) throw new Error('Failed to create transaction');
  const data = await res.json();
  return data.transaction;
}

export async function updateTransaction(id: string, updates: Partial<Transaction>): Promise<Transaction> {
  const res = await fetch(`${API_BASE}/transactions/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error('Failed to update transaction');
  const data = await res.json();
  return data.transaction;
}

export async function approveTransaction(id: string): Promise<Transaction> {
  const res = await fetch(`${API_BASE}/transactions/${id}/approve`, { method: 'PATCH' });
  if (!res.ok) throw new Error('Failed to approve transaction');
  const data = await res.json();
  return data.transaction;
}

export async function rejectTransaction(id: string): Promise<Transaction> {
  const res = await fetch(`${API_BASE}/transactions/${id}/reject`, { method: 'PATCH' });
  if (!res.ok) throw new Error('Failed to reject transaction');
  const data = await res.json();
  return data.transaction;
}

export async function deleteTransaction(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/transactions/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete transaction');
}

// ============== DOCUMENTS ==============

export function getDocumentUrl(transactionId: string, documentId: string): string {
  return `${API_BASE}/transactions/${transactionId}/documents/${documentId}`;
}

export async function uploadDocument(transactionId: string, file: File): Promise<Transaction> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE}/transactions/${transactionId}/documents`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw new Error('Failed to upload document');
  const data = await res.json();
  return data.transaction;
}

export async function deleteDocument(transactionId: string, documentId: string): Promise<Transaction> {
  const res = await fetch(`${API_BASE}/transactions/${transactionId}/documents/${documentId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete document');
  const data = await res.json();
  return data.transaction;
}

export function formatDocumentSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isPreviewableDocument(doc: TransactionDocument): boolean {
  return doc.mimeType.startsWith('image/') || doc.mimeType === 'application/pdf';
}

// ============== SYNC PROVIDERS ==============

export interface SyncProviderInfo {
  id: string;
  name: string;
  description: string;
}

export interface SyncResult {
  success: boolean;
  message: string;
  pid?: number;
  provider?: string;
}

export async function fetchSyncProviders(): Promise<{ providers: SyncProviderInfo[]; active: string }> {
  const res = await fetch(`${API_BASE}/sync/providers`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch sync providers');
  return data;
}

export async function launchSync(provider?: string): Promise<SyncResult> {
  const res = await fetch(`${API_BASE}/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(provider ? { provider } : {}),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to launch sync');
  return data;
}
