-- PLB-04: Geteilte Tabellen verweisen nicht auf private (app_user); die Person steht als Text.
ALTER TABLE "relationship_member" DROP CONSTRAINT "relationship_member_user_id_app_user_id_fk";
