import { getPaymentGatewaySettings } from '@/lib/actions/payment-settings'
import PaymentGatewayForm from '@/components/admin/PaymentGatewayForm'

export default async function AdminPaymentsPage() {
  const { paystackEnabled, tellerEnabled } = await getPaymentGatewaySettings()

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-1">Payment Gateways</h1>
      <p className="text-sm text-gray-400 mb-6">Choose which payment methods shoppers can use at checkout. At least one must stay enabled.</p>
      <PaymentGatewayForm initialPaystackEnabled={paystackEnabled} initialTellerEnabled={tellerEnabled} />
    </div>
  )
}
