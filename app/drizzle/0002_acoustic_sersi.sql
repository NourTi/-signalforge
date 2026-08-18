CREATE TABLE `telegramSettings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`chatId` varchar(255) NOT NULL,
	`encryptedBotToken` text NOT NULL,
	`enabled` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `telegramSettings_id` PRIMARY KEY(`id`),
	CONSTRAINT `telegramSettings_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
ALTER TABLE `leadActivities` MODIFY COLUMN `activityType` enum('lead_created','lead_updated','status_changed','note_added','draft_generated','draft_updated','draft_approved','draft_rejected','email_sent','email_failed','reply_logged','discovery_saved','telegram_alerted') NOT NULL;--> statement-breakpoint
ALTER TABLE `leads` ADD `discoverySource` varchar(64);--> statement-breakpoint
ALTER TABLE `leads` ADD `sourceUrl` varchar(2048);--> statement-breakpoint
ALTER TABLE `leads` ADD `sourcePlaceId` varchar(255);--> statement-breakpoint
ALTER TABLE `leads` ADD `emailSourceUrl` varchar(2048);--> statement-breakpoint
ALTER TABLE `leads` ADD `emailConfidence` varchar(32);