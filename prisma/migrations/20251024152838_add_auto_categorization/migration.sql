-- Add auto-categorization fields to transactions table
ALTER TABLE transactions 
ADD COLUMN predicted_coa_code VARCHAR(20),
ADD COLUMN prediction_confidence DECIMAL(3,2),
ADD COLUMN review_status VARCHAR(20) DEFAULT 'pending_review',
ADD COLUMN manually_overridden BOOLEAN DEFAULT false,
ADD COLUMN overridden_at TIMESTAMP,
ADD COLUMN overridden_by VARCHAR(255);

-- Add index for faster review queue queries
CREATE INDEX idx_transactions_review_status ON transactions(review_status);
CREATE INDEX idx_transactions_predicted_coa ON transactions(predicted_coa_code);

-- Add comments
COMMENT ON COLUMN transactions.predicted_coa_code IS 'Auto-predicted COA code before user review';
COMMENT ON COLUMN transactions.prediction_confidence IS 'Confidence score 0.00-1.00 from ML/merchant mapping';
COMMENT ON COLUMN transactions.review_status IS 'pending_review | approved | rejected | auto_committed';
COMMENT ON COLUMN transactions.manually_overridden IS 'TRUE if user changed the predicted category';
