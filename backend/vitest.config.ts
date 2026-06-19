import { defineConfig } from 'vitest/config';

// Resolve imports estilo NodeNext (".js" apontando para arquivos ".ts").
// `env` fornece variáveis dummy para módulos que validam env no import.
export default defineConfig({
  resolve: {
    extensionAlias: { '.js': ['.ts', '.js'] },
  },
  test: {
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/test',
      SESSION_SECRET: 'test-secret-with-at-least-32-characters-long',
    },
  },
});
