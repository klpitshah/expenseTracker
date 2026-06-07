export type ReviewStatus = 'pending' | 'approved' | 'rejected';

export type HighlightColor = 'pink' | 'blue' | 'purple' | 'lime' | 'orange' | 'yellow' | 'red' | null;

export interface TransactionCategory {
  primary: string;
  detailed: string;
  tags: string[] | null;
}

export interface TransactionDocument {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  account_id: string;
  amount: number;
  status: string;
  category: TransactionCategory;  // Origin's category (hidden, not editable)
  user_category?: string;         // User-defined category (editable)
  highlight_color?: HighlightColor;
  date: string;
  ignored_on: string | null;
  is_recurring: boolean;
  type: string;
  is_manual: boolean;
  is_edited: boolean;
  recurrence_details: unknown | null;
  logo: string | null;
  parent_transaction_id: string | null;
  is_split?: boolean;             // True if this transaction has been split into mini-transactions
  tag_ids: string[] | null;
  metadata: unknown | null;
  is_subscription: boolean;
  recurrence_id: string | null;
  review_status: ReviewStatus;
  vendor: string;
  description: string;
  notes: string;
  title: string;
  is_excluded?: boolean;          // Excluded from totals
  documents?: TransactionDocument[];
}

export interface CategoryTotal {
  category: string;
  spent: number;
}
