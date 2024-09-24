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
    customerId: z.string({
      invalid_type_error: 'Please select a customer.',
    }),
    amount: z.coerce
      .number()
      .gt(0, { message: 'Please enter an amount greater than $0.' }),
    status: z.enum(['pending', 'paid'], {
      invalid_type_error: 'Please select an invoice status.',
    }),
    date: z.string(),
  });
 
const CreateInvoice = FormSchema.omit({ id: true, date: true });
const UpdateInvoice = FormSchema.omit({ id: true, date: true });

export type State = {
    errors?: {
      customerId?: string[];
      amount?: string[];
      status?: string[];
    };
    message?: string | null;
  };
   
  export async function createInvoice(prevState: State, formData: FormData) {
    // Validate form using Zod
    const validatedFields = CreateInvoice.safeParse({
      customerId: formData.get('customerId'),
      amount: formData.get('amount'),
      status: formData.get('status'),
    });
   
    // If form validation fails, return errors early. Otherwise, continue.
    if (!validatedFields.success) {
      return {
        errors: validatedFields.error.flatten().fieldErrors,
        message: 'Missing Fields. Failed to Create Invoice.',
      };
    }
   
    // Prepare data for insertion into the database
    const { customerId, amount, status } = validatedFields.data;
    const amountInCents = amount * 100;
    const date = new Date().toISOString().split('T')[0];
   
    // Insert data into the database
    try {
      const client = await pool.connect();
      await client.query(`
        INSERT INTO invoices (customer_id, amount, status, date)
        VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
      `);
    } catch (error) {
      // If a database error occurs, return a more specific error.
      return {
        message: 'Database Error: Failed to Create Invoice.',
      };
    }
   
    // Revalidate the cache for the invoices page and redirect the user.
    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
  }

export async function updateInvoice(id: string, formData: FormData) {
    const { customerId, amount, status } = UpdateInvoice.parse({
      customerId: formData.get('customerId'),
      amount: formData.get('amount'),
      status: formData.get('status'),
    });
    const amountInCents = amount * 100;

    try {
      const client = await pool.connect();
      await client.query(`
        UPDATE invoices 
        SET customer_id = $1, amount = $2, status = $3
        WHERE id = $4
      `, [customerId, amountInCents, status, id]);
      client.release();
    } catch (error) {
      console.error('Database Error:', error);
      throw new Error('Failed to update invoice.');
    }

    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
}


export async function deleteInvoice(id: string) {
    try {
      const client = await pool.connect();
      await client.query('DELETE FROM invoices WHERE id = $1', [id]);
      client.release();
    } catch (error) {
      console.error('Database Error:', error);
      throw new Error('Failed to delete invoice.');
    }

    revalidatePath('/dashboard/invoices');
}