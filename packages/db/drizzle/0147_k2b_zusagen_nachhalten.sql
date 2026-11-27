-- K2-b.6 (ZQ-01 Regel 5, E-K1-5): Erinnerung von Reziproq an Zusagen des Lieferanten im Auftrag
-- des Kunden: Art followup in reminder_sent und die Mailvorlage commitment_followup.
ALTER TABLE "outbox_event" DROP CONSTRAINT "outbox_event_email_payload";--> statement-breakpoint
ALTER TABLE "reminder_sent" DROP CONSTRAINT "reminder_sent_kind";--> statement-breakpoint
ALTER TABLE "outbox_event" ADD CONSTRAINT "outbox_event_email_payload" CHECK ((
        ("outbox_event"."email_template" IS NULL AND "outbox_event"."email_locale" IS NULL
          AND "outbox_event"."email_recipient" IS NULL AND "outbox_event"."email_first_name" IS NULL
          AND "outbox_event"."email_title" IS NULL AND "outbox_event"."email_deadline" IS NULL
          AND "outbox_event"."email_link" IS NULL AND "outbox_event"."email_sender" IS NULL
          AND "outbox_event"."email_message" IS NULL)
        OR
        ("outbox_event"."email_template" IS NOT NULL
          AND "outbox_event"."email_template" IN (
            'invitation', 'reminder', 'approval', 'escalation', 'supplier_invitation', 'survey',
            'mention', 'export_ready', 'notification', 'digest', 'commitment_followup'
          )
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
      ));--> statement-breakpoint
ALTER TABLE "reminder_sent" ADD CONSTRAINT "reminder_sent_kind" CHECK ("reminder_sent"."kind" in ('reminder', 'escalation', 'followup'));