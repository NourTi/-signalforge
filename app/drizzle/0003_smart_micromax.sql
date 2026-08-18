CREATE TABLE `outreachPolicies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`dailyLimit` int NOT NULL DEFAULT 15,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `outreachPolicies_id` PRIMARY KEY(`id`),
	CONSTRAINT `outreachPolicies_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `senderProfiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`legalBusinessName` varchar(255) NOT NULL,
	`postalAddress` text NOT NULL,
	`replyToEmail` varchar(320) NOT NULL,
	`optOutText` varchar(500) NOT NULL,
	`dkimSelector` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `senderProfiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `senderProfiles_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `suppressedRecipients` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`email` varchar(320) NOT NULL,
	`reason` varchar(500) NOT NULL,
	`source` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `suppressedRecipients_id` PRIMARY KEY(`id`),
	CONSTRAINT `suppressedRecipients_userEmail_unique` UNIQUE(`userId`,`email`)
);
--> statement-breakpoint
ALTER TABLE `leadActivities` MODIFY COLUMN `activityType` enum('lead_created','lead_updated','status_changed','note_added','draft_generated','draft_updated','draft_approved','draft_rejected','email_sent','email_failed','reply_logged','discovery_saved','telegram_alerted','recipient_suppressed','recipient_unsuppressed','send_blocked','opt_out_received') NOT NULL;