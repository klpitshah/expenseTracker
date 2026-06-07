import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import * as sync from './sync/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');
const DATA_FILE = join(DATA_DIR, 'transactions.json');
const DOCUMENTS_DIR = join(DATA_DIR, 'documents');
const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024;

const app = express();
app.use(cors());
app.use(express.json());

// Ensure data directory and file exist
function ensureDataFile() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!existsSync(DATA_FILE)) {
    writeFileSync(DATA_FILE, JSON.stringify({ transactions: [] }, null, 2));
  }
}

// Read all transactions
function readTransactions() {
  ensureDataFile();
  const data = JSON.parse(readFileSync(DATA_FILE, 'utf-8'));
  return data.transactions || [];
}

// Write all transactions
function writeTransactions(transactions) {
  ensureDataFile();
  writeFileSync(DATA_FILE, JSON.stringify({ transactions }, null, 2));
}

function ensureDocumentsDir() {
  if (!existsSync(DOCUMENTS_DIR)) {
    mkdirSync(DOCUMENTS_DIR, { recursive: true });
  }
}

function getTransactionDocumentsDir(transactionId) {
  ensureDocumentsDir();
  const dir = join(DOCUMENTS_DIR, transactionId);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function deleteTransactionDocuments(transactionId) {
  const dir = join(DOCUMENTS_DIR, transactionId);
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
}

function findTransactionIndex(transactions, id) {
  return transactions.findIndex(t => t.id === id);
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      cb(null, getTransactionDocumentsDir(req.params.id));
    },
    filename: (_req, file, cb) => {
      const docId = crypto.randomUUID().replace(/-/g, '').slice(0, 24);
      const ext = extname(file.originalname || '');
      cb(null, `${docId}${ext}`);
    },
  }),
  limits: { fileSize: MAX_DOCUMENT_SIZE },
});

// GET /api/transactions - get all transactions
app.get('/api/transactions', (req, res) => {
  try {
    const transactions = readTransactions();
    res.json({ transactions });
  } catch (error) {
    console.error('Error reading transactions:', error);
    res.status(500).json({ error: 'Failed to read transactions' });
  }
});

// GET /api/transactions/:id - get single transaction
app.get('/api/transactions/:id', (req, res) => {
  try {
    const transactions = readTransactions();
    const transaction = transactions.find(t => t.id === req.params.id);
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    res.json({ transaction });
  } catch (error) {
    console.error('Error reading transaction:', error);
    res.status(500).json({ error: 'Failed to read transaction' });
  }
});

// POST /api/transactions - create new transaction
app.post('/api/transactions', (req, res) => {
  try {
    const transactions = readTransactions();
    const newTransaction = {
      ...req.body,
      id: req.body.id || crypto.randomUUID().replace(/-/g, '').slice(0, 24),
      review_status: req.body.review_status || 'pending',
    };
    transactions.push(newTransaction);
    writeTransactions(transactions);
    res.status(201).json({ transaction: newTransaction });
  } catch (error) {
    console.error('Error creating transaction:', error);
    res.status(500).json({ error: 'Failed to create transaction' });
  }
});

// POST /api/transactions/bulk - create multiple transactions
app.post('/api/transactions/bulk', (req, res) => {
  try {
    const { transactions: newTransactions } = req.body;
    if (!Array.isArray(newTransactions)) {
      return res.status(400).json({ error: 'transactions must be an array' });
    }
    const existingTransactions = readTransactions();
    const added = newTransactions.map(t => ({
      ...t,
      id: t.id || crypto.randomUUID().replace(/-/g, '').slice(0, 24),
      review_status: t.review_status || 'pending',
    }));
    existingTransactions.push(...added);
    writeTransactions(existingTransactions);
    res.status(201).json({ transactions: added, count: added.length });
  } catch (error) {
    console.error('Error bulk creating transactions:', error);
    res.status(500).json({ error: 'Failed to bulk create transactions' });
  }
});

