-- Backfill workflow_id for existing records using a stored procedure
-- Group approvals by quote_id and created_at timestamp
-- Records created at the same time (within same second) belong to same workflow

DELIMITER $$

CREATE PROCEDURE backfill_workflow_ids()
BEGIN
  DECLARE done INT DEFAULT FALSE;
  DECLARE v_quote_id VARCHAR(36);
  DECLARE v_created_at_group VARCHAR(20);
  DECLARE v_workflow_id VARCHAR(36);

  DECLARE cur CURSOR FOR
    SELECT DISTINCT
      quote_id,
      DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') as created_at_group
    FROM quote_approval
    WHERE workflow_id IS NULL
    ORDER BY quote_id, created_at;

  DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;

  OPEN cur;

  read_loop: LOOP
    FETCH cur INTO v_quote_id, v_created_at_group;
    IF done THEN
      LEAVE read_loop;
    END IF;

    -- Generate a new workflow_id for this group
    SET v_workflow_id = UUID();

    -- Update all approvals in this group
    UPDATE quote_approval
    SET workflow_id = v_workflow_id
    WHERE quote_id = v_quote_id
      AND DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') = v_created_at_group
      AND workflow_id IS NULL;
  END LOOP;

  CLOSE cur;
END$$

DELIMITER ;

-- Execute the backfill procedure
CALL backfill_workflow_ids();

-- Drop the procedure (cleanup)
DROP PROCEDURE IF EXISTS backfill_workflow_ids;

-- Make workflow_id NOT NULL (now that all records are filled)
ALTER TABLE `quote_approval`
  MODIFY COLUMN `workflow_id` VARCHAR(36) NOT NULL;

-- Add indexes
ALTER TABLE `quote_approval`
  ADD INDEX `idx_quote_workflow` (`quote_id`, `workflow_id`),
  ADD INDEX `idx_workflow_id` (`workflow_id`);
