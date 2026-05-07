ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS beneficiary_account_id uuid,
ADD COLUMN IF NOT EXISTS beneficiary_account_name text,
ADD COLUMN IF NOT EXISTS beneficiary_account_number text,
ADD COLUMN IF NOT EXISTS beneficiary_ifsc_code text,
ADD COLUMN IF NOT EXISTS beneficiary_bank_name text,
ADD COLUMN IF NOT EXISTS request_payload jsonb,
ADD COLUMN IF NOT EXISTS provider_payload jsonb,
ADD COLUMN IF NOT EXISTS response_payload jsonb,
ADD COLUMN IF NOT EXISTS provider_status text,
ADD COLUMN IF NOT EXISTS callback_payload jsonb;
