import { neonConfig } from '@neondatabase/serverless';

// This is the only code that will be different in development
if (process.env.VERCEL_ENV === "development") {
  neonConfig.wsProxy = (host) => `${host}:54330/v1`;
  neonConfig.useSecureWebSocket = false;
  neonConfig.pipelineTLS = false;
  neonConfig.pipelineConnect = false;
}

export * from "@vercel/postgres";