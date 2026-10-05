CREATE TABLE `comments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`post_id` integer NOT NULL,
	`body` text NOT NULL,
	`author_name` text,
	`ip_hash` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `comments_post_id_idx` ON `comments` (`post_id`);--> statement-breakpoint
CREATE TABLE `contact_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`message` text NOT NULL,
	`ip_hash` text NOT NULL,
	`read` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `lesson_ratings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`game_slug` text NOT NULL,
	`stars` integer NOT NULL,
	`comment` text,
	`ip_hash` text NOT NULL,
	`created_at` text NOT NULL,
	CONSTRAINT "lesson_ratings_stars_check" CHECK("lesson_ratings"."stars" >= 1 AND "lesson_ratings"."stars" <= 5)
);
--> statement-breakpoint
CREATE INDEX `lesson_ratings_game_slug_idx` ON `lesson_ratings` (`game_slug`);--> statement-breakpoint
CREATE TABLE `posts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`author_name` text,
	`author_email` text,
	`status` text DEFAULT 'open' NOT NULL,
	`upvotes` integer DEFAULT 0 NOT NULL,
	`comment_count` integer DEFAULT 0 NOT NULL,
	`ip_hash` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `posts_created_at_idx` ON `posts` (`created_at`);--> statement-breakpoint
CREATE INDEX `posts_upvotes_idx` ON `posts` (`upvotes`);--> statement-breakpoint
CREATE INDEX `posts_type_idx` ON `posts` (`type`);--> statement-breakpoint
CREATE TABLE `votes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`post_id` integer NOT NULL,
	`voter_token` text NOT NULL,
	`ip_hash` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `votes_post_id_voter_token_unique` ON `votes` (`post_id`,`voter_token`);