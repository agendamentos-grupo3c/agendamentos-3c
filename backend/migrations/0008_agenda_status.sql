-- Pausa de agenda por pessoa (integrador/implantador). Enquanto inativa, a
-- agenda dessa pessoa não é oferecida para agendamento. O histórico de
-- pausar/reativar fica no audit_log (ações agenda.paused / agenda.resumed).
CREATE TABLE agenda_status (
  subject     text PRIMARY KEY,            -- alana | guilherme | gabrielle | bryan | wagner
  active      boolean NOT NULL DEFAULT true,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  text
);
