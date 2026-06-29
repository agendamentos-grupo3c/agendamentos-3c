-- Link da reunião adicionado MANUALMENTE pelo implantador no pós-reunião (sala
-- real/gravação), distinto do meeting_url (Meet do kickoff, gerado no
-- agendamento). Ao ser salvo, é anexado à reunião do HubSpot e enviado por
-- e-mail (via n8n) apenas a quem compareceu. meeting_link_notified_at marca o
-- envio para tornar o disparo idempotente (reprocessa só o que falhou).
ALTER TABLE implantations ADD COLUMN meeting_link text;
ALTER TABLE implantations ADD COLUMN meeting_link_notified_at timestamptz;
