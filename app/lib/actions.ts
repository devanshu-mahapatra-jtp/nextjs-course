// 'use server';

// import { z } from 'zod';
 
// const FormSchema = z.object({
//   id: z.string(),
//   customerId: z.string(),
//   amount: z.coerce.number(),
//   status: z.enum(['pending', 'paid']),
//   date: z.string(),
// });
 
// const CreateInvoice = FormSchema.omit({ id: true, date: true });

// export async function createInvoice(formData: FormData) {
//     const { customerId, amount, status } = CreateInvoice.parse({
//       customerId: formData.get('customerId'),
//       amount: formData.get('amount'),
//       status: formData.get('status'),
//     });
//     const amountInCents = amount * 100;
//     const date =new Date().toISOString().split('T')[0];
//   }

'use server';

import { z } from 'zod';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';



// Configure neon to use ws for WebSocket
neonConfig.webSocketConstructor = ws;

// If in development, use the WebSocket proxy
if (process.env.VERCEL_ENV === "development") {
  neonConfig.wsProxy = (host) => `${host}:54330/v1`;
  neonConfig.useSecureWebSocket = false;
  neonConfig.pipelineTLS = false;
  neonConfig.pipelineConnect = false;
}

// Create a new pool using the connection string from your .env file
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

const FormSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  amount: z.coerce.number(),
  status: z.enum(['pending', 'paid']),
  date: z.string(),
});
 
const CreateInvoice = FormSchema.omit({ id: true, date: true });

export async function createInvoice(formData: FormData) {
    const { customerId, amount, status } = CreateInvoice.parse({
      customerId: formData.get('customerId'),
      amount: formData.get('amount'),
      status: formData.get('status'),
    });
    const amountInCents = amount * 100;
    const date = new Date().toISOString().split('T')[0];

    try {
      const client = await pool.connect();
      await client.query(`
        INSERT INTO invoices (customer_id, amount, status, date)
        VALUES ($1, $2, $3, $4)
      `, [customerId, amountInCents, status, date]);
      client.release();
    } catch (error) {
      console.error('Database Error:', error);
      throw new Error('Failed to create invoice.');
    }
    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
}