// PUT /api/transactions/:id - update transaction
app.put('/api/transactions/:id', (req, res) => {
  try {
    const transactions = readTransactions();
    const index = transactions.findIndex(t => t.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    transactions[index] = { ...transactions[index], ...req.body, id: req.params.id };
    writeTransactions(transactions);
    res.json({ transaction: transactions[index] });
  } catch (error) {
    console.error('Error updating transaction:', error);
    res.status(500).json({ error: 'Failed to update transaction' });
  }
});

// PATCH /api/transactions/:id/approve - approve transaction
app.patch('/api/transactions/:id/approve', (req, res) => {
  try {
    const transactions = readTransactions();
    const index = transactions.findIndex(t => t.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    transactions[index].review_status = 'approved';
    writeTransactions(transactions);
    res.json({ transaction: transactions[index] });
  } catch (error) {
    console.error('Error approving transaction:', error);
    res.status(500).json({ error: 'Failed to approve transaction' });
  }
});

// PATCH /api/transactions/:id/reject - reject (delete) transaction
app.patch('/api/transactions/:id/reject', (req, res) => {
  try {
    const transactions = readTransactions();
    const index = transactions.findIndex(t => t.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    transactions[index].review_status = 'rejected';
    writeTransactions(transactions);
    res.json({ transaction: transactions[index] });
  } catch (error) {
    console.error('Error rejecting transaction:', error);
    res.status(500).json({ error: 'Failed to reject transaction' });
  }
});

// DELETE /api/transactions/:id - delete transaction
app.delete('/api/transactions/:id', (req, res) => {
  try {
    const transactions = readTransactions();
    const index = findTransactionIndex(transactions, req.params.id);
    if (index === -1) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    const deleted = transactions.splice(index, 1)[0];
    deleteTransactionDocuments(req.params.id);
    writeTransactions(transactions);
    res.json({ transaction: deleted });
  } catch (error) {
    console.error('Error deleting transaction:', error);
    res.status(500).json({ error: 'Failed to delete transaction' });
  }
});

// POST /api/transactions/:id/documents - upload a document
app.post('/api/transactions/:id/documents', (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File too large (max 10 MB)' });
      }
      console.error('Error uploading document:', err);
      return res.status(500).json({ error: 'Failed to upload document' });
    }

    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const transactions = readTransactions();
      const index = findTransactionIndex(transactions, req.params.id);
      if (index === -1) {
        return res.status(404).json({ error: 'Transaction not found' });
      }

      const docId = req.file.filename.replace(extname(req.file.filename), '');
      const document = {
        id: docId,
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        uploadedAt: new Date().toISOString(),
      };

      const existingDocuments = transactions[index].documents || [];
      transactions[index] = {
        ...transactions[index],
        documents: [...existingDocuments, document],
      };
      writeTransactions(transactions);

      res.status(201).json({ document, transaction: transactions[index] });
    } catch (error) {
      console.error('Error saving document metadata:', error);
      res.status(500).json({ error: 'Failed to upload document' });
    }
  });
});

// GET /api/transactions/:id/documents/:docId - download or view a document
app.get('/api/transactions/:id/documents/:docId', (req, res) => {
  try {
    const transactions = readTransactions();
    const transaction = transactions.find(t => t.id === req.params.id);
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const document = (transaction.documents || []).find(d => d.id === req.params.docId);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const filePath = join(getTransactionDocumentsDir(req.params.id), document.filename);
    if (!existsSync(filePath)) {
      return res.status(404).json({ error: 'Document file not found' });
    }

    res.setHeader('Content-Type', document.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(document.originalName)}"`);
    res.sendFile(filePath);
  } catch (error) {
    console.error('Error serving document:', error);
    res.status(500).json({ error: 'Failed to serve document' });
  }
});

// DELETE /api/transactions/:id/documents/:docId - delete a document
app.delete('/api/transactions/:id/documents/:docId', (req, res) => {
  try {
    const transactions = readTransactions();
    const index = findTransactionIndex(transactions, req.params.id);
    if (index === -1) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const documents = transactions[index].documents || [];
    const document = documents.find(d => d.id === req.params.docId);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const filePath = join(getTransactionDocumentsDir(req.params.id), document.filename);
    if (existsSync(filePath)) {
      rmSync(filePath, { force: true });
    }

    transactions[index] = {
      ...transactions[index],
      documents: documents.filter(d => d.id !== req.params.docId),
    };
    writeTransactions(transactions);

    res.json({ transaction: transactions[index] });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

// GET /api/sync/providers - list available sync providers
app.get('/api/sync/providers', (_req, res) => {
  try {
    res.json({
      providers: sync.listProviders(),
      active: sync.getActiveProviderId(),
    });
  } catch (error) {
    console.error('Error listing sync providers:', error);
    res.status(500).json({ error: error.message || 'Failed to list sync providers' });
  }
});

// POST /api/sync - launch sync via active or requested provider
app.post('/api/sync', async (req, res) => {
  try {
    const result = await sync.launchSync(req.body?.provider);
    res.json(result);
  } catch (error) {
    console.error('Error launching sync:', error);
    res.status(500).json({ error: error.message || 'Failed to launch sync' });
  }
});

// POST /api/sync/origin-browser - legacy endpoint, kept for backwards compatibility
app.post('/api/sync/origin-browser', async (_req, res) => {
  try {
    const result = await sync.launchSync('origin');
    res.json(result);
  } catch (error) {
    console.error('Error launching Origin sync:', error);
    res.status(500).json({ error: error.message || 'Failed to launch sync' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
