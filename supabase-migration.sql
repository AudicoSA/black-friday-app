-- =====================================================
-- Supabase Migration for "Name Your Need" Black Friday Feature
-- Run this SQL in your Supabase SQL Editor
-- =====================================================

-- Create the dynamic_deals table
CREATE TABLE IF NOT EXISTS public.dynamic_deals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    token UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
    product_id UUID NOT NULL REFERENCES public.products(id),
    customer_email TEXT,
    customer_phone TEXT,
    quantity INTEGER DEFAULT 1 NOT NULL,
    cost_price NUMERIC(10,2) NOT NULL,
    markup_percentage NUMERIC(5,2) DEFAULT 15.00 NOT NULL,
    offer_price NUMERIC(10,2) NOT NULL,
    expiry TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'accepted', 'paid', 'expired', 'cancelled')),
    order_id TEXT,
    pf_payment_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_dynamic_deals_token ON public.dynamic_deals(token);
CREATE INDEX IF NOT EXISTS idx_dynamic_deals_status ON public.dynamic_deals(status);
CREATE INDEX IF NOT EXISTS idx_dynamic_deals_expiry ON public.dynamic_deals(expiry);
CREATE INDEX IF NOT EXISTS idx_dynamic_deals_product_id ON public.dynamic_deals(product_id);

-- Enable Row Level Security
ALTER TABLE public.dynamic_deals ENABLE ROW LEVEL SECURITY;

-- Create policy to allow inserts from service role
CREATE POLICY "Service role can do everything" ON public.dynamic_deals
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_dynamic_deals_updated_at
    BEFORE UPDATE ON public.dynamic_deals
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- Ensure products table has cost_price column
-- (You may already have this - check your schema)
-- =====================================================

-- Add cost_price column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'products'
        AND column_name = 'cost_price'
    ) THEN
        ALTER TABLE public.products ADD COLUMN cost_price NUMERIC(10,2);
    END IF;
END $$;

-- =====================================================
-- Cron job to expire old deals (optional - requires pg_cron extension)
-- If you have pg_cron enabled, uncomment this:
-- =====================================================

-- SELECT cron.schedule(
--     'expire-old-deals',
--     '*/5 * * * *',  -- Every 5 minutes
--     $$
--     UPDATE public.dynamic_deals
--     SET status = 'expired'
--     WHERE status = 'pending'
--     AND expiry < NOW()
--     $$
-- );

-- =====================================================
-- Grant permissions (adjust based on your setup)
-- =====================================================

GRANT ALL ON public.dynamic_deals TO authenticated;
GRANT ALL ON public.dynamic_deals TO service_role;

-- Show confirmation
SELECT 'Migration complete! dynamic_deals table created.' as status;
