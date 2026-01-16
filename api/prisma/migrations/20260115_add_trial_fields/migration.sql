-- Add trial fields to subscription_plan table
ALTER TABLE `subscription_plan`
ADD COLUMN `offers_trial` BOOLEAN NOT NULL DEFAULT FALSE AFTER `max_storage_gb`,
ADD COLUMN `trial_days` INT NULL AFTER `offers_trial`,
ADD INDEX `subscription_plan_offers_trial_idx` (`offers_trial`);
