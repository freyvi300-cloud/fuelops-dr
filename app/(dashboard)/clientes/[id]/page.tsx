import { notFound }              from "next/navigation"
import { getCustomerDetailData } from "@/app/actions/customer-detail"
import CustomerDetailClient      from "@/components/clientes/customer-detail-client"

export const dynamic = "force-dynamic"

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const data   = await getCustomerDetailData(id)

  if (!data) notFound()

  return <CustomerDetailClient data={data} />
}
