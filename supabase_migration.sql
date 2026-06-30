-- Supabase Migration Script
-- Description: Creates the 'hardware_tickets' table with columns: 'id' (UUID), 'ticket_id' (foreign key),
--              'issue_status' (TEXT), 'resolution_method' (TEXT), and 'replacement_source' (TEXT)
--              with strong check constraints enforcing correct and valid state transitions.

BEGIN;

-- 1. Ensure uuid-ossp extension is enabled for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create the hardware_tickets table if it doesn't exist
CREATE TABLE IF NOT EXISTS hardware_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id text NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  issue_status text DEFAULT NULL,
  resolution_method text DEFAULT NULL,
  replacement_source text DEFAULT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Add CHECK constraints for permissible values
ALTER TABLE hardware_tickets 
  DROP CONSTRAINT IF EXISTS chk_hw_issue_status,
  DROP CONSTRAINT IF EXISTS chk_hw_resolution_method,
  DROP CONSTRAINT IF EXISTS chk_hw_replacement_source,
  DROP CONSTRAINT IF EXISTS chk_hw_resolution_conditional,
  DROP CONSTRAINT IF EXISTS chk_hw_replacement_conditional;

ALTER TABLE hardware_tickets
  ADD CONSTRAINT chk_hw_issue_status 
    CHECK (issue_status IS NULL OR issue_status IN ('Resolved', 'Under Repair')),
    
  ADD CONSTRAINT chk_hw_resolution_method 
    CHECK (resolution_method IS NULL OR resolution_method IN ('Repaired/Maintained', 'Replacement')),
    
  ADD CONSTRAINT chk_hw_replacement_source 
    CHECK (replacement_source IS NULL OR replacement_source IN ('New Spare', 'From This Kit'));

-- 4. Add Conditional CHECK constraints to guarantee database integrity
-- Ensures resolution method can ONLY be set when status is 'Resolved'
ALTER TABLE hardware_tickets
  ADD CONSTRAINT chk_hw_resolution_conditional 
    CHECK (
      (issue_status = 'Resolved' AND resolution_method IS NOT NULL) OR 
      (issue_status IS NULL OR issue_status != 'Resolved' AND resolution_method IS NULL)
    );

-- Ensures replacement source can ONLY be set when resolution method is 'Replacement'
ALTER TABLE hardware_tickets
  ADD CONSTRAINT chk_hw_replacement_conditional 
    CHECK (
      (resolution_method = 'Replacement' AND replacement_source IS NOT NULL) OR 
      (resolution_method IS NULL OR resolution_method != 'Replacement' AND replacement_source IS NULL)
    );

-- 5. Create Performance Indexes for rapid searching & filtering
CREATE INDEX IF NOT EXISTS idx_hardware_tickets_ticket_id ON hardware_tickets(ticket_id);
CREATE INDEX IF NOT EXISTS idx_hardware_tickets_issue_status ON hardware_tickets(issue_status);

-- 6. Add informative database comments for documentation
COMMENT ON TABLE hardware_tickets IS 'Stores hardware issue ticket updates and resolutions';
COMMENT ON COLUMN hardware_tickets.id IS 'Primary key UUID for the hardware ticket record';
COMMENT ON COLUMN hardware_tickets.ticket_id IS 'Foreign key referencing the parent ticket in the tickets table';
COMMENT ON COLUMN hardware_tickets.issue_status IS 'Tracks the current status of the hardware ticket (Resolved or Under Repair)';
COMMENT ON COLUMN hardware_tickets.resolution_method IS 'Required if issue_status is Resolved. Can be Repaired/Maintained or Replacement';
COMMENT ON COLUMN hardware_tickets.replacement_source IS 'Required if resolution_method is Replacement. Can be New Spare or From This Kit';

COMMIT;
