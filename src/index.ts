import { Context, Hono } from 'hono'
import {
  ApiError,
  CheckoutPaymentIntent,
  Client,
  Environment,
  LogLevel,
  OrdersController,
} from "@paypal/paypal-server-sdk";
import { ContentfulStatusCode } from 'hono/utils/http-status';

const app = new Hono()

// --- ENV ---
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID!
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET!

// --- PayPal Client ---
const client = new Client({
  clientCredentialsAuthCredentials: {
    oAuthClientId: PAYPAL_CLIENT_ID,
    oAuthClientSecret: PAYPAL_CLIENT_SECRET,
  },
  timeout: 0,
  environment: Environment.Production,
  logging: {
    logLevel: LogLevel.Info,
    logRequest: {
      logBody: true,
    },
    logResponse: {
      logHeaders: true,
    },
  },
})

const ordersController = new OrdersController(client)

// --- Helpers ---
const createOrder = async (amount: any) => {
  const collect = {
    body: {
      intent: CheckoutPaymentIntent.Capture,
      purchaseUnits: [
        {
          amount: {
            currencyCode: "USD",
            value: amount.toString(),
          },
        },
      ],
    },
    prefer: "return=minimal",
  }

  try {
    const { body, ...httpResponse } = await ordersController.createOrder(collect)
    return {
      jsonResponse: JSON.parse(body.toString()),
      httpStatusCode: httpResponse.statusCode,
    }
  } catch (error) {
    if (error instanceof ApiError) throw new Error(error.message)
    throw error
  }
}

const captureOrder = async (orderID: string, pakasir_id: string) => {
  const collect = {
    id: orderID,
    prefer: "return=minimal",
  }

  try {
    const { body, ...httpResponse } = await ordersController.captureOrder(collect)
    return {
      jsonResponse: JSON.parse(body.toString()),
      httpStatusCode: httpResponse.statusCode,
    }
  } catch (error) {
    if (error instanceof ApiError) throw new Error(error.message)
    throw error
  }
}

// --- ROUTES ---

// Create order
app.post('/api/orders', async (c: Context) => {
  try {
    const body = await c.req.json()
    const { amount } = body

    const { jsonResponse, httpStatusCode } = await createOrder(amount)

    return c.json(jsonResponse, httpStatusCode as ContentfulStatusCode)
  } catch (err) {
    console.error("Failed to create order:", err)
    return c.json({ error: "Failed to create order." }, 500)
  }
})

// Capture order
app.post('/api/orders/:orderID/capture', async (c) => {
  try {
    const { pakasir_id } = await c.req.json()
    const orderID = c.req.param('orderID')
    const { jsonResponse, httpStatusCode } = await captureOrder(orderID, pakasir_id)
    await sendWebhookToPakasir(pakasir_id, orderID)

    return c.json(jsonResponse, httpStatusCode as ContentfulStatusCode)
  } catch (err) {
    console.error("Failed to capture order:", err)
    return c.json({ error: "Failed to capture order." }, 500)
  }
})

async function sendWebhookToPakasir(id: string, paypal_id: string) {
  const res = await fetch(`https://app.pakasir.com/api/webhook-paypal-2?secret=${process.env.PAKASIR_SECRET}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id,
      paypal_id,
    }),
  })

  if (!res.ok) {
    console.error('Failed to send webhook to Pakasir', res.status, res.statusText)
    throw new Error('Failed to send webhook to Pakasir')
  }

  const data = await res.json()
  console.log('Response from Pakasir:', data);
  return data
}

export default app
