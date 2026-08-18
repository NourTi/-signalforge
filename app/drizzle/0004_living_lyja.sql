CREATE TABLE `inboundMessages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`threadId` int NOT NULL,
	`leadId` int,
	`providerMessageId` varchar(512) NOT NULL,
	`rawHash` varchar(64) NOT NULL,
	`fromEmail` varchar(320) NOT NULL,
	`toEmail` varchar(320) NOT NULL,
	`subject` varchar(500),
	`body` text,
	`inboundMessageKind` enum('reply','opt_out','bounce','out_of_office','unknown') NOT NULL DEFAULT 'unknown',
	`quarantined` boolean NOT NULL DEFAULT false,
	`receivedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `inboundMessages_id` PRIMARY KEY(`id`),
	CONSTRAINT `inboundMessages_userProviderMessage_unique` UNIQUE(`userId`,`providerMessageId`),
	CONSTRAINT `inboundMessages_userRawHash_unique` UNIQUE(`userId`,`rawHash`)
);
--> statement-breakpoint
CREATE TABLE `replyHubSettings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`inboundAddress` varchar(320) NOT NULL,
	`encryptedSigningSecret` text NOT NULL,
	`enabled` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `replyHubSettings_id` PRIMARY KEY(`id`),
	CONSTRAINT `replyHubSettings_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `replyThreads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`leadId` int,
	`participantEmail` varchar(320) NOT NULL,
	`latestSubject` varchar(500),
	`inboundMessageKind` enum('reply','opt_out','bounce','out_of_office','unknown') NOT NULL DEFAULT 'unknown',
	`lastReceivedAt` timestamp NOT NULL DEFAULT (now()),
	`responseDraft` text,
	`responseDraftUpdatedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `replyThreads_id` PRIMARY KEY(`id`),
	CONSTRAINT `replyThreads_userParticipant_unique` UNIQUE(`userId`,`participantEmail`)
);
--> statement-breakpoint
ALTER TABLE `leadActivities` MODIFY COLUMN `activityType` enum('lead_created','lead_updated','status_changed','note_added','draft_generated','draft_updated','draft_approved','draft_rejected','email_sent','email_failed','reply_logged','discovery_saved','telegram_alerted','recipient_suppressed','recipient_unsuppressed','send_blocked','opt_out_received','inbound_bounce_received','inbound_out_of_office_received') NOT NULL;