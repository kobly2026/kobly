-- 0015_automation_cron.sql
-- Kobly — autonomia do motor: pg_cron dispara o worker process-steps a cada minuto,
-- que consome a fila scheduled_steps (run_at <= now()) e executa as etapas (enviar e-mail
-- via Resend, aplicar tags). Sem isto, o worker precisaria de trigger manual.
-- pg_net faz a chamada HTTP da edge function a partir do banco.
-- ---------------------------------------------------------------------------
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Agenda (idempotente por nome): a cada minuto, POST na edge function process-steps.
-- process-steps é verify_jwt=false; mandamos a anon key só pra rotear no gateway.
select cron.schedule(
  'kobly-process-steps',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://hvkuymprmfrjrgpqaxbw.supabase.co/functions/v1/process-steps',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2a3V5bXBybWZyanJncHFheGJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0NDg0MjgsImV4cCI6MjA5ODAyNDQyOH0.4JR1XTwfXv0x8QAgLd9y6K6nHJem0v_qi0QGUvxs1J4'
    ),
    body := '{}'::jsonb
  );
  $$
);
