-- Create lightning invoices table
CREATE TABLE IF NOT EXISTS lightning_invoices (
  id TEXT PRIMARY KEY,
  amount DECIMAL(10, 2) NOT NULL CHECK (amount >= 20 AND amount <= 100),
  description TEXT,
  payment_request TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'expired', 'cancelled')),
  customer_email TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create payments table
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id TEXT REFERENCES lightning_invoices(id),
  amount DECIMAL(10, 2) NOT NULL,
  fee DECIMAL(10, 2),
  payment_hash TEXT,
  preimage TEXT,
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Create indexes
CREATE INDEX idx_invoices_status ON lightning_invoices(status);
CREATE INDEX idx_invoices_created ON lightning_invoices(created_at);
CREATE INDEX idx_payments_invoice ON payments(invoice_id);
CREATE INDEX idx_payments_status ON payments(status);

-- RLS policies
ALTER TABLE lightning_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Allow anonymous users to create invoices
CREATE POLICY "Anyone can create invoices" ON lightning_invoices
  FOR INSERT TO anon
  WITH CHECK (true);

-- Allow reading own invoices by ID
CREATE POLICY "Can read own invoices" ON lightning_invoices
  FOR SELECT TO anon
  USING (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for updated_at
CREATE TRIGGER update_lightning_invoices_updated_at
  BEFORE UPDATE ON lightning_invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();