-- Reuse existing SystemSettings.defaultFuelPrice as the "base fuel price"
-- instead of duplicating the same concept in a new column.
ALTER TABLE "SystemSettings" DROP COLUMN "baseFuelPrice";
