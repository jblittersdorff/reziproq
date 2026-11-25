ALTER TABLE "ai_draft" DROP CONSTRAINT "ai_draft_kind";--> statement-breakpoint
ALTER TABLE "ai_draft" ADD CONSTRAINT "ai_draft_kind" CHECK ("ai_draft"."kind" in ('deviation_explanation', 'feedback_themes', 'plan_summary', 'pre_read', 'market_analysis', 'data_request', 'qbr_topics', 'qbr_risks', 'qbr_open_points', 'hint_explanation', 'brief_situation', 'brief_goals', 'brief_agenda', 'brief_internal_questions', 'brief_supplier_questions', 'brief_expected_questions', 'brief_risks', 'brief_open_points', 'capture_commitment', 'capture_action', 'capture_decision', 'capture_question', 'capture_commitment_change', 'capture_goal_check', 'mail_summary', 'agent_result', 'share_request', 'binding_request'));--> statement-breakpoint
-- MA-01 Leitplanken, G-5 (K1-f.2): Ein bindendes Werkzeug läuft nur mit dem Bestätigungs-Token eines
-- Menschen. Die Funktion verbraucht ein Token genau einmal und nur, wenn es der Person der Session
-- gehört, für genau dieses Werkzeug (purpose) und dieses Objekt gilt und nicht abgelaufen ist (Uhr
-- je Mandant). Eigentümer ist reziproq_token wie bei app_guard_shared; die App darf das Token nicht
-- selbst umschreiben (Migration 0130).
CREATE FUNCTION app_use_confirm_token(p_token uuid, p_purpose text, p_object_type text, p_object_id uuid)
  RETURNS boolean
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
DECLARE
  used integer := 0;
BEGIN
  IF p_token IS NULL THEN
    RETURN false;
  END IF;
  UPDATE confirm_token SET used_at = app_now()
  WHERE id = p_token
    AND org_id::text = current_setting('app.org_id', true)
    AND user_id = current_setting('app.user_id', true)
    AND purpose = p_purpose
    AND object_type = p_object_type
    AND object_id = p_object_id
    AND used_at IS NULL
    AND expires_at > app_now();
  GET DIAGNOSTICS used = ROW_COUNT;
  RETURN used = 1;
END
$$;--> statement-breakpoint
ALTER FUNCTION app_use_confirm_token(uuid, text, text, uuid) OWNER TO reziproq_token;--> statement-breakpoint
REVOKE ALL ON FUNCTION app_use_confirm_token(uuid, text, text, uuid) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_use_confirm_token(uuid, text, text, uuid) TO reziproq_app;
