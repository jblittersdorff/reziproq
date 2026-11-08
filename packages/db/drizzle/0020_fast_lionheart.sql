ALTER TABLE "outbox_event" DROP CONSTRAINT "outbox_event_email_payload";--> statement-breakpoint
ALTER TABLE "outbox_event" ADD CONSTRAINT "outbox_event_email_payload" CHECK ((
        ("outbox_event"."email_template" IS NULL AND "outbox_event"."email_locale" IS NULL
          AND "outbox_event"."email_recipient" IS NULL AND "outbox_event"."email_first_name" IS NULL
          AND "outbox_event"."email_title" IS NULL AND "outbox_event"."email_deadline" IS NULL
          AND "outbox_event"."email_link" IS NULL)
        OR
        ("outbox_event"."email_template" IS NOT NULL
          AND "outbox_event"."email_template" IN ('invitation', 'reminder', 'approval', 'escalation')
          AND "outbox_event"."email_locale" IS NOT NULL
          AND "outbox_event"."email_locale" IN ('de', 'en')
          AND "outbox_event"."email_recipient" IS NOT NULL
          AND length(trim("outbox_event"."email_recipient")) > 0
          AND "outbox_event"."email_title" IS NOT NULL
          AND length(trim("outbox_event"."email_title")) > 0
          AND "outbox_event"."email_link" IS NOT NULL
          AND "outbox_event"."email_link" LIKE '/%'
          AND "outbox_event"."email_link" NOT LIKE '//%'
          AND position('?' in "outbox_event"."email_link") = 0
          AND position('#' in "outbox_event"."email_link") = 0
          AND position(chr(92) in "outbox_event"."email_link") = 0)
      ));