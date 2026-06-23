-- Implantação passará a registrar a reunião no HubSpot (em vez do Google Meet).
-- Guardamos o id da meeting do HubSpot para, ao finalizar, atualizar as
-- observações na própria meeting.
ALTER TABLE implantations ADD COLUMN hubspot_meeting_id text;
